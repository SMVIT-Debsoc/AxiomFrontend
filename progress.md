# Production-readiness continuation log

Last updated: 2026-10-12 (Asia/Kolkata)

## Owner direction and scope

- Owner asked for a full production audit, actual fixes, user-onboarding/event tests, and this handoff file.
- Owner clarified the auth provider is **Better Auth**, not Clerk.
- Frontend checkout: `/home/rosso/Projects/AxiomFrontend`. Baseline HEAD before this work: `50a909693689d18c3d3796b233d7ec787cf7d9ff`.
- API checkout used for the connected contract: `/home/rosso/Projects/Axiom26`. Baseline HEAD before this work: `86cb582016bcbdcdc60e7440a23c2406fe73a4f7`, branch `main`.
- No staging URL, dedicated accounts, actual production environment values, database target, SMTP account or deployment verification access was supplied. **Do not claim READY until the release gates below are verified.**
- No migration was applied and no database/event records were modified. Do not run seed/migration/integration tests against any database unless it is confirmed disposable or an approved staging target.
- Frontend `.agent-team/` is user-owned untracked data; preserve it unchanged.

## Implemented in this work

- Replaced frontend temporary Auth.js/Clerk shim with Better Auth email/password sessions using HTTP-only cookies; added distinct sign-up/sign-in screens and password-reset screens. No fabricated bearer token is sent.
- Removed the frontend passcode auth handler and Vercel auth rewrite. Updated API calls to include cookies, reject `{success:false}` even on HTTP 200, and keep failed profile checks gated with retry UI.
- Fixed participant registration navigation; profile completion no longer claims event enrollment/check-in; enrollment is explicit and only reported after API confirmation. Added 404 recovery, live check-in-window boundary updates, and free-text assigned judge display.
- Fixed user sign-out; browser test caught and corrected a broken sign-out handler.
- Replaced backend Clerk middleware/controller lookups with Better Auth session validation, verified-email participant/admin linking, database-side admin authorization, Better Auth email verification/reset callbacks, secure production config requirements, exact-origin CORS, Helmet, readiness check and rate limits on Better Auth endpoints.
- Preserved participant/admin/tournament records. Added `authUserId`, separate Better Auth tables, and made the old `clerkId` database columns nullable via Prisma field aliases (`legacyAuthId`) in the additive migration:
  `/home/rosso/Projects/Axiom26/prisma/migrations/20261012090000_better_auth/migration.sql`
- Added Better Auth socket authentication and event membership/admin checks before joining event/round rooms; browser sends credentials and disconnects on sign-out.
- Removed the legacy Azure deployment workflow files; added readiness and Render deployment configuration in the follow-up section below.
- Removed unused backend Clerk/axios/bcrypt/JWT/Morgan packages; moved Prisma CLI to dev dependencies; aligned Prisma packages at 7.10.0 and applied semver-safe `npm audit fix` updates.
- Read the `vercel:auth` skill and used official Better Auth integration/Prisma/session guidance; owner instructions took precedence over its general auth options.

## Final local verification (rerun 2026-10-12)

Frontend (`/home/rosso/Projects/AxiomFrontend`):

- `npm run lint`: PASS, no errors or warnings after the current last UI fix.
- `npm run build`: PASS. Vite outputs `dist`; main JS is 820.04 kB minified (221.39 kB gzip), above Vite's 500 kB warning threshold.
- `npm test`: PASS, 30/30 unit/API contract/date tests.
- `npm run test:readiness`: PASS, 3/3 repository/config checks.
- `npm run test:browser`: PASS, 36/36 isolated Chromium UI/API fixtures including sign-out, signup UI, blocked onboarding outage, explicit enrollment, check-in opening/closing, judge display, admin denial, and event CRUD UI. Latest output: `audit-artifacts/browser-results.json` (ignored).
- `npm audit --omit=dev`: PASS, zero production dependency advisories at the last check.
- Browser tests mock Better Auth and all business API/socket traffic. They are not server-session, SMTP, persistence, or live authorization evidence.

Backend (`/home/rosso/Projects/Axiom26`):

- `npx prisma validate`: PASS.
- `npm run build`: PASS, Prisma client generation and TypeScript compile.
- `npm test`: structural unit check passes; PostgreSQL integration checks are explicitly skipped because nothing listens at local `localhost:5432`. The test command's success does not mean DB behavior passed.
- `git diff --check`: PASS in both checkouts.
- `npm audit`: 7 high findings remain; `npm audit --omit=dev`: 4 high Prisma CLI/tooling findings remain through the optional Prisma adapter peer graph. `npm audit fix --force` recommends downgrading Prisma to v6, incompatible with the current Prisma 7 adapter/schema plan, so it was not applied. Reassess after Prisma 7 publishes a compatible patched release.
- No Better Auth server/database session roundtrip was possible. Do not apply the migration to an unknown target.

