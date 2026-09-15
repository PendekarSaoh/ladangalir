"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import LadangAlir, { initialFarmData } from './ladang-alir';
import { createFarmStore, STORE_KEY, LEGACY_KEYS } from '../lib/farm-store';
import { stableStringify } from '../lib/stable-json';
import { createSupabaseStore } from '../lib/supabase-store';
import { parseRestoreFile } from '../lib/restore';
import { publicConfig } from '../lib/public-config';

const panel = { background: '#262C20', border: '1px solid #3A4030', borderRadius: 16, padding: 24, width: '100%', maxWidth: 540 };
const input = { width: '100%', marginTop: 6, background: '#1C2118', border: '1px solid #5C6555', borderRadius: 8, padding: 12, color: '#EDE8DB', fontSize: 16 };
const button = { background: '#8FBC5A', color: '#1C2118', borderRadius: 8, padding: '12px 16px', fontSize: 16, cursor: 'pointer' };
function Screen({ children }) { return <main style={{ background: '#1C2118', color: '#EDE8DB', minHeight: '100vh', padding: 20, display: 'grid', placeItems: 'center', fontFamily: 'system-ui' }}><section style={panel}>{children}</section></main>; }
function download(value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'ladang-alir-sandaran.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function SignIn({ client, onSignIn }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) throw new Error('Log masuk gagal. Semak e-mel, kata laluan dan sambungan internet.');
      onSignIn(data.session);
    } catch (error) { setError(error.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Screen><h1 style={{ fontSize: 26, marginBottom: 8 }}>Ladang Alir</h1><p style={{ marginBottom: 24 }}>Log masuk akaun kebun untuk mengakses data yang sama pada semua peranti.</p>
    <form onSubmit={submit}><fieldset disabled={busy} style={{ display: 'grid', gap: 16, border: 0, padding: 0 }}>
      <label>E-mel<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} style={input} /></label>
      <label>Kata laluan<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={input} /></label>
      {error && <p role="alert" style={{ color: '#E0A845' }}>{error}</p>}
      <button type="submit" style={button}>{busy ? 'Menyemak…' : 'Log Masuk'}</button>
    </fieldset></form><p style={{ marginTop: 20, color: '#A3AA91', fontSize: 14 }}>Gunakan akaun kebun yang disediakan pemilik. Pendaftaran awam belum dibuka.</p>
  </Screen>;
}
function ImportFarm({ store, onDone, onSignOut }) {
  const [candidate, setCandidate] = useState(null), [error, setError] = useState('');
  const [cloudExists, setCloudExists] = useState(false);
  // Set only when the candidate came from a chosen file instead of this browser's storage.
  const [fileInfo, setFileInfo] = useState(null);
  const [ready, setReady] = useState(false), [backedUp, setBackedUp] = useState(false), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  const lock = useRef(false), local = useRef(null), filePicker = useRef(null);
  useEffect(() => {
    try {
      const storage = window.localStorage;
      local.current = createFarmStore({ storage, locks: navigator.locks, defaults: initialFarmData });
      if ([STORE_KEY, ...LEGACY_KEYS].some(key => storage.getItem(key) !== null)) setCandidate(local.current.read().data);
      setReady(true);
    } catch (error) { setError(error.message); }
  }, []);
  function backup() {
    try { download(local.current.recovery()); setBackedUp(true); }
    catch { setError('Salinan data pelayar tidak dapat dimuat turun. Data asal tidak diubah.'); }
  }
  // A file backup needs no browser-storage backup step: the file itself is the copy.
  async function pickFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Fail itu melebihi 8 MB. Semak fail yang betul.');
      const parsed = parseRestoreFile(await file.text());
      setCandidate(parsed.data);
      setFileInfo({ fileName: file.name, source: parsed.source, flagged: parsed.flagged });
      setConfirmed(false);
    } catch (parseError) { setError(parseError.message); }
  }
  async function migrate() {
    if (lock.current || !ready || (candidate && ((!fileInfo && !backedUp) || !confirmed))) return;
    lock.current = true; setBusy(true); setError('');
    let intended;
    try {
      // Re-read so edits in an old tab cannot slip past the reviewed import counts.
      const latest = fileInfo ? candidate : (candidate ? local.current.read().data : initialFarmData());
      if (!fileInfo && candidate && JSON.stringify(latest) !== JSON.stringify(candidate)) { setCandidate(latest); setBackedUp(false); setConfirmed(false); throw new Error('Data pelayar berubah. Semak jumlah rekod dan muat turun sandaran baharu.'); }
      intended = { ...latest, plantings: latest.plantings.map(p => ({ ...p, rekod: p.rekod || {} })) };
      await store.transact(() => latest, { kind: 'import' }); onDone();
    } catch (error) {
      // A lost acknowledgement may already have committed. A read verifies the cloud state.
      try {
        const saved = await store.read();
        if (saved) {
          if (intended && stableStringify(saved.data) === stableStringify(intended)) { onDone(); return; }
          setCloudExists(true); setError('Data server sudah wujud dan berbeza daripada import ini. Data pelayar dikekalkan. Semak data server dahulu.'); return;
        }
      } catch { /* Keep the import form. */ }
      setError(error.message);
    } finally { lock.current = false; setBusy(false); }
  }
  return <Screen><h1 style={{ fontSize: 24, marginBottom: 12 }}>Sediakan Data Kebun</h1>
    <p style={{ marginBottom: 16 }}>Akaun ini belum mempunyai data kebun di server.</p>
    {fileInfo ? <><p style={{ marginBottom: 16 }}>Fail <strong>{fileInfo.fileName}</strong> ({fileInfo.source}): <strong>{candidate.crops.length} tanaman, {candidate.plots.length} petak, {candidate.plantings.length} penanaman.</strong></p>
      {fileInfo.flagged?.length > 0 && <p style={{ color: '#E0A845', marginBottom: 16 }}>{fileInfo.flagged.length} rekod lama menyalahi peraturan baharu, contoh {fileInfo.flagged[0]}. Semua masih akan diimport; betulkan melalui menu Log selepas ini.</p>}
      <label style={{ display: 'flex', gap: 10, margin: '20px 0' }}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />Saya mahu mengimport isi fail ini ke akaun kebun yang sedang digunakan.</label></> : candidate ? <><p style={{ marginBottom: 16 }}>Ditemui dalam pelayar ini: <strong>{candidate.crops.length} tanaman, {candidate.plots.length} petak, {candidate.plantings.length} penanaman.</strong></p>
      <button disabled={busy} onClick={backup} style={button}>Muat Turun Sandaran Dahulu</button>
      <label style={{ display: 'flex', gap: 10, margin: '20px 0' }}><input type="checkbox" checked={confirmed} disabled={busy || !backedUp} onChange={e => setConfirmed(e.target.checked)} />Saya telah menyimpan sandaran dan mahu mengimport data ini ke akaun kebun yang sedang digunakan.</label>
      <p style={{ color: '#A3AA91', marginBottom: 16 }}>Salinan asal dalam pelayar dikekalkan. Tutup tab versi lama selepas import.</p></> : ready && <p style={{ marginBottom: 16 }}>Tiada data lama dalam pelayar ini. Kalau kau ada fail sandaran, pilih di bawah. Butang Mulakan Kebun Baharu untuk mula dari kosong.</p>}
    {error && <p role="alert" style={{ color: '#E0A845', marginBottom: 16 }}>{error}</p>}
    {cloudExists && <button onClick={onDone} style={button}>Semak Data Server</button>}
    {!ready && <button onClick={backup} style={button}>Muat Turun Data Asal</button>}
    <div style={{ marginTop: 20, borderTop: '1px solid #3A4030', paddingTop: 16 }}>
      <label htmlFor="restore-file" style={{ display: 'block', marginBottom: 8 }}>{candidate && !fileInfo ? 'Atau pulihkan dari fail sandaran (.json)' : 'Pilih fail sandaran (.json)'}</label>
      <input id="restore-file" ref={filePicker} type="file" accept="application/json,.json" disabled={busy} onChange={pickFile} style={{ color: '#EDE8DB' }} />
    </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}><button onClick={migrate} disabled={busy || cloudExists || !ready || (!!candidate && ((!fileInfo && !backedUp) || !confirmed))} style={{ ...button, opacity: busy || !ready || (!!candidate && ((!fileInfo && !backedUp) || !confirmed)) ? 0.5 : 1 }}>{busy ? 'Menyimpan…' : candidate ? 'Import ke Supabase' : 'Mulakan Kebun Baharu'}</button>
      <button disabled={busy} onClick={onSignOut} style={{ ...button, background: '#3A4030', color: '#EDE8DB' }}>Tukar Akaun</button></div>
  </Screen>;
}
function CloudFarm({ client, config, userId, onSignOut }) {
  const [store] = useState(() => createSupabaseStore({
    url: config.url, publicKey: config.publicKey,
    getToken: async () => { const { data, error } = await client.auth.getSession(); if (error) throw error; return data.session?.access_token; },
  }));
  const [status, setStatus] = useState('loading'), [error, setError] = useState('');
  async function check() {
    setError('');
    try { setStatus(await store.read() ? 'ready' : 'import'); }
    catch (e) { setError(e.message); setStatus('error'); }
  }
  useEffect(() => { check(); }, [store]);
  if (status === 'ready') return <LadangAlir key={userId} remoteStore={store} onSignOut={onSignOut} />;
  if (status === 'import') return <ImportFarm store={store} onDone={check} onSignOut={onSignOut} />;
  return <Screen><p role="status">{error || 'Membuka data kebun…'}</p>{error && <><button onClick={check} style={button}>Cuba Lagi</button><button onClick={onSignOut} style={{ ...button, marginLeft: 12 }}>Log Keluar</button></>}</Screen>;
}
export default function SupabaseGate() {
  const [mode, setMode] = useState('loading'), [client, setClient] = useState(null), [config, setConfig] = useState(null), [session, setSession] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let stopped = false, subscription;
    (async () => {
      try {
        // No server to ask: the public project URL and publishable key are inlined at build
        // time. Both bundlers substitute these literal names, so keep them spelled out here.
        const config = publicConfig({
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        });
        if (stopped) return;
        setConfig(config);
        if (config.mode === 'local') { setMode('local'); return; }
        const supabase = createClient(config.url, config.publicKey, { auth: { storageKey: 'ladang-alir-supabase-auth', detectSessionInUrl: false } });
        setClient(supabase);
        const { data, error } = await supabase.auth.getSession(); if (error) throw error;
        if (stopped) return;
        setSession(data.session); setMode('supabase');
        subscription = supabase.auth.onAuthStateChange((_event, next) => { if (!stopped) setSession(next); }).data.subscription;
      } catch (error) { if (!stopped) { setError(error.message); setMode('error'); } }
    })();
    return () => { stopped = true; subscription?.unsubscribe(); };
  }, []);
  async function signOut() {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) { window.alert('Log keluar gagal. Cuba lagi.'); return; }
    setSession(null);
  }
  if (mode === 'local') return <LadangAlir />;
  if (mode === 'supabase') return session ? <CloudFarm key={session.user.id} userId={session.user.id} client={client} config={config} onSignOut={signOut} /> : <SignIn client={client} onSignIn={setSession} />;
  return <Screen><p role="status">{error || 'Membuka Ladang Alir…'}</p>{error && <button style={button} onClick={() => window.location.reload()}>Cuba Lagi</button>}</Screen>;
}
