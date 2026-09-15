import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStore } from './supabase-store.js';
import { assertUnchanged } from './farm-store.js';

const owner = '00000000-0000-4000-8000-000000000001';
const url = 'https://project.supabase.co';
const publicKey = 'sb_publishable_test';
const crop = { id: 'c', nama: 'Kangkung', tempohTuaian: 25, kadarBenihSepetak: 1, kosBenihSeunit: 1, kadarBajaSepetak: 1, kosBajaSeunit: 1, kadarAirSepetakHari: 1, anggaranHasilSepetak: 1, hargaJualSeunit: 1 };
const data = () => ({ crops: [crop], plots: [{ id: 'p', nama: 'Petak 1' }], plantings: [] });
const saved = () => ({ version: 1, farmId: owner, revision: 1, data: data() });
const response = (value, status = 200) => Response.json(value, { status });
const id = () => crypto.randomUUID();
const functionName = call => call.url.split('/rpc/')[1];
const connect = fetchImpl => createSupabaseStore({ url, publicKey, getToken: async () => 'user-token', fetchImpl });

test('every call goes straight to the owner-scoped function with only public credentials', async () => {
  const calls = [];
  const store = connect(async (requestUrl, options) => { calls.push({ url: requestUrl, options }); return response(saved()); });
  const read = await store.read();
  assert.equal(read.revision, 1);
  assert.equal(calls[0].url, url + '/rest/v1/rpc/ladang_read_self');
  assert.equal(calls[0].options.headers.apikey, publicKey);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer user-token');
  // Nothing secret may ride along with the request.
  assert.ok(!JSON.stringify(calls[0].options).includes('sb_secret'));
  // The owner is never sent by the browser; auth.uid() supplies it inside the database.
  assert.equal(calls[0].options.body, '{}');
});

test('a commit sends the fields the function expects, including the restore flag', async () => {
  const calls = [];
  let cloud = saved();
  const store = connect(async (requestUrl, options) => {
    calls.push({ url: requestUrl, options });
    if (functionName({ url: requestUrl }) === 'ladang_read_self') return response(cloud);
    const body = JSON.parse(options.body);
    cloud = { ...cloud, revision: cloud.revision + 1, data: body.p_data };
    return response(cloud);
  });
  await store.transact(farm => ({ ...farm, plots: [...farm.plots, { id: 'q', nama: 'Petak 2' }] }));
  const commit = calls.find(call => functionName(call) === 'ladang_commit_self');
  const body = JSON.parse(commit.options.body);
  assert.equal(body.p_expected, 1);
  assert.equal(body.p_replace, false);
  assert.ok(/^[0-9a-f-]{36}$/.test(body.p_request));
  assert.equal(body.p_data.plots.length, 2);

  const restored = { ...data(), plots: [{ id: 'p', nama: 'Petak Dipulihkan' }] };
  await store.transact(() => restored, { kind: 'restore' });
  const last = calls.filter(call => functionName(call) === 'ladang_commit_self').at(-1);
  assert.equal(JSON.parse(last.options.body).p_replace, true);
});

test('database errors become clear states instead of silent success', async () => {
  const conflict = connect(async () => response({ code: '40001', message: 'could not serialize' }, 409));
  await assert.rejects(conflict.read(), error => error.status === 409 && /berubah di peranti lain/.test(error.message));
  const expired = connect(async () => response({ message: 'JWT expired' }, 401));
  await assert.rejects(expired.read(), error => error.status === 401 && /Log masuk semula/.test(error.message));
  const offline = connect(async () => { throw new Error('offline'); });
  await assert.rejects(offline.read(), error => error.status === 503 && /Sambungan terputus/.test(error.message));
  const broken = connect(async () => response({ message: 'boom' }, 500));
  await assert.rejects(broken.read(), error => error.status === 503);
});

test('JSONB key ordering does not cause false stale-record conflicts', () => {
  assert.doesNotThrow(() => assertUnchanged({ id: 'a', rekod: { x: 1, y: 2 } }, { rekod: { y: 2, x: 1 }, id: 'a' }));
  assert.throws(() => assertUnchanged({ id: 'a', x: 1 }, { x: 2, id: 'a' }), /berubah/);
});

test('client re-reads and re-applies unrelated edits after a concurrent revision conflict', async () => {
  let cloud = saved(), conflict = true;
  const store = connect(async (requestUrl, options) => {
    if (functionName({ url: requestUrl }) === 'ladang_read_self') return response(cloud);
    const body = JSON.parse(options.body);
    if (conflict) { conflict = false; cloud = { ...cloud, revision: 2, data: { ...cloud.data, plots: [...cloud.data.plots, { id: 'other', nama: 'Tab lain' }] } }; return response({ code: '40001' }, 409); }
    assert.equal(body.p_expected, 2); cloud = { ...cloud, revision: 3, data: body.p_data }; return response(cloud);
  });
  await store.transact(farm => ({ ...farm, plots: [...farm.plots, { id: 'mine', nama: 'Saya' }] }));
  assert.deepEqual(cloud.data.plots.map(p => p.id), ['p', 'other', 'mine']);
});

test('uncertain writes retry the same request ID without falsely accepting another edit', async () => {
  let cloud = saved(), failed = false; const sent = [];
  const store = connect(async (requestUrl, options) => {
    if (functionName({ url: requestUrl }) === 'ladang_read_self') return response(cloud);
    const body = JSON.parse(options.body); sent.push(body);
    if (!failed) { failed = true; cloud = { ...cloud, revision: 2, data: body.p_data }; throw new Error('response lost'); }
    return response(cloud);
  });
  await assert.rejects(store.transact(farm => ({ ...farm, plots: [...farm.plots, { id: 'new', nama: 'Baharu' }] })), /belum dapat disahkan/);
  await assert.rejects(store.transact(() => data()), /terdahulu telah disahkan/);
  assert.deepEqual(sent[0], sent[1]); assert.equal(cloud.data.plots.length, 2);
});

test('writes queue within one tab, and import stays one-shot while restore may replace', async () => {
  let cloud = saved();
  const store = connect(async (requestUrl, options) => {
    if (functionName({ url: requestUrl }) === 'ladang_read_self') return response(cloud);
    const body = JSON.parse(options.body);
    assert.equal(body.p_expected, cloud.revision);
    cloud = { ...cloud, revision: cloud.revision + 1, data: body.p_data };
    return response(cloud);
  });
  await Promise.all(['a', 'b'].map(id => store.transact(farm => ({ ...farm, plots: [...farm.plots, { id, nama: id }] }))));
  assert.equal(cloud.data.plots.length, 3);
  const restored = { ...data(), plots: [{ id: 'p', nama: 'Petak Dipulihkan' }] };
  const outcome = await store.transact(() => restored, { kind: 'restore' });
  assert.equal(outcome.revision, 4);
  assert.deepEqual(cloud.data.plots, [{ id: 'p', nama: 'Petak Dipulihkan' }]);
  await assert.rejects(store.transact(() => restored, { kind: 'import' }), /tidak menimpa/);
});

test('an empty cloud farm is offered for import, never silently treated as a save', async () => {
  const store = connect(async () => response(null));
  assert.equal(await store.read(), null);
  await assert.rejects(store.transact(farm => farm), /Import atau mulakan kebun dahulu/);
  const backup = await createSupabaseStore({ url, publicKey, getToken: async () => 'user-token', fetchImpl: async () => response(saved()) }).recovery();
  assert.equal(backup.version, 1);
  assert.ok(backup.exportedAt);
  assert.equal(backup.farmId, owner);
});