## Exact release blockers / next work

1. Confirm the canonical deployed frontend and API. The Azure workflows are removed. Render GitHub Actions now run CI and require a manual workflow dispatch to deploy via the per-repository `RENDER_DEPLOY_HOOK_URL`; API Blueprint disables native auto-deploy. Confirm Render frontend route configuration and actual canonical origins before deploying. The existing `vercel.json` still points at an App Runner API, so do not treat it as Render routing.
2. Provision an isolated PostgreSQL staging DB and configure backend secrets there: unique `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL`, `FRONTEND_URL`, exact `CORS_ORIGIN`, `DATABASE_SSL=true`, `ADMIN_SECRET_KEY` (24+ chars), and SMTP settings. Values must stay secret.
3. Review the additive migration against the actual staging schema, back up staging, apply `prisma migrate deploy` there, and test repeatability/rollback planning. Never migrate production without explicit owner go-ahead and confirmed backup.
4. Run real signup → email verification → session persists on refresh → sign-out revokes session; bad/duplicate password, expired link, password reset, recovery-email delivery, and hostile-origin/CSRF checks.
5. With two real staging accounts (participant/admin), verify email-based linking preserves old profile and admin rows; prove participant admin writes are denied by API; exercise profile save, explicit enrollment and persisted roster, valid/early/late check-in, published pairing/room/judge/time, score persistence/publication/qualification, and second-round eligibility.
6. Verify sockets with real sessions, event membership, admin channel access, publication privacy and reconnect.
7. Resolve the remaining high Prisma CLI advisories without an incompatible forced downgrade. Review whether the app's installed runtime image includes dev-only Prisma CLI.
8. Re-run frontend and backend checks after any changes, then deployed smoke tests for deep links, cookie attributes, same-origin proxy, API availability, health readiness, TLS, recovery email and operator rollback.

## Safety / continuation notes

- Backend production startup now intentionally fails if Better Auth URL, frontend origin list, strong secrets, SMTP, or verified PostgreSQL TLS are missing. Development email callbacks print a local verification/reset link only in development.
- Better Auth rate limiting currently uses its in-memory store. If the API runs multiple instances, configure supported shared secondary storage and test the policy.
- Database integration output is not auth integration evidence. `npm run test:integration` requires an available disposable DB and should fail when unavailable.
- The audit verdict remains **NOT VERIFIED FOR PRODUCTION** until real staging auth, database persistence, email, deployment routing and the end-to-end tournament journey pass.


## Deployment workflow follow-up (2026-10-12)

- Removed both Azure workflows from `/home/rosso/Projects/AxiomFrontend/.github/workflows/`.
- Added frontend and API GitHub Actions that run repository checks on PRs and pushes to `main`. A separate `workflow_dispatch` input gates Render deploy hooks; ordinary code pushes do not call the hook.
- The Render hook secret must be configured separately in each repo as `RENDER_DEPLOY_HOOK_URL`. Missing it causes an explicit workflow failure only when an operator checks `deploy` and dispatches the workflow.
- Updated `/home/rosso/Projects/Axiom26/render.yaml` to use Better Auth/SMTP/Postgres TLS variables and `autoDeployTrigger: off`. Its existing startup command still runs `prisma migrate deploy`; only dispatch an API deployment after reviewing the target staging DB and backup.
- Frontend hosting is not fully provisioned in code: the Render frontend service URL and same-origin `/api/*` and `/socket.io/*` routes remain unconfirmed. Disable frontend Render dashboard auto-deploy to avoid a second deploy when using the hook.
- Verification for this follow-up passed: frontend lint, build, 30 unit/contract tests, 3 readiness tests, and 36 Chromium fixtures; backend Prisma validation/build/unit check; Python YAML parsing for both Actions workflows and the API Blueprint; `git diff --check` in both repositories.
- No Render secret was read or used and no deploy hook was triggered. Live Render service routing, secrets, DB migration, SMTP, and participant/admin journeys remain BLOCKED until a verified staging target and Render service configuration are available.

## Signup typo check and profile-completion enrollment (2026-10-12)

