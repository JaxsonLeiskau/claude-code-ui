'use strict';
/*
 * Sync between devices through a private GitHub repository.
 *
 * Every device keeps working on its own files; this mirrors the conversation data to the
 * repo and pulls in other devices' changes with a three-way comparison per file
 * (this device / GitHub / what both looked like after the last sync).
 *
 * Synced:   Claude Code transcripts, chat titles/stars/project assignments, projects
 *           (details, instructions, memory, files) and chats with other AI models.
 * Not synced: API keys, sign-in token, app settings, and the files Claude edits in your
 *           project folders (use git for code).
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let D = null;            // dependencies from server.js
let cfg = null;          // { token, owner, repo, branch, user, deviceName }
let state = { base: {}, cache: {}, head: null };
let status = { state: 'off', lastSync: null, lastChanges: 0, error: null, running: false };
let timer = null, soonTimer = null;

const API = process.env.CCUI_GITHUB_API || 'https://api.github.com';
const cfgFile = () => path.join(D.APP_DIR, 'sync.json');
const stateFile = () => path.join(D.APP_DIR, 'sync-state.json');
const conflictsDir = () => path.join(D.APP_DIR, 'conflicts');
const TOMBSTONES = 'deleted.json';

function init(deps) {
  D = deps;
  try { cfg = JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch { cfg = null; }
  try { state = { base: {}, cache: {}, head: null, ...JSON.parse(fs.readFileSync(stateFile(), 'utf8')) }; } catch {}
  if (cfg) { status.state = 'idle'; schedule(); setTimeout(() => syncNow().catch(() => {}), 8000); }
}
function saveCfg() {
  if (!cfg) { try { fs.unlinkSync(cfgFile()); } catch {} return; }
  fs.mkdirSync(D.APP_DIR, { recursive: true });
  fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try { fs.chmodSync(cfgFile(), 0o600); } catch {}
}
const saveState = () => fsp.writeFile(stateFile(), JSON.stringify(state)).catch(() => {});
function schedule() {
  clearInterval(timer);
  if (cfg) timer = setInterval(() => syncNow().catch(() => {}), 5 * 60 * 1000);
}
/** Ask for a sync shortly (e.g. after a chat finishes); several requests collapse into one. */
function soon(ms = 20000) {
  if (!cfg) return;
  clearTimeout(soonTimer);
  soonTimer = setTimeout(() => syncNow().catch(() => {}), ms);
}

function publicStatus() {
  return {
    connected: !!cfg, user: cfg && cfg.user, repo: cfg && `${cfg.owner}/${cfg.repo}`, device: cfg ? cfg.deviceName : os.hostname(),
    ...status, conflicts: fs.existsSync(conflictsDir()) ? fs.readdirSync(conflictsDir()).length : 0,
  };
}

/* ---------------- GitHub API ---------------- */
async function gh(method, url, body, token = cfg && cfg.token) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'roundtable', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  }).catch(e => { throw new Error(`Couldn't reach GitHub (${e.cause ? e.cause.code || e.cause.message : e.message})`); });
  if (res.status === 204) return null;
  const text = await res.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const err = new Error(friendly(res.status, (j && j.message) || text.slice(0, 200)));
    err.status = res.status; throw err;
  }
  return j;
}
function friendly(code, msg) {
  if (code === 401) return 'GitHub rejected the token — it may have expired or been revoked. Sign in again with a new token.';
  if (code === 403 && /rate limit/i.test(msg)) return 'GitHub rate limit reached; sync will retry later.';
  if (code === 403 || code === 404) return `GitHub says: ${msg}. Check the token has Contents: Read and write access to this repository.`;
  return `GitHub error ${code}: ${msg}`;
}

