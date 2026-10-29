'use strict';
/* Roundtable — front end */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/* ---------------- icons (stroke, 24 grid) ---------------- */
const P = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  panel: P('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  search: P('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  settings: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  chevron: P('<path d="m6 9 6 6 6-6"/>'),
  folder: P('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>'),
  folderPlus: P('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M12 11v5M9.5 13.5h5"/>'),
  star: P('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>'),
  dots: P('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>'),
  edit: P('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  copy: P('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  check: P('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  arrowUp: P('<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>'),
  arrowDown: P('<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/>'),
  stop: '<svg viewBox="0 0 12 12" width="12" height="12"><rect width="12" height="12" rx="2.5" fill="currentColor"/></svg>',
  shield: P('<path d="M12 3 5 6v5.5c0 4.3 3 7.8 7 9.5 4-1.7 7-5.2 7-9.5V6z"/>'),
  terminal: P('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M12.5 15H17"/>'),
  file: P('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  pen: P('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 15l4.5-4.5 1.5 1.5L10.5 16.5H9z"/>'),
  globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
  list: P('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>'),
  bot: P('<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1M15 13v1"/>'),
  tool: P('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
  spinner: P('<path d="M12 3a9 9 0 1 0 9 9" />'),
  alert: P('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  code: P('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  bug: P('<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8v12M7 13H3M21 13h-4M8 5l1.5 2M16 5l-1.5 2M4 8l3 2M20 8l-3 2M4 19l3-2M20 19l-3-2"/>'),
  book: P('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
  flask: P('<path d="M9 3h6M10 3v6L4.5 18.5A1.8 1.8 0 0 0 6 21h12a1.8 1.8 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>'),
  link: P('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  up: P('<path d="m6 15 6-6 6 6"/>'),
  chat: P('<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17h0A2.5 2.5 0 0 1 4 14.5z"/>'),
  clip: P('<path d="M20.5 11.5 12.4 19.6a5.2 5.2 0 0 1-7.4-7.4l8.5-8.5a3.5 3.5 0 0 1 4.9 4.9l-8.5 8.5a1.7 1.7 0 0 1-2.5-2.5l7.8-7.8"/>'),
  box: P('<path d="M12 3 3.5 7.5 12 12l8.5-4.5z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>'),
  upload: P('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/>'),
  download: P('<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/>'),
  note: P('<path d="M6 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v5h5M8.5 13h7M8.5 17h5"/>'),
  brain: P('<path d="M9.5 4A3 3 0 0 0 6.6 6.3 3 3 0 0 0 4.5 11a3 3 0 0 0 .9 4.8A3.2 3.2 0 0 0 9.5 20H12V4z"/><path d="M14.5 4a3 3 0 0 1 2.9 2.3A3 3 0 0 1 19.5 11a3 3 0 0 1-.9 4.8A3.2 3.2 0 0 1 14.5 20H12"/>'),
  move: P('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M10 13.5h6M13.5 11l2.5 2.5-2.5 2.5"/>'),
};
function applyIcons(root = document) { $$('[data-i]', root).forEach(el => { if (!el.firstChild) el.innerHTML = I[el.dataset.i] || ''; }); }

/* ---------------- state ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('ccui.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ccui.' + k, JSON.stringify(v)); } catch {} },
};
const S = {
  info: null, sessions: [], projects: [], runs: [], loaded: false, app: null, ai: null, sync: null,
  filterProject: null, query: '', searchHits: null, showAllProjects: false,
  view: null, viewToken: 0,
  settings: Object.assign({ theme: 'system', name: '', model: '', perm: 'acceptEdits', cwd: '' }, store.get('settings', {})),
  allowed: store.get('allowed', {}),
};
if (S.settings.model !== 'debate' && !/^(claude|model):/.test(S.settings.model || '')) S.settings.model = 'claude:' + (S.settings.model || '');
const saveSettings = () => store.set('settings', S.settings);

async function api(url, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {} };
  if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { code: j.code, cwd: j.cwd });
  return j;
}

/* ---------------- helpers ---------------- */
function homeify(p) {
  if (!p) return '';
  const h = S.info && S.info.home;
  if (h && (p === h || p.startsWith(h + '/') || p.startsWith(h + '\\'))) return '~' + p.slice(h.length);
  return p;
}
const baseName = p => (p || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p || '';
function relPath(p) {
  const cwd = S.view && S.view.cwd;
  if (!p || typeof p !== 'string') return p || '';
  if (cwd && p.startsWith(cwd) && p.length > cwd.length) return p.slice(cwd.length).replace(/^[\\/]/, '');
  return homeify(p);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
}
function displayName() {
  const n = S.settings.name || (S.info && S.info.user) || '';
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : 'there';
}
function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${displayName()}`;
}
function fmtDuration(ms) {
  if (ms == null) return '';
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
function bucket(iso) {
  const d = new Date(iso), now = new Date(), day = 864e5;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), t = d.getTime();
  if (t >= start) return 'Today';
  if (t >= start - day) return 'Yesterday';
  if (t >= start - 6 * day) return 'Previous 7 days';
  if (t >= start - 29 * day) return 'Previous 30 days';
  return d.toLocaleString(undefined, { month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
function resultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(b => b && b.type === 'text' ? b.text : b && b.type === 'image' ? '[image]' : '').join('\n');
  return content == null ? '' : JSON.stringify(content, null, 2);
}

/* ---------------- theme ---------------- */
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

/* ---------------- sidebar ---------------- */
async function refreshSessions() {
  try { const { sessions, projects } = await api('/api/sessions'); S.sessions = sessions; S.projects = projects || []; S.loaded = true; }
  catch (e) { toast('Could not load chats: ' + e.message); }
  renderSidebar();
  if (S.view && S.view.mode === 'project' && !S.view.loading) renderProjectPage();
  if (S.view && S.view.id) {
    const s = S.sessions.find(x => x.id === S.view.id);
    if (s) { S.view.title = s.title; S.view.pinned = s.pinned; S.view.projectId = s.projectId; renderHeader(); }
  }
}

async function refreshRuns() {
  try {
    const { runs } = await api('/api/runs');
    const before = S.runs.map(r => r.id).sort().join();
    S.runs = runs;
    if (runs.map(r => r.id).sort().join() !== before) { await refreshSessions(); return true; }
  } catch {}
  return false;
}

function chatItem(s, running) {
  const el = document.createElement('div');
  el.className = 'sb-chat' + (S.view && S.view.id === s.id ? ' active' : '');
  el.dataset.id = s.id;
  el.title = `${s.title}\n${homeify(s.cwd)}`;
  const icon = running ? `<span class="running-dot">${I.spinner}</span>` : chatIcon(s);
  el.innerHTML = `${icon}<span class="t">${esc(s.title)}</span><span class="proj-tag">${esc(projectName(s.projectId) || s.speaker || baseName(s.cwd))}</span><button class="more" title="More">${I.dots}</button>`;
  el.addEventListener('click', e => {
    if (e.target.closest('.more')) return;
    if (e.ctrlKey || e.metaKey) return openInNewWindow(`#/c/${s.id}`);
    go(s.id);
  });
  el.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); openInNewWindow(`#/c/${s.id}`); } });
  el.querySelector('.more').addEventListener('click', e => { e.stopPropagation(); chatMenu(s, e.currentTarget); });
  el.addEventListener('contextmenu', e => { e.preventDefault(); chatMenu(s, { x: e.clientX, y: e.clientY }); });
  return el;
}

function renderSidebar() {
  const q = S.query.trim().toLowerCase();
  const running = new Set(S.runs.map(r => r.sessionId).filter(Boolean));
  let list = S.sessions;
  if (S.filterImported) list = list.filter(s => s.imported);
  if (q) list = list.filter(s => s.title.toLowerCase().includes(q) || (s.cwd || '').toLowerCase().includes(q) || (S.searchHits && S.searchHits.has(s.id)));

  // projects
  const projSec = $('#projectsSec'), projList = $('#projectList');
  projSec.hidden = !!q;
  projList.innerHTML = '';
  const projects = S.projects;
  const shown = S.showAllProjects ? projects : projects.slice(0, 6);
  for (const p of shown) {
    const el = document.createElement('div');
    el.className = 'sb-proj' + (S.view && S.view.mode === 'project' && S.view.projectId === p.id ? ' active' : '');
    el.title = p.virtual ? homeify(p.cwd) : `${p.name}\n${homeify(p.cwd)}`;
    el.innerHTML = `${projIcon(p)}<span class="t">${esc(p.name)}</span><span class="count">${p.chatCount || ''}</span>`;
    el.onclick = () => goProject(p.id);
    projList.appendChild(el);
  }
  if (projects.length > 6) {
    const more = document.createElement('button');
    more.className = 'sb-more';
    more.textContent = S.showAllProjects ? 'Show less' : `Show all ${projects.length}`;
    more.onclick = () => { S.showAllProjects = !S.showAllProjects; renderSidebar(); };
    projList.appendChild(more);
  }
  if (!projects.length) projList.innerHTML = `<div class="sb-empty">Create a project to give Claude shared instructions, files and memory.</div>`;
  const fb = $('#filterBar');
  fb.hidden = !S.filterImported;
  if (S.filterImported) {
    fb.innerHTML = `<div class="filter-chip">${avatar('Claude')}<span class="t">Imported from claude.ai · ${S.sessions.filter(s => s.imported).length}</span><button class="icon-btn tiny" title="Show all chats">${I.x}</button></div>`;
    fb.querySelector('button').onclick = () => { S.filterImported = false; renderSidebar(); };
  }

  // starred
  const starred = list.filter(s => s.pinned);
  $('#starredSec').hidden = !starred.length;
  const sl = $('#starredList'); sl.innerHTML = '';
  starred.forEach(s => sl.appendChild(chatItem(s, running.has(s.id))));

  // recents
  const rl = $('#recentList'); rl.innerHTML = '';
  $('#recentsSec .sb-label span').textContent = q ? 'Results' : 'Recents';
  const rest = list.filter(s => !s.pinned);
  // a brand-new chat that's running but not on disk yet
  const pendingNew = S.runs.filter(r => r.sessionId && !S.sessions.some(s => s.id === r.sessionId));
  for (const r of pendingNew) rl.appendChild(chatItem({ id: r.sessionId, title: r.prompt || 'New chat', cwd: r.cwd }, true));
  let lastBucket = null;
  for (const s of rest) {
    const b = q ? null : bucket(s.updated);
    if (b && b !== lastBucket) {
      const g = document.createElement('div'); g.className = 'group-label'; g.textContent = b; rl.appendChild(g); lastBucket = b;
    }
    rl.appendChild(chatItem(s, running.has(s.id)));
  }
  if (!rest.length && !pendingNew.length && !starred.length) {
    rl.innerHTML = `<div class="sb-empty">${!S.loaded ? 'Loading…' : q ? 'No chats match your search.' : 'No Claude Code chats yet. Start one!'}</div>`;
  }
}

// Another window on this chat; in the desktop app it opens as a new app window, in a browser as a tab
function openInNewWindow(hash) {
  window.open(location.origin + location.pathname + location.search + hash, '_blank');
}

const projIcon = p => p.virtual ? I.folder : p.kind === 'chat' ? I.chat : I.box;
// The little picture beside each chat: who you're talking to
function chatIcon(s) {
  if (s.kind === 'debate') return `<span class="ci">${avatar('Debate')}</span>`;
  if (s.kind === 'model') return `<span class="ci">${avatar(s.speaker || 'Model')}</span>`;
  return `<span class="ci"><span class="av cc" title="Claude Code">${I.terminal}</span></span>`;
}

function chatMenu(s, anchor) {
  showMenu(anchor, [
    { icon: 'star', label: s.pinned ? 'Unstar' : 'Star', run: () => setPinned(s.id, !s.pinned) },
    { icon: 'edit', label: 'Rename', run: () => renameDialog(s.id, s.title) },
    { icon: 'link', label: 'Open in new window', run: () => openInNewWindow(`#/c/${s.id}`) },
    { icon: 'move', label: 'Move to project…', run: () => moveDialog(s) },
    { icon: 'box', label: 'Open project', run: () => goProject(s.projectId) },
    { icon: 'terminal', label: 'Copy resume command', run: () => { copyText(`cd "${s.cwd}" && claude --resume ${s.id}`); toast('Copied resume command'); } },
    '-',
    { icon: 'trash', label: 'Delete', danger: true, run: () => deleteDialog(s.id, s.title) },
  ]);
}

async function setPinned(id, pinned) {
  await api(`/api/sessions/${id}`, { method: 'PATCH', body: { pinned } });
  const s = S.sessions.find(x => x.id === id); if (s) s.pinned = pinned;
  if (S.view && S.view.id === id) { S.view.pinned = pinned; renderHeader(); }
  renderSidebar();
}

/* ---------------- menus & modals ---------------- */
function showMenu(anchor, items) {
  const m = $('#menu');
  m.innerHTML = '';
  for (const it of items) {
    if (it === '-') { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button');
    if (it.danger) b.className = 'danger';
    b.innerHTML = `${I[it.icon] || ''}<span>${esc(it.label)}</span>`;
    b.onclick = () => { hideMenu(); it.run(); };
    m.appendChild(b);
  }
  m.hidden = false;
  let x, y;
  if (anchor instanceof Element) { const r = anchor.getBoundingClientRect(); x = r.left; y = r.bottom + 4; anchor.classList.add('open'); m._anchor = anchor; }
  else { x = anchor.x; y = anchor.y; }
  const mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(x, innerWidth - mw - 8)) + 'px';
  m.style.top = (y + mh > innerHeight - 8 ? Math.max(8, y - mh - 40) : y) + 'px';
}
function hideMenu() { const m = $('#menu'); m.hidden = true; if (m._anchor) { m._anchor.classList.remove('open'); m._anchor = null; } }

function modal({ title, body, foot, wide }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close title="Close">${I.x}</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  const close = () => { closeDropdown(); back.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') { if (openDD) return; e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  $$('[data-close]', back).forEach(b => b.addEventListener('click', close));
  $('#modalRoot').appendChild(back);
  applyIcons(back);
  back.querySelectorAll('select').forEach(enhanceSelect);
  return { el: back, close };
}

function renameDialog(id, current) {
  const m = modal({
    title: 'Rename chat',
    body: `<label class="field"><input class="input" id="renameInput" maxlength="200" value="${esc(current)}"></label>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="renameSave">Save</button>`,
  });
  const inp = $('#renameInput', m.el); inp.focus(); inp.select();
  const save = async () => {
    const title = inp.value.trim();
    await api(`/api/sessions/${id}`, { method: 'PATCH', body: { title } });
    m.close(); await refreshSessions();
  };
  $('#renameSave', m.el).onclick = save;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}

function deleteDialog(id, title) {
  const m = modal({
    title: 'Delete chat?',
    body: `<p>“${esc(title)}” will be removed from your Claude Code history. The transcript is moved to <code>${esc(homeify((S.info && S.info.appDir) || '~/.roundtable'))}/trash</code>, so you can recover it by hand if you need to.</p>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn danger" id="delGo">Delete</button>`,
  });
  $('#delGo', m.el).onclick = async () => {
    try { await api(`/api/sessions/${id}`, { method: 'DELETE' }); }
    catch (e) { toast(e.message); return; }
    m.close();
    if (S.view && S.view.id === id) go(null);
    await refreshSessions();
    toast('Chat deleted');
  };
}

/* ---------------- modes: Claude Code, other models, debate ---------------- */
const AV_COLORS = { Claude: '#c96442', ChatGPT: '#3f8f6b', Gemini: '#4a6fd1', DeepSeek: '#3d5fb0', Debate: '#8a6bbf' };
function avatar(name) {
  const color = AV_COLORS[name] || '#8a6bbf';
  return `<span class="av" style="background:${color}">${esc((name || '?').trim()[0].toUpperCase())}</span>`;
}
async function loadAi() {
  try { S.ai = await api('/api/ai'); } catch { S.ai = null; }
  renderComposerState();
}
function modeLabel(mode) {
  if (mode === 'debate') return 'Debate';
  if (mode.startsWith('model:')) {
    const id = mode.slice(6);
    const p = S.ai && (S.ai.available || []).find(x => x.id === id);
    return p ? p.name : ({ openwebui: 'My model', openai: 'ChatGPT', gemini: 'Gemini', deepseek: 'DeepSeek' })[id] || id;
  }
  const m = mode.slice(7);
  return m ? `Claude Code · ${m[0].toUpperCase() + m.slice(1)}` : 'Claude Code';
}
// An existing chat keeps its kind: Claude Code chats can switch Claude models, other chats can't change
function lockedMode() {
  const v = S.view;
  if (!v || !v.id) return null;
  if (v.kind === 'model') return 'model:' + v.provider;
  if (v.kind === 'debate') return 'debate';
  return 'claude';
}
const inChatProject = () => { const v = S.view; if (!v) return false; const p = v.mode === 'project' ? v.project : null; return !!(p && p.kind === 'chat'); };
function currentMode() {
  const lock = lockedMode();
  if (!lock && inChatProject()) {
    const m = S.settings.chatModel || 'model:claude';
    return (m === 'debate' && S.ai && S.ai.debateEnabled) || (S.ai && (S.ai.available || []).some(p => 'model:' + p.id === m)) ? m : 'model:claude';
  }
  if (lock === 'claude') return (S.view.claudeModel && S.view.claudeModel.startsWith('claude:')) ? S.view.claudeModel : (S.settings.model.startsWith('claude:') ? S.settings.model : 'claude:');
  if (lock) return lock;
  const m = S.settings.model || 'claude:';
  if (m === 'debate' && !(S.ai && S.ai.debateEnabled)) return 'claude:';
  if (m.startsWith('model:') && !(S.ai && (S.ai.available || []).some(p => 'model:' + p.id === m))) return 'claude:';
  return m;
}
// The Debate switch next to the message box: same setting as Settings → Debate
async function toggleDebate() {
  const turnOn = currentMode() !== 'debate';
  try {
    if (turnOn && !S.ai.debateEnabled) S.ai = await api('/api/ai', { method: 'PATCH', body: { debateEnabled: true } });
    if (!turnOn) S.ai = await api('/api/ai', { method: 'PATCH', body: { debateEnabled: false } });
  } catch (e) { toast(e.message); return; }
  if (turnOn && (S.ai.debateParticipants || []).length < 2) {
    toast('Debate needs at least two AIs — add a ChatGPT, Gemini or DeepSeek key');
    S.ai = await api('/api/ai', { method: 'PATCH', body: { debateEnabled: false } }).catch(() => S.ai);
    renderComposerState();
    return settingsDialog('ai');
  }
  if (inChatProject()) S.settings.chatModel = turnOn ? 'debate' : 'model:claude';
  else S.settings.model = turnOn ? 'debate' : (S.settings.model === 'debate' ? 'claude:' : S.settings.model);
  saveSettings();
  renderComposerState();
  toast(turnOn ? `Debate on: ${(S.ai.debateParticipants || []).map(p => p.name).join(', ')}` : 'Debate off');
  $('#input').focus();
}

function buildModeOptions() {
  const sel = $('#modelSel');
  const lock = lockedMode();
  const opt = (v, l) => `<option value="${esc(v)}">${esc(l)}</option>`;
  let h = inChatProject() ? '' : `<optgroup label="Claude Code">${opt('claude:', 'Claude Code')}${opt('claude:opus', 'Opus')}${opt('claude:sonnet', 'Sonnet')}${opt('claude:haiku', 'Haiku')}</optgroup>`;
  const avail = (S.ai && S.ai.available) || [];
  if (lock !== 'claude') {
    if (avail.length) h += `<optgroup label="Chat with">${avail.map(p => opt('model:' + p.id, p.name)).join('')}</optgroup>`;
    if (S.ai && S.ai.debateEnabled) h += `<optgroup label="Debate">${opt('debate', 'Debate')}</optgroup>`;
    if (lock && !sel.innerHTML.includes(lock)) h += opt(lock, modeLabel(lock));
  }
  if (lock && lock !== 'claude') h = opt(lock, modeLabel(lock));
  if (sel.dataset.h !== h) { sel.innerHTML = h; sel.dataset.h = h; }
  const mode = currentMode();
  sel.value = mode;
  sel.disabled = !!(lock && lock !== 'claude');
  sel.closest('.pill').title = sel.disabled ? 'This chat always uses ' + modeLabel(mode) : 'Who answers';
  const ico = $('#modeIco');
  const name = mode.startsWith('claude:') ? '' : mode === 'debate' ? 'Debate' : modeLabel(mode);
  ico.innerHTML = name ? avatar(name) : '';
}

function renderDebate(b, t, idx) {
  const el = document.createElement('div');
  const key = `deb:${S.view.id}:${idx}`;
  const open = debOpen.has(key) ? debOpen.get(key) : !!t.live;
  el.className = 'debate' + (open ? ' open' : '');
  const n = (b.rounds || []).length;
  el.innerHTML = `<button class="debate-head" type="button"><span class="avs">${(b.participants || []).map(avatar).join('')}</span>
    <span class="dh-title">${esc((b.participants || []).join(', '))}</span><span class="dh-sub">${n} round${n === 1 ? '' : 's'}</span><span class="chev">${I.chevron}</span></button>`;
  el.firstChild.onclick = () => { debOpen.set(key, !open); el.replaceWith(renderDebate(b, t, idx)); };
  if (open) {
    const body = document.createElement('div'); body.className = 'debate-body';
    (b.rounds || []).forEach((round, r) => {
      body.insertAdjacentHTML('beforeend', `<div class="round-label">Round ${r + 1} · ${r === 0 ? 'First answers' : 'Reviews and revised answers'}</div>`);
      round.forEach(e => {
        const k = `${key}:${r}:${e.speaker}`;
        const eo = debOpen.get(k) || false;
        const row = document.createElement('div');
        row.className = `deb-entry ${e.status}${eo ? ' open' : ''}`;
        const preview = (e.error || e.text || '').replace(/^\s*[-*>#]+\s*/gm, '').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
        const stat = e.status === 'writing' ? `<span class="spin">${I.spinner}</span>` : e.status === 'error' ? `<span class="err">${I.alert}</span>` : `<span class="ok">${I.check}</span>`;
        row.innerHTML = `<button class="de-head" type="button">${avatar(e.speaker)}<span class="de-name">${esc(e.speaker)}</span><span class="de-prev">${esc(e.status === 'writing' && !preview ? 'Thinking…' : preview)}</span>${stat}<span class="chev">${I.chevron}</span></button>`;
        if (eo) row.insertAdjacentHTML('beforeend', e.error ? `<pre class="de-err">${esc(e.error)}</pre>` : `<div class="prose de-body">${window.renderMarkdown(e.text || '')}</div>`);
        row.firstChild.onclick = () => { debOpen.set(k, !eo); debOpen.set(key, true); el.replaceWith(renderDebate(b, t, idx)); };
        body.appendChild(row);
      });
    });
    el.appendChild(body);
  }
  return el;
}
const debOpen = new Map();

/* ---------------- smooth dropdowns (replace the system's select menus) ---------------- */
const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
let openDD = null;
function enhanceSelect(sel) {
  if (!sel || sel.dataset.enhanced) return;
  sel.dataset.enhanced = '1';
  const trig = document.createElement('button');
  trig.type = 'button';
  trig.className = 'dd-trigger ' + (sel.classList.contains('input') ? 'input' : 'inline');
  trig.setAttribute('aria-haspopup', 'listbox');
  sel.after(trig);
  sel.hidden = true;
  const label = () => { const o = sel.options[sel.selectedIndex]; return o ? o.textContent : ''; };
  const refresh = () => {
    trig.innerHTML = `<span class="dd-label">${esc(label())}</span>${sel.classList.contains('input') ? `<span class="dd-chev">${I.chevron}</span>` : ''}`;
    trig.disabled = sel.disabled;
  };
  // keep the button in step when code changes the select's value, options or disabled state
  Object.defineProperty(sel, 'value', { configurable: true, get() { return nativeValue.get.call(this); }, set(v) { nativeValue.set.call(this, v); refresh(); } });
  new MutationObserver(refresh).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  sel._refresh = refresh;
  refresh();
  const opener = sel.closest('.pill') || trig;
  opener.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (!sel.disabled) openDropdown(sel, opener); });
  trig.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openDropdown(sel, opener); } });
}
function openDropdown(sel, anchor) {
  if (openDD && openDD.sel === sel) return closeDropdown();
  closeDropdown();
  const pop = document.createElement('div');
  pop.className = 'dd-pop';
  pop.setAttribute('role', 'listbox');
  const items = [];
  for (const node of sel.children) {
    if (node.tagName === 'OPTGROUP') {
      pop.insertAdjacentHTML('beforeend', `<div class="dd-group">${esc(node.label)}</div>`);
      for (const o of node.children) items.push(o);
      for (const o of node.children) pop.appendChild(ddItem(o, sel));
    } else { items.push(node); pop.appendChild(ddItem(node, sel)); }
  }
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const w = Math.max(r.width, 200);
  pop.style.minWidth = w + 'px';
  const ph = pop.offsetHeight, below = innerHeight - r.bottom - 10, above = r.top - 10;
  const up = ph > below && above > below;
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + 'px';
  if (up) { pop.style.bottom = (innerHeight - r.top + 6) + 'px'; pop.style.maxHeight = above + 'px'; pop.classList.add('up'); }
  else { pop.style.top = (r.bottom + 6) + 'px'; pop.style.maxHeight = below + 'px'; }
  let active = Math.max(0, items.findIndex(o => o.value === sel.value));
  const els = [...pop.querySelectorAll('.dd-item')];
  const mark = () => { els.forEach((el, i) => el.classList.toggle('active', i === active)); els[active] && els[active].scrollIntoView({ block: 'nearest' }); };
  mark();
  const onKey = e => {
    if (e.key === 'ArrowDown') { active = (active + 1) % els.length; mark(); }
    else if (e.key === 'ArrowUp') { active = (active - 1 + els.length) % els.length; mark(); }
    else if (e.key === 'Enter' || e.key === ' ') els[active] && els[active].click();
    else if (e.key === 'Escape' || e.key === 'Tab') closeDropdown();
    else return;
    e.preventDefault(); e.stopPropagation();
  };
  els.forEach((el, i) => el.addEventListener('mousemove', () => { if (active !== i) { active = i; mark(); } }));
  document.addEventListener('keydown', onKey, true);
  openDD = { sel, pop, anchor, onKey };
  anchor.classList.add('dd-open');
  requestAnimationFrame(() => pop.classList.add('show'));
}
function ddItem(o, sel) {
  const el = document.createElement('div');
  el.className = 'dd-item' + (o.value === sel.value ? ' sel' : '') + (o.disabled ? ' disabled' : '');
  el.setAttribute('role', 'option');
  el.innerHTML = `<span class="dd-check">${o.value === sel.value ? I.check : ''}</span><span>${esc(o.textContent)}</span>`;
  el.addEventListener('click', () => {
    if (o.disabled) return;
    const changed = sel.value !== o.value;
    sel.value = o.value;
    closeDropdown();
    if (changed) sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return el;
}
function closeDropdown() {
  if (!openDD) return;
  const { pop, anchor, onKey } = openDD;
  document.removeEventListener('keydown', onKey, true);
  anchor.classList.remove('dd-open');
  pop.classList.remove('show');
  setTimeout(() => pop.remove(), 140);
  openDD = null;
}
document.addEventListener('mousedown', e => { if (openDD && !openDD.pop.contains(e.target) && !openDD.anchor.contains(e.target)) closeDropdown(); });
window.addEventListener('resize', closeDropdown);
window.addEventListener('blur', closeDropdown);

/* ---------------- settings ---------------- */
function settingsDialog(tab = 'general') {
  const st = S.settings;
  const m = modal({
    title: 'Settings',
    wide: true,
    body: `
      <div class="tabs" id="setTabs">${[['general', 'General'], ['ai', 'AI models'], ['debate', 'Debate'], ['sync', 'Sync'], ['import', 'Import']].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="tab" data-pane="general">
        <label class="field"><span>What should Claude call you?</span><input class="input" id="setName" value="${esc(st.name)}" placeholder="${esc((S.info && S.info.user) || '')}"></label>
        <div class="field"><span>Appearance</span><div class="seg" id="setTheme">
          ${['system', 'light', 'dark'].map(t => `<button data-v="${t}" class="${st.theme === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
        </div></div>
        <label class="field"><span>Default folder for new chats</span>
          <div class="input-row"><input class="input mono" id="setCwd" value="${esc(st.cwd)}"><button class="btn" id="setBrowse">Browse</button></div>
        </label>
        <label class="field"><span>Default permissions for Claude Code</span><select class="input" id="setPerm">${$('#permSel').innerHTML}</select></label>
        <label class="switch-row"><span><strong>Name chats automatically</strong><small>After the first reply, Claude writes a short title for the chat, like the Claude apps do. Renaming a chat yourself always wins.</small></span><input type="checkbox" class="switch" id="setAutoTitle"></label>
        <div class="about">
          ${S.app && S.app.desktop ? `App version: <code>${esc(S.app.version || '')}</code> · updates install automatically<br>` : ''}
          Claude Code CLI: <code>${esc((S.info && S.info.version) || 'not found')}</code><br>
          Sessions are read from <code>${esc(homeify(S.info && S.info.projectsDir))}</code><br>
          Keyboard: <code>Enter</code> send · <code>Shift+Enter</code> new line · <code>${isMac ? '⌘' : 'Ctrl'}+K</code> search · <code>${isMac ? '⌘' : 'Ctrl'}+Shift+O</code> new chat · <code>Esc</code> stop
        </div>
      </div>
      <div class="tab" data-pane="ai">
        <p class="hint">Chat with these straight from the message box. Keys are stored only on this computer and aren't synced.</p>
        <section class="prov"><div class="prov-head">${avatar('Claude')}<h3>Claude (chat)</h3><span class="pc-status"><span class="ok">${I.check} Uses your Claude plan</span></span></div>
          <small class="muted-note" style="margin-top:-4px">Plain conversations with Claude, like claude.ai: no tools, no file changes. Runs through Claude Code, so there's no key and no extra cost.</small>
          <label class="field"><span>Model</span><select class="input" id="ccModel"><option value="sonnet">Sonnet</option><option value="opus">Opus</option><option value="haiku">Haiku</option></select></label></section>
        ${providerCard('openwebui', 'Your Open WebUI model', `<label class="field"><span>Name to show</span><input class="input" data-f="label" placeholder="My model"></label>
          <label class="field"><span>Open WebUI address</span><input class="input mono" data-f="url" placeholder="http://homelab:3000"><small>Use its Tailscale name or IP so it works away from home.</small></label>
          <label class="field"><span>API key</span><input class="input mono" data-f="key" placeholder="sk-…" autocomplete="off"><small>In Open WebUI: Settings → Account → API keys. An admin has to turn on API keys first (Admin settings → Authentication).</small></label>`)}
        ${providerCard('openai', 'ChatGPT (OpenAI)', `<label class="field"><span>API key</span><input class="input mono" data-f="key" placeholder="sk-…" autocomplete="off"><small>From <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a>. Billed per use by OpenAI; a ChatGPT Plus subscription doesn't include it.</small></label>`)}
        ${providerCard('gemini', 'Gemini (Google)', `<label class="field"><span>API key</span><input class="input mono" data-f="key" placeholder="AIza…" autocomplete="off"><small>From <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>.</small></label>`)}
        ${providerCard('deepseek', 'DeepSeek', `<label class="field"><span>API key</span><input class="input mono" data-f="key" placeholder="sk-…" autocomplete="off"><small>From <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">platform.deepseek.com</a>. Billed per use by DeepSeek.</small></label>`)}
      </div>
      <div class="tab" data-pane="debate">
        <label class="switch-row"><span><strong>Debate mode</strong><small>Ask several AIs at once. They answer separately, review each other's answers, and a moderator writes the agreed answer.</small></span><input type="checkbox" class="switch" id="debOn"></label>
        <div id="debOpts">
          <div class="field"><span>Who takes part</span><div class="checks" id="debWho"></div><small>ChatGPT, Gemini and DeepSeek need their keys in AI models. Claude uses your Claude Code plan.</small></div>
          <div class="input-row">
            <label class="field" style="flex:1"><span>Rounds</span><select class="input" id="debRounds"><option value="1">1 · answers only</option><option value="2">2 · answer, then review</option><option value="3">3 · two rounds of review</option></select></label>
            <label class="field" style="flex:1"><span>Moderator</span><select class="input" id="debMod"><option value="claude">Claude</option><option value="openai">ChatGPT</option><option value="gemini">Gemini</option><option value="deepseek">DeepSeek</option></select></label>
            <label class="field" style="flex:1"><span>Claude model</span><select class="input" id="debClaude"><option value="sonnet">Sonnet</option><option value="opus">Opus</option><option value="haiku">Haiku</option></select></label>
          </div>
          <small class="muted-note">Each question goes to every model once per round, plus once to the moderator — so a 3-model, 2-round debate is 7 requests. It uses more of your plan and API credit than a normal message.</small>
        </div>
      </div>
      <div class="tab" data-pane="sync"><div id="syncPane"></div></div>
      <div class="tab" data-pane="import">
        <p class="hint">Bring your chats and projects over from claude.ai. Projects come in as <strong>chat projects</strong> with their instructions, knowledge documents and memory; chats come in as Claude chats you can keep going.</p>
        <ol class="steps">
          <li>On <a href="https://claude.ai/settings/data-privacy-controls" target="_blank" rel="noopener">claude.ai</a>, open <strong>Settings → Privacy</strong> and click <strong>Export data</strong>.</li>
          <li>Open the email from Anthropic and download <strong>conversations-000.zip</strong> and <strong>projects-000.zip</strong> (there may be more parts, like -001). The links work for 24 hours.</li>
          <li>Choose those files here — you can select them all at once. Importing again later only adds or updates what changed.</li>
        </ol>
        <div class="row-end"><span class="sy-msg" id="imMsg"></span><input type="file" id="imFile" accept=".zip,.json" multiple hidden><button class="btn accent" id="imGo" type="button">${I.upload} Choose export files…</button></div>
        <small class="muted-note">The export doesn't include the contents of files you attached in chats, so those show by name only. Text you attached is kept.</small>
      </div>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="setSave">Save</button>`,
  });
  const show = k => { $$('#setTabs button', m.el).forEach(b => b.classList.toggle('on', b.dataset.tab === k)); $$('.tab', m.el).forEach(p => { p.hidden = p.dataset.pane !== k; }); };
  $$('#setTabs button', m.el).forEach(b => b.onclick = () => show(b.dataset.tab));
  show(tab);

  // general
  $('#setPerm', m.el).value = st.perm;
  let theme = st.theme;
  $$('#setTheme button', m.el).forEach(b => b.onclick = () => {
    theme = b.dataset.v; $$('#setTheme button', m.el).forEach(x => x.classList.toggle('on', x === b));
    S.settings.theme = theme; applyTheme();
  });
  $('#setBrowse', m.el).onclick = () => folderPicker($('#setCwd', m.el).value, p => { $('#setCwd', m.el).value = p; });
  const origTheme = st.theme;
  $$('[data-close]', m.el).forEach(b => b.addEventListener('click', () => { S.settings.theme = origTheme; applyTheme(); }));

  // AI + debate
  const a = S.ai || { openwebui: {}, openai: {}, gemini: {}, deepseek: {}, debate: { participants: [], rounds: 2, moderator: 'claude', claudeModel: 'sonnet' } };
  for (const id of ['openwebui', 'openai', 'gemini', 'deepseek']) {
    const card = $(`[data-prov="${id}"]`, m.el);
    $$('[data-f]', card).forEach(i => { i.value = (a[id] && a[id][i.dataset.f]) || ''; });
    const msel = $('[data-f="model"]', card);
    if (a[id] && a[id].model) msel.innerHTML = `<option>${esc(a[id].model)}</option>`;
    $('[data-load]', card).onclick = async () => {
      const btn = $('[data-load]', card); btn.disabled = true; btn.textContent = 'Checking…';
      const body = { provider: id };
      $$('[data-f]', card).forEach(i => { if (i.dataset.f !== 'model') body[i.dataset.f] = i.value.trim(); });
      try {
        const r = await api('/api/ai/models', { method: 'POST', body });
        const cur = msel.value;
        msel.innerHTML = r.models.map(x => `<option value="${esc(x.id)}">${esc(x.name ? `${x.name} (${x.id})` : x.id)}</option>`).join('');
        msel.value = r.models.some(x => x.id === cur) ? cur : r.suggested;
        $('.pc-status', card).innerHTML = `<span class="ok">${I.check} Connected · ${r.models.length} model${r.models.length === 1 ? '' : 's'}</span>`;
      } catch (e) { $('.pc-status', card).innerHTML = `<span class="err">${esc(e.message)}</span>`; }
      btn.disabled = false; btn.textContent = 'Connect';
    };
    $('[data-clear]', card).onclick = () => { $$('[data-f]', card).forEach(i => { if (i.dataset.f !== 'label') i.value = ''; }); msel.innerHTML = ''; $('.pc-status', card).textContent = 'Will be removed when you save'; };
  }
  $('#debOn', m.el).checked = !!a.debateEnabled;
  $('#setAutoTitle', m.el).checked = a.autoTitles !== false;
  $('#ccModel', m.el).value = (a.claudeChat && a.claudeChat.model) || 'sonnet';
  const who = a.debate.participants || [];
  $('#debWho', m.el).innerHTML = [['claude', 'Claude'], ['openai', 'ChatGPT'], ['gemini', 'Gemini'], ['deepseek', 'DeepSeek']].map(([k, l]) => `<label class="check"><input type="checkbox" value="${k}" ${who.includes(k) ? 'checked' : ''}> ${l}</label>`).join('');
  $('#debRounds', m.el).value = String(a.debate.rounds || 2);
  $('#debMod', m.el).value = a.debate.moderator || 'claude';
  $('#debClaude', m.el).value = a.debate.claudeModel || 'sonnet';
  const syncDeb = () => { $('#debOpts', m.el).classList.toggle('disabled', !$('#debOn', m.el).checked); };
  $('#debOn', m.el).onchange = syncDeb; syncDeb();

  renderSyncPane($('#syncPane', m.el));
  $('#imGo', m.el).onclick = () => $('#imFile', m.el).click();
  $('#imFile', m.el).onchange = async e => {
    // projects first, so chats can join them
    const picked = [...e.target.files].sort((a, b) => /project/i.test(b.name) - /project/i.test(a.name)); e.target.value = '';
    if (!picked.length) return;
    const btn = $('#imGo', m.el), msg = $('#imMsg', m.el);
    btn.disabled = true; msg.className = 'sy-msg info';
    try {
      const j = { projects: 0, projectsUpdated: 0, chats: 0, chatsUpdated: 0, documents: 0, alreadyHere: 0, empty: 0, found: { conversations: 0, projects: 0 }, files: [] };
      const skippedFiles = [];
      for (const f of picked) {
        msg.textContent = `Importing ${f.name}…`;
        const r = await fetch('/api/import/claude', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: f });
        const one = await r.json();
        if (!r.ok) {
          // other parts of the export (artifacts, frames…) simply have nothing to import
          if (picked.length > 1 && /No chats or projects found/.test(one.error || '')) { skippedFiles.push(f.name); continue; }
          throw new Error(one.error || 'Import failed');
        }
        for (const k of ['projects', 'projectsUpdated', 'chats', 'chatsUpdated', 'documents', 'alreadyHere', 'empty']) j[k] += one[k] || 0;
        j.found.conversations += (one.found || {}).conversations || 0; j.found.projects += (one.found || {}).projects || 0;
      }
      const n = (x, w) => `${x} ${w}${x === 1 ? '' : 's'}`;
      const found = j.found || {};
      await refreshSessions();
      if (!found.conversations && !found.projects) {
        msg.className = 'sy-msg';
        msg.innerHTML = `No chats or projects found in that file. ${j.files && j.files.length ? `It contains: <code>${esc(j.files.join(', '))}</code>. ` : ''}Make sure it's the export from claude.ai — and send me this message if it is.`;
      } else {
        const parts = [j.chats && `added ${n(j.chats, 'chat')}`, j.projects && `added ${n(j.projects, 'project')}`, (j.chatsUpdated + j.projectsUpdated) && `updated ${j.chatsUpdated + j.projectsUpdated}`].filter(Boolean);
        msg.className = 'sy-msg ok';
        msg.innerHTML = `Found ${n(found.conversations, 'chat')} and ${n(found.projects, 'project')} in ${picked.length > 1 ? 'the files' : 'the file'}. ${parts.length ? esc(parts.join(', ')) + '.' : 'All of them were already here.'}${j.alreadyHere && parts.length ? ` ${j.alreadyHere} were already here.` : ''}${j.empty ? ` ${n(j.empty, 'empty chat')} skipped.` : ''}${skippedFiles.length ? ` (${esc(skippedFiles.join(', '))} had nothing to import.)` : ''}
          ${S.sessions.some(s => s.imported) ? `<button class="pp-link" id="imShow" type="button">Show imported chats</button>` : ''}`;
        const sb = $('#imShow', m.el);
        if (sb) sb.onclick = () => { m.close(); S.filterImported = true; renderSidebar(); $('#sbScroll').scrollTop = 0; };
      }
    } catch (err) { msg.className = 'sy-msg'; msg.textContent = err.message; }
    btn.disabled = false;
  };

  $('#setSave', m.el).onclick = async () => {
    Object.assign(S.settings, { name: $('#setName', m.el).value.trim(), theme, cwd: $('#setCwd', m.el).value.trim(), perm: $('#setPerm', m.el).value });
    saveSettings();
    const body = { claudeChat: { model: $('#ccModel', m.el).value }, autoTitles: $('#setAutoTitle', m.el).checked, debateEnabled: $('#debOn', m.el).checked, debate: {
      participants: $$('#debWho input:checked', m.el).map(i => i.value), rounds: +$('#debRounds', m.el).value,
      moderator: $('#debMod', m.el).value, claudeModel: $('#debClaude', m.el).value } };
    for (const id of ['openwebui', 'openai', 'gemini', 'deepseek']) {
      const card = $(`[data-prov="${id}"]`, m.el); body[id] = {};
      $$('[data-f]', card).forEach(i => { body[id][i.dataset.f] = i.value.trim(); });
    }
    try { S.ai = await api('/api/ai', { method: 'PATCH', body }); } catch (e) { toast(e.message); return; }
    if (body.debateEnabled && (S.ai.debateParticipants || []).length < 2) toast('Debate needs at least two models with keys — add ChatGPT, Gemini or DeepSeek');
    m.close();
    $('#permSel').value = S.settings.perm;
    updateProfile(); renderComposerState(); $('#greeting').textContent = greeting();
    if (S.view && !S.view.id && !S.view.turns.length) { S.view.cwd = S.settings.cwd || S.view.cwd; renderComposerState(); }
  };
}
function providerCard(id, title, fields) {
  return `<section class="prov" data-prov="${id}"><div class="prov-head">${avatar(({ openai: 'ChatGPT', gemini: 'Gemini', deepseek: 'DeepSeek' })[id] || 'My model')}<h3>${esc(title)}</h3><span class="pc-status"></span></div>
    ${fields}
    <div class="input-row"><label class="field" style="flex:1"><span>Model</span><select class="input" data-f="model"></select></label>
      <button class="btn" data-load type="button" style="align-self:flex-end">Connect</button><button class="btn" data-clear type="button" style="align-self:flex-end" title="Remove">${I.trash}</button></div></section>`;
}

function folderPicker(start, onPick) {
  const m = modal({
    title: 'Choose a folder',
    wide: true,
    body: `
      <div class="picker-path"><button class="icon-btn" id="pkUp" title="Up one level">${I.up}</button><input class="input" id="pkPath" spellcheck="false"></div>
      <div class="picker-list" id="pkList"></div>
      <div class="field"><span>Recent project folders</span><div class="picker-recents" id="pkRecent"></div></div>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="pkUse">Use this folder</button>`,
  });
  const pathIn = $('#pkPath', m.el), listEl = $('#pkList', m.el);
  let cur = null, parent = null;
  async function load(p) {
    try {
      const d = await api('/api/fs?path=' + encodeURIComponent(p || ''));
      cur = d.path; parent = d.parent; pathIn.value = d.path;
      listEl.innerHTML = d.dirs.length ? '' : `<div class="sb-empty">No subfolders</div>`;
      for (const name of d.dirs) {
        const b = document.createElement('button');
        b.innerHTML = `${I.folder}<span>${esc(name)}</span>`;
        b.onclick = () => load(cur.replace(/[\\/]+$/, '') + (S.info.sep || '/') + name);
        listEl.appendChild(b);
      }
      listEl.scrollTop = 0;
    } catch (e) { toast(e.message); }
  }
  $('#pkUp', m.el).onclick = () => parent && load(parent);
  pathIn.addEventListener('keydown', e => { if (e.key === 'Enter') load(pathIn.value); });
  const recents = [...new Set(S.sessions.map(s => s.cwd))].slice(0, 8);
  $('#pkRecent', m.el).innerHTML = recents.map(r => `<button data-p="${esc(r)}" title="${esc(r)}">${esc(homeify(r))}</button>`).join('') || '<span class="sb-empty" style="padding:0">None yet</span>';
  $$('#pkRecent button', m.el).forEach(b => b.onclick = () => { onPick(b.dataset.p); m.close(); });
  $('#pkUse', m.el).onclick = () => { onPick(cur || pathIn.value); m.close(); };
  load(start || (S.info && S.info.home));
}

/* ---------------- routing / views ---------------- */
function go(id) {
  const target = id ? `#/c/${id}` : '#/';
  if (location.hash === target) route(); else location.hash = target;
  closeMobileSidebar();
}
function goProject(id) {
  if (!id) return;
  const target = `#/p/${id}`;
  if (location.hash === target) route(); else location.hash = target;
  closeMobileSidebar();
}
function route() {
  const m = location.hash.match(/^#\/c\/([\w-]+)/);
  const pm = location.hash.match(/^#\/p\/([\w-]+)/);
  if (m) { if (!S.view || S.view.id !== m[1]) openSession(m[1]); }
  else if (pm) openProject(pm[1]);
  else newChat();
}
const projectById = id => S.projects.find(p => p.id === id);
const projectName = id => { const p = projectById(id); return p ? p.name : ''; };

function newChat(cwd) {
  S.viewToken++;
  S.view = { mode: 'chat', id: null, cwd: cwd || S.settings.cwd || (S.info && S.info.defaultCwd) || '', title: 'New chat', turns: [], runId: null, live: null, pinned: false };
  if (location.hash !== '#/' && location.hash !== '') history.pushState(null, '', '#/');
  renderAll();
  closeMobileSidebar();
  $('#input').focus();
}

async function openSession(id) {
  const token = ++S.viewToken;
  const s = S.sessions.find(x => x.id === id);
  S.view = { mode: 'chat', id, cwd: s ? s.cwd : '', title: s ? s.title : 'Loading…', turns: [], runId: null, live: null, pinned: s ? s.pinned : false, projectId: s ? s.projectId : null, kind: s ? s.kind : null, provider: s ? s.provider : null, loading: true };
  renderAll();
  let d;
  try { d = await api(`/api/sessions/${id}`); }
  catch (e) {
    if (token !== S.viewToken) return;
    // might be a brand new run whose file isn't written yet
    const run = S.runs.find(r => r.sessionId === id);
    if (run) { S.view.loading = false; S.view.cwd = run.cwd; renderAll(); attach(run.id, token); return; }
    toast(e.message); go(null); return;
  }
  if (token !== S.viewToken) return;
  Object.assign(S.view, { cwd: d.session.cwd, title: d.session.title, pinned: d.session.pinned, projectId: d.session.projectId, kind: d.session.kind || 'claude', provider: d.session.provider || null, turns: d.turns, loading: false });
  renderAll();
  scrollToBottom(true);
  if (d.run) attach(d.run.id, token);
}

/* ---------------- streaming ---------------- */
async function attach(runId, token) {
  const v = S.view;
  v.runId = runId; v.live = null; v.stderr = '';
  renderComposerState();
  let res;
  try { res = await fetch(`/api/runs/${runId}/events`); }
  catch (e) { v.runId = null; renderComposerState(); toast('Lost connection to the server'); return; }
  if (!res.ok) { v.runId = null; renderComposerState(); return; }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    let chunk;
    try { chunk = await reader.read(); } catch { break; }
    if (token !== S.viewToken) { reader.cancel().catch(() => {}); return; }
    if (chunk.done) break;
    buf += dec.decode(chunk.value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      try { handleEvent(JSON.parse(line)); } catch (e) { console.error(e); }
    }
    scheduleRender();
  }
  if (token !== S.viewToken) return;
  v.runId = null;
  scheduleRender();
  renderComposerState();
  refreshRuns().then(changed => { if (!changed) refreshSessions(); });
  setTimeout(refreshSessions, 6000); setTimeout(refreshSessions, 15000); // automatic titles arrive a few seconds later
  loadUsage();
}

function liveTurn() {
  const v = S.view;
  if (!v.live) { v.live = { role: 'assistant', blocks: [], live: true, startedAt: Date.now() }; v.turns.push(v.live); }
  markDirty(v.turns.indexOf(v.live));
  return v.live;
}
function findTool(id) {
  for (let i = S.view.turns.length - 1; i >= 0; i--) {
    const t = S.view.turns[i];
    if (t.role !== 'assistant') continue;
    const b = t.blocks.find(x => x.type === 'tool' && x.id === id);
    if (b) { markDirty(i); return b; }
  }
  return null;
}

function handleEvent(ev) {
  const v = S.view;
  switch (ev.kind) {
    case 'user': {
      v.turns.push({ role: 'user', text: ev.text, attachments: ev.attachments });
      markDirty(v.turns.length - 1);
      v.live = null;
      liveTurn().startedAt = ev.t;
      break;
    }
    case 'claude': handleClaude(ev.data); break;
    case 'start': {
      if (ev.appChat && !v.kind) { v.kind = ev.appChat.kind; v.provider = ev.appChat.provider; }
      break;
    }
    case 'snapshot': {
      const t = liveTurn();
      t.blocks = ev.turn.blocks || [];
      t.speaker = ev.turn.speaker;
      t.errorText = ev.turn.errorText;
      if (ev.turn.result) t.result = ev.turn.result;
      break;
    }
    case 'stderr': v.stderr = ((v.stderr || '') + ev.text).slice(-4000); break;
    case 'error': v.turns.push({ role: 'notice', kind: 'error', text: ev.text }); markDirty(v.turns.length - 1); break;
    case 'exit': {
      const t = v.live;
      markDirty(Math.max(0, t ? v.turns.indexOf(t) - 1 : v.turns.length - 1));
      if (t) {
        t.live = false;
        t.blocks = t.blocks.filter(b => !(b.draft && !b.text));
        t.blocks.forEach(b => { b.draft = false; if (b.type === 'tool' && b.status === 'running') b.status = ev.stopped ? 'error' : 'done'; });
        if (!t.blocks.length && !t.result && !t.denials && !t.errorText) v.turns.splice(v.turns.indexOf(t), 1);
      }
      if (ev.stopped) v.turns.push({ role: 'notice', text: 'Stopped' });
      else if (ev.code && !(t && (t.result || t.errorText))) {
        const tail = (v.stderr || '').trim().split('\n').slice(-8).join('\n');
        if (!v.turns.some(x => x.role === 'notice' && x.kind === 'error' && x.fromRun === true))
          v.turns.push({ role: 'notice', kind: 'error', fromRun: true, text: `Claude Code exited with code ${ev.code}.`, detail: tail });
      }
      v.live = null;
      break;
    }
  }
}

function handleClaude(o) {
  const v = S.view;
  if (o.type === 'system' && o.subtype === 'init') {
    if (o.session_id && v.id !== o.session_id) {
      const wasNew = !v.id;
      v.id = o.session_id;
      if (S.allowed.new) { S.allowed[v.id] = S.allowed.new; delete S.allowed.new; store.set('allowed', S.allowed); }
      if (wasNew) { history.replaceState(null, '', `#/c/${v.id}`); refreshRuns(); renderHeader(); }
    }
    return;
  }
  // Sub-agent activity: count it on the parent Task tool instead of flooding the thread
  if (o.parent_tool_use_id) {
    const parent = findTool(o.parent_tool_use_id);
    if (parent && o.type === 'assistant') {
      for (const b of (o.message && o.message.content) || []) if (b.type === 'tool_use') { parent.subCount = (parent.subCount || 0) + 1; parent.subLast = `${b.name} ${toolSummary(b.name, b.input) || ''}`.trim(); }
    }
    return;
  }
  const t = liveTurn();
  if (o.type === 'stream_event') {
    const e = o.event || {};
    if (e.type === 'message_start') t.msgId = e.message && e.message.id;
    else if (e.type === 'content_block_start') {
      const cb = e.content_block || {};
      if (cb.type === 'text' || cb.type === 'thinking') t.blocks.push({ type: cb.type, text: '', draft: true, msgId: t.msgId, index: e.index });
    } else if (e.type === 'content_block_delta') {
      const d = e.delta || {};
      const b = t.blocks.find(x => x.draft && x.msgId === t.msgId && x.index === e.index);
      if (b) { if (d.type === 'text_delta') b.text += d.text || ''; else if (d.type === 'thinking_delta') b.text += d.thinking || ''; }
    }
    return;
  }
  if (o.type === 'assistant') {
    const m = o.message || {};
    for (const b of m.content || []) {
      if (b.type === 'text' || b.type === 'thinking') {
        const txt = b.type === 'text' ? b.text : b.thinking;
        if (!txt || !txt.trim()) continue;
        const draft = t.blocks.find(x => x.draft && x.type === b.type && x.msgId === m.id);
        if (draft) { draft.text = txt; draft.draft = false; }
        else if (!t.blocks.some(x => x.type === b.type && x.msgId === m.id && x.text === txt)) t.blocks.push({ type: b.type, text: txt, msgId: m.id });
      } else if (b.type === 'tool_use') {
        if (!t.blocks.some(x => x.id === b.id)) t.blocks.push({ type: 'tool', id: b.id, name: b.name, input: b.input, status: 'running', open: b.name === 'TodoWrite' });
      }
    }
    return;
  }
  if (o.type === 'user') {
    const c = o.message && o.message.content;
    if (Array.isArray(c)) for (const b of c) {
      if (b.type !== 'tool_result') continue;
      const tb = findTool(b.tool_use_id);
      if (tb) { tb.result = resultText(b.content); tb.isError = !!b.is_error; tb.status = b.is_error ? 'error' : 'done'; }
    }
    return;
  }
  if (o.type === 'result') {
    t.result = { ms: o.duration_ms, cost: o.total_cost_usd, turns: o.num_turns, isError: o.is_error, subtype: o.subtype };
    const den = (o.permission_denials || []).map(d => d.tool_name).filter(Boolean);
    if (den.length) t.denials = [...new Set(den)];
    if (o.is_error && typeof o.result === 'string' && o.result.trim() && !t.blocks.some(b => b.type === 'text' && b.text === o.result)) t.errorText = o.result;
    else if (o.subtype && o.subtype.startsWith('error') && !o.result) t.errorText = o.subtype === 'error_max_turns' ? 'Stopped: reached the maximum number of turns.' : 'Claude Code reported an error.';
  }
}

/* ---------------- thread rendering ---------------- */
let dirtyFrom = Infinity, rafPending = false;
function markDirty(i) { if (i >= 0 && i < dirtyFrom) dirtyFrom = i; }
function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; renderThreadFrom(dirtyFrom); dirtyFrom = Infinity; });
}

