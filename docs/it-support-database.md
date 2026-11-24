# IT Support: Database page

The IT Support console has a **Database** page (`/it-support/database`, under "Technical"). Admins can open it too. It is read-only: changes are made in Supabase, not in the console.

- **Tables:** every table (including logins in `auth.users`) with what it is for, its exact row count, and how many tables it links to and is linked from.
- **User data:** pick a user (or click **Database** in a user's panel on the Users page) to see every row that belongs to that login, grouped by table and column. The page also shows how many rows would be deleted or cleared if the login were deleted. Sections are found live from the foreign keys that point at `auth.users`, so new tables appear without code changes. Two links without a foreign key are added: console actions on the user (`it_support_audit_log.target_id`) and partner accounts of a main company (`user_metadata.energy_company_id`).
- **Info window** (click any table or row):
  - what the table is for, and the row's key (click to copy);
  - what it links to (you can open the linked row) and what links to it, with live row counts (click a count to list those rows);
  - what a delete would do: cascades, columns set to NULL, deletes that would be blocked, and delete triggers;
  - every field with its type and default, and the allowed values (CHECK constraints);
  - copy-ready SQL plus links to the Supabase SQL editor, table editor and Authentication page.

Hidden from the browser: ProCredit order passwords, return tokens and payment-page URLs, Google Calendar tokens, and secret-looking keys in user metadata (verification code hashes, reset tokens). Berater notes (`broker_notes`) show only their length, as on the Leads page.

## Rollout

1. Run `server/supabase/it_support_schema_map.sql` in the Supabase SQL Editor (Development first, then Production). It only adds one read-only function, `public.it_support_relations()`, which only the server (service role) can call. Nothing else changes, and it is safe to re-run.
2. Deploy the server and the client as usual.
3. Sign in as IT Support, open **Database**, and check that the table list loads. Open a user's panel and click **Database**.

Until step 1 is done, the page shows a notice naming the SQL file. Nothing else in the console is affected.

**Undo:** `drop function if exists public.it_support_relations();`, then redeploy the previous build.

## Files

| Kind | File |
|---|---|
| SQL | `server/supabase/it_support_schema_map.sql` |
| API | `server/src/routes/itSupport/database.js` (mounted at `/api/it-support/database` in `index.js`) |
| Page | `client/src/pages/itSupport/Database.jsx`, `TableInfo.jsx`, `schemaDocs.js` (table descriptions, DE/EN) |
| Changed | `ItSupportApp.jsx` (nav and route), `Users.jsx` (Database button), `itSupport.css` |
| Tests | `server/test/itSupport.test.js` ("database explorer") |

To describe a new table, add an entry to `TABLE_DOCS` in `schemaDocs.js`. Tables without one still appear, with their database comment or "No description yet".
