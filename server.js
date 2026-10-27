#!/usr/bin/env node
'use strict';
/*
 * Claude Code UI — a local, claude.ai-style interface for the Claude Code CLI.
 * No dependencies. Reads your sessions from ~/.claude/projects and runs the
 * `claude` CLI in headless mode (stream-json) for new messages.
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const PORT = Number(process.env.PORT) || 3456;
const HOST = '127.0.0.1';
const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_HOME, 'projects');
const APP_DIR = path.join(os.homedir(), '.claude-code-ui');
const META_FILE = path.join(APP_DIR, 'meta.json');
const TRASH_DIR = path.join(APP_DIR, 'trash');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const IS_WIN = process.platform === 'win32';

const ID_RE = /^[A-Za-z0-9_-]{6,100}$/;
const MODEL_RE = /^[A-Za-z0-9._\-\[\]]{1,80}$/;
const TOOL_RE = /^[A-Za-z0-9_:\-]{1,120}$/;
const PERM_MODES = new Set(['default', 'acceptEdits', 'plan', 'bypassPermissions']);

/* ---------------- metadata (titles, stars) ---------------- */
let meta = { sessions: {} };
try { meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8')); meta.sessions = meta.sessions || {}; } catch {}
let saveTimer = null;
function saveMeta() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(APP_DIR, { recursive: true }); fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2)); }
    catch (e) { console.error('Could not save metadata:', e.message); }
  }, 100);
}

/* ---------------- transcript parsing ---------------- */
function cleanUserText(s) {
  if (typeof s !== 'string') return '';
  if (/^\s*<local-command-(stdout|stderr)>/.test(s)) return '';
  if (s.startsWith('Caveat: The messages below were generated')) return '';
  const cmd = s.match(/<command-name>([^<]*)<\/command-name>/);
  if (cmd) {
    const args = (s.match(/<command-args>([\s\S]*?)<\/command-args>/) || [])[1] || '';
    return (cmd[1].trim() + ' ' + args.trim()).trim();
  }
  return s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
}

function userParts(message) {
  const c = message && message.content;
  const out = { text: '', images: 0, toolResults: [] };
  if (typeof c === 'string') { out.text = cleanUserText(c); return out; }
  if (!Array.isArray(c)) return out;
  const texts = [];
  for (const b of c) {
    if (!b) continue;
    if (b.type === 'text') texts.push(cleanUserText(b.text));
    else if (b.type === 'image') out.images++;
    else if (b.type === 'tool_result') out.toolResults.push(b);
  }
  out.text = texts.filter(Boolean).join('\n\n');
  return out;
}

function resultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(b => b && b.type === 'text' ? b.text : b && b.type === 'image' ? '[image]' : '').join('\n');
  return content == null ? '' : JSON.stringify(content, null, 2);
}
const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + `\n… (${s.length - n} more characters)` : s || '');

function parseLines(text, fn) {
  for (const line of text.split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    fn(o);
  }
}

const scanCache = new Map(); // file -> { mtime, size, info }
const idToFile = new Map();

async function listSessionFiles() {
  let dirs = [];
  try { dirs = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const dir = path.join(PROJECTS_DIR, d.name);
    let ents = [];
    try { ents = await fsp.readdir(dir); } catch { continue; }
    for (const f of ents) if (f.endsWith('.jsonl') && !f.startsWith('agent-')) files.push({ file: path.join(dir, f), projectDir: d.name });
  }
  return files;
}

