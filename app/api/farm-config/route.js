import { publicConfiguration, json } from '../../../lib/server/supabase-farm';
export const dynamic = 'force-dynamic';
export function GET() {
  try { return json(publicConfiguration()); }
  catch (error) { return json({ error: error.message }, error.status || 503); }
}