- Added a rate-limited public `POST /api/users/check-email` preflight. It checks one-character email edits against Better Auth accounts, participant records, and admin records using exact indexed email lookups. The API returns only a boolean typo warning and never returns a matching address.
- The registration form requires an extra confirmation when a near-match exists. Editing the email clears that confirmation. When Better Auth reports an existing account at signup, the user is routed to normal sign-in with the email prefilled and an account-exists notice.
- Profile completion now calls idempotent backend auto-enrollment for the configured `AXIOM_EVENT_ID`, or the latest upcoming/ongoing event whose name starts with “Axiom”. It refuses to enroll incomplete profiles or into closed/arbitrary events. A successful completion opens the enrolled event; if automatic enrollment is unavailable, it opens the event list with an explanatory notice.
- Added backend unit coverage for one-edit candidates, an API request contract, and browser fixtures for typo warning, existing-account sign-in routing, and profile-completion auto-enrollment.
- Files changed in both repos: frontend auth/API/profile/browser tests; API user controller/routes, auto-enrollment helper, rate-limit middleware, email similarity utility, and unit tests. No schema migration is needed.
- Validation for this feature: frontend lint/build pass; 31 frontend API/date tests, 3 readiness checks, and 38 browser fixtures pass. API build and Prisma validation pass; 3 email-similarity tests pass. The API auto-enrollment integration check skipped because no local PostgreSQL is listening. Real Better Auth, SMTP, database writes, and configured Axiom event enrollment remain staging-only checks.

## Sign-in and registration UX (2026-10-12)

- Reworked the shared auth frame to make Sign in and Create account a prominent segmented switch and added a second high-visibility create-account callout on sign-in.
- Registration now explains the sequence (account → profile → event), gives the form a clear participant heading, adds a password-length hint, and keeps the active action prominent. The existing typo confirmation and duplicate-account redirect remain in place.
- Kept AXIOM's green/ink palette, raised card shadows, inset input surfaces and hard-edged CTA treatment. Tuned desktop/tablet/mobile sizes, focus rings, and reduced-motion behavior. Forgot/reset password pages were checked after the auth-card styling update.
- Local preview: `http://127.0.0.1:5173/sign-up` (development server was started for the UI review; stop it after work is complete).
- Validation: lint, build, 31 unit/API/date tests, 3 readiness checks, and all 40 isolated browser fixtures pass, including mobile registration overflow and persistent password recovery layouts. The production JS chunk remains above Vite's existing 500 kB advisory threshold. At that stage, no deployment or push had been performed; see the follow-up below.

## Push and CI follow-up (2026-10-12)

- Frontend changes were pushed to `main`: `a2193b8 feat: improve registration onboarding flow`; CI initially exposed a Vite startup wait race in the browser audit harness. Updated the harness to poll the local HTTP response and include server logs on startup failure, then pushed `59f5259 test: make browser audit startup reliable in CI`.
- Backend changes were pushed to `main`: `8d521c7 feat: improve signup validation and event enrollment`.
- Verification after the harness correction: frontend lint, build, 31 unit/API/date tests, 3 readiness checks, and 40 browser fixtures pass locally and in GitHub Actions. API Prisma validation, build, and unit tests pass in GitHub Actions. API database integration checks remain skipped because no local PostgreSQL is available.
- GitHub Actions runs: frontend `https://github.com/SMVIT-Debsoc/AxiomFrontend/actions/runs/38227114407` (success); API `https://github.com/SMVIT-Debsoc/Axiom26/actions/runs/38226885560` (success). Push-triggered CI does not deploy.
- No Render deployment was triggered. At audit time, neither repository had a `RENDER_DEPLOY_HOOK_URL` Actions secret. The canonical Render frontend/API origins and frontend proxy routing are also unconfirmed; `vercel.json` still targets the legacy App Runner API. Configure and verify staging before dispatching deployment, especially because the API startup command applies Prisma migrations.
- Remaining user/staging tests: real Better Auth signup/email verification/session refresh/sign-out/password recovery; typo warning and duplicate-account routing against staged data; profile completion and persisted auto-enrollment into the intended event; participant/admin authorization boundaries; persisted event/round/pairing/check-in/scoring/results/qualification flow; socket access and reconnect; deployed cookie, TLS, proxy, health/readiness, and rollback smoke tests.
- Audit verdict remains **NOT VERIFIED FOR PRODUCTION** until isolated staging database, SMTP, deployment routing, and real end-to-end journeys pass. Preserve `.agent-team/` as user-owned data; it remains untracked and was not included in commits.

## Participant-only entry and Google OAuth wiring (2026-10-12)

