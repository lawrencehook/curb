# BONES

Living skeleton — refresh memory + reference patterns for other projects.

## Stack
- Firefox MV2 + Chrome MV3 from one `src/`. Vanilla JS, no bundler.
- Node 20: Express, better-sqlite3 (WAL), AWS SDK v3, jsonwebtoken.

## Layout
- `src/{background,popup,edit,content,blocked}` — service worker, popup, settings page, `<all_urls>` overlay, redirect page.
- `src/shared/{utils,sync,migrations}.js` shared across contexts. `server/` Express + SQLite + S3.

## dev.sh
- One script, two strategies. Firefox runs `web-ext` from `src/`. Chrome loads `dist/chrome/` — symlinks back to `src/`, with `chrome_manifest.json` as `manifest.json`.
- **`src/content/` is copied, not symlinked.** Chrome serves empty bodies for content scripts loaded via symlinks.

## Data model
- `policy = {id, name, domains[], rules[], schedule?, disabled?, updated_at}`
- `rule = {id, type: 'daily'|'sliding', minutes, windowMin?, disabled?}`
- `schedule.windows = [{days[], startMin, endMin}]`; `custom: true` disambiguates user-edited from preset-equivalent.
- Usage: minute-bucketed `{[date]: {[domain]: {[minute]: seconds}}}`.
- Tombstones `{id, deleted: true, updated_at}` propagate deletes.

## Patterns worth lifting
- **6-digit email code auth** — no passwords. Codes hashed at rest, 10min expiry, locked after N attempts, anti-enumeration always-200.
- **JWT bearer** in `storage.local`; hashed at rest server-side.
- **Optimistic concurrency** — `{data, version}` GET/PUT, 409 + reconcile-once on mismatch.
- **Merge-by-id + LWW on `updated_at` + tombstones** — concurrent edits converge without server resolution.
- **Per-device shards** — each install writes its own slice, reads sum across. Sidesteps merge for append-only data.
- **Canonical JSON for equality** — recursive key sort before `stringify`; otherwise key reordering breaks no-op-sync detection.
- **Dual manifest, single src** — `dev.sh` swaps the right one in. No build step.

## Storage
- **SQLite WAL** for auth: `users`, `login_codes` (hashed), `email_rate_limits`, `ip_rate_limits`. Pruned every 5min.
- **S3** (`curb-extension`, keyed by email): `policies.json`, `devices.json`, `usage/<deviceId>.json`.

## External touch points
- **AWS S3** — synced documents (`curb-extension`); ETag concurrency. IAM `curb-server`: `s3:ListBucket` + `Get/Put/DeleteObject`.
- **AWS SES** — sign-in code emails only. `EMAIL_FROM` must be verified. No `console.log` fallback.
- **GitHub Actions** — tag `v*` → build + attach zips to Release.
- **AMO + Chrome Web Store** — manual zip upload. Privacy URL at `lawrencehook.com/curb/privacy-policy/` (separate repo, Netlify).

## Gotchas
- Chrome MV3 content scripts via symlinks → silently empty.
- `<input type="time">` rejects `24:00` → clamp display to `23:59`.
- `chrome://newtab/`.hostname is `"newtab"` → filter on `http:`/`https:` protocol.
- `policies[]` contains tombstones — go through `livePolicies()`.
- MV3 service workers sleep. No ambient state.

## Release
- `git tag -aF <msg> vX.Y.Z && git push origin vX.Y.Z` → CI builds & releases. `gh release edit --notes-file` to set body (action doesn't pull tag message).
