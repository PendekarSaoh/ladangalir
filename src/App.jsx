import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Sprout, LayoutGrid, Repeat, ClipboardList, BarChart3,
  Plus, Pencil, Trash2, X, Check, Droplets, Wheat, AlertTriangle,
  Wallet, TrendingUp, Leaf, Package, Loader2,
} from 'lucide-react';

/* ============================================================ */
/* Date helpers (UTC-safe, ISO yyyy-mm-dd strings throughout)   */
/* ============================================================ */
function makeUTCDate(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return makeUTCDate(y, m, d); }
function isoOf(date) { return date.toISOString().slice(0, 10); }
function addDays(s, n) { const d = parseISO(s); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); }
function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function todayISO() { const t = new Date(); return isoOf(makeUTCDate(t.getFullYear(), t.getMonth() + 1, t.getDate())); }
const MONTHS_MY = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
function formatDateMY(s) { if (!s) return '-'; const d = parseISO(s); return `${d.getUTCDate()} ${MONTHS_MY[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
function formatShortMY(s) { const d = parseISO(s); return `${d.getUTCDate()} ${MONTHS_MY[d.getUTCMonth()]}`; }

/* ============================================================ */
/* ID + storage helpers                                         */
/* ============================================================ */
let uidCounter = 0;
function uid(prefix = 'id') { uidCounter += 1; return `${prefix}_${Date.now().toString(36)}_${uidCounter}`; }

function safeGet(key) {
  try { return localStorage.getItem(key); }
  catch (e) { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { console.error('Gagal simpan', key, e); return false; }
}

/* ============================================================ */
/* Default data                                                  */
/* ============================================================ */
const DEFAULT_CROPS = [
  { id: 'crop_kangkung', nama: 'Kangkung', tempohTuaian: 25, kadarBenihSepetak: 0.05, kosBenihSeunit: 18, jenisBaja: 'NPK 15:15:15', kadarBajaSepetak: 0.4, kosBajaSeunit: 4, kadarAirSepetakHari: 12, anggaranHasilSepetak: 6, hargaJualSeunit: 3.5 },
  { id: 'crop_bayam', nama: 'Bayam', tempohTuaian: 21, kadarBenihSepetak: 0.03, kosBenihSeunit: 22, jenisBaja: 'NPK 15:15:15', kadarBajaSepetak: 0.3, kosBajaSeunit: 4, kadarAirSepetakHari: 10, anggaranHasilSepetak: 4, hargaJualSeunit: 4 },
  { id: 'crop_sawi', nama: 'Sawi', tempohTuaian: 30, kadarBenihSepetak: 0.04, kosBenihSeunit: 20, jenisBaja: 'NPK 15:15:15', kadarBajaSepetak: 0.5, kosBajaSeunit: 4, kadarAirSepetakHari: 12, anggaranHasilSepetak: 7, hargaJualSeunit: 3 },
  { id: 'crop_bendi', nama: 'Bendi (Okra)', tempohTuaian: 55, kadarBenihSepetak: 0.06, kosBenihSeunit: 15, jenisBaja: 'NPK 15:15:15', kadarBajaSepetak: 0.6, kosBajaSeunit: 4, kadarAirSepetakHari: 14, anggaranHasilSepetak: 10, hargaJualSeunit: 5 },
  { id: 'crop_timun', nama: 'Timun', tempohTuaian: 45, kadarBenihSepetak: 0.025, kosBenihSeunit: 30, jenisBaja: 'NPK 12:12:17', kadarBajaSepetak: 0.7, kosBajaSeunit: 5, kadarAirSepetakHari: 18, anggaranHasilSepetak: 15, hargaJualSeunit: 2.5 },
  { id: 'crop_terung', nama: 'Terung', tempohTuaian: 70, kadarBenihSepetak: 0.02, kosBenihSeunit: 35, jenisBaja: 'NPK 12:12:17', kadarBajaSepetak: 0.8, kosBajaSeunit: 5, kadarAirSepetakHari: 16, anggaranHasilSepetak: 12, hargaJualSeunit: 4 },
  { id: 'crop_cili', nama: 'Cili', tempohTuaian: 90, kadarBenihSepetak: 0.015, kosBenihSeunit: 50, jenisBaja: 'NPK 12:12:17', kadarBajaSepetak: 1.0, kosBajaSeunit: 5, kadarAirSepetakHari: 14, anggaranHasilSepetak: 8, hargaJualSeunit: 12 },
  { id: 'crop_kacang', nama: 'Kacang Panjang', tempohTuaian: 50, kadarBenihSepetak: 0.035, kosBenihSeunit: 18, jenisBaja: 'NPK 15:15:15', kadarBajaSepetak: 0.6, kosBajaSeunit: 4, kadarAirSepetakHari: 15, anggaranHasilSepetak: 9, hargaJualSeunit: 4.5 },
  { id: 'crop_jagung', nama: 'Jagung Manis', tempohTuaian: 75, kadarBenihSepetak: 0.08, kosBenihSeunit: 12, jenisBaja: 'NPK 15:15:15', kadarBajaSepetak: 0.9, kosBajaSeunit: 4, kadarAirSepetakHari: 20, anggaranHasilSepetak: 14, hargaJualSeunit: 3 },
  { id: 'crop_lobak', nama: 'Lobak Merah', tempohTuaian: 70, kadarBenihSepetak: 0.03, kosBenihSeunit: 25, jenisBaja: 'NPK 12:12:17', kadarBajaSepetak: 0.5, kosBajaSeunit: 5, kadarAirSepetakHari: 12, anggaranHasilSepetak: 10, hargaJualSeunit: 3.5 },
];

function generateDefaultPlots(count) {
  return Array.from({ length: count }, (_, i) => ({ id: uid('plot'), nama: `Petak ${i + 1}` }));
}

const STATUS_META = {
  dirancang: { label: 'Dirancang', color: '#8DA0B5' },
  sedang_tumbuh: { label: 'Sedang Tumbuh', color: '#8FBC5A' },
  sedia_tuai: { label: 'Sedia Dituai', color: '#E0A845' },
  lewat: { label: 'Lewat Dituai', color: '#C1623D' },
  dituai: { label: 'Sudah Dituai', color: '#6B7460' },
};
const PLOT_STATUS_META = {
  kosong: { label: 'Kosong', color: '#5C6555' },
  akan_ditanam: { label: 'Akan Ditanam', color: '#8DA0B5' },
  aktif: { label: 'Aktif', color: '#8FBC5A' },
};

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getPlantingStatus(planting, today) {
  if (planting.rekod && planting.rekod.tarikhTuaianSebenar) return 'dituai';
  if (today < planting.tarikhTanam) return 'dirancang';
  if (today >= planting.tarikhTanam && today < planting.tarikhTuaianDijangka) return 'sedang_tumbuh';
  const overdue = diffDays(planting.tarikhTuaianDijangka, today);
  if (overdue >= 0 && overdue <= 3) return 'sedia_tuai';
  return 'lewat';
}

function getPlotInfo(plotId, plantings, today) {
  const relevant = plantings.filter(p => p.plotId === plotId);
  const active = relevant.find(p => p.tarikhTanam <= today && !(p.rekod && p.rekod.tarikhTuaianSebenar));
  if (active) return { status: 'aktif', planting: active };
  const upcoming = relevant
    .filter(p => p.tarikhTanam > today && !(p.rekod && p.rekod.tarikhTuaianSebenar))
    .sort((a, b) => (a.tarikhTanam < b.tarikhTanam ? -1 : 1))[0];
  if (upcoming) return { status: 'akan_ditanam', planting: upcoming };
  return { status: 'kosong', planting: null };
}

function buildConveyorSchedule({ crop, plotIds, startDate, interval, rest, musim, existingPlantings = [] }) {
  const batchId = uid('batch');
  const items = [];
  let emptyIdx = 0;

  plotIds.forEach((plotId) => {
    // Find the latest scheduled harvest for this plot (excluding already harvested)
    const existing = existingPlantings.filter(p =>
      p.plotId === plotId && !(p.rekod && p.rekod.tarikhTuaianSebenar)
    );

    let firstPlantDate;
    if (existing.length > 0) {
      // Active/scheduled plot — start right after last expected harvest + rest
      const lastHarvest = existing.reduce((max, p) =>
        p.tarikhTuaianDijangka > max ? p.tarikhTuaianDijangka : max,
        existing[0].tarikhTuaianDijangka
      );
      firstPlantDate = addDays(lastHarvest, rest);
    } else {
      // Empty plot — stagger using interval
      firstPlantDate = addDays(startDate, emptyIdx * interval);
      emptyIdx++;
    }

    let plantDate = firstPlantDate;
    for (let cycle = 1; cycle <= musim; cycle++) {
      const harvestDate = addDays(plantDate, crop.tempohTuaian);
      items.push({
        id: uid('plant'),
        plotId,
        cropId: crop.id,
        tarikhTanam: plantDate,
        tarikhTuaianDijangka: harvestDate,
        kitaran: cycle,
        batchId,
        rekod: {},
      });
      plantDate = addDays(harvestDate, rest);
    }
  });
  return { batchId, items };
}

/* ============================================================ */
/* Theme tokens                                                  */
/* ============================================================ */
const ROOT_VARS = {
  '--bg': '#1C2118',
  '--surface': '#262C20',
  '--border': '#3A4030',
  '--text-primary': '#EDE8DB',
  '--text-secondary': '#A3AA91',
  '--accent-sprout': '#8FBC5A',
  '--accent-harvest': '#E0A845',
  '--accent-clay': '#C1623D',
  '--accent-water': '#5B9AA0',
};


const inputClass = 'rounded-lg px-3 py-2 text-sm outline-none w-full';
const inputStyle = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

/* ============================================================ */
/* UI primitives                                                 */
/* ============================================================ */
function Badge({ color, children }) {
  return (
    <span
      style={{ background: hexToRgba(color, 0.16), color, border: `1px solid ${hexToRgba(color, 0.4)}` }}
      className="inline-flex items-center gap-1 rounded-full font-medium text-xs px-2 py-0.5"
    >
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <Icon size={16} style={{ color: accent || 'var(--text-secondary)' }} />
      </div>
      <div className="font-display text-2xl" style={{ color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

function PrimaryButton({ children, onClick, type = 'button', disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50"
      style={{ background: 'var(--accent-sprout)', color: '#1C2118' }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, type = 'button', size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium ${pad}`}
      style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
    >
      {children}
    </button>
  );
}

