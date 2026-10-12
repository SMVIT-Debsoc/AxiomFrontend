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
- Validation: lint, build, 31 unit/API/date tests, 3 readiness checks, and all 40 isolated browser fixtures pass, including mobile registration overflow and persistent password recovery layouts. The production JS chunk remains above Vite's existing 500 kB advisory threshold. No deployment or push was performed.
