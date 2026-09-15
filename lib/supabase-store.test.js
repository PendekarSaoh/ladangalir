import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStore } from './supabase-store.js';
import { assertUnchanged } from './farm-store.js';
import { handleFarmRequest, publicConfiguration, validateChange } from './server/supabase-farm.js';

const owner = '00000000-0000-4000-8000-000000000001';
const crop = { id: 'c', nama: 'Kangkung', tempohTuaian: 25, kadarBenihSepetak: 1, kosBenihSeunit: 1, kadarBajaSepetak: 1, kosBajaSeunit: 1, kadarAirSepetakHari: 1, anggaranHasilSepetak: 1, hargaJualSeunit: 1 };
const data = () => ({ crops: [crop], plots: [{ id: 'p', nama: 'Petak 1' }], plantings: [] });
const saved = () => ({ version: 1, farmId: owner, revision: 1, data: data() });
const env = { SUPABASE_STORAGE_ENABLED: 'true', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SECRET_KEY: 'sb_secret_hidden' };
const response = (value, status = 200) => Response.json(value, { status });
const id = () => crypto.randomUUID();

test('public config never includes secret keys; incomplete enabled config cannot silently use local storage', () => {
  assert.deepEqual(publicConfiguration({}), { mode: 'local' });
  assert.deepEqual(publicConfiguration(env), { mode: 'supabase', url: env.SUPABASE_URL, publicKey: env.SUPABASE_PUBLISHABLE_KEY });
  assert.throws(() => publicConfiguration({ ...env, SUPABASE_SECRET_KEY: '' }), /belum lengkap/);
  assert.throws(() => publicConfiguration({ ...env, SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_SECRET_KEY }), /tidak sah/);
});
test('JSONB key ordering does not cause false stale-record conflicts', () => {
  assert.doesNotThrow(() => assertUnchanged({ id: 'a', rekod: { x: 1, y: 2 } }, { rekod: { y: 2, x: 1 }, id: 'a' }));
  assert.throws(() => assertUnchanged({ id: 'a', x: 1 }, { x: 2, id: 'a' }), /berubah/);
});
test('farm API rejects missing/forged sessions before privileged DB calls', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response({ message: 'bad token' }, 401); };
  const missing = await handleFarmRequest(new Request('https://app/api/farm'), { env, fetchImpl });
  assert.equal(missing.status, 401); assert.equal(calls, 0);
  const forged = await handleFarmRequest(new Request('https://app/api/farm', { headers: { Authorization: 'Bearer forged' } }), { env, fetchImpl });
  assert.equal(forged.status, 401); assert.equal(calls, 1);
});
test('farm ownership comes only from verified Auth identity, ignoring a caller-supplied owner', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return url.endsWith('/user') ? response({ id: owner }) : response(saved()); };
  const result = await handleFarmRequest(new Request('https://app/api/farm?owner=someone-else', { headers: { Authorization: 'Bearer signed-user' } }), { env, fetchImpl });
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(calls[1].options.body).p_owner, owner);
  assert.equal(calls[0].options.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(calls[1].options.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});
test('network and database failures are errors, not successful saves or local fallbacks', async () => {
  const store = createSupabaseStore({ getToken: async () => 'token', fetchImpl: async () => { throw new Error('offline'); } });
  await assert.rejects(store.read(), /Sambungan terputus/);
  const result = await handleFarmRequest(new Request('https://app/api/farm', { headers: { Authorization: 'Bearer token' } }), { env, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(result.status, 503);
});
test('server checks overlap acknowledgement, reference validity, and prohibits schedule changes through logs', () => {
  const current = saved(); const item = { id: 'a', cropId: 'c', plotId: 'p', tarikhTanam: '2026-09-01', tarikhTuaianDijangka: '2026-09-26', rekod: {} };
  current.data.plantings = [item];
  const body = { requestId: id(), revision: 1, data: { ...data(), plantings: [item, { ...item, id: 'b' }] } };
  assert.throws(() => validateChange(current, body, '2026-09-15'), /pertindihan/);
  assert.throws(() => validateChange(current, { ...body, data: { ...data(), plantings: [{ ...item, plotId: 'missing' }] } }, '2026-09-15'), /rujukan/);
  assert.throws(() => validateChange(current, { ...body, data: { ...data(), plantings: [{ ...item, tarikhTanam: '2026-09-02' }] } }, '2026-09-15'), /tidak boleh diubah/);
  assert.doesNotThrow(() => validateChange(current, { ...body, data: { ...data(), plantings: [{ ...item, rekod: { hasilSebenar: 2 } }] } }, '2026-09-15'));
});
test('first import is allowed once and never overwrites existing cloud data', () => {
  const body = { data: data(), kind: 'import', revision: 0, requestId: id() };
  assert.doesNotThrow(() => validateChange(null, body));
  assert.throws(() => validateChange(saved(), body), /tidak boleh menimpa/);
});
test('client re-reads and re-applies unrelated edits after a concurrent revision conflict', async () => {
  let cloud = saved(), conflict = true;
  const store = createSupabaseStore({ getToken: async () => 'token', fetchImpl: async (_url, options) => {
    if (options.method === 'GET') return response(cloud);
    const body = JSON.parse(options.body);
    if (conflict) { conflict = false; cloud = { ...cloud, revision: 2, data: { ...cloud.data, plots: [...cloud.data.plots, { id: 'other', nama: 'Tab lain' }] } }; return response({ error: 'conflict' }, 409); }
    assert.equal(body.revision, 2); cloud = { ...cloud, revision: 3, data: body.data }; return response(cloud);
  } });
  await store.transact(farm => ({ ...farm, plots: [...farm.plots, { id: 'mine', nama: 'Saya' }] }));
  assert.deepEqual(cloud.data.plots.map(p => p.id), ['p', 'other', 'mine']);
});
test('uncertain writes retry the same request ID without falsely accepting another edit', async () => {
  let cloud = saved(), failed = false; const requests = [];
  const store = createSupabaseStore({ getToken: async () => 'token', fetchImpl: async (_url, options) => {
    if (options.method === 'GET') return response(cloud);
    const body = JSON.parse(options.body); requests.push(body);
    if (!failed) { failed = true; cloud = { ...cloud, revision: 2, data: body.data }; throw new Error('response lost'); }
    return response(cloud);
  } });
  await assert.rejects(store.transact(farm => ({ ...farm, plots: [...farm.plots, { id: 'new', nama: 'Baharu' }] })), /belum dapat disahkan/);
  await assert.rejects(store.transact(() => data()), /terdahulu telah disahkan/);
  assert.deepEqual(requests[0], requests[1]); assert.equal(cloud.data.plots.length, 2);
});
test('cloud writes queue within one tab, even without Web Locks', async () => {
  let cloud = saved();
  const store = createSupabaseStore({ getToken: async () => 'token', fetchImpl: async (_url, options) => {
    if (options.method === 'GET') return response(cloud);
    const body = JSON.parse(options.body); assert.equal(body.revision, cloud.revision);
    cloud = { ...cloud, revision: cloud.revision + 1, data: body.data }; return response(cloud);
  } });
  await Promise.all(['a', 'b'].map(id => store.transact(farm => ({ ...farm, plots: [...farm.plots, { id, nama: id }] }))));
  assert.equal(cloud.data.plots.length, 3);
});
