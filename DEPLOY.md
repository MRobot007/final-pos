# Deploying Spirited Wines POS

This app is split across three services. Don't try to run it all on one platform —
the PHP API can't run on Vercel (explained below), so it lives on Railway.

```
Browser ── final-pos-nb6u.vercel.app        Next.js frontend     → Vercel
              │  NEXT_PUBLIC_API_URL
              ▼
        ...up.railway.app/api                PHP API (Docker)     → Railway
              │  PDO + TLS
              ▼
        Aiven MySQL  (defaultdb)             Database             → Aiven
```

| Layer | Platform | Notes |
|------|----------|-------|
| Frontend (Next.js) | **Vercel** | Auto-deploys from `main`. Pure Next.js — **no `vercel.json`**. |
| API (PHP) | **Railway** | Docker (`api/Dockerfile`), Root Directory = `api`. |
| Database (MySQL) | **Aiven** | Free MySQL, TLS required. |

Everything auto-deploys on `git push origin main`: Vercel rebuilds the frontend,
Railway rebuilds the API.

---

## 1. Database — Aiven (MySQL)

Use a managed MySQL that allows runtime `ALTER TABLE` (this app adjusts its own
schema on boot). Aiven's free MySQL works. ⚠️ **Not PlanetScale** (it blocks runtime DDL).

1. **aiven.io** → create a **MySQL Free** service → wait until *Running*.
2. Copy the connection details: **Host, Port, User** (`avnadmin`), **Password**,
   **Database** (`defaultdb`). SSL is **required**.
3. **Import your real data** — NOT `database.sql` (that's schema-only; your ~14k
   products live in your local XAMPP DB). Export the full local DB, then load it:
   ```bash
   # export everything (schema + data) from local XAMPP
   "C:/xampp/mysql/bin/mysqldump.exe" -u root --single-transaction \
     --skip-lock-tables --default-character-set=utf8mb4 pos_project > spirited_dump.sql
   ```
   The XAMPP `mysql.exe` client (MariaDB) **cannot** connect to Aiven's MySQL 8
   (`caching_sha2_password` plugin error). Import with a MySQL-8-aware tool
   instead — **HeidiSQL** ("Run SQL file") or a short Node script using `mysql2`
   (handles MySQL 8 auth + SSL):
   ```js
   const fs = require('fs'); const mysql = require('mysql2/promise');
   const conn = await mysql.createConnection({
     host:'HOST', port:PORT, user:'avnadmin', password:'PASS',
     database:'defaultdb', ssl:{rejectUnauthorized:false}, multipleStatements:true });
   await conn.query(fs.readFileSync('spirited_dump.sql','utf8'));
   ```

## 2. API — Railway (PHP in Docker)

The API is served by `api/Dockerfile` (PHP 8.2 CLI + the built-in server through
`api/router.php`, exactly like local dev).

1. **railway.app** → **New Project → Deploy from GitHub repo** → pick `final-pos`.
2. Service **Settings → Source → Root Directory** = **`api`**. Railway then builds
   `api/Dockerfile` automatically.
3. **Variables** (Raw Editor) — set these (values from step 1):
   ```
   DB_HOST=...        DB_USER=avnadmin
   DB_PORT=...        DB_PASS=...
   DB_NAME=defaultdb  DB_SSL=1
   TOKEN_SECRET=<long random, e.g. openssl rand -hex 32>
   ALLOWED_ORIGINS=https://<your-vercel-domain>   # or * while testing
   PORT=8080
   ```
4. **Settings → Networking → Generate Domain** (port **8080**).
5. Verify: `https://<railway-domain>/api/health` → `{"status":"ok"}`.

## 3. Frontend — Vercel (Next.js)

1. **vercel.com → Add New → Project** → import `final-pos`. Framework = **Next.js**,
   Root Directory = repo root. There is **no `vercel.json`** — keep it that way.
2. **Environment Variables** → set:
   ```
   NEXT_PUBLIC_API_URL = https://<railway-domain>/api
   ```
3. Deploy. `NEXT_PUBLIC_*` is baked at build time, so **any change to this value
   requires a redeploy** (Deployments → ⋯ → Redeploy).
4. Open the Vercel URL → log in → products load from Aiven.

---

## Environment variables — which go where

| Variable | Vercel (frontend) | Railway (API) |
|----------|:---:|:---:|
| `NEXT_PUBLIC_API_URL` | ✅ | — |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASS` `DB_SSL` | — | ✅ |
| `TOKEN_SECRET` | — | ✅ |
| `ALLOWED_ORIGINS` | — | ✅ |
| `PORT` (=8080) | — | ✅ |

(`api/config.php` reads all of these via `getenv()`, falling back to local XAMPP
defaults for development.)

## Security — before going public

- [ ] **Change the demo owner password** — the login page shows credentials anyone
      can use. Log in → Admin → Users.
- [ ] `TOKEN_SECRET` is a strong random value (not the committed default).
- [ ] DB password is the provider's generated password (never root/empty).
- [ ] `ALLOWED_ORIGINS` set to your exact Vercel domain (tighten from `*`).

## Why the API is on Railway and not Vercel

`vercel-php` can't host this app's single-file front-controller:
- Vercel serverless functions must live in a nested `/api` dir, which collides
  with both the Next.js build (`ENOENT .next/output/config.json`) and this repo's
  layout. Putting `functions` in a Next.js `vercel.json` breaks the frontend build.
- The PHP-Apache base image also failed with `More than one MPM loaded`.

So the API runs in a plain Docker container (PHP built-in server) on Railway —
identical to local dev, nothing exotic.

## Troubleshooting

- **API 500 with no body** → temporarily set `display_errors` to `1` at the top of
  `api/index.php`, redeploy, read the error, then set it back to `0`.
- **`1064 ... syntax near '"OWNER"...'`** → Aiven's MySQL 8 enables `ANSI_QUOTES`
  (and `ONLY_FULL_GROUP_BY`), which break this app's MariaDB-style SQL.
  `api/db.php` clears `sql_mode` per session (`SET SESSION sql_mode = ''`) to fix it.
- **Railway "Crashed" instantly** → Root Directory not set to `api` (it tried to
  build the Next app). Set it to `api`.
- **CORS blocked in browser** → set Railway `ALLOWED_ORIGINS` to the exact Vercel
  origin; redeploy the API.
- **Frontend calls the wrong API** → `NEXT_PUBLIC_API_URL` is baked at build time;
  change it then **redeploy** the Vercel project.
