# AXIOM production-readiness audit

**Verdict: NOT VERIFIED FOR PRODUCTION.** The implementation now targets Better Auth end-to-end, and isolated frontend tests pass. No real Better Auth server/database, email provider, staging accounts or canonical deployment was available, so signup persistence, cookie delivery, legacy identity linking, enrollment, attendance and organizer authorization have not been verified against live services.

Audit date: 2026-10-12 (Asia/Kolkata). See [progress.md](../progress.md) for exact continuation state and release steps.

## Scope and evidence

- Frontend: `/home/rosso/Projects/AxiomFrontend`, baseline `50a909693689d18c3d3796b233d7ec787cf7d9ff`.
- API: `/home/rosso/Projects/Axiom26`, baseline `86cb582016bcbdcdc60e7440a23c2406fe73a4f7`.
- Better Auth and Clerk references were checked against official documentation. No deployed API revision or live frontend hostname was supplied. The frontend Vercel rewrite points to an AWS App Runner origin, but that does not prove the adjacent API checkout is deployed there.
- No DB migration, seed, deployment, merge, or production data mutation was run.

| Check | Result | Evidence / limit |
|---|---|---|
| Frontend lint | PASS | `npm run lint`, no errors or warnings. |
| Frontend production build | PASS with warning | `npm run build`; output `dist`; JS ~820 kB minified / ~221 kB gzip, above Vite's 500 kB warning. |
| Frontend unit/API/date tests | PASS | `npm test`, 30/30. Covers cookie credentials, 401 refresh, HTTP 200 `success:false`, request contracts and timezone conversion. |
| Frontend readiness config checks | PASS | `npm run test:readiness`, 3/3; checks Better Auth client, no temporary auth, Vite output vs Azure SWA output. |
| Frontend Playwright fixture journeys | PASS | `npm run test:browser`, 36/36 Chromium scenarios; artifacts in ignored `audit-artifacts/`. All auth/business API/socket traffic is intercepted. |
| Frontend production dependency audit | PASS | `npm audit --omit=dev`, zero advisories at audit time. |
| Prisma schema validation | PASS | `npx prisma validate`; database not contacted. |
| Backend generation/type build | PASS | `npm run build`, Prisma 7.10 generation plus `tsc`. |
| Backend auto-enrollment unit command | PARTIAL | `npm test` structural check passes; it clearly skips DB integration because PostgreSQL at localhost:5432 refused connection. No persisted behavior was tested. |
| Backend dependency audit | FAIL / review needed | `npm audit` reports 7 high findings; `npm audit --omit=dev` reports 4 high Prisma CLI/tooling findings through the Prisma adapter's optional peer graph. Force fix suggests Prisma 6, incompatible with the current Prisma 7 plan, so it was not forced. |
| Real auth, DB, SMTP, sockets, deployment | BLOCKED | No staging URL/accounts/DB/mail configuration or production test access. |

Browser fixtures cover public entry, signed-out guard behavior, sign-in/sign-up forms, sign-out, participant registration routing, profile outage gating, profile completion semantics, event enrollment success/HTTP error/business error/reload, check-in persistence/window open/close/denial, opponent/position/room/judge visibility, publication privacy, participant admin denial, admin event create/edit/delete, mobile public overflow and 404 recovery. These prove UI behavior against fixtures only.

## Implemented corrections

- Better Auth now handles browser email/password sign-in, distinct sign-up, email verification, sign-out, password recovery and HTTP-only cookie sessions. The Better Auth client sends same-origin session cookies; API code no longer sends fake or Clerk bearer tokens.
- The Express API mounts Better Auth before JSON parsing. It validates sessions server-side and checks administrator membership from the database. Email verification is required before onboarding and before linking existing participant/admin rows by email.
- Database changes are additive: separate auth tables, nullable unique `authUserId` links, and nullable aliases for the old provider-ID columns. Existing event/debate/attendance rows remain linked to the same business users. Review [the unapplied migration](../../Axiom26/prisma/migrations/20261012090000_better_auth/migration.sql) before applying anywhere.
- Production configuration requires Better Auth URL/origins/secrets, SMTP, and verified PostgreSQL TLS. CORS is an explicit origin allowlist. Helmet security headers, health/readiness behavior and Better Auth endpoint rate limits are configured.
- Socket connections require a Better Auth session; event/round room joins check the authenticated user's event membership or admin record.
- Profile failure no longer passes users through mandatory gates. Completing a profile no longer reports enrollment or check-in; event enrollment is explicit and checks both HTTP and business success. The interface updates check-in availability at the configured boundaries and displays free-text judge assignments.
- Added password reset routes, unknown-route recovery, and corrected the Azure Static Web Apps output directory to `dist`.

## Remaining blockers and risks

### P0 — Real Better Auth release journey is unverified

