# AXIOM 4.0 — Design System & Product Design Specification (`DESIGN.md`)

This document defines the authoritative product direction, visual tokens, interaction state machine, motion discipline, accessibility baseline, and user taste rules for **AxiomFrontend**.

## 1. Product Direction

- **Product**: AXIOM 4.0 parliamentary debate tournament registration, participant desk, real-time draw & ballot tracker, and Organiser Console.
- **Character**: `tactile, carbon-ink editorial, high-contrast utilitarian`
- **World**: Competitive collegiate parliamentary debate adjudication & live tournament telemetry.
- **Focal Moments**:
  1. The landing page sculpture & Google registration poster (`/`).
  2. The live round pairing, check-in, and ballot result showcase cards (`/dashboard`, `/dashboard/events/:id/rounds/:roundId`, `/dashboard/events/:id/results`).
- **Signature Detail**: Uppercase `Bebas Neue` display numerals and headlines paired with crisp `1px` Dusty Olive (`#4A5646`) structural hairlines and Celadon Mint (`#B9F5D8`) status pills.
- **Surface Philosophy**: Solid matte surfaces with clear tonal separation instead of translucent glassmorphism, decorative blurs, or generic multi-color SaaS gradients.

## 2. Token Architecture (Authoritative)

Source of truth: `tailwind.config.js`, `src/index.css`, and `src/neobrutalism.css`.

### Color Tokens

| Token / Role | Hex | Usage |
| --- | --- | --- |
| Carbon Ink (Primary Surface / Dark Canvas) | `#1D1E18` | Dark cards, modal dialogs, primary dark sections |
| Obsidian Ink (Deep Canvas / Input Surface) | `#141510` | Deepest dark background, form input wells, dark button ink |
| Elevated Dark Surface | `#272922` | Subtle hover/active elevation over Carbon Ink |
| Celadon Mint (Primary Brand Accent) | `#B9F5D8` | Primary CTAs, active focus rings, highlight badges |
| Pressed Mint | `#9FE3C2` | Mint hover/active feedback |
| Alabaster Mint (Primary Text on Dark) | `#EAFBF5` | Primary headings and body text on dark surfaces |
| Pale Sage Text | `#D4EDE1` | Secondary body copy on dark surfaces |
| Muted Mint Label | `#BDD9CA` | Supporting labels, icons, subtle UI controls on dark |
| Soft Sage Mist | `#B8D5C5` | Muted editorial copy |
| Dusty Olive Border | `#4A5646` | 1px structural borders on dark cards, inputs, and dialogs |
| Moss Muted | `#6B8F71` | Input placeholders and subtle dividers |
| Crimson Alert (Error Surface) | `#a51818` | Error banners and destructive alert accents |
| Soft Rose Alert (Error Text) | `#ff9c9c` | Accessible error messaging on dark surfaces |

### Typography

| Role | Font Family | Usage |
| --- | --- | --- |
| Display / Hero | `Bebas Neue` | High-impact uppercase section titles, modal display headers, step numerals, and event banners |
| UI Headings / Brand | `League Spartan` | Section headings, card titles, buttons, and navigation labels |
| Body / Forms / Mono Details | `Inter` (`tabular-nums` + monospace accents for USN/scores/keys) | Paragraph text, form inputs, statuses, scores, and metadata |

### Spacing, Borders & Elevation

- **Spacing Base Unit**: Strict `4px` scale (`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`).
- **Border Radius**: `rounded-xl` (`12px`) for inputs/buttons; `rounded-2xl` (`16px`) for icon containers and callout cards; `rounded-3xl` (`24px`) for primary dialogs and hero panels; `rounded-full` for pill actions and close controls.
- **Separation**: Crisp `1px` structural borders (`#4A5646` on dark, semantic `border-border` on light) and tonal contrast over heavy drop shadows or blurred backdrops.

## 3. Interaction & Motion Rules

