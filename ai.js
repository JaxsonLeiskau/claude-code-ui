'use strict';
/*
 * Other AI models: chat directly with your Open WebUI model, ChatGPT or Gemini, and
 * "debate" mode where Claude, ChatGPT and Gemini answer, critique each other and a
 * moderator writes the consensus. Keys stay on this device (ai.json is never synced).
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

let deps = null; // { APP_DIR, spawnClaude }
let cfgFile = '';
let cfg = {};

const DEFAULTS = {
  debateEnabled: false,
  autoTitles: true,
  openwebui: { url: '', key: '', model: '', label: 'My model' },
  openai: { key: '', model: '' },
  gemini: { key: '', model: '' },
  deepseek: { key: '', model: '' },
  debate: { participants: ['claude', 'openai', 'gemini'], rounds: 2, moderator: 'claude', claudeModel: 'sonnet' },
};

function init(d) {
  deps = d;
  cfgFile = path.join(d.APP_DIR, 'ai.json');
  try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch { cfg = {}; }
  cfg = merge(DEFAULTS, cfg);
}
const merge = (a, b) => {
  const out = { ...a };
  for (const k of Object.keys(b || {})) out[k] = a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? { ...a[k], ...b[k] } : b[k];
  return out;
};
function save() {
  fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

/* ---------------- providers ---------------- */
const PROVIDERS = {
  claude: { name: 'Claude', kind: 'cli' },
  openai: { name: 'ChatGPT', base: () => process.env.CCUI_OPENAI_BASE || 'https://api.openai.com/v1', chat: '/chat/completions', models: '/models' },
  gemini: { name: 'Gemini', base: () => process.env.CCUI_GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai', chat: '/chat/completions', models: '/models' },
  deepseek: { name: 'DeepSeek', base: () => process.env.CCUI_DEEPSEEK_BASE || 'https://api.deepseek.com', chat: '/chat/completions', models: '/models' },
  openwebui: { name: 'My model', base: () => String(cfg.openwebui.url || '').replace(/\/+$/, ''), chat: '/api/chat/completions', models: '/api/models' },
};
const providerName = id => (id === 'openwebui' ? cfg.openwebui.label || 'My model' : (PROVIDERS[id] || {}).name || id);
const configured = id => {
  if (id === 'claude') return true;
  if (id === 'openwebui') return !!(cfg.openwebui.url && cfg.openwebui.model);
  return !!(cfg[id] && cfg[id].key && cfg[id].model);
};
const mask = k => (k ? '••••' + String(k).slice(-4) : '');

/** Settings as shown to the page: keys are masked, never sent back in full. */
function publicConfig() {
  return {
    debateEnabled: !!cfg.debateEnabled,
    autoTitles: cfg.autoTitles !== false,
    openwebui: { url: cfg.openwebui.url, model: cfg.openwebui.model, label: cfg.openwebui.label, key: mask(cfg.openwebui.key) },
    openai: { model: cfg.openai.model, key: mask(cfg.openai.key) },
    gemini: { model: cfg.gemini.model, key: mask(cfg.gemini.key) },
    deepseek: { model: cfg.deepseek.model, key: mask(cfg.deepseek.key) },
    debate: cfg.debate,
    available: ['openwebui', 'openai', 'gemini', 'deepseek'].filter(configured).map(id => ({ id, name: providerName(id), model: cfg[id].model })),
    debateParticipants: debateParticipants().map(id => ({ id, name: providerName(id) })),
  };
}

function updateConfig(body) {
  const keyOk = v => typeof v === 'string' && v && !v.startsWith('••••');
  for (const id of ['openwebui', 'openai', 'gemini', 'deepseek']) {
    const b = body[id]; if (!b || typeof b !== 'object') continue;
    if (keyOk(b.key)) {
      // DeepSeek joins debates as soon as it has a key
      if (id === 'deepseek' && !cfg.deepseek.key && !cfg.debate.participants.includes('deepseek')) cfg.debate.participants.push('deepseek');
      cfg[id].key = b.key.trim();
    }
    if (b.key === '') cfg[id].key = '';
    if (typeof b.model === 'string') cfg[id].model = b.model.trim().slice(0, 200);
    if (id === 'openwebui') {
      if (typeof b.url === 'string') cfg.openwebui.url = b.url.trim().replace(/\/+$/, '');
      if (typeof b.label === 'string') cfg.openwebui.label = b.label.trim().slice(0, 40) || 'My model';
    }
  }
  if (typeof body.debateEnabled === 'boolean') cfg.debateEnabled = body.debateEnabled;
  if (typeof body.autoTitles === 'boolean') cfg.autoTitles = body.autoTitles;
  if (body.debate && typeof body.debate === 'object') {
    const d = body.debate;
    if (Array.isArray(d.participants)) cfg.debate.participants = d.participants.filter(p => ['claude', 'openai', 'gemini', 'deepseek'].includes(p));
    if (Number.isInteger(d.rounds)) cfg.debate.rounds = Math.min(3, Math.max(1, d.rounds));
    if (['claude', 'openai', 'gemini', 'deepseek'].includes(d.moderator)) cfg.debate.moderator = d.moderator;
    if (typeof d.claudeModel === 'string' && /^[\w.\-\[\]]{1,60}$/.test(d.claudeModel)) cfg.debate.claudeModel = d.claudeModel;
  }
  save();
  return publicConfig();
}

function debateParticipants() {
  return (cfg.debate.participants || []).filter(configured);
}

async function httpError(res) {
  const e = await rawHttpError(res);
  if (/no longer available|not found|does not exist|deprecated|not supported|unknown model|invalid model/i.test(e.message) && /model/i.test(e.message))
    e.message += '\n\nPick a different model in Settings → AI models (press Connect to see the current list).';
  return e;
}
async function rawHttpError(res) {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const t = await res.text();
    try { const j = JSON.parse(t); const e = Array.isArray(j) ? j[0] && j[0].error : j.error || j.detail; msg = (e && (e.message || e)) || msg; }
    catch { if (t) msg = t.slice(0, 300); }
  } catch {}
  return new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
}

