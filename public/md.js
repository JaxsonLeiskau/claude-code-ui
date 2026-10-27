/* Small, dependency-free Markdown renderer (GFM subset) */
(function () {
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = esc(s);
    s = s
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)'"])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\w])__([^_]+)__(?!\w)/g, '$1<strong>$2</strong>')
      .replace(/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/(^|[^\w])_([^_\s](?:[^_]*[^_\s])?)_(?!\w)/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  }

  const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const isBlockStart = l => /^\s*```/.test(l) || /^#{1,6}\s/.test(l) || /^\s*>/.test(l) || LIST.test(l) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);

  function list(lines) {
    let html = ''; const stack = [];
    for (const l of lines) {
      const m = l.match(LIST);
      if (!m) { if (l.trim()) html += ' ' + inline(l.trim()); continue; }
      const ind = m[1].replace(/\t/g, '    ').length;
      const type = /\d/.test(m[2]) ? 'ol' : 'ul';
      while (stack.length && ind < stack[stack.length - 1].indent) html += `</li></${stack.pop().type}>`;
      if (!stack.length || ind > stack[stack.length - 1].indent) {
        const n = parseInt(m[2], 10);
        stack.push({ indent: ind, type });
        html += `<${type}${type === 'ol' && n !== 1 ? ` start="${n}"` : ''}><li>`;
      } else html += '</li><li>';
      const task = m[3].match(/^\[([ xX])\]\s+(.*)/);
      html += task ? `<span class="task ${task[1] !== ' ' ? 'done' : ''}"></span>${inline(task[2])}` : inline(m[3]);
    }
    while (stack.length) html += `</li></${stack.pop().type}>`;
    return html;
  }

  function table(rows) {
    const cells = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const head = cells(rows[0]);
    const align = cells(rows[1]).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : '');
    const td = (tag, c, i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ''}>${inline(c)}</${tag}>`;
    let h = '<div class="table-wrap"><table><thead><tr>' + head.map((c, i) => td('th', c, i)).join('') + '</tr></thead><tbody>';
    for (const r of rows.slice(2)) h += '<tr>' + cells(r).map((c, i) => td('td', c, i)).join('') + '</tr>';
    return h + '</tbody></table></div>';
  }

  function render(src) {
    const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    let out = '', i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^\s*(```+|~~~+)\s*([\w+#.-]*)/);
      if (fence) {
        const close = fence[1]; const lang = fence[2] || '';
        const body = []; i++;
        while (i < lines.length && !lines[i].trim().startsWith(close)) body.push(lines[i++]);
        i++;
        out += `<div class="code-block"><div class="code-head"><span>${esc(lang || 'text')}</span><button class="copy-code" type="button">Copy</button></div><pre><code>${esc(body.join('\n'))}</code></pre></div>`;
        continue;
      }
      if (!line.trim()) { i++; continue; }
      const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) { out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out += '<hr>'; i++; continue; }
      if (/^\s*>/.test(line)) {
        const q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
        out += `<blockquote>${render(q.join('\n'))}</blockquote>`;
        continue;
      }
      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        const rows = [];
        while (i < lines.length && lines[i].includes('|')) rows.push(lines[i++]);
        out += table(rows);
        continue;
      }
      if (LIST.test(line)) {
        const block = [];
        while (i < lines.length) {
          const l = lines[i];
          if (LIST.test(l) || (l.trim() && /^\s+/.test(l))) { block.push(l); i++; }
          else if (!l.trim() && i + 1 < lines.length && (LIST.test(lines[i + 1]) || /^\s+\S/.test(lines[i + 1]))) i++;
          else break;
        }
        out += list(block);
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      out += `<p>${para.map(inline).join('<br>')}</p>`;
    }
    return out;
  }

  window.renderMarkdown = render;
})();
