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
function readZip(buf, { maxEntry } = {}) {
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
      if (method === 8) return zlib.inflateRawSync(data, maxEntry ? { maxOutputLength: maxEntry } : {});
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

/* ---------------- text from Word, PowerPoint and Excel files ---------------- */
// These files are zips of XML. The text is pulled out so every chat can read it (Claude's file
// reader and the other AIs can't open them as they are). Formatting and pictures are left out.
const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const unxml = s => s.replace(/<[^>]+>/g, '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => {
  if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? all;
  const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
});
const tidy = s => s.split('\n').map(l => l.replace(/[ \t]*\|[ \t]*$/, '').replace(/ +\| +/g, ' | ').trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
const xmlOf = (entries, name) => { const get = entries.get(name); return get ? get().toString('utf8') : ''; };
// relationship id -> part name, for parts that point at each other (slide order, sheet names)
function rels(entries, part) {
  const dir = path.posix.dirname(part), out = new Map();
  const xml = xmlOf(entries, `${dir}/_rels/${path.posix.basename(part)}.rels`);
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/\bId="([^"]+)"/) || [])[1], target = (m[0].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) out.set(id, target.startsWith('/') ? target.slice(1) : path.posix.normalize(`${dir}/${target}`));
  }
  return out;
}
const byNumber = (a, b) => +(a.match(/(\d+)\.xml$/) || [0, 0])[1] - +(b.match(/(\d+)\.xml$/) || [0, 0])[1];

