import { validateFarm, validateRecordValues, changedPlantings } from './farm-store.js';

export class RemoteStoreError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export function createSupabaseStore({ getToken, fetchImpl = fetch, makeId = () => crypto.randomUUID(), onSync = () => {} }) {
  let latest = null;
  let pending = null;
  let queue = Promise.resolve();
  function accept(saved) {
    if (!saved) return null;
    validateFarm(saved.data);
    if (!Number.isSafeInteger(saved.revision) || saved.revision < 1 || typeof saved.farmId !== 'string') throw new RemoteStoreError('Respons simpanan tidak sah.', 502);
    if (!latest || saved.revision >= latest.revision) latest = saved;
    onSync(latest);
    return latest;
  }
  async function request(method, body) {
    const token = await getToken();
    if (!token) throw new RemoteStoreError('Sesi tamat. Log masuk semula untuk menyimpan.', 401);
    let response;
    try { response = await fetchImpl('/api/farm', { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(30000) }); }
    catch { throw new RemoteStoreError('Sambungan terputus. Simpanan belum dapat disahkan; cuba lagi.', 503); }
    let result;
    try { result = await response.json(); } catch { throw new RemoteStoreError('Respons server tidak dapat dibaca. Cuba lagi.', 502); }
    if (!response.ok) throw new RemoteStoreError(result.error || 'Data belum disimpan.', response.status);
    return accept(result);
  }
  async function read() { return request('GET'); }
  async function sendPending() {
    try { const saved = await request('POST', pending); pending = null; return saved; }
    catch (error) {
      // Keep the exact request ID/body after an unknown network result for idempotent retry.
      if (error.status < 500 && error.status !== 401) pending = null;
      throw error;
    }
  }
  function transact(change, options = {}) {
    const job = queue.then(async () => {
      if (pending) {
        // Resolve an uncertain previous write before applying any further intent.
        await sendPending();
        throw new RemoteStoreError('Simpanan terdahulu telah disahkan. Semak paparan terkini sebelum membuat perubahan seterusnya.', 409);
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const saved = await read();
        // Restore is the one deliberate full replacement; it is allowed with or without an existing farm.
        if (!saved && options.kind !== 'import' && options.kind !== 'restore') throw new RemoteStoreError('Import atau mulakan kebun dahulu.', 409);
        if (saved && options.kind === 'import') throw new RemoteStoreError('Data kebun sudah ada. Import tidak menimpa data server.', 409);
        const data = change(structuredClone(saved?.data || { crops: [], plots: [], plantings: [] }));
        validateFarm(data);
        // Import and restore carry existing data in; the value rules govern live edits only.
        if (options.kind !== 'import' && options.kind !== 'restore') validateRecordValues(changedPlantings(saved?.data?.plantings || [], data.plantings));
        pending = { data, revision: saved?.revision || 0, requestId: makeId(), kind: options.kind || 'save', approval: options.approval };
        try { return await sendPending(); }
        catch (error) { if (error.status !== 409 || options.kind === 'import' || attempt === 2) throw error; }
      }
    });
    queue = job.catch(() => {});
    return job;
  }
  return { kind: 'supabase', initialize: read, read, transact, recovery: async () => ({ version: 1, exportedAt: new Date().toISOString(), ...(await read()) }) };
}
