// Test double: a minimal in-memory fake of the GitHub REST endpoints the sync uses.
const http = require('http');
const crypto = require('crypto');
const port = +process.argv[2] || 0;
const blobs = new Map(), trees = new Map(), commits = new Map();
let ref = null; // head commit sha of main
const sha1 = s => crypto.createHash('sha1').update(s).digest('hex');
const putBlob = buf => { const s = sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])); blobs.set(s, buf); return s; };
const putTree = map => { const s = sha1('tree' + JSON.stringify([...map].sort())); trees.set(s, new Map(map)); return s; };
let calls = 0;
http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    calls++;
    const send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.headers.authorization !== 'Bearer tok-good') return send(401, { message: 'Bad credentials' });
    const u = req.url.replace(/^\/api/, ''); const body = b ? JSON.parse(b) : {};
    let m;
    if (u === '/user') return send(200, { login: 'JaxsonLeiskau' });
    if (u === '/__stats') return send(200, { calls, files: ref ? [...trees.get(commits.get(ref).tree).keys()] : [] });
    if ((m = u.match(/^\/repos\/([^/]+)\/([^/]+)$/))) return m[2] === 'public-repo' ? send(200, { private: false, permissions: { push: true }, default_branch: 'main' }) : m[2] === 'roundtable-sync' ? send(200, { private: true, permissions: { push: true }, default_branch: 'main' }) : send(404, { message: 'Not Found' });
    const R = u.replace(/^\/repos\/[^/]+\/[^/]+/, '');
    if (R === '/git/ref/heads/main') return ref ? send(200, { object: { sha: ref } }) : send(409, { message: 'Git Repository is empty.' });
    if (R === '/contents/README.md' && req.method === 'PUT') {
      const t = putTree(new Map([['README.md', putBlob(Buffer.from(body.content, 'base64'))]]));
      const c = sha1('c' + t + Date.now()); commits.set(c, { tree: t, parents: [] }); ref = c; return send(201, {});
    }
    if ((m = R.match(/^\/git\/commits\/(\w+)$/))) return send(200, { sha: m[1], tree: { sha: commits.get(m[1]).tree } });
    if ((m = R.match(/^\/git\/trees\/(\w+)\?recursive=1$/))) return send(200, { truncated: false, tree: [...trees.get(m[1])].map(([path, sha]) => ({ path, sha, type: 'blob' })) });
    if ((m = R.match(/^\/git\/blobs\/(\w+)$/))) return send(200, { content: blobs.get(m[1]).toString('base64'), encoding: 'base64' });
    if (R === '/git/blobs' && req.method === 'POST') return send(201, { sha: putBlob(Buffer.from(body.content, 'base64')) });
    if (R === '/git/trees' && req.method === 'POST') {
      const map = new Map(trees.get(body.base_tree));
      for (const e of body.tree) { if (e.sha === null) map.delete(e.path); else map.set(e.path, e.sha); }
      return send(201, { sha: putTree(map) });
    }
    if (R === '/git/commits' && req.method === 'POST') { const c = sha1('c' + body.tree + Math.random()); commits.set(c, { tree: body.tree, parents: body.parents }); return send(201, { sha: c }); }
    if (R === '/git/refs/heads/main' && req.method === 'PATCH') {
      if (!commits.get(body.sha).parents.includes(ref)) return send(422, { message: 'Update is not a fast forward' });
      ref = body.sha; return send(200, {});
    }
    send(404, { message: 'Not Found ' + req.method + ' ' + u });
  });
}).listen(port, '127.0.0.1');
