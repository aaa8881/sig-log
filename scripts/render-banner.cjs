#!/usr/bin/env node
// Renders assets/banner.html to assets/discord-banner.png (1200x400) with headless Edge or Chrome.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(fs.existsSync);
if (!browser) { console.error('Edge or Chrome not found'); process.exit(1); }

const src = 'file:///' + path.join(root, 'assets', 'banner.html').replace(/\\/g, '/');
const out = path.join(root, 'assets', 'discord-banner.png');
const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'siglog-banner-'));
execFileSync(browser, ['--headless=new', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1200,400', '--virtual-time-budget=5000', `--screenshot=${out}`, src], { stdio: 'ignore', timeout: 60000 });
fs.rmSync(profile, { recursive: true, force: true });
console.log(`${out} (${fs.statSync(out).size} bytes)`);
