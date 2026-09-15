"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createFarmStore, STORE_KEY, LEGACY_KEYS, assertUnchanged } from '../lib/farm-store';
import { appendSchedule, replaceRecord, deleteRecords } from '../lib/farm-operations';
import { buildConveyorSchedule as calculateConveyor } from '../lib/conveyor-schedule';
import { basicDates, buildBasicSchedule } from '../lib/basic-schedule';
import { buildProductionSchedule } from '../lib/production-schedule';
import { findScheduleOverlaps, canSaveSchedule, layoutTimelineLanes } from '../lib/schedule-overlaps';
import { parseRestoreFile } from '../lib/restore';
import {
  LayoutDashboard, Sprout, LayoutGrid, Repeat, ClipboardList, BarChart3,
  Plus, Pencil, Trash2, X, Check, Droplets, Wheat, AlertTriangle,
  Wallet, TrendingUp, Leaf, Package, Loader2, CalendarDays, Upload,
  ChevronRight,
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
function uid(prefix = 'id') { return `${prefix}_${crypto.randomUUID()}`; }

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

function normalizeCrop(crop) {
  return {
    kaedahTanam: 'terus',
    tempohSemaian: 0,
    jenisTuaian: 'sekali',
    tempohProduktif: 0,
    ...crop,
  };
}

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
  if (planting.tarikhTamatDijangka) {
    return today <= planting.tarikhTamatDijangka ? 'sedia_tuai' : 'lewat';
  }
  const overdue = diffDays(planting.tarikhTuaianDijangka, today);
  if (overdue >= 0 && overdue <= 3) return 'sedia_tuai';
  return 'lewat';
}

function getPlotInfo(plotId, plantings, today) {
  const relevant = plantings.filter(p => p.plotId === plotId);
  const active = relevant.filter(p => p.tarikhTanam <= today && !(p.rekod && p.rekod.tarikhTuaianSebenar));
  if (active.length) return { status: 'aktif', planting: active[0], plantings: active };
  const upcoming = relevant
    .filter(p => p.tarikhTanam > today && !(p.rekod && p.rekod.tarikhTuaianSebenar))
    .sort((a, b) => (a.tarikhTanam < b.tarikhTanam ? -1 : 1));
  if (upcoming.length) {
    const firstEnd = upcoming[0].tarikhTamatDijangka || upcoming[0].tarikhTuaianDijangka;
    return { status: 'akan_ditanam', planting: upcoming[0], plantings: upcoming.filter(p => p.tarikhTanam <= firstEnd) };
  }
  return { status: 'kosong', planting: null, plantings: [] };
}

function buildConveyorSchedule(params) {
  const batchId = uid('batch');
  const result = calculateConveyor(params);
  return { ...result, batchId, items: result.items.map(item => ({ ...item, id: uid('plant'), batchId })) };
}