- Replaced the public organizer/debater role chooser with a participant-only entry. The entry focuses on AXIOM event onboarding and offers Google, email sign-in, and email registration; removed marketing sections from that entry screen.
- Removed the duplicate small Create account / Sign in links from below the auth form. The prominent Sign in / Create account switch remains. Added a neomorphic Google button to the public entry, sign-in, and registration screens.
- Removed browser-based admin onboarding and public admin-key validation UI/API. Existing admins authenticate through the shared sign-in and are redirected to the protected `/admin` workspace after the API role check. The public `/api/admin/validate-key` endpoint was deleted; the protected backend `/api/admin/onboard` route remains for the existing provisioning workflow.
- Configured optional Better Auth Google social provider with paired `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` API environment values. A partial pair fails fast; the UI stays hidden unless Vercel's build-time `VITE_GOOGLE_AUTH_ENABLED=true` is set. Render's API manifest includes both secret variables. Setup notes are in `/home/rosso/Projects/Axiom26/docs/google-oauth-setup.md`.
- Owner's Vercel screenshot confirmed public frontend origin `https://axiom40.vercel.app`. Current `vercel.json` routes `/api/*` through that origin to the legacy App Runner API; Google callback is documented as `https://axiom40.vercel.app/api/auth/callback/google`, with `BETTER_AUTH_URL` set to the same public origin. Store credentials on the API service that actually serves this proxy target; Vercel env only needs the public feature flag.
- Verification: frontend lint/build, 31 API/date unit tests, 4 readiness checks, and all 42 isolated Chromium fixtures pass. API Prisma validation/build and 3 unit checks pass. API PostgreSQL integration tests remain skipped because no local database is running. Browser fixtures mock the Google exchange; no real Google client credentials have been configured or exercised.
- Visual review confirmed the public entry and the account-mode switch keep the AXIOM neomorphic styling. Build still emits the existing large-JavaScript-chunk advisory.
- The participant auth and Google OAuth wiring changes were pushed in frontend commit `292805e` and API commit `e436d4f` on 2026-10-12. Google remains gated until the API provider credentials and frontend `VITE_GOOGLE_AUTH_ENABLED=true` are configured. Never commit or paste the client secret in chat. Then perform real Google new-user, returning-user, verified-email linking, session, profile completion, and event auto-enrollment tests.

## Vercel Web Analytics (2026-10-12)

- Added `@vercel/analytics` and mounted the React Analytics component within the React Router app so client-side route transitions are reported.
- Normalized event/admin record paths and collapsed auth subpaths before sending page views. Query strings are excluded because the tracker reads React Router's `pathname`; event and record IDs are not exposed in analytics paths. Unknown paths are grouped as `/other` to avoid collecting arbitrary URL segments.
- Added unit coverage for static routes, dynamic route normalization, and auth path collapsing.
- Verification: lint, 35 unit tests, 4 readiness checks, 42 browser fixtures, and production build pass. Existing Vite chunk-size advisory remains.
- Vercel's project dashboard must have Web Analytics enabled for production events to arrive; after deployment, verify visits in the Web Analytics panel.

## Push and production verification (2026-10-12)

- Pushed frontend `292805e feat: ship participant auth and analytics flow` and API `e436d4f feat: configure Google auth and remove public admin key` to their `main` branches.
- GitHub Actions passed for both pushes: frontend run `38231602724` (lint, unit/readiness tests, build, 42 browser fixtures); API run `38231602895` (Prisma validation, build, unit tests; local PostgreSQL integration skipped).
- Verified `https://axiom40.vercel.app` serves the new frontend bundle and `/_vercel/insights/script.js` returns HTTP 200. User can test the deployed participant sign-in/registration UX and analytics integration.
- Render deployment is being handled separately. At this stage the Vercel `/api` rewrite still targeted the App Runner host in `vercel.json`; the follow-up entry below records when it was changed to Render. No OAuth secrets were read or changed in this task.

## Restore original landing page content (2026-10-12)

- Restored the original AXIOM landing-page composition around the participant entry card: AXIOM hero logo/sticker, Discover AXIOM link, scrolling Tape, discourse/editorial sections, and footer.
- Kept the current participant Sign in / Create account card as the landing-page access control, with Google sign-in shown when the frontend feature flag is enabled. The public admin entry remains hidden.
- Extended the browser audit to assert the scrolling sections and footer remain present alongside participant access and Google sign-in, preventing a future auth-page refactor from silently replacing the landing page.
- Validation underway: lint, production build, readiness/unit tests, and full browser audit. The frontend build still reports the existing >500 kB JavaScript chunk advisory.
- Preserve the untracked `.agent-team/` directory; it is user-owned and is not part of this fix.

## Route Vercel API traffic to Render (2026-10-12)

