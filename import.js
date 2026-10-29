'use strict';
/*
 * Import a claude.ai data export (Settings → Privacy → Export data on claude.ai).
 * The export is a .zip with conversations.json and usually projects.json (and sometimes
 * memories.json). Conversations become "Claude" chats here, projects become chat projects
 * with their instructions, knowledge documents and memory. Importing again updates what
 * changed instead of making duplicates.
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');

/* ---------------- minimal zip reader ---------------- */
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('That file isn\'t a zip archive.');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (off === 0xffffffff) throw new Error('This export is too large to read (over 4 GB).');
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28), elen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nlen);
    entries.set(name, () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + csize);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`Unsupported compression in ${name}`);
    });
    off += 46 + nlen + elen + clen;
  }
  return entries;
}
function findJson(entries, base) {
  for (const [name, get] of entries) if (path.posix.basename(name).toLowerCase() === base) return JSON.parse(get().toString('utf8'));
  return null;
}

/* ---------------- mapping ---------------- */
const hex = uuid => String(uuid || '').toLowerCase().replace(/[^0-9a-f]/g, '');
const chatIdFor = uuid => 'a-' + hex(uuid).slice(0, 32);
const projectIdFor = uuid => 'p-' + hex(uuid).slice(0, 12);
const safe = n => String(n || 'file').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').trim().slice(0, 120) || 'file';

function messageText(m) {
  if (Array.isArray(m.content) && m.content.length) {
    const parts = [];
    for (const b of m.content) {
      if (!b) continue;
      if (b.type === 'text' && b.text) parts.push(b.text);
      else if (b.type === 'tool_use' && b.name) parts.push(`_(used ${b.name})_`);
    }
    if (parts.length) return parts.join('\n\n');
  }
  return typeof m.text === 'string' ? m.text : '';
}

async function importExport(buf, D) {
  // D: { APP_DIR, UPLOADS_DIR, CHATS_DIR, store, saveProjects, filesDir, memoryFile, loadChat, saveChat }
  let conversations, projects = null, memories = null;
  const t = buf.subarray(0, 1).toString();
  if (t === '[' || t === '{') {
    conversations = JSON.parse(buf.toString('utf8'));
  } else {
    const z = readZip(buf);
    conversations = findJson(z, 'conversations.json');
    projects = findJson(z, 'projects.json');
    memories = findJson(z, 'memories.json');
    if (!conversations && !projects) throw new Error('Couldn\'t find conversations.json in that file. Make sure it\'s the export from claude.ai (Settings → Privacy → Export data).');
  }
  if (conversations && !Array.isArray(conversations)) conversations = conversations.conversations || [];
  const out = { projects: 0, projectsUpdated: 0, chats: 0, chatsUpdated: 0, skipped: 0, documents: 0 };
  const now = new Date().toISOString();

  // projects → chat projects
  for (const p of Array.isArray(projects) ? projects : []) {
    if (!p || !p.uuid || p.is_starter_project) continue;
    const id = projectIdFor(p.uuid);
    const cur = D.store.projects[id];
    const fresh = { id, kind: 'chat', name: String(p.name || 'Imported project').slice(0, 120), description: String(p.description || '').slice(0, 1000), instructions: String(p.prompt_template || p.instructions || ''), memoryEnabled: true, created: p.created_at || now, updated: p.updated_at || now, importedFrom: 'claude.ai', importedAt: now };
    if (!cur) { D.store.projects[id] = fresh; out.projects++; }
    else if ((!cur.importedAt || (cur.updated || '') <= cur.importedAt) && ['name', 'description', 'instructions'].some(k => cur[k] !== fresh[k])) {
      Object.assign(cur, { ...fresh, created: cur.created, memoryEnabled: cur.memoryEnabled }); out.projectsUpdated++;
    }
    const dir = D.filesDir(id);
    await fsp.mkdir(dir, { recursive: true });
    for (const doc of Array.isArray(p.docs) ? p.docs : []) {
      if (!doc || typeof doc.content !== 'string') continue;
      let name = safe(doc.filename || doc.name || 'document');
      if (!/\.[a-z0-9]{1,6}$/i.test(name)) name += '.md';
      const fp = path.join(dir, name);
      if (!fs.existsSync(fp) || (await fsp.readFile(fp, 'utf8')) !== doc.content) { await fsp.writeFile(fp, doc.content); out.documents++; }
    }
  }
  // project memory, when the export has it
  const memList = Array.isArray(memories) ? memories : memories ? [memories] : [];
  for (const m of memList) {
    const pm = m && m.project_memories;
    if (!pm || typeof pm !== 'object') continue;
    for (const [uuid, text] of Object.entries(pm)) {
      const id = projectIdFor(uuid);
      if (!D.store.projects[id] || typeof text !== 'string' || !text.trim()) continue;
      const mf = D.memoryFile(id);
      if (!fs.existsSync(mf)) { await fsp.mkdir(path.dirname(mf), { recursive: true }); await fsp.writeFile(mf, text.trim() + '\n'); D.store.projects[id].memoryUpdated = now; }
    }
  }
  D.saveProjects();

  // conversations → Claude chats
  for (const c of conversations || []) {
    const msgs = Array.isArray(c && c.chat_messages) ? c.chat_messages : [];
    if (!c || !c.uuid || !msgs.length) { out.skipped++; continue; }
    const id = chatIdFor(c.uuid);
    const updated = c.updated_at || c.created_at || now;
    const existing = await D.loadChat(id);
    if (existing && (existing.updated || '') >= updated) { out.skipped++; continue; } // nothing new (or continued here since)
    const messages = [];
    for (const m of msgs) {
      const text = messageText(m).trim();
      const ts = m.created_at || updated;
      if (m.sender === 'human' || m.sender === 'user') {
        const atts = [];
        for (const a of [...(m.attachments || []), ...(m.files || [])]) {
          if (!a) continue;
          const name = safe(a.file_name || a.name || 'attachment');
          if (typeof a.extracted_content === 'string' && a.extracted_content) {
            const sub = path.join(D.UPLOADS_DIR, 'claude-import', hex(c.uuid).slice(0, 12));
            await fsp.mkdir(sub, { recursive: true });
            const fname = /\.[a-z0-9]{1,6}$/i.test(name) && !/\.(pdf|docx?|pptx?|xlsx?)$/i.test(name) ? name : name + '.txt';
            await fsp.writeFile(path.join(sub, fname), a.extracted_content);
            atts.push({ id: path.relative(D.UPLOADS_DIR, path.join(sub, fname)).split(path.sep).join('/'), name, image: false });
          } else atts.push({ name, image: /\.(png|jpe?g|gif|webp)$/i.test(name) }); // the export leaves out file contents
        }
        if (text || atts.length) messages.push({ role: 'user', text, ts, ...(atts.length ? { attachments: atts } : {}) });
      } else if (text) messages.push({ role: 'assistant', text, speaker: 'Claude', ts });
    }
    if (!messages.length) { out.skipped++; continue; }
    const pid = c.project_uuid || (c.project && c.project.uuid);
    const chat = {
      id, kind: 'model', provider: 'claude', title: String(c.name || messages[0].text || 'Imported chat').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Imported chat',
      projectId: pid && D.store.projects[projectIdFor(pid)] ? projectIdFor(pid) : null,
      created: c.created_at || updated, updated, importedFrom: 'claude.ai', pinned: !!(existing && existing.pinned) || !!c.is_starred, messages,
    };
    await D.saveChat(chat);
    if (existing) out.chatsUpdated++; else out.chats++;
  }
  return out;
}

module.exports = { importExport, readZip, _ids: { chatIdFor, projectIdFor } };
