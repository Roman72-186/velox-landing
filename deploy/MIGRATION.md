# Миграция queenofspades.tech на новый VPS (TimeWeb)

Полный runbook переезда лендинга с текущего Hetzner на TimeWeb VPS с минимальным downtime через DNS cutover. Не выкатываем в один шаг — поднимаем новый параллельно, прогреваем, переключаем DNS, гасим старый.

> Стек на сервере: Ubuntu 22.04/24.04, Node.js 20+, Nginx, Let's Encrypt. Бэкенд формы — systemd unit `queenofspades.service`, слушает `127.0.0.1:3001`. Статика — `/var/www/queenofspades.tech/`.

---

## 0. Перед стартом миграции

- [ ] Заказан VPS на TimeWeb (Ubuntu 22.04 или 24.04 LTS, 1–2 vCPU, 2 GB RAM — с запасом).
- [ ] Получен публичный IPv4 нового VPS — далее `NEW_IP`.
- [ ] Записан текущий IP — далее `OLD_IP` (для роллбэка).
- [ ] В GoDaddy DNS **за сутки до миграции** TTL у `A`-записей `queenofspades.tech` и `www` снижен до **300 сек** (без смены значения). Это даст быстрое распространение при переключении.
- [ ] Сохранён актуальный `.env` со старого сервера (`/var/www/queenofspades.tech/.env`) — пригодится один в один.
- [ ] Текущий приватный SSH-ключ Hetzner — **не использовать на новом VPS**, сгенерировать отдельный для GitHub Actions.

---

## 1. Подготовка нового VPS

Все команды — от `root` (через root-SSH из панели TimeWeb).

### 1.1 Базовая настройка системы

```bash
apt update && apt upgrade -y
apt install -y nginx curl ca-certificates gnupg ufw fail2ban

# Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Certbot из snap (рекомендованный путь Let's Encrypt)
apt install -y snapd
snap install core && snap refresh core
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot

# Часовой пояс и hostname (опционально)
timedatectl set-timezone Europe/Moscow
hostnamectl set-hostname queenofspades
```

### 1.2 Брандмауэр

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

### 1.3 Пользователь `deploy` для GitHub Actions

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG www-data deploy

mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Сгенерируй пару ключей на локальной машине **(а не на сервере, не на старом Hetzner)**:

```bash
ssh-keygen -t ed25519 -C "github-actions-queenofspades" -f ./qos_deploy_key -N ""
```

Содержимое `qos_deploy_key.pub` положи в `/home/deploy/.ssh/authorized_keys` на новом VPS. Содержимое приватного `qos_deploy_key` — в GitHub Secret `DEPLOY_SSH_KEY`. После настройки приватный ключ с локалки **удалить**.

### 1.4 Passwordless sudo для restart сервиса

GitHub Actions деплоит и должен уметь рестартовать systemd unit без пароля. **Важно:** sudoers сверяет путь литерально, без раскрытия симлинков, поэтому сначала уточняем актуальный путь к `systemctl` на образе TimeWeb:

```bash
command -v systemctl
# Обычно /usr/bin/systemctl на Ubuntu 22.04/24.04 — но возможно и /bin/systemctl на старых сборках.
# Подставь ниже именно то, что вернула команда.
```

```bash
SYSTEMCTL="$(command -v systemctl)"   # например /usr/bin/systemctl
cat > /etc/sudoers.d/deploy-queenofspades <<EOF
deploy ALL=(root) NOPASSWD: ${SYSTEMCTL} restart queenofspades, ${SYSTEMCTL} is-active queenofspades, ${SYSTEMCTL} status queenofspades
EOF
chmod 0440 /etc/sudoers.d/deploy-queenofspades
visudo -cf /etc/sudoers.d/deploy-queenofspades   # проверка синтаксиса

# Проверь, что от пользователя deploy это реально работает БЕЗ пароля:
sudo -u deploy sudo -n systemctl is-active queenofspades
# Если "a password is required" — путь не совпал, поправь sudoers и повтори.
```

### 1.5 Каталог сайта и права

```bash
mkdir -p /var/www/queenofspades.tech
chown -R deploy:www-data /var/www/queenofspades.tech
chmod 2775 /var/www/queenofspades.tech
```

---

## 2. Первичный заезд кода (без DNS-переключения)

### 2.1 Залить файлы

С локальной машины (или через GitHub Actions с временным `workflow_dispatch` на тестовую ветку):

