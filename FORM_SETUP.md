# Form Setup

This project accepts contact-form submissions through `POST /api/contact` and sends them to `hello@queenofspades.tech`.

## Recommended split

- GoDaddy: domain, DNS, and mailbox
- VPS (TimeWeb / Hetzner / любой Ubuntu): app hosting for the site and form endpoint

## Required environment variables

Create a `.env` file on the server from `.env.example`:

```bash
PORT=3001
MAIL_TO=hello@queenofspades.tech
MAIL_FROM=hello@queenofspades.tech
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=hello@queenofspades.tech
SMTP_PASS=replace_with_smtp_password
MAIL_DRY_RUN=false
```

> Node-сервис слушает `127.0.0.1:3001`, наружу его пробрасывает nginx (см. `deploy/server/nginx-queenofspades.conf`). Если меняешь порт — синхронно правь и `proxy_pass` в nginx-конфиге.

If `hello@queenofspades.tech` is not hosted on GoDaddy Professional Email, replace the SMTP values with the exact SMTP settings from the real mailbox provider.

## Local smoke test

Start the site without sending real emails:

```bash
MAIL_DRY_RUN=true npm start
```

Open `http://localhost:3001`, submit the form, and check the terminal log.

## Minimal VPS deploy

1. Create a small Ubuntu 22.04/24.04 server.
2. Point GoDaddy `A` records for `queenofspades.tech` and `www` to the server IP.
3. Upload this project to `/var/www/queenofspades.tech`.
4. Install Node.js 20+ and Nginx.
5. Copy `.env.example` to `.env` and fill in the real SMTP password.
6. Run `npm ci --omit=dev`.
7. Copy `deploy/server/queenofspades.service` to `/etc/systemd/system/queenofspades.service`.
8. Copy `deploy/server/nginx-queenofspades.conf` to `/etc/nginx/sites-available/queenofspades.tech` and enable it.
9. Run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable queenofspades
sudo systemctl restart queenofspades
sudo ln -s /etc/nginx/sites-available/queenofspades.tech /etc/nginx/sites-enabled/queenofspades.tech
sudo nginx -t
sudo systemctl reload nginx
```

10. Issue HTTPS certificates with Certbot after DNS resolves.

Полный пошаговый runbook миграции (включая стратегию DNS cutover и роллбэк) — в [deploy/MIGRATION.md](deploy/MIGRATION.md).

## Files needed on the server

- `index.html`
- `style.css`
- `script.js`
- `icons.css`
- `server.js`
- `package.json`
- `package-lock.json`
- `favicon.svg`
- `favicon-16.png`
- `favicon-32.png`
- `apple-touch-icon.png`
- `og-image.png`
- `robots.txt`
- `sitemap.xml`
- `404.html`
- `contact/`, `privacy/`, `terms/`, `services/` (подстраницы)
- `deploy/server/*` (только для первичной установки)

## Spam protection included

- hidden honeypot field
- basic payload validation
- in-memory rate limiting

If traffic grows, move rate limiting to Redis or a reverse proxy.
