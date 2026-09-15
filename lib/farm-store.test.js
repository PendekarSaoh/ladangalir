import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarmStore, STORE_KEY, LEGACY_KEYS, assertUnchanged } from './farm-store.js';
import { appendSchedule, replaceRecord, deleteRecords } from './farm-operations.js';
import { findScheduleOverlaps } from './schedule-overlaps.js';

const crop = { id: 'c', nama: 'Kangkung', tempohTuaian: 25, kadarBenihSepetak: 1, kosBenihSeunit: 1, kadarBajaSepetak: 1, kosBajaSeunit: 1, kadarAirSepetakHari: 1, anggaranHasilSepetak: 1, hargaJualSeunit: 1 };
const seed = () => ({ crops: [crop], plots: [{ id: 'p', nama: 'Petak 1' }, { id: 'q', nama: 'Petak 2' }], plantings: [] });
const planting = (id, plotId = 'p') => ({ id, cropId: 'c', plotId, tarikhTanam: '2026-09-20', tarikhTuaianDijangka: '2026-10-15', batchId: id, rekod: {} });
function fixture(raw = {}) {
  const values = new Map(Object.entries(raw));
  let failure = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) { if (failure) throw new Error('QuotaExceededError'); values.set(key, value); } };
  // Two store instances share the same exclusive lock queue, as tabs on one origin do.
  let queue = Promise.resolve();
  const locks = { request(name, callback) { const result = queue.then(callback); queue = result.catch(() => {}); return result; } };
  const connect = () => createFarmStore({ storage, locks, defaults: seed });
  return { values, storage, locks, connect, fail: () => { failure = true; }, recover: () => { failure = false; } };
}
function approval(store, items) {
  const data = store.read().data;
  return { crops: data.crops, warnings: findScheduleOverlaps({ ...data, items, today: '2026-09-15' }), confirmed: true, today: '2026-09-15' };
}