async function scanFile({ file, projectDir }) {
  let st; try { st = await fsp.stat(file); } catch { return null; }
  const id = path.basename(file, '.jsonl');
  idToFile.set(id, file);
  const hit = scanCache.get(file);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.info;
  let text = '';
  try { text = await fsp.readFile(file, 'utf8'); } catch { return null; }
  let cwd = null, firstPrompt = null, summary = null, customTitle = null, created = null, updated = null, userCount = 0, branch = null;
  parseLines(text, o => {
    if (o.type === 'summary' && o.summary) summary = o.summary;
    if (o.type === 'custom-title' && o.customTitle) customTitle = o.customTitle;
    if (o.cwd && !cwd) cwd = o.cwd;
    if (o.gitBranch) branch = o.gitBranch;
    if (o.timestamp) { if (!created) created = o.timestamp; updated = o.timestamp; }
    if (o.isSidechain || o.isMeta) return;
    if (o.type === 'user' && !o.isCompactSummary) {
      const p = userParts(o.message);
      if (p.text && !p.text.startsWith('[Request interrupted')) { userCount++; if (!firstPrompt) firstPrompt = p.text; }
    }
  });
  const info = userCount ? {
    id, cwd: cwd || projectDir, projectDir,
    autoTitle: (customTitle || summary || firstPrompt).replace(/\s+/g, ' ').trim().slice(0, 140),
    firstPrompt: firstPrompt.replace(/\s+/g, ' ').slice(0, 300),
    created, updated: updated || new Date(st.mtimeMs).toISOString(), userCount, branch, size: st.size,
  } : null;
  scanCache.set(file, { mtime: st.mtimeMs, size: st.size, info });
  return info;
}

function decorate(info) {
  const m = meta.sessions[info.id] || {};
  return { ...info, title: m.title || info.autoTitle, pinned: !!m.pinned };
}

async function listSessions() {
  const files = await listSessionFiles();
  const infos = [];
  // modest concurrency so huge histories don't spike memory
  for (let i = 0; i < files.length; i += 16) {
    const batch = await Promise.all(files.slice(i, i + 16).map(scanFile));
    for (const b of batch) if (b) infos.push(decorate(b));
  }
  infos.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  return infos;
}

async function findSessionFile(id) {
  if (idToFile.has(id) && fs.existsSync(idToFile.get(id))) return idToFile.get(id);
  for (const f of await listSessionFiles()) {
    if (path.basename(f.file, '.jsonl') === id) { idToFile.set(id, f.file); return f.file; }
  }
  return null;
}

async function loadTurns(file, limitBytes) {
  let buf = await fsp.readFile(file);
  if (limitBytes != null) buf = buf.subarray(0, limitBytes);
  const turns = [];
  const tools = new Map();
  parseLines(buf.toString('utf8'), o => {
    if (o.isSidechain) return;
    if (o.type === 'user') {
      if (o.isCompactSummary) { turns.push({ role: 'notice', text: 'Conversation compacted — earlier context was summarized.' }); return; }
      if (o.isMeta) return;
      const p = userParts(o.message);
      for (const r of p.toolResults) {
        const t = tools.get(r.tool_use_id);
        if (t) { t.result = clip(resultText(r.content), 30000); t.isError = !!r.is_error; t.status = r.is_error ? 'error' : 'done'; }
      }
      if (p.text.startsWith('[Request interrupted')) { turns.push({ role: 'notice', text: 'Interrupted' }); return; }
      if (p.text || p.images) turns.push({ role: 'user', text: p.text, images: p.images, ts: o.timestamp });
    } else if (o.type === 'assistant') {
      const content = o.message && o.message.content;
      if (!Array.isArray(content)) return;
      let last = turns[turns.length - 1];
      if (!last || last.role !== 'assistant') { last = { role: 'assistant', blocks: [], ts: o.timestamp }; turns.push(last); }
      for (const b of content) {
        if (b.type === 'text' && b.text && b.text.trim() && b.text.trim() !== '(no content)') last.blocks.push({ type: 'text', text: b.text });
        else if (b.type === 'thinking' && b.thinking && b.thinking.trim()) last.blocks.push({ type: 'thinking', text: b.thinking });
        else if (b.type === 'tool_use') {
          const t = { type: 'tool', id: b.id, name: b.name, input: b.input, status: 'done' };
          tools.set(b.id, t); last.blocks.push(t);
        }
      }
    }
  });
  return turns.filter(t => t.role !== 'assistant' || t.blocks.length);
}

