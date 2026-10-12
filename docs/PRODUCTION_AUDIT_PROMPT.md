# AXIOM production-readiness audit and testing prompt

Copy the prompt below into a coding-agent chat opened on this repository. This is an execution prompt: inspect the code, run the tests, and produce evidence, rather than returning only a plan.

---

Act as a senior QA engineer, security reviewer, and release engineer. Audit this AXIOM competitive-debate application for real participant and organizer use. The required authentication provider is **Better Auth**, as confirmed by the owner. Auth.js (`@auth/core`), NextAuth, Clerk, a shared organizer/participant passcode, a simulated session, or a placeholder bearer token does not satisfy this requirement.

The owner already authorized starting the audit, implementing fixes, testing participant onboarding/event entry/admin event management, and maintaining `/home/rosso/Projects/AxiomFrontend/progress.md` for continuation. The owner has already said Clerk is not in use. Do not ask them to repeat those decisions. They have not supplied a staging URL, dedicated test accounts, database target or mail provider.

Determine whether this exact checkout and its intended deployment are production-ready. Execute every independently runnable check. Classify every scenario as PASS, FAIL, BLOCKED, or NOT APPLICABLE. Stop a particular real user journey at its first broken boundary, but continue independent scenarios. Do not invent successful end-to-end results when the backend, test accounts, database, delivery provider, or deployment is unavailable.

## Scope and discovery

1. Read applicable AGENTS.md instructions, README, package scripts, lockfiles, routing, API/auth/socket code, deployment configuration and CI workflows in both the frontend and its configured/adjacent API checkout. Record commits, local modifications, Node/package versions, run date and actual auth implementation. Inspect environment variable names and presence without printing values, cookies, tokens or personal data.
2. Inventory every public, participant and admin route and every API endpoint invoked by the UI. Trace each critical story through UI → request → server authentication/authorization → database transaction → response → rendered state. Identify the actual backend checkout/service and confirm its contract; do not assume comments or old documentation describe the deployed backend.
3. Record the test environment. Use dedicated disposable accounts, isolated fixtures and an isolated test database for mutations. Fixture sessions must stay inside the test harness and must not create an authentication bypass in the shipped application. Keep mocked UI tests, real integration tests, and real browser end-to-end tests separate in results.
4. `/home/rosso/Projects/Axiom26` is the backend checkout used for this implementation. Verify its current revision and repository relationship to the deployed service before using it as deployment evidence. Never run migrations/seed scripts against an unknown database.
5. Staging and accounts have already been requested but are unavailable. Continue all local work; retain real-service verification as BLOCKED, never PASS. Request the missing staging/access details only after producing a concrete local result.

## Authentication and authorization: release-critical