/** List models for a provider. `override` lets the settings page test unsaved values. */
async function listModels(id, override = {}) {
  const p = PROVIDERS[id];
  if (!p || p.kind === 'cli') throw new Error('Unknown provider');
  const key = override.key && !override.key.startsWith('••••') ? override.key : cfg[id].key;
  const base = id === 'openwebui' ? String(override.url || cfg.openwebui.url || '').replace(/\/+$/, '') : p.base();
  if (!base) throw new Error('Enter the Open WebUI address first');
  if (id !== 'openwebui' && !key) throw new Error('Enter an API key first');
  const res = await fetch(base + p.models, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(15000) })
    .catch(e => { throw new Error(`Couldn't reach ${base} (${e.cause ? e.cause.code || e.cause.message : e.message})`); });
  if (!res.ok) {
    // DeepSeek's documented models, in case its list endpoint isn't available
    if (id === 'deepseek' && res.status === 404) return { models: [{ id: 'deepseek-v4-pro', name: '' }, { id: 'deepseek-flash', name: '' }], suggested: 'deepseek-v4-pro' };
    throw await httpError(res);
  }
  const j = await res.json();
  const list = (j.data || j.models || []).map(m => ({ id: String(m.id || m.name || '').replace(/^models\//, ''), name: m.name && m.name !== m.id ? String(m.name).replace(/^models\//, '') : '' }));
  let models = list.filter(m => m.id);
  if (id === 'openai') models = models.filter(m => /^(gpt|o\d|chatgpt)/.test(m.id) && !/(audio|realtime|transcribe|tts|image|embedding|search|moderation|instruct)/.test(m.id));
  if (id === 'gemini') models = models.filter(m => /gemini/.test(m.id) && !/(embedding|image|tts|audio|live|aqa)/.test(m.id));
  models.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
  return { models, suggested: suggest(id, models) };
}
// Best guess at the newest general-purpose model, so a key works without hunting for a name
function suggest(id, models) {
  const ids = models.map(m => m.id);
  const ver = s => (s.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1] * 1;
  if (id === 'openai') {
    const main = ids.filter(m => /^gpt-\d/.test(m) && !/(mini|nano|codex|pro|chat-latest|\d{4}-\d\d-\d\d)/.test(m));
    return main.sort((a, b) => ver(b) - ver(a))[0] || ids[0] || '';
  }
  if (id === 'gemini') {
    // newest version wins, even a "-preview" (Google retires older models for new users first);
    // at the same version a stable model beats its preview
    const pick = kind => ids.filter(m => new RegExp(`^gemini-[\\d.]+-${kind}(-preview)?$`).test(m))
      .sort((a, b) => ver(b) - ver(a) || /preview/.test(a) - /preview/.test(b))[0];
    return pick('pro') || pick('flash') || ids[0] || '';
  }
  if (id === 'deepseek') return ids.find(m => /pro/.test(m)) || ids.find(m => !/flash|lite/.test(m)) || ids[0] || '';
  return ids[0] || '';
}

/** Stream a chat completion from an OpenAI-compatible API. Resolves with the full text. */
async function streamCompletion(id, messages, { onText, signal } = {}) {
  const p = PROVIDERS[id];
  const c = cfg[id];
  const headers = { 'Content-Type': 'application/json' };
  if (c.key) headers.Authorization = `Bearer ${c.key}`;
  const res = await fetch(p.base() + p.chat, { method: 'POST', headers, body: JSON.stringify({ model: c.model, messages, stream: true }), signal })
    .catch(e => { if (e.name === 'AbortError') throw e; throw new Error(`Couldn't reach ${providerName(id)} (${e.cause ? e.cause.code || e.cause.message : e.message})`); });
  if (!res.ok) throw await httpError(res);
  let text = '';
  if (!(res.headers.get('content-type') || '').includes('event-stream')) {
    // e.g. Open WebUI with streaming turned off
    const j = await res.json();
    text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    if (onText) onText(text, text);
    return text;
  }
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return text;
      let o; try { o = JSON.parse(data); } catch { continue; }
      if (o.error) throw new Error(o.error.message || JSON.stringify(o.error));
      const d = o.choices && o.choices[0] && o.choices[0].delta;
      if (d && typeof d.content === 'string' && d.content) { text += d.content; if (onText) onText(d.content, text); }
    }
  }
  return text;
}

/** Claude as a plain chat participant, through the Claude Code CLI with all tools off. */
const flat = c => typeof c === 'string' ? c : Array.isArray(c) ? c.filter(p => p.type === 'text').map(p => p.text).join('\n\n') : '';
function claudeCompletion(messages, { onText, signal, attachments = [] } = {}) {
  return new Promise((resolve, reject) => {
    const sys = messages.filter(m => m.role === 'system').map(m => flat(m.content)).join('\n\n');
    const convo = messages.filter(m => m.role !== 'system').map(m => ({ ...m, content: flat(m.content) }));
    if (attachments.length && convo.length) convo[convo.length - 1].content += `\n\n(The user attached: ${attachments.join(', ')}. Open them with the Read tool if they matter.)`;
    const input = (sys ? `<instructions>\n${sys}\n</instructions>\n\n` : '') + (convo.length > 1
      ? convo.slice(0, -1).map(m => `<${m.role}>\n${m.content}\n</${m.role}>`).join('\n\n') + '\n\n' + convo[convo.length - 1].content
      : (convo[0] || {}).content || '');
    const dir = path.join(deps.APP_DIR, 'debate');
    fs.mkdirSync(dir, { recursive: true });
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--no-session-persistence', '--tools', attachments.length ? 'Read' : '',
      '--model', cfg.debate.claudeModel || 'sonnet',
      '--system-prompt', attachments.length ? 'You are Claude, taking part in a text discussion with other AI assistants. Answer directly in Markdown. You can only read the attached files.' : 'You are Claude, taking part in a text discussion with other AI assistants. Answer directly in Markdown. You have no tools.'];
    for (const d of new Set(attachments.map(a => path.dirname(a)))) args.push('--add-dir', d);
    let proc;
    try { proc = deps.spawnClaude(args, { cwd: dir, env: process.env }); } catch (e) { return reject(e); }
    let text = '', buf = '', err = '', final = null, settled = false;
    const done = (e, v) => { if (settled) return; settled = true; e ? reject(e) : resolve(v); };
    if (signal) signal.addEventListener('abort', () => { try { proc.kill(); } catch {} done(Object.assign(new Error('Stopped'), { name: 'AbortError' })); });
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.type === 'stream_event' && o.event && o.event.type === 'content_block_delta' && o.event.delta && o.event.delta.type === 'text_delta') {
          text += o.event.delta.text || ''; if (onText) onText(o.event.delta.text || '', text);
        } else if (o.type === 'result') final = o;
      }
    });
    proc.stderr.on('data', d => { err += d; });
    proc.on('error', e => done(e.code === 'ENOENT' ? new Error('Claude Code (the `claude` command) isn\'t installed') : e));
    proc.on('close', () => {
      if (final && final.is_error) return done(new Error(String(final.result || 'Claude reported an error').slice(0, 300)));
      if (!text && final && typeof final.result === 'string') text = final.result;
      if (!text) return done(new Error((err.trim().split('\n').pop() || 'Claude gave no answer').slice(0, 300)));
      done(null, text);
    });
    proc.stdin.on('error', () => {});
    proc.stdin.end(input);
  });
}