/* ---------------- running the CLI ---------------- */
const runs = new Map();

function pushEvent(run, ev) {
  ev.t = Date.now();
  run.events.push(ev);
  for (const l of run.listeners) l(ev);
}

function finishRun(run, code) {
  if (run.done) return;
  run.done = true;
  pushEvent(run, { kind: 'exit', code, stopped: !!run.stopped });
  for (const l of run.listeners) l(null);
  run.listeners.clear();
  setTimeout(() => runs.delete(run.id), 10 * 60 * 1000);
}

function activeRunFor(sessionId) {
  for (const r of runs.values()) if (!r.done && r.sessionId === sessionId) return r;
  return null;
}

async function startRun({ sessionId, prompt, cwd, model, permissionMode, allowedTools }) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  if (sessionId) args.push('--resume', sessionId);
  if (model) args.push('--model', model);
  if (permissionMode === 'bypassPermissions') args.push('--dangerously-skip-permissions');
  else if (permissionMode && permissionMode !== 'default') args.push('--permission-mode', permissionMode);
  if (allowedTools && allowedTools.length) args.push('--allowedTools', allowedTools.join(','));

  const run = {
    id: crypto.randomUUID(), sessionId: sessionId || null, cwd, prompt: prompt.slice(0, 200),
    events: [], listeners: new Set(), done: false, startSize: 0, startedAt: Date.now(),
  };
  if (sessionId) {
    const f = await findSessionFile(sessionId);
    if (f) { try { run.startSize = fs.statSync(f).size; } catch {} }
  }
  runs.set(run.id, run);
  pushEvent(run, { kind: 'start', runId: run.id, sessionId: run.sessionId });
  pushEvent(run, { kind: 'user', text: prompt });

  let proc;
  try {
    proc = spawn(CLAUDE_BIN, args, { cwd, env: process.env, shell: IS_WIN, windowsHide: true });
  } catch (e) {
    pushEvent(run, { kind: 'error', text: e.message }); finishRun(run, -1); return run;
  }
  run.proc = proc;
  let buf = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch { pushEvent(run, { kind: 'stderr', text: line + '\n' }); continue; }
      if (o.type === 'system' && o.subtype === 'init' && o.session_id) run.sessionId = o.session_id;
      pushEvent(run, { kind: 'claude', data: o });
    }
  });
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', d => pushEvent(run, { kind: 'stderr', text: d }));
  proc.on('error', e => {
    pushEvent(run, {
      kind: 'error',
      text: e.code === 'ENOENT'
        ? 'Couldn\'t find the `claude` command. Install Claude Code (`npm install -g @anthropic-ai/claude-code`), or start this app with CLAUDE_BIN set to the full path of the claude executable.'
        : e.message,
    });
    finishRun(run, -1);
  });
  proc.on('close', code => finishRun(run, code));
  proc.stdin.on('error', () => {});
  proc.stdin.end(prompt);
  return run;
}

function stopRun(run) {
  if (!run || run.done || !run.proc) return;
  run.stopped = true;
  try {
    if (IS_WIN) execFile('taskkill', ['/pid', String(run.proc.pid), '/T', '/F'], () => {});
    else run.proc.kill('SIGINT');
  } catch {}
  setTimeout(() => { if (!run.done) try { run.proc.kill('SIGKILL'); } catch {} }, 3000);
}