- Rechecked `https://axiom26-aezg.onrender.com`: after the service warmed up, `GET /health/live` returned 200, `GET /api/auth/get-session` returned 200 with an anonymous `null` session, and invalid `POST /api/auth/sign-up/email` returned the expected 400 validation response. This confirms the Better Auth routes are now live.
- `POST /api/auth/sign-in/social` with provider `google` returned `PROVIDER_NOT_FOUND`. Google OAuth is still not enabled on the Render API; its operator must add both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and redeploy.
- Updated Vercel rewrites for `/api/*` and `/socket.io/*` to `https://axiom26-aezg.onrender.com`, replacing the previous App Runner target. Once deployed, participant email auth should use the live Render API through same-origin Vercel routes.
- Frontend commit `239fb06 fix: route production API through Render` is pushed to `main`; GitHub Actions run `38240987754` passed (lint, 35 unit tests, 5 readiness checks, build, and browser audit). Render deployment was not triggered.
- Production verification is still pending: after this push, `https://axiom40.vercel.app/api/auth/get-session` continued returning an empty Vercel 404, so the live domain had not demonstrated the new rewrite yet. Confirm Vercel has a successful production deployment for commit `239fb06`, then recheck the same endpoint before user signup testing.
- No Render deployment was triggered, and no secrets were read or modified.

## Recheck Google OAuth origin failure (2026-10-12)

- Live `https://axiom40.vercel.app/api/auth/get-session` and Render `https://axiom26-aezg.onrender.com/api/auth/ok` respond successfully. The Render response includes `Access-Control-Allow-Origin: https://axiom40.vercel.app`, confirming the frontend reaches the intended API and its CORS allowlist accepts the canonical site.
- A browser click on “Sign in with Google” sends `POST https://axiom40.vercel.app/api/auth/sign-in/social` with provider `google` and callback `https://axiom40.vercel.app/auth-redirect`; it returns HTTP 500 with an empty body. The same POST directly to Render also returns HTTP 500. Invalid-shape email/social POSTs return the expected Better Auth 400 validation errors, so auth routing is active.
- The API GitHub `origin/main` is at `dd0cdee`; commit `3be6324` explicitly adds `https://axiom40.vercel.app` to Better Auth `trustedOrigins` and uses `RENDER_EXTERNAL_URL` as a base-URL fallback. This checkout is behind by four commits, and the live Render deploy SHA cannot be verified through public health/auth endpoints. Render’s `autoDeployTrigger` is off, so verify the deployed SHA is at least `3be6324` (prefer current `dd0cdee`).
- The remaining live fault is on the Google social sign-in handler: Render logs for the failed request are needed to distinguish stale deployed auth config from missing/mismatched Google OAuth credentials or another provider initialization error. Do not change frontend routing or secrets based only on the UI’s generic “Invalid origin” label. No secrets were read or modified.
- Follow-up live check: Render `/health/live` and `/api/auth/get-session` return 200; a malformed email sign-in reaches Better Auth and returns its expected 400 validation body, which demonstrates that the canonical Vercel origin is accepted on the live auth server. A well-formed Google `sign-in/social` request still returns HTTP 500 with an empty response both directly on Render and through Vercel. Current outcome: routing/origin are functioning; Google provider startup/configuration remains broken. Render logs are required to identify the exact provider-side cause and confirm its deployed commit.

## Clerk Browser Audit & CI Lockfile Verification (2026-11-14)

- **Completed work**:
  - Added isolated `VITE_AUTH_MOCK === "true"` fixture provider support in `src/auth/client.jsx` (including persistent `sessionStorage` fixture auth across sign-out redirects and mock `user.update`) while keeping real `@clerk/clerk-react` active whenever `VITE_AUTH_MOCK` is unset.
  - Unified `@clerk/clerk-react` imports through `src/auth/client.jsx` in `src/components/brand/AdminAccessModal.jsx` and `src/components/ApiAuthSync.jsx`.
  - Updated `tests/browser-audit.mjs` to test the active Clerk single-entry landing page (`/`), anonymous route guards, legacy auth route redirects (`/login-select`, `/sign-in`, `/sign-up`, etc.), separated `Admin Portal` secret-key modal, `CompleteProfile` onboarding and auto-enrollment flow, `/complete-profile` API failure recovery card ("Account setup is unavailable" / "Failed to fetch user details" / `Retry`), event enrollment, round check-in/pairings/results, admin CRUD, `AccountMenu` sign-out, unknown-route recovery, and mobile overflow.
  - Synchronized `package-lock.json` using official npm (`12.2.2`) so `npm ci` validates cleanly without missing lockfile entries.