- **Exhaustive 9-State Completeness**: Every interactive control, guard, and data view implements `[idle, hover, focus-visible, active/pressed, loading/pending, success, empty, disabled, error]` with explicit inline retry and escape routes (`Retry`, `Use a different account`, `Back to home`).
- **Emil Kowalski Motion Standards**:
  - Intentional micro-interaction transitions of `140ms–240ms` using `cubic-bezier(0.22, 1, 0.36, 1)`.
  - Zero continuous infinite decorative loops (no pulsing CTA rings, no infinite spinning conic backgrounds, no floating/wiggling emblems, no pulsing full result cards).
  - Zero transform jitter on high-frequency data table rows (`AdminPeople`, `AdminParticipants`, `AdminLive`).
  - Non-essential motion automatically disabled via `@media (prefers-reduced-motion: reduce)` in `src/index.css` and `src/neobrutalism.css`.

## 4. Accessibility & Responsive Baseline

- **Touch Targets**: Interactive controls (`button`, `[role='button']`) maintain at least `44×44px` hit areas (`min-height: 44px`, `h-11 w-11` for icon buttons).
- **Focus Visibility**: High-contrast `:focus-visible` outlines (`#B9F5D8` focus rings on dark surfaces, `#141510` on light/mint).
- **Forms & Validation**: All inputs use explicit `<label>`/`id` pairs, `aria-describedby` hints/errors, `aria-invalid`, and disable unwanted autocomplete on sensitive keys (`autoComplete="off"`).
- **Decorative Icons**: Purely decorative Lucide/SVG icons carry `aria-hidden="true"`.
- **Responsive Viewports**: Visual verification targets Desktop (`1280×800`), Tablet (`768×1024`), and Mobile (`390×844`) with zero horizontal overflow.

## 5. Anti-Slop Guardrails & Lessons Learned (User Taste Rules)

- **Anti-Slop Guardrails**:
  - No `backdrop-blur-*` glassmorphism over dark overlays where solid dark scrims (`bg-black/80`) provide sharper contrast and performance.
  - No multi-hue gradients, emoji substitutes in toast titles/headers, or generic SaaS pills.
- **Lessons Learned & Established Conventions**:
  - **Footer Admin Portal Entry**: Visible `"Admin Portal"` button placed at the end of the `/` landing page footer that opens the Admin Secret Key modal directly (no Google verification required for secret-key admin access).
  - **Unmasked Organiser Data**: Admin pages (`AdminPeople`, `AdminParticipants`, `AdminLive`, `AdminEventDetails`, `AdminRoundManagement`) display unmasked participant phone numbers (`tel:` links), email, USN, and gender for tournament coordination.
  - **WhatsApp Community Onboarding**: First-login modal (`WhatsAppFirstLoginModal`) and persistent dashboard banner (`WhatsAppGroupBanner`) connect debaters directly to the event's `whatsappLink`.
  - **Multi-Account Google Sign-In**: Google OAuth invokes `oidcPrompt: "select_account"` and exposes a "Use a different Google account" switcher when a session already exists.
  - **Performance Architecture**: Vendor chunk splitting, `React.lazy` heavy modal imports, and parallel `Promise.all` data loading keep initial load and navigation fast.
  - **Competition Information Boundaries (Participant vs. Admin)**: Participant views expose only essential competition context (event schedule, check-in windows, WhatsApp group link, registered count, the participant's own assigned room, GOV/OPP side, motion, adjudicator, opponent name & college, and published `QUALIFIED` / `ELIMINATED` status). Exact speaker scores, opponent scores, full room-by-room draws of other debates, and searchable participant rosters are restricted to Admin views.
  - **Mobile Participant Command View (Low Clutter, Phone-First)**: On `< md` (`390px` mobile viewports), participant `/dashboard` consolidates active tournament telemetry, live check-in, current matchup, and tournament advancement into a single above-the-fold Command View with segmented inline tabs (`Now` | `Rounds` | `Results`). Eliminates decorative sculptures, multiple giant cards, and excessive vertical scrolling while retaining full desktop breadth.
  - **One-Flow Admin Console & Auto-Winner Scoring**: Organisers execute tournament operations in a continuous 5-step flow on `/admin` (`AdminLive`) with inline round creation, inline motion editing, and a rapid ballot sheet (`InlineResultSheet`). Debate speaker scores automatically award the `WINNER` tag to the higher-scoring debater live and on the backend, requiring manual selection only on an exact tie. Inline server errors (`err?.message`) surface directly in modal banners without blocking browser dialogs.