function ConfirmIconButton({ onConfirm, icon: Icon, title, color }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);
  if (confirming) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onConfirm(); setConfirming(false); }}
        className="px-2 py-1 rounded text-xs font-medium"
        style={{ background: hexToRgba('#C1623D', 0.18), color: '#C1623D', border: '1px solid #C1623D' }}
      >
        Pasti?
      </button>
    );
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
      title={title}
      className="p-1.5 rounded-lg hover:opacity-70"
      style={{ color: color || 'var(--text-secondary)' }}
    >
      <Icon size={14} />
    </button>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,12,8,0.65)' }} onClick={onClose}>
      <div
        className={`rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto`}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      {children}
      {hint && <span className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.8 }}>{hint}</span>}
    </label>
  );
}

/* ============================================================ */
/* Conveyor timeline — the signature visual                      */
/* ============================================================ */
function ConveyorTimeline({ plots, plantings, crops, rangeStart, rangeDays = 90 }) {
  const today = todayISO();
  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);
  const rangeEnd = addDays(rangeStart, rangeDays);

  const rows = useMemo(() => {
    return plots
      .map(plot => ({
        plot,
        items: plantings.filter(p => p.plotId === plot.id && p.tarikhTanam < rangeEnd && p.tarikhTuaianDijangka > rangeStart),
      }))
      .filter(r => r.items.length > 0)
      .sort((a, b) => a.plot.nama.localeCompare(b.plot.nama, 'ms', { numeric: true }));
  }, [plots, plantings, rangeStart, rangeEnd]);

  const labelWidth = 132;
  const trackWidth = Math.max(rangeDays * 8, 700);
  const pxPerDay = trackWidth / rangeDays;
  const todayOffsetPx = Math.min(Math.max(diffDays(rangeStart, today), 0), rangeDays) * pxPerDay;

  const weekMarks = [];
  for (let d = 0; d <= rangeDays; d += 14) weekMarks.push(d);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
        <Leaf size={26} style={{ color: 'var(--accent-sprout)', margin: '0 auto 10px' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Belum ada jadual conveyor untuk tempoh ini. Jana jadual baharu untuk mula.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="overflow-x-auto">
        <div style={{ width: labelWidth + trackWidth }}>
          <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: labelWidth, flexShrink: 0, background: 'var(--surface)' }} className="sticky left-0 z-20 px-3 py-2">
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Petak</span>
            </div>
            <div style={{ width: trackWidth, position: 'relative', height: 30 }}>
              {weekMarks.map(d => (
                <div key={d} style={{ position: 'absolute', left: d * pxPerDay, top: 0, bottom: 0, borderLeft: '1px solid var(--border)', paddingLeft: 4 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{formatShortMY(addDays(rangeStart, d))}</span>
                </div>
              ))}
              <div style={{ position: 'absolute', left: todayOffsetPx, top: 0, bottom: 0, width: 2, background: 'var(--accent-clay)' }} />
            </div>
          </div>

          {rows.map(({ plot, items }) => (
            <div key={plot.id} className="flex items-center" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: labelWidth, flexShrink: 0, background: 'var(--surface)' }} className="sticky left-0 z-10 px-3 py-3">
                <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500 }}>{plot.nama}</span>
              </div>
              <div style={{ width: trackWidth, position: 'relative', height: 44 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'repeating-linear-gradient(90deg, var(--border) 0px, var(--border) 6px, transparent 6px, transparent 12px)' }} />
                <div style={{ position: 'absolute', left: todayOffsetPx, top: 0, bottom: 0, width: 1, background: hexToRgba('#C1623D', 0.5) }} />
                {items.map(p => {
                  const crop = cropMap[p.cropId];
                  const status = getPlantingStatus(p, today);
                  const meta = STATUS_META[status];
                  const startOffset = Math.max(diffDays(rangeStart, p.tarikhTanam), 0);
                  const endOffset = Math.min(diffDays(rangeStart, p.tarikhTuaianDijangka), rangeDays);
                  const left = startOffset * pxPerDay;
                  const width = Math.max((endOffset - startOffset) * pxPerDay, 6);
                  return (
                    <div
                      key={p.id}
                      title={`${crop ? crop.nama : '?'} - ${formatDateMY(p.tarikhTanam)} hingga ${formatDateMY(p.tarikhTuaianDijangka)}`}
                      style={{ position: 'absolute', left, width, top: 9, height: 26, background: hexToRgba(meta.color, 0.22), border: `1px solid ${meta.color}`, borderRadius: 999 }}
                      className="flex items-center px-2 overflow-hidden"
                    >
                      <span style={{ color: meta.color, fontSize: '10px', fontWeight: 500 }} className="truncate">
                        {crop ? crop.nama : '?'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: 999, background: meta.color, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{meta.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
/* Tanaman (crops)                                                */
/* ============================================================ */
function SeedCalculator({ onApply }) {
  const [kaedah, setKaedah] = useState('semai'); // 'semai' | 'pokok'
  const [panjang, setPanjang] = useState(5);
  const [lebar, setLebar] = useState(2);
  const [kadarSemai, setKadarSemai] = useState(12); // g/m²
  const [jarakBaris, setJarakBaris] = useState(30); // cm
  const [jarakPokok, setJarakPokok] = useState(30); // cm
  const [beratSebiji, setBeratSebiji] = useState(0.005); // kg per biji (0.5g default)
  const [lebihan, setLebihan] = useState(15); // %

  const luasM2 = +(panjang * lebar).toFixed(2);

  const result = useMemo(() => {
    if (kaedah === 'semai') {
      const kg = +(luasM2 * kadarSemai / 1000).toFixed(4);
      return { kg, info: `${luasM2} m² × ${kadarSemai} g/m² = ${(luasM2 * kadarSemai).toFixed(0)} g = ${kg} kg` };
    } else {
      const lubang = Math.floor((panjang * 100 / jarakBaris)) * Math.floor((lebar * 100 / jarakPokok));
      const dengan = Math.ceil(lubang * (1 + lebihan / 100));
      const kg = +(dengan * beratSebiji).toFixed(4);
      return { kg, lubang, dengan, info: `${lubang} lubang + ${lebihan}% lebihan = ${dengan} biji × ${beratSebiji * 1000}g = ${kg} kg` };
    }
  }, [kaedah, luasM2, kadarSemai, jarakBaris, jarakPokok, beratSebiji, lebihan, panjang, lebar]);

  return (
    <div className="rounded-xl p-3 flex flex-col gap-3" style={{ background: 'var(--bg)', border: '1px dashed var(--border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--accent-sprout)' }}>🌱 Kalkulator Benih</span>
        <div className="flex gap-1">
          {[['semai', 'Semai Terus'], ['pokok', 'Tanam Biji']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKaedah(k)}
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: kaedah === k ? 'var(--accent-sprout)' : 'transparent', color: kaedah === k ? '#1C2118' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Panjang Petak (m)">
          <input type="number" step="0.1" className={inputClass} style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }} value={panjang} onChange={e => setPanjang(+e.target.value || 0)} />
        </Field>
        <Field label="Lebar Petak (m)">
          <input type="number" step="0.1" className={inputClass} style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }} value={lebar} onChange={e => setLebar(+e.target.value || 0)} />
        </Field>

        {kaedah === 'semai' ? (
          <Field label="Kadar Semai (g/m²)" hint="Kangkung 10-15 • Bayam 5-8 • Sawi 3-5">
            <input type="number" step="0.5" className={inputClass} style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }} value={kadarSemai} onChange={e => setKadarSemai(+e.target.value || 0)} />
          </Field>
        ) : (
          <>
            <Field label="Jarak Baris (cm)">
              <input type="number" className={inputClass} style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }} value={jarakBaris} onChange={e => setJarakBaris(+e.target.value || 1)} />
            </Field>
            <Field label="Jarak Pokok (cm)">
              <input type="number" className={inputClass} style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }} value={jarakPokok} onChange={e => setJarakPokok(+e.target.value || 1)} />
            </Field>
            <Field label="Berat Sebiji Benih (g)">
              <input type="number" step="0.1" className={inputClass} style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }} value={+(beratSebiji * 1000).toFixed(2)} onChange={e => setBeratSebiji((+e.target.value || 0) / 1000)} />
            </Field>
            <Field label="Lebihan / Sandaran (%)">
              <input type="number" className={inputClass} style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }} value={lebihan} onChange={e => setLebihan(+e.target.value || 0)} />
            </Field>
          </>
        )}
      </div>

      <div className="rounded-lg px-3 py-2 flex items-center justify-between gap-2" style={{ background: 'var(--surface)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{result.info}</p>
          <p className="font-display text-lg mt-0.5" style={{ color: 'var(--accent-sprout)' }}>{result.kg} kg benih / petak</p>
        </div>
        <button type="button" onClick={() => onApply(result.kg)}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: hexToRgba('#8FBC5A', 0.18), color: 'var(--accent-sprout)', border: '1px solid var(--accent-sprout)' }}>
          <Check size={13} /> Guna Nilai Ini
        </button>
      </div>
    </div>
  );
}

function CropForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial || {
    nama: '', tempohTuaian: 30, kadarBenihSepetak: 0.05, kosBenihSeunit: 20,
    jenisBaja: 'NPK 15:15:15', kadarBajaSepetak: 0.5, kosBajaSeunit: 4,
    kadarAirSepetakHari: 12, anggaranHasilSepetak: 8, hargaJualSeunit: 4,
  });
  const [showCalc, setShowCalc] = useState(false);
  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }
  function submit() {
    if (!form.nama.trim()) return;
    onSave({ ...form, id: form.id || uid('crop') });
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nama Tanaman">
          <input className={inputClass} style={inputStyle} value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="cth: Kangkung" />
        </Field>
        <Field label="Tempoh Tuaian (hari)">
          <input type="number" className={inputClass} style={inputStyle} value={form.tempohTuaian} onChange={e => set('tempohTuaian', Number(e.target.value))} />
        </Field>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Kadar Benih / Petak (kg)</span>
            <button type="button" onClick={() => setShowCalc(s => !s)}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ color: 'var(--accent-sprout)', border: '1px solid var(--accent-sprout)', background: showCalc ? hexToRgba('#8FBC5A', 0.12) : 'transparent' }}>
              <Sprout size={11} /> {showCalc ? 'Tutup Kalkulator' : 'Kira dengan Kalkulator'}
            </button>
          </div>
          <input type="number" step="0.001" className={inputClass} style={inputStyle} value={form.kadarBenihSepetak} onChange={e => set('kadarBenihSepetak', Number(e.target.value))} />
          {showCalc && <SeedCalculator onApply={kg => { set('kadarBenihSepetak', kg); }} />}
        </div>

        <Field label="Kos Benih (RM/kg)">
          <input type="number" step="0.01" className={inputClass} style={inputStyle} value={form.kosBenihSeunit} onChange={e => set('kosBenihSeunit', Number(e.target.value))} />
        </Field>
        <Field label="Jenis Baja">
          <input className={inputClass} style={inputStyle} value={form.jenisBaja} onChange={e => set('jenisBaja', e.target.value)} />
        </Field>
        <Field label="Kadar Baja / Petak (kg)">
          <input type="number" step="0.01" className={inputClass} style={inputStyle} value={form.kadarBajaSepetak} onChange={e => set('kadarBajaSepetak', Number(e.target.value))} />
        </Field>
        <Field label="Kos Baja (RM/kg)">
          <input type="number" step="0.01" className={inputClass} style={inputStyle} value={form.kosBajaSeunit} onChange={e => set('kosBajaSeunit', Number(e.target.value))} />
        </Field>
        <Field label="Keperluan Air / Petak (liter/hari)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.kadarAirSepetakHari} onChange={e => set('kadarAirSepetakHari', Number(e.target.value))} />
        </Field>
        <Field label="Anggaran Hasil / Petak (kg)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.anggaranHasilSepetak} onChange={e => set('anggaranHasilSepetak', Number(e.target.value))} />
        </Field>
        <Field label="Harga Jual (RM/kg)">
          <input type="number" step="0.1" className={inputClass} style={inputStyle} value={form.hargaJualSeunit} onChange={e => set('hargaJualSeunit', Number(e.target.value))} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <SecondaryButton onClick={onCancel}>Batal</SecondaryButton>
        <PrimaryButton onClick={submit}><Check size={15} /> Simpan</PrimaryButton>
      </div>
    </div>
  );
}

