const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const querystring = require('querystring');
const nodemailer = require('nodemailer');

const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT || 3000);
const MAIL_TO = process.env.MAIL_TO || 'hello@queenofspades.tech';
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || MAIL_TO;
const MAIL_DRY_RUN = /^(1|true|yes)$/i.test(process.env.MAIL_DRY_RUN || '');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = /^(1|true|yes)$/i.test(process.env.SMTP_SECURE || String(SMTP_PORT === 465));
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_MIN_INTERVAL_MS = 20 * 1000;
const rateLimitStore = new Map();

// Заявки хранятся вне каталога сайта: rsync --delete при деплое стёр бы их.
// На VPS systemd создаёт каталог через StateDirectory= и передаёт путь в STATE_DIRECTORY.
const LEADS_DIR = process.env.LEADS_DIR || process.env.STATE_DIRECTORY || path.join(ROOT_DIR, 'data');
const LEADS_FILE = path.join(LEADS_DIR, 'leads.json');
const LEAD_STATUSES = ['new', 'in_progress', 'done', 'spam'];
const LEAD_NOTE_MAX_LENGTH = 2000;

// Кабинет супер-админа выключен, пока на сервере не задан ADMIN_PASSWORD от 12 символов
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_ENABLED = ADMIN_PASSWORD.length >= 12;
const ADMIN_COOKIE = 'qos_admin';
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_FAILURES = 5;
const adminSessions = new Map(); // token → expiresAt; живут в памяти, после рестарта вход заново
const adminLoginFailures = new Map(); // ip → [timestamps]

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

let transporter;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value, maxLength) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function normalizeIp(value) {
  return String(value || '').trim().replace(/^::ffff:/, '');
}

// Заголовкам доверяем только от локального nginx. X-Real-IP он перезаписывает целиком,
// а в X-Forwarded-For дописывает адрес клиента в конец — первые элементы подставляет сам клиент.
function getClientIp(req) {
  const socketIp = normalizeIp(req.socket.remoteAddress);
  if (socketIp !== '127.0.0.1' && socketIp !== '::1') return socketIp || 'unknown';

  const realIp = normalizeIp(req.headers['x-real-ip']);
  if (realIp) return realIp;

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',');
  return normalizeIp(forwarded[forwarded.length - 1]) || socketIp;
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { attempts: [], lastAttemptAt: 0 };
  entry.attempts = entry.attempts.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (entry.lastAttemptAt && now - entry.lastAttemptAt < RATE_LIMIT_MIN_INTERVAL_MS) {
    rateLimitStore.set(ip, entry);
    return false;
  }

  if (entry.attempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    rateLimitStore.set(ip, entry);
    return false;
  }

  entry.attempts.push(now);
  entry.lastAttemptAt = now;
  rateLimitStore.set(ip, entry);
  return true;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 32 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parsePayload(req, rawBody) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody || '{}');
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return querystring.parse(rawBody);
  }
  return {};
}

function buildLead(payload) {
  return {
    projectType: normalizeText(payload.projectType || payload.project_type, 120),
    description: normalizeText(payload.description, 4000),
    contact: normalizeText(payload.contact, 320),
    companyWebsite: normalizeText(payload.companyWebsite || payload.company_website, 320)
  };
}

function validateLead(lead) {
  if (lead.companyWebsite) {
    return { ok: false, statusCode: 400, message: 'Spam detected.' };
  }
  if (!lead.description || !lead.contact) {
    return { ok: false, statusCode: 400, message: 'Description and contact are required.' };
  }
  if (lead.description.length < 10) {
    return { ok: false, statusCode: 400, message: 'Description is too short.' };
  }
  return { ok: true };
}

function getTransporter() {
  if (MAIL_DRY_RUN) return null;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      // Укладываемся в proxy_read_timeout 30s у nginx: заявка уже сохранена, ждать почту дольше незачем
      connectionTimeout: 10 * 1000,
      greetingTimeout: 10 * 1000,
      socketTimeout: 15 * 1000,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }
  return transporter;
}

async function sendLeadEmail(lead, ip) {
  const subject = lead.projectType
    ? `New website lead: ${lead.projectType}`
    : 'New website lead';

  const text = [
    'New lead from queenofspades.tech',
    '',
    `Project type: ${lead.projectType || 'Not selected'}`,
    `Contact: ${lead.contact}`,
    `IP: ${ip}`,
    '',
    'Description:',
    lead.description
  ].join('\n');

  const html = [
    '<h2>New lead from queenofspades.tech</h2>',
    `<p><strong>Project type:</strong> ${escapeHtml(lead.projectType || 'Not selected')}</p>`,
    `<p><strong>Contact:</strong> ${escapeHtml(lead.contact)}</p>`,
    `<p><strong>IP:</strong> ${escapeHtml(ip)}</p>`,
    '<p><strong>Description:</strong></p>',
    `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(lead.description)}</pre>`
  ].join('');

  if (MAIL_DRY_RUN) {
    console.log('[MAIL_DRY_RUN] Lead received:', { to: MAIL_TO, subject, lead, ip });
    return;
  }

  const mailOptions = {
    to: MAIL_TO,
    from: MAIL_FROM,
    subject,
    text,
    html
  };

  if (lead.contact.includes('@')) {
    mailOptions.replyTo = lead.contact;
  }

  await getTransporter().sendMail(mailOptions);
}

