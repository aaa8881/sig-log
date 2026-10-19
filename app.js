'use strict';
let data;
let projectFilter = 'all';
const app = document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tz = 'Asia/Seoul';
const seoulParts = () => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(new Date()).map((p) => [p.type, p.value]));
const fmtDate = (d) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: tz }).format(new Date(d + 'T12:00:00+09:00'));
const fmtWeekday = (d) => new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: tz }).format(new Date(d + 'T12:00:00+09:00'));
const fmtMonth = (d) => `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월`;
const gh = (p) => `https://github.com/${data.site.owner}/${data.site.repo}/${p}`;

// Minimal markdown for user-written text: headings, nested lists, paragraphs, **bold**, links.
function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out = []; let para = []; let depth = 0;
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const setDepth = (d) => { while (depth < d) { out.push('<ul>'); depth++; } while (depth > d) { out.push('</ul>'); depth--; } };
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const li = raw.match(/^(\s*)[-*] (.*)$/);
    const h = raw.match(/^(#{1,3}) (.*)$/);
    if (li) { flushPara(); setDepth(Math.floor(li[1].length / 2) + 1); out.push(`<li>${inline(li[2])}</li>`); }
    else if (h) { flushPara(); setDepth(0); out.push(`<h3>${inline(h[2])}</h3>`); }
    else if (!raw.trim()) { flushPara(); setDepth(0); }
    else { setDepth(0); para.push(raw.trim()); }
  }
  flushPara(); setDepth(0);
  return out.join('');
}

function dayCard(day, filter = 'all') {
  const sections = day.sections.filter((s) => filter === 'all' || s.name === filter);
  if (!sections.length) return '';
  const body = sections.map((s) => `<span class="project">${esc(s.name)}</span><ul class="items">${s.items.map((it) =>
    `<li>${esc(it.text)}${it.children.length ? `<ul>${it.children.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`).join('');
  return `<article class="card" id="d-${day.date}"><div class="card-head"><span class="date">${fmtDate(day.date)}<small>${fmtWeekday(day.date)}</small></span></div>${body}</article>`;
}

function todoCard() {
  const latest = data.days[0];
  const items = latest?.todo || [];
  return `<section class="card"><h2>내일 할 일</h2>${items.length
    ? `<ul class="items">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><p class="muted" style="margin:10px 0 0;font-size:13px">${fmtDate(latest.date)} 기록에서 남은 일을 정리했어요.</p>`
    : '<p class="empty">아직 정리된 할 일이 없어요.</p>'}</section>`;
}

function goalsCard(full) {
  const edit = `<a class="btn ghost" href="${gh(`edit/${data.site.branch}/goals.md`)}" target="_blank" rel="noopener">목표 고치기</a>`;
  const hasGoals = /^\s*[-*] \S|^[^#\s-]/m.test(data.goals);
  const body = hasGoals ? `<div class="prose">${md(data.goals)}</div>` : '<p class="empty">아직 정한 목표가 없어요. 주간 목표와 월간 목표를 직접 적어 주세요.</p>';
  return full ? `<div class="actions">${edit}</div><section class="card">${body}</section>`
    : `<section class="card"><div class="card-head"><h2 style="margin:0">목표</h2><a class="muted" href="#goals">전체 보기</a></div>${body}</section>`;
}

function newThoughtLink() {
  const p = seoulParts();
  const name = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}.md`;
  return gh(`new/${data.site.branch}/thoughts?filename=${encodeURIComponent(name)}`);
}

const views = {
  today() {
    const latest = data.days[0];
    return `<h1>오늘</h1><p class="lead">가장 최근 작업과 다음 할 일, 지금 목표예요.</p>
      <div class="grid">${todoCard()}${goalsCard(false)}</div>
      ${latest ? `<h2 style="margin-top:8px">최근 기록</h2>${dayCard(latest)}` : ''}`;
  },
  records() {
    const projects = [...new Set(data.days.flatMap((d) => d.sections.map((s) => s.name)))];
    const filters = ['all', ...projects].map((p) => `<button type="button" data-filter="${esc(p)}" class="${p === projectFilter ? 'on' : ''}">${p === 'all' ? '전체' : esc(p)}</button>`).join('');
    let month = ''; const parts = [];
    for (const d of data.days) {
      const card = dayCard(d, projectFilter);
      if (!card) continue;
      if (d.date.slice(0, 7) !== month) { month = d.date.slice(0, 7); parts.push(`<p class="month">${fmtMonth(d.date)}</p>`); }
      parts.push(card);
    }
    return `<h1>기록</h1><p class="lead">${data.days.length}일 동안의 작업 기록이에요. ${data.days.length ? `${fmtDate(data.days[data.days.length - 1].date)}부터` : ''}</p>
      <div class="filters">${filters}</div>${parts.join('') || '<p class="empty">기록이 없어요.</p>'}`;
  },
  goals() {
    return `<h1>목표</h1><p class="lead">주간·월간 목표는 직접 정해요. 고치면 사이트에 자동으로 반영돼요.</p>${goalsCard(true)}`;
  },
  thoughts() {
    const list = data.thoughts.map((t) => `<article class="card thought"><div class="when">${fmtDate(t.date)} ${fmtWeekday(t.date)}${t.time ? ` · ${t.time}` : ''}</div><div class="prose">${md(t.body)}</div></article>`).join('');
    return `<h1>생각</h1><p class="lead">직접 적은 생각만 모아 둬요.</p>
      <div class="actions"><a class="btn" href="${newThoughtLink()}" target="_blank" rel="noopener">생각 적기</a></div>
      ${list || '<p class="empty">아직 적은 생각이 없어요.</p>'}`;
  },
};

function render() {
  const view = (location.hash.slice(1) || 'today').split('/')[0];
  const fn = views[view] || views.today;
  app.innerHTML = fn();
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === (views[view] ? view : 'today')));
  app.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { projectFilter = b.dataset.filter; render(); }));
}

fetch('data.json', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
  data = d;
  document.getElementById('updated').textContent = `마지막 갱신 ${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(d.builtAt))}`;
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
}).catch(() => { app.innerHTML = '<p class="empty">기록을 불러오지 못했어요.</p>'; });
