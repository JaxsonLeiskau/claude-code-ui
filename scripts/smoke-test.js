#!/usr/bin/env node
'use strict';
/*
 * Smoke test: builds a throwaway Claude Code history, starts the server against it,
 * and checks that sessions list, open, rename and search correctly.
 * Doesn't need the real `claude` CLI. Run with: npm test
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccui-test-'));
const projDir = path.join(tmp, 'projects', '-tmp-demo');
fs.mkdirSync(projDir, { recursive: true });
const id = '11111111-2222-3333-4444-555555555555';
const lines = [
  { type: 'user', cwd: tmp, sessionId: id, timestamp: '2026-01-01T10:00:00Z', message: { role: 'user', content: 'Fix the flaky login test' } },
  { type: 'assistant', cwd: tmp, sessionId: id, timestamp: '2026-01-01T10:00:05Z', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] } },
  { type: 'user', cwd: tmp, sessionId: id, timestamp: '2026-01-01T10:00:09Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '12 passed' }] } },
  { type: 'assistant', cwd: tmp, sessionId: id, timestamp: '2026-01-01T10:00:12Z', message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'Fixed a race in the **mock clock**.' }] } },
];
fs.writeFileSync(path.join(projDir, id + '.jsonl'), lines.map(l => JSON.stringify(l)).join('\n') + '\n');

process.env.CLAUDE_CONFIG_DIR = tmp;
process.env.HOME = process.env.USERPROFILE = tmp; // keep metadata writes inside the temp folder
process.env.CLAUDE_BIN = 'claude-not-installed-for-tests';

const { start } = require('../server.js');

(async () => {
  const port = await start(34000 + Math.floor(Math.random() * 1000));
  const base = `http://localhost:${port}`;
  const get = async p => { const r = await fetch(base + p); assert.ok(r.ok, `${p} -> ${r.status}`); return r.json(); };

  const { sessions } = await get('/api/sessions');
  assert.strictEqual(sessions.length, 1, 'lists the session');
  assert.strictEqual(sessions[0].title, 'Fix the flaky login test');

  const s = await get(`/api/sessions/${id}`);
  assert.deepStrictEqual(s.turns.map(t => t.role), ['user', 'assistant'], 'merges tool calls into one reply');
  const tool = s.turns[1].blocks.find(b => b.type === 'tool');
  assert.strictEqual(tool.result, '12 passed', 'attaches tool output');

  const r = await fetch(`${base}/api/sessions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Renamed', pinned: true }) });
  assert.ok(r.ok);
  const after = (await get('/api/sessions')).sessions[0];
  assert.strictEqual(after.title, 'Renamed'); assert.strictEqual(after.pinned, true);

  const { hits } = await get('/api/search?q=mock%20clock');
  assert.strictEqual(hits.length, 1, 'full-text search finds the message');

  const status = await new Promise((resolve, reject) => {
    require('http').get({ host: '127.0.0.1', port, path: '/api/info', headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.strictEqual(status, 403, 'rejects foreign hosts');

  // projects: create, add a file, instructions, and check the context every chat would get
  const send = async (p, method, body) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); assert.ok(r.ok, `${p} -> ${j.error}`); return j;
  };
  const { project } = await send('/api/projects', 'POST', { name: 'Homelab', description: 'My server' });
  await send(`/api/projects/${project.id}`, 'PATCH', { instructions: 'Keep answers short.', memory: '- Uses Proxmox' });
  await send(`/api/projects/${project.id}/files`, 'POST', { name: 'Hardware', text: 'Ryzen 5, 32 GB RAM' });
  const pd = await get(`/api/projects/${project.id}`);
  assert.strictEqual(pd.files[0].name, 'Hardware.md', 'stores text content as a file');
  const { _internal } = require('../server.js');
  const ctx = await _internal.buildContext(_internal.store.projects[project.id], null);
  for (const want of ['Keep answers short.', 'Uses Proxmox', 'Ryzen 5, 32 GB RAM'])
    assert.ok(ctx.includes(want), `project context includes "${want}"`);
  const listed = (await get('/api/sessions')).projects;
  assert.ok(listed.some(p => p.id === project.id && !p.virtual), 'lists the project');
  assert.ok(listed.some(p => p.virtual && p.chatCount === 1), 'lists folders as projects');

  // a chat synced from a computer with a different user name continues in this user's folder
  const otherId = '99999999-2222-3333-4444-555555555555';
  fs.writeFileSync(path.join(projDir, otherId + '.jsonl'), JSON.stringify({ type: 'user', cwd: '/home/someone-else', sessionId: otherId, timestamp: '2026-01-02T10:00:00Z', message: { role: 'user', content: 'From the other computer' } }) + '\n');
  const moved = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: otherId, prompt: 'continue' }) });
  assert.ok(moved.ok, 'continues in this computer\'s user folder instead of asking');
  const gone = '88888888-2222-3333-4444-555555555555';
  fs.writeFileSync(path.join(projDir, gone + '.jsonl'), JSON.stringify({ type: 'user', cwd: '/nowhere/at/all', sessionId: gone, timestamp: '2026-01-02T10:00:00Z', message: { role: 'user', content: 'Folder only elsewhere' } }) + '\n');
  const asks = await (await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: gone, prompt: 'continue' }) })).json();
  assert.strictEqual(asks.code, 'FOLDER_MISSING', 'asks for a folder when there is no match');

  // "/" menu: skills, commands and built-ins for a folder
  fs.mkdirSync(path.join(tmp, 'skills', 'deploy-check'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'skills', 'deploy-check', 'SKILL.md'), '---\nname: deploy-check\ndescription: >\n  Check a deploy\n  went out cleanly\n---\n');
  fs.mkdirSync(path.join(tmp, 'skills', 'internal'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'skills', 'internal', 'SKILL.md'), '---\nname: internal\ndescription: x\nuser-invocable: false\n---\n');
  fs.mkdirSync(path.join(tmp, 'commands'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'commands', 'standup.md'), '---\ndescription: Summarize yesterday\n---\nbody');
  const { commands } = await get('/api/commands?cwd=' + encodeURIComponent(tmp));
  const byName = Object.fromEntries(commands.map(c => [c.name, c]));
  assert.strictEqual(byName['deploy-check'].description, 'Check a deploy went out cleanly', 'reads skill descriptions');
  assert.ok(!byName.internal, 'hides skills that are not user-invocable');
  assert.strictEqual(byName.standup.source, 'command', 'lists custom commands');
  assert.strictEqual(byName.model.source, 'builtin', 'lists built-ins that work headless');

  // importing a claude.ai export (conversations.json form)
  const exportJson = JSON.stringify([{ uuid: 'abcdef01-2345-6789-abcd-ef0123456789', name: 'Old chat', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:01:00Z',
    chat_messages: [{ sender: 'human', text: 'hi', content: [{ type: 'text', text: 'hi' }] }, { sender: 'assistant', text: '', content: [{ type: 'text', text: 'hello!' }] }] }]);
  const imp = async () => (await fetch(base + '/api/import/claude', { method: 'POST', body: exportJson })).json();
  assert.strictEqual((await imp()).chats, 1, 'imports a claude.ai conversation');
  assert.strictEqual((await imp()).chats, 0, 'importing again adds nothing');
  const old = await get('/api/sessions/a-abcdef0123456789abcdef0123456789');
  assert.strictEqual(old.session.provider, 'claude'); assert.strictEqual(old.turns[1].blocks[0].text, 'hello!');
  const { readZip } = require('../import.js');
  // a tiny zip with one deflated file
  const zlib = require('zlib'); const data = Buffer.from('[]'); const comp = zlib.deflateRawSync(data); const name = Buffer.from('conversations.json');
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(0, 42);
  const body = Buffer.concat([lh, name, comp]); const cdBuf = Buffer.concat([cd, name]);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(body.length, 16);
  assert.strictEqual(readZip(Buffer.concat([body, cdBuf, eocd])).get('conversations.json')().toString(), '[]', 'reads zip files');

  const page = await fetch(base + '/');
  assert.ok((await page.text()).includes('id="composer"'), 'serves the UI');

  console.log('✓ all smoke tests passed');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} // Windows may still hold the folder briefly
  process.exit(0);
})().catch(e => {
  console.error('✗', e.message);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Smoke test::${String(e.stack || e.message).replace(/\r?\n/g, '%0A')}`);
  process.exit(1);
});
