// Server-only: imported only by route handlers. Never expose the secret key in config.
import { validateFarm } from '../farm-store.js';
import { findScheduleOverlaps, canSaveSchedule } from '../schedule-overlaps.js';
import { stableStringify } from '../stable-json.js';

export class FarmApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function supabaseSettings(env = process.env) {
  if (env.SUPABASE_STORAGE_ENABLED !== 'true') return { enabled: false };
  const url = env.SUPABASE_URL?.replace(/\/$/, '');
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!url || !/^https:\/\/[^/]+$/.test(url) || !publicKey || !secretKey) throw new FarmApiError('Sambungan Supabase belum lengkap. Hubungi pemilik app.', 503);
  if (publicKey.startsWith('sb_secret_') || publicKey === secretKey) throw new FarmApiError('Tetapan kunci Supabase tidak sah.', 503);
  // Legacy JWT keys must use the anon role, never service_role.
  if (publicKey.startsWith('ey')) {
    try { if (JSON.parse(atob(publicKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') throw new Error(); }
    catch { throw new FarmApiError('Tetapan kunci awam Supabase tidak sah.', 503); }
  }
  return { enabled: true, url, publicKey, secretKey };
}
export function publicConfiguration(env) {
  const config = supabaseSettings(env);
  return config.enabled ? { mode: 'supabase', url: config.url, publicKey: config.publicKey } : { mode: 'local' };
}
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function validateReferences(data) {
  const crops = new Set(data.crops.map(c => c.id)), plots = new Set(data.plots.map(p => p.id));
  if (data.plantings.some(p => !crops.has(p.cropId) || !plots.has(p.plotId))) throw new FarmApiError('Ada jadual merujuk tanaman atau petak yang tiada. Baiki rujukan sebelum import atau simpan.');
}
export function validateChange(current, body, today) {
  try { validateFarm(body.data); } catch (e) { throw new FarmApiError(e.message); }
  validateReferences(body.data);
  if (!uuid(body.requestId) || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new FarmApiError('Permintaan simpan tidak sah.');
  if (!current) {
    if (body.kind !== 'import' || body.revision !== 0) throw new FarmApiError('Import atau mulakan kebun dahulu.', 409);
    return;
  }
  if (body.kind === 'import') throw new FarmApiError('Data kebun sudah ada. Import awal tidak boleh menimpa data server.', 409);
  if (current.revision !== body.revision) throw new FarmApiError('Data telah berubah. Semak data terkini.', 409);
  const original = new Map(current.data.plantings.map(p => [p.id, p]));
  const additions = [];
  for (const item of body.data.plantings) {
    const previous = original.get(item.id);
    if (!previous) additions.push(item);
    else {
      const { rekod: ignoredBefore, ...before } = previous;
      const { rekod: ignoredAfter, ...after } = item;
      if (stableStringify(before) !== stableStringify(after)) throw new FarmApiError('Tarikh dan petak jadual sedia ada tidak boleh diubah melalui simpanan log.');
    }
  }
  if (additions.length) {
    // Use existing records before this mutation so removal/early completion cannot bypass review.
    const warnings = findScheduleOverlaps({ ...current.data, items: additions, today });
    if (!canSaveSchedule({ items: additions, warnings }, body.approval?.warnings, body.approval?.confirmed)) throw new FarmApiError('Semak dan sahkan pertindihan terkini sebelum menyimpan.', 409);
  }
}
export function createSupabaseGateway({ config, fetchImpl = fetch }) {
  async function user(request) {
    const token = request.headers.get('authorization');
    if (!token?.startsWith('Bearer ') || token.length > 10000) throw new FarmApiError('Sila log masuk semula.', 401);
    let response;
    try { response = await fetchImpl(config.url + '/auth/v1/user', { headers: { apikey: config.publicKey, Authorization: token }, cache: 'no-store', signal: AbortSignal.timeout(15000) }); }
    catch { throw new FarmApiError('Supabase tidak dapat dihubungi. Cuba lagi.', 503); }
    if (!response.ok) throw new FarmApiError(response.status >= 500 ? 'Supabase tidak tersedia. Cuba lagi.' : 'Sesi tamat. Sila log masuk semula.', response.status >= 500 ? 503 : 401);
    const data = await response.json();
    if (!uuid(data.id)) throw new FarmApiError('Sesi pengguna tidak sah.', 401);
    return data.id;
  }
  async function rpc(name, body) {
    const headers = { apikey: config.secretKey, 'Content-Type': 'application/json' };
    if (!config.secretKey.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + config.secretKey;
    let response;
    try { response = await fetchImpl(config.url + '/rest/v1/rpc/' + name, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000) }); }
    catch { throw new FarmApiError('Simpanan belum dapat disahkan. Semak sambungan dan cuba lagi.', 503); }
    const result = await response.json();
    if (!response.ok) {
      if (result.code === '40001') throw new FarmApiError('Data telah berubah di peranti lain. Semak semula.', 409);
      throw new FarmApiError('Database belum tersedia atau permintaan tidak dapat disimpan. Cuba lagi.', 503);
    }
    return result;
  }
  return { user, read: owner => rpc('ladang_read', { p_owner: owner }), commit: (owner, body) => rpc('ladang_commit', { p_owner: owner, p_expected: body.revision, p_request: body.requestId, p_data: body.data }) };
}
export async function handleFarmRequest(request, { env = process.env, fetchImpl = fetch, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) } = {}) {
  try {
    const config = supabaseSettings(env);
    if (!config.enabled) throw new FarmApiError('Sambungan Supabase belum diaktifkan.', 503);
    const gateway = createSupabaseGateway({ config, fetchImpl });
    const owner = await gateway.user(request); // Never accept owner/farm IDs from the browser.
    if (request.method === 'GET') return json(await gateway.read(owner));
    if (request.method !== 'POST') return json({ error: 'Kaedah tidak disokong.' }, 405);
    if (!request.headers.get('content-type')?.includes('application/json')) throw new FarmApiError('Format permintaan tidak sah.', 415);
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 2_000_000) throw new FarmApiError('Data melebihi had import 2 MB. Import perlu dipecahkan.', 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new FarmApiError('Data JSON tidak sah.'); }
    if (!body || typeof body !== 'object') throw new FarmApiError('Permintaan tidak sah.');
    const current = await gateway.read(owner);
    // If a retry already committed, SQL verifies its receipt and returns current state.
    if (current && body.revision < current.revision && uuid(body.requestId)) {
      try { return json(await gateway.commit(owner, body)); }
      catch (error) { if (error.status !== 409) throw error; }
    }
    validateChange(current, body, today);
    return json(await gateway.commit(owner, body));
  } catch (error) { return json({ error: error instanceof FarmApiError ? error.message : 'Permintaan gagal. Data belum dapat disahkan; cuba lagi.' }, error.status || 500); }
}
export function json(value, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Authorization', 'X-Content-Type-Options': 'nosniff' } }); }
