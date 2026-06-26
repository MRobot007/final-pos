# Deploying Spirited Wines POS to Vercel

This app has three parts. XAMPP runs all three locally; Vercel runs two of them,
and the **database must live on an external managed MySQL** (Vercel has no DB).

```
Next.js frontend  ──▶  PHP API (api/index.php)  ──▶  MySQL
   (Vercel)              (Vercel, vercel-php)         (external managed MySQL)
```

Both the frontend and the PHP API run in **one Vercel project** on the **same
domain**, so there is no CORS or mixed-content to fight.

---

## 1. Create a managed MySQL database

Pick a provider that allows runtime `ALTER TABLE` (this app adjusts its own schema
on boot). Good choices: **Aiven**, **Railway**, **TiDB Cloud Serverless**,
**Clever Cloud**. ⚠️ **Do NOT use PlanetScale** — it blocks the runtime DDL this
app performs.

1. Create a MySQL service (the provider gives you a ready database, e.g. Aiven's
   `defaultdb`). You don't need to name it `pos_project` — just set `DB_NAME` to
   whatever the provider gives you.
2. **Import your real data**, not `database.sql` (that's schema-only). Your ~14k
   products live in your local XAMPP DB. A full export has already been made for
   you at `spirited_dump.sql` (schema + all data). Load it into the cloud DB:
   ```
   "C:/xampp/mysql/bin/mysql.exe" --host=HOST --port=PORT --user=USER \
     --password=PASS --ssl --ssl-verify-server-cert=0 DBNAME < spirited_dump.sql
   ```
   (or use a GUI like HeidiSQL → "Run SQL file"). To regenerate the export later:
   ```
   "C:/xampp/mysql/bin/mysqldump.exe" -u root --single-transaction \
     --skip-lock-tables --default-character-set=utf8mb4 pos_project > spirited_dump.sql
   ```
3. Copy the connection details: host, port, database, user, password.
   Most managed MySQL requires TLS → you'll set `DB_SSL=1`.

## 2. Push the repo to GitHub

```bash
git add .
git commit -m "chore: prepare for Vercel deploy (env-driven config, vercel.json)"
git push
```

(`.env.local` and real secrets stay out of git — only `.env.example` is committed.)

## 3. Create the Vercel project

1. vercel.com → **Add New → Project** → import this GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Root directory: repo root.
3. Add **Environment Variables** (Settings → Environment Variables):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_URL` | `/api` |
   | `DB_HOST` | _from step 1_ |
   | `DB_PORT` | `3306` (or provider's) |
   | `DB_NAME` | `pos_project` |
   | `DB_USER` | _from step 1_ |
   | `DB_PASS` | _from step 1_ |
   | `DB_SSL` | `1` |
   | `TOKEN_SECRET` | a long random string (`openssl rand -hex 32`) |
   | `ALLOWED_ORIGINS` | `*` (same-origin setup) |

4. **Deploy.**

## 4. Verify

- `https://your-app.vercel.app/api/health` → should return `{"status":"ok"}`.
- Open the app, log in, load products, make a test sale.

If `/api/health` fails, see Troubleshooting below.

---

## Security — do BEFORE sharing the public URL

On localhost these were fine; on a public URL they are real risks:

- [ ] **Change the demo passwords.** The login page shows demo credentials —
      anyone who opens the site can log in as the owner. Change them (or remove
      the on-screen hint).
- [ ] **`TOKEN_SECRET`** is a strong random value in Vercel (not the default).
- [ ] **DB password** is the provider's strong password (never root/empty).
- [ ] **`ALLOWED_ORIGINS`** — only loosen from `*` if you split onto another
      domain; then set it to your exact frontend origin.

---

## Troubleshooting

- **`/api/health` 500 / "Server error"** — DB connection. Re-check `DB_*` vars and
  that `DB_SSL=1`. Confirm the DB allows connections from anywhere (0.0.0.0/0) or
  from Vercel's egress.
- **Build error: unknown runtime `vercel-php@0.7.4`** — pin the current version.
  Check https://github.com/vercel-community/php for the latest and update the
  number in `vercel.json`.
- **PHP function can't find `db.php` / `auth.php`** — they must deploy alongside
  `api/index.php`. They're in the same folder, so this normally just works; if not,
  add `"includeFiles": "api/**"` under the function in `vercel.json`.
- **401 on every request after login** — the `Authorization` header isn't reaching
  PHP. Confirm the login response returns a token and the app sends
  `Authorization: Bearer <token>`. The API reads `HTTP_AUTHORIZATION`, which
  vercel-php forwards.
- **Slow first request after idle** — serverless cold start + the once-per-hour
  schema bootstrap re-running on a fresh container. Harmless; warms up after.

---

## Note on this route

Running PHP on Vercel via the community `vercel-php` runtime works but is the
fiddliest option (cold starts, ephemeral filesystem, community-maintained
runtime). If you ever hit friction, a cheap shared PHP/cPanel host (Hostinger
etc.) for `api/` + this same Vercel project for the frontend is a lower-stress
alternative — just set `NEXT_PUBLIC_API_URL` to that host's HTTPS URL and
`ALLOWED_ORIGINS` to your Vercel domain.
