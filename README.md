# 🔥 Office Heat

A personal workout generator for the equipment you actually own — a **16kg kettlebell**,
a **yoga mat**, and a **bike on a Wahoo trainer**. Built for short maintenance sessions
when time and sleep are in short supply.

- **Strength** (kettlebell) workouts: 10 / 15 / 20 / 30 min
- **Bike** (trainer) workouts: 20 / 30 / 40 / 50 / 60 / 90 min
- **Energy toggle** — `Fresh / OK / Wrecked` scales reps, rounds, rest and intensity
  so a bad-sleep day automatically gives you a shorter, easier session
- **Curated library** of workouts that flex to your chosen time, plus an optional
  **✨ AI generate** button (Claude) for variety
- **Built-in timers** — an EMOM timer with per-minute beeps and auto-advance, an
  interval timer for circuits/Tabata/bike, an AMRAP round counter, and a stopwatch
- **Save & rate** workouts (👍/👎/⭐) and log every session to your **history**
- **Send bike workouts to Garmin** — uploads a structured ride and schedules it on
  your Garmin calendar, which syncs to your Edge
- **Password-gated** and deployable on **Railway** as a single service

## Tech

- **Backend:** FastAPI + SQLAlchemy (SQLite locally, Postgres on Railway)
- **Frontend:** React + Vite + TypeScript (mobile-first)
- One service: FastAPI serves both the API and the built React app.

## Run locally

```bash
# 1. Backend (Python 3.13)
cd backend
uv venv && uv pip install -r requirements.txt   # or: python -m venv .venv && pip install -r requirements.txt

# 2. Frontend — build it once so the backend can serve it
cd ../frontend
npm install
npm run build

# 3. Start the server (serves API + the built app)
cd ../backend
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
# open http://localhost:8000
```

With no `APP_PASSWORD` set, the app runs **open** (handy for local dev). Local data
goes to `backend/office_heat.sqlite3`.

### Frontend dev with hot-reload (optional)

```bash
cd frontend && npm run dev      # http://localhost:5173, proxies /api to :8000
```

## Environment variables

Copy `.env.example` to `.env` for local use, or set these as Railway service variables.

| Variable | Purpose |
| --- | --- |
| `APP_PASSWORD` | Shared password gate. Leave empty to run open (dev only). |
| `SECRET_KEY` | Long random string used to sign the auth cookie. |
| `DATABASE_URL` | Injected automatically by Railway Postgres. SQLite fallback if unset. |
| `ANTHROPIC_API_KEY` | Enables the ✨ AI generate button (server-side only). |
| `ANTHROPIC_MODEL` | Defaults to `claude-opus-4-8`. |
| `GARMIN_TOKENS_B64` | **Preferred** Garmin auth — a pre-generated session token (avoids MFA login). |
| `GARMIN_EMAIL` / `GARMIN_PASSWORD` | Fallback Garmin auth via direct login (may hit MFA in the cloud). |
| `DEFAULT_FTP` | Starting FTP (watts) for bike power targets. Editable in Settings. |

> 🔒 Secrets live in env vars only — never commit `.env`. It is git-ignored.

## Deploy on Railway

1. Push this repo to GitHub (already wired to `mansell37/office_heat`).
2. In Railway: **New Project → Deploy from GitHub repo → office_heat**.
   Railway reads `railway.json` and builds the `Dockerfile` automatically.
3. Add a database: **New → Database → PostgreSQL**. Railway injects `DATABASE_URL`.
4. On the app service, add **Variables**:
   - `APP_PASSWORD` — your chosen password
   - `SECRET_KEY` — any long random string
   - `ANTHROPIC_API_KEY` — your **rotated** key (the one shared earlier is burned)
   - `GARMIN_EMAIL`, `GARMIN_PASSWORD` — for bike upload (optional)
5. Deploy. Railway gives you a public URL — open it and log in with `APP_PASSWORD`.

The health check at `/api/health` lets Railway know the service is up.

## Garmin upload notes

Uploading bike workouts uses [`python-garminconnect`](https://github.com/cyberjunky/python-garminconnect).

**Recommended auth: a pre-generated token** (`GARMIN_TOKENS_B64`). This skips the
headless login entirely, so **MFA/2FA is not a problem**. Generate it on your own
machine:

```bash
cd backend
.venv/Scripts/python scripts/garmin_bootstrap.py   # prints a base64 string
```

Paste the printed string into Railway as `GARMIN_TOKENS_B64`. The token is
account-level — if you already made one for another app (e.g. ripe_fitness), the
**same string works here unchanged**. The token is also cached in the database
and auto-refreshes; if it ever fully expires, re-run the script and update the var.

`GARMIN_EMAIL` / `GARMIN_PASSWORD` are an optional fallback (direct login).
