// Password protection for the operator UI.
//
// Enabled when the AUTOLYRICS_PASSWORD environment variable is set. Then:
//  * the operator UI ("/", editor, options, players) requires a login (cookie)
//  * every changing action requires it: WebSocket messages that change songs,
//    playback or players, MP3 upload and instance sync
//  * the display views /live, /stage, /player stay reachable without login,
//    but their WebSocket connection is read-only
//  * /api/export and /uploads/* also accept "Authorization: Bearer <password>",
//    so another instance can pull songs (instance sync)
// Without the variable everything stays open, as before.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE_NAME = 'autolyrics_session';
const SESSION_DAYS = 30;
const MAX_FAILED_LOGINS = 10; // per IP and window
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

// Constant-time comparison of two strings of any length
function safeEqual(a, b) {
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// Random key per data directory, so sessions survive a restart but cannot be
// forged without access to the server. Changing the password ends all sessions.
function loadSessionKey(dataDir, password) {
  const file = path.join(dataDir, 'session-secret');
  let secret;
  try {
    secret = fs.readFileSync(file, 'utf8').trim();
  } catch (e) {
    secret = '';
  }
  if (!/^[0-9a-f]{64}$/.test(secret)) {
    secret = crypto.randomBytes(32).toString('hex');
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file, secret + '\n', { mode: 0o600 });
    } catch (e) {
      console.error('Konnte session-secret nicht speichern (Anmeldungen gelten nur bis zum Neustart):', e.message);
    }
  }
  return crypto.createHmac('sha256', secret).update('autolyrics-session\0' + password).digest();
}

