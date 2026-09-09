import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, 'dist');
const port = Number(process.env.WEB_PORT ?? 5173);
const types = { '.css':'text/css; charset=utf-8', '.html':'text/html; charset=utf-8', '.ico':'image/x-icon', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.map':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

createServer((request, response) => {
  let pathname = '/';
  try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); } catch {}
  const relative = normalize(pathname).replace(/^([/\\])+/, '');
  let file = resolve(root, relative);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' });
  response.end(readFileSync(file));
}).listen(port, '0.0.0.0', () => console.log(`CyberQuest web is listening on ${port}`));