// ─── Хранилище заявок: один JSON-файл, запись через tmp + rename ───
// Объём — десятки заявок в месяц, поэтому файл целиком в памяти и перезаписывается целиком.

let leadsCache = null;
let leadsWriteQueue = Promise.resolve();

async function loadLeads() {
  if (leadsCache) return leadsCache;
  try {
    const parsed = JSON.parse(await fs.promises.readFile(LEADS_FILE, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`${LEADS_FILE} is not an array`);
    leadsCache = parsed;
  } catch (error) {
    // Битый файл не затираем: лучше ошибка, чем потеря всех заявок
    if (error.code !== 'ENOENT') throw error;
    leadsCache = [];
  }
  return leadsCache;
}

function persistLeads() {
  const snapshot = JSON.stringify(leadsCache, null, 2);
  leadsWriteQueue = leadsWriteQueue
    .catch(() => {})
    .then(async () => {
      await fs.promises.mkdir(LEADS_DIR, { recursive: true, mode: 0o700 });
      const tmpFile = `${LEADS_FILE}.tmp`;
      await fs.promises.writeFile(tmpFile, snapshot, { mode: 0o600 });
      await fs.promises.rename(tmpFile, LEADS_FILE);
    });
  return leadsWriteQueue;
}

async function saveNewLead(lead, ip) {
  const leads = await loadLeads();
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    projectType: lead.projectType,
    contact: lead.contact,
    description: lead.description,
    ip,
    status: 'new',
    note: '',
    mail: { status: 'pending' }
  };
  leads.push(record);
  await persistLeads();
  return record;
}

async function updateLead(id, changes) {
  const leads = await loadLeads();
  const record = leads.find((item) => item.id === id);
  if (!record) return null;
  Object.assign(record, changes, { updatedAt: new Date().toISOString() });
  await persistLeads();
  return record;
}

// ─── Кабинет супер-админа ───

function hashForCompare(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function isAdminPasswordValid(input) {
  return crypto.timingSafeEqual(hashForCompare(input), hashForCompare(ADMIN_PASSWORD));
}

function parseCookies(req) {
  const cookies = {};
  String(req.headers.cookie || '').split(';').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index > 0) cookies[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
  });
  return cookies;
}

function getAdminSessionToken(req) {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (!token) return null;
  const expiresAt = adminSessions.get(token);
  if (!expiresAt) return null;
  if (expiresAt < Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return token;
}

function buildAdminCookie(req, token, maxAgeSeconds) {
  // За nginx соединение с клиентом всегда https; локально (http) Secure-кука не сохранилась бы
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

function isAdminLoginBlocked(ip) {
  const now = Date.now();
  const failures = (adminLoginFailures.get(ip) || []).filter((timestamp) => now - timestamp < ADMIN_LOGIN_WINDOW_MS);
  adminLoginFailures.set(ip, failures);
  return failures.length >= ADMIN_LOGIN_MAX_FAILURES;
}

function registerAdminLoginFailure(ip) {
  const failures = adminLoginFailures.get(ip) || [];
  failures.push(Date.now());
  adminLoginFailures.set(ip, failures);
}

function pruneAdminState() {
  const now = Date.now();
  adminSessions.forEach((expiresAt, token) => {
    if (expiresAt < now) adminSessions.delete(token);
  });
  adminLoginFailures.forEach((failures, ip) => {
    if (!failures.some((timestamp) => now - timestamp < ADMIN_LOGIN_WINDOW_MS)) adminLoginFailures.delete(ip);
  });
}

setInterval(pruneAdminState, 10 * 60 * 1000).unref();

function isJsonRequest(req) {
  // Изменяющие запросы только с JSON: обычная HTML-форма с чужого сайта так не отправит
  return String(req.headers['content-type'] || '').toLowerCase().includes('application/json');
}

async function readJsonBody(req) {
  const rawBody = await readRequestBody(req);
  try {
    const payload = JSON.parse(rawBody || '{}');
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    return {};
  }
}

async function handleAdminApi(req, res, pathname) {
  if (!ADMIN_ENABLED) {
    sendJson(res, 503, { ok: false, enabled: false, message: 'Admin is disabled: ADMIN_PASSWORD is not set.' });
    return;
  }

  if (pathname === '/api/admin/session' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, enabled: true, authenticated: Boolean(getAdminSessionToken(req)) });
    return;
  }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const ip = getClientIp(req);
    if (isAdminLoginBlocked(ip)) {
      sendJson(res, 429, { ok: false, message: 'Too many failed attempts. Try again in 15 minutes.' });
      return;
    }
    if (!isJsonRequest(req)) {
      sendJson(res, 415, { ok: false, message: 'JSON expected.' });
      return;
    }
    const payload = await readJsonBody(req);
    if (!isAdminPasswordValid(payload.password || '')) {
      registerAdminLoginFailure(ip);
      console.warn('[admin] failed login from', ip);
      sendJson(res, 401, { ok: false, message: 'Wrong password.' });
      return;
    }
    adminLoginFailures.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
    res.setHeader('Set-Cookie', buildAdminCookie(req, token, ADMIN_SESSION_TTL_MS / 1000));
    sendJson(res, 200, { ok: true });
    return;
  }

  const token = getAdminSessionToken(req);
  if (!token) {
    sendJson(res, 401, { ok: false, message: 'Not authenticated.' });
    return;
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    adminSessions.delete(token);
    res.setHeader('Set-Cookie', buildAdminCookie(req, '', 0));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/admin/leads' && req.method === 'GET') {
    const leads = await loadLeads();
    const sorted = leads.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(res, 200, { ok: true, leads: sorted });
    return;
  }

  const leadMatch = pathname.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})$/);
  if (leadMatch && req.method === 'PATCH') {
    if (!isJsonRequest(req)) {
      sendJson(res, 415, { ok: false, message: 'JSON expected.' });
      return;
    }
    const payload = await readJsonBody(req);
    const changes = {};
    if (payload.status !== undefined) {
      if (!LEAD_STATUSES.includes(payload.status)) {
        sendJson(res, 400, { ok: false, message: 'Unknown status.' });
        return;
      }
      changes.status = payload.status;
    }
    if (payload.note !== undefined) {
      changes.note = normalizeText(payload.note, LEAD_NOTE_MAX_LENGTH);
    }
    const record = await updateLead(leadMatch[1], changes);
    if (!record) {
      sendJson(res, 404, { ok: false, message: 'Lead not found.' });
      return;
    }
    sendJson(res, 200, { ok: true, lead: record });
    return;
  }

  sendJson(res, 404, { ok: false, message: 'Not found.' });
}

