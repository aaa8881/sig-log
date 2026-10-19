#!/usr/bin/env node
// Local preview: builds, then serves dist/ at http://127.0.0.1:4174
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

execFileSync(process.execPath, [path.join(__dirname, 'build.cjs')], { stdio: 'inherit' });
const dist = path.resolve(__dirname, '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(dist) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': (types[path.extname(p)] || 'application/octet-stream') + '; charset=utf-8' });
  fs.createReadStream(p).pipe(res);
}).listen(4174, '127.0.0.1', () => console.log('http://127.0.0.1:4174'));
