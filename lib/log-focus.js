// Terjemahan isyarat "buka log" dari pelbagai paparan kepada tapisan dan skop
// Log Operasi. Dipisahkan dari app/ladang-alir.jsx supaya boleh diuji dengan
// `node --test lib/*.test.js` tanpa perlu memasang React.
//
// Bentuk isyarat yang diterima:
//   { id }                                buka borang log satu penanaman
//   { filter }                            tapisan tetap (contoh 'semua' dari pita lewat)
//   { plotId | cropId | batchId, label }   skopkan senarai kepada kumpulan itu

export const LOG_FILTERS = ['aktif', 'dituai', 'semua'];

export function focusTargetId(focus) {
  return focus?.id || null;
}

// Penanaman yang sudah dituai tidak muncul dalam tapisan 'aktif', jadi borangnya
// perlu senarai 'semua' supaya baris sasarannya benar-benar ada.
export function resolveLogFilter(focus, targetStatus = null) {
  if (focus?.filter && LOG_FILTERS.includes(focus.filter)) return focus.filter;
  return targetStatus === 'dituai' ? 'semua' : 'aktif';
}

export function logScope(focus) {
  return {
    plotId: focus?.plotId || null,
    cropId: focus?.cropId || null,
    batchId: focus?.batchId || null,
    label: focus?.label || '',
  };
}

export function hasLogScope(scope) {
  return Boolean(scope && (scope.plotId || scope.cropId || scope.batchId));
}

export function inLogScope(planting, scope) {
  if (!hasLogScope(scope)) return true;
  if (scope.plotId && planting?.plotId !== scope.plotId) return false;
  if (scope.cropId && planting?.cropId !== scope.cropId) return false;
  if (scope.batchId && planting?.batchId !== scope.batchId) return false;
  return true;
}
