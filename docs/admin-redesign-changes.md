# Admin redesign: change summary

Branch `admin-multiuser-hardening`, in two worktrees: frontend (AxiomFrontend-admin-hardening) and backend (Axiom26-admin-hardening).
**Status: not deployed. No database migrations have been applied.**

## 1. What admins will notice

- **Live is the home screen, split into three stations.** Anyone can switch at any time; the station only changes the layout.
  - **Director** (laptop): room grid, draw, rooms, publish, motion, Advance, activity feed.
  - **Desk** (phone): check-in, venue QR, scan a personal pass or type its short code.
  - **Results** (phone or laptop): judge ballot links, flagged ballots, paper ballot entry.
- **Room grid** colours mean one thing each: waiting (grey), live (blue), ballot in (green), needs a person (red).
- **Display** (`/admin/display`, opens in a new tab): read-only projector screen with draw, motion and the venue check-in QR.
- **Jump to (⌘K or Ctrl+K)**: find a room or debater, run round actions.
- **E-ballots**: each judge gets a private link and QR from Results. No account needed. A submitted ballot counts at once. Unusual ballots are flagged for review, never blocked (for example a margin of 15 points or more, or a tie resolved by hand).
- **Venue check-in**: debaters scan the rotating QR on the Display or Desk. Walk-ins are handled at the Desk with a personal pass. Participants see their pass on the dashboard.
- **Advance (best losers)**: the system proposes a ranked list of losers and a cut line that reaches the advance target (Auto, 8 to 128, or custom).
- **Presence and soft locks**: "Riya is here" appears on a debate someone else has open. It is a warning only.
- **Activity feed**: a live trail of promotions, results, check-ins and similar actions.
- **Conflict warnings**: if another admin changed the same promotion list or result, you get a conflict message instead of a silent overwrite.

## 2. Navigation: old route to new route

Source: `src/App.jsx` and the redirect components.

| Old URL | New URL |
|---|---|
| `/admin/overview`, `/admin/events`, `/admin/rounds` | `/admin/setup` |
| `/admin/events/:id` | `/admin/setup/:id` |
| `/admin/rooms` | `/admin/setup?tab=rooms` |
| `/admin/participants` | `/admin/people?tab=registry` |
| `/admin/leaderboard` | `/admin/results?tab=standings` |
| `/admin/rounds/:id` | `/admin?round=:id&station=director` |
| `/admin/rounds/:id/promotion` | `/admin?round=:id&station=director&panel=advance` |
| `/admin/results/:id` | Live, Results station, ballot sheet for that debate open |

Query strings are kept on the redirects. Five places remain: Live (`/admin`), Setup, People, Results, Display. `/admin/settings` is still a placeholder.

New public pages: `/ballot/:token` (judge e-ballot) and `/checkin/:roundId?c=CODE` (venue check-in, needs participant sign-in).

## 3. API routes and socket events

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/admin/rounds/:id/ballot-links` | admin | Creates any missing judge tokens on first call |
| GET | `/api/admin/rounds/:id/venue-code` | admin | Current rotating venue code |
| GET | `/api/admin/rounds/:id/promotion-proposal` | admin | Ranked losers and cut line |
| GET | `/api/admin/activity` | admin | Activity feed |
| POST | `/api/admin/rounds/:id/promote` | admin | Preferred body `{add, remove}`. Legacy `{userIds, expectedPromotedIds}` returns 409 `PROMOTION_CONFLICT` if the list changed |
| GET | `/api/ballot/:token` | judge (token) | Rate limited |
| POST | `/api/ballot/:token` | judge (token) | Rate limited. Missing scores rejected |
| POST | `/api/check-in/venue` | participant | Rate limited. Code must be current |
| POST | `/api/check-in/scan` | admin | Personal pass or short code |
| GET | `/api/users/me/checkin-pass` | participant | QR token and short code |

Socket events (server to clients):
- `presence:update` (admin to server) and `presence:state` (server to that round's admins). Non-admin senders are ignored.
- `ballot:submitted`, `round:promotions`, `activity:new`: to admins of the round or event.
- `rooms:updated`, `dashboard:changed`: to all admins.

## 4. Database and configuration

Apply in this order with `prisma migrate deploy`. None are applied yet.

1. `20261117120000_add_debate_fk_indexes`: indexes on `Debate` for room, adjudicator and winner. No data change.
2. `20261117130000_eballots_checkin_activity`: adds `Round.advanceTarget`; adds to `Debate` the `ballotToken` (unique), `resultSource`, `ballotFlags`, `resultSubmittedAt`, `ballotJudgeName`; creates the `AuditLog` table (no foreign keys, so entries survive deletions). All additive and nullable.
3. `20261117140000_round_pairings_published_at`: adds `Round.pairingsPublishedAt` and backfills already-published rounds with their last update time.

`prisma/schema.prisma` matches these migrations.

**New env var `CHECKIN_CODE_SECRET`** (in `.env.sample`, empty by default). It signs venue codes and personal passes. If unset, it falls back to a key derived from `ADMIN_SECRET_KEY`, then `CLERK_SECRET_KEY`. Changing it invalidates every printed pass. Generate with `openssl rand -base64 32`.

**New frontend dependency:** `qrcode` 1.5.4 (in `package.json` and `bun.lock`). Install before building.

## 5. Behaviour changes

- **Elimination:** a promotion only rescues a loss from the same round. A later unpromoted loss still eliminates.
- **Empty scores:** admin results and e-ballots are rejected if either score is missing (`SCORES_REQUIRED`).
- **Locks:** ballot saves and check-ins wait up to about 10 seconds behind pairing or room allocation for the same round. Pairing itself returns 409 `PAIRING_IN_PROGRESS` if another admin holds the lock.
- **Advance:** per-person toggles are replaced by one ranked list with a cut line. Saving sends the whole list, and a stale list gets a 409.
- **Ballots:** judge ballots count immediately. Flags are for review only.
- **Removed pages:** `AdminDashboard.jsx` and `AdminRounds.jsx` are deleted. The old round and promotion pages redirect into Live.
- **Venue codes:** they change every few seconds and only work inside the check-in window.

## 6. Before going live

- [ ] Back up the database, then run `prisma migrate deploy` (three migrations above).
- [ ] Set `CHECKIN_CODE_SECRET` in production before printing any passes.
- [ ] Run `bun install` in the frontend (new `qrcode` dependency).
- [ ] Two-browser test: two admins edit the same debate result at once. One should get a conflict message, not a silent overwrite.
- [ ] E-ballot from a phone: scan a judge QR, submit, and confirm the debate turns green on Results.
- [ ] Venue QR from a phone during an open check-in window. Confirm an old code is refused.
- [ ] Run one backend instance only. Presence (`src/utils/presence.ts`) is in memory, rate limits are in memory, `node-cache` holds the cache, and Socket.IO has no Redis adapter. A second instance would show different presence and miss live updates.

Builds and tests were not run for this summary.
