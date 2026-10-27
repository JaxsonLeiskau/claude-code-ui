#!/usr/bin/env node
'use strict';
/*
 * Integration test: two "devices" (separate home folders) syncing through a fake GitHub,
 * plus chats with other models and a debate through fake APIs. No network or real CLI needed.
 */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccui-int-'));
const procs = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = 36000 + Math.floor(Math.random() * 2000);
const P = { gh: base, gpt: base + 1, gem: base + 2, desk: base + 3, lap: base + 4 };
function start(file, args, env = {}) {
  const p = spawn(process.execPath, [file, ...args], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'inherit'] });
  procs.push(p); return p;
}
function device(name, port) {
  const home = path.join(tmp, name); fs.mkdirSync(path.join(home, 'work'), { recursive: true });
  // the fake CLI needs to run under node on every OS, so point at a small launcher
  let bin = path.join(home, 'claude');
  if (process.platform === 'win32') { bin += '.cmd'; fs.writeFileSync(bin, `@"${process.execPath}" "${path.join(__dirname, 'fake-claude.js')}" %*\r\n`); }
  else { fs.writeFileSync(bin, `#!/bin/sh\nexec "${process.execPath}" "${path.join(__dirname, 'fake-claude.js')}" "$@"\n`); fs.chmodSync(bin, 0o755); }
  start('server.js', [], {
    HOME: home, USERPROFILE: home, PORT: String(port), NO_OPEN: '1', DEFAULT_CWD: path.join(home, 'work'), CLAUDE_BIN: bin,
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'), CCUI_GITHUB_API: `http://127.0.0.1:${P.gh}`,
    CCUI_OPENAI_BASE: `http://127.0.0.1:${P.gpt}/v1`, CCUI_GEMINI_BASE: `http://127.0.0.1:${P.gem}/v1beta/openai`,
  });
  const url = `http://localhost:${port}`;
  return {
    home,
    async api(p, method = 'GET', body) {
      const r = await fetch(url + p, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) throw new Error(`${p}: ${j.error}`); return j;
    },
    async waitIdle() { for (let i = 0; i < 100; i++) { if (!(await this.api('/api/runs')).runs.length) return; await sleep(100); } throw new Error('run never finished'); },
  };
}

(async () => {
  start(path.join(__dirname, 'fake-github.js'), [String(P.gh)]);
  start(path.join(__dirname, 'fake-ai.js'), [String(P.gpt), 'ChatGPT']);
  start(path.join(__dirname, 'fake-ai.js'), [String(P.gem), 'Gemini']);
  const desk = device('desktop', P.desk), lap = device('laptop', P.lap);
  await sleep(1500);

  // other models + debate on the desktop
  await desk.api('/api/ai', 'PATCH', { openai: { key: 'good-key', model: 'test-model' }, gemini: { key: 'good-key', model: 'test-model' } });
  await assert.rejects(desk.api('/api/chat', 'POST', { kind: 'debate', prompt: 'x' }), /turned off/, 'debate is off until enabled');
  await desk.api('/api/ai', 'PATCH', { debateEnabled: true });
  const chat = await desk.api('/api/chat', 'POST', { kind: 'model', provider: 'openai', prompt: 'Hello ChatGPT' });
  const deb = await desk.api('/api/chat', 'POST', { kind: 'debate', prompt: 'How do I reach my server?' });
  await desk.waitIdle();
  const c = await desk.api(`/api/sessions/${chat.sessionId}`);
  assert.strictEqual(c.turns[1].blocks[0].text, 'ChatGPT answer.', 'model chat answered');
  const d = await desk.api(`/api/sessions/${deb.sessionId}`);
  const db = d.turns[1].blocks[0];
  assert.deepStrictEqual(db.participants, ['Claude', 'ChatGPT', 'Gemini'], 'debate participants');
  assert.strictEqual(db.rounds.length, 2, 'two rounds');
  assert.strictEqual(d.turns[1].blocks[1].text, 'CONSENSUS: use Tailscale.', 'moderator consensus');

  // a Claude Code chat on the desktop
  const cc = await desk.api('/api/chat', 'POST', { prompt: 'Fix the bug', cwd: path.join(desk.home, 'work'), permissionMode: 'bypassPermissions' });
  await desk.waitIdle();
  const ccId = (await desk.api('/api/sessions')).sessions.find(s => s.kind === 'claude').id;

  // sync: desktop up, laptop down
  await assert.rejects(desk.api('/api/sync/connect', 'POST', { token: 'bad', repo: 'roundtable-sync' }), /token/);
  await assert.rejects(desk.api('/api/sync/connect', 'POST', { token: 'tok-good', repo: 'public-repo' }), /public/);
  await desk.api('/api/sync/connect', 'POST', { token: 'tok-good', repo: 'roundtable-sync' });
  await lap.api('/api/sync/connect', 'POST', { token: 'tok-good', repo: 'roundtable-sync' });
  let lapList = (await lap.api('/api/sessions')).sessions;
  assert.strictEqual(lapList.length, 3, 'laptop received all three chats');
  assert.ok(lapList.some(s => s.id === ccId && s.kind === 'claude'), 'Claude Code chat synced');

  // rename on the laptop, delete on the desktop
  await lap.api(`/api/sessions/${ccId}`, 'PATCH', { title: 'Renamed on laptop' });
  await desk.api(`/api/sessions/${chat.sessionId}`, 'DELETE');
  await lap.api('/api/sync/now', 'POST'); await desk.api('/api/sync/now', 'POST'); await lap.api('/api/sync/now', 'POST');
  const deskList = (await desk.api('/api/sessions')).sessions;
  lapList = (await lap.api('/api/sessions')).sessions;
  assert.strictEqual(deskList.find(s => s.id === ccId).title, 'Renamed on laptop', 'rename synced');
  assert.ok(!lapList.some(s => s.id === chat.sessionId), 'deletion synced');

  // the same chat continued on both devices before syncing keeps both versions
  await lap.api('/api/chat', 'POST', { sessionId: deb.sessionId, prompt: 'from laptop' });
  await desk.api('/api/chat', 'POST', { sessionId: deb.sessionId, prompt: 'from desktop' });
  await lap.waitIdle(); await desk.waitIdle();
  await desk.api('/api/sync/now', 'POST'); await lap.api('/api/sync/now', 'POST'); await lap.api('/api/sync/now', 'POST'); await desk.api('/api/sync/now', 'POST');
  for (const dev of [desk, lap]) {
    const titles = (await dev.api('/api/sessions')).sessions.map(s => s.title);
    assert.ok(titles.some(t => /copy from other device/.test(t)), 'both versions kept on each device');
  }

  console.log('✓ integration tests passed (models, debate, two-device sync)');
})().then(() => 0, e => { console.error('✗', e.stack || e.message); return 1; }).then(code => {
  for (const p of procs) try { p.kill(); } catch {}
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  process.exit(code);
});