function complete(id, messages, opts) {
  if (id === 'claude') return claudeCompletion(messages, opts);
  if (!configured(id)) return Promise.reject(new Error(`${providerName(id)} isn't set up yet — add it in Settings → AI models`));
  return streamCompletion(id, messages, opts);
}

/* ---------------- debate ---------------- */
/**
 * history: earlier [{role, content}] turns of this debate chat (questions + consensus answers).
 * emit(state) is called whenever anything changes, with the whole debate state.
 */
async function runDebate({ question: q, attachments = [], history, context, emit, signal }) {
  const ids = debateParticipants();
  if (ids.length < 2) throw new Error('Debate needs at least two models. Add a ChatGPT, Gemini or DeepSeek key in Settings → AI models.');
  // the question may carry images; every round sees them
  const question = typeof q === 'string' ? q : (q.find(p => p.type === 'text') || {}).text || '';
  const images = typeof q === 'string' ? [] : q.filter(p => p.type === 'image_url');
  const withImages = text => images.length ? [{ type: 'text', text }, ...images] : text;
  const opts = { attachments };
  const rounds = cfg.debate.rounds || 2;
  const names = ids.map(providerName);
  const st = { participants: names, rounds: [], moderator: providerName(pickModerator(ids)), phase: 'answering', consensus: '' };
  let last = 0;
  const push = force => { const now = Date.now(); if (force || now - last > 120) { last = now; emit(JSON.parse(JSON.stringify(st))); } };
  const ctx = context ? [{ role: 'system', content: context }] : [];

  for (let r = 0; r < rounds; r++) {
    st.phase = r === 0 ? 'answering' : 'reviewing';
    const prev = st.rounds[r - 1];
    const entries = ids.map((id, i) => ({ speaker: names[i], text: '', status: 'writing' }));
    st.rounds.push(entries);
    push(true);
    await Promise.all(ids.map(async (id, i) => {
      const others = names.filter((_, j) => j !== i).join(' and ');
      const sys = r === 0
        ? `You are ${names[i]}, one of several AI assistants (the others are ${others}) answering the same question independently. Give your best, well-reasoned answer. Be concise.`
        : `You are ${names[i]}, in round ${r + 1} of a discussion with ${others}. Review the other answers critically and honestly: point out mistakes or missing points, say where you agree, and change your mind if they convinced you. Then give your revised answer.`;
      let user = withImages(question);
      if (r > 0) {
        user = `The question was:\n\n${question}\n\nAnswers from the previous round:\n\n` +
          prev.map(e => `### ${e.speaker}\n${e.error ? '(did not answer)' : e.text}`).join('\n\n') +
          `\n\nReply in this format:\n**Review:** a few short bullet points on the other answers.\n**Revised answer:** your best answer now.`;
        user = withImages(user);
      }
      try {
        await complete(id, [...ctx, { role: 'system', content: sys }, ...history, { role: 'user', content: user }], {
          ...opts, signal, onText: (_, full) => { entries[i].text = full; push(); },
        });
        entries[i].status = 'done';
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        entries[i].status = 'error'; entries[i].error = e.message;
      }
      push(true);
    }));
    if (!entries.some(e => e.status === 'done')) throw new Error('None of the models answered: ' + entries.map(e => `${e.speaker}: ${e.error}`).join('; '));
  }

  st.phase = 'consensus';
  push(true);
  const mod = pickModerator(ids);
  const transcript = st.rounds.map((round, r) => `## Round ${r + 1}\n\n` + round.map(e => `### ${e.speaker}\n${e.error ? '(did not answer)' : e.text}`).join('\n\n')).join('\n\n');
  const modPrompt = `The user asked:\n\n${question}\n\n${names.join(', ')} discussed it:\n\n${transcript}\n\n` +
    `Write the final answer for the user, based on where the discussion landed. Start directly with the answer (no preamble about the debate). ` +
    `If they still disagree on something that matters, end with a short "**Where they disagreed**" section naming who thought what. Keep it as short as the question allows.`;
  st.consensus = await complete(mod, [...ctx, { role: 'system', content: 'You are the moderator of a discussion between AI assistants. Combine their final positions into one accurate answer.' }, ...history, { role: 'user', content: withImages(modPrompt) }], {
    ...opts,
    signal, onText: (_, full) => { st.consensus = full; push(); },
  });
  st.phase = 'done';
  push(true);
  return st;
}
function pickModerator(ids) {
  const m = cfg.debate.moderator;
  return ids.includes(m) ? m : ids[0];
}

module.exports = { autoTitlesOn: () => cfg.autoTitles !== false, init, publicConfig, updateConfig, listModels, complete, runDebate, providerName, configured, isDebateEnabled: () => !!cfg.debateEnabled };
