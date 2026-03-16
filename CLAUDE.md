# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

Landing page for a digital product development studio (VELOX — placeholder name).
Static site: `index.html` + `style.css` + `script.js`. No frameworks, no build tools.
Content language: Russian (primary), with i18n dropdown switching to 10 languages.

## File Structure

```
├── index.html       ← HTML markup (semantic sections, forms, nav)
├── style.css        ← All styles (CSS Custom Properties → sections → media queries)
├── script.js        ← All logic (Three.js cube + i18n + UI interactions)
├── CLAUDE.md        ← This file
└── .claude/skills/  ← Claude Code skills (auto-loaded)
```

No additional files. External deps are CDN-only: Google Fonts + Three.js r128.

## Development

Open `index.html` directly in a browser — no server needed. No build, no lint, no tests.
To preview: just open the file. To edit: work in `index.html`, `style.css`, or `script.js` directly.

## Architecture

### HTML (`index.html`, ~714 lines)

Semantic structure: `<header>` → `<main>` → `<footer>`.
Skip-link for a11y. All sections have `aria-label`. Form uses proper `<form>` with `label[for]`.

**10 sections in strict order (do NOT reorder):**
NAV → HERO → STATS → SERVICES (`#services`) → PROCESS (`#process`) → STACK (`#stack`) → PROJECTS (`#projects`) → AI (`#ai`) → CONTACT (`#contact`) → FOOTER

### CSS (`style.css`, ~1429 lines)

Has a numbered Table of Contents at the top. Sections found by searching `─── N.`:
1=Custom Properties, 2=Reset, 3=Layout, 4=Nav, 5=Hero, 6=Buttons, 7=Stats, 8=Section Headers, 9=Services, 10=Process, 11=Stack, 12=Projects, 13=AI, 14=Contact, 15=Footer, 16=Dividers, 17=Language Dropdown, 18=Skip Link, 19=Media Queries.

All colors use CSS Custom Properties from `:root` — never hardcode hex in rules.

### JS (`script.js`, ~464 lines)

Two IIFE modules:
- **Module 1** — 3D cube animation (Three.js r128, `<canvas id="heroCanvas">`)
- **Module 2** — i18n system (`TRANSLATIONS` object, `applyLang()`, `setLang()`, lang dropdown UI)

Three.js is loaded as separate CDN `<script>` before `script.js` in `index.html`.

## Design System (do NOT change)

### Colors (CSS Custom Properties only)
```
--bg: #080808          --text: #f0f0f0        --accent: #40c4ff
--bg-2: #0f0f0f        --text-muted: #888888  --accent-glow: rgba(64,196,255,0.15)
--bg-card: #111111     --text-dim: #555555    --border: rgba(255,255,255,0.06)
```

- Background is **always black** — no gray, no dark blue
- Accent `#40c4ff` used as **glow only**, never as fill (exception: `.btn-primary`)
- Purple `#a78bfa` only in `.hero-title .highlight` gradient, nowhere else

### Fonts
| Use | Font | Weight |
|-----|------|--------|
| Headings, buttons, nav | `Syne` | 600–800 |
| Descriptions, tags, code | `JetBrains Mono` | 300–500 |
| **NEVER** | Inter, Roboto, Arial, system-ui | — |

## Key Constraints

| # | Rule |
|---|------|
| 1 | Three files only: `index.html` + `style.css` + `script.js` |
| 2 | Colors only through `:root` variables, never hardcode hex |
| 3 | Fonts only Syne + JetBrains Mono |
| 4 | Animations only: cube + button border glow + hover. Nothing else |
| 5 | Page content in Russian, i18n translates from RU |
| 6 | Logo = SVG placeholder until real one arrives |
| 7 | Buttons always: `position: relative; z-index: 0` |
| 8 | `btn-primary::after` background must match button background |
| 9 | Three.js version **r128** — do NOT upgrade (API breaks in r142+) |
| 10 | Section order and IDs are immutable |

## Animations (strictly limited)

**Allowed only:**
1. **3D cube** in hero (Three.js r128) — slow rotation, breathing, float
2. **Button border glow** — `@property --btn-angle` + `conic-gradient` spinning light
3. **Card hover** — `translateY(-2px)` + `border-color` change

**Forbidden:** scroll animations, parallax, typewriter, particles, any other JS/CSS animations.

## i18n (10 languages)

Languages: `ru` (primary), `en`, `en-gb`, `fr`, `de`, `es`, `ca`, `pl`, `ar` (RTL!), `ja`.

To add a language: (1) add object to `TRANSLATIONS` in `script.js`, (2) add button to `.lang-menu` in HTML, (3) add label in `applyLang()`.

Arabic switches to RTL: `document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'`.
Language choice saved to `localStorage`.

## Hero Section (critical)

**Strictly two columns** — text left, 3D cube right. Grid `1fr 1fr`.
Do NOT center the hero. Do NOT place cube above title. These were evaluated and rejected.

## Rejected Approaches (do NOT revisit)

- Centered hero layout (Resend-style) — rejected per TZ
- Cube above heading — rejected (Resend's style)
- Serif fonts — rejected
- Neural network animation (sphere dots) — was v1, replaced
- Perspective grid — was v2, replaced

## Placeholders (awaiting from client Лиза)

- `VELOX` — company name placeholder
- SVG hexagon — logo placeholder
- `hello@velox.dev` / `@velox_dev` — contact placeholders
- Future: replace cube with voice AI assistant (Whisper + LLM)

## External Dependencies

```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

Nothing else. Do NOT add jQuery, Alpine, GSAP, or any other libraries.