- **Files changed**: `src/auth/client.jsx`, `src/components/brand/AdminAccessModal.jsx`, `src/components/ApiAuthSync.jsx`, `tests/browser-audit.mjs`, `package-lock.json`, `progress.md`. (Preserved untracked `.agents/` directory unchanged.)
- **Verification results** (after final code edit):
  - `npm run lint`: PASS (exit 0).
  - `npm test`: PASS, 43/43 tests across 5 files (`tests/readiness.test.mjs`, `tests/analytics.test.mjs`, `tests/authRedirect.test.mjs`, `tests/api.test.mjs`, `tests/datetime.test.mjs`) via Bun test runner.
  - `bun test tests/readiness.test.mjs`: PASS, 5/5 checks. (Note: `npm run test:readiness` directly fails locally because `/opt/homebrew/bin/node` wraps `bun run`, which rejects `node:test` outside `bun test`; real Node 22 runs in CI.)
  - `npm run build`: PASS (Vite production build in 2.69s; existing >500 kB chunk advisory on `index-BiLAOq1O.js` remains).
  - `npm run test:browser`: PASS, 38/38 isolated Playwright Chromium fixtures (`audit-artifacts/browser-results.json`). Note: browser tests use `VITE_AUTH_MOCK=true` and mocked `/api/*` + `/socket.io/*` responses; they do not verify live Clerk/Google OAuth or live PostgreSQL writes.
  - `/Users/rossonerian/.bun/bin/npm ci --dry-run`: PASS (exit 0).
- **Known issues & external blockers (unverified for live production)**:
  - Live Render backend (`https://axiom26-aezg.onrender.com/health`) returns `{"status":"degraded","database":"reconnecting"}` until the operator updates `DATABASE_URL` and `DIRECT_URL` in Render Dashboard with the Neon PostgreSQL connection strings.
  - Live Google Cloud Console OAuth Client must include `https://clerk.axiom4.online/v1/oauth_callback` under Authorized Redirect URIs (documented in `docs/google-oauth-setup.md`).
  - Live Clerk + Render + Neon end-to-end authentication and persistence on `https://www.axiom4.online` remain unverified until the external Render/Google Console updates are applied.
- **Next recommended task**: Update `DATABASE_URL` and `DIRECT_URL` on Render (`axiom26-backend`), verify `https://axiom26-aezg.onrender.com/health` reports `"database":"connected"`, confirm GitHub Actions CI passes on `main`, and run live Google OAuth sign-in on `https://www.axiom4.online`.

## UI Engineering Protocol & Mobile PROD Polish (2026-11-14)

- **Completed work**:
  - Created `DESIGN.md` at repository root documenting the authoritative AXIOM 4.0 surface/accent palette (`#1D1E18`, `#141510`, `#B9F5D8`, `#9FE3C2`, `#EAFBF5`, `#D4EDE1`, `#4A5646`, `#6B8F71`, `#B8D5C5`, `#a51818`, `#ff9c9c`), typography (`Bebas Neue`, `League Spartan`, `Inter`), responsive viewports (`1280×800`, `768×1024`, `390×844`), accessibility rules (`44×44px` minimum targets, `:focus-visible`, `prefers-reduced-motion`, decorative SVG `aria-hidden="true"`), and anti-slop guardrails.
  - Polished `src/components/brand/AdminAccessModal.jsx` and `src/pages/LandingPage.jsx`: replaced modal backdrop `backdrop-blur-sm` with solid `bg-black/75`, enlarged close and password visibility controls to `44px+`, added `autoComplete="off"` on `#admin-secret-key`, set `text-xs sm:text-sm` for mobile placeholder legibility, added `aria-hidden="true"` on decorative icons, exposed the `Admin` trigger pill in the mobile landing header, and surfaced the mobile `"Make your case."` Google CTA button.
  - Fixed mobile (`390×844`) responsive layout and CSS polish in `src/layouts/AdminLayout.jsx`, `src/pages/admin/AdminLive.jsx`, `src/pages/dashboard/EventDetails.jsx`, and `src/index.css`: single-line truncated `<select>` event switcher at `44px` height, equal-height `48px` single-line round-step pills (`Check-in`, `Pair`, `Rooms`, `Publish`, `Results`), `minmax(0, 1fr)` / `min-w-0` grid track constraints preventing card clipping on `/admin`, `.no-scrollbar` utility hiding thick horizontal scrollbar tracks on mobile tab bars, and solid `.neo-tabs` mobile bar background.
  - Updated `tests/dev-mock-server.mjs` and `tests/profiles.mjs` so `npm run dev:mock` builds with `VITE_AUTH_MOCK=true`, injects `window.__FIXTURE_AUTH__` / `sessionStorage.__fixture_auth__` / `isAdminSession` safely, and handles `/admin/onboard` and `/admin/dashboard` with event/debate fallbacks.
