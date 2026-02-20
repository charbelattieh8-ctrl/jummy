# Delights by Jummy (v2)

This project is a working website **plus a serverless backend** so you can:

- Control the menu from an **admin page** (`/admin.html`).
- Add/edit/delete menu items, and set **prices**.
- Let customers add items to a **cart** and **checkout**.
- Store orders in a database (Supabase).

## Run locally (JSON files)

1. Install Node.js (v18+ recommended).
2. In this folder, run:

```bash
npm install
npm start
```

Then open:

- Website: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin.html`

Local dev uses `data/menu.json` and `data/orders.json` by default.

## Deploy to Netlify (Supabase)

1. Create a Supabase project.
2. Run the SQL in `supabase_schema.sql` in the Supabase SQL editor.
3. In Netlify, set build settings:

- Publish directory: `.`
- Functions directory: `netlify/functions`

4. Add these environment variables in Netlify:

- `SUPABASE_URL` (from Supabase project settings)
- `SUPABASE_SERVICE_ROLE_KEY` (from Supabase API settings)
- `ADMIN_PASSWORD` (your admin login)
- `ADMIN_JWT_SECRET` (a long random string)

5. Deploy.

## Admin password

Set your own password:

```bash
# macOS/Linux
ADMIN_PASSWORD="your-strong-password" npm start

# Windows PowerShell
$env:ADMIN_PASSWORD="your-strong-password"; npm start
```

If you want to skip password checks during local dev:

```bash
# macOS/Linux
ALLOW_ANY_PASSWORD="1" npm start

# Windows PowerShell
$env:ALLOW_ANY_PASSWORD="1"; npm start
```

## Data files (local dev)

- Menu: `data/menu.json`
- Orders: `data/orders.json`

They are plain JSON so you can back them up easily.