- Confirm Better Auth client and server integration actually exists and uses the same sessions and user identities. Inspect React session loading, sign-up, sign-in, sign-out and server session verification. Consult official docs for the installed version: [client](https://better-auth.com/docs/concepts/client), [session management](https://better-auth.com/docs/concepts/session-management), [cookies](https://better-auth.com/docs/concepts/cookies).
- Verify the sign-up screen creates a durable account, rather than presenting another sign-in screen. Test new and existing accounts, duplicate email, bad password, malformed email, whitespace/case normalization, pending/loading/error states, repeated submissions and browser refresh.
- Test configured email verification, password reset, and OAuth flows when supported. Test invalid/expired/replayed links and callback failures. Confirm actual delivery in the test provider; unsupported mechanisms are NOT APPLICABLE with rationale, never claimed working.
- Sign in as participant and organizer in independent browsers. Verify session persistence on refresh, new-tab behavior, expiry/renewal, revoke/delete account behavior and logout in every open tab. Inspect cookie security attributes and session invalidation without recording secret values.
- Identify whether the application uses cookies or an explicitly configured Better Auth bearer integration. Verify business API requests actually carry the server-supported credentials. For cross-origin cookies, validate fetch credentials, CORS with exact allowed origins, trusted origins and cookie policy. Do not substitute a fabricated bearer string for a real session.
- Ensure production cannot silently fall back to temporary passcode authentication when configuration is missing. Confirm the production bundle and deployed network requests contain no active temporary-session flow. Missing required config should fail clearly and safely.
- Test direct protected URLs while signed out, while session loading, after logout and with expired credentials. Test return-to navigation without open redirects.
- Test participant attempts to call every admin write API directly. Server-side checks must deny event/round/room CRUD, manual attendance/enrollment, pairing, results, promotion and publication; hiding UI controls is insufficient.
- Test tampered role metadata, localStorage, query parameters, event/round/user IDs and cookies. Verify one user's credentials cannot impersonate another, and access rules match tournament privacy requirements.
- Review organizer provisioning, invitation/key lifecycle, credential storage, brute-force protection and audit logging. A role selector or shared passcode must not grant a production admin role by itself.

## Participant onboarding

- Entry → Get started → participant registration → real account creation/verification → durable backend profile → mandatory profile completion → dashboard. Test both direct navigation and normal UI links.
- Returning users with completed profiles should reach their workspace. New/incomplete profiles should be consistently routed to completion; backend profile verification failures should show a recoverable error and preserve required gating.
- Validate required college/mobile fields, trimmed empty input, allowed mobile formats, lengths and optional fields. Check keyboard submission, inline errors, loading, retry and duplicate submissions.
- Save profile and independently read it back through the backend and database. Refresh and sign in on another browser to prove persistence. Verify identity data updates consistently between auth and application records; test partial failures.
- Verify one backend user per auth identity under duplicate/cross-tab sign-in requests.
- Establish the intended event-selection policy. Cover zero events, only UPCOMING, one ONGOING, multiple active events, completed/cancelled events, and a configured designated event.
- If onboarding promises automatic registration, prove a confirmed enrollment relation exists for the selected event before showing success. Completing a profile or calling check-in alone is not enrollment evidence. If registration/check-in fails, success text must describe only the operation that succeeded.
- Confirm onboarding returns to the intended protected destination when one was requested.

## Participant event entry and tournament journey

- Events list/detail, filters/search, counts, zero-data states, invalid/deleted event, pagination and access errors.
- Enroll in an eligible event; verify backend enrollment status, participant roster, dashboard state, refresh and another browser. Test duplicate clicks, retries, two tabs, existing enrollment, closed/cancelled/completed/full events and rejected responses.
- Distinguish HTTP success from business success. An HTTP 200 containing `success:false` must not produce enrollment/check-in success or optimistic false presence.
- Round entry: confirm URL event/round consistency, enrollment and promotion eligibility, checked-in/not-checked-in state, absent users and invalid IDs.
- Check-in before opening, exactly at opening, inside window, exactly at closing and after closing. Use a controlled clock. Verify server enforcement and that an already-open page updates as time passes without manual refresh. Test missing/invalid dates, device clock skew and timezone differences.
- Verify attendance persistence and idempotency in database, admin counts and participant UI. Test network timeout and repeated submission without duplicated attendance.
- Unpublished pairings must remain hidden according to policy, including API payloads and socket events. Published pairings should show the correct opponent, GOV/OPP position, motion, room, assigned judge/adjudicator and time slot. Test byes, swing participants and missing room/judge assignments.
- Confirm tournament participation is an actual room/time-slot workflow or follow the implementation's actual join mechanism. Do not invent a video meeting feature. Validate configured external links without posting messages.
- Participant results: pending versus completed, publication gates, winner/score, qualification/elimination, round progression and event leaderboard. Validate summary counts and detail cards against the same persisted data.

## Organizer event management

- Organizer onboarding and returning sign-in must end in the admin workspace only after backend authorization.
- Event create/read/edit/delete: required fields, date order, timezone conversion, optional links, status transitions, validation failures, duplicate submit, reload and another client. Confirm delete consequences and cancellation paths using disposable events only.
- Participant roster, manual enrollment, search/filter, duplicates, unauthorized changes and removals with dependent debate/attendance records.
- Round create/edit/delete, valid round numbering, motions, check-in windows and lifecycle transitions. Reject impossible/overlapping time configurations where tournament rules require it.
- Rooms create/edit/delete, capacity, room availability, assignments and judge updates. Confirm judge edits appear to the assigned participant, including both free-text `judgeName` and related `adjudicator` representations if supported.
- Attendance controls and counts, participant eligibility, present/absent toggles and conflict between manual attendance and participant check-in.
- Round-one pairing and power matching: even/odd participants, zero/one participants, byes/swing, repeat opponents, repeated generation, regeneration behavior, eligible promoted users and unpublished/published visibility. Independently validate the generated debate records.
- Room/time allocation: insufficient rooms, room reuse across slots, overlap, selected rooms, speaking/buffer/gap times and total schedule. Check published participant assignment against admin allocation.
- Results: winner required, winner belongs to debate, scores numeric/finite/in allowed range, zero/decimal scores, draw policy, correction of completed results and concurrent submissions. Reload and verify scores, winner, stats and leaderboard in the backend.
- Promotion: choose/save/unselect/reload, eligible next-round population, ties, arbitrary IDs, repeat submissions, stale changes, and publish/unpublish results. Verify participant views and API visibility before and after publication.
- Verify actual settings features; informational placeholders must not be advertised as completed functionality.

## Reliability, security, accessibility and deployment

- Run clean reproducible installation, lint, production build, unit/contract tests, browser tests and production-readiness checks. Preserve failures; do not weaken assertions or force dependency upgrades to obtain a green audit.
- Exercise 401/403/404/409/429/500, `success:false`, malformed JSON, HTML redirects, empty responses, offline/timeout and reconnection. Check loading termination, retry, stale-state clearing and absence of false success messages.
- Use two real authenticated clients to verify event/round updates, attendance, pairings, judge changes, results, promotion and deletion. Verify socket authentication, room membership authorization, publication filtering, reconnect/rejoin and listener cleanup. Fixture socket disconnect tests are not proof of live delivery.
- Inspect request cancellation/timeouts, error boundaries, redacted observability and actionable operational logs.
- Test IDOR, CSRF, XSS through user/event/motion/judge input, unsafe external links, sensitive participant data, session leakage, dependency advisories and secret exposure. Separate confirmed exploitable issues from code-review risks and untested backend assumptions.
- Check keyboard navigation, focus visibility, modal trapping/return, screen-reader labels/errors, 200% zoom, reduced motion and mobile layouts. Run Chromium plus Firefox/WebKit when available; report unavailable engines. Keep representative screenshots.
- Inspect production bundle size and route splitting, asset caching, SPA deep-link refresh, security headers, TLS, API and Socket.IO rewrites, environment scope and hosting compatibility.
- Confirm CI uses the actual Vite output directory, runs meaningful tests, and serves the SPA and backend on the intended platform. Validate deployed behavior separately; a successful local build is insufficient.
- Review database constraints/transactions, migrations, test-data cleanup, backup/restore, rollback, health checks, monitoring and load limits from actual backend/infrastructure evidence. Use approved staging resources for load tests, never guess a production target.

## Existing commands and evidence

Start with:

```sh
npm ci
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run test:readiness
npm audit
npm audit --omit=dev
```

`tests/browser-audit.mjs` starts a local Vite server and intercepts Better Auth session and all business API/socket requests. These are isolated UI fixtures only, not Better Auth integration proof. Its artifacts are written to `audit-artifacts/`. `test:readiness` is a small configuration gate, not a production certification. The backend's unit command may skip DB integration if PostgreSQL is unavailable; read its output. `npm run test:integration` must run only against a confirmed disposable database. Read `/home/rosso/Projects/AxiomFrontend/progress.md` before continuing to avoid repeating completed work and to see current blockers.

## Required evidence and deliverables

Write an updated `docs/PRODUCTION_READINESS_AUDIT.md` and preserve redacted test artifacts. Provide:

1. Verdict: READY, NOT READY, or NOT VERIFIED. Any critical blocker means NOT READY. Missing real authentication/onboarding/enrollment/check-in/pairing/results evidence prevents READY even if mocks pass.
2. Environment and commit; commands, exit codes, test counts and artifact paths; mock/live/static labels; scope limitations.
3. Scenario matrix with every item accounted for. For BLOCKED cases, name the exact missing prerequisite and the next executable verification step.
4. Prioritized findings: severity, user impact, verified file/line, reproduction, expected versus actual behavior, evidence type and concrete recommended fix. Do not present likely backend vulnerabilities as confirmed exploits.
5. Release gate: real Better Auth sign-up/sign-in → persisted profile → confirmed event enrollment → valid round check-in → published assignment and judge/time → persisted result → published qualification → next-round access, with organizer operations and server-side authorization verified in a second client.
6. Suggested fix order and tests that must be rerun. The owner authorized code fixes and the Better Auth migration; do not deploy, merge, or alter production tournament data. Apply database migrations only after a staging database is positively identified and backed up. Add meaningful isolated tests when needed.

A green lint/build result, temporary access to a dashboard, or mocked API success does not establish production readiness.
