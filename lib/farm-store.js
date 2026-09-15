import { stableStringify } from './stable-json.js';
// One atomic document, guarded across tabs. Legacy keys are retained for recovery.
export const STORE_KEY = 'ladang-alir:farm-state-v1';
export const LEGACY_KEYS = ['farm-crops', 'farm-plots', 'farm-plantings'].map(k => 'ladang-alir:' + k);
const LOCK = 'ladang-alir:farm-write';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const id = value => text(value) && !Object.prototype.hasOwnProperty.call(Object.prototype, value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const cropNumbers = ['tempohTuaian', 'kadarBenihSepetak', 'kosBenihSeunit', 'kadarBajaSepetak', 'kosBajaSeunit', 'kadarAirSepetakHari', 'anggaranHasilSepetak', 'hargaJualSeunit'];
const rekodNumbers = ['benihDigunakan', 'bajaDigunakan', 'airDigunakan', 'kosSebenar', 'hasilSebenar', 'hargaJualSebenar'];
export function validateFarm(data) {
  if (!object(data)) throw new Error('Struktur simpanan tidak sah.');
  for (const key of ['crops', 'plots', 'plantings']) {
    if (!Array.isArray(data[key]) || data[key].some(v => !object(v) || !id(v.id)) || new Set(data[key].map(v => v.id)).size !== data[key].length) throw new Error(`Struktur ${key} tidak sah.`);
  }
  for (const c of data.crops) {
    if (!text(c.nama) || (c.jenisBaja != null && typeof c.jenisBaja !== 'string') || !cropNumbers.every(k => finite(c[k])) || !Number.isSafeInteger(c.tempohTuaian) || c.tempohTuaian < 1 ||
        !['terus', 'pindah'].includes(c.kaedahTanam ?? 'terus') || !['sekali', 'berkali'].includes(c.jenisTuaian ?? 'sekali') ||
        ['tempohSemaian', 'tempohProduktif'].some(k => c[k] != null && (!Number.isSafeInteger(c[k]) || c[k] < 0))) throw new Error('Profil tanaman tidak sah.');
  }
  if (data.plots.some(p => !text(p.nama))) throw new Error('Nama petak tidak sah.');
  for (const p of data.plantings) {
    if (!id(p.plotId) || !id(p.cropId) || !date(p.tarikhTanam) || !date(p.tarikhTuaianDijangka) || p.tarikhTuaianDijangka < p.tarikhTanam ||
        ['tarikhSemai', 'tarikhTamatDijangka', 'tarikhSasaran'].some(k => p[k] != null && !date(p[k])) ||
        (p.tarikhTamatDijangka && p.tarikhTamatDijangka < p.tarikhTuaianDijangka) ||
        ['namaPelan', 'planJenis', 'caraTarikh'].some(k => p[k] != null && typeof p[k] !== 'string') ||
        (p.batchId != null && !id(p.batchId)) || (p.kitaran != null && !Number.isSafeInteger(p.kitaran)) ||
        (p.tetingkapHari != null && (!Number.isSafeInteger(p.tetingkapHari) || p.tetingkapHari < 0)) || (p.rekod != null && !object(p.rekod))) throw new Error('Jadual penanaman tidak sah.');
    const r = p.rekod || {};
    if ((r.tarikhTuaianSebenar && !date(r.tarikhTuaianSebenar)) ||
        rekodNumbers.some(k => r[k] != null && !finite(r[k])) ||
        (r.catatan != null && typeof r.catatan !== 'string')) throw new Error('Rekod operasi tidak sah.');
  }
  return data;
}
// Value rules for records that are being written. Loading stays permissive on purpose: a
// record saved before these rules existed must never lock the app out of its own data.
export function validateRecordValues(plantings) {
  for (const p of plantings) {
    const r = p.rekod || {};
    // A harvest logged before the planting date would skew every report and the plot history.
    if (r.tarikhTuaianSebenar && r.tarikhTuaianSebenar < p.tarikhTanam) throw new Error('Tarikh tuaian sebenar tidak boleh sebelum tarikh tanam.');
    if (rekodNumbers.some(k => r[k] != null && r[k] < 0)) throw new Error('Nilai rekod tidak boleh negatif.');
  }
  return plantings;
}
// Only new or edited plantings are checked, so an untouched old record can never block a save.
export function changedPlantings(before, after) {
  const previous = new Map(before.map(p => [p.id, stableStringify(p)]));
  return after.filter(p => previous.get(p.id) !== stableStringify(p));
}
export const normalizeFarm = data => ({ ...data, crops: data.crops.map(c => ({ kaedahTanam: 'terus', tempohSemaian: 0, jenisTuaian: 'sekali', tempohProduktif: 0, ...c })) });
export function assertUnchanged(current, expected) {
  if (stableStringify(current) !== stableStringify(expected)) throw new Error('Data ini telah berubah di tab atau peranti lain. Tutup dan buka semula borang untuk semak data terkini sebelum mencuba lagi.');
}
export function createFarmStore({ storage, locks, defaults }) {
  function legacyRaw() { return LEGACY_KEYS.map(key => storage.getItem(key)); }
  function read() {
    let raw;
    try { raw = storage.getItem(STORE_KEY); }
    catch { throw new Error('Simpanan pelayar tidak dapat dibaca. Benarkan akses simpanan dan cuba lagi.'); }
    try {
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !Number.isSafeInteger(saved.revision) || saved.revision < 1 || !Array.isArray(saved.legacy)) throw new Error('Versi simpanan tidak dikenali.');
        validateFarm(saved.data);
        if (JSON.stringify(saved.legacy) !== JSON.stringify(legacyRaw())) throw new Error('Tab versi lama telah mengubah data. Tutup tab lama dan muat turun salinan pemulihan untuk menggabungkan perubahan dengan selamat.');
        return { ...saved, data: normalizeFarm(saved.data) };
      }
      const legacy = legacyRaw();
      const fallback = defaults();
      const data = Object.fromEntries(['crops', 'plots', 'plantings'].map((key, i) => [key, legacy[i] === null ? fallback[key] : JSON.parse(legacy[i])]));
      return { version: 1, revision: 0, legacy, data: normalizeFarm(validateFarm(data)) };
    } catch (error) {
      throw new Error(`Data tidak dapat dibuka: ${error.message} Data asal dikekalkan; tiada data kosong ditulis.`, { cause: error });
    }
  }
  async function transact(change, options = {}) {
    if (!locks?.request) throw new Error('Pelayar ini tidak menyokong simpanan selamat antara tab. Gunakan pelayar terkini untuk menyimpan.');
    return locks.request(LOCK, () => {
      const saved = read();
      const data = change(structuredClone(saved.data));
      validateFarm(data);
      // Import and restore move existing data in, so old records are grandfathered; only
      // records written through the live edit paths must satisfy the value rules.
      if (options.kind !== 'import' && options.kind !== 'restore') validateRecordValues(changedPlantings(saved.data.plantings, data.plantings));
      const next = { ...saved, revision: saved.revision + 1, data };
      // setItem is atomic: quota/access failures leave the last document intact.
      try { storage.setItem(STORE_KEY, JSON.stringify(next)); }
      catch { throw new Error('Belum disimpan. Ruang pelayar penuh atau akses simpanan disekat. Borang dikekalkan; cuba lagi selepas membaiki simpanan.'); }
      return next;
    });
  }
  async function initialize() {
    const saved = read();
    return saved.revision || !locks?.request ? saved : transact(data => data);
  }
  function recovery() { return Object.fromEntries([STORE_KEY, ...LEGACY_KEYS].map(k => [k, storage.getItem(k)])); }
  return { read, transact, initialize, recovery };
}
