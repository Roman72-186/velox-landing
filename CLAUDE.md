# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Совместимый вход для Claude Code: перед работой читать [AGENTS.md](AGENTS.md), затем [../../AGENTS.md](../../AGENTS.md).
> Сохранить сессию → C:\Users\User\.agents\skills\save-session\SKILL.md → session-handoffs/current.md.
> Прочитай сохранённую сессию → сначала session-handoffs/current.md, затем [AGENTS.md](AGENTS.md).

---

## Общие слои

Лендинг + Node-бэкенд контакт-формы — читать точечно, не копировать канон сюда:

- **Голос и стиль:** [../../_brain/voice/](../../_brain/voice/), [../../_brain/style/](../../_brain/style/)
- **Код, отладка, деплой (канон):** [../../_brain/principles/code.md](../../_brain/principles/code.md)
- **Применимые уроки** (секреты, env, деплой, коммиты — актуальны с тех пор, как в проекте
  появился `server.js`): [never-touch-or-overwrite-secrets](../../_brain/feedback/never-touch-or-overwrite-secrets.md) ·
  [env-example-is-part-of-delivery](../../_brain/feedback/env-example-is-part-of-delivery.md) ·
  [always-backup-before-deploy](../../_brain/feedback/always-backup-before-deploy.md) ·
  [deploy-what-users-actually-open](../../_brain/feedback/deploy-what-users-actually-open.md) ·
  [change-only-files-the-task-touched](../../_brain/feedback/change-only-files-the-task-touched.md)
- **Корневой навигатор:** [../../CLAUDE.md](../../CLAUDE.md)

**Свой git.** У проекта собственный репозиторий (`origin` → `github.com/Roman72-186/velox-landing`),
не общий git workspace — коммитить и пушить изнутри этой папки.

---

## Project

Landing page + lead-form backend for **Queen of Spades Tech** (`queenofspades.tech`), a digital product
development studio. Frontend is a static site (`index.html` + `style.css` + `script.js` + `icons.css`)
plus several static subpages; a small dependency-light Node.js server (`server.js`) serves those files
and handles the contact form. No frontend framework, no bundler/build step.

UI language: **English is the default** (`<html lang="en">`, `currentLang = 'en'`), Russian is the
second fully translated language; the other 8 dropdown languages back-fill missing keys from English.

## File Structure

```
├── index.html, style.css, script.js, icons.css   ← the landing page (see Architecture below)
├── server.js, package.json                        ← Node http server + POST /api/contact (nodemailer)
├── contact/, privacy/, terms/, services/{mvp-development,saas-development,marketplace-development,ai-integration}/
├── 404.html, robots.txt, sitemap.xml, CNAME, favicon*/og-image.png
├── deploy/server/{nginx-queenofspades.conf, queenofspades.service}, deploy/MIGRATION.md
├── .github/workflows/deploy.yml   ← auto-deploy to VPS on push to main (see Deploy below)
├── FORM_SETUP.md, .env.example    ← contact-form config & VPS setup reference
└── .claude/skills/                ← Claude Code skills (auto-loaded)
```

