// Public runtime configuration. In the Sites build a server route supplied this; the static
// GitHub Pages build inlines the same two values at build time. Both are public by design.
// The secret key is never part of the browser bundle.
export function publicConfig(env = process.env) {
  const raw = typeof env.NEXT_PUBLIC_SUPABASE_URL === 'string' ? env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "") : "";
  const publicKey = typeof env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === "string" ? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : "";
  if (!raw && !publicKey) return { mode: "local" };
  if (!/^https:\/\/[^/]+$/.test(raw) || !publicKey) throw new Error("Tetapan Supabase tidak lengkap. Semak tetapan awam app.");
  // A pasted secret key is a mistake the app must refuse rather than ship to browsers.
  if (publicKey.startsWith("sb_secret_")) throw new Error("Kunci awam tidak sah. Kunci rahsia tidak boleh diletakkan di sini.");
  // Legacy JWT keys must carry the anon role, never service_role.
  if (publicKey.startsWith("ey")) {
    let role;
    try { role = JSON.parse(atob(publicKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; }
    catch { throw new Error("Kunci awam Supabase tidak sah."); }
    if (role !== "anon") throw new Error("Kunci awam mesti kunci anon.");
  }
  return { mode: "supabase", url: raw, publicKey };
}
