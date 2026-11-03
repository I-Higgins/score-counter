// Tiny static server for local development and the end-to-end tests.
// Serves the app files only (design/, docs/, tests/, scripts/ and node_modules are not served).
//   npm start                 → http://localhost:8080/
//   BASE=/my-app/ npm start   → test a GitHub Pages-style subpath
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.env.ROOT || '.');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};
const BLOCKED = /^\/(design|docs|tests|scripts|node_modules|\.git|\.github)(\/|$)/;

/**
 * Start the server. Returns the http.Server plus bump(): after a bump, sw.js is
 * served with a new VERSION, which looks like a new release to the browser.
 */
export function startServer(port = Number(process.env.PORT || 8080), base = '/') {
  let bumps = 0;
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith(base)) { res.writeHead(404).end('Not found'); return; }
    path = '/' + path.slice(base.length);
    if (path.endsWith('/')) path += 'index.html';
    const clean = normalize(path);
    if (BLOCKED.test(clean) || clean.includes('..')) { res.writeHead(404).end('Not found'); return; }
    const file = join(ROOT, clean);
    try {
      const s = await stat(file);
      if (!s.isFile()) throw new Error('not file');
      let body = await readFile(file);
      if (clean === '/sw.js' && bumps) body = body.toString().replace(/const VERSION = '([^']+)'/, `const VERSION = '$1-test${bumps}'`);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  server.bump = () => ++bumps;
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.env.BASE || '/';
  const s = await startServer(undefined, base);
  console.log(`Serving on http://localhost:${s.address().port}${base}`);
}