`exports/`, `index_col.html`, `LOOP_INSTRUCTION.md`, `INTEGRATION.md`, `resend-analysis.md`,
`queenofspades-hetzner-deploy-*.zip` are local working/reference artifacts — not deployed
(excluded in `deploy.yml`'s rsync step).

## Development

Frontend-only edits (HTML/CSS/JS) can be previewed by opening `index.html` directly in a browser.
To exercise the contact form locally, run the Node server instead:

```bash
npm install
PORT=3001 MAIL_DRY_RUN=true npm start   # http://localhost:3001 — logs the lead instead of sending email
```

`server.js` does not load `.env` itself (no dotenv): locally pass env vars inline (default `PORT` is
3000); on the VPS systemd injects them via `EnvironmentFile=` in `deploy/server/queenofspades.service`.

**Cache-busting.** All 10 HTML pages (`index.html`, `404.html`, `contact/`, `privacy/`, `terms/`,
`services/**`) share the root `style.css`, `icons.css`, `script.js` via `?v=N` query strings. After
editing a shared asset, bump its `?v=` in **every** page, otherwise returning visitors get a stale file.
Subpages also load Three.js + `script.js`, so i18n keys for subpage text live in `EXTRA_TRANSLATIONS`.

No build step, no linter, no automated test suite. `playwright` is a devDependency but there are no
committed spec files — it's available for ad-hoc manual browser checks, not a CI test suite.

### Contact form backend (`server.js`)

Plain `http` module (no Express). Responsibilities:
- Serves static files from the repo root (blocks `.git`, `.claude`, `node_modules`).
- `POST /api/contact` → validates payload (honeypot `companyWebsite` field, min description length),
  rate-limits by IP (5 attempts / 10 min window, 20s min interval between attempts), sends the lead via
  `nodemailer` SMTP (or logs it when `MAIL_DRY_RUN=true`).

Required env vars (see `.env.example`): `PORT`, `MAIL_TO`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_DRY_RUN`. Node listens on `127.0.0.1:PORT`; nginx
(`deploy/server/nginx-queenofspades.conf`) proxies the public domain to it — if you change `PORT`,
update `proxy_pass` there too. New env key → update `.env.example` in the same change.

**Secrets rule:** never write, overwrite, or print real values in `.env` / server `.env` — the owner
edits those by hand. Verify by shape (length/prefix), not by echoing the value.

### Deploy

Push to `main` on paths listed in `.github/workflows/deploy.yml` triggers: rsync of site files to the
VPS, `npm ci --omit=dev`, `systemctl restart queenofspades`, then an HTTP smoke test (homepage 200,
`/api/contact` honeypot returns 400/429). This is the only path that reaches the domain the user
actually opens — a local build is not "deployed" until this path ran. Full manual VPS setup (nginx,
systemd, Certbot, DNS cutover) is in [FORM_SETUP.md](FORM_SETUP.md) and [deploy/MIGRATION.md](deploy/MIGRATION.md).
Before any manual server-side change (not through this pipeline), back up the current `.env`/service
state first — no exceptions for "small fixes".

## Architecture

### HTML (`index.html`, ~744 lines)

Semantic structure: `<header>` → `<main>` → `<footer>`. Skip-link for a11y. All sections have
`aria-label`. Contact form uses proper `<form>` with `label[for]` and a hidden honeypot field
(`companyWebsite`) matching the backend's spam check.

**Section order (do NOT reorder), matched by `<section id="...">`:**
NAV → HERO (`#hero`, includes stats row) → SERVICES (`#services`) → PROCESS (`#process`) →
STACK (`#stack`) → PROJECTS (`#projects`) → AI (`#ai`) → CONTACT (`#contact`) → FOOTER

### CSS (`style.css`, ~2199 lines)

Numbered Table of Contents at the top. Sections found by searching `─── N.`:
1=Custom Properties, 2=Reset, 3=Layout, 4=Nav, 5=Hero, 6=Buttons, 7=Stats Row, 8=Section Headers,
9=Services, 10=Process, 11=Stack, 12=Projects, 13=AI, 14=Contact, 15=Footer, 16=Dividers,
17=Language Dropdown, 18=Animations (`@keyframes`), 19=Media Queries (≤900px).

All colors use CSS Custom Properties from `:root` — never hardcode hex in rules.

### JS (`script.js`, ~1236 lines)

Three parts in one file:
- **Module 1 — 3D hero animation** (IIFE, Three.js r128): an *armillary sphere / gyroscope*, not a
  simple cube — 5 concentric metal rings (`CONFIG.rings`) built via `ExtrudeGeometry` along a custom
  `CircleCurve`, each with its own gimbal axis/speed, rendered transparent onto `<canvas id="heroCanvas">`
  inside `#hero-3d`. Uses `IntersectionObserver` to stop rendering when off-screen.
- **Module 2 — i18n**: `TRANSLATIONS` object merged with `EXTRA_TRANSLATIONS` (English keys back-fill
  any language missing a key), `applyLang()`, `setLang()`, language dropdown UI (`toggleLangMenu()`).
- **Module 3 — UI interactions**: burger menu, language dropdown wiring, and the contact form submit
  handler (`getFormUiCopy()`, `setFormStatus()`) that POSTs JSON to `/api/contact` and shows
  localized success/error/rate-limit states.

Three.js is loaded as a separate CDN `<script>` before `script.js` in `index.html`.

## Design System (do NOT change)

### Colors (CSS Custom Properties only)
```
--bg: #000000            --text: #ededec         --accent: #40c4ff
--bg-2: #0a0a0a          --text-muted: #8a8a8a    --accent-glow: rgba(64,196,255,0.12)
--bg-card: #0f0f0f       --text-dim: #4a4a4a      --border: rgba(255,255,255,0.06)
                                                    --border-hover: rgba(64,196,255,0.2)
```

- Background is **always black** — no gray, no dark blue
- Accent `#40c4ff` used as **glow only**, never as fill (exception: `.btn-primary`)
- Purple accent only in the `.hero-title .highlight` gradient, nowhere else

### Fonts
| Use | Font | Weight |
|-----|------|--------|
| Headings, buttons, nav | `Syne` | 600–800 |
| Descriptions, tags, code | `JetBrains Mono` | 300–500 |
| **NEVER** | Inter, Roboto, Arial, system-ui | — |

## Key Constraints

| # | Rule |
|---|------|
| 1 | Frontend is `index.html` + `style.css` + `script.js` + `icons.css`; backend is `server.js` — don't introduce a framework or bundler for either |
| 2 | Colors only through `:root` variables, never hardcode hex |
| 3 | Fonts only Syne + JetBrains Mono |
| 4 | Animations only: hero gyroscope + button border glow + card hover. Nothing else |
| 5 | Every visible string needs a `data-i18n` key with EN and RU values (EN is the default and the fallback) |
| 6 | Buttons always: `position: relative; z-index: 0` |
| 7 | `btn-primary::after` background must match button background |
| 8 | Three.js version **r128** — do NOT upgrade (API breaks in r142+) |
| 9 | Section order and IDs are immutable |
| 10 | All amounts/money client mentions, if any, are display-only text — this project has no payment logic |

## Animations (strictly limited)

**Allowed only:**
1. **3D gyroscope** in hero (Three.js r128) — slow rotation, gimbal motion per ring
2. **Button border glow** — `@property --btn-angle` + `conic-gradient` spinning light
3. **Card hover** — `translateY(-2px)` + `border-color` change

**Forbidden:** scroll animations, parallax, typewriter, particles, any other JS/CSS animations.

## i18n (10 languages)

Languages: `en` (default), `ru` (fully translated), `en-gb`, `fr`, `de`, `es`, `ca`, `pl`, `ar` (RTL!), `ja`.

To add a language: (1) add an object to `TRANSLATIONS` (or `EXTRA_TRANSLATIONS`) in `script.js`,
(2) add a button to `.lang-menu` in HTML, (3) add a label in `applyLang()`. Any key missing from a
language object falls back to the English value via the `EXTRA_TRANSLATIONS` merge step.

Arabic switches to RTL: `document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'`.
Language choice is saved to `localStorage` (`lang`); with nothing saved the page starts in English.

## Hero Section (critical)

**Strictly two columns** — text left (`.hero-left`), 3D gyroscope right (`.hero-cube-wrap`).
Grid `1fr 1fr` (collapses to a single centered column only in the ≤900px media query).
Do NOT center the hero on desktop. Do NOT place the gyroscope above the title. These were evaluated
and rejected — see below.

## Rejected Approaches (do NOT revisit)

- Centered hero layout (Resend-style) on desktop — rejected per TZ
- Gyroscope above heading — rejected (Resend's style)
- Serif fonts — rejected
- Neural network animation (sphere dots, v1) and perspective grid (v2) — both replaced
- Simple rotating cube — earlier version of the hero visual, replaced by the armillary-sphere gyroscope

## External Dependencies

Frontend (CDN only, no npm): Google Fonts (Syne + JetBrains Mono) and Three.js r128 from cdnjs.
Do NOT add jQuery, Alpine, GSAP, or any other frontend library.

Backend (npm, `server.js` only): `nodemailer`. Do NOT add Express or another web framework — the
server is intentionally a thin wrapper around Node's built-in `http` module.
