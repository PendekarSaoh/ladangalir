import test from 'node:test';
import assert from 'node:assert/strict';
import { focusTargetId, resolveLogFilter, logScope, hasLogScope, inLogScope } from './log-focus.js';

test('focusTargetId hanya ambil id penanaman', () => {
  assert.equal(focusTargetId({ id: 'p1' }), 'p1');
  assert.equal(focusTargetId({ filter: 'semua' }), null);
  assert.equal(focusTargetId({ plotId: 'a' }), null);
  assert.equal(focusTargetId(null), null);
  assert.equal(focusTargetId(undefined), null);
});

test('tapisan tetap dari isyarat digunakan apa adanya', () => {
  assert.equal(resolveLogFilter({ filter: 'semua' }), 'semua');
  assert.equal(resolveLogFilter({ filter: 'dituai' }), 'dituai');
  assert.equal(resolveLogFilter({ filter: 'aktif' }), 'aktif');
});

test('isyarat tanpa tapisan sah jatuh balik ke aktif', () => {
  assert.equal(resolveLogFilter({ id: 'p1' }, 'aktif'), 'aktif');
  assert.equal(resolveLogFilter({ id: 'p1' }, 'lewat'), 'aktif');
  assert.equal(resolveLogFilter({ filter: 'entah' }, null), 'aktif');
  assert.equal(resolveLogFilter(null, null), 'aktif');
  assert.equal(resolveLogFilter(undefined), 'aktif');
});

test('penanaman yang sudah dituai dibuka dengan tapisan semua', () => {
  assert.equal(resolveLogFilter({ id: 'p1' }, 'dituai'), 'semua');
  assert.equal(resolveLogFilter({ plotId: 'a' }, 'dituai'), 'semua');
});

test('logScope menormalkan isyarat kepada bentuk tetap', () => {
  assert.deepEqual(logScope({ plotId: 'a' }), { plotId: 'a', cropId: null, batchId: null, label: '' });
  assert.deepEqual(logScope({ batchId: 'b1', label: 'pelan Pasaran' }), { plotId: null, cropId: null, batchId: 'b1', label: 'pelan Pasaran' });
  assert.deepEqual(logScope(null), { plotId: null, cropId: null, batchId: null, label: '' });
});

test('hasLogScope hanya benar bila ada skop sebenar', () => {
  assert.equal(hasLogScope(logScope({ cropId: 'c1' })), true);
  assert.equal(hasLogScope(logScope({ batchId: 'b1' })), true);
  assert.equal(hasLogScope(logScope({ label: 'petak A' })), false);
  assert.equal(hasLogScope(logScope({ id: 'p1' })), false);
  assert.equal(hasLogScope(logScope(null)), false);
});

test('inLogScope menapis ikut petak, tanaman dan kumpulan', () => {
  const planting = { plotId: 'a', cropId: 'kangkung', batchId: 'b1' };
  assert.equal(inLogScope(planting, logScope(null)), true);
  assert.equal(inLogScope(planting, logScope({ plotId: 'a' })), true);
  assert.equal(inLogScope(planting, logScope({ plotId: 'b' })), false);
  assert.equal(inLogScope(planting, logScope({ cropId: 'kangkung' })), true);
  assert.equal(inLogScope(planting, logScope({ cropId: 'bayam' })), false);
  assert.equal(inLogScope(planting, logScope({ batchId: 'b1' })), true);
  assert.equal(inLogScope(planting, logScope({ batchId: 'b2' })), false);
  assert.equal(inLogScope(planting, logScope({ plotId: 'a', cropId: 'bayam' })), false);
  assert.equal(inLogScope(planting, logScope({ plotId: 'a', cropId: 'kangkung', batchId: 'b1' })), true);
});
