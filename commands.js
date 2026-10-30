'use strict';
/*
 * What can follow a "/" in a Claude Code chat: your skills, custom commands, plugin skills and
 * commands, and the built-in commands that work when Claude Code runs headless (as this app runs it).
 * Claude Code expands "/name args" itself; this only finds names and descriptions to suggest.
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');

let CLAUDE_HOME = path.join(os.homedir(), '.claude');
const fromInit = new Map(); // cwd -> { slash: [...], plugins: [{name, path}] } seen in a real run
function init({ claudeHome }) { CLAUDE_HOME = claudeHome; }

/** Remember what Claude Code itself reported at the start of a run in this folder. */
function noteInit(cwd, o) {
  if (!cwd || !o) return;
  const slash = Array.isArray(o.slash_commands) ? o.slash_commands.map(String) : [];
  const plugins = Array.isArray(o.plugins) ? o.plugins.filter(p => p && p.path) : [];
  if (slash.length || plugins.length) fromInit.set(path.resolve(cwd), { slash, plugins, at: Date.now() });
}

// Built-ins that work in headless mode (per the Claude Code docs); the rest need the terminal UI
const BUILTINS = [
  { name: 'model', argHint: '<model>', description: 'Switch the model for this chat, e.g. /model opus' },
  { name: 'effort', argHint: '<level>', description: 'Set how hard Claude thinks, e.g. /effort high' },
  { name: 'config', argHint: '<key=value>', description: 'Change a Claude Code setting, e.g. /config thinking=false' },
  { name: 'mcp', argHint: '', description: 'Show the status of connected MCP servers' },
  { name: 'output-style', argHint: '[style]', description: 'List output styles, or switch to one' },
  { name: 'rename', argHint: '<name>', description: 'Rename this chat in Claude Code' },
  // run by Roundtable itself through "claude plugin …" (the interactive menu needs the terminal)
  { name: 'plugin', argHint: 'install <name> | marketplace add <owner/repo> | list', description: 'Add, list, turn on/off or remove plugins' },
];

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) {
      key = kv[1].toLowerCase();
      let v = kv[2].trim();
      if (v === '>' || v === '|' || v === '>-' || v === '|-') v = '';
      out[key] = v.replace(/^["']|["']$/g, '');
    } else if (key && /^\s+\S/.test(line)) out[key] = (out[key] ? out[key] + ' ' : '') + line.trim();
  }
  return out;
}
const firstLine = text => {
  const body = text.replace(/^---[\s\S]*?\n---\s*/, '');
  const l = body.split('\n').map(s => s.replace(/^#+\s*/, '').trim()).find(Boolean) || '';
  return l.slice(0, 160);
};
const isFalse = v => /^(false|no|0)$/i.test(String(v || '').trim());

async function readHead(file) {
  const fh = await fsp.open(file, 'r');
  try { const buf = Buffer.alloc(16384); const { bytesRead } = await fh.read(buf, 0, buf.length, 0); return buf.toString('utf8', 0, bytesRead); }
  finally { await fh.close(); }
}

// <root>/<name>/SKILL.md, allowing a couple of extra folder levels (synced or grouped skills)
async function scanSkills(root, depth = 3) {
  const out = [];
  async function walk(dir, d) {
    let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    if (ents.some(e => e.isFile() && e.name === 'SKILL.md')) {
      try {
        const text = await readHead(path.join(dir, 'SKILL.md'));
        const fm = frontmatter(text);
        if (!isFalse(fm['user-invocable'])) out.push({ name: fm.name || path.basename(dir), description: fm.description || firstLine(text), argHint: fm['argument-hint'] || '' });
      } catch {}
      return;
    }
    if (d <= 0) return;
    for (const e of ents) if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') await walk(path.join(dir, e.name), d - 1);
  }
  await walk(root, depth);
  return out;
}
// <root>/**/*.md; a file in a subfolder is still called by its own name
async function scanCommands(root, depth = 2) {
  const out = [];
  async function walk(dir, d) {
    let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isFile() && e.name.endsWith('.md')) {
        try {
          const text = await readHead(p);
          const fm = frontmatter(text);
          out.push({ name: e.name.slice(0, -3), description: fm.description || firstLine(text), argHint: fm['argument-hint'] || '' });
        } catch {}
      } else if (e.isDirectory() && d > 0 && !e.name.startsWith('.')) await walk(p, d - 1);
    }
  }
  await walk(root, depth);
  return out;
}

