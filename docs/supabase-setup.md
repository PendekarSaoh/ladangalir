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

The app is served as static files, so its configuration is public and baked in at
build time. Use `.env.example` for names:

- `NEXT_PUBLIC_SUPABASE_URL`: the project HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key (or legacy anon key).

Both are public by design. There is no secret key in this build: nothing on the
browser side can hold one, and `lib/public-config.js` refuses a secret or
service-role key placed in the public setting. If both values are empty the app
runs on on-device storage instead of Supabase.

GitHub Pages deployment: set the two values as repository **variables** (Settings,
Secrets and variables, Actions, Variables, not secrets), then push to the deploy
branch or run the `Deploy Ladang Alir ke GitHub Pages` workflow by hand. The
workflow runs the tests, builds `dist-pages/` and publishes it. For local
development, put the same names in a private `.env.local`.

## 3. Data and permission model

Every request carries the signed-in user's access token. The browser calls only
`ladang_read_self()` and `ladang_commit_self(...)`, which are `SECURITY DEFINER`
and derive the owner from `auth.uid()`. The owner is never a parameter, so a
browser cannot ask for another farm. The six tables stay closed: no policies
exist for `anon` or `authenticated`, both roles have their privileges revoked, and
the functions are the only way in. The publishable key in the bundle is public;
there is no secret key anywhere in the app.

Tables separate farms, crops, plots, plantings and logs. Every child row has a
farm ID. Composite foreign keys prevent cross-farm crop/plot references. One farm
per owner is enforced for this version. Accounts do not share a farm automatically.
Adding independent staff accounts later requires an explicit membership model.

Writes validate the document in the app, then lock the farm row, compare the
revision and check the stored payload of every planting inside one PostgreSQL
transaction. Conflict retries re-read the latest data and repeat the user's
mutation. Stale record edits are rejected, and an ordinary save cannot rewrite
the dates, plot or crop of a planting that already exists: only a deliberate
restore (`p_replace`) replaces the whole document, and it still needs the current
revision. Request receipts prevent duplicates when a response is lost. Existing
rows are updated only when their values/order changed. The protocol has an
explicit 2 MB document/import limit; larger farms require pagination/operations
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
storage, and it also accepts a downloaded backup file, so a farm can be set up on
a new origin from the file instead.

The app refreshes cloud data every 30 seconds while visible, on focus/online,
and before each write. Network/auth failures preserve forms and report that saving
has not been confirmed. Local storage is used only for the auth session and the
retained pre-migration copy once cloud mode is enabled.

## 5. Backups and checks

The app offers a manual JSON download of current cloud data, and `Pulihkan Dari
Fail` reads such a file back: pick the file, review the record counts against the
current farm, download the current data first, then confirm. A restore replaces
the whole document and still requires the current server revision, so a stale file
cannot overwrite newer work. Automatic off-server backups still have to be
configured separately. Never switch cloud mode off to work around an outage:
that would re-open the old browser copy, not the latest cloud data.

Run `node --test lib/*.test.js` before activation. These cover the API and client
adapter. SQL migration execution and database-role checks still require validation
on PostgreSQL or the selected Supabase project. Run live Supabase checks too: local tests cannot prove project keys, gateway roles,
Auth settings, email/password login or network configuration are correct.
