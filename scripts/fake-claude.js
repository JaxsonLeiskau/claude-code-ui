#!/usr/bin/env node
// Test double for the `claude` CLI: answers debate prompts and plain chats, writing a transcript like the real one.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const a = process.argv.slice(2);
if (a.includes('--version')) { console.log('0.0.0 (fake)'); process.exit(0); }
let input = ''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => {
  const out = o => process.stdout.write(JSON.stringify(o) + '\n');
  out({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', utilization: 0.25, resetsAt: Date.now() + 3600e3, rateLimitType: 'five_hour' } });
  if (a.includes('--tools')) {
    out({ type: 'system', subtype: 'init', session_id: 'chat-session-1' });
    const t = /final answer/i.test(input) ? 'CONSENSUS: use Tailscale.' : 'Claude answer.';
    out({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } } });
    return out({ type: 'result', is_error: false, result: t });
  }
  if (a.includes('json')) return out({ type: 'result', is_error: false, result: 'NO_CHANGE' });
  const ri = a.indexOf('--resume'); const id = ri >= 0 ? a[ri + 1] : crypto.randomUUID(); const cwd = process.cwd();
  const dir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const log = o => fs.appendFileSync(path.join(dir, id + '.jsonl'), JSON.stringify({ cwd, sessionId: id, timestamp: new Date().toISOString(), ...o }) + '\n');
  log({ type: 'user', message: { role: 'user', content: input } });
  out({ type: 'system', subtype: 'init', session_id: id });
  const m = { id: 'm' + Date.now(), role: 'assistant', content: [{ type: 'text', text: 'Done.' }] };
  out({ type: 'assistant', message: m }); log({ type: 'assistant', message: m });
  out({ type: 'result', subtype: 'success', is_error: false, duration_ms: 5, session_id: id });
});