// Installed plugins: from Claude Code's own report if we have one, else from its plugin records on disk
async function pluginRoots(cwd) {
  const seen = fromInit.get(path.resolve(cwd || '.'));
  if (seen && seen.plugins.length) return seen.plugins.map(p => ({ name: p.name, dir: p.path }));
  const roots = [];
  let enabled = {};
  try { enabled = JSON.parse(await fsp.readFile(path.join(CLAUDE_HOME, 'settings.json'), 'utf8')).enabledPlugins || {}; } catch {}
  try {
    const rec = JSON.parse(await fsp.readFile(path.join(CLAUDE_HOME, 'plugins', 'installed_plugins.json'), 'utf8'));
    const all = rec.plugins || rec;
    for (const [id, v] of Object.entries(all)) {
      if (enabled[id] === false) continue;
      const entries = Array.isArray(v) ? v : [v];
      const e = entries.filter(x => x && x.installPath).sort((a, b) => String(b.lastUpdated || '').localeCompare(String(a.lastUpdated || '')))[0];
      if (e && fs.existsSync(e.installPath)) roots.push({ name: id.split('@')[0], dir: e.installPath });
    }
  } catch {}
  return roots;
}
async function pluginName(dir, fallback) {
  try { return JSON.parse(await fsp.readFile(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).name || fallback; } catch { return fallback; }
}

// Project folders: this folder and its parents up to (not including) the user folder
function projectDirs(cwd) {
  const dirs = [];
  if (!cwd) return dirs;
  let d = path.resolve(cwd);
  const home = path.resolve(os.homedir());
  for (let i = 0; i < 12; i++) {
    if (d === home) break;
    dirs.push(d);
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return dirs;
}

const cache = new Map();
async function list(cwd) {
  const key = path.resolve(cwd || os.homedir());
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15000) return hit.items;
  const items = new Map();
  const add = (it, source, scope) => { const k = it.name.toLowerCase(); if (!items.has(k)) items.set(k, { ...it, source, scope }); };

  for (const dir of projectDirs(cwd)) {
    for (const s of await scanSkills(path.join(dir, '.claude', 'skills'))) add(s, 'skill', 'project');
    for (const c of await scanCommands(path.join(dir, '.claude', 'commands'))) add(c, 'command', 'project');
  }
  for (const s of await scanSkills(path.join(CLAUDE_HOME, 'skills'))) add(s, 'skill', 'personal');
  for (const c of await scanCommands(path.join(CLAUDE_HOME, 'commands'))) add(c, 'command', 'personal');
  for (const p of await pluginRoots(cwd)) {
    const pn = await pluginName(p.dir, p.name);
    for (const s of await scanSkills(path.join(p.dir, 'skills'), 2)) add({ ...s, name: `${pn}:${s.name}` }, 'plugin', pn);
    for (const c of await scanCommands(path.join(p.dir, 'commands'), 1)) add({ ...c, name: `${pn}:${c.name}` }, 'plugin', pn);
    if (fs.existsSync(path.join(p.dir, 'SKILL.md'))) for (const s of await scanSkills(p.dir, 0)) add({ ...s, name: `${pn}:${s.name}` }, 'plugin', pn);
  }
  // anything else Claude Code reported for this folder (e.g. commands from settings we don't scan)
  const seen = fromInit.get(key);
  if (seen) for (const n of seen.slash) {
    const name = n.replace(/^\//, '');
    if (name && !BUILTINS.some(b => b.name === name)) add({ name, description: '', argHint: '' }, 'command', 'claude');
  }
  for (const b of BUILTINS) add(b, 'builtin', 'built-in');

  const out = [...items.values()].map(i => ({ ...i, description: String(i.description || '').slice(0, 200) }));
  out.sort((a, b) => (a.source === 'builtin') - (b.source === 'builtin') || a.name.localeCompare(b.name));
  cache.set(key, { at: Date.now(), items: out });
  return out;
}

module.exports = { init, list, noteInit, _frontmatter: frontmatter };
