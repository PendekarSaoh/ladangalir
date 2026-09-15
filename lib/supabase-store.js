import { validateFarm, validateRecordValues, changedPlantings } from './farm-store.js';

// Talks to Supabase directly, so a static host needs no server of its own. The browser holds
// only the publishable key plus the signed-in user's token; every call runs a SECURITY DEFINER
// function that derives the owner from auth.uid() and never trusts a client-supplied id.
export class RemoteStoreError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export function createSupabaseStore({ url, publicKey, getToken, fetchImpl = fetch, makeId = () => crypto.randomUUID(), onSync = () => {} }) {
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
  async function rpc(name, body) {
    const token = await getToken();
    if (!token) throw new RemoteStoreError('Sesi tamat. Log masuk semula untuk menyimpan.', 401);
    let response;
    try {
      response = await fetchImpl(url + '/rest/v1/rpc/' + name, {
        method: 'POST',
        headers: { apikey: publicKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      });
    } catch { throw new RemoteStoreError('Sambungan terputus. Simpanan belum dapat disahkan; cuba lagi.', 503); }
    let result;
    try { result = await response.json(); } catch { throw new RemoteStoreError('Respons server tidak dapat dibaca. Cuba lagi.', 502); }
    if (!response.ok) {
      // 40001 is the serialization/conflict code raised by the commit function.
      if (result?.code === '40001') throw new RemoteStoreError('Data telah berubah di peranti lain. Semak semula.', 409);
      if (response.status === 401 || response.status === 403) throw new RemoteStoreError('Sesi tamat atau akses ditolak. Log masuk semula.', 401);
      if (response.status >= 500) throw new RemoteStoreError('Data belum dapat disahkan; cuba lagi.', 503);
      throw new RemoteStoreError(result?.message || 'Data belum disimpan.', response.status);
    }
    return result;
  }
  async function read() { return accept(await rpc('ladang_read_self', {})); }
  async function sendPending() {
    try {
      const saved = await commit();
      pending = null;
      return saved;
    } catch (error) {
      // Keep the exact request ID and body after an unknown network result for idempotent retry.
      if (error.status < 500 && error.status !== 401) pending = null;
      throw error;
    }
  }
  async function commit() {
    return accept(await rpc('ladang_commit_self', {
      p_expected: pending.revision,
      p_request: pending.requestId,
      p_data: pending.data,
      p_replace: pending.kind === 'restore',
    }));
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
        const restore = options.kind === 'restore';
        if (!saved && options.kind !== 'import' && !restore) throw new RemoteStoreError('Import atau mulakan kebun dahulu.', 409);
        if (saved && options.kind === 'import') throw new RemoteStoreError('Data kebun sudah ada. Import tidak menimpa data server.', 409);
        const data = change(structuredClone(saved?.data || { crops: [], plots: [], plantings: [] }));
        validateFarm(data);
        // Import and restore carry existing data in; the value rules govern live edits only.
        if (options.kind !== 'import' && !restore) validateRecordValues(changedPlantings(saved?.data?.plantings || [], data.plantings));
        pending = { data, revision: saved?.revision || 0, requestId: makeId(), kind: options.kind || 'save' };
        try { return await sendPending(); }
        catch (error) { if (error.status !== 409 || options.kind === 'import' || attempt === 2) throw error; }
      }
    });
    queue = job.catch(() => {});
    return job;
  }
  return { kind: 'supabase', initialize: read, read, transact, recovery: async () => ({ version: 1, exportedAt: new Date().toISOString(), ...(await read()) }) };
}
