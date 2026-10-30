// Test double: a fake OpenAI-compatible API (stands in for ChatGPT, Gemini and Open WebUI).
const http = require('http');
const [port, name] = [+process.argv[2], process.argv[3] || 'Model'];
http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', async () => {
    if (req.headers.authorization !== 'Bearer good-key') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } })); }
    if (req.url.endsWith('/models')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: 'test-model' }] })); }
    const j = JSON.parse(b); const last = j.messages[j.messages.length - 1].content;
    const sys = (j.messages.find(m => m.role === 'system') || {}).content || '';
    const parts = Array.isArray(last) ? last : [], lastText = Array.isArray(last) ? (parts.find(p => p.type === 'text') || {}).text || '' : last;
    // shows the tests that a project's earlier chats (with other AIs) were passed along
    const text = parts.some(p => p.type === 'file' && /^data:application\/pdf;base64,/.test(p.file.file_data)) ? `${name} got the PDF file.` : /Lab 7 \(IPsec\)/.test(lastText) ? `${name} read the PDF text.` : /Earlier chats in this project[\s\S]*Plan a trip/.test(sys) ? `${name} remembers the trip.` : /final answer/i.test(last) ? 'CONSENSUS: use Tailscale.' : /Revised answer/.test(last) ? `**Review:** ok\n**Revised answer:** ${name} agrees.` : `${name} answer.`;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    for (const w of text.match(/\S+\s*/g)) res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: w } }] }) + '\n\n');
    res.end('data: [DONE]\n\n');
  });
}).listen(port, '127.0.0.1');