function nearBottom() { const sc = $('#scroller'); return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140; }
function scrollToBottom(force) { const sc = $('#scroller'); if (force || nearBottom()) sc.scrollTop = sc.scrollHeight; }

function renderThreadFrom(from) {
  const v = S.view, th = $('#thread');
  if (!v) return;
  if (!isFinite(from)) return;
  const stick = nearBottom();
  while (th.children.length > from) th.lastChild.remove();
  for (let i = from; i < v.turns.length; i++) th.appendChild(renderTurn(v.turns[i], i));
  if (v.loading) th.innerHTML = '<div class="skeleton" style="width:60%;margin-left:auto"></div><div class="skeleton"></div><div class="skeleton" style="width:85%"></div><div class="skeleton" style="width:70%"></div>';
  if (stick) scrollToBottom(true);
  updateEmpty();
}
function renderThread() { $('#thread').innerHTML = ''; renderThreadFrom(0); }

function renderTurn(t, idx) {
  const el = document.createElement('div');
  el.className = 'turn ' + t.role;
  el.dataset.idx = idx;
  if (t.role === 'user') {
    const long = (t.text || '').length > 1200 && !t.expanded;
    const atts = (t.attachments || []).map(a => a.image && a.url
      ? `<a class="att-thumb" href="${esc(a.url)}" target="_blank" rel="noopener" title="${esc(a.name)}"><img src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy"></a>`
      : `<span class="att-file" title="${esc(a.name)}">${I.file}<span>${esc(a.name)}</span></span>`).join('');
    el.innerHTML = `${atts ? `<div class="att-list">${atts}</div>` : ''}${t.text ? `<div class="bubble ${long ? 'long' : ''}">${esc(t.text)}${t.images ? `<span class="img-note">📎 ${t.images} image${t.images > 1 ? 's' : ''}</span>` : ''}</div>` : ''}`;
    if (long) el.querySelector('.bubble').onclick = () => { t.expanded = true; el.replaceWith(renderTurn(t, idx)); };
    return el;
  }
  if (t.role === 'notice') {
    if (t.kind === 'error') {
      el.innerHTML = `<div class="notice-card error"><div class="title">${I.alert}<span>${esc(t.text)}</span></div>${t.detail ? `<pre>${esc(t.detail)}</pre>` : ''}</div>`;
    } else el.innerHTML = `<span class="notice-pill">${esc(t.text)}</span>`;
    return el;
  }
  // assistant
  const wrap = document.createElement('div');
  if (t.speaker) wrap.insertAdjacentHTML('beforeend', `<div class="speaker">${avatar(t.speaker)}<span>${esc(t.speaker)}</span></div>`);
  let toolGroup = null;
  let prev = null;
  for (const b of t.blocks) {
    if (b.type === 'debate') { wrap.appendChild(renderDebate(b, t, idx)); prev = b; continue; }
    if (b.type === 'text' && prev && prev.type === 'debate') {
      wrap.insertAdjacentHTML('beforeend', `<div class="speaker consensus">${I.check}<span>Consensus</span><small>moderated by ${esc(prev.moderator || '')}</small></div>`);
    }
    prev = b;
    if (b.type === 'tool') {
      if (!toolGroup) { toolGroup = document.createElement('div'); toolGroup.className = 'tools'; wrap.appendChild(toolGroup); }
      toolGroup.appendChild(renderTool(b));
      continue;
    }
    toolGroup = null;
    if (b.type === 'text') {
      const d = document.createElement('div'); d.className = 'prose'; d.innerHTML = window.renderMarkdown(b.text); wrap.appendChild(d);
    } else if (b.type === 'thinking') {
      wrap.appendChild(renderThinking(b, t));
    }
  }
  el.appendChild(wrap);
  if (t.errorText) {
    const n = document.createElement('div'); n.className = 'notice-card error'; n.style.marginBottom = '12px';
    n.innerHTML = `<div class="title">${I.alert}<span>Something went wrong</span></div><pre>${esc(t.errorText)}</pre>`;
    el.appendChild(n);
  }
  if (t.denials && t.denials.length) el.appendChild(renderDenials(t));
  if (t.live) {
    const w = document.createElement('div'); w.className = 'working';
    w.innerHTML = `<span class="glyph">✻</span><span class="txt shimmer">${esc(workingLabel(t))}</span><span class="el"></span>`;
    w.dataset.start = t.startedAt || Date.now();
    el.appendChild(w);
  } else {
    const a = document.createElement('div'); a.className = 'actions';
    const meta = t.result ? [fmtDuration(t.result.ms), t.result.cost ? `$${t.result.cost.toFixed(t.result.cost < 0.1 ? 3 : 2)}` : ''].filter(Boolean).join(' · ') : '';
    a.innerHTML = `<button class="icon-btn" title="Copy response">${I.copy}</button>${meta ? `<span class="meta">${esc(meta)}</span>` : ''}`;
    a.firstChild.onclick = () => {
      copyText(t.blocks.filter(b => b.type === 'text').map(b => b.text).join('\n\n'));
      a.firstChild.innerHTML = I.check; setTimeout(() => { a.firstChild.innerHTML = I.copy; }, 1400);
    };
    if (t.blocks.some(b => b.type === 'text')) el.appendChild(a);
  }
  return el;
}
function renderThinking(b, t) {
  const d = document.createElement('div');
  d.className = 'thinking' + (b.open ? ' open' : '');
  const label = b.draft && t.live ? 'Thinking…' : 'Thought process';
  d.innerHTML = `<button type="button">${I.bot}<span>${label}</span><span class="chev">${I.chevron}</span></button>${b.open ? `<div class="body">${esc(b.text)}</div>` : ''}`;
  d.firstChild.onclick = () => { b.open = !b.open; d.replaceWith(renderThinking(b, t)); };
  return d;
}

