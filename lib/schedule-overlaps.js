function plantingEnd(item, crops) {
  if (item.rekod?.tarikhTuaianSebenar) return item.rekod.tarikhTuaianSebenar;
  if (item.tarikhTamatDijangka) return item.tarikhTamatDijangka;
  const crop = crops.find(c => c.id === item.cropId);
  const extra = crop?.jenisTuaian === 'berkali' ? Number(crop.tempohProduktif || 0) : 0;
  return new Date(Date.parse(item.tarikhTuaianDijangka + 'T00:00:00Z') + extra * 86400000).toISOString().slice(0, 10);
}
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function findScheduleOverlaps({ items, plantings, crops, plots, today = localToday() }) {
  const warnings = [];
  const cropNames = Object.fromEntries(crops.map(c => [c.id, c.nama]));
  const plotNames = Object.fromEntries(plots.map(p => [p.id, p.nama]));
  items.forEach((item, index) => {
    const compare = [
      ...plantings.map((other, i) => ({ other, reference: other.id || `stored-${i}`, source: 'disimpan' })),
      ...items.slice(0, index).map((other, i) => ({ other, reference: `row-${i}`, source: 'baharu' })),
    ];
    compare.forEach(({ other, reference, source }) => {
      if (other.plotId !== item.plotId) return;
      const end = plantingEnd(item, crops);
      const expectedEnd = plantingEnd(other, crops);
      const unfinished = source === 'disimpan' && !other.rekod?.tarikhTuaianSebenar && other.tarikhTanam <= today && expectedEnd < today;
      const otherEnd = unfinished ? '9999-12-31' : expectedEnd;
      if (item.tarikhTanam > otherEnd || other.tarikhTanam > end) return;
      warnings.push({
        key: `${index}:${source}:${reference}`, plotId: item.plotId,
        plotName: plotNames[item.plotId] || 'Petak dipadam',
        cropName: cropNames[item.cropId] || 'Tanaman dipadam',
        otherCropName: cropNames[other.cropId] || 'Tanaman dipadam', source,
        ...(unfinished ? { unfinished: true, expectedEnd } : {}),
        start: item.tarikhTanam > other.tarikhTanam ? item.tarikhTanam : other.tarikhTanam,
        end: end < otherEnd ? end : otherEnd,
        dates: [item.tarikhTanam, end, other.tarikhTanam, otherEnd],
      });
    });
  });
  return warnings;
}

// Confirmation applies only to the exact overlaps the user reviewed.
export function canSaveSchedule(result, reviewedWarnings, confirmed) {
  if (!result || result.errors?.length || !result.items?.length) return false;
  const warnings = result.warnings || [];
  return !warnings.length || (confirmed === true && JSON.stringify(warnings) === JSON.stringify(reviewedWarnings));
}

export function layoutTimelineLanes(items) {
  const laneEnds = [];
  const entries = [...items].sort((a, b) => a.tarikhTanam.localeCompare(b.tarikhTanam)).map(item => {
    let lane = laneEnds.findIndex(end => end < item.tarikhTanam);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.tarikhTamatDijangka || item.tarikhTuaianDijangka;
    return { item, lane };
  });
  return { entries, laneCount: laneEnds.length };
}
