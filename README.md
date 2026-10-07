# AXIOM 4.0 Frontend

SMVIT Debsoc's competitive-debate and tournament-management frontend. React 19, React Router 7, Vite, Tailwind CSS 3, Framer Motion, Clerk and Socket.IO. The AXIOM 4.0 identity pairs Indian goddess stone sculpture with green digital fields and condensed editorial typography.

## Run locally

```sh
npm install
npm run dev
```

Configure a local `.env.local` with the project's **existing** Clerk development publishable key:

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=<your Clerk development publishable key>
```

Never commit credentials. No authentication bypass or demo account is shipped. A missing key intentionally retains the original startup error. Local API requests default to `http://localhost:3000/api`; use `VITE_API_URL` for another backend. Existing `VITE_SOCKET_URL` and `VITE_SOCKET_TRANSPORTS` options remain supported. Deployed `/api` and `/socket.io` rewrites remain in `vercel.json`.

Existing checks:

```sh
npm run lint
npm run build
npm run preview
```

There is no repository unit-test, formatter, TypeScript, or component-test script.

## Route architecture

- `/` still redirects to `/login-select`: the role selector is now the flagship event-poster experience, followed by discourse and tournament-workspace sections.
- `/about`: the complete public editorial experience; `/get-started`: participant/admin role selection.
- `/sign-in/*`, `/sign-up/*`, `/auth-redirect`: existing Clerk routing and role-aware authentication redirects.
- `/complete-profile`, `/dashboard/*`: protected participant profile, events, enrollment, check-in, pairings, rounds and results.
- `/admin/*`: protected tournament operations, events, participants, rooms, round management, promotion, results and leaderboard.
- Existing settings screens remain informational; the redesign does not claim to add a settings backend.

No endpoint, role value, storage identifier, environment contract or backend was renamed for the identity migration. Navigation's previously unhandled `/events` link now targets the existing `/dashboard/events` route.

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

## Deployment notes

The host's Clerk configuration and backend access are required to verify real authentication and authenticated operations. Isolated UI fixtures used during local visual QA are not production authentication evidence and are not part of the repository.

The repository contains no canonical public deployment hostname. Social image paths are origin-relative; publishing infrastructure should resolve them to the canonical absolute site URL when that hostname is established. No unrelated domain or fabricated canonical URL is supplied.
