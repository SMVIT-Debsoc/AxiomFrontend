# AXIOM 4.0 Frontend

SMVIT Debsoc's competitive-debate and tournament-management frontend. React 19, React Router 7, Vite, Tailwind CSS 3, Framer Motion, Better Auth and Socket.IO. The AXIOM 4.0 identity pairs Indian goddess stone sculpture with green digital fields and condensed editorial typography.

## Run locally

```sh
npm install
npm run dev
```

Configure `.env.local` only when the API is not running on `http://localhost:3000/api`:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Never commit credentials. Better Auth runs in the API backend and uses an HTTP-only session cookie. Local requests default to `http://localhost:3000/api`; deployed requests use the same-origin `/api` proxy. Existing `VITE_SOCKET_URL` and `VITE_SOCKET_TRANSPORTS` options remain supported.

Existing checks:

```sh
npm run lint
npm run build
npm run preview
```

`npm test` runs isolated API contract and date-time tests; Playwright UI checks run with `npm run test:browser`.

## Route architecture

- `/` still redirects to `/login-select`: the role selector is now the flagship event-poster experience, followed by discourse and tournament-workspace sections.
- `/about`: the complete public editorial experience; `/get-started`: participant/admin role selection.
- `/sign-in/*`, `/sign-up/*`, `/forgot-password`, `/reset-password`, `/auth-redirect`: Better Auth account access and role-aware redirects.
- `/complete-profile`, `/dashboard/*`: protected participant profile, events, enrollment, check-in, pairings, rounds and results.
- `/admin/*`: protected tournament operations, events, participants, rooms, round management, promotion, results and leaderboard.
- Existing settings screens remain informational; the redesign does not claim to add a settings backend.

Business API paths and role records remain stable; browser authentication now uses Better Auth HTTP-only sessions. Navigation's previously unhandled `/events` link now targets the existing `/dashboard/events` route.

## Design system

`src/index.css` is the canonical token source. Tailwind maps the existing semantic HSL tokens and the additional `axiom`, `font-display` and `font-heading` utilities.

| Token | Value | Use |
| --- | --- | --- |
| `--axiom-green-primary` | `#87C14D` | Hero, principal CTA, selection |
| `--axiom-green-dark` | `#6CA038` | CTA hover and dimensional accents |
| `--axiom-green-light` | `#A2CF75` | Light accents, footer wordmark, tonal interaction |
| `--axiom-logo-ink` | `#114111` | Logo-specific forest ink |
| `--axiom-ink`, `--axiom-paper`, `--axiom-stone` | Neutral tokens | Information surfaces and editorial rhythm |

Green backgrounds use dark ink. Small colored text uses a darker accessible brand-text token in light mode rather than the primary green itself. Workspaces preserve the existing stored light/dark preference. Container width, responsive gutters, section spacing, small radius, type families and motion timing are centralized.

The public rhythm is poster → reasoned information → stone/editorial interlude → functional tournament information → green closing statement. Workspaces use rules, indexed labels, tabular data and neutral surfaces rather than repeating the poster or surrounding every section with glass. Translucency is restricted to navigation and the sculpture-overlapping access panel.

### Logo

`src/components/brand/Axiom40Logo.jsx` is a path-only SVG wordmark with `nav`, `hero` and `footer` variants. The O is a narrow rounded capsule extending to y=239, while the other letters end around y=108; the I remains at normal cap height. An inner path creates the continuous narrow counter. A fixed viewBox preserves the geometry at every size. Color is inherited; the SVG exposes an accessible AXIOM 4.0 label.

No official vector/reference image was present in the checkout. This is an original vector interpretation of the supplied geometric description, not a claim to reproduce organizer artwork exactly. Browser icons and the social image use the same identity. The standalone PWA icon uses the long-O device within maskable safe margins.

### Fonts and substitutions

No font files were originally present; readable body text remains the existing system-sans stack. Added fonts are self-hosted, use `font-display: swap`, and ship with their SIL Open Font License files in `public/fonts/`.

| Referenced font | Status | Implementation |
| --- | --- | --- |
| Anton | Replaced with fallback | Bebas Neue fulfills the selected condensed-display role; Anton is not advertised as installed. |
| Bebas Neue Cyrillic | Specific referenced variant unavailable | Official OFL **Bebas Neue**, Latin/Latin Extended, is legitimately added as the documented display substitute. Do not claim Cyrillic coverage. |
| CanvaSansSC-Regular | No licensed asset supplied; unavailable | Existing readable system-sans body stack retained. |
| Fatum | No licensed asset supplied; unavailable | Replaced by OFL Bebas Neue for monumental headings. |
| League Spartan | Legitimately added | OFL variable font, used for secondary headings, UI and metadata. |
| Lovelo | No licensed asset supplied; unavailable | Replaced by League Spartan for UI/secondary headings. |