- **Files changed**: `DESIGN.md`, `src/components/brand/AdminAccessModal.jsx`, `src/pages/LandingPage.jsx`, `src/layouts/AdminLayout.jsx`, `src/pages/admin/AdminLive.jsx`, `src/pages/dashboard/EventDetails.jsx`, `src/index.css`, `tests/profiles.mjs`, `tests/dev-mock-server.mjs`, `progress.md`. (Preserved untracked `.agents/` directory unchanged.)
- **Verification results** (after final code edit):
  - `npm run lint`: PASS (exit 0).
  - `npm test`: PASS, 43/43 tests across 5 files via Bun test runner.
  - `bun test tests/readiness.test.mjs`: PASS, 5/5 checks.
  - `npm run build`: PASS (Vite production build in 2.86s; existing >500 kB chunk advisory on `index-CEAaJbGg.js` noted).
  - `npm run test:browser`: PASS, 38/38 Playwright Chromium audit fixtures (`audit-artifacts/browser-results.json`).
  - `/Users/rossonerian/.bun/bin/npm ci --dry-run`: PASS (exit 0).
  - Interactive browser visual audit (`browser` subagent `Model: "flash"` against `http://localhost:5175` mock server): PASS across Desktop (`1280×800`), Tablet (`768×1024`), and Mobile (`390×844`) with 0 console errors, 0 uncaught page errors, 0 failed network requests (`status >= 400`), and 0 horizontal overflow (`scrollWidth <= innerWidth`).
- **Known external production blockers (unverified)**:
  - Live `https://axiom26-aezg.onrender.com/health` checked at `2026-11-14T11:37:18.266Z` still returns `{"status":"degraded","database":"reconnecting","environment":"production"}` pending operator update of `DATABASE_URL` and `DIRECT_URL` on Render.
  - Live Google Cloud Console OAuth Client requires `https://clerk.axiom4.online/v1/oauth_callback` under Authorized Redirect URIs (`docs/google-oauth-setup.md`).
- **Next recommended task**: Execute the operator manual checklist on `https://www.axiom4.online` once Render `DATABASE_URL`/`DIRECT_URL` and Google Cloud Console OAuth redirect URI are active.

## Session Already Exists Fix on Landing Sign-In (2026-11-14)

- **Completed work**:
  - Updated `MockAuthProvider` (`signIn.authenticateWithRedirect`) in `src/auth/client.jsx` to mirror Clerk's `session_exists` error when `signedIn` is already `true`.
  - Exported `isSessionExistsError(failure)` in `src/auth/client.jsx` and updated `GoogleAuthButton` (`src/auth/client.jsx`) and `AdminAccessModal` (`src/components/brand/AdminAccessModal.jsx`) to check `useAuth().isSignedIn` before calling `signIn.authenticateWithRedirect`, clear stale admin flags on participant sign-in, and fall back cleanly to `window.location.assign("/auth-redirect")` when Clerk throws `session_exists` / already-signed-in errors.
  - Added regression assertions in `tests/authRedirect.test.mjs` and an E2E Playwright fixture test in `tests/browser-audit.mjs` verifying clicking `Sign in` on `/` while `signedIn: true` navigates directly to `/dashboard` with zero error alerts.
- **Files changed**: `src/auth/client.jsx`, `src/components/brand/AdminAccessModal.jsx`, `tests/authRedirect.test.mjs`, `tests/browser-audit.mjs`, `progress.md`.
- **Verification results** (after final code edit):
  - `npm run lint`: PASS (exit 0).
  - `npm test`: PASS, 44/44 tests across 5 files via Bun test runner.
  - `bun test tests/readiness.test.mjs`: PASS, 5/5 checks.
  - `npm run build`: PASS (Vite production build in 4.56s; existing >500 kB chunk advisory on `index-XnneG0Ef.js` noted).
  - `npm run test:browser`: PASS, 39/39 Playwright Chromium audit fixtures (`audit-artifacts/browser-results.json`).

## Local Backend & Full Auth Flow Verification + DB SSL Fix (2026-11-14)

- **Root cause diagnosed (`ACCOUNT SETUP IS UNAVAILABLE` / `Failed to fetch user details` on `/complete-profile`)**:
  - `axiom4.online` rewrites `/api/*` via `vercel.json` to `https://axiom26-aezg.onrender.com/api/*`.
  - Live `https://axiom26-aezg.onrender.com/health` reported `{"status":"degraded","database":"reconnecting","environment":"production"}` and `POST /api/users/check-email` returned `503`. When `/api/users/me` fails in `Axiom26/src/controllers/userController.ts`, the backend catches the DB error and returns `500 { success: false, error: "Failed to fetch user details" }`; `/auth-redirect` falls back to `/complete-profile`, where `OnboardingGuard.jsx` catches the `/api/users/me` failure and renders `"Account setup is unavailable"` / `"Failed to fetch user details"`.
  - Two backend causes and a CI/deploy blocker were identified in `/Users/rossonerian/Projects/Axiom26`:
    1. In `Axiom26/src/utils/prisma.ts`, `pg` (`ConnectionParameters`) overwrote `ssl: { rejectUnauthorized: false }` with `ssl: {}` (`verify-full`) whenever `DATABASE_URL` included `?sslmode=require`.
    2. `Axiom26`'s `package-lock.json` was out of sync with `package.json` after the Clerk migration commit (`3f4fbf8`), causing `npm ci` to fail in GitHub Actions (`API CI and Render deploy`) and blocking Render's `buildCommand: npm ci && npm run build`.
    3. On Render (`srv-db4ksuhsrm7s738408a0`), Render logs showed `Initial database connection attempts failed. Check DATABASE_URL in Render environment variables`, and inspecting `env-vars` via Render API showed `DATABASE_URL` was set to Neon's HTTPS PostgREST URL (`https://ep-fancy-haze-ao7irmlc.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb/rest/v1`) instead of the `postgresql://` connection string.
