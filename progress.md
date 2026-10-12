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
- Corrected Azure Static Web Apps output from `build` to Vite's `dist`.
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

1. Confirm the canonical deployed frontend and API. The repo has a Vercel proxy to an App Runner URL and two Azure workflows; the Azure static flow has `dist` now but no linked API function, while the Vercel `/api` and `/socket.io` proxies are the intended same-origin session route. Do not assume which deployment is live.
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