Sources: [Bebas Neue](https://github.com/google/fonts/tree/main/ofl/bebasneue), [League Spartan](https://github.com/google/fonts/tree/main/ofl/leaguespartan). Official TTF sources were converted to WOFF, without changing outlines. Body paragraphs do not use condensed display typography.

### Indian goddess sculpture

The user's specific Indian-goddess direction is implemented with **Mother Goddess**, c. 600, schist, Northwestern India, Rajasthan, Udaipur District; Cleveland Museum of Art, accession **1970.12**, Purchase from the J. H. Wade Fund.

- [Museum record](https://www.clevelandart.org/art/1970.12)
- [Museum API: CC0 and image metadata](https://openaccess-api.clevelandart.org/api/artworks/?accession_number=1970.12)
- Source: museum's `1970.12_print.jpg` photograph, delivered through the museum's responsive image endpoint at 1920px. The unprocessed photograph is not shipped.
- Production assets: `public/brand/mother-goddess-480.webp` and `mother-goddess-960.webp`.
- Processing: grayscale conversion, a manually traced outer silhouette, color-assisted masking of enclosed photographic negative spaces, removal of the photographic backdrop/museum stand, proportional resizing and WebP compression. Weathering and carved texture remain; no texture smoothing, synthetic reconstruction or historical relabeling.
- Used in the entry poster, public editorial transition, registration/authentication frames and quieter workspace accents. Full-figure compositions retain the head; secondary crops are controlled by their section container. Phone art is repositioned beside the text, not simply scaled from desktop.
- `Sculpture.jsx` supplies responsive sources, explicit intrinsic dimensions, eager/high-priority loading only for the entry hero and lazy loading elsewhere. Imagery is decorative (`alt=""`), with visible museum attribution in the colophon/footer.

The museum identifies the work as Mother Goddess; the site does not assign it to an unsupported specific deity or claim a historical association with debating. No Roman image, questionable stock asset, or fabricated religious history is included.

### Motion and accessibility

CSS entrances and short state transitions replace orbital/particle effects. Framer Motion's root configuration respects `prefers-reduced-motion`; CSS also disables decorative movement and smooth scrolling for that preference. The introductory wordmark neither intercepts clicks nor imposes the previous artificial 2.5-second loading delay.

Skip links, semantic section headings, labeled role-access fields, announced validation errors, named icon controls and visible keyboard focus accompany the visual system. Mobile navigation remains a usable disclosure; protected workspace navigation retains desktop/sidebar and mobile/bottom-navigation behavior. Browser zoom is no longer disabled by the viewport metadata.

### Workspace rail, icons and components

Participant and admin workspaces share one floating icon dock, vertically centred on the left (`src/components/layout/SidebarRail.jsx`): a back-to-landing tile, then a tile per destination, labels as tooltips and accessible names, a bottom tab bar below 768px. The admin mobile drawer keeps full labels.

- **Icons**: `src/components/icons/NeoIcons.jsx` holds 11 glyphs from the *Neubrutalism Icons Set (Community)* Figma file (Live stroke sheet), taken from the SVG export supplied by the project owner. Only the glyphs are used; the Figma tile and shadow are redrawn in CSS. Check the file's licence before publishing.
- **Theme toggle**: `ThemeToggle` combines the Lightbulb of [theme-toggles](https://github.com/AlfieJones/theme-toggles) with the blur-circle reveal of [react-theme-switch-animation](https://github.com/MinhOmega/react-theme-switch-animation) (both MIT, installed). It sits in the workspace headers, the public navbar and the landing header; the landing page has a full dark treatment.
- **Components**: `src/components/neo/` re-implements IconButton, Button, Card and ProgressBar from the MIT-licensed [Neo-Brutalism UI library](https://github.com/marieooq/neo-brutalism-ui-library) (marieooq) with AXIOM colours. Dialog, Dropdown, Checkbox and Input were not adopted; existing AXIOM controls remain.
- **Profile pictures**: `src/lib/avatar.js` draws a sculptural portrait (halo, headdress, jewellery, palette) deterministically from the account email, id or name. `UserAvatar` shows a person's own photo when they have one and this portrait otherwise; no initials.
- **Empty states**: `EmptyState` (halo, rotating rays, the sculpture) replaces plain "nothing here" blocks; `compact` for panels.
- **Workspace spacing and contrast**: category badges, titles and descriptions occupy separate rows. The compact between-rounds banner places its actions beside the copy on desktop and wraps them on mobile; green surfaces use explicit ink/paper foregrounds in both themes.
- **Loading**: `Skeleton` mirrors the dashboard, profile and results layouts with stone/green shimmer placeholders. `LoadingIndicator` supplies a rotating halo and animated voice bars during account, page and admin loading. Loading labels are announced separately from decorative placeholders; reduced motion uses static shapes without adding a loading delay.
- **Scrollbars**: page, table, drawer and dialog scrolling use native theme-matched handles, rounded on Chromium/WebKit, with a standard thin-scrollbar fallback. Light/dark tracks, hover states and system forced-colour styling keep handles visible; scrollbars are no longer deliberately hidden.
- **Motion**: staggered rise on dashboard blocks, count-up stats, bar fill, card lift, press and sheen, route transitions. All transform/opacity; `prefers-reduced-motion` disables them.

## Deployment notes

### Better Auth configuration

The browser talks to Better Auth at `/api/auth/*`; in production the same-origin `/api` rewrite must reach the API backend. Local development uses `http://localhost:3000/api` unless `VITE_API_URL` is set. The backend requires `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_URL`, an explicit `CORS_ORIGIN` list, and SMTP settings for email verification and password recovery. See the backend's `.env.sample` for exact names. Email verification is required before a new account can enter the app or claim an existing participant/admin record. Never ship a passcode or temporary-sign-in fallback.

The backend migration adds Better Auth storage and nullable identity links without deleting existing participant, admin, event, pairing or result data. Review the generated database migration and take a verified backup before applying it to production. Do not apply it until the production database target is confirmed.

The repository contains no canonical public deployment hostname. Social image paths are origin-relative; publishing infrastructure should resolve them to the canonical absolute site URL when that hostname is established. No unrelated domain or fabricated canonical URL is supplied.

### Render GitHub Actions

The Azure deployment workflows have been removed. The frontend and API repositories now run their checks on pull requests and pushes to `main`; deployment is a separate manual GitHub Actions run after CI passes. Add each Render service's deploy hook as `RENDER_DEPLOY_HOOK_URL` in that repository's Actions secrets, then run its **Frontend CI and Render deploy** or **API CI and Render deploy** workflow on `main` with `deploy` checked. Keep Render auto-deploy disabled for the frontend service as well, to avoid duplicate deploys; the API Blueprint sets `autoDeployTrigger: off`.

The API's Render Blueprint requires the Better Auth, SMTP, origin, admin-secret, and PostgreSQL TLS settings in Render's environment. The Render deploy hook only starts deployment; it does not verify real authentication or participant journeys. Review and back up the intended staging database before deploying the API because its current start command runs `prisma migrate deploy`. The frontend Render service must preserve same-origin `/api/*` and `/socket.io/*` routing to the API for cookie authentication; confirm the actual service URLs and routes before release.

### Sculpture credits

All figures are from the Cleveland Museum of Art Open Access programme (CC0), cut out from the museum photographs and converted to greyscale (`src/components/brand/figures.js` holds the list and the stable per-place picks).

| Figure | Accession | Where it appears |
|---|---|---|
| Mother Goddess, Rajasthan, c. 600 | 1970.12 | Landing hero, footer |
| Nature Divinity (Yakshi), Mathura, c. 75 CE | 1968.104 | Landing "discipline", sign-up, empty states |
| Vidyadevi (Goddess of Learning), Rajasthan, 10th–11th c. | 1972.152 | Landing "heritage", get-started, empty states |
| Durga Destroying the Buffalo Demon, Kashmir/Himachal, 9th–10th c. | 1982.45 | Landing "built for the round" |
| Goddess Siddhalakshmi, Kashmir, 1000s | 1982.47 | Landing closing section, admin dashboard |
| Goddess Holding a Lotus, Chola, c. 950 | 1984.2 | About, dashboard panel, empty states |
| River Goddess Ganga, Mathura, c. 700 | 1966.119 | Sign-in, dashboard profile card |

Museum records: `https://www.clevelandart.org/art/<accession>`. The museum titles are used as given; no specific deity or debating association is claimed beyond them.

## Production readiness audit (11 October 2026)

The current audit verdict remains **NOT VERIFIED FOR PRODUCTION** until a real Better Auth backend, database migration, email delivery and user/event journey pass end-to-end. See [the evidence report](docs/PRODUCTION_READINESS_AUDIT.md), [the reusable full audit/testing prompt](docs/PRODUCTION_AUDIT_PROMPT.md) and [the continuation log](progress.md).

Added checks:

```sh
npm test                         # isolated API contracts and event date behavior
npx playwright install chromium
npm run test:browser             # isolated Better Auth UI fixtures; never live auth proof
npm run test:readiness           # repository configuration gates
```

Browser tests start their own local server and intercept Better Auth/business API/socket requests. They preserve failed requirements and write ignored screenshots/results to `audit-artifacts/`. Real Better Auth, SMTP, and backend/database end-to-end testing remain required before release.