function workingLabel(t) {
  const deb = t.blocks.find(b => b.type === 'debate');
  if (deb) return deb.phase === 'consensus' ? `${deb.moderator} is writing the consensus…` : deb.rounds.length > 1 ? `Round ${deb.rounds.length}: reviewing each other's answers…` : 'Everyone is answering…';
  const last = t.blocks[t.blocks.length - 1];
  if (!last) return 'Thinking…';
  if (last.type === 'tool' && last.status === 'running') {
    const map = { Bash: 'Running command', Read: 'Reading', Write: 'Writing', Edit: 'Editing', MultiEdit: 'Editing', Grep: 'Searching', Glob: 'Searching', WebFetch: 'Fetching', WebSearch: 'Searching the web', Task: 'Running agent', Agent: 'Running agent', TodoWrite: 'Planning' };
    return (map[last.name] || `Using ${last.name}`) + '…';
  }
  if (last.type === 'thinking' && last.draft) return 'Thinking…';
  if (last.type === 'text' && last.draft) return 'Writing…';
  return 'Working…';
}

const TOOL_ICON = { Bash: 'terminal', BashOutput: 'terminal', KillShell: 'terminal', Read: 'file', Write: 'pen', Edit: 'pen', MultiEdit: 'pen', NotebookEdit: 'pen', Grep: 'search', Glob: 'search', LS: 'folder', WebFetch: 'globe', WebSearch: 'globe', TodoWrite: 'list', Task: 'bot', Agent: 'bot', ExitPlanMode: 'list' };
function toolSummary(name, inp) {
  inp = inp || {};
  switch (name) {
    case 'Bash': return inp.description || inp.command;
    case 'Read': case 'Write': case 'Edit': case 'MultiEdit': return relPath(inp.file_path);
    case 'NotebookEdit': return relPath(inp.notebook_path);
    case 'Grep': return `${inp.pattern}${inp.path ? '  in ' + relPath(inp.path) : ''}`;
    case 'Glob': return inp.pattern;
    case 'LS': return relPath(inp.path);
    case 'WebFetch': return inp.url;
    case 'WebSearch': return inp.query;
    case 'Task': case 'Agent': return inp.description;
    case 'TodoWrite': { const td = inp.todos || []; return `${td.filter(x => x.status === 'completed').length}/${td.length} done`; }
    default: { const v = Object.values(inp).find(x => typeof x === 'string'); return v ? v.slice(0, 160) : ''; }
  }
}
function prettyName(name) {
  const m = name.match(/^mcp__(.+?)__(.+)$/);
  return m ? `${m[2]} (${m[1]})` : name;
}