The UI tests return a fixture session from `/api/auth/get-session`; there is no running Better Auth/PostgreSQL instance. The local API startup previously failed because no Postgres server is listening. SMTP delivery has not been exercised. Cookie attributes, email callback links, password reset, session refresh/revocation, identity linking, and authorization are statically configured but not proven in a browser against the API.

**Release gate:** configure an isolated staging database and SMTP, apply the reviewed migration there, create real participant/admin test accounts, and complete the account and tournament journey listed in [the prompt](PRODUCTION_AUDIT_PROMPT.md). Do not claim production-ready from the green fixture results.

### P0 — Deployment target is ambiguous

The repository has a Vercel config proxying `/api` and `/socket.io` to App Runner, an Azure Static Web Apps workflow (now outputs `dist`), and a separate Azure Web App workflow. The latter is not configured as an API reverse proxy; the Azure Static Web App workflow has no linked API project. Better Auth production cookies require the frontend and API to use the intended same-origin proxy or another verified cookie-safe design. No canonical frontend hostname or live deployment was given.

**Release gate:** owner/operator must identify the canonical hosting workflow and confirm that its API/auth/socket routes reach the Better Auth backend. Test deep-link refresh, sign-in cookie set/read/clear, email callback and authenticated API requests on that actual host.

### P1 — Backend advisory findings remain

NPM reports 7 high advisories in the backend dependency graph and 4 high when omitting development dependencies; findings include Prisma CLI/config, deepmerge and mysql2 toolchain packages. The current stable Prisma 7 toolchain does not have an npm-audit-recommended semver-compatible remediation in the observed report. Forcing npm's recommendation would downgrade to Prisma 6, conflicting with the selected adapter/schema setup. Confirm the exact installed production image contents and reassess when a compatible Prisma patch is available.

### P1 — Rate-limit storage is process-local

Better Auth's current rate limits use the default in-memory store. This is best-effort on one process and does not provide a shared limit across autoscaled API instances. Configure supported shared secondary storage before depending on rate limits under horizontal scaling. The public admin-key validation/onboarding paths also need a verified abuse limit under the intended deployment.

### P1 — Complete organizer/participant DB workflow is untested

The frontend fixture matrix models event CRUD, enrollment and check-in, but no isolated database test verified event eligibility, transactionality, duplicate enrollment races, pairing rules, room allocation conflicts, score validation, publication privacy or next-round qualification. The backend's current unit script tests only the auto-enrollment export unless an approved test DB is available.

### P2 — Bundle size warning

The production bundle's main JavaScript is approximately 820 kB minified (~221 kB gzip). This is a real performance warning; route splitting and representative mobile performance measurement remain.

### P2 — Production observability/operations not verified

No live TLS/certificate, secret scope, backup/restore, rollback, multi-instance Socket.IO adapter, monitoring, deployment health probe or load test was available. The API now exposes `/health/live` and a database-checking `/` readiness response, but the host has not been configured to use them.

## Release verification matrix

| Journey | Local fixture evidence | Real service evidence |
|---|---|---|
| Anonymous entry/protected route guard | PASS | Deployed refresh/redirect behavior BLOCKED. |
| Better Auth registration, verification, sign-in and sign-out | UI labels/signout fixture PASS | Database sessions, real email and cookie behavior BLOCKED. |
| Password reset | Route/UI added; no real email test | BLOCKED. |
| Profile save and completion | Gate failure and no false enrollment UI PASS | Persistence and existing identity linking BLOCKED. |
| Explicit event enrollment | Success, denial, business rejection, reload fixture PASS | DB relation/idempotency/eligibility BLOCKED. |
| Check-in and event entry | Open/closed boundary, denial, persistence fixture PASS | Server clock/DB eligibility/membership BLOCKED. |
| Published assignment, room and judge | UI fixture PASS including free-text judge | Real pairing, room allocation and socket updates BLOCKED. |
| Organizer event CRUD/admin denial | Fixture PASS | Database authorization, deletion effects and concurrent writes BLOCKED. |
| Pairings, scoring, publication, advancement | Contract/UI fixtures partial | Persisted algorithm/rule behavior BLOCKED. |
| Security and operations | Source/config review partial | Deployed TLS, CORS, CSRF, IDOR, rate limits, multi-instance behavior and rollback BLOCKED. |

## Reproduction

Frontend:

```sh
npm ci
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run test:readiness
npm audit --omit=dev
```

Backend from `/home/rosso/Projects/Axiom26`:

```sh
npm ci
npx prisma validate
npm run build
npm test
npm run test:integration # only with a confirmed disposable DB
npm audit
npm audit --omit=dev
```

The browser suite uses a local Vite server and isolated route fixtures; it never changes tournament records. Save fresh output/screenshots under ignored `audit-artifacts/`. Preserve failures and distinguish fixtures from live-service proof. See [the reusable full audit prompt](PRODUCTION_AUDIT_PROMPT.md) and [continuation log](../progress.md).
