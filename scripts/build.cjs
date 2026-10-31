#!/usr/bin/env node
// Builds dist/ for GitHub Pages: static files + data.json compiled from log/, goals.md and thoughts/.
// Usage: node scripts/build.cjs [--check]   (--check validates only, writes nothing)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');
const TODO = '내일 할 일';
const errors = [];

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const list = (dir, re) => fs.existsSync(path.join(root, dir))
  ? fs.readdirSync(path.join(root, dir)).filter((f) => re.test(f)).sort() : [];

// log/YYYY-MM-DD.md → { date, sections: [{ name, items: [{ text, children: [text] }] }], todo: [text] }
function parseDay(file) {
  const date = file.slice(0, 10);
  const sections = [];
  let todo = null;
  let cur = null;
  read(`log/${file}`).split('\n').forEach((line, i) => {
    const where = `log/${file}:${i + 1}`;
    if (!line.trim() || line.startsWith('# ')) return;
    const h = line.match(/^## (.+)$/);
    if (h) {
      const name = h[1].trim();
      cur = { name, items: [] };
      if (name === TODO) todo = cur; else sections.push(cur);
      return;
    }
    const top = line.match(/^- (.+)$/);
    const sub = line.match(/^ {2,4}- (.+)$/);
    if (!cur) return errors.push(`${where}: 섹션(## ...) 밖의 내용`);
    if (top) cur.items.push({ text: top[1].trim(), children: [] });
    else if (sub && cur.items.length) cur.items[cur.items.length - 1].children.push(sub[1].trim());
    else errors.push(`${where}: 목록 형식이 아님 → ${line.trim().slice(0, 40)}`);
  });
  if (!sections.some((s) => s.items.length)) errors.push(`log/${file}: 기록된 작업이 없음`);
  return { date, sections, todo: todo ? todo.items.map((it) => it.text) : [] };
}

// thoughts/YYYY-MM-DD[-HHMM][-anything].md → { date, time, body }
function parseThought(file) {
  const m = file.match(/^(\d{4}-\d{2}-\d{2})(?:-(\d{2})(\d{2}))?/);
  if (!m) { errors.push(`thoughts/${file}: 파일 이름은 YYYY-MM-DD-HHMM.md 형식이어야 함`); return null; }
  const body = read(`thoughts/${file}`).trim();
  if (!body) return null;
  return { file, date: m[1], time: m[2] ? `${m[2]}:${m[3]}` : '', body };
}

// games/<slug>.md → { slug, title, reason, status, started, platform, note, plays: [{date, minutes, note}], totalMinutes, lastPlayed, comment, learnings: [{date, body}] }
const GAME_REASONS = ['트렌드', '요소 탐구', '시간 때우기', '기타'];
const GAME_STATUSES = ['하는 중', '쉬는 중', '끝냄', '그만둠'];
function parseMinutes(s) {
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:시간|h)/), m = s.match(/(\d+)\s*분/);
  return h || m ? Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? parseInt(m[1], 10) : 0)) : 0;
}
function parseGame(file) {
  const g = { slug: file.replace(/\.md$/, ''), title: '', reason: '기타', status: '하는 중', started: '', platform: '', note: '', plays: [], comment: '', learnings: [] };
  const fields = { 이유: 'reason', 상태: 'status', 시작: 'started', 플랫폼: 'platform', 메모: 'note' };
  let section = '';
  const comment = [];
  read(`games/${file}`).split('\n').forEach((line, i) => {
    const where = `games/${file}:${i + 1}`;
    const t = line.match(/^# (.+)$/);
    const h = line.match(/^## (.+)$/);
    if (t) { g.title = t[1].trim(); return; }
    if (h) { section = h[1].trim(); return; }
    if (!section) {
      const f = line.match(/^- ([^:]+):\s*(.*)$/);
      if (f && fields[f[1].trim()]) g[fields[f[1].trim()]] = f[2].trim();
      return;
    }
    if (section === '코멘트') { comment.push(line); return; }
    const item = line.match(/^- (\d{4}-\d{2}-\d{2})\s*(.*)$/);
    if (!line.trim()) return;
    if (!item) return errors.push(`${where}: '- YYYY-MM-DD 내용' 형식이 아님`);
    if (section === '플레이') {
      const rest = item[2];
      const dur = rest.match(/^((?:\d+(?:\.\d+)?\s*(?:시간|h)\s*)?(?:\d+\s*분)?)\s*(.*)$/);
      g.plays.push({ date: item[1], minutes: parseMinutes(dur[1] || ''), note: (dur[2] || '').trim() });
    } else if (section === '배운 점') g.learnings.push({ date: item[1], body: item[2].trim() });
  });
  g.comment = comment.join('\n').trim();
  if (!g.title) errors.push(`games/${file}: 제목(# 게임 이름)이 없음`);
  if (!GAME_REASONS.includes(g.reason)) errors.push(`games/${file}: 이유는 ${GAME_REASONS.join(', ')} 중 하나`);
  if (!GAME_STATUSES.includes(g.status)) errors.push(`games/${file}: 상태는 ${GAME_STATUSES.join(', ')} 중 하나`);
  g.plays.sort((a, b) => b.date.localeCompare(a.date));
  g.learnings.sort((a, b) => b.date.localeCompare(a.date));
  g.totalMinutes = g.plays.reduce((n, p) => n + p.minutes, 0);
  g.lastPlayed = g.plays[0] ? g.plays[0].date : g.started;
  return g;
}

const games = list('games', /^[^_.].*\.md$/).map(parseGame)
  .sort((a, b) => (b.lastPlayed || '').localeCompare(a.lastPlayed || ''));

const days = list('log', /^\d{4}-\d{2}-\d{2}\.md$/).map(parseDay).sort((a, b) => b.date.localeCompare(a.date));
const thoughts = list('thoughts', /\.md$/).map(parseThought).filter(Boolean)
  .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
const goals = fs.existsSync(path.join(root, 'goals.md')) ? read('goals.md') : '';
const site = JSON.parse(read('site.json'));

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const data = { site, builtAt: new Date().toISOString(), days, goals, thoughts, games, gameReasons: GAME_REASONS };
console.log(`ok: ${days.length} days, ${thoughts.length} thoughts, ${games.length} games`);
if (checkOnly) process.exit(0);

const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
for (const f of ['index.html', 'app.js', 'styles.css']) fs.copyFileSync(path.join(root, f), path.join(dist, f));
fs.writeFileSync(path.join(dist, 'data.json'), JSON.stringify(data));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
// Images such as the Discord embed banner are served from the site.
fs.mkdirSync(path.join(dist, 'assets'));
for (const f of list('assets', /\.(png|jpe?g|gif|webp)$/)) fs.copyFileSync(path.join(root, 'assets', f), path.join(dist, 'assets', f));
