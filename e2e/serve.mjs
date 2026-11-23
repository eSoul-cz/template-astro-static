#!/usr/bin/env node
// Static server over dist/ for Playwright, with the rules of the real web server: a directory serves its
// index.html, a missing path answers 404 with 404.html. A foreground process on purpose (`astro preview` may
// detach itself in agent and CI environments, which Playwright reads as an early exit).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2] ?? 4330);
const dist = resolve(process.cwd(), 'dist');
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
};

function send(res, status, file) {
    res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
}

createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    let file = normalize(join(dist, path));
    if (!file.startsWith(dist)) return send(res, 404, join(dist, '404.html'));
    if (existsSync(file) && statSync(file).isDirectory()) {
        if (!path.endsWith('/')) {
            res.writeHead(301, { Location: `${path}/` });
            return res.end();
        }
        file = join(file, 'index.html');
    }
    if (existsSync(file) && statSync(file).isFile()) return send(res, 200, file);
    return send(res, 404, join(dist, '404.html'));
}).listen(port, '127.0.0.1', () => console.log(`e2e server: http://127.0.0.1:${port} (dist/)`));
