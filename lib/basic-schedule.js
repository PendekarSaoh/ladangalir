import { findScheduleOverlaps } from './schedule-overlaps.js';

const DAY = 86400000;

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function shift(date, days) {
  const value = new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
  if (!validDate(value)) throw new Error('Tarikh di luar julat yang disokong.');
  return value;
}

export function basicDates(crop, row) {
  if (!crop) throw new Error('Pilih tanaman yang tersedia.');
  if (!validDate(row.date)) throw new Error('Pilih tarikh yang sah.');
  if (!['start', 'harvest'].includes(row.mode)) throw new Error('Pilih cara pengiraan tarikh.');
  const harvestDays = Number(crop.tempohTuaian);
  const nurseryDays = crop.kaedahTanam === 'pindah' ? Number(crop.tempohSemaian ?? 0) : 0;
  const productiveDays = crop.jenisTuaian === 'berkali' ? Number(crop.tempohProduktif ?? 0) : 0;
  if (!Number.isSafeInteger(harvestDays) || harvestDays < 1 ||
      !Number.isSafeInteger(nurseryDays) || nurseryDays < 0 ||
      !Number.isSafeInteger(productiveDays) || productiveDays < 0) {
    throw new Error('Semak tempoh tuaian, semaian dan produktif dalam profil tanaman.');
  }
  const tarikhSemai = row.mode === 'start' ? row.date : shift(row.date, -harvestDays - nurseryDays);
  const tarikhTanam = shift(tarikhSemai, nurseryDays);
  const tarikhTuaianDijangka = shift(tarikhTanam, harvestDays);
  const tarikhTamatDijangka = shift(tarikhTuaianDijangka, productiveDays);
  return { tarikhSemai, tarikhTanam, tarikhTuaianDijangka, tarikhTamatDijangka };
}

export function buildBasicSchedule({ crops, plots, plantings, rows, planName = '' }) {
  const errors = [];
  const items = [];
  if (!rows.length) errors.push('Tambah sekurang-kurangnya satu tanaman.');
  rows.forEach((row, index) => {
    const crop = crops.find(c => c.id === row.cropId);
    const prefix = `Baris ${index + 1}${crop ? ` (${crop.nama})` : ''}`;
    let dates;
    try { dates = basicDates(crop, row); }
    catch (error) { errors.push(`${prefix}: ${error.message}`); return; }
    const plotIds = [...new Set(row.plotIds || [])];
    if (!plotIds.length) { errors.push(`${prefix}: pilih sekurang-kurangnya satu petak.`); return; }
    plotIds.forEach(plotId => {
      const plot = plots.find(p => p.id === plotId);
      if (!plot) { errors.push(`${prefix}: petak yang dipilih tidak lagi tersedia.`); return; }
      items.push({ ...dates, cropId: crop.id, plotId, planJenis: 'biasa', namaPelan: planName.trim() || 'Jadual Biasa', caraTarikh: row.mode, kitaran: 1, rekod: {} });
    });
  });
  // A mixed plan must save completely, never just its valid rows.
  return { items: errors.length ? [] : items, errors, warnings: errors.length ? [] : findScheduleOverlaps({ items, plantings, crops, plots }) };
}
