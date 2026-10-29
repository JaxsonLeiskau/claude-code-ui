'use strict';
/*
 * Phone access: an optional second door into Roundtable for your other devices.
 *  - Off until turned on in Settings → Phone, and only with a password set.
 *  - Answers only to Tailscale addresses (100.64.0.0/10, fd7a:115c:a1e0::/48), never the open internet.
 *  - Every page and API call needs a signed-in session cookie; failed sign-ins are rate limited.
 * The normal local door (127.0.0.1, this computer only) is unaffected.
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let D = null;          // { APP_DIR, PUBLIC_DIR, route, send, MIME }
let cfg = { enabled: false, port: 3500, hash: null, salt: null, sessions: {} };
let srv = null, state = { running: false, error: null };
const fails = new Map(); // ip -> { n, until }
const cfgFile = () => path.join(D.APP_DIR, 'remote.json');
const SESSION_DAYS = 90;

function init(deps) {
  D = deps;
  try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) }; } catch {}
  cfg.sessions = cfg.sessions || {};
  if (cfg.enabled && cfg.hash) startListening();
}
function save() {
  fs.mkdirSync(D.APP_DIR, { recursive: true });
  fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

/* ---------------- who may connect ---------------- */
function isTailscale(ip) {
  ip = String(ip || '').replace(/^::ffff:/, '');
  const m = ip.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (m) return +m[1] === 100 && +m[2] >= 64 && +m[2] <= 127; // 100.64.0.0/10
  return /^fd7a:115c:a1e0:/i.test(ip);
}
const isLoopback = ip => /^(127\.|::1$|::ffff:127\.)/.test(String(ip || ''));
// The address the phone typed: a Tailscale IP, a one-word machine name or a *.ts.net name. Anything else
// (a public website's name pointed at this computer, "DNS rebinding") is refused.
function hostOk(host) {
  const n = String(host || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return isTailscale(n) || isLoopback(n) || n === 'localhost' || /^[a-z0-9-]+$/.test(n) || /^[a-z0-9.-]+\.ts\.net$/.test(n);
}
function addresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && isTailscale(a.address)) out.push(a.address);
  const name = os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return { ips: out, name, urls: [...(out.length ? [`http://${name}:${cfg.port}`] : []), ...out.map(ip => `http://${ip}:${cfg.port}`)] };
}

/* ---------------- passwords and sessions ---------------- */
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 32).toString('hex');
const tokenId = t => crypto.createHash('sha256').update(String(t)).digest('hex');
function cookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function authed(req) {
  const t = cookie(req, 'rt_session');
  if (!t) return false;
  const exp = cfg.sessions[tokenId(t)];
  return !!exp && exp > Date.now();
}

/* ---------------- settings (from this computer only) ---------------- */
function status() {
  const now = Date.now();
  return { enabled: !!cfg.enabled, port: cfg.port, hasPassword: !!cfg.hash, running: state.running, error: state.error,
    devices: Object.values(cfg.sessions).filter(e => e > now).length, ...addresses() };
}
async function configure(body) {
  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 8) throw new Error('Use a password of at least 8 characters.');
    cfg.salt = crypto.randomBytes(16).toString('hex');
    cfg.hash = hashPw(body.password, cfg.salt);
    cfg.sessions = {}; // a new password signs every phone out
  }
  if (Number.isInteger(body.port) && body.port >= 1024 && body.port <= 65535 && body.port !== cfg.port) { cfg.port = body.port; if (srv) await stopListening(); }
  if (body.signOutAll) cfg.sessions = {};
  if (typeof body.enabled === 'boolean') {
    if (body.enabled && !cfg.hash) throw new Error('Set a password first.');
    cfg.enabled = body.enabled;
  }
  save();
  if (cfg.enabled && !srv) await startListening();
  if (!cfg.enabled && srv) await stopListening();
  return status();
}

/* ---------------- the phone door ---------------- */
const LOGIN_OPEN = new Set(['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']);
async function handle(req, res) {
  const ip = req.socket.remoteAddress;
  if (!isTailscale(ip) && !isLoopback(ip)) { res.writeHead(403); return res.end('Roundtable only answers over Tailscale.'); }
  const host = String(req.headers.host || '').toLowerCase();
  if (!hostOk(host)) { res.writeHead(403); return res.end('Forbidden'); }
  const origin = req.headers.origin;
  if (origin && origin.toLowerCase() !== `http://${host}`) { res.writeHead(403); return res.end('Forbidden'); }
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/api/remote/login' && req.method === 'POST') {
    const key = String(ip);
    const f = fails.get(key) || { n: 0, until: 0 };
    if (f.until > Date.now()) return D.send(res, 429, { error: `Too many tries. Wait ${Math.ceil((f.until - Date.now()) / 60000)} min and try again.` });
    let body = {};
    try { body = await readSmall(req); } catch { return D.send(res, 400, { error: 'Bad request' }); }
    const ok = cfg.hash && crypto.timingSafeEqual(Buffer.from(hashPw(body.password || '', cfg.salt), 'hex'), Buffer.from(cfg.hash, 'hex'));
    if (!ok) {
      f.n++; if (f.n >= 5) { f.until = Date.now() + 15 * 60000; f.n = 0; }
      fails.set(key, f);
      return D.send(res, 401, { error: 'That password isn\'t right.' });
    }
    fails.delete(key);
    const token = crypto.randomBytes(32).toString('hex');
    cfg.sessions[tokenId(token)] = Date.now() + SESSION_DAYS * 86400000;
    for (const [k, exp] of Object.entries(cfg.sessions)) if (exp < Date.now()) delete cfg.sessions[k];
    save();
    res.setHeader('Set-Cookie', `rt_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
    return D.send(res, 200, { ok: true });
  }
  if (p === '/api/remote/logout' && req.method === 'POST') {
    const t = cookie(req, 'rt_session');
    if (t) { delete cfg.sessions[tokenId(t)]; save(); }
    res.setHeader('Set-Cookie', 'rt_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return D.send(res, 200, { ok: true });
  }
  if (!authed(req)) {
    if (LOGIN_OPEN.has(p)) return D.serveStatic(p, res);
    if (p.startsWith('/api/')) return D.send(res, 401, { error: 'Sign in first' });
    return D.serveStatic('/login.html', res);
  }
  if (p.startsWith('/api/remote') || p === '/api/app/install-update') return D.send(res, 403, { error: 'Change this from the computer itself.' });
  req.remote = true;
  return D.route(req, res);
}
function readSmall(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 10000) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function startListening() {
  return new Promise(resolve => {
    srv = http.createServer((req, res) => {
      handle(req, res).catch(e => { console.error(e); if (!res.headersSent) D.send(res, 500, { error: String(e.message || e) }); else res.end(); });
    });
    srv.once('error', e => {
      state = { running: false, error: e.code === 'EADDRINUSE' ? `Port ${cfg.port} is already in use — pick another.` : e.message };
      srv = null; resolve();
    });
    srv.listen(cfg.port, '0.0.0.0', () => { state = { running: true, error: null }; resolve(); });
  });
}
function stopListening() {
  return new Promise(resolve => { if (!srv) return resolve(); srv.close(() => resolve()); srv.closeAllConnections && srv.closeAllConnections(); srv = null; state = { running: false, error: null }; });
}

module.exports = { init, status, configure, isEnabled: () => !!(cfg.enabled && cfg.hash), _test: { isTailscale, hostOk, handle } };