// Only the typed text (w:t / a:t runs) is kept, so picture positions and other numbers in the XML stay out.
// Table cells become "a | b" on one line.
function runsText(xml, ns) {
  const re = new RegExp(`<${ns}:t(?:\\s[^>]*)?>([\\s\\S]*?)</${ns}:t>|<${ns}:tab/>|<${ns}:(?:br|cr)\\b[^>]*/>|</${ns}:p>|<${ns}:tc\\b[^>]*[^/]>|<${ns}:tc>|</${ns}:tc>|</${ns}:tr>`, 'g');
  let out = '', cell = 0;
  for (const m of xml.matchAll(re)) {
    const tok = m[0];
    if (m[1] !== undefined) out += unxml(m[1]);
    else if (tok.endsWith('tab/>')) out += '\t';
    else if (tok.endsWith('/>')) out += '\n';
    else if (tok === `</${ns}:p>`) out += cell ? ' ' : '\n';
    else if (tok === `</${ns}:tc>`) { cell = Math.max(0, cell - 1); out += ' | '; }
    else if (tok === `</${ns}:tr>`) out += '\n';
    else cell++;
  }
  return tidy(out);
}
function wordText(entries) {
  const xml = xmlOf(entries, 'word/document.xml')
    .replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '') // text boxes are stored twice
    .replace(/<w:(instrText|delText)\b[^>]*>[\s\S]*?<\/w:\1>/g, ''); // field codes and deleted text
  return runsText(xml, 'w');
}
function slidesText(entries) {
  const pres = 'ppt/presentation.xml', r = rels(entries, pres);
  let slides = [...xmlOf(entries, pres).matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map(m => r.get(m[1])).filter(n => n && entries.has(n));
  if (!slides.length) slides = [...entries.keys()].filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(byNumber);
  const text = part => runsText(xmlOf(entries, part).replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, ''), 'a');
  return slides.map((s, i) => {
    const notes = [...rels(entries, s).values()].find(t => /notesSlide\d+\.xml$/.test(t));
    const n = notes ? text(notes).replace(/^\d+$/gm, '').trim() : ''; // notes pages also hold the slide number
    return `## Slide ${i + 1}\n${text(s) || '(no text on this slide)'}${n ? `\n\nSpeaker notes:\n${n}` : ''}`;
  }).join('\n\n');
}
function sheetsText(entries) {
  const shared = [...xmlOf(entries, 'xl/sharedStrings.xml').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => unxml([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const wb = 'xl/workbook.xml', r = rels(entries, wb);
  let sheets = [...xmlOf(entries, wb).matchAll(/<sheet\b[^>]*>/g)].map(m => ({ name: unxml((m[0].match(/\bname="([^"]*)"/) || [])[1] || ''), part: r.get((m[0].match(/\br:id="([^"]+)"/) || [])[1]) })).filter(s => s.part && entries.has(s.part));
  if (!sheets.length) sheets = [...entries.keys()].filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort(byNumber).map((part, i) => ({ name: `Sheet${i + 1}`, part }));
  const col = ref => [...(ref.match(/^[A-Z]+/i) || [''])[0].toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return sheets.map(({ name, part }) => {
    const rows = [];
    for (const row of xmlOf(entries, part).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], body = c[2] || '';
        const t = (attrs.match(/\bt="([^"]+)"/) || [])[1], v = unxml((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '');
        const val = t === 's' ? shared[+v] ?? '' : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE') : t === 'inlineStr' ? unxml(body.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')) : v;
        const at = col((attrs.match(/\br="([A-Z]+)/i) || [])[1] || '');
        cells[at >= 0 ? at : cells.length] = val.replace(/[\t\n]+/g, ' ');
      }
      if (cells.some(x => x)) rows.push(Array.from(cells, x => x ?? '').join('\t').replace(/\t+$/, ''));
    }
    return `## Sheet: ${name}\n${rows.join('\n')}`;
  }).join('\n\n');
}
/** The text of a .docx, .pptx or .xlsx file ('' if there's none). Throws if it isn't one. */
function officeText(buf, ext) {
  const entries = readZip(buf, { maxEntry: 300e6 });
  const kind = String(ext).toLowerCase().replace(/^\./, '');
  const text = kind === 'docx' ? wordText(entries) : kind === 'pptx' ? slidesText(entries) : kind === 'xlsx' ? sheetsText(entries) : null;
  if (text === null) throw new Error('Not a Word, PowerPoint or Excel file');
  return text.length > 2e6 ? text.slice(0, 2e6) + '\n\n(The rest of the file was cut off because it is so long.)' : text;
}

/* ---------------- text from PDFs (for the AIs that can't open them) ---------------- */
// shortcut: text-based PDFs only (no OCR, so scans give ''), no encrypted PDFs; fonts without a
// ToUnicode map are read as plain Latin-1, which is right for most simple fonts. Swap for a real
// PDF library if some PDFs come out garbled.
function pdfObjects(src) {
  const objs = new Map();
  const add = (num, body) => {
    const sm = body.match(/\bstream\r?\n/);
    if (!sm) { objs.set(num, { dict: body, data: null }); return; }
    const dict = body.slice(0, sm.index);
    const end = body.lastIndexOf('endstream');
    let raw = Buffer.from(body.slice(sm.index + sm[0].length, end < 0 ? body.length : end).replace(/\r?\n$/, ''), 'latin1');
    if (/\/FlateDecode/.test(dict)) {
      try { raw = zlib.inflateSync(raw); } catch { try { raw = zlib.inflateSync(raw, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch { raw = null; } }
    } else if (/\/Filter/.test(dict)) raw = null; // pictures and other encodings: not text
    objs.set(num, { dict, data: raw });
  };
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m, prev = null;
  while ((m = re.exec(src))) {
    if (prev) add(prev.num, src.slice(prev.at, m.index).replace(/endobj\s*$/, ''));
    prev = { num: +m[1], at: m.index + m[0].length };
    // skip over stream data so "N 0 obj" inside binary can't split an object
    const sm = /\bstream\r?\n/g; sm.lastIndex = re.lastIndex;
    const nextObj = src.slice(re.lastIndex, re.lastIndex + 4000).search(/\bendobj\b|\bstream\r?\n/);
    if (nextObj >= 0 && /^stream/.test(src.slice(re.lastIndex + nextObj, re.lastIndex + nextObj + 6))) {
      const e = src.indexOf('endstream', re.lastIndex + nextObj);
      if (e > 0) re.lastIndex = e;
    }
  }
  if (prev) add(prev.num, src.slice(prev.at).replace(/endobj[\s\S]*$/, ''));
  // objects packed inside object streams (most PDFs made by Word)
  for (const o of [...objs.values()]) {
    if (!o.data || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const first = +(o.dict.match(/\/First\s+(\d+)/) || [])[1], text = o.data.toString('latin1');
    const nums = text.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const end = i + 3 < nums.length ? nums[i + 3] : text.length - first;
      if (!objs.has(nums[i])) objs.set(nums[i], { dict: text.slice(first + nums[i + 1], first + end), data: null });
    }
  }
  return objs;
}
function pdfText(buf) {
  const src = buf.toString('latin1');
  if (/\/Encrypt\s/.test(src)) return '';
  const objs = pdfObjects(src);
  const get = v => { const r = typeof v === 'string' && v.match(/^\s*(\d+)\s+\d+\s+R/); return r ? objs.get(+r[1]) || null : null; };
  // a key's value in a dictionary: "5 0 R", "<<…>>", "[…]" (nesting counted) or a plain token
  const val = (dict, key) => {
    const i = dict.search(new RegExp(`/${key}(?![A-Za-z0-9])`));
    if (i < 0) return null;
    const s = dict.slice(i + key.length + 1).trimStart();
    const ref = s.match(/^\d+\s+\d+\s+R/); if (ref) return ref[0];
    const open = s.startsWith('<<') ? '<<' : s[0] === '[' ? '[' : null;
    if (!open) return (s.match(/^[^\s/>\]]+/) || [''])[0];
    const close = open === '<<' ? '>>' : ']';
    for (let j = 0, depth = 0; j < s.length; j++) {
      if (s.startsWith(open, j)) { depth++; j += open.length - 1; }
      else if (s.startsWith(close, j)) { depth--; j += close.length - 1; if (!depth) return s.slice(0, j + 1); }
    }
    return s;
  };
  const dictOf = v => { if (!v) return ''; const o = get(v); return o ? o.dict : v; };
  // ToUnicode maps: glyph code -> text
  const cmaps = new Map();
  const u16 = h => { let s = ''; for (let i = 0; i < h.length; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4).padEnd(4, '0'), 16)); return s; };
  const cmapFor = fontDict => {
    const ref = val(fontDict, 'ToUnicode'), o = get(ref);
    if (!o || !o.data) return /Identity-H/.test(fontDict) ? { map: new Map(), bytes: 2 } : null;
    if (cmaps.has(ref)) return cmaps.get(ref);
    const t = o.data.toString('latin1'), map = new Map();
    const cs = t.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
    for (const b of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const p of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(p[1], 16), u16(p[2]));
    for (const b of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const p of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16);
      if (p[3][0] === '[') [...p[3].matchAll(/<([0-9a-fA-F]*)>/g)].forEach((d, k) => map.set(lo + k, u16(d[1])));
      else { const d = p[3].slice(1, -1), base = parseInt(d.slice(-4) || '0', 16), pre = u16(d.slice(0, -4)); for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, pre + String.fromCharCode(base + c - lo)); }
    }
    const cm = { map, bytes: cs ? Math.max(1, cs[1].length / 2) : (/Identity-H/.test(fontDict) ? 2 : 1) };
    cmaps.set(ref, cm);
    return cm;
  };
  const decode = (bytes, font) => {
    if (!font) return Buffer.from(bytes).toString('latin1');
    let s = '';
    for (let i = 0; i + font.bytes <= bytes.length; i += font.bytes) {
      const code = font.bytes === 2 ? bytes[i] << 8 | bytes[i + 1] : bytes[i];
      s += font.map.get(code) ?? (font.bytes === 1 ? String.fromCharCode(code) : '');
    }
    return s;
  };
  // pages in reading order, with the resources (fonts) each one inherits
  const rootRef = (src.match(/\/Root\s+(\d+\s+\d+\s+R)/) || [])[1];
  const pages = [];
  const walk = (dict, inherited, depth) => {
    if (depth > 40) return;
    const res = val(dict, 'Resources') || inherited;
    if (/\/Type\s*\/Page(?!s)/.test(dict)) pages.push({ dict, res });
    const kids = val(dict, 'Kids');
    if (kids) for (const r of kids.matchAll(/(\d+)\s+\d+\s+R/g)) { const k = objs.get(+r[1]); if (k) walk(k.dict, res, depth + 1); }
  };
  const pagesRoot = rootRef ? dictOf(val(dictOf(rootRef), 'Pages')) : '';
  if (pagesRoot) walk(pagesRoot, null, 0);
  if (!pages.length) for (const o of objs.values()) if (/\/Type\s*\/Page(?!s)/.test(o.dict)) pages.push({ dict: o.dict, res: val(o.dict, 'Resources') });
  const out = [];
  for (const pg of pages) {
    const fonts = {};
    for (const f of dictOf(val(dictOf(pg.res), 'Font')).matchAll(/\/([^\s/<>[\]()]+)\s+(\d+\s+\d+\s+R)/g)) { const fo = get(f[2]); if (fo) fonts[f[1]] = cmapFor(fo.dict); }
    const parts = [...(val(pg.dict, 'Contents') || '').matchAll(/(\d+)\s+\d+\s+R/g)].map(r => (objs.get(+r[1]) || {}).data).filter(Boolean);
    out.push(pdfContentText(Buffer.concat(parts.flatMap(b => [b, Buffer.from('\n')])), fonts, decode));
  }
  return out.map(t => t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()).filter(Boolean).join('\n\n').slice(0, 2e6);
}
// Reads the text operators (Tj, TJ, ', ") of a page and where the lines break
function pdfContentText(data, fonts, decode) {
  let i = 0, out = '', font = null, lastY = null;
  const stack = [], n = data.length;
  const ws = c => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
  const str = () => {
    const b = []; let depth = 1; i++;
    while (i < n && depth) {
      let c = data[i++];
      if (c === 92) {
        c = data[i++];
        const esc = { 110: 10, 114: 13, 116: 9, 98: 8, 102: 12 }[c];
        if (esc !== undefined) b.push(esc);
        else if (c >= 48 && c <= 55) { let o = c - 48; for (let k = 0; k < 2 && data[i] >= 48 && data[i] <= 55; k++) o = o * 8 + data[i++] - 48; b.push(o & 255); }
        else if (c === 13 || c === 10) { if (c === 13 && data[i] === 10) i++; }
        else b.push(c);
      } else if (c === 40) { depth++; b.push(c); }
      else if (c === 41) { if (--depth) b.push(c); }
      else b.push(c);
    }
    return { bytes: b };
  };
  const hex = () => { i++; let h = ''; while (i < n && data[i] !== 62) h += String.fromCharCode(data[i++]); i++; h = h.replace(/[^0-9a-fA-F]/g, ''); if (h.length % 2) h += '0'; return { bytes: [...Buffer.from(h, 'hex')] }; };
  const show = s => { if (s && s.bytes) out += decode(s.bytes, font); };
  const top = k => stack[stack.length - k];
  while (i < n) {
    const c = data[i];
    if (ws(c)) { i++; continue; }
    if (c === 37) { while (i < n && data[i] !== 10 && data[i] !== 13) i++; continue; }
    if (c === 40) { stack.push(str()); continue; }
    if (c === 60 && data[i + 1] !== 60) { stack.push(hex()); continue; }
    if (c === 91) { stack.push('['); i++; continue; }
    if (c === 93) { const arr = []; while (stack.length && top(1) !== '[') arr.unshift(stack.pop()); stack.pop(); stack.push(arr); i++; continue; }
    let j = i + 1;
    while (j < n && !ws(data[j]) && ![37, 40, 41, 47, 60, 62, 91, 93, 123, 125].includes(data[j])) j++;
    const tok = data.toString('latin1', i, j); i = j;
    if (/^[/\-+.\d]/.test(tok) || '<>{}'.includes(tok)) { stack.push(tok); continue; }
    if (tok === 'BI') { const e = data.indexOf('EI', i); i = e < 0 ? n : e + 2; stack.length = 0; continue; } // inline picture
    if (tok === 'Tf') { const name = String(top(2) || '').slice(1); font = Object.prototype.hasOwnProperty.call(fonts, name) ? fonts[name] : null; }
    else if (tok === 'Tj') show(top(1));
    else if (tok === "'" || tok === '"') { out += '\n'; show(top(1)); }
    else if (tok === 'TJ' && Array.isArray(top(1))) for (const e of top(1)) { if (e && e.bytes) show(e); else if (parseFloat(e) < -200) out += ' '; }
    else if (tok === 'Td' || tok === 'TD') out += parseFloat(top(1)) ? '\n' : ' ';
    else if (tok === 'T*') out += '\n';
    else if (tok === 'Tm') { const y = parseFloat(top(1)); out += lastY !== null && Math.abs(y - lastY) > 1 ? '\n' : ' '; lastY = y; }
    else if (tok === 'ET') out += ' ';
    stack.length = 0;
  }
  return out;
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
  let entriesList = null;
  const conversations = [], projects = [], memories = [];
  const looseDocs = []; // text files in a projects zip, matched to projects by folder name below
  const isConversation = o => o && typeof o === 'object' && !Array.isArray(o) && (Array.isArray(o.chat_messages) || (Array.isArray(o.messages) && (o.uuid || o.id) && ('name' in o || 'created_at' in o)));
  const isProject = o => o && typeof o === 'object' && !Array.isArray(o) && !isConversation(o) && (o.uuid || o.id) && ('prompt_template' in o || Array.isArray(o.docs) || 'is_private' in o || 'is_starter_project' in o);
  const isManifest = o => o && Array.isArray(o.data_files) && o.data_files.some(f => f && f.export_url);
  // pull conversations / projects / memory out of whatever shape a JSON file has
  function collect(o, depth = 0) {
    if (depth > 3 || !o) return;
    if (Array.isArray(o)) { for (const x of o) collect(x, depth + 1); return; }
    if (typeof o !== 'object') return;
    if (isManifest(o)) {
      const names = o.data_files.map(f => f.filename).filter(Boolean);
      const err = new Error(`That's the list of download links, not the export itself. Download ${names.filter(n => /conversation|project/i.test(n)).join(' and ') || 'the files'} from the links in the email (or from this list), then choose those .zip files here — you can select them together.`);
      err.code = 'MANIFEST'; err.files = o.data_files.filter(f => f && /^https:\/\/claude\.ai\/export\//.test(f.export_url || '')).map(f => ({ url: f.export_url, filename: f.filename, category: f.category })); throw err;
    }
    if (isConversation(o)) return conversations.push(o);
    if (isProject(o)) return projects.push(o);
    if (o.project_memories || o.conversations_memory) return memories.push(o);
    for (const v of Object.values(o)) if (v && typeof v === 'object') collect(v, depth + 1);
  }
  const parse = (text, name) => {
    text = text.replace(/^﻿/, '');
    try { return collect(JSON.parse(text)); }
    catch (e) {
      if (e.code === 'MANIFEST') throw e;
      // one JSON object per line
      for (const line of text.split('\n')) if (line.trim()) try { collect(JSON.parse(line)); } catch {}
    }
  };
  const first = buf.subarray(0, 3).toString().replace(/^﻿/, '').trim()[0];
  if (first === '[' || first === '{') parse(buf.toString('utf8'), 'file');
  else {
    const z = readZip(buf);
    entriesList = [...z.keys()].slice(0, 30);
    for (const [name, get] of z) {
      if (name.endsWith('/')) continue;
      if (/\.(json|jsonl|ndjson)$/i.test(name)) { try { parse(get().toString('utf8'), name); } catch (e) { if (e.code === 'MANIFEST') throw e; } }
      else if (/\.(md|txt|markdown|csv|html?|xml|ya?ml|py|js|ts|json5?)$/i.test(name)) looseDocs.push({ name, get });
    }
    if (!conversations.length && !projects.length) {
      throw new Error(`No chats or projects found in that file. It contains: ${entriesList.join(', ') || 'nothing'}. Make sure it's from the claude.ai export (conversations-000.zip or projects-000.zip).`);
    }
  }
  // documents stored as separate files inside a project's folder
  for (const p of projects) {
    const key = String(p.uuid || p.id).toLowerCase();
    const mine = looseDocs.filter(d => d.name.toLowerCase().includes(key));
    if (mine.length) p.docs = [...(Array.isArray(p.docs) ? p.docs : []), ...mine.map(d => ({ filename: path.posix.basename(d.name), content: d.get().toString('utf8') }))];
    if (!p.uuid) p.uuid = p.id;
  }
  const files = entriesList || [];
  const out = { projects: 0, projectsUpdated: 0, chats: 0, chatsUpdated: 0, skipped: 0, documents: 0,
    found: { conversations: conversations.length, projects: projects.length }, alreadyHere: 0, empty: 0, files };
  const now = new Date().toISOString();

  // projects → chat projects
  for (const p of projects) {
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
  const memList = memories;
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

  // chats imported earlier (e.g. from a separate conversations file) join projects that arrive now
  if (projects.length) {
    const ids = new Set(projects.map(p => projectIdFor(p.uuid)));
    for (const f of await fsp.readdir(D.CHATS_DIR).catch(() => [])) {
      if (!f.endsWith('.json')) continue;
      const chat = await D.loadChat(f.slice(0, -5));
      if (chat && chat.importedProjectUuid && !chat.projectId && ids.has(projectIdFor(chat.importedProjectUuid)) && D.store.projects[projectIdFor(chat.importedProjectUuid)]) {
        chat.projectId = projectIdFor(chat.importedProjectUuid); await D.saveChat(chat); out.chatsUpdated++;
      }
    }
  }

  // conversations → Claude chats
  for (const c of conversations) {
    const msgs = Array.isArray(c && c.chat_messages) ? c.chat_messages : Array.isArray(c && c.messages) ? c.messages : [];
    const cid = c && (c.uuid || c.id);
    if (!c || !cid || !msgs.length) { out.skipped++; out.empty++; continue; }
    if (!c.uuid) c.uuid = cid;
    const id = chatIdFor(c.uuid);
    const updated = c.updated_at || c.created_at || now;
    const existing = await D.loadChat(id);
    if (existing && (existing.updated || '') >= updated) { out.skipped++; out.alreadyHere++; continue; } // nothing new (or continued here since)
    const messages = [];
    for (const m of msgs) {
      if (!m) continue;
      const text = messageText(m).trim();
      const ts = m.created_at || updated;
      const who = m.sender || m.role || (m.author && m.author.role);
      if (who === 'human' || who === 'user') {
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
    const pid = c.project_uuid || (c.project && (c.project.uuid || c.project.id)) || null;
    const chat = {
      importedProjectUuid: pid,
      id, kind: 'model', provider: 'claude', title: String(c.name || messages[0].text || 'Imported chat').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Imported chat',
      projectId: pid && D.store.projects[projectIdFor(pid)] ? projectIdFor(pid) : null,
      created: c.created_at || updated, updated, importedFrom: 'claude.ai', pinned: !!(existing && existing.pinned) || !!c.is_starred, messages,
    };
    await D.saveChat(chat);
    if (existing) out.chatsUpdated++; else out.chats++;
  }
  return out;
}

module.exports = { importExport, readZip, officeText, pdfText, _ids: { chatIdFor, projectIdFor } };
