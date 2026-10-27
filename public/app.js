'use strict';
/* Claude Code UI — front end */

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
};
function applyIcons(root = document) { $$('[data-i]', root).forEach(el => { if (!el.firstChild) el.innerHTML = I[el.dataset.i] || ''; }); }

/* ---------------- state ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('ccui.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ccui.' + k, JSON.stringify(v)); } catch {} },
};
const S = {
  info: null, sessions: [], runs: [], loaded: false,
  filterProject: null, query: '', searchHits: null, showAllProjects: false,
  view: null, viewToken: 0,
  settings: Object.assign({ theme: 'system', name: '', model: '', perm: 'acceptEdits', cwd: '' }, store.get('settings', {})),
  allowed: store.get('allowed', {}),
};
const saveSettings = () => store.set('settings', S.settings);

async function api(url, opts = {}) {
  const init = { method: opts.method || 'GET', headers: {} };
  if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
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
  try { const { sessions } = await api('/api/sessions'); S.sessions = sessions; S.loaded = true; }
  catch (e) { toast('Could not load chats: ' + e.message); }
  renderSidebar();
  if (S.view && S.view.id) {
    const s = S.sessions.find(x => x.id === S.view.id);
    if (s) { S.view.title = s.title; S.view.pinned = s.pinned; renderHeader(); }
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
  el.innerHTML = `${running ? `<span class="running-dot">${I.spinner}</span>` : ''}<span class="t">${esc(s.title)}</span>${!S.filterProject ? `<span class="proj-tag">${esc(baseName(s.cwd))}</span>` : ''}<button class="more" title="More">${I.dots}</button>`;
  el.addEventListener('click', e => {
    if (e.target.closest('.more')) return;
    go(s.id);
  });
  el.querySelector('.more').addEventListener('click', e => { e.stopPropagation(); chatMenu(s, e.currentTarget); });
  el.addEventListener('contextmenu', e => { e.preventDefault(); chatMenu(s, { x: e.clientX, y: e.clientY }); });
  return el;
}

function renderSidebar() {
  const q = S.query.trim().toLowerCase();
  const running = new Set(S.runs.map(r => r.sessionId).filter(Boolean));
  let list = S.sessions;
  if (S.filterProject) list = list.filter(s => s.cwd === S.filterProject);
  if (q) list = list.filter(s => s.title.toLowerCase().includes(q) || (s.cwd || '').toLowerCase().includes(q) || (S.searchHits && S.searchHits.has(s.id)));

  // projects
  const projSec = $('#projectsSec'), projList = $('#projectList');
  projSec.hidden = !!q || S.filterProject != null;
  const byCwd = new Map();
  for (const s of S.sessions) {
    const p = byCwd.get(s.cwd) || { cwd: s.cwd, count: 0, updated: s.updated };
    p.count++; if (s.updated > p.updated) p.updated = s.updated; byCwd.set(s.cwd, p);
  }
  const projects = [...byCwd.values()].sort((a, b) => b.updated.localeCompare(a.updated));
  projList.innerHTML = '';
  const shown = S.showAllProjects ? projects : projects.slice(0, 5);
  for (const p of shown) {
    const el = document.createElement('div');
    el.className = 'sb-proj';
    el.title = homeify(p.cwd);
    el.innerHTML = `${I.folder}<span class="t">${esc(baseName(p.cwd))}</span><span class="count">${p.count}</span><button class="add" title="New chat in ${esc(baseName(p.cwd))}">${I.plus}</button>`;
    el.addEventListener('click', e => {
      if (e.target.closest('.add')) { newChat(p.cwd); return; }
      S.filterProject = p.cwd; renderSidebar(); $('#sbScroll').scrollTop = 0;
    });
    projList.appendChild(el);
  }
  if (projects.length > 5) {
    const more = document.createElement('button');
    more.className = 'sb-more';
    more.textContent = S.showAllProjects ? 'Show less' : `Show all ${projects.length}`;
    more.onclick = () => { S.showAllProjects = !S.showAllProjects; renderSidebar(); };
    projList.appendChild(more);
  }
  if (!projects.length) projList.innerHTML = `<div class="sb-empty">Folders you use with Claude Code will show up here.</div>`;

  // filter chip
  const fb = $('#filterBar');
  fb.hidden = !S.filterProject;
  if (S.filterProject) {
    fb.innerHTML = `<div class="filter-chip">${I.folder}<span class="t" title="${esc(homeify(S.filterProject))}">${esc(homeify(S.filterProject))}</span><button class="icon-btn tiny" title="New chat here">${I.plus}</button><button class="icon-btn tiny" title="Clear filter">${I.x}</button></div>`;
    const [addB, clearB] = $$('button', fb);
    addB.onclick = () => newChat(S.filterProject);
    clearB.onclick = () => { S.filterProject = null; renderSidebar(); };
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
  const pendingNew = S.runs.filter(r => r.sessionId && !S.sessions.some(s => s.id === r.sessionId) && (!S.filterProject || r.cwd === S.filterProject));
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
    rl.innerHTML = `<div class="sb-empty">${!S.loaded ? 'Loading…' : q ? 'No chats match your search.' : S.filterProject ? 'No chats in this folder yet.' : 'No Claude Code chats yet. Start one!'}</div>`;
  }
}

function chatMenu(s, anchor) {
  showMenu(anchor, [
    { icon: 'star', label: s.pinned ? 'Unstar' : 'Star', run: () => setPinned(s.id, !s.pinned) },
    { icon: 'edit', label: 'Rename', run: () => renameDialog(s.id, s.title) },
    { icon: 'folder', label: 'Show chats in this folder', run: () => { S.filterProject = s.cwd; renderSidebar(); } },
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
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  $$('[data-close]', back).forEach(b => b.addEventListener('click', close));
  $('#modalRoot').appendChild(back);
  applyIcons(back);
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
    body: `<p>“${esc(title)}” will be removed from your Claude Code history. The transcript is moved to <code>${esc(homeify((S.info && S.info.appDir) || '~/.claude-code-ui'))}/trash</code>, so you can recover it by hand if you need to.</p>`,
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

function settingsDialog() {
  const st = S.settings;
  const m = modal({
    title: 'Settings',
    wide: true,
    body: `
      <label class="field"><span>What should Claude call you?</span><input class="input" id="setName" value="${esc(st.name)}" placeholder="${esc((S.info && S.info.user) || '')}"></label>
      <div class="field"><span>Appearance</span><div class="seg" id="setTheme">
        ${['system', 'light', 'dark'].map(t => `<button data-v="${t}" class="${st.theme === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
      </div></div>
      <label class="field"><span>Default folder for new chats</span>
        <div class="input-row"><input class="input" id="setCwd" value="${esc(st.cwd)}" style="font-family:var(--mono);font-size:13px"><button class="btn" id="setBrowse">Browse</button></div>
      </label>
      <div class="input-row">
        <label class="field" style="flex:1"><span>Default model</span><select class="input" id="setModel">${$('#modelSel').innerHTML}</select></label>
        <label class="field" style="flex:1"><span>Default permissions</span><select class="input" id="setPerm">${$('#permSel').innerHTML}</select></label>
      </div>
      <div class="about">
        Claude Code CLI: <code>${esc((S.info && S.info.version) || 'not found')}</code><br>
        Sessions are read from <code>${esc(homeify(S.info && S.info.projectsDir))}</code><br>
        Keyboard: <code>Enter</code> send · <code>Shift+Enter</code> new line · <code>${isMac ? '⌘' : 'Ctrl'}+K</code> search · <code>${isMac ? '⌘' : 'Ctrl'}+Shift+O</code> new chat · <code>Esc</code> stop
      </div>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="setSave">Save</button>`,
  });
  $('#setModel', m.el).value = st.model;
  $('#setPerm', m.el).value = st.perm;
  let theme = st.theme;
  $$('#setTheme button', m.el).forEach(b => b.onclick = () => {
    theme = b.dataset.v; $$('#setTheme button', m.el).forEach(x => x.classList.toggle('on', x === b));
    S.settings.theme = theme; applyTheme();
  });
  $('#setBrowse', m.el).onclick = () => folderPicker($('#setCwd', m.el).value, p => { $('#setCwd', m.el).value = p; });
  const origTheme = st.theme;
  const cancel = () => { S.settings.theme = origTheme; applyTheme(); };
  $$('[data-close]', m.el).forEach(b => b.addEventListener('click', cancel));
  $('#setSave', m.el).onclick = () => {
    Object.assign(S.settings, {
      name: $('#setName', m.el).value.trim(), theme, cwd: $('#setCwd', m.el).value.trim(),
      model: $('#setModel', m.el).value, perm: $('#setPerm', m.el).value,
    });
    saveSettings(); m.close();
    $('#modelSel').value = S.settings.model; $('#permSel').value = S.settings.perm;
    updateProfile(); renderComposerState(); $('#greeting').textContent = greeting();
    if (S.view && !S.view.id && !S.view.turns.length) { S.view.cwd = S.settings.cwd || S.view.cwd; renderComposerState(); }
  };
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
function route() {
  const m = location.hash.match(/^#\/c\/([\w-]+)/);
  if (m) { if (!S.view || S.view.id !== m[1]) openSession(m[1]); }
  else newChat();
}

function newChat(cwd) {
  S.viewToken++;
  S.view = { id: null, cwd: cwd || S.settings.cwd || (S.info && S.info.defaultCwd) || '', title: 'New chat', turns: [], runId: null, live: null, pinned: false };
  if (location.hash !== '#/' && location.hash !== '') history.pushState(null, '', '#/');
  renderAll();
  closeMobileSidebar();
  $('#input').focus();
}

async function openSession(id) {
  const token = ++S.viewToken;
  const s = S.sessions.find(x => x.id === id);
  S.view = { id, cwd: s ? s.cwd : '', title: s ? s.title : 'Loading…', turns: [], runId: null, live: null, pinned: s ? s.pinned : false, loading: true };
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
  Object.assign(S.view, { cwd: d.session.cwd, title: d.session.title, pinned: d.session.pinned, turns: d.turns, loading: false });
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
      v.turns.push({ role: 'user', text: ev.text });
      markDirty(v.turns.length - 1);
      v.live = null;
      liveTurn().startedAt = ev.t;
      break;
    }
    case 'claude': handleClaude(ev.data); break;
    case 'stderr': v.stderr = ((v.stderr || '') + ev.text).slice(-4000); break;
    case 'error': v.turns.push({ role: 'notice', kind: 'error', text: ev.text }); markDirty(v.turns.length - 1); break;
    case 'exit': {
      const t = v.live;
      markDirty(Math.max(0, t ? v.turns.indexOf(t) - 1 : v.turns.length - 1));
      if (t) {
        t.live = false;
        t.blocks = t.blocks.filter(b => !(b.draft && !b.text));
        t.blocks.forEach(b => { b.draft = false; if (b.type === 'tool' && b.status === 'running') b.status = ev.stopped ? 'error' : 'done'; });
        if (!t.blocks.length && !t.result && !t.denials) v.turns.splice(v.turns.indexOf(t), 1);
      }
      if (ev.stopped) v.turns.push({ role: 'notice', text: 'Stopped' });
      else if (ev.code && !(t && t.result)) {
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
    el.innerHTML = `<div class="bubble ${long ? 'long' : ''}">${esc(t.text)}${t.images ? `<span class="img-note">📎 ${t.images} image${t.images > 1 ? 's' : ''}</span>` : ''}</div>`;
    if (long) el.firstChild.onclick = () => { t.expanded = true; el.replaceWith(renderTurn(t, idx)); };
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
  let toolGroup = null;
  for (const b of t.blocks) {
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
  $('#chatTitle').textContent = v ? v.title : '';
  document.title = v && v.id ? `${v.title} · Claude Code` : 'Claude Code';
  const chip = $('#cwdChip');
  chip.textContent = v && v.id && v.cwd ? homeify(v.cwd) : '';
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
  sendBtn.disabled = !running && !$('#input').value.trim();
  const fb = $('#folderBtn');
  const locked = !!(v && (v.id || v.turns.length));
  fb.classList.toggle('locked', locked);
  fb.title = locked ? `Working in ${v.cwd}` : 'Choose working folder';
  $('#folderLabel').textContent = v ? (baseName(v.cwd) || homeify(v.cwd) || 'Choose folder') : '';
  $('#permSel').closest('.pill').classList.toggle('perm-bypass', $('#permSel').value === 'bypassPermissions');
  $('#input').placeholder = v && v.turns.length ? 'Reply to Claude…' : 'How can I help you today?';
}

function updateEmpty() {
  const v = S.view;
  const empty = !v || (!v.id && !v.turns.length && !v.loading);
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
  renderHeader();
  renderThread();
  renderComposerState();
  renderSidebar();
  updateEmpty();
}

/* ---------------- sending ---------------- */
async function send(text) {
  text = (text || '').trim();
  const v = S.view;
  if (!text || !v || v.runId) return;
  if (!v.cwd) { toast('Pick a folder for Claude to work in first'); folderPicker('', p => { v.cwd = p; renderComposerState(); }); return; }
  const token = S.viewToken;
  const input = $('#input');
  input.value = ''; autoGrow(); renderComposerState();
  try {
    const r = await api('/api/chat', {
      method: 'POST',
      body: { sessionId: v.id, prompt: text, cwd: v.cwd, model: $('#modelSel').value, permissionMode: $('#permSel').value, allowedTools: S.allowed[v.id || 'new'] || [] },
    });
    if (token !== S.viewToken) return;
    if (!v.id && S.settings.cwd !== v.cwd) { /* remember last-used folder */ S.settings.cwd = v.cwd; saveSettings(); }
    attach(r.runId, token);
    setTimeout(refreshRuns, 600);
    scrollToBottom(true);
  } catch (e) {
    toast(e.message);
    if (!input.value) input.value = text;
    autoGrow(); renderComposerState();
  }
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
  $('#newChatBtn').onclick = () => newChat(S.filterProject || undefined);
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
  $('#settingsBtn').onclick = settingsDialog;

  $('#titleBtn').onclick = e => {
    const v = S.view; if (!v || !v.id) return;
    const s = S.sessions.find(x => x.id === v.id) || { id: v.id, title: v.title, cwd: v.cwd, pinned: v.pinned };
    chatMenu(s, e.currentTarget);
  };
  $('#starBtn').onclick = () => S.view && S.view.id && setPinned(S.view.id, !S.view.pinned);
  $('#cwdChip').onclick = () => { if (S.view && S.view.cwd) { copyText(S.view.cwd); toast('Copied folder path'); } };

  const input = $('#input');
  input.addEventListener('input', () => { autoGrow(); renderComposerState(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
  $('#composer').addEventListener('submit', e => { e.preventDefault(); if (S.view && S.view.runId) stop(); else send(input.value); });
  $('#folderBtn').onclick = () => {
    const v = S.view; if (!v || v.id || v.turns.length) return;
    folderPicker(v.cwd, p => { v.cwd = p; renderComposerState(); });
  };
  $('#modelSel').value = S.settings.model;
  $('#permSel').value = S.settings.perm;
  $('#modelSel').onchange = () => { S.settings.model = $('#modelSel').value; saveSettings(); };
  $('#permSel').onchange = () => { S.settings.perm = $('#permSel').value; saveSettings(); renderComposerState(); };

  $('#suggestions').innerHTML = SUGGESTIONS.map((s, i) => `<button class="sugg" data-k="${i}">${I[s.icon]}${esc(s.label)}</button>`).join('');
  $$('#suggestions .sugg').forEach(b => b.onclick = () => { input.value = SUGGESTIONS[+b.dataset.k].text; autoGrow(); renderComposerState(); input.focus(); });

  // code copy buttons
  $('#thread').addEventListener('click', e => {
    const b = e.target.closest('.copy-code'); if (!b) return;
    copyText(b.closest('.code-block').querySelector('code').textContent);
    b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1400);
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
  try { S.info = await api('/api/info'); } catch { S.info = { home: '', user: '' }; }
  updateProfile();
  if (!S.settings.cwd) S.settings.cwd = S.info.defaultCwd || S.info.home || '';
  $('#greeting').textContent = greeting();
  await Promise.all([refreshSessions(), refreshRuns()]);
  route();
  setInterval(refreshRuns, 2500);
  setInterval(() => { if (!S.runs.length) refreshSessions(); }, 20000);
  window.addEventListener('focus', () => refreshSessions());
}
init();
