#!/usr/bin/env node
'use strict';
/*
 * Roundtable — a claude.ai-style home for Claude Code and other AI models.
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
const APP_DIR = path.join(os.homedir(), '.roundtable');
// this app used to be called Claude Code UI; bring its data along
try { const old = path.join(os.homedir(), '.claude-code-ui'); if (fs.existsSync(old) && !fs.existsSync(APP_DIR)) fs.renameSync(old, APP_DIR); } catch {}
const META_FILE = path.join(APP_DIR, 'meta.json');
const TRASH_DIR = path.join(APP_DIR, 'trash');
const PROJ_FILE = path.join(APP_DIR, 'projects.json');
const PROJ_ROOT = path.join(APP_DIR, 'projects');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ai = require('./ai');
const UPLOADS_DIR = path.join(APP_DIR, 'uploads');
const IMG_RE = /\.(png|jpe?g|gif|webp)$/i;
const TEXTLIKE_RE = /\.(txt|md|markdown|csv|tsv|json|ya?ml|toml|ini|xml|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sh|ps1|bat|sql|log|conf|cfg|env)$/i;
/** An uploaded file's absolute path from its id ("<folder>/<name>"), or null. */
function uploadPath(id) {
  const fp = path.resolve(UPLOADS_DIR, String(id || ''));
  return fp.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(fp) ? fp : null;
}
const uploadUrl = fp => fp && fp.startsWith(UPLOADS_DIR + path.sep) ? '/api/uploads/' + path.relative(UPLOADS_DIR, fp).split(path.sep).map(encodeURIComponent).join('/') : null;
// What Claude Code is told about attached files (it opens them itself with the Read tool)
const attachBlock = (paths, texts = []) => paths.length ? `\n\n<attachments>\nThe user attached ${paths.length === 1 ? 'this file' : 'these files'}. Open ${paths.length === 1 ? 'it' : 'them'} with the Read tool:\n${paths.map((p, i) => '- ' + p + (texts[i] ? `\n  (The Read tool can't open this kind of file. Read its text instead: ${texts[i]})` : '')).join('\n')}\n</attachments>` : '';
// Word, PowerPoint and Excel files: their text is saved next to them ("name.docx.txt") the first time it's needed
const OFFICE_RE = /\.(docx|pptx|xlsx)$/i;
async function officeTextFile(fp) {
  if (!OFFICE_RE.test(fp)) return null;
  const out = fp + '.txt';
  if (fs.existsSync(out)) return out;
  try {
    if ((await fsp.stat(fp)).size > 300e6) return null;
    const text = importer.officeText(await fsp.readFile(fp), path.extname(fp));
    if (!text.trim()) return null;
    await fsp.writeFile(out, `(The text of "${path.basename(fp)}", taken out of the file by Roundtable. Pictures and formatting aren't included.)\n\n${text}\n`);
    return out;
  } catch { return null; }
}
// what Claude gets to open: the text version in place of a file its reader can't handle
const readablePaths = paths => Promise.all(paths.map(async p => (await officeTextFile(p)) || p));
function parseAttachments(s) {
  const m = typeof s === 'string' && s.match(/<attachments>([\s\S]*?)<\/attachments>/);
  if (!m) return [];
  return m[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim()).map(p => ({ name: p.split(/[\\/]/).pop(), url: fs.existsSync(p) ? uploadUrl(p) : null, image: IMG_RE.test(p) }));
}
// Plan usage (5-hour and weekly limits), as Claude Code reports it during each reply
const USAGE_FILE = path.join(APP_DIR, 'usage.json');
let usage = {};
try { usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8')); } catch {}
function noteRateLimit(o) {
  const i = o && o.rate_limit_info;
  if (!i || !i.rateLimitType) return;
  const prev = usage[i.rateLimitType] || {};
  usage[i.rateLimitType] = {
    status: i.status || prev.status || 'allowed',
    utilization: typeof i.utilization === 'number' ? i.utilization : (prev.resetsAt === i.resetsAt ? prev.utilization : undefined),
    resetsAt: i.resetsAt || prev.resetsAt || null,
    usingOverage: !!i.isUsingOverage,
    updated: Date.now(),
  };
  fsp.writeFile(USAGE_FILE, JSON.stringify(usage)).catch(() => {});
}
ai.init({ APP_DIR, spawnClaude: (...a) => spawnClaude(...a), onRateLimit: noteRateLimit });
let sync = null; // GitHub sync, set up below
const commands = require('./commands');
const importer = require('./import');
commands.init({ claudeHome: CLAUDE_HOME });
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
  return s
    .replace(/<project-context>[\s\S]*?<\/project-context>\s*/g, '')
    .replace(/\s*<attachments>[\s\S]*?<\/attachments>\s*/g, '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<\/?pasted_content[^>]*>/g, '')
    .trim();
}

function userParts(message) {
  const c = message && message.content;
  const out = { text: '', images: 0, toolResults: [], attachments: [] };
  if (typeof c === 'string') { out.text = cleanUserText(c); out.attachments = parseAttachments(c); return out; }
  if (!Array.isArray(c)) return out;
  const texts = [];
  for (const b of c) {
    if (!b) continue;
    if (b.type === 'text') { texts.push(cleanUserText(b.text)); out.attachments.push(...parseAttachments(b.text)); }
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
      const label = p.text || (p.attachments.length ? p.attachments.map(a => a.name).join(', ') : '');
      if (label && !label.startsWith('[Request interrupted')) { userCount++; if (!firstPrompt) firstPrompt = label; }
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
  const local = { ...info, cwd: m.cwdOverride || localPath(info.cwd) };
  return { ...local, title: m.title || info.autoTitle, pinned: !!m.pinned, projectId: projectIdFor(local) };
}
const isInside = (p, dir) => !!p && (p === dir || p.startsWith(dir + path.sep));

// Synced chats and projects carry folder paths from the computer they started on. When that
// path is inside another user folder (C:\Users\name, /Users/name, /home/name) and doesn't
// exist here, use the same place inside this computer's user folder.
function translateHome(p) {
  const m = String(p || '').match(/^([A-Za-z]:\\Users\\[^\\]+|\/Users\/[^/]+|\/home\/[^/]+)([\\/].*)?$/);
  if (!m) return null;
  const rest = (m[2] || '').split(/[\\/]+/).filter(Boolean);
  const cand = path.join(os.homedir(), ...rest);
  return cand !== p ? cand : null;
}
/** The folder to use on this computer for a path that may come from another device. */
function localPath(p) {
  if (!p || fs.existsSync(p)) return p;
  const t = translateHome(p);
  return t && fs.existsSync(t) ? t : p;
}

async function listSessions() {
  const files = await listSessionFiles();
  const infos = [];
  // modest concurrency so huge histories don't spike memory
  for (let i = 0; i < files.length; i += 16) {
    const batch = await Promise.all(files.slice(i, i + 16).map(scanFile));
    for (const b of batch) if (b && !isInside(b.cwd, APP_DIR)) infos.push(decorate(b));
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
      if (p.text || p.images || p.attachments.length) turns.push({ role: 'user', text: p.text, images: p.images, attachments: p.attachments, ts: o.timestamp });
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

/* ---------------- launching the CLI ---------------- */
// On Windows `claude` is usually a .cmd shim, which Node can only start through cmd.exe.
// cmd.exe doesn't quote arguments for us, so paths with spaces need quoting by hand.
const winQuote = a => (a === '' || /[\s&|<>^()"%!]/.test(a) ? `"${String(a).replace(/"/g, '""')}"` : a);
// Quotes can't stop cmd.exe expanding %VARS% or ending the command at a line break, so those never get that far.
function spawnClaude(args, opts) {
  if (IS_WIN && args.some(a => /[%\r\n]/.test(String(a)))) throw new Error('Can\'t start Claude Code with % or a line break in its settings.');
  if (IS_WIN) return spawn(winQuote(CLAUDE_BIN), args.map(winQuote), { ...opts, shell: true, windowsHide: true });
  return spawn(CLAUDE_BIN, args, opts);
}

/* ---------------- projects ---------------- */
// A project = name, description, instructions, a working folder, reference files and a
// shared memory. Every chat in a project gets all of that, plus searchable copies of the
// project's earlier chats. Folders used with Claude Code that have no project yet show up
// as "folder projects" (id dir-…) and turn into real ones the first time they're edited.
let store = { projects: {} };
try { store = JSON.parse(fs.readFileSync(PROJ_FILE, 'utf8')); store.projects = store.projects || {}; } catch {}
function saveProjects() {
  try { fs.mkdirSync(APP_DIR, { recursive: true }); fs.writeFileSync(PROJ_FILE, JSON.stringify(store, null, 2)); }
  catch (e) { console.error('Could not save projects:', e.message); }
}
const dirProjectId = cwd => 'dir-' + crypto.createHash('sha1').update(String(cwd)).digest('hex').slice(0, 12);
const projDir = id => path.join(PROJ_ROOT, id);
const filesDir = id => path.join(projDir(id), 'files');
const chatsDir = id => path.join(projDir(id), 'chats');
const memoryFile = id => path.join(projDir(id), 'memory.md');

function projectIdFor(info) {
  const m = meta.sessions[info.id] || {};
  if (m.projectId && m.projectId !== 'none' && store.projects[m.projectId]) return m.projectId;
  if (m.projectId !== 'none') {
    const owner = Object.values(store.projects)
      .filter(p => p.kind !== 'chat' && p.cwd && info.cwd && path.resolve(p.cwd) === path.resolve(info.cwd))
      .sort((a, b) => (a.created || '').localeCompare(b.created || ''))[0];
    if (owner) return owner.id;
  }
  return dirProjectId(info.cwd);
}

function listProjects(sessions) {
  const out = new Map();
  for (const p of Object.values(store.projects)) out.set(p.id, { ...publicProject(p), chatCount: 0, lastActivity: p.updated });
  for (const s of sessions) {
    if (!s.cwd && !(s.projectId && out.has(s.projectId))) continue;
    let p = out.get(s.projectId);
    if (!p) {
      p = { id: s.projectId, name: path.basename(s.cwd) || s.cwd, description: '', cwd: s.cwd, virtual: true, chatCount: 0, lastActivity: s.updated };
      out.set(p.id, p);
    }
    p.chatCount++;
    if (!p.lastActivity || s.updated > p.lastActivity) p.lastActivity = s.updated;
  }
  return [...out.values()].sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
}
const publicProject = p => ({
  id: p.id, kind: p.kind === 'chat' ? 'chat' : 'code', importedFrom: p.importedFrom || null, name: p.name, description: p.description || '', instructions: p.instructions || '', cwd: p.kind === 'chat' ? null : localPath(p.cwd),
  memoryEnabled: p.memoryEnabled !== false, memoryUpdated: p.memoryUpdated || null, created: p.created, updated: p.updated, virtual: false,
});

async function getProject(id, { create = false } = {}) {
  if (store.projects[id]) return store.projects[id];
  if (!id.startsWith('dir-')) return null;
  const s = (await listSessions()).find(x => x.projectId === id);
  if (!s) return null;
  if (!create) return { id, name: path.basename(s.cwd) || s.cwd, description: '', instructions: '', cwd: s.cwd, memoryEnabled: true, virtual: true };
  const now = new Date().toISOString();
  store.projects[id] = { id, name: path.basename(s.cwd) || s.cwd, description: '', instructions: '', cwd: s.cwd, memoryEnabled: true, created: now, updated: now };
  saveProjects();
  return store.projects[id];
}

const safeName = n => String(n || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').trim().slice(0, 120) || 'file';
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|ya?ml|toml|ini|xml|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sh|ps1|bat|sql|log|env\.example|rst|tex)$/i;

async function listFiles(id) {
  let names = [];
  try { names = await fsp.readdir(filesDir(id)); } catch { return []; }
  const out = [];
  for (const name of names) {
    try {
      const st = await fsp.stat(path.join(filesDir(id), name));
      if (st.isFile()) out.push({ name, size: st.size, added: st.mtime.toISOString(), text: TEXT_EXT.test(name) });
    } catch {}
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
const readMemory = async id => { try { return await fsp.readFile(memoryFile(id), 'utf8'); } catch { return ''; } };

function turnsToMarkdown(info, turns) {
  const lines = [`# ${info.title}`, `Date: ${(info.updated || '').slice(0, 10)}  ·  Chat id: ${info.id}`, ''];
  for (const t of turns) {
    if (t.role === 'user') lines.push(`## User`, t.text, '');
    else if (t.role === 'assistant') {
      lines.push('## Claude');
      for (const b of t.blocks) {
        if (b.type === 'text') lines.push(b.text);
        else if (b.type === 'tool') {
          const inp = b.input || {};
          const what = inp.command || inp.file_path || inp.pattern || inp.url || inp.query || inp.description || '';
          lines.push(`_(used ${b.name}${what ? ': ' + String(what).slice(0, 160) : ''})_`);
        }
      }
      lines.push('');
    }
  }
  return clip(lines.join('\n'), 200000);
}

// Keep plain-text copies of the project's chats in sync, so any chat can grep earlier ones
async function syncChatExports(project, sessions, excludeId) {
  const dir = chatsDir(project.id);
  await fsp.mkdir(dir, { recursive: true });
  const mine = sessions.filter(s => s.projectId === project.id && s.id !== excludeId);
  const keep = new Set();
  for (const s of mine) {
    const out = path.join(dir, s.id + '.md');
    keep.add(s.id + '.md');
    try {
      const file = await findSessionFile(s.id);
      if (!file) continue;
      const [src, dst] = await Promise.all([fsp.stat(file), fsp.stat(out).catch(() => null)]);
      if (dst && dst.mtimeMs >= src.mtimeMs) continue;
      await fsp.writeFile(out, turnsToMarkdown(s, await loadTurns(file)));
    } catch {}
  }
  for (const f of await fsp.readdir(dir).catch(() => [])) if (!keep.has(f)) await fsp.unlink(path.join(dir, f)).catch(() => {});
  return mine;
}

async function buildContext(project, sessionId) {
  const sessions = await listSessions();
  const [files, memory, earlier] = await Promise.all([listFiles(project.id), readMemory(project.id), syncChatExports(project, sessions, sessionId)]);
  const parts = [
    `<project-context>`,
    `This chat is part of the project "${project.name}". Everything in this block is shared by every chat in the project. Use it naturally; don't mention this block unless asked.`,
  ];
  if (project.description) parts.push('', `Project description: ${project.description}`);
  if (project.instructions && project.instructions.trim()) parts.push('', '## Project instructions (follow these)', project.instructions.trim());
  if (memory.trim()) parts.push('', '## Project memory', 'Notes carried over from earlier chats in this project. Treat them as background; the user may have changed their mind since.', memory.trim());
  if (files.length) {
    parts.push('', '## Project files', `Reference material the user added to this project, stored in ${filesDir(project.id)}. Small text files are included below; open the others with the Read tool when they're relevant.`);
    let budget = 80000;
    const inline = [];
    for (const f of files) {
      parts.push(`- ${path.join(filesDir(project.id), f.name)} (${f.size.toLocaleString()} bytes)`);
      if (f.text && f.size <= 40000 && f.size <= budget) {
        try {
          const content = await fsp.readFile(path.join(filesDir(project.id), f.name), 'utf8');
          if (!content.includes('\u0000')) { inline.push(`<file name="${f.name}">\n${content}\n</file>`); budget -= f.size; }
        } catch {}
      }
    }
    if (inline.length) parts.push('', ...inline);
  }
  if (earlier.length) {
    parts.push('', '## Earlier chats in this project',
      `Plain-text copies of ${earlier.length} earlier chat${earlier.length > 1 ? 's' : ''} are in ${chatsDir(project.id)} (one .md file per chat). When the user refers to earlier work, or details beyond the memory would help, search them (for example with grep in Bash) or open them with Read.`);
    for (const s of earlier.slice(0, 40)) parts.push(`- ${(s.updated || '').slice(0, 10)} "${s.title.slice(0, 100)}" → ${s.id}.md`);
    if (earlier.length > 40) parts.push(`- …and ${earlier.length - 40} more in that folder`);
  }
  parts.push(`</project-context>`);
  return parts.join('\n');
}

// After a project chat replies, have Claude fold anything worth keeping into the shared memory.
const memoryQueue = new Map();
function queueMemoryUpdate(projectId, exchange) {
  const prev = memoryQueue.get(projectId) || Promise.resolve();
  const next = prev.then(() => updateMemory(projectId, exchange)).catch(e => console.error('Memory update failed:', e.message));
  memoryQueue.set(projectId, next);
}
// Short chat titles written by Claude after the first reply, like the Claude apps do
async function autoTitle(run) {
  if (!ai.autoTitlesOn() || !run.sessionId || !run.replyText) return;
  const input = `Write a short title (2 to 6 words) for a chat that begins like this. Reply with only the title: no quotes, no ending punctuation.\n\n<user>\n${run.fullPrompt.slice(0, 3000)}\n</user>\n<assistant>\n${run.replyText.slice(0, 2000)}\n</assistant>`;
  const dir = path.join(APP_DIR, 'titles');
  await fsp.mkdir(dir, { recursive: true });
  const res = await runClaudeOnce(['-p', '--output-format', 'json', '--no-session-persistence', '--tools', '', '--model', 'haiku'], input, dir);
  let title = res && !res.is_error && typeof res.result === 'string' ? res.result.trim().split('\n')[0].replace(/[*_`]/g, '').replace(/^(title:\s*)/i, '').replace(/^["'#\s]+|["'.\s]+$/g, '').slice(0, 80) : '';
  if (!title || /^NO_CHANGE$/i.test(title)) return;
  if (isAppChatId(run.sessionId)) {
    const chat = await loadChat(run.sessionId);
    if (!chat || chat.titleSetByUser) return;
    chat.title = title; chat.titleAuto = true; chat.edited = new Date().toISOString();
    await saveChat(chat);
  } else {
    const cur = meta.sessions[run.sessionId] || {};
    if (cur.title) return; // the user (or an earlier title) already named it
    meta.sessions[run.sessionId] = { ...cur, title, titleAuto: true };
    saveMeta();
  }
}

function runClaudeOnce(args, input, cwd) {
  return new Promise(resolve => {
    let out = '';
    let proc;
    try { proc = spawnClaude(args, { cwd, env: process.env }); } catch { return resolve(null); }
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', () => {});
    proc.on('error', () => resolve(null));
    proc.on('close', () => { try { resolve(JSON.parse(out.trim().split('\n').pop())); } catch { resolve(null); } });
    proc.stdin.on('error', () => {});
    proc.stdin.end(input);
  });
}
async function updateMemory(projectId, exchange) {
  const project = store.projects[projectId];
  if (!project || project.memoryEnabled === false) return;
  const current = await readMemory(projectId);
  const input = [
    `You maintain the shared memory for a project called "${project.name}". Every new chat in the project starts by reading this memory.`,
    `Update it using the latest exchange below. Rules:`,
    `- Keep only durable, useful facts: decisions made, the user's preferences, key facts about the project, open tasks or next steps.`,
    `- Write short bullet points under a few short headings. Keep the whole memory under about 400 words.`,
    `- Remove or correct anything the new exchange makes outdated. Never store passwords, keys or other secrets.`,
    `- Reply with ONLY the complete updated memory in Markdown, no preamble.`,
    `- If nothing in the exchange is worth remembering, reply with exactly: NO_CHANGE`,
    '', '<current_memory>', current.trim() || '(empty)', '</current_memory>', '', '<latest_exchange>', exchange, '</latest_exchange>',
  ].join('\n');
  const dir = projDir(projectId);
  await fsp.mkdir(dir, { recursive: true });
  let res = await runClaudeOnce(['-p', '--output-format', 'json', '--no-session-persistence', '--model', 'haiku'], input, dir);
  if (!res || res.is_error) res = await runClaudeOnce(['-p', '--output-format', 'json', '--no-session-persistence'], input, dir);
  // these helper runs write transcripts too; they're not chats, so remove them
  if (res && res.session_id) { const f = await findSessionFile(res.session_id); if (f) await fsp.unlink(f).catch(() => {}); }
  const text = res && !res.is_error && typeof res.result === 'string' ? res.result.trim() : '';
  if (!text || text === 'NO_CHANGE' || text.length > 20000) return;
  await fsp.writeFile(memoryFile(projectId), text.replace(/^```(?:markdown|md)?\n([\s\S]*)\n```$/, '$1') + '\n');
  project.memoryUpdated = new Date().toISOString();
  saveProjects();
}

/* ---------------- running chats ---------------- */
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
  if (run.isNew && !run.stopped) {
    if (!run.replyText) {
      run.replyText = run.events.filter(e => e.kind === 'claude' && e.data.type === 'assistant' && !e.data.parent_tool_use_id)
        .flatMap(e => ((e.data.message && e.data.message.content) || []).filter(b => b.type === 'text').map(b => b.text)).join('\n\n');
    }
    autoTitle(run).catch(e => console.error('Title failed:', e.message)).finally(() => { if (sync) sync.soon(); });
  }
  if (sync) sync.soon();
  // feed the project's shared memory
  if (run.projectId && store.projects[run.projectId] && !run.stopped && run.replyText) {
    queueMemoryUpdate(run.projectId, `User: ${run.fullPrompt.slice(0, 6000)}\n\nAssistant: ${run.replyText.slice(-8000)}`);
  } else if (run.projectId && store.projects[run.projectId] && !run.stopped) {
    const reply = run.events
      .filter(e => e.kind === 'claude' && e.data.type === 'assistant' && !e.data.parent_tool_use_id)
      .flatMap(e => ((e.data.message && e.data.message.content) || []).filter(b => b.type === 'text').map(b => b.text))
      .join('\n\n');
    if (reply.trim()) queueMemoryUpdate(run.projectId, `User: ${run.fullPrompt.slice(0, 6000)}\n\nClaude: ${reply.slice(-8000)}`);
  }
}

function activeRunFor(sessionId) {
  for (const r of runs.values()) if (!r.done && r.sessionId === sessionId) return r;
  return null;
}

async function startRun({ sessionId, prompt, cwd, model, permissionMode, allowedTools, project, attachments = [] }) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  if (sessionId) args.push('--resume', sessionId);
  if (model) args.push('--model', model);
  if (permissionMode === 'bypassPermissions') args.push('--dangerously-skip-permissions');
  else if (permissionMode && permissionMode !== 'default') args.push('--permission-mode', permissionMode);
  if (allowedTools && allowedTools.length) args.push('--allowedTools', allowedTools.join(','));

  const run = {
    id: crypto.randomUUID(), sessionId: sessionId || null, cwd, prompt: prompt.slice(0, 200), fullPrompt: prompt, isNew: !sessionId,
    projectId: project && !project.virtual ? project.id : null,
    events: [], listeners: new Set(), done: false, startSize: 0, startedAt: Date.now(),
  };
  let input = prompt;
  let file = null;
  if (sessionId) {
    file = await findSessionFile(sessionId);
    if (file) { try { run.startSize = fs.statSync(file).size; } catch {} }
  }
  if (project) {
    // project context goes in once per chat, at the start (or the first time an older chat is used in the project)
    let needs = !file;
    if (file) { try { needs = !(await fsp.readFile(file, 'utf8')).includes('<project-context>'); } catch {} }
    await fsp.mkdir(filesDir(project.id), { recursive: true }).catch(() => {});
    if (needs) input = (await buildContext(project, sessionId)) + '\n\n' + prompt;
    args.push('--add-dir', projDir(project.id));
  }
  if (attachments.length) { input += attachBlock(attachments, await Promise.all(attachments.map(officeTextFile))); args.push('--add-dir', UPLOADS_DIR); }
  runs.set(run.id, run);
  pushEvent(run, { kind: 'start', runId: run.id, sessionId: run.sessionId });
  pushEvent(run, { kind: 'user', text: prompt, attachments: attachments.map(p => ({ name: path.basename(p), url: uploadUrl(p), image: IMG_RE.test(p) })) });

  let proc;
  try {
    proc = spawnClaude(args, { cwd, env: process.env });
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
      if (o.type === 'system' && o.subtype === 'init') commands.noteInit(run.cwd, o);
      if (o.type === 'rate_limit_event') noteRateLimit(o);
      if (o.type === 'system' && o.subtype === 'init' && o.session_id) {
        if (!run.sessionId && run.projectId) { meta.sessions[o.session_id] = { ...(meta.sessions[o.session_id] || {}), projectId: run.projectId }; saveMeta(); }
        run.sessionId = o.session_id;
      }
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
  proc.on('close', code => {
    // cmd.exe reports a missing command as exit code 1 + a message instead of ENOENT
    if (IS_WIN && code !== 0 && !run.events.some(e => e.kind === 'claude')) {
      const err = run.events.filter(e => e.kind === 'stderr').map(e => e.text).join('');
      if (/not recognized as an internal or external command/i.test(err)) pushEvent(run, { kind: 'error', text: 'Couldn\'t find the `claude` command. Install Claude Code (`npm install -g @anthropic-ai/claude-code`), then restart this app.' });
    }
    finishRun(run, code);
  });
  proc.stdin.on('error', () => {});
  proc.stdin.end(input);
  return run;
}

function stopRun(run) {
  if (!run || run.done) return;
  if (run.abort) { run.stopped = true; run.abort.abort(); return; }
  if (!run.proc) return;
  run.stopped = true;
  try {
    if (IS_WIN) execFile('taskkill', ['/pid', String(run.proc.pid), '/T', '/F'], () => {});
    else run.proc.kill('SIGINT');
  } catch {}
  setTimeout(() => { if (!run.done) try { run.proc.kill('SIGKILL'); } catch {} }, 3000);
}

/* ---------------- model & debate chats ---------------- */
// Chats with other AIs are stored by this app (Claude Code chats are Claude Code's own files).
const CHATS_DIR = path.join(APP_DIR, 'chats');
const isAppChatId = id => /^a-[0-9a-f]{8,40}$/.test(id);
const chatFile = id => path.join(CHATS_DIR, id + '.json');
async function loadChat(id) { try { return JSON.parse(await fsp.readFile(chatFile(id), 'utf8')); } catch { return null; } }
async function saveChat(chat) {
  await fsp.mkdir(CHATS_DIR, { recursive: true });
  const tmp = chatFile(chat.id) + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(chat, null, 1));
  await fsp.rename(tmp, chatFile(chat.id));
}
async function listAppChats() {
  let names = [];
  try { names = await fsp.readdir(CHATS_DIR); } catch { return []; }
  const out = [];
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    const c = await loadChat(n.slice(0, -5));
    if (!c || !c.messages || !c.messages.length) continue;
    out.push({
      id: c.id, kind: c.kind, provider: c.provider || null, title: c.title || 'Untitled', pinned: !!c.pinned,
      projectId: c.projectId && store.projects[c.projectId] ? c.projectId : null,
      cwd: null, created: c.created, updated: c.updated, userCount: c.messages.filter(m => m.role === 'user').length,
      speaker: c.kind === 'model' ? ai.providerName(c.provider) : 'Debate', imported: !!c.importedFrom,
    });
  }
  return out;
}
function chatTurns(c) {
  const turns = [];
  for (const m of c.messages) {
    if (m.role === 'user') turns.push({ role: 'user', text: m.text, ts: m.ts, attachments: (m.attachments || []).map(a => ({ name: a.name, image: a.image, url: uploadUrl(uploadPath(a.id)) })) });
    else if (m.debate) turns.push({ role: 'assistant', ts: m.ts, blocks: [{ type: 'debate', ...m.debate }, ...(m.text ? [{ type: 'text', text: m.text }] : [])], result: m.ms ? { ms: m.ms } : undefined });
    else turns.push({ role: 'assistant', ts: m.ts, speaker: m.speaker, blocks: m.text ? [{ type: 'text', text: m.text }] : [], errorText: m.error, result: m.ms ? { ms: m.ms } : undefined });
  }
  return turns;
}
// The parts of a project that make sense without tools: instructions, memory, small text files
async function plainProjectContext(project) {
  if (!project) return '';
  const parts = [`You're helping with the project "${project.name}".${project.description ? ' ' + project.description : ''}`];
  if (project.instructions && project.instructions.trim()) parts.push('## Project instructions (follow these)\n' + project.instructions.trim());
  const memory = await readMemory(project.id);
  if (memory.trim()) parts.push('## Project memory (notes from earlier chats)\n' + memory.trim());
  let budget = 40000;
  for (const f of await listFiles(project.id)) {
    if (!f.text || f.size > budget) continue;
    try { parts.push(`<file name="${f.name}">\n${await fsp.readFile(path.join(filesDir(project.id), f.name), 'utf8')}\n</file>`); budget -= f.size; } catch {}
  }
  return parts.join('\n\n');
}

// Chat-API message content: text, plus images as data URLs and small text files inline
async function apiContent(text, atts) {
  if (!atts || !atts.length) return text;
  const parts = [];
  let extra = '', tf;
  for (const a of atts) {
    const fp = uploadPath(a.id);
    if (!fp) { extra += `\n\n(Attached file "${a.name}" isn't available on this computer.)`; continue; }
    const st = await fsp.stat(fp);
    if (IMG_RE.test(fp) && st.size <= 15e6) {
      const ext = path.extname(fp).slice(1).toLowerCase().replace('jpg', 'jpeg');
      parts.push({ type: 'image_url', image_url: { url: `data:image/${ext};base64,${(await fsp.readFile(fp)).toString('base64')}` } });
    } else if (TEXTLIKE_RE.test(fp) && st.size <= 200000) {
      extra += `\n\n<file name="${a.name}">\n${await fsp.readFile(fp, 'utf8')}\n</file>`;
    } else if (OFFICE_RE.test(fp) && (tf = await officeTextFile(fp))) {
      let t = await fsp.readFile(tf, 'utf8');
      if (t.length > 200000) t = t.slice(0, 200000) + '\n\n(Cut off here: the rest is too long to send.)';
      extra += `\n\n<file name="${a.name}">\n${t}\n</file>`;
    } else extra += `\n\n(The user attached "${a.name}", which can't be shown to this model.)`;
  }
  const body = (text || (parts.length ? 'Please look at the attached image.' : '')) + extra;
  return parts.length ? [{ type: 'text', text: body }, ...parts] : body;
}

async function startAppRun({ chat, prompt, attachments = [] }) {
  const run = {
    id: crypto.randomUUID(), sessionId: chat.id, cwd: null, prompt: prompt.slice(0, 200), fullPrompt: prompt, isNew: !chat.messages.length,
    projectId: chat.projectId && store.projects[chat.projectId] ? chat.projectId : null,
    events: [], listeners: new Set(), done: false, startedAt: Date.now(), abort: new AbortController(), app: true,
  };
  runs.set(run.id, run);
  pushEvent(run, { kind: 'start', runId: run.id, sessionId: chat.id, appChat: { kind: chat.kind, provider: chat.provider } });
  const atts = attachments.map(fp => ({ id: path.relative(UPLOADS_DIR, fp).split(path.sep).join('/'), name: path.basename(fp), image: IMG_RE.test(fp) }));
  pushEvent(run, { kind: 'user', text: prompt, attachments: atts.map(a => ({ name: a.name, image: a.image, url: uploadUrl(uploadPath(a.id)) })) });
  // only the latest snapshot is kept, so re-attaching doesn't replay hundreds of them
  const snap = turn => {
    const ev = { kind: 'snapshot', turn, t: Date.now() };
    const i = run.events.findIndex(e => e.kind === 'snapshot');
    if (i >= 0) run.events[i] = ev; else run.events.push(ev);
    for (const l of run.listeners) l(ev);
  };
  const history = [];
  for (const m of chat.messages) {
    if (m.role === 'user') history.push({ role: 'user', content: await apiContent(m.text, m.attachments) });
    else if (m.text) history.push({ role: 'assistant', content: m.text });
  }
  const started = Date.now();
  chat.messages.push({ role: 'user', text: prompt, ts: new Date().toISOString(), ...(atts.length ? { attachments: atts } : {}) });
  if (!chat.title || chat.messages.filter(m => m.role === 'user').length === 1) chat.title = (prompt || atts.map(a => a.name).join(', ')).replace(/\s+/g, ' ').trim().slice(0, 100);
  chat.updated = new Date().toISOString();
  await saveChat(chat);

  (async () => {
    const project = run.projectId ? store.projects[run.projectId] : null;
    const context = await plainProjectContext(project);
    const reply = { role: 'assistant', ts: null };
    try {
      if (chat.kind === 'debate') {
        const st = await ai.runDebate({
          question: await apiContent(prompt, atts), attachments: await readablePaths(attachments), history, context, signal: run.abort.signal,
          emit: s => snap({ role: 'assistant', blocks: [{ type: 'debate', ...s, consensus: undefined }, ...(s.consensus ? [{ type: 'text', text: s.consensus, draft: s.phase !== 'done' }] : [])] }),
        });
        reply.debate = { participants: st.participants, rounds: st.rounds, moderator: st.moderator, phase: 'done' };
        reply.text = st.consensus;
      } else {
        const speaker = ai.providerName(chat.provider);
        let last = 0;
        const msgs = [...(context ? [{ role: 'system', content: context }] : []), ...history, { role: 'user', content: await apiContent(prompt, atts) }];
        reply.speaker = speaker;
        const extra = {};
        if (chat.provider === 'claude') {
          // plain Claude chats keep a Claude Code session of their own (only on the computer that made it)
          const resume = chat.cliSession && await findSessionFile(chat.cliSession) ? chat.cliSession : null;
          extra.chat = { resume, onSession: id => { chat.cliSession = id; } };
          extra.attachments = await readablePaths(attachments);
        }
        reply.text = await ai.complete(chat.provider, msgs, {
          ...extra,
          signal: run.abort.signal,
          onText: (_, full) => { const now = Date.now(); if (now - last > 80) { last = now; snap({ role: 'assistant', speaker, blocks: [{ type: 'text', text: full, draft: true }] }); } },
        });
      }
      run.replyText = reply.text;
    } catch (e) {
      if (e.name !== 'AbortError') { reply.error = e.message; reply.speaker = reply.speaker || (chat.kind === 'debate' ? 'Debate' : ai.providerName(chat.provider)); }
    }
    reply.ts = new Date().toISOString();
    reply.ms = Date.now() - started;
    if (reply.text || reply.error || reply.debate) chat.messages.push(reply);
    chat.updated = reply.ts;
    await saveChat(chat).catch(() => {});
    const t = chatTurns({ messages: [reply] })[0];
    if (t && (reply.text || reply.error || reply.debate)) snap(t);
    finishRun(run, reply.error ? 1 : 0);
  })();
  return run;
}

/* ---------------- http ---------------- */
const MIME = { '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

const MAX_FILE = 2 * 1024 ** 3; // 2 GB per attached or project file
/** Stream a raw request body straight to a file (big files never sit in memory). Returns its size. */
function saveBody(req, fp, limit = MAX_FILE) {
  return new Promise((resolve, reject) => {
    let size = 0, failed = false;
    const out = fs.createWriteStream(fp);
    const fail = err => { if (failed) return; failed = true; out.destroy(); fs.unlink(fp, () => {}); reject(err); };
    req.on('data', c => { size += c.length; if (size > limit) { fail(new Error('Files can be up to 2 GB')); req.destroy(); } });
    req.on('error', fail); out.on('error', fail);
    out.on('finish', () => { if (!failed) resolve(size); });
    req.pipe(out);
  });
}
const isRaw = req => /octet-stream/.test(req.headers['content-type'] || '');

function readBody(req, limit = 4e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
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
    execFile(IS_WIN ? winQuote(CLAUDE_BIN) : CLAUDE_BIN, ['--version'], { shell: IS_WIN, timeout: 10000, windowsHide: true }, (err, out) => {
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

  if (p === '/api/sessions' && m === 'GET') {
    const sessions = (await listSessions()).map(s => ({ ...s, kind: 'claude' }));
    const all = [...sessions, ...await listAppChats()].sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    return send(res, 200, { sessions: all, projects: listProjects(all) });
  }

  if (p === '/api/sync' && m === 'GET') return send(res, 200, sync.publicStatus());
  if (p === '/api/sync/connect' && m === 'POST') {
    const body = await readBody(req);
    try { return send(res, 200, await sync.connect(body)); }
    catch (e) { return send(res, 400, { error: e.message, status: sync.publicStatus() }); }
  }
  if (p === '/api/sync/now' && m === 'POST') {
    try { return send(res, 200, await sync.syncNow()); }
    catch (e) { return send(res, 400, { error: e.message, status: sync.publicStatus() }); }
  }
  if (p === '/api/sync/disconnect' && m === 'POST') return send(res, 200, sync.disconnect());

  if (p === '/api/import/claude' && m === 'POST') {
    // the export file, sent as-is (it can be large)
    const chunks = []; let size = 0;
    try {
      await new Promise((resolve, reject) => {
        req.on('data', c => { size += c.length; if (size > 1.5e9) { reject(new Error('That file is over 1.5 GB')); req.destroy(); } else chunks.push(c); });
        req.on('end', resolve); req.on('error', reject);
      });
      const result = await importer.importExport(Buffer.concat(chunks), {
        APP_DIR, UPLOADS_DIR, CHATS_DIR, store, saveProjects, filesDir, memoryFile, loadChat, saveChat,
      });
      if (sync) sync.soon(3000);
      return send(res, 200, result);
    } catch (e) { return send(res, 400, { error: e.message, code: e.code, files: e.files }); }
  }

  if (p === '/api/uploads' && m === 'POST') {
    const dir = path.join(UPLOADS_DIR, new Date().toISOString().slice(0, 10) + '-' + crypto.randomBytes(4).toString('hex'));
    await fsp.mkdir(dir, { recursive: true });
    let name, size;
    if (isRaw(req)) {
      // the file itself, streamed (name in the query string)
      name = safeName(url.searchParams.get('name') || 'file');
      try { size = await saveBody(req, path.join(dir, name)); } catch (e) { return send(res, 400, { error: e.message }); }
    } else {
      const body = await readBody(req, 40e6);
      const data = Buffer.from(String(body.data || ''), 'base64');
      name = safeName(body.name || 'file'); size = data.length;
      await fsp.writeFile(path.join(dir, name), data);
    }
    const fp = path.join(dir, name);
    if (!size) { await fsp.unlink(fp).catch(() => {}); return send(res, 400, { error: 'That file is empty' }); }
    return send(res, 200, { id: path.relative(UPLOADS_DIR, fp).split(path.sep).join('/'), name, size, image: IMG_RE.test(name), url: uploadUrl(fp) });
  }
  if (p.startsWith('/api/uploads/') && m === 'GET') {
    const fp = uploadPath(decodeURIComponent(p.slice('/api/uploads/'.length)));
    if (!fp) return send(res, 404, { error: 'Not found' });
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf' };
    res.writeHead(200, { 'Content-Type': types[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" });
    return fs.createReadStream(fp).pipe(res);
  }

  if (p === '/api/remote' && m === 'GET') return send(res, 200, remote.status());
  if (p === '/api/remote' && m === 'POST') {
    try { return send(res, 200, await remote.configure(await readBody(req))); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }

  if (p === '/api/usage' && m === 'GET') {
    const now = Date.now();
    const limits = {};
    for (const [k, v] of Object.entries(usage)) {
      if (!v) continue;
      const ms = typeof v.resetsAt === 'number' ? (v.resetsAt < 1e12 ? v.resetsAt * 1000 : v.resetsAt) : null;
      // a window that has reset since we last heard is back to zero
      limits[k] = ms && ms < now ? { status: 'allowed', utilization: 0, resetsAt: null, stale: true } : { ...v, resetsAt: ms };
    }
    return send(res, 200, { limits });
  }

  if (p === '/api/commands' && m === 'GET') {
    let cwd = url.searchParams.get('cwd') || '';
    if (cwd) cwd = localPath(cwd);
    return send(res, 200, { commands: await commands.list(cwd && fs.existsSync(cwd) ? cwd : null) });
  }

  if (p === '/api/ai' && m === 'GET') return send(res, 200, ai.publicConfig());
  if (p === '/api/ai' && m === 'PATCH') return send(res, 200, ai.updateConfig(await readBody(req)));
  if (p === '/api/ai/models' && m === 'POST') {
    const body = await readBody(req);
    try { return send(res, 200, await ai.listModels(String(body.provider || ''), body)); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }

  if (p === '/api/app' && m === 'GET') {
    // on a phone, updating (which restarts the computer's app) stays a job for the computer itself
    return send(res, 200, { desktop: !!appHooks.desktop && !req.remote, remote: !!req.remote, version: appHooks.version || null, update: appHooks.getUpdate && !req.remote ? appHooks.getUpdate() : null });
  }
  if (p === '/api/app/install-update' && m === 'POST') {
    if (!appHooks.installUpdate) return send(res, 400, { error: 'Updates are only available in the desktop app' });
    setTimeout(() => appHooks.installUpdate(), 200);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/projects' && m === 'POST') {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 120);
    if (!name) return send(res, 400, { error: 'Give the project a name' });
    if (body.kind === 'chat') {
      const now = new Date().toISOString();
      const id = 'p-' + crypto.randomBytes(6).toString('hex');
      store.projects[id] = { id, kind: 'chat', name, description: String(body.description || '').slice(0, 1000), instructions: String(body.instructions || ''), memoryEnabled: true, created: now, updated: now };
      saveProjects();
      await fsp.mkdir(filesDir(id), { recursive: true });
      return send(res, 200, { project: publicProject(store.projects[id]) });
    }
    let cwd = String(body.cwd || '').trim();
    if (cwd.startsWith('~')) cwd = path.join(os.homedir(), cwd.slice(1));
    if (!cwd) cwd = path.join(os.homedir(), 'Claude Projects', safeName(name));
    try { await fsp.mkdir(cwd, { recursive: true }); } catch { return send(res, 400, { error: `Can't create folder ${cwd}` }); }
    const now = new Date().toISOString();
    const id = 'p-' + crypto.randomBytes(6).toString('hex');
    store.projects[id] = { id, name, description: String(body.description || '').slice(0, 1000), instructions: String(body.instructions || ''), cwd: path.resolve(cwd), memoryEnabled: true, created: now, updated: now };
    saveProjects();
    await fsp.mkdir(filesDir(id), { recursive: true });
    return send(res, 200, { project: publicProject(store.projects[id]) });
  }

  let mm;
  if ((mm = p.match(/^\/api\/sessions\/([^/]+)$/))) {
    const id = mm[1];
    if (!ID_RE.test(id)) return send(res, 400, { error: 'Bad session id' });
    if (isAppChatId(id)) {
      const chat = await loadChat(id);
      if (!chat) return send(res, 404, { error: 'Chat not found' });
      if (m === 'GET') {
        const run = activeRunFor(id);
        const msgs = run ? chat.messages.slice(0, -1) : chat.messages; // the running turn arrives live
        return send(res, 200, {
          session: { id, kind: chat.kind, provider: chat.provider, title: chat.title, pinned: !!chat.pinned, projectId: chat.projectId && store.projects[chat.projectId] ? chat.projectId : null, cwd: null },
          turns: chatTurns({ messages: msgs }), run: run ? { id: run.id } : null,
        });
      }
      if (m === 'PATCH') {
        const body = await readBody(req);
        if (typeof body.title === 'string' && body.title.trim()) { chat.title = body.title.trim().slice(0, 200); chat.titleSetByUser = true; delete chat.titleAuto; }
        if (typeof body.pinned === 'boolean') chat.pinned = body.pinned;
        if (typeof body.projectId === 'string') {
          let pid = body.projectId;
          if (pid.startsWith('dir-')) pid = (await getProject(pid, { create: true }) || {}).id || 'none';
          chat.projectId = pid === 'none' || !store.projects[pid] ? null : pid;
        }
        chat.edited = new Date().toISOString();
        await saveChat(chat);
        return send(res, 200, { ok: true });
      }
      if (m === 'DELETE') {
        if (activeRunFor(id)) return send(res, 409, { error: 'This chat is still running' });
        const dest = path.join(TRASH_DIR, 'chats');
        await fsp.mkdir(dest, { recursive: true });
        await fsp.rename(chatFile(id), path.join(dest, id + '.json')).catch(() => {});
        if (sync) sync.recordDeletion('chat', id);
        return send(res, 200, { ok: true });
      }
    }
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
      if (typeof body.title === 'string') { cur.title = body.title.trim().slice(0, 200) || undefined; delete cur.titleAuto; }
      if (typeof body.cwd === 'string' && body.cwd.trim()) {
        // a chat synced from another device can continue in a folder on this one
        const dir = path.resolve(body.cwd.trim());
        try { if (!fs.statSync(dir).isDirectory()) throw 0; } catch { return send(res, 400, { error: `Folder not found: ${dir}` }); }
        cur.cwdOverride = dir;
      }
      if (typeof body.pinned === 'boolean') cur.pinned = body.pinned;
      if (typeof body.projectId === 'string' && (body.projectId === 'none' || store.projects[body.projectId] || body.projectId.startsWith('dir-'))) {
        let pid = body.projectId;
        if (pid.startsWith('dir-')) pid = (await getProject(pid, { create: true }) || {}).id || 'none';
        cur.projectId = pid;
      }
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
      if (sync) sync.recordDeletion('claude', id);
      return send(res, 200, { ok: true, movedTo: dest });
    }
  }

  if ((mm = p.match(/^\/api\/projects\/([A-Za-z0-9_-]{4,64})$/))) {
    const id = mm[1];
    if (m === 'GET') {
      const pr = await getProject(id);
      if (!pr) return send(res, 404, { error: 'Project not found' });
      return send(res, 200, {
        project: pr.virtual ? { ...pr, memoryUpdated: null, virtual: true } : publicProject(pr),
        files: await listFiles(id), memory: await readMemory(id),
      });
    }
    if (m === 'PATCH') {
      const body = await readBody(req);
      const pr = await getProject(id, { create: true });
      if (!pr) return send(res, 404, { error: 'Project not found' });
      if (typeof body.name === 'string' && body.name.trim()) pr.name = body.name.trim().slice(0, 120);
      if (typeof body.description === 'string') pr.description = body.description.slice(0, 1000);
      if (typeof body.instructions === 'string') pr.instructions = body.instructions.slice(0, 50000);
      if (typeof body.memoryEnabled === 'boolean') pr.memoryEnabled = body.memoryEnabled;
      if (typeof body.cwd === 'string' && body.cwd.trim() && pr.kind !== 'chat') {
        let cwd = body.cwd.trim(); if (cwd.startsWith('~')) cwd = path.join(os.homedir(), cwd.slice(1));
        try { if (!fs.statSync(cwd).isDirectory()) throw 0; } catch { return send(res, 400, { error: `Folder not found: ${cwd}` }); }
        pr.cwd = path.resolve(cwd);
      }
      if (typeof body.memory === 'string') {
        await fsp.mkdir(projDir(id), { recursive: true });
        await fsp.writeFile(memoryFile(id), body.memory.slice(0, 20000));
        pr.memoryUpdated = new Date().toISOString();
      }
      pr.updated = new Date().toISOString();
      saveProjects();
      return send(res, 200, { project: publicProject(pr) });
    }
    if (m === 'DELETE') {
      if (!store.projects[id]) return send(res, 404, { error: 'Project not found' });
      // chats stay where they are; the project's files and memory go to the trash folder
      const dest = path.join(TRASH_DIR, 'projects', id + '-' + Date.now());
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.rename(projDir(id), dest).catch(() => {});
      delete store.projects[id];
      if (sync) sync.recordDeletion('project', id);
      for (const k of Object.keys(meta.sessions)) if (meta.sessions[k].projectId === id) delete meta.sessions[k].projectId;
      saveProjects(); saveMeta();
      return send(res, 200, { ok: true });
    }
  }

  if ((mm = p.match(/^\/api\/projects\/([A-Za-z0-9_-]{4,64})\/files(?:\/(.+))?$/))) {
    const id = mm[1];
    if (m === 'POST') {
      const pr = await getProject(id, { create: true });
      if (!pr) return send(res, 404, { error: 'Project not found' });
      const dir = filesDir(id);
      await fsp.mkdir(dir, { recursive: true });
      if (isRaw(req)) {
        let name = safeName(url.searchParams.get('name'));
        const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
        for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${stem} (${i})${ext}`;
        let size;
        try { size = await saveBody(req, path.join(dir, name)); } catch (e) { return send(res, 400, { error: e.message }); }
        if (!size) { await fsp.unlink(path.join(dir, name)).catch(() => {}); return send(res, 400, { error: 'That file is empty' }); }
        pr.updated = new Date().toISOString(); saveProjects();
        return send(res, 200, { file: { name, size } });
      }
      const body = await readBody(req, 40e6);
      let name = safeName(body.name);
      const data = typeof body.text === 'string' ? Buffer.from(body.text, 'utf8') : Buffer.from(String(body.data || ''), 'base64');
      if (!data.length) return send(res, 400, { error: 'That file is empty' });
      if (data.length > 30e6) return send(res, 400, { error: 'Files can be up to 30 MB' });
      if (typeof body.text === 'string' && !/\.[a-z0-9]+$/i.test(name)) name += '.md';
      const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
      for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${stem} (${i})${ext}`;
      await fsp.writeFile(path.join(dir, name), data);
      pr.updated = new Date().toISOString(); saveProjects();
      return send(res, 200, { file: { name, size: data.length } });
    }
    if (m === 'DELETE' && mm[2]) {
      const name = safeName(decodeURIComponent(mm[2]));
      await fsp.unlink(path.join(filesDir(id), name)).catch(() => {});
      return send(res, 200, { ok: true });
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
    for (const n of await fsp.readdir(CHATS_DIR).catch(() => [])) {
      if (!n.endsWith('.json')) continue;
      try { if ((await fsp.readFile(path.join(CHATS_DIR, n), 'utf8')).toLowerCase().includes(q)) hits.push({ id: n.slice(0, -5) }); } catch {}
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
    const attachments = (Array.isArray(body.attachments) ? body.attachments : []).map(uploadPath).filter(Boolean).slice(0, 20);
    const prompt = String(body.prompt || '').trim() || (attachments.length ? '' : '');
    if (!prompt && !attachments.length) return send(res, 400, { error: 'Empty message' });
    const sessionId = body.sessionId || null;
    if (sessionId && !ID_RE.test(sessionId)) return send(res, 400, { error: 'Bad session id' });
    if (sessionId && activeRunFor(sessionId)) return send(res, 409, { error: 'Still working on the last message in this chat' });
    const kind = sessionId ? (isAppChatId(sessionId) ? 'app' : 'claude') : ['model', 'debate'].includes(body.kind) ? body.kind : 'claude';
    if (kind !== 'claude') {
      let chat;
      if (sessionId) {
        chat = await loadChat(sessionId);
        if (!chat) return send(res, 404, { error: 'Chat not found' });
      } else {
        if (kind === 'debate' && !ai.isDebateEnabled()) return send(res, 400, { error: 'Debate mode is turned off in Settings' });
        const provider = String(body.provider || '');
        if (kind === 'model' && !ai.configured(provider)) return send(res, 400, { error: `${ai.providerName(provider)} isn't set up yet — add it in Settings → AI models` });
        const now = new Date().toISOString();
        const pid = body.projectId && store.projects[body.projectId] ? body.projectId : null;
        chat = { id: 'a-' + crypto.randomBytes(8).toString('hex'), kind, provider: kind === 'model' ? provider : null, title: '', projectId: pid, created: now, updated: now, device: os.hostname(), messages: [] };
      }
      const run = await startAppRun({ chat, prompt, attachments });
      return send(res, 200, { runId: run.id, sessionId: chat.id });
    }
    let cwd = body.cwd || os.homedir();
    let project = null;
    if (sessionId) {
      const file = await findSessionFile(sessionId);
      const info = file && await scanFile({ file, projectDir: path.basename(path.dirname(file)) });
      if (info && info.cwd) cwd = info.cwd;
      const ov = meta.sessions[sessionId] && meta.sessions[sessionId].cwdOverride;
      if (ov && fs.existsSync(ov)) cwd = ov;
      else if (!fs.existsSync(cwd) && localPath(cwd) !== cwd) cwd = localPath(cwd);
      else if (!fs.existsSync(cwd)) return send(res, 400, { error: 'This chat\'s folder isn\'t on this computer', code: 'FOLDER_MISSING', cwd });
      if (info) project = await getProject(projectIdFor(info));
    } else if (body.projectId && ID_RE.test(body.projectId)) {
      project = await getProject(body.projectId);
      if (!project) return send(res, 404, { error: 'Project not found' });
      if (project.kind === 'chat') return send(res, 400, { error: 'This is a chat project — pick Claude or another model instead of Claude Code' });
      cwd = project.cwd;
      // a project folder from another computer: same place under this computer's user folder
      if (!fs.existsSync(cwd)) { const t = translateHome(cwd); if (t) cwd = t; }
      await fsp.mkdir(cwd, { recursive: true }).catch(() => {});
    }
    else {
      // a new chat in a folder that belongs to a project joins that project
      const owner = Object.values(store.projects).filter(pr => pr.kind !== 'chat' && pr.cwd && path.resolve(pr.cwd) === path.resolve(cwd)).sort((a, b) => (a.created || '').localeCompare(b.created || ''))[0];
      if (owner) project = owner;
    }
    // folder-only projects with nothing set up yet don't need any shared context
    if (project && project.virtual) project = null;
    if (project && !store.projects[project.id]) project = null;
    try { if (!fs.statSync(cwd).isDirectory()) throw 0; } catch { return send(res, 400, { error: `Folder not found: ${cwd}` }); }
    const model = body.model && MODEL_RE.test(body.model) ? body.model : null;
    const permissionMode = PERM_MODES.has(body.permissionMode) ? body.permissionMode : 'default';
    const allowedTools = (Array.isArray(body.allowedTools) ? body.allowedTools : []).filter(t => TOOL_RE.test(t));
    const run = await startRun({ sessionId, prompt: prompt || 'Please look at the attached file' + (attachments.length > 1 ? 's.' : '.'), cwd, model, permissionMode, allowedTools, project, attachments });
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
  return serveStatic(p, res);
}
const APP_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
function serveStatic(p, res) {
  const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
  const fp = path.resolve(PUBLIC_DIR, rel);
  if (!fp.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const headers = { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    // the app page shows text from AIs and other devices: only its own script files may ever run
    if (rel === 'index.html') Object.assign(headers, { 'Content-Security-Policy': APP_CSP, 'X-Frame-Options': 'DENY' });
    res.writeHead(200, headers);
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

sync = require('./sync');
sync.init({
  APP_DIR, PROJECTS_DIR, PROJ_ROOT, CHATS_DIR,
  listSessions, findSessionFile,
  getMeta: () => meta, saveMeta, getStore: () => store, saveProjects,
  busyIds: () => new Set([...runs.values()].filter(r => !r.done && r.sessionId).map(r => r.sessionId)),
  onIncoming: () => { scanCache.clear(); idToFile.clear(); },
});

let appHooks = {};
/** Used by the desktop app to report its version and update status. */
function setAppHooks(h) { appHooks = h || {}; }

const remote = require('./remote');
remote.init({ APP_DIR, PUBLIC_DIR, route, send, serveStatic });

module.exports = { isRemoteEnabled: () => remote.isEnabled(), start, stopAll, setAppHooks, _internal: { officeTextFile, apiContent, attachBlock, buildContext, getProject, listSessions, store, translateHome } };

// Run directly (`node server.js`): serve and open the default browser.
if (require.main === module) {
  start().then(port => {
    const url = `http://localhost:${port}`;
    console.log(`\n  ✻ Roundtable running at ${url}\n    Reading sessions from ${PROJECTS_DIR}\n    Press Ctrl+C to quit.\n`);
    openBrowser(url);
  }).catch(e => { console.error(e.message); process.exit(1); });
  process.on('SIGINT', () => { stopAll(); setTimeout(() => process.exit(0), 300); });
}
