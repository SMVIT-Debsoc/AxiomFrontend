# AXIOM 4.0 — Design System (`DESIGN.md`)

This document defines the authoritative visual tokens, typography, surface hierarchy, responsive layout breakpoints, accessibility standards, and anti-slop guardrails for **AxiomFrontend**.

## 1. Product Purpose & Aesthetic Direction

- **Product**: AXIOM 4.0 event registration, participant onboarding, dashboard, and Admin Portal console.
- **Visual Direction**: Carbon-ink editorial minimalism anchored by high-contrast celadon/mint accents, crisp hairline borders, generous whitespace/darkspace, and uppercase condensed display headlines paired with restrained body typography.
- **Surface Philosophy**: Solid matte surfaces with clear tonal separation instead of translucent glassmorphism, decorative blurs, or generic multi-color SaaS gradients.

## 2. Color Tokens (Authoritative)

Source of truth: `tailwind.config.js` and `src/index.css`.

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

## 3. Typography

| Role | Font Family | Usage |
| --- | --- | --- |
| Display / Hero | `Bebas Neue` | High-impact uppercase section titles, modal display headers, and event banners |
| UI Headings / Brand | `League Spartan` | Section headings, card titles, and navigation labels |
| Body / Forms / Mono Details | `Inter` (with monospace accents for keys/codes) | Paragraph text, form inputs, statuses, and metadata |

## 4. Spacing, Borders & Elevation

- **Border Radius**: `rounded-xl` (`12px`) for inputs/buttons; `rounded-2xl` (`16px`) for icon containers and callout cards; `rounded-3xl` (`24px`) for primary dialogs and hero panels; `rounded-full` for pill actions and close controls.
- **Separation**: Prefer crisp `1px` structural borders (`#4A5646` on dark, semantic `border-border` on light) and tonal contrast over heavy drop shadows or blurred backdrops.

## 5. Responsive Layout & Breakpoints

Visual verification targets three primary viewport classes with zero unintended horizontal overflow:
- **Desktop**: `1280×800`
- **Tablet**: `768×1024`
- **Mobile**: `390×844`

## 6. Accessibility & Interaction Standards

- **Touch Targets**: Interactive controls (`button`, `[role='button']`) maintain at least `44×44px` hit areas (`min-height: 44px`, `h-11 w-11` for icon buttons).
- **Focus Visibility**: All keyboard-focusable controls show high-contrast `:focus-visible` outlines (`#B9F5D8` focus rings on dark inputs/buttons).
- **Decorative Icons**: Purely decorative Lucide/SVG icons carry `aria-hidden="true"` so screen readers announce control labels cleanly.
- **Forms**: Sensitive key inputs disable unwanted autocomplete (`autoComplete="off"`) and associate explicit `<label>`/`id` pairs.
- **Reduced Motion**: Transitions and animations respect `@media (prefers-reduced-motion: reduce)` (`src/index.css`).

## 7. Anti-Slop Guardrails

- No unnecessary `backdrop-blur-*` glassmorphism over dark overlays where solid dark scrims (`bg-black/75`) provide clearer legibility.
- No unprompted multi-hue gradients or floating SaaS decorative pills.
- Preserve clear visual parity across `/` (Landing + Admin Portal modal), `/complete-profile`, `/dashboard`, `/dashboard/events/:id`, and `/admin`.
