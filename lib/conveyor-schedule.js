import { basicDates } from './basic-schedule.js';
const shift = (date, days) => {
  const value = new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tarikh di luar julat yang disokong.');
  return value;
};
export function buildConveyorSchedule({ crop, plotIds, startDate, interval, rest, horizon }) {
  const items = [];
  try {
    // Validate the date and crop before any iteration; the selected date is field planting.
    basicDates(crop, { mode: 'start', date: startDate });
    if (!Number.isSafeInteger(interval) || interval < 1 || !Number.isSafeInteger(rest) || rest < 0 || !Number.isSafeInteger(horizon) || horizon < 1 || horizon > 180) throw new Error('Semak jarak tanam, tempoh rehat dan tempoh perancangan (1–180 hari).');
    if (!Array.isArray(plotIds) || !plotIds.length) throw new Error('Pilih sekurang-kurangnya satu petak.');
    const endDate = shift(startDate, horizon);
    if (endDate.length !== 10) throw new Error('Tarikh di luar julat yang disokong.');
    [...new Set(plotIds)].forEach((plotId, index) => {
      let fieldDate = shift(startDate, index * interval);
      let cycle = 1;
      while (fieldDate < endDate) {
        const nurseryDays = crop.kaedahTanam === 'pindah' ? Number(crop.tempohSemaian || 0) : 0;
        const dates = basicDates(crop, { mode: 'start', date: shift(fieldDate, -nurseryDays) });
        items.push({ ...dates, plotId, cropId: crop.id, kitaran: cycle++, rekod: {} });
        fieldDate = shift(dates.tarikhTamatDijangka, rest);
      }
    });
    return { items, errors: [] };
  } catch (error) { return { items: [], errors: [error.message] }; }
}