/* ---------------- sign in ---------------- */
async function connect({ token, repo }) {
  token = String(token || '').trim();
  if (!token) throw new Error('Paste your GitHub token');
  const user = await gh('GET', '/user', null, token).catch(e => { throw e.status === 401 ? new Error('That token doesn\'t work. Copy it again from GitHub (it\'s only shown once).') : e; });
  let full = String(repo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  if (!full) throw new Error('Enter the repository name');
  if (!full.includes('/')) full = `${user.login}/${full}`;
  const [owner, name] = full.split('/');
  let r;
  try { r = await gh('GET', `/repos/${owner}/${name}`, null, token); }
  catch (e) { throw new Error(`Can't see ${owner}/${name}. Check the name, and that the token was given access to this repository.`); }
  if (!r.private) throw new Error(`${owner}/${name} is public — anyone could read your chats. Use a private repository.`);
  if (r.permissions && !r.permissions.push) throw new Error('The token can read this repository but not write to it. Give it "Contents: Read and write".');
  const changedRepo = !cfg || cfg.owner !== owner || cfg.repo !== name;
  cfg = { token, owner, repo: name, branch: r.default_branch || 'main', user: user.login, deviceName: os.hostname() };
  saveCfg();
  if (changedRepo) { state = { base: {}, cache: {}, head: null }; await saveState(); }
  status = { ...status, state: 'idle', error: null };
  schedule();
  return syncNow();
}
function disconnect() {
  cfg = null; saveCfg();
  clearInterval(timer); clearTimeout(soonTimer);
  status = { state: 'off', lastSync: null, lastChanges: 0, error: null, running: false };
  state = { base: {}, cache: {}, head: null }; saveState();
  return publicStatus();
}

/* ---------------- local files as a flat map ---------------- */
const blobSha = buf => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const canon = o => Buffer.from(JSON.stringify(sortKeys(o), null, 1) + '\n');
const sortKeys = o => Array.isArray(o) ? o.map(sortKeys) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sortKeys(o[k])])) : o;
const encodeCwd = cwd => String(cwd).replace(/[^a-zA-Z0-9]/g, '-');

async function fileEntry(p, file, extra = {}) {
  const st = await fsp.stat(file);
  const c = state.cache[p];
  let sha;
  if (c && c.mtime === st.mtimeMs && c.size === st.size) sha = c.sha;
  else { sha = blobSha(await fsp.readFile(file)); state.cache[p] = { mtime: st.mtimeMs, size: st.size, sha }; }
  return { sha, size: st.size, read: () => fsp.readFile(file), ...extra };
}
function memEntry(buf, extra = {}) { return { sha: blobSha(buf), size: buf.length, read: async () => buf, ...extra }; }

async function readTombstones() {
  try { return JSON.parse(await fsp.readFile(path.join(D.APP_DIR, 'deleted.json'), 'utf8')); } catch { return {}; }
}
async function writeTombstones(t) { await fsp.writeFile(path.join(D.APP_DIR, 'deleted.json'), canon(t)); }
/** Remember a deletion so other devices delete it too. kind: claude | chat | project */
async function recordDeletion(kind, id) {
  const t = await readTombstones();
  t[`${kind}:${id}`] = new Date().toISOString();
  await writeTombstones(t);
  soon(3000);
}

async function localFiles(busy) {
  const out = new Map();
  // Claude Code transcripts (never ones that are still being written)
  for (const s of await D.listSessions()) {
    if (busy.has(s.id)) continue;
    const file = await D.findSessionFile(s.id);
    if (file) try { out.set(`claude/${s.id}.jsonl`, await fileEntry(`claude/${s.id}.jsonl`, file, { kind: 'claude', id: s.id, file })); } catch {}
  }
  // titles, stars, project assignments
  const meta = D.getMeta();
  for (const [id, m] of Object.entries(meta.sessions)) {
    const { cwdOverride, ...shared } = m || {};
    if (Object.keys(shared).filter(k => shared[k] !== undefined).length) out.set(`meta/${id}.json`, memEntry(canon(shared), { kind: 'meta', id }));
  }
  // projects
  const store = D.getStore();
  for (const p of Object.values(store.projects)) {
    out.set(`projects/${p.id}/project.json`, memEntry(canon(p), { kind: 'project', id: p.id }));
    const dir = path.join(D.PROJ_ROOT, p.id);
    if (fs.existsSync(path.join(dir, 'memory.md'))) out.set(`projects/${p.id}/memory.md`, await fileEntry(`projects/${p.id}/memory.md`, path.join(dir, 'memory.md'), { kind: 'file' }));
    for (const f of await fsp.readdir(path.join(dir, 'files')).catch(() => [])) {
      const fp = path.join(dir, 'files', f);
      try { if ((await fsp.stat(fp)).isFile()) out.set(`projects/${p.id}/files/${f}`, await fileEntry(`projects/${p.id}/files/${f}`, fp, { kind: 'file' })); } catch {}
    }
  }
  // chats with other models
  for (const f of await fsp.readdir(D.CHATS_DIR).catch(() => [])) {
    const id = f.slice(0, -5);
    if (!f.endsWith('.json') || busy.has(id)) continue;
    try { out.set(`chats/${f}`, await fileEntry(`chats/${f}`, path.join(D.CHATS_DIR, f), { kind: 'chat', id })); } catch {}
  }
  const tomb = await readTombstones();
  if (Object.keys(tomb).length) out.set(TOMBSTONES, memEntry(canon(tomb), { kind: 'tomb' }));
  return out;
}

