import { handleFarmRequest } from '../../../lib/server/supabase-farm';
export const dynamic = 'force-dynamic';
export const GET = request => handleFarmRequest(request);
export const POST = request => handleFarmRequest(request);
