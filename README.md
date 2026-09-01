# VANTARO

React landing page (`client`) and Node.js API (`server`).

## Structure

```
client/   Vite + React frontend
server/   Express API
```

## Run

Install dependencies in both folders, then start them together from the repo root:

```bash
npm install
npm run install:all
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3001](http://localhost:3001)

Or start them separately:

```bash
npm run dev:client
npm run dev:server
```

Vite proxies `/api` requests to the server during development.

## Deploy (Vercel + Render)

Same pattern as Entriks HR: frontend domains are allowed in code; API URL defaults in production.

| Part | Host | Root |
|------|------|------|
| Frontend (`client`) | [Vercel](https://vercel.com) | `client` |
| API (`server`) | [Render](https://render.com) | `server` |

### 1. Render (API)

1. New **Web Service** → connect this repo (or use `render.yaml`).
2. **Root Directory:** `server`
3. **Build:** `npm install` · **Start:** `npm start`
4. **Health check:** `/api/health`
5. Set env vars (see `server/.env.example`):

```env
FRONTEND_URL=https://www.vantaro.io
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
EMAIL_FROM=VANTARO <noreply@your-verified-domain.com>
RESEND_API_KEY=...
ADMIN_EMAILS=you@your-domain.com
```

`FRONTEND_URL` is optional for CORS — `vantaro.io` / `www.vantaro.io` are already allowed in code. Set it so email links use the right host.

### 2. Vercel (frontend)

1. New project → this repo.
2. **Root Directory:** `client`
3. Framework: Vite. Build: `npm run build` · Output: `dist`
4. Optional env (defaults to `https://vantaro.onrender.com` in production builds):

```env
VITE_API_URL=https://vantaro.onrender.com
```

Locally leave `VITE_API_URL` unset so the Vite proxy still works.

## Supabase

The API uses one Supabase project at a time via `server/.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Keep both Vantaro-Development and Vantaro-Production blocks in that file. Comment out the unused one. Restart the server after switching. Check `GET /api/health` — `supabase.configured` and `supabase.reachable` should be `true`.

### Leads table

Lead records live in Postgres (`public.leads`). The API uses the service role; RLS is on with no anon/authenticated policies.

Run [`server/supabase/leads.sql`](server/supabase/leads.sql) in the **SQL Editor** of each Supabase project you use (Development and Production). Then run [`server/supabase/lead_requests.sql`](server/supabase/lead_requests.sql) for Berater-Anfragen. Existing projects also need [`server/supabase/lead_workflow.sql`](server/supabase/lead_workflow.sql) (request statuses, complaints, refunds). Re-run it after pulling this change so complaint statuses become `pending | approved | declined` and `admin_note` exists. Repeat after switching projects.

Registration sends a **6-digit code via Resend**. Set `RESEND_API_KEY` and `EMAIL_FROM` in `server/.env`. `EMAIL_FROM` must use a domain that is **verified** in the Resend dashboard.

## Header

The hero keeps the original German headline, lede, and CTAs. `DarkVeil` fills the header/hero background (`hueShift={46}`, scanlines on) via `ogl`.
