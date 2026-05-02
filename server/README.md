# Curb sync server

Email + 6-digit-code auth and policy-document sync for the Curb extension.

## Routes

- `POST /auth/request-code` — `{ email }` → emails a 6-digit code (10-min expiry, rate-limited per email + IP). Always returns `{ ok: true }` regardless of whether the email is registered.
- `POST /auth/verify` — `{ email, code }` → on hit, returns `{ session_token, email }`. On miss, `401` with a reason. Locks the code after `CODE_MAX_ATTEMPTS` wrong attempts.
- `GET /sync` — *(auth required)* → `{ policies, version, updated_at }`. New users get `{ policies: [], version: 0, updated_at: null }`.
- `PUT /sync` — *(auth required)* → `{ policies, version }`. On version match, increments and stores. On mismatch, returns `409 { ok: false, current: { policies, version, updated_at } }` so the client can reconcile.
- `GET /health` — liveness check.

Bearer the session JWT on all `/sync` requests: `Authorization: Bearer <token>`.

## Storage

Single SQLite file at `${DATA_DIR}/storage.db` (WAL mode). Tables: `users`, `login_codes`, `documents`, `email_rate_limits`, `ip_rate_limits`. Codes and tokens are hashed at rest. Periodic cron prunes expired rows.

## Setup

```bash
cd server
cp .env.example .env   # fill in JWT_SECRET, AWS creds, EMAIL_FROM
npm install
npm run dev            # auto-restart on file changes
```

`JWT_SECRET` must be at least 32 chars. `EMAIL_FROM` must be a verified SES sender.

## Backups

`storage.db` is the only stateful file. Snapshot it with `cp` (WAL mode is safe to copy with `.backup` or via `sqlite3 storage.db ".backup /path/snapshot.db"`).
