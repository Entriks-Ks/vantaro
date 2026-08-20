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

## Supabase

The API uses one Supabase project at a time via `server/.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Keep both Vantaro-Development and Vantaro-Production blocks in that file. Comment out the unused one. Restart the server after switching. Check `GET /api/health` — `supabase.configured` and `supabase.reachable` should be `true`.

Registration sends a **6-digit code via Resend**. Set `RESEND_API_KEY` and `EMAIL_FROM` in `server/.env`. `EMAIL_FROM` must use a domain that is **verified** in the Resend dashboard.

## Header

The hero keeps the original German headline, lede, and CTAs. `DarkVeil` fills the header/hero background (`hueShift={46}`, scanlines on) via `ogl`.
