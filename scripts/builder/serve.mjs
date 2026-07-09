import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A tiny dependency-free static server so the QA harness (which makes HTTP
 * requests) can check an assembled build. Extension-less paths map to
 * <path>.html or index.html, so "/" and "/services" work like real routes.
 * Deliberately minimal: no .next, no build step, no lock contention.
 */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function resolveFile(dir, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const rel = path.normalize(clean).replace(/^(\.\.[/\\])+/, '');
  const candidates =
    rel === '/' || rel === '' || rel === '\\'
      ? ['index.html']
      : [rel.replace(/^[/\\]/, ''), rel.replace(/^[/\\]/, '') + '.html', path.join(rel.replace(/^[/\\]/, ''), 'index.html')];
  for (const c of candidates) {
    const full = path.join(dir, c);
    if (full.startsWith(dir) && fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

/**
 * @param {string} dir  build output directory
 * @param {number} port
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export function startStaticServer(dir, port) {
  const server = http.createServer((req, res) => {
    const file = resolveFile(dir, req.url || '/');
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    // Bind + advertise 127.0.0.1 (not "localhost", which can resolve to IPv6
    // ::1 on Windows and miss an IPv4-only listener).
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${port}`,
        // Destroy lingering keep-alive sockets so close() actually completes
        // (avoids a Windows libuv teardown assertion at process exit).
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.();
            server.close(() => r());
          }),
      });
    });
  });
}
