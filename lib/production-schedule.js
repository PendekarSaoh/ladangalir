import { basicDates } from './basic-schedule.js';
import { findScheduleOverlaps } from './schedule-overlaps.js';

export function buildProductionSchedule({ crops, plots, plantings, rows, targetDate, windowDays, planName }) {
  const items = [];
  const summaries = [];
  const errors = [];
  const window = Number(windowDays);
  if (!planName?.trim()) errors.push('Isi nama pelan.');
  if (!Number.isInteger(window) || window < 0 || window > 14) errors.push('Tetingkap tuaian mesti antara 0 hingga 14 hari.');
  if (!rows.length) errors.push('Tambah sekurang-kurangnya satu tanaman.');
  if (errors.length) return { items, summaries, errors, warnings: [] };

  rows.forEach((row, rowIndex) => {
    const crop = crops.find(c => c.id === row.cropId);
    const prefix = `Baris ${rowIndex + 1}${crop ? ` (${crop.nama})` : ''}`;
    const errorCount = errors.length;
    let dates;
    try {
      dates = basicDates(crop, { mode: 'harvest', date: targetDate });
      if (crop.jenisTuaian !== 'berkali') {
        const end = new Date(targetDate + 'T00:00:00Z');
        end.setUTCDate(end.getUTCDate() + window);
        dates.tarikhTamatDijangka = end.toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dates.tarikhTamatDijangka)) throw new Error('Tarikh di luar julat yang disokong.');
      }
    } catch (error) { errors.push(`${prefix}: ${error.message}`); return; }
    const selectedPlotIds = [...new Set(row.plotIds || [])];
    if (!selectedPlotIds.length) errors.push(`${prefix}: pilih sekurang-kurangnya satu petak.`);
    const selectedPlots = [];
    selectedPlotIds.forEach(plotId => {
      const plot = plots.find(p => p.id === plotId);
      if (!plot) { errors.push(`${prefix}: petak yang dipilih tidak lagi tersedia.`); return; }
      selectedPlots.push(plot);
      items.push({
        ...dates, cropId: crop.id, plotId, kitaran: 1,
        planJenis: 'pengeluaran', namaPelan: planName.trim(), tarikhSasaran: targetDate,
        tetingkapHari: window, rekod: {},
      });
    });
    summaries.push({ crop, selectedPlots, plotsNeeded: selectedPlotIds.length, fieldDate: dates.tarikhTanam, sowDate: dates.tarikhSemai, releaseDate: dates.tarikhTamatDijangka, conflict: errors.length > errorCount });
  });
  return { items: errors.length ? [] : items, summaries, errors, warnings: errors.length ? [] : findScheduleOverlaps({ items, plantings, crops, plots }) };
}