/* ---------------- http ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 4e6) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

let allowedHosts = [];
function requestAllowed(req) {
  // Only answer to this machine: blocks DNS-rebinding and cross-site requests.
  const host = (req.headers.host || '').toLowerCase();
  if (!allowedHosts.includes(host)) return false;
  const origin = req.headers.origin;
  if (origin && !allowedHosts.map(h => 'http://' + h).includes(origin.toLowerCase())) return false;
  return true;
}

let versionCache = null;
function claudeVersion() {
  if (versionCache) return Promise.resolve(versionCache);
  return new Promise(resolve => {
    execFile(CLAUDE_BIN, ['--version'], { shell: IS_WIN, timeout: 10000, windowsHide: true }, (err, out) => {
      versionCache = err ? null : String(out).trim();
      resolve(versionCache);
    });
  });
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const m = req.method;

  if (p === '/api/info' && m === 'GET') {
    return send(res, 200, {
      version: await claudeVersion(), home: os.homedir(), user: os.userInfo().username,
      defaultCwd: process.env.DEFAULT_CWD || process.cwd(), platform: process.platform,
      sep: path.sep, projectsDir: PROJECTS_DIR, appDir: APP_DIR,
    });
  }

  if (p === '/api/sessions' && m === 'GET') return send(res, 200, { sessions: await listSessions() });

  let mm;
  if ((mm = p.match(/^\/api\/sessions\/([^/]+)$/))) {
    const id = mm[1];
    if (!ID_RE.test(id)) return send(res, 400, { error: 'Bad session id' });
    const file = await findSessionFile(id);
    if (m === 'GET') {
      if (!file) return send(res, 404, { error: 'Session not found' });
      const info = await scanFile({ file, projectDir: path.basename(path.dirname(file)) });
      const run = activeRunFor(id);
      const turns = await loadTurns(file, run ? run.startSize : undefined);
      return send(res, 200, { session: info ? decorate(info) : { id, title: 'Untitled', cwd: null }, turns, run: run ? { id: run.id } : null });
    }
    if (m === 'PATCH') {
      const body = await readBody(req);
      const cur = meta.sessions[id] || {};
      if (typeof body.title === 'string') cur.title = body.title.trim().slice(0, 200) || undefined;
      if (typeof body.pinned === 'boolean') cur.pinned = body.pinned;
      meta.sessions[id] = cur; saveMeta();
      return send(res, 200, { ok: true });
    }
    if (m === 'DELETE') {
      if (!file) return send(res, 404, { error: 'Session not found' });
      if (activeRunFor(id)) return send(res, 409, { error: 'This chat is still running' });
      const dest = path.join(TRASH_DIR, path.basename(path.dirname(file)));
      await fsp.mkdir(dest, { recursive: true });
      await fsp.rename(file, path.join(dest, path.basename(file))).catch(async () => {
        await fsp.copyFile(file, path.join(dest, path.basename(file))); await fsp.unlink(file);
      });
      scanCache.delete(file); idToFile.delete(id); delete meta.sessions[id]; saveMeta();
      return send(res, 200, { ok: true, movedTo: dest });
    }
  }

  if (p === '/api/search' && m === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    if (q.length < 2) return send(res, 200, { hits: [] });
    const hits = [];
    for (const f of await listSessionFiles()) {
      let text; try { text = (await fsp.readFile(f.file, 'utf8')).toLowerCase(); } catch { continue; }
      const i = text.indexOf(q);
      if (i >= 0) hits.push({ id: path.basename(f.file, '.jsonl') });
      if (hits.length >= 200) break;
    }
    return send(res, 200, { hits });
  }

  if (p === '/api/fs' && m === 'GET') {
    let dir = url.searchParams.get('path') || os.homedir();
    if (dir.startsWith('~')) dir = path.join(os.homedir(), dir.slice(1));
    dir = path.resolve(dir);
    let ents;
    try { ents = await fsp.readdir(dir, { withFileTypes: true }); }
    catch (e) { return send(res, 400, { error: `Can't open ${dir}` }); }
    const dirs = ents.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map(e => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const parent = path.dirname(dir);
    return send(res, 200, { path: dir, parent: parent === dir ? null : parent, dirs, home: os.homedir() });
  }

  if (p === '/api/chat' && m === 'POST') {
    const body = await readBody(req);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return send(res, 400, { error: 'Empty message' });
    const sessionId = body.sessionId || null;
    if (sessionId && !ID_RE.test(sessionId)) return send(res, 400, { error: 'Bad session id' });
    if (sessionId && activeRunFor(sessionId)) return send(res, 409, { error: 'Claude is still working in this chat' });
    let cwd = body.cwd || os.homedir();
    if (sessionId) {
      const file = await findSessionFile(sessionId);
      const info = file && await scanFile({ file, projectDir: path.basename(path.dirname(file)) });
      if (info && info.cwd) cwd = info.cwd;
    }
    try { if (!fs.statSync(cwd).isDirectory()) throw 0; } catch { return send(res, 400, { error: `Folder not found: ${cwd}` }); }
    const model = body.model && MODEL_RE.test(body.model) ? body.model : null;
    const permissionMode = PERM_MODES.has(body.permissionMode) ? body.permissionMode : 'default';
    const allowedTools = (Array.isArray(body.allowedTools) ? body.allowedTools : []).filter(t => TOOL_RE.test(t));
    const run = await startRun({ sessionId, prompt, cwd, model, permissionMode, allowedTools });
    return send(res, 200, { runId: run.id });
  }

  if (p === '/api/runs' && m === 'GET') {
    return send(res, 200, { runs: [...runs.values()].filter(r => !r.done).map(r => ({ id: r.id, sessionId: r.sessionId, cwd: r.cwd, startedAt: r.startedAt, prompt: r.prompt })) });
  }

  if ((mm = p.match(/^\/api\/runs\/([^/]+)\/events$/)) && m === 'GET') {
    const run = runs.get(mm[1]);
    if (!run) return send(res, 404, { error: 'Run not found' });
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    for (const ev of run.events) res.write(JSON.stringify(ev) + '\n');
    if (run.done) return res.end();
    const l = ev => { if (ev === null) res.end(); else res.write(JSON.stringify(ev) + '\n'); };
    run.listeners.add(l);
    req.on('close', () => run.listeners.delete(l));
    return;
  }

  if ((mm = p.match(/^\/api\/runs\/([^/]+)\/stop$/)) && m === 'POST') {
    stopRun(runs.get(mm[1]));
    return send(res, 200, { ok: true });
  }

  if (p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

  // static files
  if (m !== 'GET' && m !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
  const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
  const fp = path.resolve(PUBLIC_DIR, rel);
  if (!fp.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (!requestAllowed(req)) { res.writeHead(403); return res.end('Forbidden'); }
  try { await route(req, res); }
  catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: String(e.message || e) }); else res.end(); }
});

function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  const cmd = process.platform === 'darwin' ? ['open', [url]] : IS_WIN ? ['cmd', ['/c', 'start', '""', url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref(); } catch {}
}

/** Start listening; resolves with the port actually used. */
function start(port = PORT, triesLeft = 10) {
  return new Promise((resolve, reject) => {
    const onError = e => {
      if (e.code === 'EADDRINUSE' && triesLeft > 0) resolve(start(port + 1, triesLeft - 1));
      else reject(e);
    };
    server.once('error', onError);
    server.listen(port, HOST, () => {
      server.off('error', onError);
      allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`];
      resolve(port);
    });
  });
}

function stopAll() { for (const r of runs.values()) stopRun(r); }

module.exports = { start, stopAll };

// Run directly (`node server.js`): serve and open the default browser.
if (require.main === module) {
  start().then(port => {
    const url = `http://localhost:${port}`;
    console.log(`\n  ✻ Claude Code UI running at ${url}\n    Reading sessions from ${PROJECTS_DIR}\n    Press Ctrl+C to quit.\n`);
    openBrowser(url);
  }).catch(e => { console.error(e.message); process.exit(1); });
  process.on('SIGINT', () => { stopAll(); setTimeout(() => process.exit(0), 300); });
}
