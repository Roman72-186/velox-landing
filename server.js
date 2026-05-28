const http = require('http');
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

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket.remoteAddress || '');
  return rawIp.split(',')[0].trim().replace(/^::ffff:/, '') || 'unknown';
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

function resolveFilePath(urlPath) {
  const safePath = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  if (
    safePath.startsWith('/.git') ||
    safePath.startsWith('/.claude') ||
    safePath.startsWith('/node_modules')
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

      await sendLeadEmail(lead, ip);
      sendJson(res, 200, { ok: true });
      return;
    } catch (error) {
      console.error('[contact-form] request failed', error);
      sendJson(res, 500, { ok: false, message: 'Internal server error.' });
      return;
    }
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStaticFile(req, res, requestUrl.pathname);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
