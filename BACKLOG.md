# Backlog

- **Custom redirect on block** — per-policy redirect URL (or randomized pool); replaces the rendered blocked page when set.
- **"Opens in ~Xm" indicator for sliding rules** — surface in the popup when access will be possible again as the window slides off.
- **Unit tests that run in CI** — start with the sliding-window straddle-midnight case (fake `Date.now` to accrue pre-midnight usage and assert post-midnight evaluation still counts it).
- **Friction features (access gates)** — password prompt, wait-N-seconds delay, typing challenge. Placeholder card already in the policy view.
- **Icon rebrand** — redraw to look like a reverse sigmoid (declining curve).
- **New primary color** — move away from purple. Picks a palette that works across popup, edit page, blocked page, and overlay.
- **UI refinement pass** — iterate on buttons, spacing, info density across the whole surface.
- **Refresh store screenshots** — the ones in `screenshots/` predate the popup redesign, edit page tabs, schedule card, and blocked-page rewrite.
- **Session-based tracking** — replace the 1-Hz `tick()` in `background/main.js` with `(activeSince, domain)` accounting committed on focus/tab change, plus a precomputed `setTimeout(blockTab, remainingSec * 1000)`; cuts storage writes and `evalRule` calls ~60× and makes blocks land at the millisecond.
