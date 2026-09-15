import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConveyorSchedule } from './conveyor-schedule.js';
const crop = { id: 'c', tempohTuaian: 60, kaedahTanam: 'pindah', tempohSemaian: 20, jenisTuaian: 'berkali', tempohProduktif: 30 };
const params = { crop, plotIds: ['p'], startDate: '2026-09-01', interval: 7, rest: 3, horizon: 180 };
test('Conveyor starts at field date, includes nursery, and rests only after final harvest', () => {
  const { items, errors } = buildConveyorSchedule(params);
  assert.deepEqual(errors, []);
  assert.equal(items[0].tarikhSemai, '2026-08-12');
  assert.equal(items[0].tarikhTanam, '2026-09-01');
  assert.equal(items[0].tarikhTuaianDijangka, '2026-10-31');
  assert.equal(items[0].tarikhTamatDijangka, '2026-11-30');
  assert.equal(items[1].tarikhTanam, '2026-12-03');
  assert.equal(items[1].tarikhSemai, '2026-11-13');
});
test('direct once-only crops keep existing interval and rest behaviour', () => {
  const { items } = buildConveyorSchedule({ ...params, crop: { id: 'c', tempohTuaian: 25 }, plotIds: ['p', 'q'], horizon: 60 });
  const p = items.filter(i => i.plotId === 'p'), q = items.filter(i => i.plotId === 'q');
  assert.equal(p[0].tarikhSemai, '2026-09-01'); assert.equal(p[1].tarikhTanam, '2026-09-29');
  assert.equal(q[0].tarikhTanam, '2026-09-08'); assert.equal(q[1].tarikhTanam, '2026-10-06');
});
test('invalid inputs fail atomically instead of crashing or looping', () => {
  for (const patch of [{ startDate: '' }, { startDate: '2026-02-30' }, { interval: -1 }, { rest: -60 }, { rest: 0.5 }, { horizon: 0 }, { horizon: Infinity }, { crop: { ...crop, tempohTuaian: 0 } }, { plotIds: [] }]) {
    const result = buildConveyorSchedule({ ...params, ...patch });
    assert.ok(result.errors.length); assert.deepEqual(result.items, []);
  }
});
test('past dates, leap day and duplicate plot choices remain valid', () => {
  const result = buildConveyorSchedule({ ...params, startDate: '2024-02-29', plotIds: ['p', 'p'], horizon: 1 });
  assert.deepEqual(result.errors, []); assert.equal(result.items.length, 1); assert.equal(result.items[0].tarikhSemai, '2024-02-09');
});