function renderTool(b) {
  const el = document.createElement('div');
  el.className = `tool ${b.status || 'done'}${b.open ? ' open' : ''}`;
  const sum = toolSummary(b.name, b.input);
  const stat = b.status === 'running' ? I.spinner : b.status === 'error' ? `<span>Error</span>${I.alert}` : `<span class="ok">${I.check}</span>`;
  const sub = b.subCount ? `<span>${b.subCount} tool use${b.subCount > 1 ? 's' : ''}</span>` : '';
  el.innerHTML = `<button class="tool-head" type="button"><span class="tool-ico">${I[TOOL_ICON[b.name] || 'tool']}</span><span class="tool-name">${esc(prettyName(b.name))}</span><span class="tool-sum">${esc(sum || '')}</span><span class="tool-stat">${sub}${stat}</span><span class="chev">${I.chevron}</span></button>`;
  el.firstChild.onclick = () => { b.open = b.name === 'TodoWrite' ? b.open === false : !b.open; el.replaceWith(renderTool(b)); };
  if (b.name === 'TodoWrite' && Array.isArray(b.input && b.input.todos)) {
    const ul = document.createElement('ul'); ul.className = 'todos';
    ul.innerHTML = b.input.todos.map(td => `<li class="${esc(td.status)}"><span class="box">${td.status === 'completed' ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' : ''}</span><span>${esc(td.status === 'in_progress' && td.activeForm ? td.activeForm : td.content)}</span></li>`).join('');
    if (b.open !== false) el.appendChild(ul);
    return el;
  }
  if (!b.open) return el;
  const body = document.createElement('div'); body.className = 'tool-body';
  const inp = b.input || {};
  let h = '';
  if (b.name === 'Bash') h += `<pre class="cmd">${esc(inp.command || '')}</pre>`;
  else if (b.name === 'Edit') h += diffHtml([{ old_string: inp.old_string, new_string: inp.new_string }]);
  else if (b.name === 'MultiEdit') h += diffHtml(inp.edits || []);
  else if (b.name === 'Write') h += `<div class="lbl">Content</div><pre>${esc(clipStr(inp.content || '', 6000))}</pre>`;
  else if (b.name === 'Task' || b.name === 'Agent') h += `<div class="lbl">Prompt</div><pre>${esc(clipStr(inp.prompt || '', 6000))}</pre>`;
  else if (Object.keys(inp).length) h += `<div class="lbl">Input</div><pre>${esc(clipStr(JSON.stringify(inp, null, 2), 6000))}</pre>`;
  if (b.result != null && b.result !== '') h += `<div class="lbl">${b.isError ? 'Error' : 'Output'}</div><pre class="${b.isError ? 'err' : ''}">${esc(clipStr(b.result, 12000))}</pre>`;
  else if (b.status === 'running') h += `<div class="lbl">Running…</div>`;
  body.innerHTML = h;
  el.appendChild(body);
  return el;
}
const clipStr = (s, n) => s.length > n ? s.slice(0, n) + `\n… (${(s.length - n).toLocaleString()} more characters)` : s;
function diffHtml(edits) {
  const parts = edits.map(e => {
    const o = String(e.old_string || '').split('\n').map(l => `<div class="d">${esc(l)}</div>`).join('');
    const n = String(e.new_string || '').split('\n').map(l => `<div class="a">${esc(l)}</div>`).join('');
    return (e.old_string ? o : '') + n;
  });
  return `<div class="diff">${parts.join('<div class="sep"></div>')}</div>`;
}