function isHttps(req) {
  if (req.socket && req.socket.encrypted) return true;
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

// Only relative paths inside this app are allowed as redirect target
function safeNext(value) {
  const v = String(value || '');
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loginPage({ error, next }) {
  return `<!DOCTYPE html>
<html lang="de" translate="no">
<head>
<meta charset="UTF-8" />
<meta name="google" content="notranslate" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>Anmelden – Autolyrics</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<style>
  :root { --bg: #F4EFE4; --card: #FFFFFF; --ink: #221F1A; --dim: #6B6558; --line: #D8CFBB; --amber: #D89A3E; --danger: #B5453A; }
  @media (prefers-color-scheme: dark) { :root { --bg: #121215; --card: #18181F; --ink: #EDEAE4; --dim: #9AA0AE; --line: #2E2E38; --danger: #E05A4C; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px;
         background: var(--bg); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  form { width: 100%; max-width: 340px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 28px 24px; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  p { margin: 0 0 20px; font-size: 13px; color: var(--dim); }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--dim); margin-bottom: 6px; }
  input { width: 100%; font-size: 16px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
  button { width: 100%; margin-top: 16px; font-size: 15px; font-weight: 600; padding: 11px; border: 0; border-radius: 10px; background: var(--amber); color: #241a08; cursor: pointer; }
  .error { margin: 0 0 14px; font-size: 13px; color: var(--danger); font-weight: 600; }
  .hint { margin: 16px 0 0; font-size: 12px; }
  .hint a { color: var(--dim); }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1>Autolyrics</h1>
  <p>Bitte anmelden, um die Steuerung zu öffnen.</p>
  ${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ''}
  <label for="password">Passwort</label>
  <input id="password" name="password" type="password" autocomplete="current-password" autofocus required />
  <input type="hidden" name="next" value="${escapeHtml(safeNext(next))}" />
  <button type="submit">Anmelden</button>
  <p class="hint">Anzeigen ohne Anmeldung: <a href="/live">Live</a> · <a href="/stage">Stage</a> · <a href="/player">Player</a></p>
</form>
</body>
</html>`;
}

function createAuth({ password, dataDir }) {
  const enabled = typeof password === 'string' && password.length > 0;
  const key = enabled ? loadSessionKey(dataDir, password) : null;
  const failedLogins = new Map(); // ip -> { count, since }

  const sign = (payload) => crypto.createHmac('sha256', key).update(payload).digest('base64url');

  function createSessionToken() {
    const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    const payload = `v1.${expires}.${crypto.randomBytes(9).toString('base64url')}`;
    return `${payload}.${sign(payload)}`;
  }

  function isValidSessionToken(token) {
    if (!token || typeof token !== 'string') return false;
    const i = token.lastIndexOf('.');
    if (i <= 0) return false;
    const payload = token.slice(0, i);
    if (!safeEqual(sign(payload), token.slice(i + 1))) return false;
    const expires = Number(payload.split('.')[1]);
    return Number.isFinite(expires) && expires > Date.now();
  }

  function hasSession(req) {
    if (!enabled) return true;
    return isValidSessionToken(parseCookies(req.headers.cookie)[COOKIE_NAME]);
  }

  function hasBearer(req) {
    if (!enabled) return true;
    const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    return !!m && safeEqual(m[1], password);
  }

  // A browser on another site must not be able to use the cookie for the
  // WebSocket (cross-site WebSocket hijacking): the Origin must match the Host.
  function isSameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true; // non-browser clients
    try {
      return new URL(origin).host === req.headers.host;
    } catch (e) {
      return false;
    }
  }

  function setSessionCookie(req, res, token, maxAgeSeconds) {
    const parts = [
      `${COOKIE_NAME}=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (isHttps(req)) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function tooManyAttempts(ip) {
    const entry = failedLogins.get(ip);
    if (!entry) return false;
    if (Date.now() - entry.since > FAILED_LOGIN_WINDOW_MS) {
      failedLogins.delete(ip);
      return false;
    }
    return entry.count >= MAX_FAILED_LOGINS;
  }

  function recordFailedLogin(ip) {
    const entry = failedLogins.get(ip);
    if (!entry || Date.now() - entry.since > FAILED_LOGIN_WINDOW_MS) failedLogins.set(ip, { count: 1, since: Date.now() });
    else entry.count++;
  }

  // --- middleware -------------------------------------------------------------

  // Pages of the operator UI: redirect to the login page
  function requireLoginPage(req, res, next) {
    if (hasSession(req)) return next();
    res.redirect(302, `/login?next=${encodeURIComponent(safeNext(req.originalUrl))}`);
  }

  // API calls from the operator UI
  function requireLoginApi(req, res, next) {
    if (hasSession(req)) return next();
    res.status(401).json({ error: 'Nicht angemeldet. Bitte die Seite neu laden und anmelden.' });
  }

  // Song package and audio: operator session or another instance with the password
  function requireLoginOrBearer(req, res, next) {
    if (hasSession(req) || hasBearer(req)) return next();
    res.status(401).json({ error: 'Passwort erforderlich' });
  }

  function registerRoutes(app) {
    const form = require('express').urlencoded({ extended: false, limit: '4kb' });

    app.get('/login', (req, res) => {
      if (!enabled || hasSession(req)) return res.redirect(302, safeNext(req.query.next));
      res.type('html').send(loginPage({ next: req.query.next }));
    });

    app.post('/login', form, (req, res) => {
      const next = safeNext(req.body && req.body.next);
      if (!enabled) return res.redirect(302, next);
      const ip = req.socket.remoteAddress || '?';
      if (tooManyAttempts(ip)) {
        res.status(429).type('html').send(loginPage({ error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.', next }));
        return;
      }
      if (!safeEqual((req.body && req.body.password) || '', password)) {
        recordFailedLogin(ip);
        res.status(401).type('html').send(loginPage({ error: 'Falsches Passwort.', next }));
        return;
      }
      failedLogins.delete(ip);
      setSessionCookie(req, res, createSessionToken(), SESSION_DAYS * 24 * 60 * 60);
      res.redirect(303, next);
    });

    app.post('/logout', (req, res) => {
      setSessionCookie(req, res, '', 0);
      res.redirect(303, '/login');
    });
  }

  return {
    enabled,
    hasSession,
    isSameOrigin,
    requireLoginPage,
    requireLoginApi,
    requireLoginOrBearer,
    registerRoutes,
  };
}

module.exports = { createAuth, safeNext };
