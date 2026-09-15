import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSchedule } from './farm-operations.js';
import { findScheduleOverlaps } from './schedule-overlaps.js';

const crop = {
  id: 'crop_kangkung', nama: 'Kangkung', tempohTuaian: 25, kadarBenihSepetak: 0.1, kosBenihSeunit: 4,
  kadarBajaSepetak: 0.5, kosBajaSeunit: 2, kadarAirSepetakHari: 5, anggaranHasilSepetak: 2, hargaJualSeunit: 3,
};
const plot = { id: 'plot_1', nama: 'Petak 1' };
const batch = { id: 'plant_1', batchId: 'basic_1', cropId: crop.id, plotId: plot.id, planJenis: 'biasa', kitaran: 1, rekod: {}, tarikhSemai: '2026-09-14', tarikhTanam: '2026-09-14', tarikhTuaianDijangka: '2026-10-09', tarikhTamatDijangka: '2026-10-09' };
const farm = { crops: [crop], plots: [plot], plantings: [] };
const approval = data => ({ crops: [crop], warnings: findScheduleOverlaps({ ...data, items: [batch] }), confirmed: true });

test('a retry that reuses the preview ids cannot save the same batch twice', () => {
  const saved = appendSchedule(farm, [batch], { crops: [crop], confirmed: false });
  assert.equal(saved.plantings.length, 1);
  assert.throws(() => appendSchedule(saved, [batch], approval(saved)), /sudah disimpan/);
  assert.equal(saved.plantings.length, 1);
});

// The index-free guarantee: only reused ids are caught, so the preview must keep its ids.
test('the same rows with freshly minted ids are accepted as a second batch', () => {
  const saved = appendSchedule(farm, [batch], { crops: [crop], confirmed: false });
  const resent = { ...batch, id: 'plant_2' };
  const twice = appendSchedule(saved, [resent], { crops: [crop], warnings: findScheduleOverlaps({ ...saved, items: [resent] }), confirmed: true });
  assert.equal(twice.plantings.length, 2);
});