function renderDenials(t) {
  const n = document.createElement('div'); n.className = 'notice-card'; n.style.marginBottom = '12px';
  const names = t.denials.map(prettyName).join(', ');
  n.innerHTML = `<div class="title">${I.shield}<span>Claude needed permission for ${esc(names)}</span></div>
    <div style="color:var(--text-2);font-size:13.5px">Headless runs can't ask you mid-task, so those calls were blocked. Allow them for this chat and let Claude pick up where it left off.</div>
    <div class="row"><button class="btn small accent" data-act="allow">Allow ${esc(names)} &amp; continue</button><button class="btn small" data-act="bypass">Switch to bypass mode</button></div>`;
  const v = S.view;
  n.querySelector('[data-act=allow]').onclick = () => {
    const key = v.id || 'new';
    S.allowed[key] = [...new Set([...(S.allowed[key] || []), ...t.denials])];
    store.set('allowed', S.allowed);
    t.denials = null; markDirty(v.turns.indexOf(t)); scheduleRender();
    send('I\'ve granted the permissions you needed. Please continue where you left off.');
  };
  n.querySelector('[data-act=bypass]').onclick = () => {
    $('#permSel').value = 'bypassPermissions'; S.settings.perm = 'bypassPermissions'; saveSettings(); renderComposerState();
    toast('Bypass mode on — Claude won\'t ask before running tools');
  };
  return n;
}

// tick the working indicator without re-rendering
setInterval(() => {
  const glyphs = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  const k = Math.floor(Date.now() / 140) % glyphs.length;
  $$('.working').forEach(w => {
    w.querySelector('.glyph').textContent = glyphs[k];
    const s = Math.floor((Date.now() - +w.dataset.start) / 1000);
    w.querySelector('.el').textContent = s >= 2 ? `${s}s · Esc to stop` : '';
  });
}, 140);

/* ---------------- header / composer ---------------- */
function renderHeader() {
  const v = S.view;
  const isProj = v && v.mode === 'project';
  $('#chatTitle').textContent = v && !isProj ? v.title : '';
  $('#titleBtn').hidden = !!isProj;
  document.title = 'Roundtable';
  const crumb = $('#crumbBtn');
  const proj = v && !isProj && v.id && projectById(v.projectId);
  crumb.hidden = !proj;
  if (proj) { crumb.innerHTML = `${proj.virtual ? I.folder : I.box}<span>${esc(proj.name)}</span><span class="sep">/</span>`; crumb.title = `Open ${proj.name}`; }
  const chip = $('#cwdChip');
  chip.textContent = v && v.id && !isProj ? (v.kind === 'debate' ? 'Debate' : v.kind === 'model' ? modeLabel('model:' + v.provider) : v.cwd ? homeify(v.cwd) : '') : '';
  chip.title = v ? v.cwd : '';
  const sb = $('#starBtn');
  sb.hidden = !(v && v.id);
  sb.classList.toggle('on', !!(v && v.pinned));
  sb.title = v && v.pinned ? 'Unstar' : 'Star';
}

function renderComposerState() {
  const v = S.view;
  const running = !!(v && v.runId);
  const sendBtn = $('#sendBtn');
  sendBtn.classList.toggle('stop', running);
  sendBtn.innerHTML = running ? I.stop : I.arrowUp;
  sendBtn.title = running ? 'Stop (Esc)' : 'Send (Enter)';
  sendBtn.disabled = !running && !$('#input').value.trim() && !S.pending.some(a => a.status === 'ready');
  const fb = $('#folderBtn');
  const locked = !!(v && (v.id || v.turns.length || v.mode === 'project'));
  fb.classList.toggle('locked', locked);
  fb.title = locked ? `Working in ${v.cwd}` : 'Choose working folder';
  $('#folderLabel').textContent = v ? (baseName(v.cwd) || homeify(v.cwd) || 'Choose folder') : '';
  $('#permSel').closest('.pill').classList.toggle('perm-bypass', $('#permSel').value === 'bypassPermissions');
  buildModeOptions();
  const dt = $('#debateToggle');
  const debOn = !!(S.ai && S.ai.debateEnabled);
  dt.hidden = !S.ai || !!(v && v.id);                 // a chat that's already started keeps its mode
  dt.classList.toggle('on', debOn && currentMode() === 'debate');
  dt.setAttribute('aria-checked', String(debOn && currentMode() === 'debate'));
  const mode = currentMode();
  const claudeMode = mode.startsWith('claude:');
  $('#composer').classList.toggle('nonclaude', !claudeMode);
  const who = claudeMode ? 'Claude' : mode === 'debate' ? 'the panel' : modeLabel(mode);
  $('#input').placeholder = v && v.mode === 'project' ? `Start a chat in ${v.project ? v.project.name : 'this project'}…`
    : v && v.turns.length ? `Reply to ${who}…` : claudeMode ? 'How can I help you today?' : mode === 'debate' ? `Ask ${((S.ai && S.ai.debateParticipants) || []).map(p => p.name).join(', ').replace(/, ([^,]*)$/, ' and $1') || 'the panel'} to debate…` : `Message ${who}…`;
}

function updateEmpty() {
  const v = S.view;
  const empty = !v || (v.mode !== 'project' && !v.id && !v.turns.length && !v.loading);
  $('#main').classList.toggle('empty', empty);
  if (empty) $('#greeting').textContent = greeting();
}

function updateProfile() {
  const n = displayName();
  $('#profileName').textContent = n === 'there' ? 'You' : n;
  $('#avatar').textContent = (n === 'there' ? 'Y' : n[0]).toUpperCase();
  $('#cliVersion').textContent = S.info && S.info.version ? `Claude Code ${S.info.version.replace(/\s*\(.*\)/, '')}` : 'Claude CLI not found';
}

function renderAll() {
  const proj = !!(S.view && S.view.mode === 'project');
  $('#main').classList.toggle('project-mode', proj);
  $('#projectPage').hidden = !proj;
  if (proj) renderProjectPage(); else placeComposer();
  renderHeader();
  renderThread();
  renderComposerState();
  renderSidebar();
  updateEmpty();
}