function buildTargetHarvestSchedule(params, batchId = uid('target')) {
  // The batch and item ids are minted once, when the preview is built. They are reused on
  // every save attempt so a retry after an unconfirmed write cannot add a second copy of
  // the same batch, and the duplicate-id check in appendSchedule can catch the retry.
  const result = buildProductionSchedule(params);
  return { ...result, batchId, items: result.items.map(item => ({ ...item, batchId, id: uid('plant') })) };
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

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
.font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
.font-body { font-family: 'Inter', sans-serif; }
* { box-sizing: border-box; }
::-webkit-scrollbar { height: 8px; width: 8px; }
::-webkit-scrollbar-thumb { background: #3A4030; border-radius: 4px; }
::-webkit-scrollbar-track { background: transparent; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid #8FBC5A; outline-offset: 1px;
}
.row-link { transition: background 120ms ease; }
.row-link:hover { background: rgba(143, 188, 90, 0.1); }
.bar-link { transition: filter 120ms ease; }
.bar-link:hover { filter: brightness(1.25); }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;

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

function SecondaryButton({ children, onClick, type = 'button', size = 'md', disabled }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium ${pad}`}
      style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', opacity: disabled ? 0.5 : 1 }}
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

function OverlapConfirmation({ warnings, confirmed, onChange, disabled }) {
  if (!warnings?.length) return null;
  return <section className="rounded-lg p-3 flex flex-col gap-3" style={{ background: hexToRgba('#E0A845', 0.08), border: '1px solid var(--accent-harvest)' }} aria-label="Pengesahan pertindihan petak">
    <div role="alert">
      <p className="text-base font-medium flex items-center gap-2" style={{ color: 'var(--accent-harvest)' }}><AlertTriangle size={18} /> Petak digunakan oleh beberapa tanaman</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>Semak pertindihan ini. Jadual boleh disimpan selepas perkongsian petak disahkan.</p>
    </div>
    <ul className="list-disc pl-5 flex flex-col gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
      {warnings.map(w => <li key={w.key}><strong>{w.plotName}</strong>: {w.cropName} dan {w.otherCropName}, {w.unfinished ? `belum disahkan selesai selepas ${formatDateMY(w.expectedEnd)}; mungkin masih menggunakan petak pada jadual baharu` : `${formatDateMY(w.start)} hingga ${formatDateMY(w.end)}`} <span style={{ color: 'var(--text-secondary)' }}>({w.source === 'disimpan' ? 'jadual sedia ada' : 'dalam jadual baharu ini'})</span></li>)}
    </ul>
    <label className="flex items-start gap-3 py-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)', minHeight: 44 }}>
      <input type="checkbox" className="mt-1" style={{ accentColor: 'var(--accent-harvest)' }} checked={confirmed} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span>Saya sahkan pertindihan ini disengajakan dan benarkan tanaman berkongsi petak.</span>
    </label>
  </section>;
}

/* ============================================================ */
/* Conveyor timeline — the signature visual                      */
/* ============================================================ */
function ConveyorTimeline({ plots, plantings, crops, rangeStart, rangeDays = 90, onOpenLog }) {
  const today = todayISO();
  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);
  const rangeEnd = addDays(rangeStart, rangeDays);

  const rows = useMemo(() => {
    return plots
      .map(plot => ({
        plot,
        items: plantings.filter(p => p.plotId === plot.id && p.tarikhTanam < rangeEnd && (p.tarikhTamatDijangka || p.tarikhTuaianDijangka) > rangeStart),
      }))
      .filter(r => r.items.length > 0)
      .map(r => ({ ...r, ...layoutTimelineLanes(r.items) }))
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

          {rows.map(({ plot, entries, laneCount }) => (
            <div key={plot.id} className="flex items-center" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: labelWidth, flexShrink: 0, background: 'var(--surface)' }} className="sticky left-0 z-10 px-3 py-3">
                <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500 }}>{plot.nama}</span>
              </div>
              <div style={{ width: trackWidth, position: 'relative', height: Math.max(44, laneCount * 34 + 10) }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'repeating-linear-gradient(90deg, var(--border) 0px, var(--border) 6px, transparent 6px, transparent 12px)' }} />
                <div style={{ position: 'absolute', left: todayOffsetPx, top: 0, bottom: 0, width: 1, background: hexToRgba('#C1623D', 0.5) }} />
                {entries.map(({ item: p, lane }) => {
                  const crop = cropMap[p.cropId];
                  const status = getPlantingStatus(p, today);
                  const meta = STATUS_META[status];
                  const displayEnd = p.tarikhTamatDijangka || p.tarikhTuaianDijangka;
                  const startOffset = Math.max(diffDays(rangeStart, p.tarikhTanam), 0);
                  const endOffset = Math.min(diffDays(rangeStart, displayEnd), rangeDays);
                  const left = startOffset * pxPerDay;
                  const width = Math.max((endOffset - startOffset) * pxPerDay, 6);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpenLog?.(p.id)}
                      title={`${crop ? crop.nama : '?'} - tanam ${formatDateMY(p.tarikhTanam)}, tuaian pertama ${formatDateMY(p.tarikhTuaianDijangka)}, petak tersedia ${formatDateMY(displayEnd)}`}
                      style={{ position: 'absolute', left, width, top: 9 + lane * 34, height: 26, background: hexToRgba(meta.color, 0.22), border: `1px solid ${meta.color}`, borderRadius: 999, cursor: 'pointer' }}
                      className="bar-link flex items-center px-2 overflow-hidden"
                    >
                      <span style={{ color: meta.color, fontSize: '10px', fontWeight: 500 }} className="truncate">
                        {crop ? crop.nama : '?'}
                      </span>
                    </button>
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
function CropForm({ initial, onCancel, onSave }) {
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);
  const [form, setForm] = useState(initial || {
    nama: '', kaedahTanam: 'terus', tempohSemaian: 0, tempohTuaian: 30,
    jenisTuaian: 'sekali', tempohProduktif: 0, kadarBenihSepetak: 0.05, kosBenihSeunit: 20,
    jenisBaja: 'NPK 15:15:15', kadarBajaSepetak: 0.5, kosBajaSeunit: 4,
    kadarAirSepetakHari: 12, anggaranHasilSepetak: 8, hargaJualSeunit: 4,
  });
  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }
  async function submit(e) {
    e.preventDefault();
    if (!form.nama.trim() || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      const result = await onSave({ ...form, id: form.id || uid('crop') }, initial || undefined);
      if (!result.ok) setSaveError(result.error);
    } finally { savingRef.current = false; setSaving(false); }
  }
  return (
    <form onSubmit={submit}><fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Nama Tanaman">
        <input className={inputClass} style={inputStyle} value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="cth: Kangkung" required />
      </Field>
      <Field label="Tempoh Tuaian (hari)">
        <input type="number" min="1" className={inputClass} style={inputStyle} value={form.tempohTuaian} onChange={e => set('tempohTuaian', Number(e.target.value))} required />
      </Field>
      <Field label="Kaedah Penanaman">
        <select className={inputClass} style={inputStyle} value={form.kaedahTanam} onChange={e => set('kaedahTanam', e.target.value)}>
          <option value="terus">Semai terus di petak</option>
          <option value="pindah">Semai dan pindah tanam</option>
        </select>
      </Field>
      {form.kaedahTanam === 'pindah' && (
        <Field label="Tempoh Semaian (hari)" hint="Hari dari semai hingga pindah tanam">
          <input type="number" min="0" className={inputClass} style={inputStyle} value={form.tempohSemaian} onChange={e => set('tempohSemaian', Number(e.target.value))} />
        </Field>
      )}
      <Field label="Corak Tuaian">
        <select className={inputClass} style={inputStyle} value={form.jenisTuaian} onChange={e => set('jenisTuaian', e.target.value)}>
          <option value="sekali">Sekali tuai</option>
          <option value="berkali">Berkali kali</option>
        </select>
      </Field>
      {form.jenisTuaian === 'berkali' && (
        <Field label="Tempoh Produktif (hari)" hint="Tempoh petak digunakan selepas tuaian pertama">
          <input type="number" min="0" className={inputClass} style={inputStyle} value={form.tempohProduktif} onChange={e => set('tempohProduktif', Number(e.target.value))} />
        </Field>
      )}
      <Field label="Kadar Benih / Petak (kg)">
        <input type="number" step="0.001" min="0" className={inputClass} style={inputStyle} value={form.kadarBenihSepetak} onChange={e => set('kadarBenihSepetak', Number(e.target.value))} />
      </Field>
      <Field label="Kos Benih (RM/kg)">
        <input type="number" step="0.01" min="0" className={inputClass} style={inputStyle} value={form.kosBenihSeunit} onChange={e => set('kosBenihSeunit', Number(e.target.value))} />
      </Field>
      <Field label="Jenis Baja">
        <input className={inputClass} style={inputStyle} value={form.jenisBaja} onChange={e => set('jenisBaja', e.target.value)} />
      </Field>
      <Field label="Kadar Baja / Petak (kg)">
        <input type="number" step="0.01" min="0" className={inputClass} style={inputStyle} value={form.kadarBajaSepetak} onChange={e => set('kadarBajaSepetak', Number(e.target.value))} />
      </Field>
      <Field label="Kos Baja (RM/kg)">
        <input type="number" step="0.01" min="0" className={inputClass} style={inputStyle} value={form.kosBajaSeunit} onChange={e => set('kosBajaSeunit', Number(e.target.value))} />
      </Field>
      <Field label="Keperluan Air / Petak (liter/hari)">
        <input type="number" step="0.1" min="0" className={inputClass} style={inputStyle} value={form.kadarAirSepetakHari} onChange={e => set('kadarAirSepetakHari', Number(e.target.value))} />
      </Field>
      <Field label="Anggaran Hasil / Petak (kg)">
        <input type="number" step="0.1" min="0" className={inputClass} style={inputStyle} value={form.anggaranHasilSepetak} onChange={e => set('anggaranHasilSepetak', Number(e.target.value))} />
      </Field>
      <Field label="Harga Jual (RM/kg)">
        <input type="number" step="0.1" min="0" className={inputClass} style={inputStyle} value={form.hargaJualSeunit} onChange={e => set('hargaJualSeunit', Number(e.target.value))} />
      </Field>
      <>{saveError && <p role="alert" className="sm:col-span-2 text-sm" style={{ color: 'var(--accent-clay)' }}>{saveError}</p>}</>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <SecondaryButton onClick={onCancel}>Batal</SecondaryButton>
        <PrimaryButton type="submit" disabled={saving}><Check size={15} /> {saving ? 'Menyimpan…' : 'Simpan'}</PrimaryButton>
      </div>
    </fieldset></form>
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
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {crop.kaedahTanam === 'pindah' ? `${crop.tempohSemaian} hari semaian • ` : 'Semai terus • '}
                  {crop.tempohTuaian} hari ke tuaian
                </p>
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
              <span className="flex items-center gap-1"><CalendarDays size={12} /> {crop.jenisTuaian === 'berkali' ? `Produktif ${crop.tempohProduktif} hari` : 'Sekali tuai'}</span>
            </div>
            <div className="text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
              Harga jual: <span style={{ color: 'var(--accent-harvest)' }}>RM {crop.hargaJualSeunit}/kg</span>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Tambah Tanaman' : `Edit ${editing.nama}`} onClose={() => setEditing(null)} wide>
          <CropForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSave={async (data, expected) => { const result = await onSave(data, expected); if (result.ok) setEditing(null); return result; }} />
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
  const renameOriginal = React.useRef(null);

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
                    maxLength={100}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={async () => {
                      const next = renameValue.trim();
                      // An unchanged or empty name is not a save; empty is rejected by validation anyway.
                      if (!next || next === plot.nama) { setRenamingId(null); return; }
                      const result = await onRenamePlot(plot.id, next, renameOriginal.current);
                      if (result.ok) setRenamingId(null);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className={inputClass}
                    style={{ ...inputStyle, padding: '2px 6px', fontSize: '13px' }}
                  />
                ) : (
                  <button onClick={() => { renameOriginal.current = plot; setRenamingId(plot.id); setRenameValue(plot.nama); }} className="text-sm font-medium text-left" style={{ color: 'var(--text-primary)' }}>
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
              {info.plantings.map(planting => (
                <div key={planting.id} className="text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {cropMap[planting.cropId]?.nama || '-'}
                  <br />
                  {info.status === 'aktif' ? `Tuai: ${formatShortMY(planting.tarikhTuaianDijangka)}` : `Tanam: ${formatShortMY(planting.tarikhTanam)}`}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/* Jadual biasa                                                  */
/* ============================================================ */
function BasicScheduleView({ crops, plots, plantings, onSave, onDeleteBatch, notify }) {
  const newRow = () => ({ id: uid('row'), cropId: crops[0]?.id || '', mode: 'start', date: todayISO(), plotIds: [] });
  const [rows, setRows] = useState(() => [newRow()]);
  const [planName, setPlanName] = useState('');
  const [preview, setPreview] = useState(null);
  const [overlapConfirmed, setOverlapConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const savingRef = React.useRef(false);
  const cropMap = Object.fromEntries(crops.map(c => [c.id, c]));
  const plotMap = Object.fromEntries(plots.map(p => [p.id, p]));
  const plans = useMemo(() => {
    const grouped = new Map();
    plantings.filter(p => p.planJenis === 'biasa').forEach(p => {
      const key = p.batchId || p.id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(p);
    });
    return [...grouped.entries()].reverse();
  }, [plantings]);

  function updateRow(id, patch) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
    setPreview(null);
  }
  function changeMode(row, mode) {
    let date = row.date;
    try {
      const dates = basicDates(cropMap[row.cropId], row);
      date = mode === 'start' ? dates.tarikhSemai : dates.tarikhTuaianDijangka;
    } catch { /* Keep incomplete input editable. */ }
    updateRow(row.id, { mode, date });
  }
  function calculate() { return buildBasicSchedule({ crops, plots, plantings, rows, planName }); }
  // Mint the batch and item ids once, when the preview is built, then reuse them on every
  // save attempt. A retry after an unconfirmed write therefore reuses the same ids and is
  // rejected by appendSchedule instead of saving the whole batch a second time.
  function buildPreview() {
    const batchId = uid('basic');
    const result = calculate();
    return { ...result, batchId, items: result.items.map(item => ({ ...item, batchId, id: uid('plant') })) };
  }
  async function confirm() {
    if (savingRef.current || !preview) return;
    const fresh = calculate();
    // Revalidate dates, references and overlaps against current data, but keep the ids.
    const result = { ...preview, errors: fresh.errors, warnings: fresh.warnings, saveError: undefined, items: preview.items };
    setPreview(result);
    if (!canSaveSchedule(result, preview.warnings, overlapConfirmed)) { setOverlapConfirmed(false); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const items = result.items.map(item => ({ ...item, pertindihanDisahkan: result.warnings.length > 0 && overlapConfirmed }));
      const saved = await onSave(items, { warnings: result.warnings, confirmed: overlapConfirmed, crops });
      if (!saved.ok) {
        setOverlapConfirmed(false);
        setPreview({ ...result, saveError: saved.error });
        return;
      }
      notify(`Jadual biasa disimpan: ${items.length} penanaman.`);
      setPreview(null);
      setRows([newRow()]);
      setPlanName('');
      setShowForm(false);
    } finally { savingRef.current = false; setSaving(false); }
  }
  function scheduleTable(items) {
    return <div className="overflow-x-auto">
      <table className="w-full text-sm text-left" style={{ color: 'var(--text-primary)' }}>
        <thead style={{ color: 'var(--text-secondary)' }}><tr>{['Tanaman', 'Petak', 'Semai / tanam', 'Pindah tanam', 'Tuaian pertama', 'Tamat tuaian'].map(label => <th key={label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">{label}</th>)}</tr></thead>
        <tbody>{items.map((p, i) => <tr key={p.id || i} style={{ borderTop: '1px solid var(--border)' }}>
          <td className="px-3 py-2">{cropMap[p.cropId]?.nama || 'Tanaman dipadam'}</td>
          <td className="px-3 py-2 whitespace-nowrap">{plotMap[p.plotId]?.nama || 'Petak dipadam'}</td>
          <td className="px-3 py-2 whitespace-nowrap">{formatDateMY(p.tarikhSemai)}</td>
          <td className="px-3 py-2 whitespace-nowrap">{p.tarikhSemai !== p.tarikhTanam ? formatDateMY(p.tarikhTanam) : 'Tidak berkenaan'}</td>
          <td className="px-3 py-2 whitespace-nowrap">{formatDateMY(p.tarikhTuaianDijangka)}</td>
          <td className="px-3 py-2 whitespace-nowrap">{formatDateMY(p.tarikhTamatDijangka)}</td>
        </tr>)}</tbody>
      </table>
    </div>;
  }
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Jadual Biasa</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Rancang satu pusingan penanaman. Pilih tanaman, petak dan tarikh bagi setiap baris.</p></div>
      {!showForm && <SecondaryButton onClick={() => setShowForm(true)}><Plus size={15} /> Jadual Baharu</SecondaryButton>}
    </div>
    {showForm && <form noValidate onSubmit={e => { e.preventDefault(); setOverlapConfirmed(false); setPreview(buildPreview()); }} className="rounded-xl p-4 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <fieldset disabled={saving} className="flex flex-col gap-4 min-w-0">
        <Field label="Nama jadual (pilihan)"><input className={inputClass} style={inputStyle} maxLength={100} value={planName} placeholder="Contoh: Penanaman minggu depan" onChange={e => { setPlanName(e.target.value); setPreview(null); }} /></Field>
        {rows.map((row, index) => {
          const crop = cropMap[row.cropId];
          const transplant = crop?.kaedahTanam === 'pindah';
          let dates = null;
          try { dates = basicDates(crop, row); } catch { /* Validation is shown on preview. */ }
          return <fieldset key={row.id} className="rounded-lg p-3 min-w-0 flex flex-col gap-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <legend className="px-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Penanaman {index + 1}</legend>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Field label="Tanaman"><select className={inputClass} style={inputStyle} value={row.cropId} onChange={e => updateRow(row.id, { cropId: e.target.value })}>
                {!crops.length && <option value="">Tambah tanaman dahulu</option>}
                {crops.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
              </select></Field>
              <Field label="Kira jadual daripada"><select className={inputClass} style={inputStyle} value={row.mode} onChange={e => changeMode(row, e.target.value)}>
                <option value="start">{transplant ? 'Tarikh mula semai' : 'Tarikh tanam / semai terus'}</option><option value="harvest">Tarikh tuaian pertama</option>
              </select></Field>
              <Field label={row.mode === 'harvest' ? 'Tarikh tuaian pertama' : transplant ? 'Tarikh mula semai' : 'Tarikh tanam / semai terus'}>
                <input type="date" className={inputClass} style={inputStyle} value={row.date} onChange={e => updateRow(row.id, { date: e.target.value })} />
              </Field>
            </div>
            {crop && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{transplant ? `${crop.tempohSemaian} hari semaian, kemudian ${crop.tempohTuaian} hari dari pindah tanam hingga tuaian pertama.` : `${crop.tempohTuaian} hari dari tanam hingga tuaian pertama.`} {crop.jenisTuaian === 'berkali' && `Petak digunakan ${crop.tempohProduktif} hari lagi selepas tuaian pertama.`} Tempoh mengikut profil tanaman.</p>}
            <fieldset className="min-w-0"><legend className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Pilih petak ({row.plotIds.length} dipilih)</legend>
              <div className="flex flex-wrap gap-2">
                {plots.map(plot => <label key={plot.id} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)', background: row.plotIds.includes(plot.id) ? 'var(--surface)' : 'transparent', border: '1px solid var(--border)', minHeight: 44 }}>
                  <input type="checkbox" checked={row.plotIds.includes(plot.id)} style={{ accentColor: 'var(--accent-sprout)' }} onChange={e => updateRow(row.id, { plotIds: e.target.checked ? [...row.plotIds, plot.id] : row.plotIds.filter(id => id !== plot.id) })} />{plot.nama}
                </label>)}
                {!plots.length && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tambah petak di menu Petak dahulu.</p>}
              </div>
            </fieldset>
            {dates && <p aria-live="polite" className="text-sm" style={{ color: 'var(--text-secondary)' }}>Semai / tanam: {formatDateMY(dates.tarikhSemai)}{transplant ? ` · Pindah tanam: ${formatDateMY(dates.tarikhTanam)}` : ''} · Anggaran tuaian: <strong style={{ color: 'var(--accent-harvest)' }}>{formatDateMY(dates.tarikhTuaianDijangka)}</strong></p>}
            {rows.length > 1 && <div><SecondaryButton onClick={() => { setRows(current => current.filter(r => r.id !== row.id)); setPreview(null); }}><Trash2 size={14} /> Buang baris {index + 1}</SecondaryButton></div>}
          </fieldset>;
        })}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SecondaryButton onClick={() => { setRows(current => [...current, newRow()]); setPreview(null); }}><Plus size={15} /> Tambah Tanaman / Tarikh</SecondaryButton>
          <PrimaryButton type="submit" disabled={!crops.length || !plots.length}><CalendarDays size={15} /> Semak Jadual</PrimaryButton>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Boleh pilih tarikh lepas, hari ini atau akan datang. Beberapa tanaman boleh berkongsi petak selepas pertindihan disahkan.</p>
      </fieldset>
    </form>}
    {preview && <section className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} aria-label="Pratonton jadual biasa">
      <h3 className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>{preview.errors.length ? 'Semak maklumat jadual' : 'Pratonton Jadual'}</h3>
      {preview.errors.length > 0 ? <ul role="alert" className="list-disc pl-5 text-sm flex flex-col gap-2" style={{ color: 'var(--text-primary)' }}>{preview.errors.map((error, i) => <li key={i}>{error}</li>)}</ul> : <>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{preview.items.length} penanaman · {new Set(preview.items.map(p => p.plotId)).size} petak · satu pusingan bagi setiap baris</p>
        {scheduleTable(preview.items)}
      </>}
      <>{preview.saveError && <p role="alert" className="text-sm" style={{ color: 'var(--accent-clay)' }}>{preview.saveError}</p>}</>
          <OverlapConfirmation warnings={preview.warnings} confirmed={overlapConfirmed} onChange={setOverlapConfirmed} disabled={saving} />
      <div className="flex flex-wrap justify-end gap-2">
        <SecondaryButton onClick={() => { if (!saving) setPreview(null); }}>Kembali ke Borang</SecondaryButton>
        <PrimaryButton disabled={saving || !canSaveSchedule(preview, preview.warnings, overlapConfirmed)} onClick={confirm}><Check size={15} />{saving ? 'Menyimpan…' : 'Sahkan & Simpan Jadual'}</PrimaryButton>
      </div>
    </section>}
    <section className="flex flex-col gap-3" aria-label="Jadual biasa disimpan">
      <h3 className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>Jadual Disimpan</h3>
      {!plans.length && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Belum ada jadual biasa. Jadual yang disimpan turut muncul dalam Papan Pemuka dan Log Operasi.</p>}
      {plans.map(([batchId, items]) => <div key={batchId} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-3 mb-2"><h4 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>{items[0].namaPelan}</h4><ConfirmIconButton onConfirm={() => onDeleteBatch(batchId)} icon={Trash2} title="Padam jadual biasa ini" color="var(--accent-clay)" /></div>
        {scheduleTable(items)}
      </div>)}
    </section>
  </div>;
}

/* ============================================================ */
/* Pengeluaran serentak                                          */
/* ============================================================ */
function formatHarvestWindow(date, days) {
  if (!date || !Number.isInteger(Number(days)) || days < 0 || days > 14) return 'Pilih tarikh dan tetingkap tuaian yang sah';
  try { return `${formatDateMY(addDays(date, -Number(days)))} hingga ${formatDateMY(addDays(date, Number(days)))}`; }
  catch { return 'Pilih tarikh dan tetingkap tuaian yang sah'; }
}

function TargetHarvestGeneratorForm({ crops, plots, onPreview, onChange, disabled }) {
  const [planName, setPlanName] = useState('Pengeluaran Pasaran');
  const [targetDate, setTargetDate] = useState(addDays(todayISO(), 60));
  const [windowDays, setWindowDays] = useState(3);
  const [rows, setRows] = useState(() => [{ id: uid('production-row'), cropId: crops[0]?.id || '', plotIds: [] }]);

  function updateRow(index, patch) {
    setRows(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    onChange();
  }

  function submit(e) {
    e.preventDefault();
    onPreview({ planName: planName.trim(), targetDate, windowDays, rows });
  }

  return (
    <form onSubmit={submit} onChange={onChange} className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="min-w-0 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Nama Pelan">
          <input className={inputClass} style={inputStyle} value={planName} onChange={e => setPlanName(e.target.value)} placeholder="cth: Jualan Pasar Sabtu" required />
        </Field>
        <Field label="Tarikh Pengeluaran" hint="Semua tuaian atau tuaian pertama disasarkan sekitar tarikh ini">
          <input type="date" className={inputClass} style={inputStyle} value={targetDate} onChange={e => setTargetDate(e.target.value)} required />
        </Field>
        <Field label="Tetingkap Tuaian (± hari)">
          <input type="number" min="0" max="14" className={inputClass} style={inputStyle} value={windowDays} onChange={e => setWindowDays(Number(e.target.value))} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base" style={{ color: 'var(--text-primary)' }}>Tanaman dan petak</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pilih petak untuk setiap tanaman. Bilangan petak dikira terus daripada pilihan ini.</p>
          </div>
          <SecondaryButton onClick={() => { setRows(current => [...current, { id: uid('production-row'), cropId: crops[0]?.id || '', plotIds: [] }]); onChange(); }}>
            <Plus size={14} /> Tambah
          </SecondaryButton>
        </div>

        {rows.map((row, index) => {
          const elsewhere = new Set(rows.filter((_, i) => i !== index).flatMap(r => r.plotIds));
          return (
            <fieldset key={row.id} className="flex flex-col gap-3 rounded-lg p-3 min-w-0" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <legend className="px-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Tanaman {index + 1}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <Field label="Tanaman">
                <select className={inputClass} style={inputStyle} value={row.cropId} onChange={e => updateRow(index, { cropId: e.target.value })}>
                  {!crops.length && <option value="">Tambah tanaman dahulu</option>}
                  {crops.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                </select>
              </Field>
              <div aria-live="polite" className="rounded-lg px-3 py-2 text-sm" style={{ minHeight: 38, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-primary)' }} className="font-medium">{row.plotIds.length} petak</span> dipilih
              </div>
              <button type="button" onClick={() => { setRows(current => current.filter((_, i) => i !== index)); onChange(); }} disabled={rows.length === 1} className="rounded-lg p-2 disabled:opacity-25" style={{ minHeight: 44, minWidth: 44, color: 'var(--accent-clay)', border: '1px solid var(--border)' }} aria-label={`Buang tanaman ${index + 1}`}>
                <Trash2 size={15} />
              </button>
              </div>
              <fieldset className="min-w-0">
                <legend className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Pilih satu atau beberapa petak</legend>
                <div className="flex flex-wrap gap-2">
                  {plots.map(plot => {
                    const selected = row.plotIds.includes(plot.id);
                    const inOtherRow = elsewhere.has(plot.id);
                    return <label key={plot.id} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ minHeight: 44, background: selected ? 'var(--surface)' : 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selected} style={{ accentColor: 'var(--accent-sprout)' }} onChange={e => updateRow(index, { plotIds: e.target.checked ? [...row.plotIds, plot.id] : row.plotIds.filter(id => id !== plot.id) })} />
                      {plot.nama}{inOtherRow ? ' (dikongsi)' : ''}
                    </label>;
                  })}
                </div>
                {!plots.length && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tambah petak di menu Petak dahulu.</p>}
              </fieldset>
            </fieldset>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: hexToRgba('#E0A845', 0.08), border: '1px solid var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Tetingkap hasil: <strong style={{ color: 'var(--accent-harvest)' }}>{formatHarvestWindow(targetDate, windowDays)}</strong>
        </span>
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Jumlah: {new Set(rows.flatMap(row => row.plotIds)).size} petak</span>
        <PrimaryButton type="submit" disabled={!crops.length || !plots.length}><CalendarDays size={15} /> Jana Pratonton</PrimaryButton>
      </div>
      </fieldset>
    </form>
  );
}

function TargetHarvestView({ crops, plots, plantings, onCommitBatch, onDeleteBatch, notify }) {
  const [showForm, setShowForm] = useState(true);
  const [preview, setPreview] = useState(null);
  const [overlapConfirmed, setOverlapConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);
  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);
  const plotMap = useMemo(() => Object.fromEntries(plots.map(p => [p.id, p])), [plots]);

  function handlePreview(params) {
    const result = buildTargetHarvestSchedule({ crops, plots, plantings, ...params });
    setOverlapConfirmed(false);
    setPreview({ ...result, ...params });
  }

  async function handleConfirm() {
    if (savingRef.current || !preview || preview.errors.length > 0 || preview.items.length === 0) return;
    // Revalidate against current data, but keep the preview's batch and item ids so a retry
    // after an unconfirmed save cannot add a second copy of this plan.
    const fresh = buildTargetHarvestSchedule({ crops, plots, plantings, rows: preview.rows, targetDate: preview.targetDate, windowDays: preview.windowDays, planName: preview.planName }, preview.batchId);
    const result = { ...preview, ...fresh, batchId: preview.batchId, items: preview.items };
    setPreview({ ...result, saveError: undefined });
    if (!canSaveSchedule(result, preview.warnings, overlapConfirmed)) { setOverlapConfirmed(false); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await onCommitBatch(result.items.map(item => ({ ...item, pertindihanDisahkan: result.warnings.length > 0 && overlapConfirmed })), { warnings: result.warnings, confirmed: overlapConfirmed, crops });
      if (!saved.ok) {
        setOverlapConfirmed(false);
        setPreview({ ...result, saveError: saved.error });
        return;
      }
      notify(`Pelan "${preview.planName}" disimpan: ${result.items.length} penanaman dalam ${new Set(result.items.map(item => item.plotId)).size} petak.`);
      setPreview(null);
      setShowForm(false);
    } finally { savingRef.current = false; setSaving(false); }
  }

  const productionPlans = useMemo(() => {
    const grouped = {};
    plantings.filter(p => p.planJenis === 'pengeluaran' && p.batchId).forEach(p => {
      if (!grouped[p.batchId]) grouped[p.batchId] = [];
      grouped[p.batchId].push(p);
    });
    return Object.entries(grouped).map(([batchId, items]) => ({
      batchId,
      name: items[0].namaPelan || 'Pelan Pengeluaran',
      targetDate: items[0].tarikhSasaran || items[0].tarikhTuaianDijangka,
      windowDays: items[0].tetingkapHari ?? 3,
      items,
      crops: [...new Set(items.map(item => cropMap[item.cropId]?.nama || '-'))],
    })).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  }, [plantings, cropMap]);

  const previewStart = preview?.items.length
    ? preview.items.reduce((min, item) => (item.tarikhTanam < min ? item.tarikhTanam : min), preview.items[0].tarikhTanam)
    : todayISO();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Pengeluaran Serentak</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pilih tarikh tuaian bersama dan petak untuk setiap tanaman. Tarikh semai dan tanam dikira secara automatik.</p>
        </div>
        <SecondaryButton onClick={() => { if (!saving) { setShowForm(value => !value); setPreview(null); } }}>
          {showForm ? <><X size={15} /> Tutup Borang</> : <><Plus size={15} /> Rancang Pengeluaran</>}
        </SecondaryButton>
      </div>

      {showForm && (
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <TargetHarvestGeneratorForm crops={crops} plots={plots} onPreview={handlePreview} onChange={() => setPreview(null)} disabled={saving} />
        </div>
      )}

      {preview && (
        <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: hexToRgba('#E0A845', 0.07), border: `1px solid ${preview.errors.length ? 'var(--accent-clay)' : 'var(--accent-harvest)'}` }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>{preview.planName}</h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Tetingkap tuaian: {formatHarvestWindow(preview.targetDate, preview.windowDays)}
              </p>
            </div>
            <Badge color={preview.errors.length ? '#C1623D' : preview.warnings.length && !overlapConfirmed ? '#E0A845' : '#8FBC5A'}>{preview.errors.length ? 'Perlu tindakan' : preview.warnings.length && !overlapConfirmed ? 'Sahkan pertindihan' : 'Sedia disimpan'}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {preview.summaries.map((summary, index) => (
              <div key={`${summary.crop.id}-${index}`} className="rounded-lg p-3" style={{ background: 'var(--surface)', border: `1px solid ${summary.conflict ? 'var(--accent-clay)' : 'var(--border)'}` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{summary.crop.nama}</span>
                  <span className="text-sm" style={{ color: summary.conflict ? 'var(--accent-clay)' : 'var(--accent-sprout)' }}>{summary.plotsNeeded} petak dipilih</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--text-primary)' }}>{summary.selectedPlots.map(plot => plot.nama).join(', ') || 'Belum pilih petak'}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>Semai <strong style={{ color: 'var(--text-primary)' }}>{formatShortMY(summary.sowDate)}</strong></span>
                  <span>{summary.crop.kaedahTanam === 'pindah' ? 'Pindah' : 'Tanam'} <strong style={{ color: 'var(--text-primary)' }}>{formatShortMY(summary.fieldDate)}</strong></span>
                  <span>Tuaian <strong style={{ color: 'var(--accent-harvest)' }}>{formatShortMY(preview.targetDate)}</strong></span>
                  <span>Tamat guna petak <strong style={{ color: 'var(--text-primary)' }}>{formatShortMY(summary.releaseDate)}</strong></span>
                </div>
                {summary.crop.jenisTuaian === 'berkali' && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>Tarikh sasaran ialah tuaian pertama. Petak ditempah hingga {formatDateMY(summary.releaseDate)}.</p>}
              </div>
            ))}
          </div>

          {preview.errors.length > 0 && (
            <div role="alert" className="rounded-lg p-3 flex flex-col gap-1" style={{ background: hexToRgba('#C1623D', 0.1), border: '1px solid var(--accent-clay)' }}>
              {preview.errors.map((error, index) => <p key={index} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-primary)' }}><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}</p>)}
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Semak pilihan tanaman, petak dan tarikh sebelum menyimpan.</p>
            </div>
          )}

          <>{preview.saveError && <p role="alert" className="text-sm" style={{ color: 'var(--accent-clay)' }}>{preview.saveError}</p>}</>
          <OverlapConfirmation warnings={preview.warnings} confirmed={overlapConfirmed} onChange={setOverlapConfirmed} disabled={saving} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => { if (!saving) setPreview(null); }}>Batal</SecondaryButton>
            <PrimaryButton onClick={handleConfirm} disabled={saving || !canSaveSchedule(preview, preview.warnings, overlapConfirmed)}><Check size={15} /> {saving ? 'Menyimpan…' : 'Sahkan & Simpan'}</PrimaryButton>
          </div>
        </div>
      )}

      {preview?.items.length > 0 && preview.errors.length === 0 && (
        <ConveyorTimeline plots={plots} plantings={preview.items} crops={crops} rangeStart={previewStart} rangeDays={Math.max(90, diffDays(previewStart, addDays(preview.targetDate, preview.windowDays)) + 14)} />
      )}

      {productionPlans.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-base" style={{ color: 'var(--text-primary)' }}>Pelan Pengeluaran Disimpan</h3>
          {productionPlans.map(plan => (
            <div key={plan.batchId} className="rounded-lg px-3 py-3 flex flex-wrap items-center justify-between gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{plan.name}</span>
                  <Badge color="#E0A845">{formatShortMY(plan.targetDate)}</Badge>
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{plan.crops.join(' • ')} • {new Set(plan.items.map(item => item.plotId)).size} petak</p>
                {[...new Set(plan.items.map(item => item.cropId))].map(cropId => <p key={cropId} className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{cropMap[cropId]?.nama || 'Tanaman dipadam'}: {plan.items.filter(item => item.cropId === cropId).map(item => plotMap[item.plotId]?.nama || 'Petak dipadam').join(', ')}</p>)}
              </div>
              <ConfirmIconButton onConfirm={() => onDeleteBatch(plan.batchId)} icon={Trash2} title="Padam pelan pengeluaran ini" color="var(--accent-clay)" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/* Jadual Conveyor                                                */
/* ============================================================ */
function ConveyorGeneratorForm({ crops, plots, plantings, onPreview, onChange, disabled }) {
  const today = todayISO();
  const [cropId, setCropId] = useState(crops[0]?.id || '');
  const [mode, setMode] = useState('auto');
  const [autoCount, setAutoCount] = useState(4);
  const [manualSelected, setManualSelected] = useState([]);
  const [startDate, setStartDate] = useState(today);
  const [interval, setIntervalDays] = useState(7);
  const [rest, setRest] = useState(3);
  const [horizon, setHorizon] = useState(90);

  const plotInfoMap = useMemo(() => {
    const m = {};
    plots.forEach(p => { m[p.id] = getPlotInfo(p.id, plantings, today); });
    return m;
  }, [plots, plantings, today]);

  const emptyPlots = useMemo(() => plots.filter(p => plotInfoMap[p.id].status === 'kosong'), [plots, plotInfoMap]);

  function toggleManual(id) {
    setManualSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));
    onChange();
  }

  function handleSubmit(e) {
    e.preventDefault();
    const chosenIds = mode === 'auto' ? emptyPlots.slice(0, autoCount).map(p => p.id) : manualSelected;
    if (!cropId || chosenIds.length === 0) return;
    onPreview({ cropId, plotIds: chosenIds, startDate, interval, rest, horizon });
  }

  return (
    <form onSubmit={handleSubmit} onChange={onChange} className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="min-w-0 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tanaman">
          <select className={inputClass} style={inputStyle} value={cropId} onChange={e => setCropId(e.target.value)}>
            {crops.map(c => <option key={c.id} value={c.id}>{c.nama} ({c.tempohTuaian} hari)</option>)}
          </select>
        </Field>
        <Field label="Tarikh Mula Tanam di Petak" hint="Tarikh pindah tanam bagi tanaman semaian; tarikh semai dikira lebih awal.">
          <input type="date" className={inputClass} style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} required />
        </Field>
        <Field label="Jarak Tanam Antara Petak (hari)" hint="Jarak penanaman antara satu petak dengan petak seterusnya untuk aliran conveyor">
          <input type="number" min="1" className={inputClass} style={inputStyle} value={interval} onChange={e => setIntervalDays(Number(e.target.value))} />
        </Field>
        <Field label="Tempoh Rehat Petak (hari)" hint="Jarak selepas tamat semua tuaian sebelum tanam semula di petak sama">
          <input type="number" min="0" className={inputClass} style={inputStyle} value={rest} onChange={e => setRest(Number(e.target.value))} />
        </Field>
        <Field label="Tempoh Perancangan (hari)" hint="Lalai 90 hari (3 bulan)">
          <input type="number" min="30" max="180" className={inputClass} style={inputStyle} value={horizon} onChange={e => setHorizon(Number(e.target.value))} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Pilihan Petak:</span>
          <button type="button" onClick={() => { setMode('auto'); onChange(); }} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: mode === 'auto' ? 'var(--accent-sprout)' : 'transparent', color: mode === 'auto' ? '#1C2118' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>Auto Pilih Kosong</button>
          <button type="button" onClick={() => { setMode('manual'); onChange(); }} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: mode === 'manual' ? 'var(--accent-sprout)' : 'transparent', color: mode === 'manual' ? '#1C2118' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>Pilih Sendiri</button>
        </div>

        {mode === 'auto' ? (
          <Field label={`Bilangan Petak (tersedia ${emptyPlots.length} kosong)`}>
            <input type="number" min="1" max={Math.max(emptyPlots.length, 1)} className={inputClass} style={{ ...inputStyle, maxWidth: 160 }} value={autoCount} onChange={e => setAutoCount(Number(e.target.value))} />
          </Field>
        ) : (
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg" style={{ border: '1px solid var(--border)', maxHeight: 160, overflowY: 'auto' }}>
            {plots.map(p => {
              const info = plotInfoMap[p.id];
              const selected = manualSelected.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleManual(p.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: selected ? 'var(--accent-sprout)' : hexToRgba(PLOT_STATUS_META[info.status].color, 0.15),
                    color: selected ? '#1C2118' : PLOT_STATUS_META[info.status].color,
                    border: `1px solid ${selected ? 'var(--accent-sprout)' : PLOT_STATUS_META[info.status].color}`,
                  }}
                >
                  {p.nama}{info.status !== 'kosong' ? ' •' : ''}
                </button>
              );
            })}
          </div>
        )}
        {mode === 'auto' && emptyPlots.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--accent-clay)' }}>Tiada petak kosong tersedia. Cuba pilih sendiri atau tambah petak baharu.</p>
        )}
      </div>

      <div className="flex justify-end">
        <PrimaryButton type="submit"><Repeat size={15} /> Jana Pratonton Jadual</PrimaryButton>
      </div>
      </fieldset>
    </form>
  );
}

function ConveyorView({ crops, plots, plantings, onCommitBatch, onDeleteBatch, notify, onOpenLog }) {
  const [showForm, setShowForm] = useState(plantings.length === 0);
  const [preview, setPreview] = useState(null);
  const [overlapConfirmed, setOverlapConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);
  const today = todayISO();

  function handlePreview(params) {
    const crop = crops.find(c => c.id === params.cropId);
    if (!crop) return;
    const { batchId, items, errors } = buildConveyorSchedule({ crop, plotIds: params.plotIds, startDate: params.startDate, interval: params.interval, rest: params.rest, horizon: params.horizon });
    setOverlapConfirmed(false);
    setPreview({ batchId, items, crop, params, errors, warnings: findScheduleOverlaps({ items, plantings, crops, plots }) });
  }

  async function handleConfirm() {
    if (!preview || savingRef.current) return;
    const currentCrop = crops.find(c => c.id === preview.params.cropId);
    if (JSON.stringify(currentCrop) !== JSON.stringify(preview.crop)) {
      handlePreview(preview.params);
      return;
    }
    const result = { ...preview, errors: [], warnings: findScheduleOverlaps({ items: preview.items, plantings, crops, plots }) };
    setPreview(result);
    if (!canSaveSchedule(result, preview.warnings, overlapConfirmed)) { setOverlapConfirmed(false); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await onCommitBatch(result.items.map(item => ({ ...item, pertindihanDisahkan: result.warnings.length > 0 && overlapConfirmed })), { warnings: result.warnings, confirmed: overlapConfirmed, crops });
      if (!saved.ok) {
        setOverlapConfirmed(false);
        setPreview({ ...result, saveError: saved.error });
        return;
      }
      notify(`Jadual conveyor untuk ${preview.crop.nama} berjaya dijana: ${preview.items.length} penanaman.`);
      setPreview(null);
      setShowForm(false);
    } finally { savingRef.current = false; setSaving(false); }
  }

  const batches = useMemo(() => {
    const map = {};
    plantings.forEach(p => {
      if (!p.batchId || p.planJenis === 'pengeluaran' || p.planJenis === 'biasa') return;
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
        <SecondaryButton onClick={() => { if (!saving) { setShowForm(s => !s); setPreview(null); } }}>
          {showForm ? <><X size={15} /> Tutup Borang</> : <><Plus size={15} /> Jana Jadual Baharu</>}
        </SecondaryButton>
      </div>

      {showForm && (
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <ConveyorGeneratorForm crops={crops} plots={plots} plantings={plantings} onPreview={handlePreview} onChange={() => setPreview(null)} disabled={saving} />
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
          {preview.items.length > 0 && <div className="overflow-auto max-h-72">
            <table className="w-full text-sm text-left" style={{ color: 'var(--text-primary)' }}>
              <thead><tr>{['Petak', 'Kitaran', 'Semai', 'Tanam di petak', 'Tuaian pertama', 'Tamat tuaian'].map(label => <th scope="col" key={label} className="px-3 py-2 whitespace-nowrap">{label}</th>)}</tr></thead>
              <tbody>{preview.items.map(item => <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-2 whitespace-nowrap">{plots.find(p => p.id === item.plotId)?.nama || 'Petak dipadam'}</td>
                <td className="px-3 py-2">{item.kitaran}</td>
                {[item.tarikhSemai, item.tarikhTanam, item.tarikhTuaianDijangka, item.tarikhTamatDijangka].map((date, i) => <td key={i} className="px-3 py-2 whitespace-nowrap">{formatDateMY(date)}</td>)}
              </tr>)}</tbody>
            </table>
          </div>}
          {preview.errors.map((error, i) => <p key={i} role="alert" className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</p>)}
          <>{preview.saveError && <p role="alert" className="text-sm" style={{ color: 'var(--accent-clay)' }}>{preview.saveError}</p>}</>
          <OverlapConfirmation warnings={preview.warnings} confirmed={overlapConfirmed} onChange={setOverlapConfirmed} disabled={saving} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => { if (!saving) setPreview(null); }}>Batal</SecondaryButton>
            <PrimaryButton onClick={handleConfirm} disabled={saving || !canSaveSchedule(preview, preview.warnings, overlapConfirmed)}><Check size={15} /> {saving ? 'Menyimpan…' : 'Sahkan & Simpan Jadual'}</PrimaryButton>
          </div>
        </div>
      )}

      <ConveyorTimeline plots={plots} plantings={plantings} crops={crops} rangeStart={today} rangeDays={90} onOpenLog={onOpenLog} />

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
  const original = React.useRef(planting);
  const savingRef = React.useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const rekod = planting.rekod || {};
  const [benih, setBenih] = useState(rekod.benihDigunakan ?? crop?.kadarBenihSepetak ?? 0);
  const [baja, setBaja] = useState(rekod.bajaDigunakan ?? crop?.kadarBajaSepetak ?? 0);
  const [air, setAir] = useState(rekod.airDigunakan ?? (crop ? crop.kadarAirSepetakHari * (crop.tempohTuaian + (crop.jenisTuaian === 'berkali' ? Number(crop.tempohProduktif || 0) : 0)) : 0));
  const [kos, setKos] = useState(rekod.kosSebenar ?? (crop ? +(crop.kadarBenihSepetak * crop.kosBenihSeunit + crop.kadarBajaSepetak * crop.kosBajaSeunit).toFixed(2) : 0));
  const [tarikhTuai, setTarikhTuai] = useState(rekod.tarikhTuaianSebenar || '');
  const [hasil, setHasil] = useState(rekod.hasilSebenar ?? '');
  const [hargaJual, setHargaJual] = useState(rekod.hargaJualSebenar ?? crop?.hargaJualSeunit ?? '');
  const [catatan, setCatatan] = useState(rekod.catatan || '');

  async function submit(e) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
    const result = await onSave({
      benihDigunakan: Number(benih) || 0,
      bajaDigunakan: Number(baja) || 0,
      airDigunakan: Number(air) || 0,
      kosSebenar: Number(kos) || 0,
      tarikhTuaianSebenar: tarikhTuai || null,
      hasilSebenar: hasil === '' ? null : Number(hasil),
      hargaJualSebenar: hargaJual === '' ? null : Number(hargaJual),
      catatan,
    }, original.current);
    if (!result.ok) setSaveError(result.error);
    } finally { savingRef.current = false; setSaving(false); }
  }

  return (
    <Modal title={`Log: ${crop?.nama || '-'} • ${plot?.nama || '-'}`} onClose={() => { if (!savingRef.current) onClose(); }} wide>
      <form onSubmit={submit}><fieldset disabled={saving} className="flex flex-col gap-4">
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
          Ditanam {formatDateMY(planting.tarikhTanam)} • {crop?.jenisTuaian === 'berkali' ? 'Tuaian pertama' : 'Dijangka tuai'} {formatDateMY(planting.tarikhTuaianDijangka)}
          {planting.tarikhTamatDijangka && crop?.jenisTuaian === 'berkali' ? ` • Tamat musim ${formatDateMY(planting.tarikhTamatDijangka)}` : ''}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Benih Digunakan (kg)"><input type="number" min="0" step="0.001" className={inputClass} style={inputStyle} value={benih} onChange={e => setBenih(e.target.value)} /></Field>
          <Field label="Baja Digunakan (kg)"><input type="number" min="0" step="0.01" className={inputClass} style={inputStyle} value={baja} onChange={e => setBaja(e.target.value)} /></Field>
          <Field label="Air Digunakan (liter, keseluruhan kitaran)"><input type="number" min="0" step="1" className={inputClass} style={inputStyle} value={air} onChange={e => setAir(e.target.value)} /></Field>
          <Field label="Kos Sebenar (RM)"><input type="number" min="0" step="0.01" className={inputClass} style={inputStyle} value={kos} onChange={e => setKos(e.target.value)} /></Field>
        </div>
        <div style={{ height: 1, background: 'var(--border)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Rekod Tuaian</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={crop?.jenisTuaian === 'berkali' ? 'Tarikh Tamat Musim' : 'Tarikh Tuai Sebenar'}>
            <input type="date" className={inputClass} style={inputStyle} value={tarikhTuai} onChange={e => setTarikhTuai(e.target.value)} />
          </Field>
          <Field label={crop?.jenisTuaian === 'berkali' ? 'Jumlah Hasil Musim (kg)' : 'Hasil Tuaian (kg)'}>
            <input type="number" min="0" step="0.1" className={inputClass} style={inputStyle} value={hasil} onChange={e => setHasil(e.target.value)} placeholder={`anggaran ${crop?.anggaranHasilSepetak ?? '-'}`} />
          </Field>
          <Field label="Harga Jual (RM/kg)">
            <input type="number" min="0" step="0.1" className={inputClass} style={inputStyle} value={hargaJual} onChange={e => setHargaJual(e.target.value)} />
          </Field>
        </div>
        <Field label="Catatan">
          <textarea className={inputClass} style={{ ...inputStyle, minHeight: 70 }} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="cth: serangan perosak, cuaca, dsb." />
        </Field>
        <div className="flex justify-end gap-2">
          <>{saveError && <p role="alert" className="text-sm" style={{ color: 'var(--accent-clay)' }}>{saveError}</p>}</>
          <SecondaryButton onClick={onClose}>Batal</SecondaryButton>
          <PrimaryButton type="submit" disabled={saving}><Check size={15} /> {saving ? 'Menyimpan…' : 'Simpan Rekod'}</PrimaryButton>
        </div>
      </fieldset></form>
    </Modal>
  );
}

function LogView({ crops, plots, plantings, onUpdateRecord, onDeletePlanting, initialFocus = null }) {
  const today = todayISO();
  // Isyarat dari Papan Pemuka atau rail masa dibaca sekali, masa komponen ini dipasang
  // (App beri `key` baharu setiap kali isyarat berubah, jadi mount bermakna pandangan baharu).
  // Menetapkan state dari prop semasa mount elak keperluan untuk efek yang menulis state.
  const [editingId, setEditingId] = useState(() => initialFocus?.id || null);
  const [filter, setFilter] = useState(() => {
    if (initialFocus?.filter) return initialFocus.filter;
    const target = initialFocus?.id ? plantings.find(p => p.id === initialFocus.id) : null;
    return target && getPlantingStatus(target, today) === 'dituai' ? 'semua' : 'aktif';
  });

  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);
  const plotMap = useMemo(() => Object.fromEntries(plots.map(p => [p.id, p])), [plots]);

  const list = useMemo(() => {
    return plantings
      .map(p => ({ ...p, status: getPlantingStatus(p, today) }))
      .filter(p => {
        if (filter === 'semua') return true;
        if (filter === 'dituai') return p.status === 'dituai';
        return p.status !== 'dituai';
      })
      .sort((a, b) => (a.tarikhTuaianDijangka < b.tarikhTuaianDijangka ? -1 : 1));
  }, [plantings, today, filter]);

  const editingPlanting = editingId ? plantings.find(p => p.id === editingId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Log Operasi</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Catat penggunaan benih, baja, air dan hasil tuaian sebenar bagi setiap penanaman.</p>
        </div>
        <div className="flex gap-1.5">
          {[['aktif', 'Aktif'], ['dituai', 'Sudah Dituai'], ['semua', 'Semua']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: filter === key ? 'var(--accent-sprout)' : 'transparent', color: filter === key ? '#1C2118' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>{label}</button>
          ))}
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
                    <span style={{ color: 'var(--text-secondary)' }}> • {plot?.nama || '-'} • tuai {formatDateMY(p.tarikhTuaianDijangka)}</span>
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
          onSave={async (rekod, expected) => { const result = await onUpdateRecord(editingPlanting.id, rekod, expected); if (result.ok) setEditingId(null); return result; }}
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
function DashboardView({ crops, plots, plantings, onOpenLog, onOpenLogAll }) {
  const today = todayISO();
  const cropMap = useMemo(() => Object.fromEntries(crops.map(c => [c.id, c])), [crops]);
  const plotMap = useMemo(() => Object.fromEntries(plots.map(p => [p.id, p])), [plots]);

  const withStatus = useMemo(() => plantings.map(p => ({ ...p, status: getPlantingStatus(p, today) })), [plantings, today]);

  const aktifCount = plots.filter(plot => getPlotInfo(plot.id, plantings, today).status === 'aktif').length;
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
        <button
          type="button"
          onClick={() => onOpenLogAll?.()}
          className="row-link rounded-xl p-3 flex w-full items-center gap-3 text-left"
          style={{ background: hexToRgba('#C1623D', 0.1), border: '1px solid var(--accent-clay)', cursor: 'pointer' }}
          aria-label="Buka Log Operasi untuk semua penanaman"
        >
          <AlertTriangle size={18} style={{ color: 'var(--accent-clay)', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{lewatList.length} penanaman sudah lewat dituai. Semak di Log Operasi.</p>
          <ChevronRight size={16} style={{ color: 'var(--accent-clay)', marginLeft: 'auto', flexShrink: 0 }} />
        </button>
      )}

      <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-display text-base mb-3" style={{ color: 'var(--text-primary)' }}>Tuaian 7 Hari Akan Datang</h3>
        {upcoming7.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tiada tuaian dijangka dalam 7 hari ini.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming7.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenLog?.(p.id)}
                className="row-link flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                title="Buka log penanaman ini"
                aria-label={`Buka log ${cropMap[p.cropId]?.nama || 'tanaman'} di ${plotMap[p.plotId]?.nama || 'petak'}`}
              >
                <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  {cropMap[p.cropId]?.nama} • {plotMap[p.plotId]?.nama}
                  <ChevronRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                </span>
                <Badge color={STATUS_META[p.status].color}>{formatDateMY(p.tarikhTuaianDijangka)}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <ConveyorTimeline plots={plots} plantings={plantings} crops={crops} rangeStart={today} rangeDays={90} onOpenLog={onOpenLog} />
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
/* Pemulihan dari fail                                             */
/* ============================================================ */
function countLine(counts) {
  return `${counts.crops} tanaman, ${counts.plots} petak, ${counts.plantings} penanaman (${counts.logged} ada rekod)`;
}
function RestoreModal({ current, onBackup, onRestore, onClose }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = React.useRef(false);

  async function pick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setBackedUp(false); setConfirmed(false); setPreview(null);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Fail itu melebihi 8 MB. Semak fail yang betul.');
      setPreview({ ...parseRestoreFile(await file.text()), fileName: file.name });
    } catch (parseError) { setError(parseError.message); }
  }
  async function backup() {
    if (await onBackup()) setBackedUp(true);
  }
  async function submit() {
    if (!preview || !backedUp || !confirmed || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await onRestore(preview.data);
      if (!result.ok) { setConfirmed(false); setError(result.error); return; }
      onClose();
    } finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <Modal title="Pulihkan Dari Fail" onClose={() => { if (!busy) onClose(); }} wide>
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Pilih fail sandaran yang dimuat turun dari app ini. Pemulihan <strong style={{ color: 'var(--text-primary)' }}>menggantikan seluruh data kebun</strong> dengan isi fail itu.
        </p>
        <Field label="Fail sandaran (.json)">
          <input type="file" accept="application/json,.json" disabled={busy} onChange={pick} className={inputClass} style={inputStyle} />
        </Field>
        {error && <p role="alert" className="text-sm" style={{ color: 'var(--accent-clay)' }}>{error}</p>}
        {preview && <>
          <div className="rounded-lg px-3 py-2 text-sm flex flex-col gap-1" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <span>Dalam fail <strong>{preview.fileName}</strong> ({preview.source}): {countLine(preview.counts)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>Data sekarang: {countLine(current)}</span>
          </div>
          {preview.flagged.length > 0 && <p role="status" className="text-sm" style={{ color: 'var(--accent-harvest)' }}>
            {preview.flagged.length} rekod lama menyalahi peraturan baharu, contoh {preview.flagged[0]}. Semua masih akan dipulihkan; betulkan melalui menu Log bila sempat.
          </p>}
          <SecondaryButton onClick={backup} disabled={busy}>{backedUp ? 'Sandaran semasa sudah dimuat turun' : 'Muat Turun Sandaran Semasa Dahulu'}</SecondaryButton>
          <label className="flex gap-2.5 items-start text-sm" style={{ color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={confirmed} disabled={busy || !backedUp} onChange={e => setConfirmed(e.target.checked)} />
            <span>Gantikan data kebun sekarang dengan isi fail ini.</span>
          </label>
        </>}
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={busy}>Batal</SecondaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={busy || !preview || !backedUp || !confirmed}>{busy ? 'Memulihkan…' : 'Pulihkan Data'}</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================ */
/* App                                                             */
/* ============================================================ */
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Papan Pemuka', icon: LayoutDashboard },
  { key: 'basic', label: 'Jadual Biasa', mobileLabel: 'Biasa', icon: CalendarDays },
  { key: 'production', label: 'Pengeluaran Serentak', icon: CalendarDays },
  { key: 'conveyor', label: 'Jadual Conveyor', icon: Repeat },
  { key: 'crops', label: 'Tanaman', icon: Sprout },
  { key: 'plots', label: 'Petak', icon: LayoutGrid },
  { key: 'log', label: 'Log Operasi', icon: ClipboardList },
  { key: 'reports', label: 'Laporan', icon: BarChart3 },
];

export function initialFarmData() {
  return { crops: DEFAULT_CROPS.map(normalizeCrop), plots: generateDefaultPlots(24), plantings: [] };
}

export default function App({ remoteStore = null, onSignOut }) {
  const [loading, setLoading] = useState(true);
  const [crops, setCrops] = useState([]);
  const [plots, setPlots] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [tab, setTab] = useState('dashboard');
  // Isyarat "buka log ini" dari Papan Pemuka / rail masa. { id } untuk satu penanaman,
  // { filter } untuk buka Log Operasi dengan tapisan tertentu. `logKey` memaksa LogView
  // dipasang semula setiap kali isyarat berubah, walaupun id penanamannya sama.
  const [logFocus, setLogFocus] = useState(null);
  const [logKey, setLogKey] = useState(0);
  const [notice, setNotice] = useState(null);

  const [loadError, setLoadError] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const storeRef = React.useRef(null);
  const revisionRef = React.useRef(-1);
  function applySaved(saved) {
    if (saved.revision < revisionRef.current) return;
    revisionRef.current = saved.revision;
    setCrops(saved.data.crops); setPlots(saved.data.plots); setPlantings(saved.data.plantings);
    if (remoteStore) { setLastSync(new Date()); setSyncError(''); }
  }
  useEffect(() => {
    let cancelled = false;
    let store;
    async function load() {
      try {
        store = remoteStore || createFarmStore({ storage: window.localStorage, locks: navigator.locks, defaults: initialFarmData });
        storeRef.current = store;
        const saved = await store.initialize();
        if (!saved) throw new Error('Data kebun belum tersedia. Muat semula halaman.');
        if (!cancelled) { applySaved(saved); setLoadError(''); }
      } catch (error) { if (!cancelled) setLoadError(error.message); }
      finally { if (!cancelled) setLoading(false); }
    }
    let syncing = false;
    async function sync(event) {
      if (event?.type === 'storage' && event.key !== null && event.key !== STORE_KEY && !LEGACY_KEYS.includes(event.key)) return;
      if (!store || cancelled || syncing || (remoteStore && document.hidden)) return;
      syncing = true;
      try { const saved = await store.read(); if (saved && !cancelled) { applySaved(saved); setLoadError(''); } }
      catch (error) { if (!cancelled) { if (remoteStore) setSyncError(error.message); else setLoadError(error.message); } }
      finally { syncing = false; }
    }
    load();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);
    const interval = remoteStore ? setInterval(sync, 30000) : null;
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('storage', sync); window.removeEventListener('focus', sync); window.removeEventListener('online', sync); };
  }, [remoteStore]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  function notify(msg) { setNotice(msg); setWriteError(''); }
  function openLogFor(plantingId) { setLogFocus({ id: plantingId }); setLogKey(k => k + 1); setTab('log'); }
  function openLogAll() { setLogFocus({ filter: 'semua' }); setLogKey(k => k + 1); setTab('log'); }
  // Bila pengguna tekan menu sendiri, isyarat lama dibuang supaya Log Operasi dibuka bersih.
  function selectTab(key) {
    if (key !== 'log') { setLogFocus(null); setLogKey(k => k + 1); }
    setTab(key);
  }
  async function commit(change, message, options) {
    try {
      if (!storeRef.current) throw new Error('Simpanan belum tersedia. Muat semula halaman.');
      const saved = await storeRef.current.transact(change, options);
      applySaved(saved); setWriteError('');
      if (message) notify(message);
      return { ok: true };
    } catch (error) {
      setNotice(null); setWriteError(error.message);
      try { const saved = await storeRef.current.read(); if (saved) applySaved(saved); } catch { /* Preserve the current view and entered form. */ }
      return { ok: false, error: error.message };
    }
  }
  function handleSaveCrop(data, expected) {
    return commit(farm => {
      if (expected) return replaceRecord(farm, 'crops', data.id, expected, () => data);
      if (farm.crops.some(c => c.id === data.id)) throw new Error('Tanaman ini sudah disimpan.');
      return { ...farm, crops: [...farm.crops, data] };
    }, `Tanaman "${data.nama}" disimpan.`);
  }
  function handleDeleteCrop(id) {
    const expected = crops.find(c => c.id === id);
    return commit(farm => {
      assertUnchanged(farm.crops.find(c => c.id === id), expected);
      if (farm.plantings.some(p => p.cropId === id)) throw new Error('Tanaman ini masih digunakan dalam jadual.');
      return { ...farm, crops: farm.crops.filter(c => c.id !== id) };
    }, 'Tanaman dipadam.');
  }
  function handleAddPlots(count) {
    const n = Math.max(1, Math.min(200, Math.floor(Number(count) || 1)));
    return commit(farm => {
      const nums = farm.plots.map(p => Number(p.nama.match(/(\d+)$/)?.[1] || 0));
      let nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
      return { ...farm, plots: [...farm.plots, ...Array.from({ length: n }, () => ({ id: uid('plot'), nama: `Petak ${nextNum++}` }))] };
    }, `${n} petak baharu ditambah.`);
  }
  function handleRenamePlot(id, nama, expected) {
    return commit(farm => replaceRecord(farm, 'plots', id, expected, p => ({ ...p, nama })), 'Nama petak disimpan.');
  }
  function handleDeletePlot(id) {
    const expected = plots.find(p => p.id === id);
    return commit(farm => {
      assertUnchanged(farm.plots.find(p => p.id === id), expected);
      if (farm.plantings.some(p => p.plotId === id)) throw new Error('Petak ini masih mempunyai rekod penanaman.');
      return { ...farm, plots: farm.plots.filter(p => p.id !== id) };
    }, 'Petak dipadam.');
  }
  function handleSaveBatch(items, approval) { return commit(farm => appendSchedule(farm, items, approval), null, { approval }); }
  function handleDeleteBatch(batchId) {
    const expected = plantings.filter(p => p.batchId === batchId);
    return commit(farm => {
      assertUnchanged(farm.plantings.filter(p => p.batchId === batchId), expected);
      return deleteRecords(farm, expected.map(p => p.id), expected);
    }, 'Kumpulan jadual dipadam.');
  }
  function handleUpdateRecord(id, rekod, expected) {
    return commit(farm => replaceRecord(farm, 'plantings', id, expected, p => ({ ...p, rekod: { ...p.rekod, ...rekod } })), 'Rekod disimpan.');
  }
  function handleDeletePlanting(id) {
    const expected = plantings.filter(p => p.id === id);
    return commit(farm => deleteRecords(farm, [id], expected), 'Penanaman dipadam.');
  }
  function handleResetAll() {
    const expected = { crops, plots, plantings };
    return commit(farm => {
      assertUnchanged(farm, expected);
      return { crops: DEFAULT_CROPS.map(normalizeCrop), plots: generateDefaultPlots(24), plantings: [] };
    }, 'Semua data telah ditetapkan semula.');
  }
  async function downloadRecovery() {
    try {
      const raw = await storeRef.current.recovery();
      const url = URL.createObjectURL(new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'ladang-alir-pemulihan.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      setWriteError(remoteStore ? 'Sandaran tidak dapat dimuat turun. Semak sambungan dan cuba lagi.' : 'Salinan tidak dapat dibaca. Benarkan akses simpanan pelayar dahulu; data tidak diubah.');
      return false;
    }
  }
  // The file is the whole document, so this replaces everything on purpose. The store still
  // enforces the current revision, so a stale file cannot overwrite newer work.
  function handleRestoreFile(data) {
    return commit(() => structuredClone(data), 'Data kebun dipulihkan daripada fail.', { kind: 'restore' });
  }

  const canDeletePlotIds = useMemo(() => new Set(plots.filter(pl => !plantings.some(p => p.plotId === pl.id)).map(p => p.id)), [plots, plantings]);

  if (loadError) return <div style={{ ...ROOT_VARS, background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh' }} className="font-body p-6">
    <style>{GLOBAL_CSS}</style>
    <section className="max-w-xl mx-auto rounded-xl p-5 flex flex-col gap-4" style={{ background: 'var(--surface)' }}>
      <h1 className="font-display text-xl">Simpanan perlu diperiksa</h1>
      <p role="alert">{loadError}</p>
      <p>{remoteStore ? 'Data tidak dapat dimuatkan daripada server. Semak sambungan dan cuba lagi. Tiada simpanan sementara dibuat dalam pelayar.' : 'Muat turun salinan data asal untuk pemulihan. Jika akses pelayar disekat, benarkan simpanan kemudian cuba lagi.'}</p>
      <PrimaryButton onClick={downloadRecovery}>Muat Turun Salinan Pemulihan</PrimaryButton>
      <SecondaryButton onClick={() => window.location.reload()}>Cuba Buka Semula</SecondaryButton>
    </section>
  </div>;

  if (loading) {
    return (
      <div style={ROOT_VARS} className="font-body flex items-center justify-center" >
        <style>{GLOBAL_CSS}</style>
        <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent-sprout)' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={ROOT_VARS} className="font-body">
      <style>{GLOBAL_CSS}</style>
      <div className="flex flex-col md:flex-row min-h-screen" style={{ background: 'var(--bg)' }}>
        <aside className="hidden md:flex flex-col w-56 shrink-0 p-4 gap-1" style={{ borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-2 pb-5">
            <div className="rounded-lg p-1.5" style={{ background: 'var(--accent-sprout)' }}><Leaf size={16} style={{ color: '#1C2118' }} /></div>
            <span className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>LadangAlir</span>
          </div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => selectTab(item.key)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left"
              style={{ background: tab === item.key ? 'var(--surface)' : 'transparent', color: tab === item.key ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <item.icon size={16} style={{ color: tab === item.key ? 'var(--accent-sprout)' : 'var(--text-secondary)' }} />
              {item.label}
            </button>
          ))}
          <div className="mt-auto pt-4">
            <p className="px-3 pb-2 text-xs" style={{color: 'var(--text-secondary)'}}>{remoteStore ? 'Data kebun disimpan di Supabase.' : 'Data disimpan pada pelayar ini.'}</p>
            <button onClick={() => setRestoreOpen(true)} className="w-full text-left px-3 py-2 rounded-lg text-xs" style={{ color: 'var(--text-secondary)', border: '1px solid transparent' }}>Pulihkan Dari Fail</button>
            <ResetButton onReset={handleResetAll} />
          </div>
        </aside>

        <div className="flex md:hidden items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-1.5" style={{ background: 'var(--accent-sprout)' }}><Leaf size={15} style={{ color: '#1C2118' }} /></div>
            <span className="font-display text-base" style={{ color: 'var(--text-primary)' }}>LadangAlir</span>
          </div>
        </div>

        <main className="flex-1 min-w-0 p-4 md:p-6 pb-20 md:pb-6 overflow-x-hidden">
          {remoteStore && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}>
            <span>{syncError ? 'Penyegerakan terganggu' : 'Data kebun bersama'}{lastSync && ` · Disemak ${lastSync.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}`}</span>
            <div className="flex gap-3"><button onClick={downloadRecovery}>Muat Turun Sandaran</button><button onClick={onSignOut}>Log Keluar</button></div>
          </div>}
          {syncError && <p role="alert" className="mb-4 text-sm" style={{ color: 'var(--accent-harvest)' }}>{syncError} Paparan mungkin belum terkini.</p>}
          {writeError && <div role="alert" className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid var(--accent-clay)', color: 'var(--text-primary)' }}>{writeError}</div>}
          {notice && (
            <div className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: hexToRgba('#8FBC5A', 0.12), border: '1px solid var(--accent-sprout)', color: 'var(--text-primary)' }}>
              {notice}
            </div>
          )}
          {tab === 'dashboard' && <DashboardView crops={crops} plots={plots} plantings={plantings} onOpenLog={openLogFor} onOpenLogAll={openLogAll} />}
          {tab === 'basic' && <BasicScheduleView crops={crops} plots={plots} plantings={plantings} onSave={handleSaveBatch} onDeleteBatch={handleDeleteBatch} notify={notify} />}
          {tab === 'production' && <TargetHarvestView crops={crops} plots={plots} plantings={plantings} onCommitBatch={handleSaveBatch} onDeleteBatch={handleDeleteBatch} notify={notify} />}
          {tab === 'conveyor' && <ConveyorView crops={crops} plots={plots} plantings={plantings} onCommitBatch={handleSaveBatch} onDeleteBatch={handleDeleteBatch} notify={notify} onOpenLog={openLogFor} />}
          {tab === 'crops' && <CropsView crops={crops} plantings={plantings} onSave={handleSaveCrop} onDelete={handleDeleteCrop} />}
          {tab === 'plots' && <PlotsView crops={crops} plots={plots} plantings={plantings} canDeletePlotIds={canDeletePlotIds} onAddPlots={handleAddPlots} onRenamePlot={handleRenamePlot} onDeletePlot={handleDeletePlot} />}
          {tab === 'log' && <LogView key={`log-${logKey}`} crops={crops} plots={plots} plantings={plantings} onUpdateRecord={handleUpdateRecord} onDeletePlanting={handleDeletePlanting} initialFocus={logFocus} />}
          {tab === 'reports' && <ReportsView crops={crops} plantings={plantings} />}
        </main>

        <nav className="flex md:hidden fixed bottom-0 left-0 right-0 justify-between overflow-x-auto py-2 z-30" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={() => selectTab(item.key)} className="flex shrink-0 flex-col items-center gap-0.5 px-2 py-1">
              <item.icon size={18} style={{ color: tab === item.key ? 'var(--accent-sprout)' : 'var(--text-secondary)' }} />
              <span className="text-xs" style={{ color: tab === item.key ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{item.mobileLabel || item.label.split(' ')[0]}</span>
            </button>
          ))}
          <button onClick={() => setRestoreOpen(true)} className="flex shrink-0 flex-col items-center gap-0.5 px-2 py-1">
            <Upload size={18} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pulihkan</span>
          </button>
        </nav>

        {restoreOpen && <RestoreModal current={{ crops, plots, plantings }} onBackup={downloadRecovery} onRestore={handleRestoreFile} onClose={() => setRestoreOpen(false)} />}
      </div>
    </div>
  );
}