// Where an incoming file goes on this device
async function writeLocal(p, buf) {
  let m;
  if ((m = p.match(/^claude\/([\w-]+)\.jsonl$/))) {
    let file = await D.findSessionFile(m[1]);
    if (!file) {
      const first = buf.toString('utf8', 0, Math.min(buf.length, 200000)).split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).find(o => o && o.cwd);
      const dir = path.join(D.PROJECTS_DIR, first ? encodeCwd(first.cwd).slice(0, 200) : '-synced');
      await fsp.mkdir(dir, { recursive: true });
      file = path.join(dir, `${m[1]}.jsonl`);
    }
    await fsp.writeFile(file, buf);
    return;
  }
  if ((m = p.match(/^meta\/([\w-]+)\.json$/))) {
    const meta = D.getMeta();
    const keep = meta.sessions[m[1]] && meta.sessions[m[1]].cwdOverride;
    meta.sessions[m[1]] = { ...JSON.parse(buf.toString('utf8')), ...(keep ? { cwdOverride: keep } : {}) };
    D.saveMeta();
    return;
  }
  if ((m = p.match(/^projects\/([\w-]+)\/project\.json$/))) {
    const pr = JSON.parse(buf.toString('utf8'));
    const store = D.getStore();
    // a project folder from another kind of computer (e.g. a Windows path on a Mac) gets a local default
    if (pr.kind !== 'chat' && (!pr.cwd || !path.isAbsolute(pr.cwd) || (process.platform !== 'win32' && /^[A-Za-z]:\\/.test(pr.cwd)))) {
      const old = store.projects[m[1]];
      pr.cwd = old && old.cwd && path.isAbsolute(old.cwd) ? old.cwd : path.join(os.homedir(), 'Claude Projects', String(pr.name || m[1]).replace(/[<>:"/\\|?*]/g, '_'));
    }
    store.projects[m[1]] = pr;
    D.saveProjects();
    return;
  }
  if ((m = p.match(/^projects\/([\w-]+)\/(memory\.md|files\/.+)$/))) {
    const fp = path.join(D.PROJ_ROOT, m[1], m[2]);
    if (!fp.startsWith(path.join(D.PROJ_ROOT, m[1]) + path.sep)) return;
    await fsp.mkdir(path.dirname(fp), { recursive: true });
    await fsp.writeFile(fp, buf);
    return;
  }
  if ((m = p.match(/^chats\/(a-[0-9a-f]+)\.json$/))) {
    await fsp.mkdir(D.CHATS_DIR, { recursive: true });
    await fsp.writeFile(path.join(D.CHATS_DIR, `${m[1]}.json`), buf);
    return;
  }
  if (p === TOMBSTONES) { await fsp.writeFile(path.join(D.APP_DIR, 'deleted.json'), buf); }
}
async function removeLocal(p, entry) {
  let m;
  const trash = path.join(D.APP_DIR, 'trash', 'synced');
  await fsp.mkdir(trash, { recursive: true });
  const toTrash = async f => { await fsp.rename(f, path.join(trash, `${Date.now()}-${path.basename(f)}`)).catch(() => fsp.unlink(f).catch(() => {})); };
  if ((m = p.match(/^claude\/([\w-]+)\.jsonl$/))) { const f = await D.findSessionFile(m[1]); if (f) await toTrash(f); return; }
  if ((m = p.match(/^meta\/([\w-]+)\.json$/))) { const meta = D.getMeta(); const k = meta.sessions[m[1]] && meta.sessions[m[1]].cwdOverride; if (k) meta.sessions[m[1]] = { cwdOverride: k }; else delete meta.sessions[m[1]]; D.saveMeta(); return; }
  if ((m = p.match(/^projects\/([\w-]+)\/project\.json$/))) { delete D.getStore().projects[m[1]]; D.saveProjects(); return; }
  if ((m = p.match(/^projects\/([\w-]+)\/(memory\.md|files\/.+)$/))) { await toTrash(path.join(D.PROJ_ROOT, m[1], m[2])); return; }
  if ((m = p.match(/^chats\/(a-[0-9a-f]+)\.json$/))) { await toTrash(path.join(D.CHATS_DIR, `${m[1]}.json`)); }
}

/* ---------------- conflicts ---------------- */
const stamp = buf => { try { const o = JSON.parse(buf.toString('utf8')); return o.edited > (o.updated || '') ? o.edited : o.updated || o.created || ''; } catch { return ''; } };
async function keepConflictCopy(p, buf) {
  await fsp.mkdir(conflictsDir(), { recursive: true });
  await fsp.writeFile(path.join(conflictsDir(), `${new Date().toISOString().replace(/[:.]/g, '-')}-${p.replace(/[\\/]/g, '_')}`), buf);
}
/** Both sides changed the same file. Returns 'local' or 'remote' (the winner); the loser is kept in conflicts/. */
async function resolve(p, localBuf, remoteBuf) {
  if (p === TOMBSTONES) return 'merge';
  let win;
  if (p.startsWith('claude/')) {
    // transcripts only grow; the longer one normally contains the other
    const [a, b] = [localBuf.toString('utf8'), remoteBuf.toString('utf8')];
    win = a.length >= b.length ? 'local' : 'remote';
    const longer = win === 'local' ? a : b, shorter = win === 'local' ? b : a;
    if (longer.startsWith(shorter.trimEnd())) return win;
  } else if (p.endsWith('.json')) {
    win = stamp(localBuf) >= stamp(remoteBuf) ? 'local' : 'remote';
  } else win = 'remote';
  const loser = win === 'local' ? remoteBuf : localBuf;
  if (!(await keepAsSeparateChat(p, loser))) await keepConflictCopy(p, loser);
  return win;
}
// A chat continued on two devices at once: the other version becomes its own chat, so nothing is lost
async function keepAsSeparateChat(p, buf) {
  try {
    let m;
    if ((m = p.match(/^claude\/([\w-]+)\.jsonl$/))) {
      const id = crypto.randomUUID();
      const text = buf.toString('utf8').split(m[1]).join(id);
      const first = text.split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).find(o => o && o.cwd);
      const dir = path.join(D.PROJECTS_DIR, first ? encodeCwd(first.cwd).slice(0, 200) : '-synced');
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, `${id}.jsonl`), text);
      const meta = D.getMeta();
      const old = meta.sessions[m[1]] || {};
      meta.sessions[id] = { ...old, title: `${old.title || (first && first.message && typeof first.message.content === 'string' ? first.message.content.slice(0, 60) : 'Chat')} (copy from other device)`, pinned: false };
      D.saveMeta();
      return true;
    }
    if ((m = p.match(/^chats\/(a-[0-9a-f]+)\.json$/))) {
      const c = JSON.parse(buf.toString('utf8'));
      c.id = 'a-' + crypto.randomBytes(8).toString('hex');
      c.title = `${c.title || 'Chat'} (copy from other device)`;
      c.pinned = false;
      await fsp.writeFile(path.join(D.CHATS_DIR, `${c.id}.json`), JSON.stringify(c, null, 1));
      return true;
    }
  } catch {}
  return false;
}