function resolveFilePath(urlPath) {
  let safePath;
  try {
    // Каталог отдаём его index.html, как nginx: /admin/ → /admin/index.html
    safePath = decodeURIComponent(urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
  } catch {
    return null; // битый %-escape: без try исключение роняло процесс
  }

  // Скрытые файлы и каталоги (.env, .git, .deploy_* ключи) и служебное — не отдаём никогда
  const segments = safePath.split(/[/\\]/);
  if (
    segments.some((segment) => segment.startsWith('.')) ||
    /^\/(node_modules|deploy|session-handoffs|data)(\/|$)/.test(safePath) ||
    /^\/(server\.js|package(-lock)?\.json)$/.test(safePath)
  ) {
    return null;
  }

  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(ROOT_DIR, normalizedPath);
  if (!fullPath.startsWith(ROOT_DIR)) return null;
  return fullPath;
}

function serveStaticFile(req, res, pathname) {
  const filePath = resolveFilePath(pathname);
  if (!filePath) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && requestUrl.pathname === '/api/contact') {
    const ip = getClientIp(req);

    if (!checkRateLimit(ip)) {
      sendJson(res, 429, { ok: false, message: 'Too many requests. Please try again later.' });
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      const payload = parsePayload(req, rawBody);
      const lead = buildLead(payload);
      const validation = validateLead(lead);

      if (!validation.ok) {
        sendJson(res, validation.statusCode, { ok: false, message: validation.message });
        return;
      }

      // Сначала сохраняем, потом письмо: упавшая почта больше не теряет заявку
      let record = null;
      try {
        record = await saveNewLead(lead, ip);
      } catch (error) {
        console.error('[contact-form] lead was not saved', error);
      }

      let mail;
      try {
        await sendLeadEmail(lead, ip);
        mail = { status: MAIL_DRY_RUN ? 'dry_run' : 'sent' };
      } catch (error) {
        console.error('[contact-form] email failed', error);
        mail = { status: 'failed', error: normalizeText(error && error.message, 300) };
      }

      if (record) {
        try {
          await updateLead(record.id, { mail: { ...mail, at: new Date().toISOString() } });
        } catch (error) {
          console.error('[contact-form] mail status was not saved', error);
        }
      }

      if (!record && mail.status === 'failed') {
        sendJson(res, 500, { ok: false, message: 'Internal server error.' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      console.error('[contact-form] request failed', error);
      sendJson(res, 500, { ok: false, message: 'Internal server error.' });
      return;
    }
  }

  if (requestUrl.pathname.startsWith('/api/admin/')) {
    try {
      await handleAdminApi(req, res, requestUrl.pathname);
    } catch (error) {
      console.error('[admin] request failed', error);
      if (!res.headersSent) sendJson(res, 500, { ok: false, message: 'Internal server error.' });
    }
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStaticFile(req, res, requestUrl.pathname);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method not allowed');
});

// Только localhost: снаружи сервис доступен лишь через nginx
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
