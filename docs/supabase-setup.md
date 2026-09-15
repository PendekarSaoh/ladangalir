# Ladang Alir: Supabase activation

Status: integration prepared. It remains in local mode until the selected project,
SQL migration, shared account and environment settings are configured and verified.
The current Site audience remains private. A later VPS deployment can use the same
Supabase project; the runtime itself still needs a separate VPS deployment setup.

## 1. Project and account

Create/select a Supabase Free project for Ladang Alir. Do not use an unrelated
existing project's database. Run `supabase/migrations/202609150001_ladang_alir.sql`
once through Supabase SQL Editor or the Supabase migration CLI. This migration is
independent of the starter's D1/Drizzle migrations; do not run it through D1.

Create the shared farm login through Supabase Authentication > Users. Set the
password privately, confirm the email according to your chosen account setup,
and disable public new-user signup for this initial private release. The login
form intentionally does not provide public signup. No user invitation emails
are sent by the app. Password recovery can be managed in Supabase until a public
recovery flow is added.

## 2. Runtime configuration

Use `.env.example` for names. Configure these on the server, never in GitHub:

- `SUPABASE_URL`: the project HTTPS URL.
- `SUPABASE_PUBLISHABLE_KEY`: publishable key (or legacy anon key). This is public.
- `SUPABASE_SECRET_KEY`: secret key (or legacy service_role key). Server ONLY.
- `SUPABASE_STORAGE_ENABLED=true`: activate after the preceding steps are verified.

For local development, create a private `.env.local` from `.env.example`.
For Sites, use runtime environment settings; for VPS, use a private runtime env
file. The server's `/api/farm-config` exposes only the project URL and publishable
key. It never returns the secret key. A partially configured enabled integration
fails closed instead of falling back to local writes.

## 3. Data and permission model

All requests require a Supabase access token validated using the Auth server.
The API derives the owner ID from that verified response and never trusts owner
or farm IDs sent by a browser. Authenticated/anonymous browser roles have no access
to the six tables or privileged RPCs. RLS is enabled; only the server's secret-role
connection can access them. Keep the secret key away from clients and logs.

Tables separate farms, crops, plots, plantings and logs. Every child row has a
farm ID. Composite foreign keys prevent cross-farm crop/plot references. One farm
per owner is enforced for this version. Accounts do not share a farm automatically.
Adding independent staff accounts later requires an explicit membership model.

Writes validate records and overlap acknowledgement in the API, then lock the farm
row and compare its revision inside one PostgreSQL transaction. Conflict retries
re-read the latest data and repeat the user's mutation. Stale record edits are
rejected. Request receipts prevent duplicates when a response is lost. Existing
rows are updated only when their values/order changed. The current protocol has
an explicit 2 MB document/import limit; larger farms require pagination/operations
rather than silently increasing the limit.

## 4. Activation and import

1. Export a browser backup before activation.
2. Verify login, table permissions, import, edit, stale-save rejection and export
   on the selected Supabase project using non-production sample data first.
3. Open the final app in the SAME browser/origin containing the existing data.
4. Log into the shared account, review the crop/plot/planting counts, download the
   original backup, confirm, then import. No data is deleted from local storage.
5. Verify the counts and several saved records after reloading and on another device.
6. Close old tabs. Every device now logs into the same shared Supabase account.

Import is only allowed when the account has no cloud farm. It never merges or
replaces an existing farm. If an empty farm was accidentally created on another
device first, stop and arrange a reviewed import; do not overwrite cloud data.
Changing domain does not carry browser storage with it, so import before moving
the app to a different origin. The first migration UI reads the original browser
storage; uploading an exported backup is not implemented in this version.

The app refreshes cloud data every 30 seconds while visible, on focus/online,
and before each write. Network/auth failures preserve forms and report that saving
has not been confirmed. Local storage is used only for the auth session and the
retained pre-migration copy once cloud mode is enabled.

## 5. Backups and checks

The app offers a manual JSON download of current cloud data. Automatic off-server
backups and a verified restore process must be configured separately; this code
does not claim to provide them. Never switch cloud mode off to work around an outage:
that would re-open the old browser copy, not the latest cloud data.

Run `node --test lib/*.test.js` before activation. These cover the API and client
adapter. SQL migration execution and database-role checks still require validation
on PostgreSQL or the selected Supabase project. Run live Supabase checks too: local tests cannot prove project keys, gateway roles,
Auth settings, email/password login or network configuration are correct.
