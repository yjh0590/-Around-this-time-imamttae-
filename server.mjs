import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const allowed = new Set(['index.html','styles.css','app.js','data.js','assets/icon.svg','assets/seasonal-companion.png']);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png' };
export function createServer() {
  return http.createServer(async (request, response) => {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405, { Allow:'GET, HEAD' }).end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html'; }
    catch { response.writeHead(400).end('Bad request'); return; }
    if (!allowed.has(pathname)) { response.writeHead(404).end('Not found'); return; }
    try {
      const content = await readFile(path.join(root, pathname));
      response.writeHead(200, { 'Content-Type':types[path.extname(pathname)], 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache', 'Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(500).end('Unable to read file'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '127.0.0.1', () => console.log(`이맘때: http://localhost:${port}`));
}