/* ---------------- projects ---------------- */
function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h > 1 ? 's' : ''} ago`; }
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d > 300 ? 'numeric' : undefined });
}
const fmtSize = n => n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

// One composer element is shared: it sits at the bottom of chats and at the top of project pages
function placeComposer() {
  const c = $('#composer'), slot = $('#projComposerSlot');
  if (S.view && S.view.mode === 'project' && slot) { if (c.parentElement !== slot) slot.appendChild(c); }
  else if (c.parentElement !== $('#dock')) $('#dock').insertBefore(c, $('#suggestions'));
}

async function openProject(id) {
  const token = ++S.viewToken;
  const known = projectById(id);
  S.view = { mode: 'project', projectId: id, id: null, cwd: known ? known.cwd : '', title: known ? known.name : '', turns: [], runId: null, live: null, project: known || null, files: [], memory: '', loading: !known };
  renderAll();
  if (!known) $('#projectPage').innerHTML = '<div class="pp"><div class="pp-main"><div class="skeleton" style="width:40%;height:28px"></div><div class="skeleton"></div></div></div>';
  await loadProject(token);
  $('#input').focus();
}
async function loadProject(token = S.viewToken) {
  const v = S.view;
  let d;
  try { d = await api(`/api/projects/${v.projectId}`); }
  catch (e) { if (token === S.viewToken) { toast(e.message); go(null); } return; }
  if (token !== S.viewToken) return;
  Object.assign(v, { project: d.project, files: d.files, memory: d.memory, cwd: d.project.cwd, title: d.project.name, loading: false });
  renderProjectPage();
  renderComposerState();
}
async function patchProject(body) {
  const v = S.view;
  await api(`/api/projects/${v.projectId}`, { method: 'PATCH', body });
  await Promise.all([loadProject(), refreshSessions()]);
}

function renderProjectPage() {
  const v = S.view, pg = $('#projectPage');
  if (!v || v.mode !== 'project' || !v.project) return;
  $('#dock').insertBefore($('#composer'), $('#suggestions')); // park it while the page is rebuilt
  const p = v.project;
  const chats = S.sessions.filter(s => s.projectId === p.id);
  const running = new Set(S.runs.map(r => r.sessionId));
  const memOn = p.memoryEnabled !== false;
  const fileIcon = name => { const e = (name.split('.').pop() || '').slice(0, 4).toUpperCase(); return e && e.length <= 4 && name.includes('.') ? e : 'FILE'; };
  pg.innerHTML = `
  <div class="pp">
    <div class="pp-main">
      <div class="pp-head">
        <div class="pp-titles">
          <div class="pp-kicker">${projIcon(p)}${p.virtual ? 'Folder' : p.kind === 'chat' ? 'Chat project' : 'Code project'}${p.importedFrom ? ' · imported from claude.ai' : ''}</div>
          <h1>${esc(p.name)}</h1>
          ${p.description ? `<p class="pp-desc">${esc(p.description)}</p>` : `<button class="pp-link" data-act="details">Add a description</button>`}
        </div>
        <button class="icon-btn" data-act="more" title="Project options">${I.dots}</button>
      </div>
      ${p.virtual ? `<div class="pp-hint">${I.box}<span>You've used Claude Code in this folder. Add instructions, files or memory and it becomes a full project that every chat here shares.</span></div>` : ''}
      <div id="projComposerSlot"></div>
      <div class="pp-chats">
        ${chats.length ? `<div class="pp-chats-head">${chats.length} chat${chats.length > 1 ? 's' : ''}</div>` : ''}
        ${chats.map(s => `<button class="pp-chat" data-id="${esc(s.id)}"><span class="t">${running.has(s.id) ? `<span class="running-dot">${I.spinner}</span>` : chatIcon(s)}${esc(s.title)}</span><span class="when">Last message ${esc(ago(s.updated))}</span></button>`).join('')
          || `<div class="pp-empty">No chats yet. Every chat you start here shares this project's instructions, files and memory.</div>`}
      </div>
    </div>
    <aside class="pp-side">
      <section class="pp-card">
        <div class="pp-card-head"><h3>Instructions</h3><button class="pp-link" data-act="instr">${p.instructions ? 'Edit' : 'Add'}</button></div>
        <div class="pp-card-body ${p.instructions ? 'clamp pre' : 'muted'}" data-act="instr">${p.instructions ? esc(p.instructions) : 'Tell Claude how to work in this project — tone, tech stack, rules it should always follow.'}</div>
      </section>
      <section class="pp-card">
        <div class="pp-card-head"><h3>${I.brain}Memory</h3><button class="pp-link" data-act="mem">${v.memory.trim() ? 'View & edit' : 'Edit'}</button></div>
        <div class="pp-card-sub">${!memOn ? 'Automatic updates are off' : p.virtual ? 'Starts once this folder is a project' : p.memoryUpdated ? `Updated ${esc(ago(p.memoryUpdated))}` : 'Claude updates this after each chat'}</div>
        <div class="pp-card-body ${v.memory.trim() ? 'clamp prose-sm' : 'muted'}" data-act="mem">${v.memory.trim() ? window.renderMarkdown(v.memory) : 'Important decisions, facts and preferences from your chats will collect here, and every new chat starts with them.'}</div>
      </section>
      <section class="pp-card">
        <div class="pp-card-head"><h3>Files</h3><button class="icon-btn tiny" data-act="addfile" title="Add files">${I.plus}</button></div>
        ${v.files.length ? `<div class="pp-files">${v.files.map(f => `
          <div class="pp-file" title="${esc(f.name)} · ${fmtSize(f.size)}"><span class="ext">${esc(fileIcon(f.name))}</span><span class="n">${esc(f.name)}</span><span class="sz">${fmtSize(f.size)}</span><button class="icon-btn tiny" data-del="${esc(f.name)}" title="Remove">${I.x}</button></div>`).join('')}</div>`
          : `<div class="pp-drop" data-act="upload">${I.upload}<span>Add PDFs, docs, code or notes Claude should know about. Drop files here or click to upload.</span></div>`}
        <div class="pp-file-actions"><button class="btn small" data-act="upload">${I.upload}Upload</button><button class="btn small" data-act="text">${I.note}Add text</button></div>
      </section>
      ${p.kind === 'chat' ? `<section class="pp-card compact"><div class="pp-card-head"><h3>${I.chat}Chat project</h3></div><div class="pp-card-sub" style="margin-top:4px">Chats here are conversations with Claude or your other AIs — no folder, no file changes.</div></section>` : `<section class="pp-card compact">
        <div class="pp-card-head"><h3>Folder</h3><button class="pp-link" data-act="folder">Change</button></div>
        <div class="pp-path" title="${esc(p.cwd)}">${esc(homeify(p.cwd))}</div>
      </section>`}
    </aside>
  </div>`;
  placeComposer();
  pg.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', e => {
    const act = el.dataset.act;
    if (act === 'details') projectDialog(p);
    else if (act === 'more') showMenu(el, [
      { icon: 'edit', label: 'Edit details', run: () => projectDialog(p) },
      { icon: 'terminal', label: 'Copy folder path', run: () => { copyText(p.cwd); toast('Copied folder path'); } },
      ...(p.virtual ? [] : ['-', { icon: 'trash', label: 'Delete project', danger: true, run: () => deleteProjectDialog(p) }]),
    ]);
    else if (act === 'instr') instructionsDialog(p);
    else if (act === 'mem') memoryDialog(p, v.memory);
    else if (act === 'addfile') showMenu(el, [
      { icon: 'upload', label: 'Upload files', run: () => $('#fileInput').click() },
      { icon: 'note', label: 'Add text content', run: () => textFileDialog() },
    ]);
    else if (act === 'upload') $('#fileInput').click();
    else if (act === 'text') textFileDialog();
    else if (act === 'folder') folderPicker(p.cwd, path => patchProject({ cwd: path }).catch(err => toast(err.message)));
  }));
  pg.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    await api(`/api/projects/${p.id}/files/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' }).catch(e => toast(e.message));
    loadProject();
  }));
  pg.querySelectorAll('.pp-chat').forEach(b => b.addEventListener('click', () => go(b.dataset.id)));
}

async function uploadFiles(files) {
  const v = S.view;
  if (!v || v.mode !== 'project') return;
  const read = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(f); });
  let n = 0;
  for (const f of files) {
    if (f.size > 30e6) { toast(`${f.name} is over 30 MB`); continue; }
    toast(`Uploading ${f.name}…`);
    try { await api(`/api/projects/${v.projectId}/files`, { method: 'POST', body: { name: f.name, data: await read(f) } }); n++; }
    catch (e) { toast(`${f.name}: ${e.message}`); }
  }
  if (n) toast(`Added ${n} file${n > 1 ? 's' : ''}`);
  await Promise.all([loadProject(), refreshSessions()]);
}

function projectDialog(p) {
  const editing = !!p;
  const m = modal({
    title: editing ? 'Edit project' : 'New project',
    body: `
      ${editing ? '' : `<div class="kind-pick" id="pjKind">
        <button type="button" data-k="code" class="on">${I.box}<strong>Code project</strong><small>Claude Code works in a folder on your computer — reads and edits files, runs commands.</small></button>
        <button type="button" data-k="chat">${I.chat}<strong>Chat project</strong><small>Like claude.ai projects: instructions, knowledge files and memory, for talking things through.</small></button>
      </div>`}
      <label class="field"><span>Name</span><input class="input" id="pjName" maxlength="120" value="${esc(p ? p.name : '')}" placeholder="e.g. Homelab server"></label>
      <label class="field"><span>Description <small>(optional)</small></span><input class="input" id="pjDesc" maxlength="1000" value="${esc(p ? p.description : '')}" placeholder="What is this project about?"></label>
      <label class="field" id="pjCwdField" ${p && p.kind === 'chat' ? 'hidden' : ''}><span>Folder Claude works in</span>
        <div class="input-row"><input class="input mono" id="pjCwd" value="${esc(p ? p.cwd : '')}" placeholder="New folder in ~/Claude Projects"><button class="btn" id="pjBrowse" type="button">Browse</button></div>
        <small>${editing ? 'Chats in this project read and write files here.' : 'Pick a code folder, or leave empty for a fresh one in your Claude Projects folder.'}</small>
      </label>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="pjSave">${editing ? 'Save' : 'Create project'}</button>`,
  });
  const name = $('#pjName', m.el); name.focus();
  let kind = p ? p.kind || 'code' : 'code';
  $$('#pjKind button', m.el).forEach(b => b.onclick = () => {
    kind = b.dataset.k;
    $$('#pjKind button', m.el).forEach(x => x.classList.toggle('on', x === b));
    $('#pjCwdField', m.el).hidden = kind === 'chat';
    name.focus();
  });
  $('#pjBrowse', m.el).onclick = () => folderPicker($('#pjCwd', m.el).value || (p && p.cwd), path => { $('#pjCwd', m.el).value = path; });
  const save = async () => {
    const body = { name: name.value.trim(), description: $('#pjDesc', m.el).value.trim(), cwd: kind === 'chat' ? '' : $('#pjCwd', m.el).value.trim(), kind };
    if (!body.name) { name.focus(); return; }
    try {
      if (editing) { if (!body.cwd) delete body.cwd; await patchProject(body); m.close(); }
      else { const r = await api('/api/projects', { method: 'POST', body }); m.close(); await refreshSessions(); goProject(r.project.id); }
    } catch (e) { toast(e.message); }
  };
  $('#pjSave', m.el).onclick = save;
  name.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}

function instructionsDialog(p) {
  const m = modal({
    title: 'Project instructions', wide: true,
    body: `<p>Claude follows these in every chat in <strong>${esc(p.name)}</strong>.</p>
      <textarea class="input area" id="insText" rows="12" placeholder="e.g. Keep answers short. The server runs Ubuntu 24.04 with Docker. Ask before deleting anything.">${esc(p.instructions || '')}</textarea>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="insSave">Save instructions</button>`,
  });
  const ta = $('#insText', m.el); ta.focus();
  $('#insSave', m.el).onclick = async () => { try { await patchProject({ instructions: ta.value }); m.close(); toast('Instructions saved — new chats will use them'); } catch (e) { toast(e.message); } };
}

function memoryDialog(p, memory) {
  const m = modal({
    title: 'Project memory', wide: true,
    body: `<p>Every new chat in <strong>${esc(p.name)}</strong> starts with this. Claude keeps it up to date as you chat; you can edit it any time.</p>
      <textarea class="input area mono" id="memText" rows="14" placeholder="Nothing remembered yet.">${esc(memory || '')}</textarea>
      <label class="check"><input type="checkbox" id="memAuto" ${p.memoryEnabled !== false ? 'checked' : ''}> Update memory automatically after each chat</label>`,
    foot: `<button class="btn" id="memClear" style="margin-right:auto">Clear</button><button class="btn" data-close>Cancel</button><button class="btn primary" id="memSave">Save</button>`,
  });
  $('#memClear', m.el).onclick = () => { $('#memText', m.el).value = ''; };
  $('#memSave', m.el).onclick = async () => {
    try { await patchProject({ memory: $('#memText', m.el).value, memoryEnabled: $('#memAuto', m.el).checked }); m.close(); toast('Memory saved'); }
    catch (e) { toast(e.message); }
  };
}

function textFileDialog() {
  const m = modal({
    title: 'Add text content', wide: true,
    body: `<label class="field"><span>Title</span><input class="input" id="txName" placeholder="e.g. Network layout"></label>
      <label class="field"><span>Content</span><textarea class="input area" id="txBody" rows="12" placeholder="Paste notes, docs, configs…"></textarea></label>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="txSave">Add to project</button>`,
  });
  $('#txName', m.el).focus();
  $('#txSave', m.el).onclick = async () => {
    const text = $('#txBody', m.el).value;
    if (!text.trim()) { $('#txBody', m.el).focus(); return; }
    try {
      await api(`/api/projects/${S.view.projectId}/files`, { method: 'POST', body: { name: $('#txName', m.el).value.trim() || 'Notes', text } });
      m.close(); await Promise.all([loadProject(), refreshSessions()]);
    } catch (e) { toast(e.message); }
  };
}

function deleteProjectDialog(p) {
  const m = modal({
    title: 'Delete project?',
    body: `<p>“${esc(p.name)}” and its instructions, files and memory will be removed. Its chats stay in your history, and the folder <code>${esc(homeify(p.cwd))}</code> isn't touched.</p>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn danger" id="pdGo">Delete project</button>`,
  });
  $('#pdGo', m.el).onclick = async () => {
    try { await api(`/api/projects/${p.id}`, { method: 'DELETE' }); } catch (e) { toast(e.message); return; }
    m.close(); await refreshSessions(); go(null); toast('Project deleted');
  };
}