function CropsView({ crops, plantings, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const usedCropIds = useMemo(() => new Set(plantings.map(p => p.cropId)), [plantings]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Tanaman</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Senarai induk tanaman beserta keperluan benih, baja, air dan anggaran hasil.</p>
        </div>
        <PrimaryButton onClick={() => setEditing('new')}><Plus size={15} /> Tambah Tanaman</PrimaryButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {crops.map(crop => (
          <div key={crop.id} className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-base" style={{ color: 'var(--text-primary)' }}>{crop.nama}</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Kitaran {crop.tempohTuaian} hari</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(crop)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-secondary)' }}><Pencil size={14} /></button>
                {usedCropIds.has(crop.id) ? (
                  <button disabled title="Tidak boleh dipadam, ada rekod tanaman" className="p-1.5 rounded-lg opacity-30 cursor-not-allowed" style={{ color: 'var(--accent-clay)' }}>
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <ConfirmIconButton onConfirm={() => onDelete(crop.id)} icon={Trash2} title="Padam tanaman" color="var(--accent-clay)" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1"><Package size={12} /> {crop.kadarBenihSepetak} kg benih</span>
              <span className="flex items-center gap-1"><Wheat size={12} /> {crop.kadarBajaSepetak} kg baja</span>
              <span className="flex items-center gap-1"><Droplets size={12} /> {crop.kadarAirSepetakHari} L/hari</span>
              <span className="flex items-center gap-1"><TrendingUp size={12} /> {crop.anggaranHasilSepetak} kg hasil</span>
            </div>
            <div className="text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
              Harga jual: <span style={{ color: 'var(--accent-harvest)' }}>RM {crop.hargaJualSeunit}/kg</span>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Tambah Tanaman' : `Edit ${editing.nama}`} onClose={() => setEditing(null)} wide>
          <CropForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSave={(data) => { onSave(data); setEditing(null); }} />
        </Modal>
      )}
    </div>
  );
}

/* ============================================================ */
/* Petak (plots)                                                  */
/* ============================================================ */
function PlotsView({ crops, plots, plantings, canDeletePlotIds, onAddPlots, onRenamePlot, onDeletePlot }) {
  const today = todayISO();
  const [addCount, setAddCount] = useState(5);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);
  const infoByPlot = useMemo(() => {
    const map = {};
    plots.forEach(plot => { map[plot.id] = getPlotInfo(plot.id, plantings, today); });
    return map;
  }, [plots, plantings, today]);

  const counts = useMemo(() => {
    let kosong = 0, aktif = 0, akan = 0;
    Object.values(infoByPlot).forEach(i => { if (i.status === 'kosong') kosong++; else if (i.status === 'aktif') aktif++; else akan++; });
    return { kosong, aktif, akan };
  }, [infoByPlot]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Petak</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{plots.length} petak • {counts.aktif} aktif • {counts.akan} akan ditanam • {counts.kosong} kosong</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" min="1" value={addCount} onChange={e => setAddCount(Number(e.target.value))} className={inputClass} style={{ ...inputStyle, width: 80 }} />
          <PrimaryButton onClick={() => onAddPlots(addCount)}><Plus size={15} /> Tambah Petak</PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {plots.map(plot => {
          const info = infoByPlot[plot.id];
          const meta = PLOT_STATUS_META[info.status];
          return (
            <div key={plot.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                {renamingId === plot.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => { onRenamePlot(plot.id, renameValue.trim() || plot.nama); setRenamingId(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className={inputClass}
                    style={{ ...inputStyle, padding: '2px 6px', fontSize: '13px' }}
                  />
                ) : (
                  <button onClick={() => { setRenamingId(plot.id); setRenameValue(plot.nama); }} className="text-sm font-medium text-left" style={{ color: 'var(--text-primary)' }}>
                    {plot.nama}
                  </button>
                )}
                {canDeletePlotIds.has(plot.id) ? (
                  <ConfirmIconButton onConfirm={() => onDeletePlot(plot.id)} icon={Trash2} title="Padam petak" color="var(--text-secondary)" />
                ) : (
                  <button disabled title="Petak ini ada rekod tanaman, tidak boleh dipadam" className="p-1.5 rounded-lg opacity-30 cursor-not-allowed" style={{ color: 'var(--text-secondary)' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <Badge color={meta.color}>{meta.label}</Badge>
              {info.planting && (
                <div className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {cropMap[info.planting.cropId]?.nama || '-'}
                  <br />
                  {info.status === 'aktif' ? `Tuai: ${formatShortMY(info.planting.tarikhTuaianDijangka)}` : `Tanam: ${formatShortMY(info.planting.tarikhTanam)}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* Jadual Conveyor                                                */
/* ============================================================ */
function ConveyorGeneratorForm({ crops, plots, plantings, onPreview }) {
  const today = todayISO();
  const [cropId, setCropId] = useState(crops[0]?.id || '');
  const [mode, setMode] = useState('auto');
  const [autoCount, setAutoCount] = useState(4);
  const [manualSelected, setManualSelected] = useState([]);
  const [startDate, setStartDate] = useState(today);
  const [interval, setIntervalDays] = useState(7);
  const [rest, setRest] = useState(3);
  const [musim, setMusim] = useState(3);
  const [formError, setFormError] = useState(null);

  const plotInfoMap = useMemo(() => {
    const m = {};
    plots.forEach(p => { m[p.id] = getPlotInfo(p.id, plantings, today); });
    return m;
  }, [plots, plantings, today]);

  // For each plot, calculate when new planting can start
  const plotNextStart = useMemo(() => {
    const m = {};
    plots.forEach(plot => {
      const existing = plantings.filter(p =>
        p.plotId === plot.id && !(p.rekod && p.rekod.tarikhTuaianSebenar)
      );
      if (existing.length > 0) {
        const lastHarvest = existing.reduce((max, p) =>
          p.tarikhTuaianDijangka > max ? p.tarikhTuaianDijangka : max,
          existing[0].tarikhTuaianDijangka
        );
        m[plot.id] = addDays(lastHarvest, Number(rest) || 0);
      } else {
        m[plot.id] = null; // empty — will use startDate + interval stagger
      }
    });
    return m;
  }, [plots, plantings, rest]);

  const emptyPlots = useMemo(() => plots.filter(p => !plotNextStart[p.id]), [plots, plotNextStart]);
  const activePlots = useMemo(() => plots.filter(p => !!plotNextStart[p.id]), [plots, plotNextStart]);

  const crop = useMemo(() => crops.find(c => c.id === cropId), [crops, cropId]);

  // For summary card
  const chosenIds = useMemo(() => {
    if (mode === 'auto') {
      const n = Math.max(1, Math.min(Number(autoCount) || 1, plots.length));
      // Prioritise empty plots first, then active
      return [...emptyPlots, ...activePlots].slice(0, n).map(p => p.id);
    }
    return manualSelected;
  }, [mode, autoCount, emptyPlots, activePlots, manualSelected, plots.length]);

  const chosenEmpty = chosenIds.filter(id => !plotNextStart[id]).length;
  const chosenActive = chosenIds.filter(id => !!plotNextStart[id]).length;

  function toggleManual(id) {
    setFormError(null);
    setManualSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));
  }

  function handleSubmit() {
    if (!cropId) { setFormError('Sila pilih tanaman dahulu.'); return; }
    if (chosenIds.length === 0) { setFormError('Sila pilih sekurang-kurangnya satu petak.'); return; }
    setFormError(null);
    onPreview({ cropId, plotIds: chosenIds, startDate, interval, rest, musim });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tanaman">
          <select className={inputClass} style={inputStyle} value={cropId} onChange={e => { setCropId(e.target.value); setFormError(null); }}>
            {crops.map(c => <option key={c.id} value={c.id}>{c.nama} ({c.tempohTuaian} hari)</option>)}
          </select>
        </Field>
        <Field label="Tarikh Mula (petak kosong sahaja)" hint="Petak aktif akan auto-sambung selepas tuai — tarikh ini hanya untuk petak kosong">
          <input type="date" className={inputClass} style={inputStyle} value={startDate} onChange={e => { setStartDate(e.target.value); setFormError(null); }} />
        </Field>
        <Field label="Jarak Tanam Antara Petak Kosong (hari)" hint="Hanya diguna untuk petak kosong — petak aktif auto-kira sendiri">
          <input type="number" className={inputClass} style={inputStyle} value={interval} onChange={e => setIntervalDays(Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        <Field label="Tempoh Rehat Petak (hari)" hint="Jarak selepas tuai sebelum tanam semula">
          <input type="number" className={inputClass} style={inputStyle} value={rest} onChange={e => setRest(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="Bilangan Musim / Kitaran" hint="Berapa kali tanam semula di setiap petak">
          <input type="number" className={inputClass} style={inputStyle} value={musim} onChange={e => setMusim(Math.max(1, Number(e.target.value) || 1))} />
        </Field>
      </div>

      {/* Pilihan Petak */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Pilihan Petak:</span>
          <button type="button" onClick={() => { setMode('auto'); setFormError(null); }} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: mode === 'auto' ? 'var(--accent-sprout)' : 'transparent', color: mode === 'auto' ? '#1C2118' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>Auto Pilih</button>
          <button type="button" onClick={() => { setMode('manual'); setFormError(null); }} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: mode === 'manual' ? 'var(--accent-sprout)' : 'transparent', color: mode === 'manual' ? '#1C2118' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>Pilih Sendiri</button>
        </div>

        {mode === 'auto' ? (
          <div className="flex flex-col gap-2">
            <Field label={`Bilangan Petak (${emptyPlots.length} kosong + ${activePlots.length} aktif = ${plots.length} jumlah)`}>
              <input type="number" className={inputClass} style={{ ...inputStyle, maxWidth: 160 }} value={autoCount} onChange={e => { setAutoCount(Number(e.target.value)); setFormError(null); }} />
            </Field>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Sistem akan pilih petak kosong dahulu, kemudian petak aktif. Petak aktif akan auto-sambung selepas kitaran semasa selesai.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Petak <span style={{ color: 'var(--accent-sprout)' }}>■</span> kosong • Petak <span style={{ color: 'var(--accent-harvest)' }}>■</span> aktif (nombor = tarikh mula tanam seterusnya selepas rehat)
            </p>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg" style={{ border: '1px solid var(--border)', maxHeight: 180, overflowY: 'auto' }}>
              {plots.map(plot => {
                const selected = manualSelected.includes(plot.id);
                const nextStart = plotNextStart[plot.id];
                const isActive = !!nextStart;
                const accentColor = isActive ? 'var(--accent-harvest)' : 'var(--accent-sprout)';
                return (
                  <button
                    type="button"
                    key={plot.id}
                    onClick={() => toggleManual(plot.id)}
                    title={isActive ? `Auto-sambung: ${formatDateMY(nextStart)}` : 'Petak kosong'}
                    className="flex flex-col items-start px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: selected ? (isActive ? hexToRgba('#E0A845', 0.25) : hexToRgba('#8FBC5A', 0.25)) : 'var(--bg)',
                      color: selected ? (isActive ? '#E0A845' : '#8FBC5A') : 'var(--text-secondary)',
                      border: `1px solid ${selected ? accentColor : 'var(--border)'}`,
                      minWidth: 76,
                    }}
                  >
                    <span style={{ color: selected ? accentColor : 'var(--text-primary)' }}>{plot.nama}</span>
                    {isActive
                      ? <span style={{ color: selected ? accentColor : 'var(--text-secondary)', fontSize: '10px' }}>sambung: {formatShortMY(nextStart)}</span>
                      : <span style={{ color: selected ? '#8FBC5A' : 'var(--text-secondary)', fontSize: '10px' }}>kosong</span>
                    }
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Summary card */}
      {crop && chosenIds.length > 0 && (
        <div className="rounded-lg px-3 py-2.5 flex flex-col gap-2 text-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div style={{ color: 'var(--text-secondary)' }}>Kitaran tanaman</div>
              <div className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{crop.tempohTuaian} hari</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)' }}>Musim × petak</div>
              <div className="font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{musim} × {chosenIds.length}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)' }}>Petak kosong</div>
              <div className="font-medium mt-0.5" style={{ color: 'var(--accent-sprout)' }}>{chosenEmpty} petak → mula {formatShortMY(startDate)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)' }}>Petak aktif</div>
              <div className="font-medium mt-0.5" style={{ color: 'var(--accent-harvest)' }}>{chosenActive} petak → auto-sambung</div>
            </div>
          </div>
        </div>
      )}

      {formError && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--accent-clay)', background: hexToRgba('#C1623D', 0.1), border: '1px solid var(--accent-clay)' }}>{formError}</p>
      )}

      <div className="flex justify-end">
        <PrimaryButton onClick={handleSubmit}><Repeat size={15} /> Jana Pratonton Jadual</PrimaryButton>
      </div>
    </div>
  );
}

function ConveyorView({ crops, plots, plantings, onCommitBatch, onDeleteBatch, notify }) {
  const [showForm, setShowForm] = useState(plantings.length === 0);
  const [preview, setPreview] = useState(null);
  const today = todayISO();

  // Auto-scale timeline to cover all plantings
  const timelineRangeDays = useMemo(() => {
    if (plantings.length === 0) return 90;
    const maxHarvest = plantings.reduce((max, p) => (p.tarikhTuaianDijangka > max ? p.tarikhTuaianDijangka : max), today);
    const days = Math.max(diffDays(today, maxHarvest) + 14, 90);
    return days;
  }, [plantings, today]);

  function handlePreview(params) {
    const crop = crops.find(c => c.id === params.cropId);
    if (!crop) return;
    const { batchId, items } = buildConveyorSchedule({ crop, plotIds: params.plotIds, startDate: params.startDate, interval: params.interval, rest: params.rest, musim: params.musim, existingPlantings: plantings });
    setPreview({ batchId, items, crop });
  }

  function handleConfirm() {
    if (!preview) return;
    onCommitBatch(preview.items);
    notify(`Jadual conveyor untuk ${preview.crop.nama} berjaya dijana: ${preview.items.length} penanaman.`);
    setPreview(null);
    setShowForm(false);
  }

  const batches = useMemo(() => {
    const map = {};
    plantings.forEach(p => {
      if (!p.batchId) return;
      if (!map[p.batchId]) map[p.batchId] = [];
      map[p.batchId].push(p);
    });
    return Object.entries(map).map(([batchId, items]) => ({
      batchId,
      cropId: items[0].cropId,
      count: items.length,
      earliestPlant: items.reduce((min, i) => (i.tarikhTanam < min ? i.tarikhTanam : min), items[0].tarikhTanam),
    }));
  }, [plantings]);

  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);

  const previewCost = preview ? preview.items.length * (preview.crop.kadarBenihSepetak * preview.crop.kosBenihSeunit + preview.crop.kadarBajaSepetak * preview.crop.kosBajaSeunit) : 0;
  const previewYield = preview ? preview.items.length * preview.crop.anggaranHasilSepetak : 0;
  const previewRevenue = preview ? previewYield * preview.crop.hargaJualSeunit : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Jadual Conveyor</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aliran penanaman bertingkat untuk tuaian berterusan, 3 bulan akan datang.</p>
        </div>
        <SecondaryButton onClick={() => { setShowForm(s => !s); setPreview(null); }}>
          {showForm ? <><X size={15} /> Tutup Borang</> : <><Plus size={15} /> Jana Jadual Baharu</>}
        </SecondaryButton>
      </div>

      {showForm && (
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <ConveyorGeneratorForm crops={crops} plots={plots} plantings={plantings} onPreview={handlePreview} />
        </div>
      )}

      {preview && (
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: hexToRgba('#8FBC5A', 0.08), border: '1px solid var(--accent-sprout)' }}>
          <h3 className="font-display text-base" style={{ color: 'var(--text-primary)' }}>Pratonton Jadual — {preview.crop.nama}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span style={{ color: 'var(--text-secondary)' }}>Bilangan tanaman</span><div className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>{preview.items.length}</div></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Petak terlibat</span><div className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>{new Set(preview.items.map(i => i.plotId)).size}</div></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Anggaran kos</span><div className="font-display text-lg" style={{ color: 'var(--accent-clay)' }}>RM {previewCost.toFixed(2)}</div></div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Anggaran hasil jualan</span><div className="font-display text-lg" style={{ color: 'var(--accent-harvest)' }}>RM {previewRevenue.toFixed(2)}</div></div>
          </div>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setPreview(null)}>Batal</SecondaryButton>
            <PrimaryButton onClick={handleConfirm}><Check size={15} /> Sahkan & Simpan Jadual</PrimaryButton>
          </div>
        </div>
      )}

      <ConveyorTimeline plots={plots} plantings={plantings} crops={crops} rangeStart={today} rangeDays={timelineRangeDays} />

      {batches.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-base" style={{ color: 'var(--text-primary)' }}>Kumpulan Jadual Tersedia</h3>
          <div className="flex flex-col gap-2">
            {batches.map(b => (
              <div key={b.batchId} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="text-sm">
                  <span style={{ color: 'var(--text-primary)' }} className="font-medium">{cropMap[b.cropId]?.nama || '-'}</span>
                  <span style={{ color: 'var(--text-secondary)' }}> • {b.count} penanaman • mula {formatDateMY(b.earliestPlant)}</span>
                </div>
                <ConfirmIconButton onConfirm={() => onDeleteBatch(b.batchId)} icon={Trash2} title="Padam kumpulan jadual ini" color="var(--accent-clay)" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/* Log Operasi                                                    */
/* ============================================================ */
function LogEntryModal({ planting, crop, plot, onClose, onSave }) {
  const rekod = planting.rekod || {};
  const [benih, setBenih] = useState(rekod.benihDigunakan ?? crop?.kadarBenihSepetak ?? 0);
  const [baja, setBaja] = useState(rekod.bajaDigunakan ?? crop?.kadarBajaSepetak ?? 0);
  const [air, setAir] = useState(rekod.airDigunakan ?? (crop ? crop.kadarAirSepetakHari * crop.tempohTuaian : 0));
  const [kos, setKos] = useState(rekod.kosSebenar ?? (crop ? +(crop.kadarBenihSepetak * crop.kosBenihSeunit + crop.kadarBajaSepetak * crop.kosBajaSeunit).toFixed(2) : 0));
  const [tarikhTuai, setTarikhTuai] = useState(rekod.tarikhTuaianSebenar || '');
  const [hasil, setHasil] = useState(rekod.hasilSebenar ?? '');
  const [hargaJual, setHargaJual] = useState(rekod.hargaJualSebenar ?? crop?.hargaJualSeunit ?? '');
  const [catatan, setCatatan] = useState(rekod.catatan || '');

  function submit() {
    onSave({
      benihDigunakan: Number(benih) || 0,
      bajaDigunakan: Number(baja) || 0,
      airDigunakan: Number(air) || 0,
      kosSebenar: Number(kos) || 0,
      tarikhTuaianSebenar: tarikhTuai || null,
      hasilSebenar: hasil === '' ? null : Number(hasil),
      hargaJualSebenar: hargaJual === '' ? null : Number(hargaJual),
      catatan,
    });
  }

  return (
    <Modal title={`Log: ${crop?.nama || '-'} • ${plot?.nama || '-'}`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
          Ditanam {formatDateMY(planting.tarikhTanam)} • Dijangka tuai {formatDateMY(planting.tarikhTuaianDijangka)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Benih Digunakan (kg)"><input type="number" step="0.001" className={inputClass} style={inputStyle} value={benih} onChange={e => setBenih(e.target.value)} /></Field>
          <Field label="Baja Digunakan (kg)"><input type="number" step="0.01" className={inputClass} style={inputStyle} value={baja} onChange={e => setBaja(e.target.value)} /></Field>
          <Field label="Air Digunakan (liter, keseluruhan kitaran)"><input type="number" step="1" className={inputClass} style={inputStyle} value={air} onChange={e => setAir(e.target.value)} /></Field>
          <Field label="Kos Sebenar (RM)"><input type="number" step="0.01" className={inputClass} style={inputStyle} value={kos} onChange={e => setKos(e.target.value)} /></Field>
        </div>
        <div style={{ height: 1, background: 'var(--border)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Rekod Tuaian</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Tarikh Tuai Sebenar">
            <input type="date" className={inputClass} style={inputStyle} value={tarikhTuai} onChange={e => setTarikhTuai(e.target.value)} />
          </Field>
          <Field label="Hasil Tuaian (kg)">
            <input type="number" step="0.1" className={inputClass} style={inputStyle} value={hasil} onChange={e => setHasil(e.target.value)} placeholder={`anggaran ${crop?.anggaranHasilSepetak ?? '-'}`} />
          </Field>
          <Field label="Harga Jual (RM/kg)">
            <input type="number" step="0.1" className={inputClass} style={inputStyle} value={hargaJual} onChange={e => setHargaJual(e.target.value)} />
          </Field>
        </div>
        <Field label="Catatan">
          <textarea className={inputClass} style={{ ...inputStyle, minHeight: 70 }} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="cth: serangan perosak, cuaca, dsb." />
        </Field>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Batal</SecondaryButton>
          <PrimaryButton onClick={submit}><Check size={15} /> Simpan Rekod</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function LogView({ crops, plots, plantings, onUpdateRecord, onDeletePlanting }) {
  const today = todayISO();
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('semua');

  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);
  const plotMap = useMemo(() => Object.fromEntries(plots.map(p => [p.id, p])), [plots]);

  // Count per phase for badge
  const phaseCounts = useMemo(() => {
    const counts = { semua: 0 };
    Object.keys(STATUS_META).forEach(k => { counts[k] = 0; });
    plantings.forEach(p => {
      const s = getPlantingStatus(p, today);
      counts[s] = (counts[s] || 0) + 1;
      counts.semua += 1;
    });
    return counts;
  }, [plantings, today]);

  const FILTER_TABS = [
    { key: 'semua', label: 'Semua' },
    ...Object.entries(STATUS_META).map(([key, meta]) => ({ key, label: meta.label, color: meta.color })),
  ];

  const list = useMemo(() => {
    return plantings
      .map(p => ({ ...p, status: getPlantingStatus(p, today) }))
      .filter(p => filter === 'semua' || p.status === filter)
      .sort((a, b) => (a.tarikhTanam < b.tarikhTanam ? -1 : 1));
  }, [plantings, today, filter]);

  const editingPlanting = editingId ? plantings.find(p => p.id === editingId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Log Operasi</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Catat penggunaan benih, baja, air dan hasil tuaian sebenar bagi setiap penanaman.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(({ key, label, color }) => {
            const active = filter === key;
            const count = phaseCounts[key] || 0;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: active ? (color || 'var(--accent-sprout)') : hexToRgba(color || '#8FBC5A', 0.1),
                  color: active ? (key === 'semua' ? '#1C2118' : '#1C2118') : (color || 'var(--text-secondary)'),
                  border: `1px solid ${active ? (color || 'var(--accent-sprout)') : hexToRgba(color || '#8FBC5A', 0.3)}`,
                }}
              >
                {label}
                <span
                  className="rounded-full px-1 tabular-nums"
                  style={{
                    background: active ? 'rgba(0,0,0,0.2)' : hexToRgba(color || '#8FBC5A', 0.15),
                    color: active ? '#fff' : (color || 'var(--text-secondary)'),
                    fontSize: '10px',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <ClipboardList size={26} style={{ color: 'var(--text-secondary)', margin: '0 auto 10px' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tiada rekod untuk ditunjukkan.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map(p => {
            const crop = cropMap[p.cropId];
            const plot = plotMap[p.plotId];
            const meta = STATUS_META[p.status];
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <Badge color={meta.color}>{meta.label}</Badge>
                  <div className="text-sm">
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{crop?.nama || '-'}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {' '}• {plot?.nama || '-'} •{' '}
                      {p.status === 'dirancang'
                        ? <span style={{ color: 'var(--accent-water)' }}>tanam {formatDateMY(p.tarikhTanam)}</span>
                        : p.status === 'dituai' && p.rekod?.tarikhTuaianSebenar
                          ? `dituai ${formatDateMY(p.rekod.tarikhTuaianSebenar)}`
                          : `tuai dijangka ${formatDateMY(p.tarikhTuaianDijangka)}`
                      }
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.rekod?.hasilSebenar != null && (
                    <span className="text-xs" style={{ color: 'var(--accent-harvest)' }}>{p.rekod.hasilSebenar} kg dituai</span>
                  )}
                  <SecondaryButton size="sm" onClick={() => setEditingId(p.id)}><Pencil size={12} /> Log</SecondaryButton>
                  <ConfirmIconButton onConfirm={() => onDeletePlanting(p.id)} icon={Trash2} title="Padam rekod ini" color="var(--accent-clay)" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingPlanting && (
        <LogEntryModal
          planting={editingPlanting}
          crop={cropMap[editingPlanting.cropId]}
          plot={plotMap[editingPlanting.plotId]}
          onClose={() => setEditingId(null)}
          onSave={(rekod) => { onUpdateRecord(editingPlanting.id, rekod); setEditingId(null); }}
        />
      )}
    </div>
  );
}

/* ============================================================ */
/* Laporan                                                        */
/* ============================================================ */
function ReportsView({ crops, plantings }) {
  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);

  const summary = useMemo(() => {
    const byCrop = {};
    plantings.forEach(p => {
      const crop = cropMap[p.cropId];
      if (!crop) return;
      if (!byCrop[p.cropId]) byCrop[p.cropId] = { crop, kos: 0, hasil: 0, jualan: 0, bilangan: 0, dituai: 0 };
      const entry = byCrop[p.cropId];
      entry.bilangan += 1;
      const rekod = p.rekod || {};
      const kosAktual = rekod.kosSebenar != null && rekod.kosSebenar !== 0 ? rekod.kosSebenar : (crop.kadarBenihSepetak * crop.kosBenihSeunit + crop.kadarBajaSepetak * crop.kosBajaSeunit);
      entry.kos += kosAktual;
      if (rekod.hasilSebenar != null) {
        entry.hasil += rekod.hasilSebenar;
        entry.jualan += rekod.hasilSebenar * (rekod.hargaJualSebenar != null ? rekod.hargaJualSebenar : crop.hargaJualSeunit);
        entry.dituai += 1;
      }
    });
    return Object.values(byCrop).sort((a, b) => b.jualan - a.jualan);
  }, [plantings, cropMap]);

  const totals = useMemo(() => summary.reduce((acc, e) => ({
    kos: acc.kos + e.kos, jualan: acc.jualan + e.jualan, hasil: acc.hasil + e.hasil, bilangan: acc.bilangan + e.bilangan,
  }), { kos: 0, jualan: 0, hasil: 0, bilangan: 0 }), [summary]);

  const maxValue = Math.max(1, ...summary.map(e => Math.max(e.kos, e.jualan)));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Laporan</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ringkasan kos berbanding hasil jualan mengikut tanaman.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Sprout} label="Jumlah Penanaman" value={totals.bilangan} accent="var(--accent-sprout)" />
        <StatCard icon={Wallet} label="Jumlah Kos" value={`RM ${totals.kos.toFixed(0)}`} accent="var(--accent-clay)" />
        <StatCard icon={Wheat} label="Jumlah Hasil" value={`${totals.hasil.toFixed(0)} kg`} accent="var(--accent-harvest)" />
        <StatCard icon={TrendingUp} label="Nilai Jualan" value={`RM ${totals.jualan.toFixed(0)}`} accent="var(--accent-water)" sub={totals.kos > 0 ? `Untung anggaran RM ${(totals.jualan - totals.kos).toFixed(0)}` : undefined} />
      </div>

      <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-display text-base" style={{ color: 'var(--text-primary)' }}>Kos vs Jualan Mengikut Tanaman</h3>
        {summary.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Belum ada data. Mula log penanaman di Log Operasi.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {summary.map(e => (
              <div key={e.crop.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-primary)' }} className="font-medium">{e.crop.nama}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{e.bilangan} penanaman • {e.dituai} dituai</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 46, color: 'var(--accent-clay)' }} className="text-xs">Kos</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                      <div style={{ width: `${(e.kos / maxValue) * 100}%`, background: 'var(--accent-clay)', height: '100%' }} />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', width: 70, textAlign: 'right' }}>RM {e.kos.toFixed(0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ width: 46, color: 'var(--accent-harvest)' }} className="text-xs">Jualan</span>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                      <div style={{ width: `${(e.jualan / maxValue) * 100}%`, background: 'var(--accent-harvest)', height: '100%' }} />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)', width: 70, textAlign: 'right' }}>RM {e.jualan.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
/* Papan Pemuka (dashboard)                                       */
/* ============================================================ */
function DashboardView({ crops, plots, plantings }) {
  const today = todayISO();
  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);
  const plotMap = useMemo(() => Object.fromEntries(plots.map(p => [p.id, p])), [plots]);

  const withStatus = useMemo(() => plantings.map(p => ({ ...p, status: getPlantingStatus(p, today) })), [plantings, today]);

  const aktifCount = withStatus.filter(p => ['sedang_tumbuh', 'sedia_tuai', 'lewat'].includes(p.status)).length;
  const plotKosong = plots.filter(pl => getPlotInfo(pl.id, plantings, today).status === 'kosong').length;
  const upcoming7 = withStatus
    .filter(p => p.status !== 'dituai' && diffDays(today, p.tarikhTuaianDijangka) >= 0 && diffDays(today, p.tarikhTuaianDijangka) <= 7)
    .sort((a, b) => (a.tarikhTuaianDijangka < b.tarikhTuaianDijangka ? -1 : 1));
  const lewatList = withStatus.filter(p => p.status === 'lewat');

  const thisMonth = today.slice(0, 7);
  const kosBulanIni = plantings.reduce((sum, p) => {
    const refDate = p.rekod?.tarikhTuaianSebenar || p.tarikhTanam || '';
    if (refDate.slice(0, 7) !== thisMonth) return sum;
    return sum + (p.rekod?.kosSebenar || 0);
  }, 0);
  const hasilBulanIni = plantings.reduce((sum, p) => {
    if (!p.rekod?.hasilSebenar) return sum;
    if ((p.rekod.tarikhTuaianSebenar || '').slice(0, 7) !== thisMonth) return sum;
    return sum + p.rekod.hasilSebenar;
  }, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Papan Pemuka</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDateMY(today)} • Ringkasan operasi ladang anda.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Sprout} label="Petak Aktif" value={aktifCount} sub={`daripada ${plots.length} petak`} accent="var(--accent-sprout)" />
        <StatCard icon={LayoutGrid} label="Petak Kosong" value={plotKosong} sub="sedia untuk ditanam" accent="var(--text-secondary)" />
        <StatCard icon={Wallet} label="Kos Bulan Ini" value={`RM ${kosBulanIni.toFixed(0)}`} accent="var(--accent-clay)" />
        <StatCard icon={Wheat} label="Hasil Bulan Ini" value={`${hasilBulanIni.toFixed(0)} kg`} accent="var(--accent-harvest)" />
      </div>

      {lewatList.length > 0 && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: hexToRgba('#C1623D', 0.1), border: '1px solid var(--accent-clay)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--accent-clay)' }} />
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{lewatList.length} penanaman sudah lewat dituai. Semak di Log Operasi.</p>
        </div>
      )}

      <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-display text-base mb-3" style={{ color: 'var(--text-primary)' }}>Tuaian 7 Hari Akan Datang</h3>
        {upcoming7.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tiada tuaian dijangka dalam 7 hari ini.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming7.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-primary)' }}>{cropMap[p.cropId]?.nama} • {plotMap[p.plotId]?.nama}</span>
                <Badge color={STATUS_META[p.status].color}>{formatDateMY(p.tarikhTuaianDijangka)}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConveyorTimeline plots={plots} plantings={plantings} crops={crops} rangeStart={today} rangeDays={90} />
    </div>
  );
}

/* ============================================================ */
/* Reset                                                           */
/* ============================================================ */
function ResetButton({ onReset }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);
  return (
    <button
      onClick={() => { if (confirming) { onReset(); setConfirming(false); } else setConfirming(true); }}
      className="w-full text-left px-3 py-2 rounded-lg text-xs"
      style={{ color: confirming ? 'var(--accent-clay)' : 'var(--text-secondary)', border: confirming ? '1px solid var(--accent-clay)' : '1px solid transparent' }}
    >
      {confirming ? 'Klik sekali lagi untuk sahkan' : 'Set Semula Data'}
    </button>
  );
}

/* ============================================================ */
/* App                                                             */
/* ============================================================ */
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Papan Pemuka', icon: LayoutDashboard },
  { key: 'conveyor', label: 'Jadual Conveyor', icon: Repeat },
  { key: 'crops', label: 'Tanaman', icon: Sprout },
  { key: 'plots', label: 'Petak', icon: LayoutGrid },
  { key: 'log', label: 'Log Operasi', icon: ClipboardList },
  { key: 'reports', label: 'Laporan', icon: BarChart3 },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [crops, setCrops] = useState([]);
  const [plots, setPlots] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const c = safeGet('farm-crops'), p = safeGet('farm-plots'), pl = safeGet('farm-plantings');
    const loadedCrops = c ? JSON.parse(c) : DEFAULT_CROPS;
    const loadedPlots = p ? JSON.parse(p) : generateDefaultPlots(24);
    const loadedPlantings = pl ? JSON.parse(pl) : [];
    setCrops(loadedCrops);
    setPlots(loadedPlots);
    setPlantings(loadedPlantings);
    setLoading(false);
    if (!c) safeSet('farm-crops', loadedCrops);
    if (!p) safeSet('farm-plots', loadedPlots);
    if (!pl) safeSet('farm-plantings', loadedPlantings);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  function notify(msg) { setNotice(msg); }
  function updateCrops(next) { setCrops(next); safeSet('farm-crops', next); }
  function updatePlots(next) { setPlots(next); safeSet('farm-plots', next); }
  function updatePlantings(next) { setPlantings(next); safeSet('farm-plantings', next); }

  function handleSaveCrop(data) {
    const exists = crops.some(c => c.id === data.id);
    updateCrops(exists ? crops.map(c => (c.id === data.id ? data : c)) : [...crops, data]);
    notify(`Tanaman "${data.nama}" disimpan.`);
  }
  function handleDeleteCrop(id) { updateCrops(crops.filter(c => c.id !== id)); }
  function handleAddPlots(count) {
    const n = Math.max(1, Math.min(200, Number(count) || 1));
    const existingNums = plots.map(p => { const m = p.nama.match(/(\d+)$/); return m ? Number(m[1]) : 0; });
    let nextNum = (existingNums.length ? Math.max(...existingNums) : 0) + 1;
    const newPlots = Array.from({ length: n }, () => ({ id: uid('plot'), nama: `Petak ${nextNum++}` }));
    updatePlots([...plots, ...newPlots]);
    notify(`${n} petak baharu ditambah.`);
  }
  function handleRenamePlot(id, nama) { updatePlots(plots.map(p => (p.id === id ? { ...p, nama } : p))); }
  function handleDeletePlot(id) { updatePlots(plots.filter(p => p.id !== id)); }
  function handleCommitBatch(items) { updatePlantings([...plantings, ...items]); }
  function handleDeleteBatch(batchId) { updatePlantings(plantings.filter(p => p.batchId !== batchId)); notify('Kumpulan jadual dipadam.'); }
  function handleUpdateRecord(id, rekod) {
    updatePlantings(plantings.map(p => (p.id === id ? { ...p, rekod: { ...p.rekod, ...rekod } } : p)));
    notify('Rekod disimpan.');
  }
  function handleDeletePlanting(id) { updatePlantings(plantings.filter(p => p.id !== id)); }
  async function handleResetAll() {
    const freshCrops = DEFAULT_CROPS;
    const freshPlots = generateDefaultPlots(24);
    setCrops(freshCrops); setPlots(freshPlots); setPlantings([]);
    safeSet('farm-crops', freshCrops);
    safeSet('farm-plots', freshPlots);
    safeSet('farm-plantings', []);
    notify('Semua data telah ditetapkan semula.');
  }

  const canDeletePlotIds = useMemo(() => new Set(plots.filter(pl => !plantings.some(p => p.plotId === pl.id)).map(p => p.id)), [plots, plantings]);

  if (loading) {
    return (
      <div style={ROOT_VARS} className="font-body flex items-center justify-center" >
        
        <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent-sprout)' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={ROOT_VARS} className="font-body">
      
      <div className="flex flex-col md:flex-row min-h-screen" style={{ background: 'var(--bg)' }}>
        <aside className="hidden md:flex flex-col w-56 shrink-0 p-4 gap-1" style={{ borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-2 pb-5">
            <div className="rounded-lg p-1.5" style={{ background: 'var(--accent-sprout)' }}><Leaf size={16} style={{ color: '#1C2118' }} /></div>
            <span className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>LadangAlir</span>
          </div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left"
              style={{ background: tab === item.key ? 'var(--surface)' : 'transparent', color: tab === item.key ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <item.icon size={16} style={{ color: tab === item.key ? 'var(--accent-sprout)' : 'var(--text-secondary)' }} />
              {item.label}
            </button>
          ))}
          <div className="mt-auto pt-4">
            <ResetButton onReset={handleResetAll} />
          </div>
        </aside>

        <div className="flex md:hidden items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-1.5" style={{ background: 'var(--accent-sprout)' }}><Leaf size={15} style={{ color: '#1C2118' }} /></div>
            <span className="font-display text-base" style={{ color: 'var(--text-primary)' }}>LadangAlir</span>
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-x-hidden">
          {notice && (
            <div className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: hexToRgba('#8FBC5A', 0.12), border: '1px solid var(--accent-sprout)', color: 'var(--text-primary)' }}>
              {notice}
            </div>
          )}
          {tab === 'dashboard' && <DashboardView crops={crops} plots={plots} plantings={plantings} />}
          {tab === 'conveyor' && <ConveyorView crops={crops} plots={plots} plantings={plantings} onCommitBatch={handleCommitBatch} onDeleteBatch={handleDeleteBatch} notify={notify} />}
          {tab === 'crops' && <CropsView crops={crops} plantings={plantings} onSave={handleSaveCrop} onDelete={handleDeleteCrop} />}
          {tab === 'plots' && <PlotsView crops={crops} plots={plots} plantings={plantings} canDeletePlotIds={canDeletePlotIds} onAddPlots={handleAddPlots} onRenamePlot={handleRenamePlot} onDeletePlot={handleDeletePlot} />}
          {tab === 'log' && <LogView crops={crops} plots={plots} plantings={plantings} onUpdateRecord={handleUpdateRecord} onDeletePlanting={handleDeletePlanting} />}
          {tab === 'reports' && <ReportsView crops={crops} plantings={plantings} />}
        </main>

        <nav className="flex md:hidden fixed bottom-0 left-0 right-0 justify-around py-2 z-30" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={() => setTab(item.key)} className="flex flex-col items-center gap-0.5 px-2 py-1">
              <item.icon size={18} style={{ color: tab === item.key ? 'var(--accent-sprout)' : 'var(--text-secondary)' }} />
              <span className="text-xs" style={{ color: tab === item.key ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
