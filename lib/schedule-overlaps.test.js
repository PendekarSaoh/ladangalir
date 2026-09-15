import test from 'node:test';
import assert from 'node:assert/strict';
import { findScheduleOverlaps, canSaveSchedule, layoutTimelineLanes } from './schedule-overlaps.js';
import { buildBasicSchedule } from './basic-schedule.js';
import { buildProductionSchedule } from './production-schedule.js';

const crops = [{ id: 'a', nama: 'Kangkung', tempohTuaian: 25 }, { id: 'b', nama: 'Bayam', tempohTuaian: 21 }];
const plots = [{ id: 'p', nama: 'Petak 1' }];
const rows = crops.map(c => ({ cropId: c.id, plotIds: ['p'], mode: 'start', date: '2026-09-01' }));
const inputs = { crops, plots, plantings: [], rows, targetDate: '2026-10-01', windowDays: 3, planName: 'Campuran' };

for (const [name, build] of [['basic', buildBasicSchedule], ['production', buildProductionSchedule]]) {
  test(`${name}: a shared plot saves only after the displayed overlaps are confirmed`, () => {
    const result = build(inputs);
    assert.equal(result.items.length, 2);
    assert.equal(result.warnings.length, 1);
    assert.equal(canSaveSchedule(result, result.warnings, false), false);
    assert.equal(canSaveSchedule(result, result.warnings, true), true);
    assert.equal(canSaveSchedule(result, result.warnings, false), false);
  });
  test(`${name}: invalid choices remain blocked even when overlap is confirmed`, () => {
    const result = build({ ...inputs, rows: [...rows, { ...rows[0], plotIds: ['missing'] }] });
    assert.ok(result.errors.length);
    assert.equal(canSaveSchedule(result, result.warnings, true), false);
  });
}
test('a changed overlap needs fresh confirmation before saving', () => {
  const prior = buildBasicSchedule(inputs);
  const changed = buildBasicSchedule({ ...inputs, rows: [rows[0], { ...rows[1], date: '2026-09-03' }] });
  assert.equal(canSaveSchedule(changed, prior.warnings, true), false);
  assert.equal(canSaveSchedule(changed, changed.warnings, true), true);
  const concurrent = buildBasicSchedule({ ...inputs, plantings: [{ id: 'newly-saved', plotId: 'p', cropId: 'a', tarikhTanam: '2026-09-01', tarikhTuaianDijangka: '2026-09-30' }] });
  assert.equal(canSaveSchedule(concurrent, prior.warnings, true), false);
});
test('a schedule without overlaps saves normally without extra confirmation', () => {
  const result = buildBasicSchedule({ ...inputs, rows: [rows[0]] });
  assert.deepEqual(result.warnings, []);
  assert.equal(canSaveSchedule(result, [], false), true);
  assert.equal(canSaveSchedule({ items: [], errors: [], warnings: [] }, [], true), false);
});
test('lists all shared pairs against saved and new records with exact overlap dates', () => {
  const base = { plotId: 'p', cropId: 'a', tarikhTanam: '2026-09-01', tarikhTuaianDijangka: '2026-09-30' };
  const items = [{ ...base, cropId: 'b', tarikhTanam: '2026-09-05' }, { ...base, tarikhTanam: '2026-09-10' }];
  const plantings = [{ ...base, id: 'saved', tarikhTamatDijangka: '2026-10-01' }];
  const warnings = findScheduleOverlaps({ items, plantings, crops, plots });
  assert.equal(warnings.length, 3);
  assert.equal(warnings.filter(w => w.source === 'disimpan').length, 2);
  assert.equal(warnings[2].start, '2026-09-10');
  assert.equal(warnings[2].end, '2026-09-30');
  assert.equal(canSaveSchedule({ items, warnings, errors: [] }, warnings, false), false);
});
test('timeline places every overlapping crop on a separate lane and reuses free lanes', () => {
  const items = [
    { id: '1', tarikhTanam: '2026-09-01', tarikhTuaianDijangka: '2026-09-30' },
    { id: '2', tarikhTanam: '2026-09-05', tarikhTuaianDijangka: '2026-09-20' },
    { id: '3', tarikhTanam: '2026-09-15', tarikhTuaianDijangka: '2026-09-25' },
    { id: '4', tarikhTanam: '2026-10-01', tarikhTuaianDijangka: '2026-10-25' },
  ];
  const original = structuredClone(items);
  const result = layoutTimelineLanes(items);
  assert.equal(result.laneCount, 3);
  assert.deepEqual(result.entries.map(e => e.lane), [0, 1, 2, 0]);
  assert.deepEqual(items, original);
});

test('overdue stored crop requires confirmation until its actual completion is recorded', () => {
  const item = { plotId: 'p', cropId: 'b', tarikhTanam: '2026-10-01', tarikhTuaianDijangka: '2026-10-22' };
  const stored = { id: 'old', plotId: 'p', cropId: 'a', tarikhTanam: '2026-08-01', tarikhTuaianDijangka: '2026-08-26', rekod: {} };
  const args = { items: [item], plantings: [stored], crops, plots, today: '2026-09-15' };
  const warnings = findScheduleOverlaps(args);
  assert.equal(warnings.length, 1); assert.equal(warnings[0].unfinished, true); assert.equal(warnings[0].expectedEnd, '2026-08-26');
  assert.equal(canSaveSchedule({ items: [item], warnings }, warnings, false), false);
  assert.equal(canSaveSchedule({ items: [item], warnings }, warnings, true), true);
  assert.deepEqual(findScheduleOverlaps({ ...args, plantings: [{ ...stored, rekod: { tarikhTuaianSebenar: '2026-09-14' } }] }), []);
});
test('future planned cycles and draft historical rows are not assumed indefinitely occupied', () => {
  const base = { plotId: 'p', cropId: 'a', tarikhTanam: '2026-10-01', tarikhTuaianDijangka: '2026-10-26' };
  const next = { ...base, tarikhTanam: '2026-11-01', tarikhTuaianDijangka: '2026-11-26' };
  assert.deepEqual(findScheduleOverlaps({ items: [next], plantings: [base], crops, plots, today: '2026-09-15' }), []);
  assert.deepEqual(findScheduleOverlaps({ items: [base, next], plantings: [], crops, plots, today: '2026-12-15' }), []);
});
test('legacy repeated-harvest schedules reserve the productive period even without a saved end date', () => {
  const stored = { id: 'old', plotId: 'p', cropId: 'a', tarikhTanam: '2026-09-01', tarikhTuaianDijangka: '2026-10-01' };
  const item = { ...stored, id: 'new', tarikhTanam: '2026-10-20', tarikhTuaianDijangka: '2026-11-14' };
  const warnings = findScheduleOverlaps({ items: [item], plantings: [stored], crops: [{ ...crops[0], jenisTuaian: 'berkali', tempohProduktif: 30 }], plots, today: '2026-09-15' });
  assert.equal(warnings.length, 1); assert.equal(warnings[0].end, '2026-10-31'); assert.equal(warnings[0].unfinished, undefined);
});