function moveDialog(s) {
  const opts = S.projects.map(p => `<button class="pick ${p.id === s.projectId ? 'on' : ''}" data-id="${esc(p.id)}">${p.virtual ? I.folder : I.box}<span>${esc(p.name)}</span><small>${esc(homeify(p.cwd))}</small></button>`).join('');
  const m = modal({
    title: 'Move to project',
    body: `<p>The chat will share that project's instructions, files and memory from its next message. It keeps working in its current folder.</p>
      <div class="pick-list">${opts}<button class="pick" data-id="none">${I.x}<span>No project</span></button></div>`,
  });
  m.el.querySelectorAll('.pick').forEach(b => b.onclick = async () => {
    try { await api(`/api/sessions/${s.id}`, { method: 'PATCH', body: { projectId: b.dataset.id } }); m.close(); await refreshSessions(); toast('Chat moved'); }
    catch (e) { toast(e.message); }
  });
}

/* ---------------- desktop app updates ---------------- */
async function checkApp() {
  try { S.app = await api('/api/app'); } catch { return; }
  const u = S.app && S.app.update;
  const btn = $('#updateBtn');
  const ready = u && (u.status === 'ready' || u.status === 'available');
  btn.hidden = !ready;
  if (ready) {
    $('#updateLabel').textContent = u.status === 'ready' ? `Restart to update to ${u.version}` : `Update ${u.version} available`;
    btn.title = u.status === 'ready' ? 'Installs the new version and reopens the app' : 'Opens the download page';
  }
}
async function installUpdate() {
  if (S.runs.length && !confirm('Claude is still working in a chat. Restart and update anyway?')) return;
  try { await api('/api/app/install-update', { method: 'POST' }); toast('Updating…'); } catch (e) { toast(e.message); }
}


