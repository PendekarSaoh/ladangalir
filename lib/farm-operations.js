import { assertUnchanged } from './farm-store.js';
import { findScheduleOverlaps, canSaveSchedule } from './schedule-overlaps.js';
export function appendSchedule(data, items, approval) {
  if (!approval || !items.length) throw new Error('Semak pratonton jadual dahulu.');
  for (const item of items) {
    const crop = data.crops.find(c => c.id === item.cropId);
    const plot = data.plots.find(p => p.id === item.plotId);
    if (!crop || !plot) throw new Error('Tanaman atau petak telah dipadam. Semak pilihan jadual semula.');
    assertUnchanged(crop, approval.crops.find(c => c.id === item.cropId));
    if (data.plantings.some(p => p.id === item.id)) throw new Error('Jadual ini sudah disimpan.');
  }
  const warnings = findScheduleOverlaps({ ...data, items, today: approval.today });
  if (!canSaveSchedule({ items, warnings }, approval.warnings, approval.confirmed)) throw new Error('Penggunaan petak telah berubah. Jana pratonton semula dan sahkan amaran terkini sebelum menyimpan.');
  return { ...data, plantings: [...data.plantings, ...items] };
}
export function replaceRecord(data, key, id, expected, replacement) {
  const current = data[key].find(row => row.id === id);
  assertUnchanged(current, expected);
  if (!current) throw new Error('Rekod ini tidak lagi tersedia. Buka semula borang.');
  return { ...data, [key]: data[key].map(row => row.id === id ? replacement(current) : row) };
}
export function deleteRecords(data, ids, expected) {
  const selected = data.plantings.filter(p => ids.includes(p.id));
  assertUnchanged(selected, expected);
  return { ...data, plantings: data.plantings.filter(p => !ids.includes(p.id)) };
}
