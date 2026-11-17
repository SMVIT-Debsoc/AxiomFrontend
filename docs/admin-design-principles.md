# Axiom admin — design principles & decisions

Decided with the product owner, 2026-11-17. Every admin screen follows this.

## Settled decisions
- **Format:** 1v1 knockout only (GOV vs OPP, one score each). R1 random, then power-match. Swing fills odd slots. Lose → out unless promoted *in that same round*.
- **Scale target:** 200+ debaters → ~100 debates / rooms in R1. Every list and grid must stay fast and legible at 100 rooms / 250 people.
- **Promotion = saving a loser** (best-loser slot). The system **proposes** a ranked best-loser list with a cut line to reach the round's **advance target**; the Director accepts or adjusts. Advance target per round: `auto` (smallest power of 2 ≥ winners) or a fixed number.
- **Stations** (same permissions for everyone; a station only reshapes the screen; anyone can switch any time):
  - **Director** (laptop): round control tower, pairings, publishing, promotions, overrides, activity feed.
  - **Desk** (phone): check-in, walk-ins, absences → Swing, room problems.
  - **Results** (phone or laptop): missing-ballot chasing, flagged-ballot review, paper fallback entry.
  - **Display** (projector): draw + motion + venue check-in QR for the main hall. Read-only.
- **Check-in:** primary = debater scans a **venue QR** (rotating code, only valid during the window) on the Display/Desk; walk-ins/problems = Desk scans the debater's **personal pass** QR or types its short code; last resort = manual search.
- **Ballots:** judges submit **e-ballots** from a per-debate private link/QR (no accounts). They **count immediately** (no second confirmation). Unusual ballots are **flagged, never blocked**, and surface on the Results station. Admins enter paper ballots as fallback.
- **Shared awareness:** presence ("Riya · Desk"), **soft locks** ("Arjun is scoring Room 12" — warn, never block), and a round **activity feed** (doubles as audit trail).
- **Information architecture:** five places — **Live** (stations) · **Setup** (event, rounds, rooms, advance targets) · **People** (one registry + per-event enrolment) · **Results** (results & standings) · **Display**. Old duplicate pages redirect into these.
- **Director is keyboard-first:** ⌘K command bar (jump to room/debater, run round actions); paper ballot entry fully keyboard-driven.

## Principles (the "laws" we hold ourselves to)
1. **Visibility of system status** (Nielsen #1). Every screen answers in one glance: *what state is the round in, what's blocking, what's next.* The Director's room grid is an airport departures board.
2. **One primary action per screen** (Hick's law). One filled button = "Do this next". Everything else is secondary/ghost.
3. **Fitts's law on phones.** Targets ≥ 48px, primary actions in the bottom thumb zone, no hover-only affordances.
4. **Doherty threshold.** Feedback < 400ms: optimistic UI with per-item rollback; never block the screen on a spinner for a single toggle.
5. **Progressive disclosure.** Rare/advanced tools live behind "More" or the ⌘K bar, not on the main surface.
6. **Tesler's law.** The system absorbs complexity: proposals, sensible defaults, auto targets. The admin confirms, they don't compute.
7. **Calm technology.** Colour is reserved for state. Toasts only for errors and other people's important actions. No decorative motion; motion only to explain change (a tile turning green).
8. **Forgiveness over interrogation.** Confirm only irreversible or audience-visible actions (publish/unpublish, regenerate after publish, delete, mark round complete). Everything else is undoable or editable.
9. **Consistency.** One component per job, one word per concept, everywhere: **Draw** (not pairings, in UI copy), **Ballot**, **Advance/Advanced** (promotion), **Room**, **Swing**, **Check-in window**.
10. **Keyboard parity** for the Director; **one-handed use** for Desk.
11. **Multi-admin by default.** Every list is live; every edit is conflict-safe (expectedUpdatedAt / 409 handling already exists — keep it); every important action is attributed in the activity feed.

## Visual language
- Keep the brand: carbon `#1D1E18` / olive `#6B8F71` / celadon / frozen-water; Bebas Neue for display numbers & round titles, League Spartan for headings/labels, Inter for body; tabular numbers for all counts and scores.
- **One admin dialect:** the `ax-*` classes (`ax-card`, `ax-primary-btn`, `ax-ghost-btn`, `ax-chip`, `ax-signal-*`). Retire the generic `bg-card/70 rounded-xl` pages into it.
- **State colours** (src/index.css): `ax-state-waiting` (grey), `ax-state-live` (blue — debate running), `ax-state-done` (green — ballot in), `ax-state-flag` (red — needs a human), plus `ax-state-dot`. Never use colour for anything else on the Live screens.
- **Density by station:** Director = compact (laptop, many rows); Desk/Results on phone = comfortable (large rows).
- **Display:** maximum contrast, huge type, no chrome, readable from 15m; auto-paginates/scrolls; sorted by debater surname.

## Shared code contracts (already in the repo)
- `OpsApi` in `src/services/api.js` — e-ballots, venue code, personal pass, scan, promotion proposal, activity.
- `SOCKET_EVENTS` additions in `src/services/socket.js` — `PRESENCE_UPDATE`, `PRESENCE_STATE`, `ACTIVITY_NEW`, `BALLOT_SUBMITTED`, `ROUND_PROMOTIONS`, `ROOMS_UPDATED`, `DASHBOARD_CHANGED`.
- `usePresence`, `othersFocusedOn` (`src/hooks/usePresence.js`); `PresenceBar`, `SoftLockBadge`, `ActivityFeed`, `QrCode` (`src/components/ops/`). Signatures are documented in each file.
- `useAdminMutation`, `useDirtyGuard`, `useAdminRealtime`, `src/lib/liveMerge.js` — use these, don't reinvent.