/* ---------------- sync between devices ---------------- */
async function loadSync() {
  let st;
  try { st = await api('/api/sync'); } catch { return; }
  const prev = S.sync;
  S.sync = st;
  renderSyncBadge();
  if (prev && st.lastSync !== prev.lastSync && st.lastDown) refreshSessions();
  const pane = document.getElementById('syncPane');
  if (pane && !pane.contains(document.activeElement)) renderSyncPane(pane);
}
function renderSyncBadge() {
  const st = S.sync, el = $('#syncBadge');
  if (!el) return;
  el.hidden = !st || !st.connected;
  if (!st || !st.connected) return;
  el.className = 'sync-badge ' + (st.state === 'error' ? 'err' : st.running ? 'busy' : '');
  el.title = st.state === 'error' ? `Sync problem: ${st.error}` : st.running ? 'Syncing…' : `Synced ${st.lastSync ? ago(st.lastSync) : '—'} · ${st.repo}`;
}
function renderSyncPane(pane) {
  const st = S.sync || { connected: false };
  if (!st.connected) {
    const repoUrl = 'https://github.com/new?name=roundtable-sync&visibility=private&description=' + encodeURIComponent('Chats synced by Roundtable (keep private)');
    const tokUrl = 'https://github.com/settings/personal-access-tokens/new?name=' + encodeURIComponent(`Roundtable (${st.device || 'device'})`).slice(0, 120) +
      '&description=' + encodeURIComponent('Lets Roundtable sync chats to a private repository') + '&expires_in=none&contents=write';
    pane.innerHTML = `
      <p class="hint">Sign in with GitHub to keep your chats, projects and memory the same on every computer you use. Everything goes to a <strong>private repository</strong> in your own GitHub account. Do these steps once per computer (step 1 only the first time).</p>
      <ol class="steps">
        <li><strong>Create a private repository</strong> for your chats. <a href="${repoUrl}" target="_blank" rel="noopener">Create it on GitHub</a> — keep it <em>Private</em>. On your other computers, skip this and use the same one.</li>
        <li><strong>Create a sign-in token</strong> for this computer. <a href="${tokUrl}" target="_blank" rel="noopener">Open the token page</a> — under <em>Repository access</em> choose <em>Only select repositories</em> and pick your chats repository, then click <em>Generate token</em> and copy it.</li>
        <li><strong>Paste it here:</strong></li>
      </ol>
      <label class="field"><span>Repository</span><input class="input mono" id="syRepo" placeholder="roundtable-sync" value="roundtable-sync"></label>
      <label class="field"><span>Token</span><input class="input mono" id="syTok" placeholder="github_pat_…" autocomplete="off" type="password"></label>
      <div class="row-end"><span class="sy-msg" id="syMsg"></span><button class="btn accent" id="syGo">Sign in & sync</button></div>
      <small class="muted-note">The token is saved only on this computer and can only reach that one repository. Your API keys for other AI models are never synced.</small>`;
    $('#syGo', pane).onclick = async () => {
      const b = $('#syGo', pane); b.disabled = true; b.textContent = 'Signing in…'; $('#syMsg', pane).textContent = '';
      try {
        S.sync = await api('/api/sync/connect', { method: 'POST', body: { token: $('#syTok', pane).value, repo: $('#syRepo', pane).value } });
        toast('Signed in — chats are syncing'); renderSyncPane(pane); renderSyncBadge(); refreshSessions();
      } catch (e) { $('#syMsg', pane).textContent = e.message; b.disabled = false; b.textContent = 'Sign in & sync'; }
    };
    return;
  }
  const when = st.lastSync ? `Last synced ${ago(st.lastSync)}${st.lastChanges ? ` · ${st.lastUp || 0} sent, ${st.lastDown || 0} received` : ' · everything up to date'}` : 'Not synced yet';
  pane.innerHTML = `
    <div class="sy-card">
      <div class="sy-row">${I.check}<div><strong>Signed in as @${esc(st.user)}</strong><small>Syncing with <a href="https://github.com/${esc(st.repo)}" target="_blank" rel="noopener">${esc(st.repo)}</a> · this computer is “${esc(st.device)}”</small></div></div>
      <div class="sy-status ${st.state === 'error' ? 'err' : ''}">${st.running ? 'Syncing…' : st.state === 'error' ? esc(st.error) : esc(when)}</div>
      <div class="row-end"><button class="btn" id="syOut">Sign out</button><button class="btn primary" id="syNow" ${st.running ? 'disabled' : ''}>Sync now</button></div>
    </div>
    <p class="hint">Syncs automatically every few minutes and after each reply. What syncs: Claude Code chats, chats with other models, debates, chat names and stars, and projects with their instructions, memory and files. What doesn't: the files Claude edits in your folders (use git for code), API keys and app settings.</p>
    <p class="hint">If the same chat gets new messages on two computers before they sync, you'll see both: the other version appears as a separate chat marked “(copy from other device)”.</p>
    ${st.conflicts ? `<p class="hint">${st.conflicts} other item${st.conflicts > 1 ? 's were' : ' was'} edited on two computers at once; the older version is saved in <code>${esc(homeify(((S.info && S.info.appDir) || '~/.roundtable')))}/conflicts</code>.</p>` : ''}`;
  $('#syNow', pane).onclick = async () => {
    $('#syNow', pane).disabled = true; $('.sy-status', pane).textContent = 'Syncing…';
    try { S.sync = await api('/api/sync/now', { method: 'POST' }); refreshSessions(); }
    catch (e) { S.sync = (e.status) || S.sync; toast(e.message); await loadSync(); }
    renderSyncPane(pane); renderSyncBadge();
  };
  $('#syOut', pane).onclick = async () => {
    if (!confirm('Stop syncing this computer? Your chats stay here and in the repository.')) return;
    S.sync = await api('/api/sync/disconnect', { method: 'POST' }); renderSyncPane(pane); renderSyncBadge();
  };
}
/* ---------------- attachments: drop, paste, or the paperclip ---------------- */
S.pending = [];
function addFiles(files) {
  for (const f of files) {
    if (f.size > 25e6) { toast(`${f.name} is over 25 MB`); continue; }
    const item = { key: Math.random().toString(36).slice(2), name: f.name || 'pasted-image.png', size: f.size, image: /^image\//.test(f.type), status: 'uploading' };
    if (item.image) try { item.preview = URL.createObjectURL(f); } catch {}
    S.pending.push(item);
    const r = new FileReader();
    r.onload = async () => {
      try {
        const up = await api('/api/uploads', { method: 'POST', body: { name: item.name, data: String(r.result).split(',')[1] || '' } });
        Object.assign(item, { id: up.id, status: 'ready' });
      } catch (e) { item.status = 'error'; item.error = e.message; toast(`${item.name}: ${e.message}`); }
      renderAttachRow(); renderComposerState();
    };
    r.onerror = () => { item.status = 'error'; renderAttachRow(); };
    r.readAsDataURL(f);
  }
  renderAttachRow(); renderComposerState(); $('#input').focus();
}
function renderAttachRow() {
  const row = $('#attachRow');
  row.hidden = !S.pending.length;
  row.innerHTML = S.pending.map(a => `
    <div class="att-chip ${a.status}" data-k="${a.key}" title="${esc(a.error || a.name)}">
      ${a.preview ? `<img src="${a.preview}" alt="">` : `<span class="att-ico">${I.file}</span>`}
      <span class="att-meta"><span class="att-name">${esc(a.name)}</span><span class="att-size">${a.status === 'uploading' ? 'Adding…' : a.status === 'error' ? 'Couldn’t add' : fmtSize(a.size)}</span></span>
      <button type="button" class="att-x" title="Remove">${I.x}</button>
    </div>`).join('');
  row.querySelectorAll('.att-x').forEach(b => b.onclick = () => {
    const k = b.closest('.att-chip').dataset.k;
    S.pending = S.pending.filter(a => a.key !== k);
    renderAttachRow(); renderComposerState(); $('#input').focus();
  });
}
function bindAttachments() {
  $('#attachBtn').onclick = () => $('#attachInput').click();
  $('#attachInput').onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) addFiles(f); };
  // Ctrl+V / Cmd+V with a picture or file on the clipboard (screenshots included), from anywhere in the window
  document.addEventListener('paste', e => {
    if ($('#modalRoot').children.length) return;
    const cd = e.clipboardData;
    if (!cd) return;
    let files = [...(cd.files || [])];
    if (!files.length) files = [...(cd.items || [])].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
    if (!files.length) return;
    const t = e.target;
    if (t && t !== $('#input') && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return; // someone else's box
    e.preventDefault();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    addFiles(files.map((f, i) => (!f.name || /^image\.(png|jpe?g|gif|webp)$/i.test(f.name))
      ? new File([f], `pasted-${stamp}${i ? '-' + i : ''}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }) : f));
  });
  // drag and drop anywhere in the window (project pages keep their own drop-to-add-to-project area)
  let depth = 0;
  const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  const overlayFor = e => !(S.view && S.view.mode === 'project' && !(e.target.closest && e.target.closest('#composer')));
  document.addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; if (overlayFor(e)) $('#dropOverlay').hidden = false; });
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('#dropOverlay').hidden = true; } });
  document.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; $('#dropOverlay').hidden = !overlayFor(e); } });
  document.addEventListener('drop', e => {
    depth = 0; $('#dropOverlay').hidden = true;
    if (!hasFiles(e)) return;
    e.preventDefault(); // never let the window navigate to a dropped file
    if (e.defaultPrevented && e.__handledByProject) return;
    const files = [...e.dataTransfer.files];
    if (!files.length || e.__handledByProject) return;
    if (S.view && S.view.runId) { toast('Wait for the reply to finish, then attach'); return; }
    addFiles(files);
  });
}

/* ---------------- plan usage bar ---------------- */
async function loadUsage() {
  try { S.usage = (await api('/api/usage')).limits; } catch { return; }
  renderUsage();
}
function renderUsage() {
  const el = $('#usageBar'), L = S.usage || {};
  const rows = [['five_hour', 'Current session'], ['seven_day', 'This week']].filter(([k]) => L[k]);
  el.hidden = !rows.length;
  if (!rows.length) return;
  const when = ms => {
    if (!ms) return '';
    const d = new Date(ms), now = new Date();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? time : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  };
  el.innerHTML = rows.map(([k, label]) => {
    const u = L[k];
    const pct = typeof u.utilization === 'number' ? Math.round(u.utilization * 100) : null;
    const level = u.status === 'rejected' || (pct != null && pct >= 90) ? 'hi' : u.status === 'allowed_warning' || (pct != null && pct >= 70) ? 'mid' : 'lo';
    const text = u.status === 'rejected' ? 'Limit reached' : pct != null ? `${pct}% used` : u.status === 'allowed_warning' ? 'Getting close' : 'Within limit';
    const reset = u.resetsAt ? ` · resets ${when(u.resetsAt)}` : '';
    return `<div class="ub ${level}" title="${esc(label)}: ${esc(text + reset)}${u.usingOverage ? ' (using extra usage)' : ''}">
      <span class="ub-label">${esc(label)}</span>
      <span class="ub-track"><span class="ub-fill" style="width:${pct != null ? Math.max(2, Math.min(100, pct)) : u.status === 'rejected' ? 100 : u.status === 'allowed_warning' ? 80 : 30}%"></span></span>
      <span class="ub-text">${esc(text)}${esc(reset)}</span>
    </div>`;
  }).join('');
}

/* ---------------- "/" menu: skills, commands, plugins ---------------- */
const slash = { open: false, items: [], sel: 0, cwd: null, list: null, loading: null };
function slashCwd() {
  const v = S.view;
  if (!v) return '';
  if (v.mode === 'project') return (v.project && v.project.cwd) || v.cwd || '';
  return v.cwd || '';
}
async function loadCommands(cwd) {
  if (slash.list && slash.cwd === cwd && Date.now() - slash.at < 20000) return slash.list;
  if (slash.loading && slash.loadingCwd === cwd) return slash.loading;
  slash.loadingCwd = cwd;
  slash.loading = api('/api/commands?cwd=' + encodeURIComponent(cwd || '')).then(r => {
    slash.list = r.commands; slash.cwd = cwd; slash.at = Date.now(); slash.loading = null; return r.commands;
  }).catch(() => { slash.loading = null; return []; });
  return slash.loading;
}
// The "/word" being typed at the very start of the message, if the caret is still inside it
function slashQuery() {
  const ta = $('#input');
  const before = ta.value.slice(0, ta.selectionStart);
  const m = before.match(/^\/([^\s]*)$/);
  return m && currentMode().startsWith('claude:') ? m[1] : null;
}
async function updateSlash() {
  const q = slashQuery();
  if (q === null) return closeSlash();
  const list = await loadCommands(slashCwd());
  if (slashQuery() !== q) return; // typing moved on while loading
  const ql = q.toLowerCase();
  const score = c => { const n = c.name.toLowerCase(); return n.startsWith(ql) ? 0 : n.split(/[:\-_]/).some(w => w.startsWith(ql)) ? 1 : n.includes(ql) ? 2 : (c.description || '').toLowerCase().includes(ql) ? 3 : 9; };
  slash.items = list.map(c => [score(c), c]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0]).map(([, c]) => c).slice(0, 60);
  slash.sel = Math.min(slash.sel, Math.max(0, slash.items.length - 1));
  if (!slash.open) slash.sel = 0;
  slash.open = true;
  renderSlash(list.length);
}
function renderSlash(total) {
  const el = $('#slashMenu');
  const label = c => c.source === 'builtin' ? 'Built-in' : c.source === 'plugin' ? `Plugin · ${c.scope}` : `${c.source === 'skill' ? 'Skill' : 'Command'} · ${c.scope === 'project' ? 'this project' : c.scope === 'personal' ? 'yours' : c.scope}`;
  const ico = c => c.source === 'builtin' ? I.terminal : c.source === 'plugin' ? I.box : c.source === 'skill' ? I.book : I.note;
  if (!slash.items.length) {
    el.innerHTML = `<div class="sm-empty">${total ? 'No matching commands or skills' : 'No skills or commands found for this folder'}</div>`;
  } else {
    el.innerHTML = `<div class="sm-head">Skills & commands</div>` + slash.items.map((c, i) => `
      <div class="sm-item ${i === slash.sel ? 'on' : ''}" role="option" data-i="${i}" aria-selected="${i === slash.sel}">
        <span class="sm-ico">${ico(c)}</span>
        <span class="sm-main"><span class="sm-name">/${esc(c.name)}${c.argHint ? ` <span class="sm-arg">${esc(c.argHint)}</span>` : ''}</span>${c.description ? `<span class="sm-desc">${esc(c.description)}</span>` : ''}</span>
        <span class="sm-tag">${esc(label(c))}</span>
      </div>`).join('');
  }
  el.hidden = false;
  el.querySelectorAll('.sm-item').forEach(row => {
    row.addEventListener('mousedown', e => { e.preventDefault(); pickSlash(+row.dataset.i); });
    row.addEventListener('mousemove', () => { if (slash.sel !== +row.dataset.i) { slash.sel = +row.dataset.i; renderSlash(total); } });
  });
  const on = el.querySelector('.sm-item.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function closeSlash() { slash.open = false; const el = $('#slashMenu'); if (el) el.hidden = true; }
function pickSlash(i) {
  const c = slash.items[i];
  if (!c) return;
  const ta = $('#input');
  const rest = ta.value.slice(ta.selectionStart).replace(/^\S*/, '').replace(/^\s*/, '');
  ta.value = `/${c.name} ${rest}`;
  const pos = c.name.length + 2;
  ta.setSelectionRange(pos, pos);
  closeSlash(); autoGrow(); renderComposerState(); ta.focus();
}
/** Keyboard handling while the menu is open. Returns true when the key was used. */
function slashKey(e) {
  if (!slash.open) return false;
  const n = slash.items.length;
  if (e.key === 'ArrowDown' && n) { slash.sel = (slash.sel + 1) % n; renderSlash(1); }
  else if (e.key === 'ArrowUp' && n) { slash.sel = (slash.sel - 1 + n) % n; renderSlash(1); }
  else if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && n) pickSlash(slash.sel);
  else if (e.key === 'Escape') { closeSlash(); }
  else return false;
  e.preventDefault(); e.stopPropagation();
  return true;
}

/* ---------------- sending ---------------- */
async function send(text) {
  text = (text || '').trim();
  const v = S.view;
  if (!v || v.runId) return;
  if (S.pending.some(a => a.status === 'uploading')) { toast('Still adding your files — one moment'); return; }
  const atts = S.pending.filter(a => a.status === 'ready');
  if (!text && !atts.length) return;
  const mode = currentMode();
  const isClaude = mode.startsWith('claude:');
  if (isClaude && !v.cwd) { toast('Pick a folder for Claude to work in first'); folderPicker('', p => { v.cwd = p; renderComposerState(); }); return; }
  const token = S.viewToken;
  const input = $('#input');
  input.value = ''; autoGrow(); renderComposerState();
  try {
    const r = await api('/api/chat', {
      method: 'POST',
      body: {
        sessionId: v.id, projectId: !v.id && v.mode === 'project' ? v.projectId : undefined, prompt: text, cwd: v.cwd,
        kind: isClaude ? 'claude' : mode === 'debate' ? 'debate' : 'model', provider: mode.startsWith('model:') ? mode.slice(6) : undefined,
        model: isClaude ? mode.slice(7) : undefined, permissionMode: $('#permSel').value, allowedTools: S.allowed[v.id || 'new'] || [],
        attachments: atts.map(a => a.id),
      },
    });
    S.pending = S.pending.filter(a => !atts.includes(a)); renderAttachRow();
    if (token !== S.viewToken) return;
    if (r.sessionId && !v.id) {
      v.id = r.sessionId; v.kind = mode === 'debate' ? 'debate' : 'model'; v.provider = mode.startsWith('model:') ? mode.slice(6) : null; v.cwd = null;
      history.replaceState(null, '', `#/c/${v.id}`); renderHeader();
    }
    if (v.mode === 'project') { v.mode = 'chat'; v.title = 'New chat'; renderAll(); }
    if (!v.id && !v.projectId && S.settings.cwd !== v.cwd) { /* remember last-used folder */ S.settings.cwd = v.cwd; saveSettings(); }
    attach(r.runId, token);
    setTimeout(refreshRuns, 600);
    scrollToBottom(true);
  } catch (e) {
    if (e.code === 'FOLDER_MISSING') {
      if (!input.value) input.value = text;
      autoGrow(); renderComposerState();
      return folderMissingDialog(v, e.cwd);
    }
    toast(e.message);
    if (!input.value) input.value = text;
    autoGrow(); renderComposerState();
  }
}

function folderMissingDialog(v, cwd) {
  const m = modal({
    title: 'Folder not on this computer',
    body: `<p>This chat was working in <code>${esc(cwd)}</code>, which doesn't exist here — it probably started on another device. Pick a folder on this computer for Claude to continue in. Files Claude made on the other device aren't copied over, only the conversation.</p>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="fmPick">Choose folder…</button>`,
  });
  $('#fmPick', m.el).onclick = () => { m.close(); folderPicker('', async p => {
    try { await api(`/api/sessions/${v.id}`, { method: 'PATCH', body: { cwd: p } }); v.cwd = p; renderAll(); toast('Folder set — press Enter to send'); $('#input').focus(); }
    catch (err) { toast(err.message); }
  }); };
}

async function stop() {
  const v = S.view;
  if (v && v.runId) await api(`/api/runs/${v.runId}/stop`, { method: 'POST' }).catch(() => {});
}

function autoGrow() {
  const ta = $('#input');
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, innerHeight * 0.4) + 'px';
}

/* ---------------- search ---------------- */
let searchTimer;
function openSearch() {
  if ($('#app').classList.contains('collapsed') && innerWidth > 820) toggleCollapse(false);
  if (innerWidth <= 820) $('#app').classList.add('mobile-open');
  $('#searchBox').hidden = false; $('#searchBtn').hidden = true;
  $('#searchInput').focus(); $('#searchInput').select();
}
function closeSearch() {
  $('#searchBox').hidden = true; $('#searchBtn').hidden = false;
  $('#searchInput').value = ''; S.query = ''; S.searchHits = null; renderSidebar();
}

/* ---------------- layout ---------------- */
function toggleCollapse(force) {
  const app = $('#app');
  const c = force !== undefined ? force : !app.classList.contains('collapsed');
  app.classList.toggle('collapsed', c);
  store.set('collapsed', c);
}
function closeMobileSidebar() { $('#app').classList.remove('mobile-open'); }

/* ---------------- wiring ---------------- */
const SUGGESTIONS = [
  { icon: 'book', label: 'Explain this codebase', text: 'Give me a tour of this codebase: what it does, how it\'s organized, and where the important pieces live.' },
  { icon: 'bug', label: 'Find & fix a bug', text: 'Look for bugs in this project, explain the most important one you find, and fix it.' },
  { icon: 'flask', label: 'Write tests', text: 'Find the least-tested important code in this project and write tests for it.' },
  { icon: 'code', label: 'Review my changes', text: 'Review my uncommitted changes (git diff) and point out problems or improvements.' },
];

function bind() {
  applyIcons();
  if (store.get('collapsed', false) && innerWidth > 820) $('#app').classList.add('collapsed');
  $('#searchKbd').textContent = isMac ? '⌘K' : 'Ctrl K';

  $('#collapseBtn').onclick = () => toggleCollapse();
  $('#openSidebarBtn').onclick = () => $('#app').classList.add('mobile-open');
  $('#scrim').onclick = closeMobileSidebar;
  $('#newChatBtn').onclick = () => newChat();
  $('#newProjectBtn').onclick = e => { e.stopPropagation(); projectDialog(); };
  $('#crumbBtn').onclick = () => S.view && goProject(S.view.projectId);
  $('#updateBtn').onclick = installUpdate;
  $('#fileInput').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) uploadFiles(f); });
  $('#searchBtn').onclick = openSearch;
  $('#searchClear').onclick = closeSearch;
  $('#searchInput').addEventListener('input', e => {
    S.query = e.target.value; S.searchHits = null; renderSidebar();
    clearTimeout(searchTimer);
    const q = S.query.trim();
    if (q.length >= 3) searchTimer = setTimeout(async () => {
      try { const { hits } = await api('/api/search?q=' + encodeURIComponent(q)); if (S.query.trim() === q) { S.searchHits = new Set(hits.map(h => h.id)); renderSidebar(); } } catch {}
    }, 250);
  });
  $('#searchInput').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeSearch(); }
    if (e.key === 'Enter') { const first = $('#sbScroll .sb-chat'); if (first) first.click(); }
  });
  $('#settingsBtn').onclick = () => settingsDialog();

  $('#titleBtn').onclick = e => {
    const v = S.view; if (!v || !v.id) return;
    const s = S.sessions.find(x => x.id === v.id) || { id: v.id, title: v.title, cwd: v.cwd, pinned: v.pinned };
    chatMenu(s, e.currentTarget);
  };
  $('#starBtn').onclick = () => S.view && S.view.id && setPinned(S.view.id, !S.view.pinned);
  $('#cwdChip').onclick = () => { if (S.view && S.view.cwd) { copyText(S.view.cwd); toast('Copied folder path'); } };

  const input = $('#input');
  input.addEventListener('input', () => { autoGrow(); renderComposerState(); updateSlash(); });
  input.addEventListener('click', updateSlash);
  input.addEventListener('blur', () => setTimeout(closeSlash, 120));
  input.addEventListener('keydown', e => {
    if (slashKey(e)) return;
    if (e.key === 'Tab' && !e.shiftKey && slashQuery() !== null) {
      e.preventDefault();
      updateSlash().then(() => { if (slash.items.length) pickSlash(slash.sel || 0); });
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
  $('#composer').addEventListener('submit', e => { e.preventDefault(); if (S.view && S.view.runId) stop(); else send(input.value); });
  $('#folderBtn').onclick = () => {
    const v = S.view; if (!v || v.id || v.turns.length) return;
    folderPicker(v.cwd, p => { v.cwd = p; renderComposerState(); });
  };
  $('#permSel').value = S.settings.perm;
  $('#debateToggle').onclick = toggleDebate;
  $('#modelSel').onchange = () => {
    const val = $('#modelSel').value;
    if (lockedMode()) S.view.claudeModel = val;
    else if (inChatProject()) { S.settings.chatModel = val; saveSettings(); }
    else { S.settings.model = val; saveSettings(); }
    renderComposerState();
  };
  $('#permSel').onchange = () => { S.settings.perm = $('#permSel').value; saveSettings(); renderComposerState(); };

  $('#suggestions').innerHTML = SUGGESTIONS.map((s, i) => `<button class="sugg" data-k="${i}">${I[s.icon]}${esc(s.label)}</button>`).join('');
  $$('#suggestions .sugg').forEach(b => b.onclick = () => { input.value = SUGGESTIONS[+b.dataset.k].text; autoGrow(); renderComposerState(); input.focus(); });

  // code copy buttons
  $('#thread').addEventListener('click', e => {
    const b = e.target.closest('.copy-code'); if (!b) return;
    copyText(b.closest('.code-block').querySelector('code').textContent);
    b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1400);
  });

  // drop files onto a project page to add them
  const pp = $('#projectPage');
  pp.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); pp.classList.toggle('dragging', !e.target.closest('#composer')); } });
  pp.addEventListener('dragleave', e => { if (e.target === pp || !pp.contains(e.relatedTarget)) pp.classList.remove('dragging'); });
  pp.addEventListener('drop', e => {
    pp.classList.remove('dragging');
    if (e.target.closest('#composer')) return; // dropped on the message box: attach to the message
    e.preventDefault(); e.__handledByProject = true;
    const f = [...(e.dataTransfer.files || [])]; if (f.length) uploadFiles(f);
  });

  const sc = $('#scroller');
  sc.addEventListener('scroll', () => { $('#jumpBtn').hidden = nearBottom(); }, { passive: true });
  $('#jumpBtn').onclick = () => { sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' }); };

  document.addEventListener('mousedown', e => { if (!e.target.closest('#menu') && !$('#menu').hidden) hideMenu(); });
  window.addEventListener('resize', hideMenu);
  document.addEventListener('keydown', e => {
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    else if (mod && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); }
    else if (mod && e.key === 'b' && !e.shiftKey) { e.preventDefault(); toggleCollapse(); }
    else if (e.key === 'Escape') {
      if (!$('#menu').hidden) { hideMenu(); return; }
      if ($('#modalRoot').children.length) return;
      if (S.view && S.view.runId) { e.preventDefault(); stop(); }
      else if ($('#app').classList.contains('mobile-open')) closeMobileSidebar();
    } else if (!mod && !e.altKey && e.key.length === 1 && document.activeElement === document.body && !$('#modalRoot').children.length) {
      input.focus();
    }
  });
  window.addEventListener('hashchange', route);
}

async function init() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('shell') === 'electron') document.documentElement.classList.add('is-app', 'os-' + (qs.get('os') || 'other'));
  applyTheme();
  bind();
  bindAttachments();
  enhanceSelect($('#modelSel'));
  enhanceSelect($('#permSel'));
  try { S.info = await api('/api/info'); } catch { S.info = { home: '', user: '' }; }
  updateProfile();
  if (!S.settings.cwd) S.settings.cwd = S.info.defaultCwd || S.info.home || '';
  $('#greeting').textContent = greeting();
  await Promise.all([refreshSessions(), refreshRuns()]);
  route();
  setInterval(refreshRuns, 2500);
  checkApp(); setInterval(checkApp, 60000);
  loadUsage(); setInterval(loadUsage, 60000);
  loadAi();
  loadSync(); setInterval(loadSync, 30000);
  setInterval(() => { if (!S.runs.length) refreshSessions(); }, 20000);
  window.addEventListener('focus', () => refreshSessions());
}
init();