/* ---------------- the sync itself ---------------- */
let inflight = null;
function syncNow() {
  if (!cfg) return Promise.reject(new Error('Sync isn\'t set up'));
  if (inflight) return inflight;
  inflight = doSync().finally(() => { inflight = null; });
  return inflight;
}

async function doSync(retry = true) {
  status.running = true; status.state = 'syncing';
  try {
    const { owner, repo, branch } = cfg;
    const R = `/repos/${owner}/${repo}`;
    // what's on GitHub
    let head = null, remote = new Map();
    try {
      head = (await gh('GET', `${R}/git/ref/heads/${branch}`)).object.sha;
    } catch (e) {
      if (e.status !== 404 && e.status !== 409) throw e;
      // empty repository: create the first commit
      await gh('PUT', `${R}/contents/README.md`, { message: 'Set up Roundtable sync', content: Buffer.from('# Roundtable sync\n\nChats and projects synced between devices by Roundtable. Keep this repository private.\n').toString('base64'), branch });
      head = (await gh('GET', `${R}/git/ref/heads/${branch}`)).object.sha;
    }
    const commit = await gh('GET', `${R}/git/commits/${head}`);
    const tree = await gh('GET', `${R}/git/trees/${commit.tree.sha}?recursive=1`);
    if (tree.truncated) throw new Error('The sync repository has too many files for GitHub to list at once.');
    for (const e of tree.tree) if (e.type === 'blob' && /^(claude|meta|projects|chats)\/|^deleted\.json$/.test(e.path)) remote.set(e.path, e.sha);

    // merge deletions recorded on other devices first, so deleted chats aren't pulled back in
    let tomb = await readTombstones();
    if (remote.has(TOMBSTONES)) {
      const theirs = JSON.parse((await getBlob(R, remote.get(TOMBSTONES))).toString('utf8'));
      const merged = { ...theirs, ...tomb };
      if (Object.keys(merged).length !== Object.keys(tomb).length) { tomb = merged; await writeTombstones(tomb); }
    }
    const tombPaths = new Set();
    const tombPrefixes = [];
    for (const key of Object.keys(tomb)) {
      const [kind, id] = key.split(':');
      if (kind === 'claude') { tombPaths.add(`claude/${id}.jsonl`); tombPaths.add(`meta/${id}.json`); }
      else if (kind === 'chat') tombPaths.add(`chats/${id}.json`);
      else if (kind === 'project') tombPrefixes.push(`projects/${id}/`);
    }
    const isGone = p => tombPaths.has(p) || tombPrefixes.some(x => p.startsWith(x));

    const busy = D.busyIds();
    const local = await localFiles(busy);
    const base = state.base || {};
    const uploads = new Map(), downloads = [], delRemote = [], delLocal = [];
    const paths = new Set([...local.keys(), ...remote.keys(), ...Object.keys(base)]);

    for (const p of paths) {
      const L = local.get(p), Lsha = L ? L.sha : null, Rsha = remote.get(p) || null, B = base[p] || null;
      if (isGone(p)) {                                     // deleted on some device: remove everywhere
        if (Rsha) delRemote.push(p);
        if (L) delLocal.push(p);
        continue;
      }
      const idm = p.match(/^(?:claude|chats)\/([\w-]+)\./);
      if (idm && busy.has(idm[1])) continue;               // a chat that's running right now waits for the next sync
      if (Lsha === Rsha) continue;
      const transcript = p.startsWith('claude/');
      if (Rsha === B) {                                    // only this device changed it
        if (L) uploads.set(p, await L.read());
        else if (transcript) downloads.push(p);            // Claude Code's 30-day cleanup isn't a deletion
        else delRemote.push(p);
      } else if (Lsha === B) {                             // only GitHub changed it
        if (Rsha) downloads.push(p); else if (L) delLocal.push(p);
      } else {                                             // both changed
        if (!L) { downloads.push(p); continue; }
        if (!Rsha) { uploads.set(p, await L.read()); continue; }
        const remoteBuf = await getBlob(R, Rsha);
        const localBuf = await L.read();
        const w = await resolve(p, localBuf, remoteBuf);
        if (w === 'merge') uploads.set(p, localBuf);   // deletion lists were merged above
        else if (w === 'local') uploads.set(p, localBuf);
        else { await writeLocal(p, remoteBuf); }
      }
    }

    // apply incoming changes
    for (const p of downloads) await writeLocal(p, await getBlob(R, remote.get(p)));
    for (const p of delLocal) await removeLocal(p, local.get(p));

    // send this device's changes as one commit
    let newHead = head;
    if (uploads.size || delRemote.length) {
      const entries = [];
      for (const [p, buf] of uploads) {
        const b = await gh('POST', `${R}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
        entries.push({ path: p, mode: '100644', type: 'blob', sha: b.sha });
      }
      for (const p of delRemote) entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
      const t = await gh('POST', `${R}/git/trees`, { base_tree: commit.tree.sha, tree: entries });
      const c = await gh('POST', `${R}/git/commits`, { message: `Sync from ${cfg.deviceName}: ${uploads.size} updated, ${delRemote.length} removed`, tree: t.sha, parents: [head] });
      try { await gh('PATCH', `${R}/git/refs/heads/${branch}`, { sha: c.sha, force: false }); }
      catch (e) {
        if (retry && (e.status === 422 || e.status === 409)) { status.running = false; return doSync(false); } // another device synced in between
        throw e;
      }
      newHead = c.sha;
    }

    // new common ancestor = what GitHub has now
    const nb = {};
    for (const [p, sha] of remote) nb[p] = sha;
    for (const [p, buf] of uploads) nb[p] = blobSha(buf);
    for (const p of delRemote) delete nb[p];
    state.base = nb; state.head = newHead;
    await saveState();
    const changes = uploads.size + delRemote.length + downloads.length + delLocal.length;
    if (downloads.length || delLocal.length) D.onIncoming();
    status = { ...status, running: false, state: 'idle', error: null, lastSync: new Date().toISOString(), lastChanges: changes, lastUp: uploads.size + delRemote.length, lastDown: downloads.length + delLocal.length };
    return publicStatus();
  } catch (e) {
    status = { ...status, running: false, state: 'error', error: e.message };
    throw e;
  }
}
async function getBlob(R, sha) {
  const b = await gh('GET', `${R}/git/blobs/${sha}`);
  return Buffer.from(b.content, b.encoding === 'base64' ? 'base64' : 'utf8');
}

module.exports = { init, connect, disconnect, syncNow, soon, publicStatus, recordDeletion, isConnected: () => !!cfg };