```bash
rsync -avz --delete \
  --exclude='.git/' --exclude='.github/' --exclude='.claude/' \
  --exclude='node_modules/' --exclude='.env*' --exclude='*.zip' \
  --exclude='deploy/MIGRATION.md' --exclude='CLAUDE.md' \
  -e "ssh -i ./qos_deploy_key" \
  ./ deploy@NEW_IP:/var/www/queenofspades.tech/
```

### 2.2 `.env` (перенести вручную, не через git)

```bash
ssh deploy@NEW_IP
cd /var/www/queenofspades.tech
nano .env       # вставить содержимое со старого сервера, проверить PORT=3001

# Критично: systemd unit запускается как User=www-data и читает EnvironmentFile.
# Файл должен быть читаем www-data, но не публично — поэтому смена владельца + 600.
sudo chown www-data:www-data .env
sudo chmod 600 .env
```

### 2.3 Установить зависимости

```bash
cd /var/www/queenofspades.tech
npm ci --omit=dev
```

### 2.4 Поставить systemd unit

```bash
sudo cp deploy/server/queenofspades.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now queenofspades
sudo systemctl status queenofspades        # должен быть active (running)

# Локальная проверка бэкенда
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"description":"local smoke 1234567890","contact":"x@y.z","companyWebsite":"bad"}' \
  http://127.0.0.1:3001/api/contact
# Ожидаем 400 "Spam detected." → сервис жив
```

### 2.5 Поставить nginx (без HTTPS на этом шаге)

Сначала временный HTTP-only конфиг — нужен для certbot:

```bash
sudo tee /etc/nginx/sites-available/queenofspades.tech > /dev/null <<'EOF'
server {
    listen 80;
    server_name queenofspades.tech www.queenofspades.tech;
    root /var/www/queenofspades.tech;
    index index.html;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { try_files $uri $uri/ $uri.html =404; }
}
EOF
sudo ln -sf /etc/nginx/sites-available/queenofspades.tech /etc/nginx/sites-enabled/queenofspades.tech
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 2.6 Проверка по IP до DNS-переключения

С локальной машины:

```bash
curl -sI -H "Host: queenofspades.tech" http://NEW_IP/
# Ожидаем 200 OK и Content-Type: text/html
```

Должен возвращаться `index.html` с нового сервера. **Не переключай DNS, пока этот шаг не зелёный.**

---

## 3. SSL и финальный nginx

DNS пока смотрит на старый сервер, certbot по `--standalone` не подойдёт. Два варианта:

### 3.1 Вариант A (рекомендуемый): сначала DNS, потом certbot

После того как DNS переключён (раздел 4) и `dig queenofspades.tech` показывает `NEW_IP`:

```bash
sudo certbot --nginx -d queenofspades.tech -d www.queenofspades.tech \
  --agree-tos -m hello@queenofspades.tech --redirect --non-interactive
```

Certbot автоматически добавит SSL-блок в nginx-конфиг. Поверх него накатить наш расширенный конфиг:

```bash
sudo cp deploy/server/nginx-queenofspades.conf /etc/nginx/sites-available/queenofspades.tech
sudo nginx -t && sudo systemctl reload nginx
```

### 3.2 Вариант B (если хочется HTTPS до DNS): DNS-01 challenge

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d queenofspades.tech -d www.queenofspades.tech
```

Certbot выдаст TXT-записи — добавить их в GoDaddy → дождаться распространения (~1–2 мин) → нажать Enter. После этого положить полный `nginx-queenofspades.conf` и reload.

---

## 4. DNS Cutover

Идёт быстро благодаря TTL=300 из шага 0.

1. GoDaddy → DNS Management → `queenofspades.tech`.
2. Изменить `A`-запись `@` и `A`-запись `www`: значение → `NEW_IP`. TTL оставить 300.
3. С нескольких точек проверить распространение:
   ```bash
   dig +short queenofspades.tech @8.8.8.8
   dig +short queenofspades.tech @1.1.1.1
   dig +short www.queenofspades.tech
   ```
   Все три должны вернуть `NEW_IP`.
4. Если ещё не выпустил сертификат (Вариант A) — сейчас самое время.
5. Открыть https://queenofspades.tech/ в браузере с очищенным кэшем (или incognito).

---

## 5. Smoke-проверка после переключения

