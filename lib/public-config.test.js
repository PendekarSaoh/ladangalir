import test from 'node:test';
import assert from 'node:assert/strict';
import { publicConfig } from './public-config.js';

const url = 'https://project.supabase.co';
const anonJwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.sig`;
const serviceJwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.sig`;

test('no Supabase settings falls back to on-device storage', () => {
  assert.deepEqual(publicConfig({}), { mode: 'local' });
  assert.deepEqual(publicConfig({ SUPABASE_SECRET_KEY: 'sb_secret_x' }), { mode: 'local' });
});

test('publishable keys and legacy anon keys are accepted, with the trailing slash removed', () => {
  assert.deepEqual(publicConfig({ NEXT_PUBLIC_SUPABASE_URL: url + '/', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' }),
    { mode: 'supabase', url, publicKey: 'sb_publishable_abc' });
  assert.equal(publicConfig({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonJwt }).mode, 'supabase');
});

test('a secret or service key in the browser configuration is refused', () => {
  assert.throws(() => publicConfig({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' }), /Kunci awam tidak sah/);
  assert.throws(() => publicConfig({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: serviceJwt }), /kunci anon/);
  assert.throws(() => publicConfig({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.broken' }), /Kunci awam Supabase tidak sah/);
  assert.throws(() => publicConfig({ NEXT_PUBLIC_SUPABASE_URL: 'http://not-https.example', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' }), /tidak lengkap/);
  assert.throws(() => publicConfig({ NEXT_PUBLIC_SUPABASE_URL: url }), /tidak lengkap/);
});
