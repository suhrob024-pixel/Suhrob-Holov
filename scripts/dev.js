#!/usr/bin/env node
/**
 * Lokal förhandsgranskning: bygger om automatiskt när innehåll, mall eller
 * stilmall ändras. Inga beroenden — starta med `npm run dev`.
 */
const { execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

function build() {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });
  } catch {
    console.error('  (sidan ligger kvar på förra fungerande bygget)');
  }
}

build();

let pending = null;
for (const target of ['content', 'src', 'public']) {
  const dir = path.join(ROOT, target);
  if (!fs.existsSync(dir)) continue;
  fs.watch(dir, { recursive: true }, (_e, file) => {
    if (!file || file.startsWith('.')) return;
    clearTimeout(pending);
    pending = setTimeout(() => {
      console.log(`\n↻ ${target}/${file} ändrad`);
      build();
    }, 80);
  });
}

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, url === '/' ? 'index.html' : url);
    if (!path.resolve(file).startsWith(path.resolve(DIST))) {
      res.writeHead(403).end('Förbjuden sökväg');
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 — hittades inte');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`\n→ Förhandsgranskning på http://localhost:${PORT}  (Ctrl+C avslutar)\n`));