test('concurrent tabs append unrelated schedules without losing either record', async () => {
  const f = fixture(); const a = f.connect(), b = f.connect();
  await Promise.all([a.initialize(), b.initialize()]);
  const first = [planting('a')], second = [planting('b', 'q')];
  const aa = approval(a, first), ab = approval(b, second);
  await Promise.all([a.transact(data => appendSchedule(data, first, aa)), b.transact(data => appendSchedule(data, second, ab))]);
  assert.deepEqual(a.read().data.plantings.map(p => p.id), ['a', 'b']);
  assert.equal(a.read().revision, b.read().revision);
});
test('an overlap introduced by another tab is blocked at commit, then saves after review', async () => {
  const f = fixture(); const a = f.connect(), b = f.connect(); await a.initialize();
  const aa = approval(a, [planting('a')]), ab = approval(b, [planting('b')]);
  const results = await Promise.allSettled([a.transact(data => appendSchedule(data, [planting('a')], aa)), b.transact(data => appendSchedule(data, [planting('b')], ab))]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'rejected');
  assert.equal(a.read().data.plantings.length, 1);
  await b.transact(data => appendSchedule(data, [planting('b')], approval(b, [planting('b')])));
  assert.equal(a.read().data.plantings.length, 2);
});
test('crop changes and deleted plot choices cannot pass stale schedule approval', async () => {
  const f = fixture(); const a = f.connect(); await a.initialize(); const reviewed = approval(a, [planting('a')]);
  await a.transact(data => ({ ...data, crops: data.crops.map(c => ({ ...c, tempohTuaian: 40 })) }));
  await assert.rejects(a.transact(data => appendSchedule(data, [planting('a')], reviewed)), /berubah/);
  await a.transact(data => ({ ...data, plots: data.plots.filter(p => p.id !== 'p') }));
  await assert.rejects(a.transact(data => appendSchedule(data, [planting('a')], reviewed)), /dipadam/);
});
test('failed writes leave persisted data and revision unchanged and can be retried', async () => {
  const f = fixture(); const store = f.connect(); await store.initialize();
  const before = f.values.get(STORE_KEY); f.fail();
  await assert.rejects(store.transact(data => ({ ...data, plots: [...data.plots, { id: 'new', nama: 'Baharu' }] })), /Belum disimpan/);
  assert.equal(f.values.get(STORE_KEY), before);
  f.recover(); await store.transact(data => ({ ...data, plots: [...data.plots, { id: 'new', nama: 'Baharu' }] }));
  assert.equal(store.read().data.plots.length, 3);
});
test('same-record edits reject a stale modal snapshot instead of overwriting newer logs', async () => {
  const f = fixture(); const store = f.connect(); await store.initialize();
  await store.transact(data => ({ ...data, plantings: [planting('a')] }));
  const original = store.read().data.plantings[0];
  await store.transact(data => replaceRecord(data, 'plantings', 'a', original, p => ({ ...p, rekod: { catatan: 'Tab A' } })));
  await assert.rejects(store.transact(data => replaceRecord(data, 'plantings', 'a', original, p => ({ ...p, rekod: { catatan: 'Tab B' } }))), /berubah/);
  await assert.rejects(store.transact(data => deleteRecords(data, ['a'], [original])), /berubah/);
  assert.equal(store.read().data.plantings[0].rekod.catatan, 'Tab A');
});
test('reset is atomic on write failure and rejects a stale full-data snapshot', async () => {
  const f = fixture(); const store = f.connect(); await store.initialize();
  const expected = store.read().data;
  await store.transact(data => ({ ...data, plantings: [planting('a')] }));
  await assert.rejects(store.transact(data => { assertUnchanged(data, expected); return seed(); }), /berubah/);
  const before = f.values.get(STORE_KEY); f.fail();
  await assert.rejects(store.transact(() => seed())); assert.equal(f.values.get(STORE_KEY), before);
});
for (const raw of ['{broken-json', '[null]', '{}', '[{"id":"a"}]']) {
  test(`corrupt legacy data is preserved without seeding empty replacements: ${raw}`, async () => {
    const f = fixture({ [LEGACY_KEYS[2]]: raw }); const store = f.connect();
    await assert.rejects(store.initialize(), /Data asal dikekalkan/);
    assert.equal(f.values.get(LEGACY_KEYS[2]), raw); assert.equal(f.values.has(STORE_KEY), false);
    assert.equal(store.recovery()[LEGACY_KEYS[2]], raw);
  });
}
test('valid legacy records migrate intact once; later reads retain new changes', async () => {
  const raw = Object.fromEntries(LEGACY_KEYS.map((k, i) => [k, JSON.stringify([seed().crops, seed().plots, [planting('old')]][i])]));
  const f = fixture(raw); const store = f.connect(); await store.initialize();
  for (const [k, v] of Object.entries(raw)) assert.equal(f.values.get(k), v);
  assert.equal(store.read().data.plantings[0].id, 'old');
  await store.transact(data => ({ ...data, plantings: [] }));
  assert.equal((await f.connect().initialize()).data.plantings.length, 0);
});
test('corrupt canonical data cannot fall back to stale legacy records', async () => {
  const f = fixture({ [STORE_KEY]: '{invalid', [LEGACY_KEYS[2]]: '[]' });
  await assert.rejects(f.connect().initialize(), /Data asal dikekalkan/);
  assert.equal(f.values.get(STORE_KEY), '{invalid');
});
test('a still-open old app tab cannot silently change legacy data after migration', async () => {
  const f = fixture(); const store = f.connect(); await store.initialize(); const before = f.values.get(STORE_KEY);
  f.storage.setItem(LEGACY_KEYS[2], JSON.stringify([planting('old-tab')]));
  await assert.rejects(store.transact(data => data), /Tab versi lama/);
  assert.equal(f.values.get(STORE_KEY), before); assert.ok(store.recovery()[LEGACY_KEYS[2]].includes('old-tab'));
});
test('unsupported locks and storage access errors fail safely', async () => {
  const f = fixture(); const store = createFarmStore({ storage: f.storage, defaults: seed });
  await store.initialize(); await assert.rejects(store.transact(data => data), /pelayar terkini/);
  assert.equal(f.values.size, 0);
  const blocked = createFarmStore({ storage: { getItem() { throw new Error('denied'); } }, locks: f.locks, defaults: seed });
  await assert.rejects(blocked.initialize(), /tidak dapat dibaca/);
});
test('malformed record fields cannot reach rendering or be persisted', async () => {
  const f = fixture(); const store = f.connect(); await store.initialize(); const before = f.values.get(STORE_KEY);
  for (const invalid of [{ ...planting('a'), rekod: [] }, { ...planting('a'), tarikhTanam: '2026-02-30' }, { ...planting('a'), namaPelan: {} }, { ...planting('a'), tarikhSasaran: {} }]) {
    await assert.rejects(store.transact(data => ({ ...data, plantings: [invalid] })));
    assert.equal(f.values.get(STORE_KEY), before);
  }
});