- **Backend & Render fixes applied**:
  - `src/utils/prisma.ts`: loaded `[".env.local", ".env"]`, added `resolvePgConnectionString()` fallback to `DIRECT_URL` if `DATABASE_URL` is missing or not a `postgres(ql)://` URI, detected Neon/Supabase/Render SSL URLs, and stripped `sslmode` / `channel_binding` query params when strict SSL is off so `ssl: { rejectUnauthorized: false }` is preserved in `pg.Pool`.
  - `src/index.ts`, `src/middleware/auth.ts`, `src/utils/socket.ts`, `src/controllers/adminController.ts`: mounted `/health/live`, `/`, and `/health` before Clerk middleware, guarded `clerkMiddleware()` when Clerk keys are absent, supported local `NODE_ENV !== "production"` dev Bearer tokens (`fixture-auth-token`, `mock-token-*`) and default dev `ADMIN_SECRET_KEY`, and made `getCurrentUser` first-sign-in user creation idempotent in `src/controllers/userController.ts` (`upsert` + `P2002` fallback).
  - `src/tests/autoEnrollUnit.test.ts`, `package.json`, `package-lock.json`: closed `pool.end()` cleanly in test teardown, added Node `--test` fallback in `npm test`, and resynced `package-lock.json` using npm `12.2.2`.
  - Updated Render `DATABASE_URL` via Render API (`PUT /v1/services/srv-db4ksuhsrm7s738408a0/env-vars/DATABASE_URL`) to the valid `postgresql://` Neon pooler URI and deployed commit `f129043` (`dep-dbs6sbrji66s739lh9h0`, live at `2026-11-14T14:21:08Z`).
- **Live local & production verification**:
  - Seeded active `AXIOM 4.0` event + Round 1 in Neon DB (`3aa9c9ae-e8ee-4475-ab72-5653ff3caea6`).
  - Verified full flow locally in Chromium (`browser` subagent `d37d58c4-ae53-40ce-a4d1-24f660f1d595` on `http://localhost:5173` + `http://localhost:3000`): `/` -> `Sign in` -> `/auth-redirect` -> `/complete-profile` (no error banner) -> submitted College `Sir MVIT`, Mobile `9876543210`, USN `1MV22CS001` -> `"You're in, Audit."` -> `/dashboard` showing `AXIOM 4.0` -> Landing `Sign in` while signed in redirects cleanly -> `Sign out` -> `Admin` modal (`Axiom@26`) -> `/admin` Live Desk (0 console errors, 0 page errors, 0 HTTP 4xx/5xx responses). Deleted temporary `user_mock_participant` test user/admin rows afterwards.
  - Verified live Render production logs & endpoints after deploy `dep-dbs6sbrji66s739lh9h0` (`f129043`): logs printed `Database connection established successfully` and `Auto-enrolled completed participant in event`, `https://axiom26-aezg.onrender.com/health` returned `{"status":"healthy","database":"connected","environment":"production"}`, `https://axiom26-aezg.onrender.com/` returned `200`, and `POST https://axiom26-aezg.onrender.com/api/users/check-email` + `POST https://www.axiom4.online/api/users/check-email` returned `{"success":true,"possibleTypo":false}`.
- **Verification results**:
  - `Axiom26`: `npx prisma validate` PASS, `npm run build` PASS, `npm test` PASS (6/6), `REQUIRE_DATABASE=true bun ./dist/tests/autoEnrollUnit.test.js` PASS, and GitHub Actions CI run `43604302981` on `main` (`f129043`) PASS (`conclusion: "success"`).
  - `AxiomFrontend`: `npm run lint` PASS, `npm test` 44/44 PASS, `npm run build` PASS (`3.32s`), `npm run test:browser` 39/39 PASS (`audit-artifacts/browser-results.json`), and GitHub Actions CI run `43603938734` (`82163d2`) PASS (`conclusion: "success"`).
