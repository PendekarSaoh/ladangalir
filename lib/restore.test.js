import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRestoreFile } from './restore.js';
import { createFarmStore, STORE_KEY, LEGACY_KEYS } from './farm-store.js';

const crop = { id: 'crop_kangkung', nama: 'Kangkung', tempohTuaian: 25, kadarBenihSepetak: 0.2, kosBenihSeunit: 18, kadarBajaSepetak: 0.5, kosBajaSeunit: 2.4, kadarAirSepetakHari: 12, anggaranHasilSepetak: 4, hargaJualSeunit: 3.5 };
const plot = { id: 'plot_1', nama: 'Petak 1' };
const planting = { id: 'plant_1', cropId: 'crop_kangkung', plotId: 'plot_1', tarikhSemai: '2026-09-01', tarikhTanam: '2026-09-01', tarikhTuaianDijangka: '2026-09-26', tarikhTamatDijangka: '2026-09-26', rekod: { hasilSebenar: 4.2, tarikhTuaianSebenar: '2026-09-27' } };
const farm = () => ({ crops: [crop], plots: [plot], plantings: [planting] });
const file = value => JSON.stringify(value);

test('reads the browser backup this app downloads from local mode', () => {
  const raw = {
    [STORE_KEY]: JSON.stringify({ version: 1, revision: 4, legacy: [null, null, null], data: farm() }),
    [LEGACY_KEYS[0]]: null, [LEGACY_KEYS[1]]: null, [LEGACY_KEYS[2]]: null,
  };
  const parsed = parseRestoreFile(file(raw));
  assert.equal(parsed.source, 'sandaran pelayar');
  assert.deepEqual(parsed.counts, { crops: 1, plots: 1, plantings: 1, logged: 1 });
  assert.equal(parsed.data.plantings[0].rekod.hasilSebenar, 4.2);
});

test('reads a cloud export and a bare data file the same way', () => {
  const cloud = parseRestoreFile(file({ version: 1, exportedAt: '2026-09-15T00:00:00Z', farmId: 'farm_1', revision: 9, data: farm() }));
  assert.equal(cloud.source, 'dokumen kebun');
  assert.equal(cloud.counts.plantings, 1);
  const bare = parseRestoreFile(file(farm()));
  assert.equal(bare.source, 'fail data kebun');
  assert.deepEqual(bare.data.plots, [plot]);
});

test('fills defaults for crops saved before the planting method existed', () => {
  const old = { ...farm(), crops: [{ ...crop, kaedahTanam: undefined, jenisTuaian: undefined }] };
  const parsed = parseRestoreFile(file(old));
  assert.equal(parsed.data.crops[0].kaedahTanam, 'terus');
  assert.equal(parsed.data.crops[0].jenisTuaian, 'sekali');
});

test('rejects anything that is not a usable farm file', () => {
  assert.throws(() => parseRestoreFile(''), /kosong/);
  assert.throws(() => parseRestoreFile('bukan json'), /JSON/);
  assert.throws(() => parseRestoreFile(file({ hello: 'world' })), /tidak mengandungi data kebun/);
  assert.throws(() => parseRestoreFile(file({ [STORE_KEY]: 'rosak' })), /rosak/);
  assert.throws(() => parseRestoreFile(file({ [STORE_KEY]: JSON.stringify({ version: 1, revision: 1, legacy: [], data: { crops: [] } }) })), /tidak mengandungi data kebun/);
  assert.throws(() => parseRestoreFile(file({ [LEGACY_KEYS[0]]: '[]' })), /tidak lengkap/);
});

test('reports records that break the new rules instead of refusing the file', () => {
  const legacy = { ...farm(), plantings: [
    { ...planting, rekod: { tarikhTuaianSebenar: '2026-08-01' } },
    { ...planting, id: 'plant_2', rekod: { hasilSebenar: -5 } },
  ] };
  const parsed = parseRestoreFile(file(legacy));
  assert.equal(parsed.counts.plantings, 2);
  assert.deepEqual(parsed.flagged.map(text => text.split(' (')[1]), ['Tarikh tuaian sebenar tidak boleh sebelum tarikh tanam.)', 'Nilai rekod tidak boleh negatif.)']);
  // The message names the record so a large file can be repaired later.
  assert.match(parsed.flagged[0], /^Rekod #1: Kangkung di Petak 1, tanam 2026-09-01/);
  assert.deepEqual(parseRestoreFile(file(farm())).flagged, []);
});

test('a parsed backup goes through the real local store and reads back the same farm', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) { values.set(key, value); } };
  let queue = Promise.resolve();
  const locks = { request(_name, callback) { const result = queue.then(callback); queue = result.catch(() => {}); return result; } };
  const store = createFarmStore({ storage, locks, defaults: () => ({ crops: [], plots: [], plantings: [] }) });
  await store.initialize();
  const downloaded = file({
    [STORE_KEY]: JSON.stringify({ version: 1, revision: 7, legacy: [null, null, null], data: farm() }),
    [LEGACY_KEYS[0]]: null, [LEGACY_KEYS[1]]: null, [LEGACY_KEYS[2]]: null,
  });
  await store.transact(() => parseRestoreFile(downloaded).data, { kind: 'restore' });
  const reread = store.read();
  assert.equal(values.size, 1);
  assert.deepEqual(reread.data.crops.map(c => c.id), ['crop_kangkung']);
  assert.equal(reread.data.plantings[0].rekod.tarikhTuaianSebenar, '2026-09-27');

  // A legacy record that breaks the new rules still restores, but writing it again as a live
  // edit is refused, so it cannot be recreated once it has been corrected.
  const legacy = { ...farm(), plantings: [{ ...planting, rekod: { hasilSebenar: -4 } }] };
  const flagged = parseRestoreFile(file(legacy));
  await store.transact(() => flagged.data, { kind: 'restore' });
  assert.equal(store.read().data.plantings.length, 1);
  await assert.rejects(store.transact(data => ({ ...data, plantings: [{ ...data.plantings[0], rekod: { hasilSebenar: -6 } }] })), /tidak boleh negatif/);
});