```bash
# Главная и подстраницы
for path in / /services/ /contact/ /privacy/ /terms/ /404; do
  echo -n "$path → "; curl -sS -o /dev/null -w "%{http_code}\n" "https://queenofspades.tech$path"
done

# API формы (honeypot вернёт 400 — это нормально, бэкенд жив)
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"description":"smoke after cutover 1234567890","contact":"smoke@example.com","companyWebsite":"bad"}' \
  https://queenofspades.tech/api/contact

# SSL grade
curl -sI https://queenofspades.tech/ | grep -i strict-transport
```

В браузере: отправить **реальную** заявку с тестовым контактом, проверить, что письмо пришло на `hello@queenofspades.tech`.

---

## 6. Включить GitHub Actions автодеплой

> ⚠️ Подключай workflow **после** того, как раздел 5 прошёл. До cutover любые правки в `main` пойдут на новый VPS, который ещё никто не верифицировал. Если очень нужно тестировать workflow до переключения — используй ветку и `workflow_dispatch`, не пушь в main.
>
> Smoke-test в workflow использует `--resolve` и бьёт **именно в `DEPLOY_HOST`**, поэтому ложный зелёный (попадание на старый сервер) исключён, даже если DNS ещё не переключён. Но реальные пользователи в этот момент пойдут на старый — это не deploy всё-таки.

В репозитории GitHub → Settings → Secrets and variables → Actions добавить:

| Secret | Значение |
|---|---|
| `DEPLOY_HOST` | `NEW_IP` (или `queenofspades.tech` — но IP надёжнее на случай DNS-проблем) |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Полный текст приватного `qos_deploy_key` (с `-----BEGIN OPENSSH PRIVATE KEY-----`) |
| `DEPLOY_PORT` | `22` (или то, что у тебя на TimeWeb) |
| `DEPLOY_PATH` | `/var/www/queenofspades.tech` |

Дальше любой push в `main`, затрагивающий файлы из `paths:` в [.github/workflows/deploy.yml](../.github/workflows/deploy.yml), запускает деплой автоматически. Запуск вручную: Actions → Deploy to VPS → Run workflow.

---

## 7. TTL обратно и финальный cleanup

Через 24–48 часов после переключения, если всё стабильно:

- [ ] В GoDaddy поднять TTL обратно до 3600/7200.
- [ ] На старом Hetzner: `systemctl stop queenofspades && systemctl disable queenofspades`, потом отключить или снести инстанс.
- [ ] Удалить из репозитория `.deploy_hetzner_*` ключи (они уже в `.gitignore`, но физически на диске лежат).
- [ ] Удалить старые архивы `queenofspades-hetzner-deploy-v*.zip` из корня.
- [ ] Если деплой через GH Actions работает — приватный `qos_deploy_key` с локальной машины удалить (он есть в GitHub Secret).

---

## 8. Роллбэк (если что-то пошло не так)

**На стадии до DNS-переключения** — просто не переключай DNS, новый VPS гасишь без последствий.

**На стадии после DNS-переключения:**

1. В GoDaddy вернуть `A`-записи на `OLD_IP`. Благодаря TTL=300 откат пойдёт за минуты.
2. На старом Hetzner убедиться, что сервис ещё жив: `systemctl status queenofspades`. Если ты его не успел погасить — он работает.
3. Если HTTPS на новом успел отдать HSTS со `max-age=31536000`, у пользователей в браузере останется HSTS — но они вернутся к старому серверу через тот же домен по HTTPS, и старый сертификат всё ещё валиден. Downtime для них = время DNS-распространения.

---

## 9. Чеклист на день миграции

```
[ ] TTL DNS = 300 (за сутки)
[ ] Новый VPS поднят, IP записан
[ ] Базовый apt + Node 20 + nginx + certbot + ufw
[ ] Пользователь deploy + SSH-ключ + passwordless sudo для systemctl
[ ] rsync файлов в /var/www/queenofspades.tech/
[ ] .env залит вручную, chmod 600
[ ] npm ci --omit=dev
[ ] systemd unit поставлен, сервис active
[ ] Временный HTTP-only nginx, curl с Host header вернул 200
[ ] DNS переключён, dig показывает NEW_IP с нескольких резолверов
[ ] certbot выдал сертификат, накатан полный nginx-конфиг
[ ] Smoke-тесты зелёные (/, /services/, /contact/, /api/contact)
[ ] Реальная заявка → письмо пришло
[ ] GitHub Secrets настроены, workflow_dispatch успешен
[ ] TTL поднят обратно (через сутки)
[ ] Старый сервер выключен (через 48 часов)
```
