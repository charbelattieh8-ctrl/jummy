# Handoff: Delights by Jummy Netlify + Supabase

## Goal
Deploy the site to Netlify with serverless API backed by Supabase. Local dev can still use JSON files.

## Current state (already done)
- Netlify function created at `netlify/functions/api.js` with endpoints:
  - `GET /api/health`
  - `POST /api/admin/login`
  - `GET /api/menu`
  - `POST /api/menu` (admin)
  - `PUT /api/menu/:id` (admin)
  - `DELETE /api/menu/:id` (admin)
  - `POST /api/orders`
  - `GET /api/orders` (admin)
- Redirects configured in `netlify.toml` so `/api/*` maps to the function.
- Supabase schema defined in `supabase_schema.sql` (tables: `menu_items`, `orders`).
- Admin UI updated to show DB status and fixed encoding issues.
- Added deps in `package.json`: `@supabase/supabase-js`, `jsonwebtoken`.
- `.env.example` added with required env vars.
- `README.md` updated with deploy instructions.

## Key files
- `netlify/functions/api.js`
- `netlify.toml`
- `supabase_schema.sql`
- `admin.js`
- `server.js`
- `.env.example`
- `README.md`

## Required external steps (Supabase + Netlify)
1. Create Supabase project.
2. Run SQL from `supabase_schema.sql` in Supabase SQL editor.
3. In Netlify build settings:
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
4. Set Netlify env vars:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
   - `ADMIN_JWT_SECRET` (long random string)
5. Deploy Netlify site.

## How auth works
- Local dev can bypass admin auth by setting `ALLOW_ANY_PASSWORD=1`.
- On Netlify, admin login uses `ADMIN_PASSWORD` and issues JWT signed with `ADMIN_JWT_SECRET`.
- Admin requests send `X-Admin-Token` (stored in localStorage by `admin.js`).

## Local dev
- `npm install`
- `npm start`
- Uses `data/menu.json` and `data/orders.json` locally.

## What to verify after deploy
1. `https://<site>.netlify.app/admin.html` login works.
2. Create menu item; verify it persists (Supabase).
3. Public site loads menu items.
4. Checkout creates order; admin view lists order.

## Notes / Caveats
- If Supabase env vars are missing in Netlify, API returns database-not-configured errors.
- The function currently allows local JSON fallback only if not running in Netlify.
