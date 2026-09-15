import test from 'node:test';
import assert from 'node:assert/strict';
import { basicDates, buildBasicSchedule } from './basic-schedule.js';

const direct = { id: 'kangkung', nama: 'Kangkung', tempohTuaian: 25 };
const transplant = { id: 'cili', nama: 'Cili', kaedahTanam: 'pindah', tempohSemaian: 20, tempohTuaian: 60, jenisTuaian: 'berkali', tempohProduktif: 30 };
const row = (patch = {}) => ({ cropId: direct.id, mode: 'start', date: '2026-09-14', plotIds: ['p1'], ...patch });
const plan = (rows, plantings = []) => buildBasicSchedule({ crops: [direct, transplant], plots: [{ id: 'p1', nama: 'Petak 1' }, { id: 'p2', nama: 'Petak 2' }], plantings, rows });

test('one crop and multiple plots create exactly one cycle per plot', () => {
  const result = plan([row({ plotIds: ['p1', 'p2'] })]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.items.length, 2);
  for (const p of result.items) {
    assert.equal(p.tarikhSemai, '2026-09-14');
    assert.equal(p.tarikhTuaianDijangka, '2026-10-09');
    assert.equal(p.kitaran, 1);
    assert.equal(p.planJenis, 'biasa');
  }
});
test('forward and backward calculations agree for a nursery and repeated harvest crop', () => {
  const expected = { tarikhSemai: '2026-09-14', tarikhTanam: '2026-10-04', tarikhTuaianDijangka: '2026-12-03', tarikhTamatDijangka: '2027-01-02' };
  assert.deepEqual(basicDates(transplant, row()), expected);
  assert.deepEqual(basicDates(transplant, row({ mode: 'harvest', date: '2026-12-03' })), expected);
});
test('separate crops, dates and calculation directions work in one plan', () => {
  const result = plan([row(), row({ cropId: 'cili', mode: 'harvest', date: '2026-12-03', plotIds: ['p2'] })]);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.errors, []);
});
test('leap day and year boundaries do not depend on local timezone', () => {
  assert.equal(basicDates({ ...direct, tempohTuaian: 1 }, row({ date: '2028-02-28' })).tarikhTuaianDijangka, '2028-02-29');
  assert.equal(basicDates({ ...direct, tempohTuaian: 1 }, row({ date: '2026-12-31' })).tarikhTuaianDijangka, '2027-01-01');
});
test('backward planning accepts a sowing date before today', () => {
  const result = plan([row({ cropId: 'cili', mode: 'harvest', date: '2026-11-22' })]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.items[0].tarikhSemai, '2026-09-03');
  assert.equal(result.items[0].tarikhTuaianDijangka, '2026-11-22');
});
test('planting and harvest accept past, current and future dates', () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const date of ['2020-01-15', today, '2035-06-01']) {
    for (const mode of ['start', 'harvest']) {
      for (const cropId of ['kangkung', 'cili']) {
        const result = plan([row({ date, mode, cropId })]);
        assert.deepEqual(result.errors, []);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0][mode === 'start' ? 'tarikhSemai' : 'tarikhTuaianDijangka'], date);
      }
    }
  }
});
test('invalid dates, durations and missing references are blocked', () => {
  for (const date of ['', '2026-02-30', 'not-a-date']) assert.ok(plan([row({ date })]).errors.length);
  for (const tempohTuaian of [0, -1, 1.5, Infinity, 'bad']) assert.throws(() => basicDates({ ...direct, tempohTuaian }, row()));
  for (const patch of [{ cropId: 'missing' }, { plotIds: [] }, { plotIds: ['missing'] }]) assert.ok(plan([row(patch)]).errors.length);
  assert.ok(plan([]).errors.length);
});
test('overlap with an existing record warns while preserving every chosen planting', () => {
  const existing = { plotId: 'p1', cropId: 'cili', tarikhTanam: '2026-09-01', tarikhTuaianDijangka: '2026-10-01', tarikhTamatDijangka: '2026-10-31', planJenis: 'pengeluaran', rekod: {} };
  const result = plan([row({ plotIds: ['p1', 'p2'] })], [existing]);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings[0].plotName, 'Petak 1');
  assert.equal(result.warnings[0].otherCropName, 'Cili');
});
test('overlapping rows warn, while reuse after final harvest needs no warning', () => {
  assert.ok(plan([row(), row()]).warnings.length);
  assert.ok(plan([row(), row({ date: '2026-10-09' })]).warnings.length);
  const result = plan([row(), row({ date: '2026-10-10' })]);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.warnings, []);
});
test('nursery time does not reserve field space before transplanting', () => {
  const existing = { plotId: 'p1', cropId: 'kangkung', tarikhTanam: '2026-09-01', tarikhTuaianDijangka: '2026-10-03', rekod: {} };
  assert.equal(plan([row({ cropId: 'cili' })], [existing]).items.length, 1);
});
test('actual completed harvest releases the plot and duplicate plot choices are deduplicated', () => {
  const existing = { plotId: 'p1', cropId: 'kangkung', tarikhTanam: '2026-08-01', tarikhTuaianDijangka: '2026-10-01', rekod: { tarikhTuaianSebenar: '2026-09-12' } };
  assert.equal(plan([row({ plotIds: ['p1', 'p1'] })], [existing]).items.length, 1);
});
