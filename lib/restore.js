import { validateFarm, validateRecordValues, normalizeFarm, STORE_KEY, LEGACY_KEYS } from './farm-store.js';

// Reads a downloaded backup back into the app. Four shapes exist in the wild:
// the cloud export, the browser recovery map, the pre-document legacy keys, and a
// bare farm document. All of them must round-trip through validateFarm before use.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFarm = value => object(value) && Array.isArray(value.crops) && Array.isArray(value.plots) && Array.isArray(value.plantings);
const parse = (raw, message) => { try { return JSON.parse(raw); } catch { throw new Error(message); } };

function extract(value) {
  if (object(value) && isFarm(value.data)) return { data: value.data, source: 'dokumen kebun' };
  if (object(value) && typeof value[STORE_KEY] === 'string') {
    const inner = parse(value[STORE_KEY], 'Sandaran pelayar itu rosak dan tidak dapat dibaca.');
    if (object(inner) && isFarm(inner.data)) return { data: inner.data, source: 'sandaran pelayar' };
    if (isFarm(inner)) return { data: inner, source: 'sandaran pelayar' };
    throw new Error('Sandaran pelayar itu tidak mengandungi data kebun.');
  }
  if (isFarm(value)) return { data: value, source: 'fail data kebun' };
  if (object(value) && LEGACY_KEYS.some(key => typeof value[key] === 'string')) {
    const parts = LEGACY_KEYS.map(key => {
      if (value[key] === null || value[key] === undefined) return null;
      if (typeof value[key] !== 'string') throw new Error('Rekod lama dalam fail itu tidak sah.');
      return parse(value[key], 'Rekod lama dalam fail itu rosak.');
    });
    if (!parts[0] || !parts[1]) throw new Error('Rekod lama dalam fail itu tidak lengkap.');
    return { data: { crops: parts[0], plots: parts[1], plantings: parts[2] || [] }, source: 'rekod lama' };
  }
  return null;
}

export function restoreCounts(data) {
  return {
    crops: data.crops.length,
    plots: data.plots.length,
    plantings: data.plantings.length,
    logged: data.plantings.filter(p => p.rekod && Object.keys(p.rekod).length).length,
  };
}

export function parseRestoreFile(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Fail itu kosong.');
  const found = extract(parse(text, 'Fail itu bukan JSON yang sah.'));
  if (!found) throw new Error('Fail itu tidak mengandungi data kebun Ladang Alir.');
  let data;
  try { data = normalizeFarm(validateFarm(found.data)); }
  catch (error) { throw new Error(`Data dalam fail tidak sah: ${error.message}`); }
  data.plantings = data.plantings.map(p => ({ ...p, rekod: p.rekod || {} }));
  // Records saved before these value rules existed must not block a migration back in. They are
  // reported so they can be corrected from the Log tab, which does enforce the rules.
  const flagged = [];
  for (const [index, planting] of data.plantings.entries()) {
    try { validateRecordValues([planting]); }
    catch (error) { flagged.push(`Rekod #${index + 1}: ${label(data, planting)} (${error.message})`); }
  }
  return { data, counts: restoreCounts(data), source: found.source, flagged };
}

function label(data, planting) {
  const crop = data.crops.find(c => c.id === planting.cropId)?.nama || 'tanaman';
  const plot = data.plots.find(p => p.id === planting.plotId)?.nama || 'petak';
  return `${crop} di ${plot}, tanam ${planting.tarikhTanam}`;
}
