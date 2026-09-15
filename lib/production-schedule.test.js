import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionSchedule } from './production-schedule.js';

const crops = [
  { id: 'a', nama: 'Kangkung', tempohTuaian: 25, anggaranHasilSepetak: 0 },
  { id: 'b', nama: 'Cili', tempohTuaian: 60, kaedahTanam: 'pindah', tempohSemaian: 20, jenisTuaian: 'berkali', tempohProduktif: 30 },
];
const plots = ['1', '2', '3', '4'].map(id => ({ id, nama: `Petak ${id}` }));
const row = (cropId, plotIds) => ({ cropId, plotIds });
const plan = (rows, extra = {}) => buildProductionSchedule({ crops, plots, plantings: [], rows, targetDate: '2026-12-03', windowDays: 3, planName: 'Pasar Sabtu', ...extra });

test('uses exactly the selected plots without a weight or yield requirement', () => {
  const result = plan([row('a', ['4', '2'])]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.items.map(p => p.plotId), ['4', '2']);
  assert.equal(result.summaries[0].plotsNeeded, 2);
  assert.deepEqual(result.summaries[0].selectedPlots.map(p => p.nama), ['Petak 4', 'Petak 2']);
  assert.ok(result.items.every(p => !Object.hasOwn(p, 'sasaranHasilKg')));
});
test('all crops share harvest date while nursery and field dates follow each crop profile', () => {
  const result = plan([row('a', ['1', '2']), row('b', ['4'])]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.items.length, 3);
  assert.ok(result.items.every(p => p.tarikhTuaianDijangka === '2026-12-03'));
  assert.equal(result.items[0].tarikhTanam, '2026-11-08');
  assert.equal(result.items[0].tarikhTamatDijangka, '2026-12-06');
  assert.equal(result.items[2].tarikhSemai, '2026-09-14');
  assert.equal(result.items[2].tarikhTanam, '2026-10-04');
  assert.equal(result.items[2].tarikhTamatDijangka, '2027-01-02');
});
test('blocks empty or stale choices without partially saving another row', () => {
  for (const invalid of [row('a', []), row('a', ['missing']), row('missing', ['3'])]) {
    const result = plan([row('b', ['4']), invalid]);
    assert.ok(result.errors.length);
    assert.equal(result.items.length, 0);
  }
});
test('shared plots across crops warn and duplicate clicks within a row are deduplicated', () => {
  const result = plan([row('a', ['1']), row('b', ['1'])]);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.equal(plan([row('a', ['1', '1'])]).items.length, 1);
});
test('occupied selected plot is preserved with a warning', () => {
  const result = plan([row('a', ['2'])], { plantings: [{ plotId: '2', cropId: 'a', tarikhTanam: '2026-11-01', tarikhTuaianDijangka: '2026-11-26', rekod: {} }] });
  assert.deepEqual(result.items.map(p => p.plotId), ['2']);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings[0].plotName, 'Petak 2');
});
test('reserves the full productive period and the harvest window boundary', () => {
  const existing = end => ({ plantings: [{ plotId: '2', cropId: 'b', tarikhTanam: '2026-07-01', tarikhTuaianDijangka: '2026-09-01', tarikhTamatDijangka: end, rekod: {} }] });
  assert.ok(plan([row('a', ['2'])], existing('2026-11-08')).warnings.length);
  assert.equal(plan([row('a', ['2'])], existing('2026-11-07')).warnings.length, 0);
  const next = { plotId: '2', cropId: 'a', tarikhTanam: '2026-12-06', tarikhTuaianDijangka: '2026-12-31', rekod: {} };
  assert.ok(plan([row('a', ['2'])], { plantings: [next] }).warnings.length);
});
test('a completed harvest releases the plot while historical overlap still warns', () => {
  const p = { plotId: '1', cropId: 'a', tarikhTanam: '2026-11-01', tarikhTuaianDijangka: '2026-12-01', rekod: { tarikhTuaianSebenar: '2026-11-07' } };
  assert.equal(plan([row('a', ['1'])], { plantings: [p] }).warnings.length, 0);
  assert.ok(plan([row('a', ['1'])], { plantings: [p], targetDate: '2026-11-30' }).warnings.length);
});
test('past harvest dates remain available and invalid dates or windows are blocked', () => {
  assert.equal(plan([row('b', ['1'])], { targetDate: '2020-02-29' }).items.length, 1);
  for (const patch of [{ targetDate: '' }, { targetDate: '2026-02-30' }, { windowDays: -1 }, { windowDays: 15 }, { windowDays: 1.5 }, { planName: ' ' }]) {
    assert.ok(plan([row('a', ['1'])], patch).errors.length);
  }
});
test('existing records, including older weight-based plans, are not rewritten', () => {
  const prior = [{ plotId: '4', cropId: 'a', tarikhTanam: '2025-01-01', tarikhTuaianDijangka: '2025-01-26', sasaranHasilKg: 12, planJenis: 'pengeluaran', batchId: 'legacy', rekod: {} }];
  const copy = structuredClone(prior);
  const result = plan([row('a', ['4'])], { plantings: prior });
  assert.equal(result.items.length, 1);
  assert.deepEqual(prior, copy);
});
