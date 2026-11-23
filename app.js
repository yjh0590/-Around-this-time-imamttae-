import { SEASONS, MONTH_NOTES, seasonForMonth, dateKey, calendarCells, sanitizeState } from './data.js';

const paths = {
  settings: '<path d="m10 3 1-1h2l1 1 1 2 2 1 2-1 2 3-1 2v3l1 2-2 3-2-1-2 1-1 2h-4l-1-2-2-1-2 1-2-3 1-2v-3l-1-2 2-3 2 1 2-1z"/><circle cx="12" cy="11" r="3"/>',
  today: '<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h.01M15 15h.01"/>',
  records: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>', right: '<path d="m9 5 7 7-7 7"/>', left: '<path d="m15 5-7 7 7 7"/>',
  leaf: '<path d="M20 3C8 2 2 8 5 15s16 7 15-12Z"/><path d="M4 21 16 9m-7 7v-5m0 5h5"/>',
  bin: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const STORAGE_KEY = 'imamttae:v1';
let state;
let loadError = false;
try { state = sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
catch { state = sanitizeState(null); loadError = true; }
let selectedDate = new Date();
let calendarDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let page = 'today';
let toastTimer;
const main = document.querySelector('#main');
const modal = document.querySelector('#modal');
const todayKey = () => dateKey(new Date());
const theme = () => SEASONS[seasonForMonth(state.month || new Date().getMonth() + 1)];
const fullDate = date => date.toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'long' });

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3500);
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { toast('저장 공간을 사용할 수 없어 이번 화면에서만 유지돼요.'); return false; }
}
function tasksFor(date) { return state.tasks.filter(task => task.date === date); }
function taskRows(date) {
  const tasks = tasksFor(date);
  return tasks.length ? tasks.map(task => `<div class="task-row ${task.done ? 'done' : ''}"><button class="task-toggle" data-toggle="${escapeHTML(task.id)}" aria-pressed="${task.done}" aria-label="${escapeHTML(task.title)} 완료">${task.done ? icon('check') : ''}</button><span class="task-title">${escapeHTML(task.title)}</span><button class="delete-button" data-delete-task="${escapeHTML(task.id)}" aria-label="${escapeHTML(task.title)} 삭제">${icon('bin')}</button></div>`).join('') : '<p class="empty">아직 챙길 일이 없어요.<br>나를 위한 작은 할 일을 담아보세요.</p>';
}
function render() {
  const season = theme();
  document.documentElement.style.setProperty('--accent', season.color);
  document.documentElement.style.setProperty('--tint', season.tint);
  document.documentElement.style.setProperty('--position', season.position);
  document.querySelector('.bottom-nav').innerHTML = [['today','오늘','today'],['calendar','달력','calendar'],['records','기록','records']].map(([key,label,svg]) => `<a href="#${key}" class="nav-item" ${page === key ? 'aria-current="page"' : ''}>${icon(svg)}<span>${label}</span></a>`).join('');
  if (page === 'calendar') renderCalendar();
  else if (page === 'records') renderRecords();
  else renderToday();
}
function renderToday() {
  const season = theme();
  const month = state.month || new Date().getMonth() + 1;
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  const memories = state.entries.filter(entry => entry.date === dateKey(lastYear));
  main.innerHTML = `${state.month ? `<div class="preview-banner"><span>${month}월 테마 미리보기 · 날짜와 일정은 오늘 기준</span><button data-auto>현재 계절로</button></div>` : ''}<p class="eyebrow">${fullDate(new Date())}</p><h1>${season.title}</h1><div class="accent-line"></div><section class="hero" aria-label="${season.name} 캐릭터"><span class="month-chip">${MONTH_NOTES[month - 1]}</span><div class="mascot" role="img" aria-label="${season.name} 옷을 입은 둥근 돌 캐릭터"></div><p class="hero-note">${season.greeting}</p></section><section class="card"><div class="card-head"><h2>오늘 챙길 일</h2><button class="small-button" data-add-task="${todayKey()}" aria-label="오늘 할 일 추가">${icon('plus')} 추가</button></div>${taskRows(todayKey())}${!tasksFor(todayKey()).length ? `<button class="small-button" data-suggest-task>${season.task} 담기 ${icon('right')}</button>` : ''}</section><section class="card"><div class="card-head"><h2>이맘때 이야기</h2></div><button class="story-button" data-story><span class="story-symbol">${icon('leaf')}</span><span class="story-copy"><span>${season.category}</span><strong>${season.story}</strong></span>${icon('right')}</button></section>${memories.length ? `<section class="card"><h2>작년 이맘때</h2>${memories.map(entry => `<div class="memory"><span>${escapeHTML(entry.date)}</span><p>${escapeHTML(entry.text)}</p></div>`).join('')}</section>` : `<button class="memory" data-add-record="${todayKey()}"><span>오늘을 기억하는 작은 방법</span><p>지금의 계절을 한 줄로 남겨볼까요? ↗</p></button>`}<p class="quiet-note">계절은 천천히, 나의 하루는 나답게.<br>대한민국의 월별 계절 테마 · 실시간 날씨 미연동</p>`;
}
function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const selected = dateKey(selectedDate);
  const cells = calendarCells(year, month);
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">계절 사이, 나의 일정</p><h1>달력</h1></div><button class="small-button" data-calendar-today>오늘로</button></div><section class="card"><div class="calendar-head"><strong>${year}년 ${month + 1}월</strong><div class="calendar-controls"><button class="icon-button" data-calendar-move="-1" aria-label="이전 달">${icon('left')}</button><button class="icon-button" data-calendar-move="1" aria-label="다음 달">${icon('right')}</button></div></div><div class="calendar-grid" role="group" aria-label="${year}년 ${month + 1}월 날짜 선택">${['일','월','화','수','목','금','토'].map(day => `<span class="weekday">${day}</span>`).join('')}${cells.map(day => {
    if (!day) return '<span></span>';
    const key = dateKey(new Date(year, month, day));
    const hasData = tasksFor(key).length || state.entries.some(entry => entry.date === key);
    return `<button class="day ${key === todayKey() ? 'today' : ''} ${key === selected ? 'selected' : ''} ${hasData ? 'has-data' : ''}" data-date="${key}" aria-pressed="${key === selected}" aria-label="${month + 1}월 ${day}일${hasData ? ', 일정 또는 기록 있음' : ''}" ${key === todayKey() ? 'aria-current="date"' : ''}>${day}</button>`;
  }).join('')}</div></section><div class="card-head selected-heading"><h2>${fullDate(selectedDate)}</h2><button class="small-button" data-add-task="${selected}">${icon('plus')} 일정</button></div><section class="card">${taskRows(selected)}</section><div class="card-head selected-heading"><h2>이날의 기록</h2><button class="small-button" data-add-record="${selected}">${icon('plus')} 기록</button></div>${state.entries.filter(e => e.date === selected).map(recordCard).join('') || '<p class="empty">이날의 순간을 한 줄로 남겨보세요.</p>'}`;
}
function recordCard(entry) {
  return `<article class="card record-card"><div class="record-head"><time datetime="${escapeHTML(entry.date)}">${escapeHTML(entry.date.replaceAll('-', '. '))}</time><button class="delete-button" data-delete-record="${escapeHTML(entry.id)}" aria-label="${escapeHTML(entry.date)} 기록 삭제">${icon('bin')}</button></div><p>${escapeHTML(entry.text)}</p></article>`;
}
function renderRecords() {
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">다시 꺼내 볼 오늘의 조각</p><h1>기록</h1></div><button class="icon-button" data-add-record="${todayKey()}" aria-label="기록 남기기">${icon('plus')}</button></div><p class="intro">거창하지 않아도 괜찮아요.<br>오늘의 기분, 계절의 작은 변화를 담아보세요.</p>${state.entries.length ? [...state.entries].sort((a,b) => b.date.localeCompare(a.date)).map(recordCard).join('') : `<div class="hero"><div class="mascot" role="img" aria-label="오늘을 함께하는 계절 캐릭터"></div></div><section class="card"><h2>아직 비어 있는 나의 계절</h2><p class="empty">첫 기록이 쌓이면 나만의 이야기가 시작돼요.</p><button class="primary-button full" data-add-record="${todayKey()}">${icon('records')} 첫 기록 남기기</button></section>`}<p class="quiet-note">기록은 이 브라우저에 저장돼요.<br>브라우저 데이터를 지우면 함께 삭제될 수 있어요.</p>`;
}
function openModal(title, body) {
  document.querySelector('#modal-content').innerHTML = `<div class="modal-head"><h2>${title}</h2><button class="icon-button" data-close aria-label="닫기">${icon('close')}</button></div>${body}`;
  modal.showModal();
}
function openTask(date, title = '') {
  openModal('챙길 일 담기', `<form id="task-form"><label for="task-title">어떤 일을 챙길까요?</label><input id="task-title" name="title" maxlength="100" required placeholder="예: 겨울 침구 꺼내기" value="${escapeHTML(title)}"><label for="task-date">날짜</label><input id="task-date" name="date" type="date" required value="${date}"><button class="primary-button full" type="submit">달력에 담기</button><p class="field-hint">선택한 날짜에 저장돼요. 알림 기능은 아직 제공하지 않아요.</p></form>`);
}
function openRecord(date) {
  openModal('오늘의 한 줄', `<form id="record-form"><label for="record-date">기억할 날짜</label><input id="record-date" name="date" type="date" required value="${date}"><label for="record-text">어떤 순간을 남길까요?</label><textarea id="record-text" name="text" maxlength="1000" required placeholder="오늘 바람에서 겨울 냄새가 났다."></textarea><button class="primary-button full" type="submit">기록 남기기</button><p class="field-hint">글은 이 기기의 브라우저에만 저장돼요.</p></form>`);
}
function openSettings() {
  openModal('나의 이맘때', `<p class="modal-text">계절은 바뀌어도, 나의 하루는 여기에서.</p><label for="month-select">계절 테마</label><select id="month-select"><option value="">현재 월에 맞춰 자동</option>${MONTH_NOTES.map((note,i) => `<option value="${i+1}" ${state.month === i+1 ? 'selected' : ''}>${note}</option>`).join('')}</select><p class="field-hint">미리보기는 캐릭터와 계절 이야기만 바꿔요. 일정과 기록의 날짜는 바뀌지 않아요. 옷차림과 배경은 사계절 단위로, 문구는 월별로 달라져요.</p><button class="primary-button full" data-export>내 일정과 기록 내려받기</button><p class="field-hint">현재 기기의 데이터를 JSON 파일로 보관할 수 있어요. 계정 동기화·사진 첨부·알림·날씨 연동은 이후 업데이트 항목이에요.</p>`);
}
function readPage() {
  page = ['calendar','records'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
  render();
}
document.querySelector('#settings-button').innerHTML = icon('settings');
document.querySelector('#settings-button').addEventListener('click', openSettings);
window.addEventListener('hashchange', () => { readPage(); main.focus(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !modal.open) render(); });
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const d = button.dataset;
  if ('close' in d) modal.close();
  else if ('auto' in d) { state.month = null; save(); render(); }
  else if ('addTask' in d) openTask(d.addTask);
  else if ('suggestTask' in d) openTask(todayKey(), theme().task);
  else if ('addRecord' in d) openRecord(d.addRecord);
  else if ('toggle' in d) { const task = state.tasks.find(t => t.id === d.toggle); if (task) { task.done = !task.done; save(); render(); } }
  else if ('deleteTask' in d) {
    const task = state.tasks.find(t => t.id === d.deleteTask);
    if (task) openModal('할 일을 삭제할까요?', `<p class="modal-text">${escapeHTML(task.title)}</p><button class="primary-button full" data-confirm-task="${escapeHTML(task.id)}">삭제하기</button>`);
  }
  else if ('confirmTask' in d) { state.tasks = state.tasks.filter(t => t.id !== d.confirmTask); save(); modal.close(); render(); }
  else if ('deleteRecord' in d) openModal('기록을 삭제할까요?', `<p class="modal-text">삭제한 기록은 되돌릴 수 없어요.</p><button class="primary-button full" data-confirm-record="${escapeHTML(d.deleteRecord)}">삭제하기</button>`);
  else if ('confirmRecord' in d) { state.entries = state.entries.filter(e => e.id !== d.confirmRecord); save(); modal.close(); render(); }
  else if ('calendarMove' in d) { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + Number(d.calendarMove), 1); render(); }
  else if ('calendarToday' in d) { selectedDate = new Date(); calendarDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1); render(); }
  else if ('date' in d) { selectedDate = new Date(`${d.date}T12:00:00`); render(); }
  else if ('story' in d) {
    const s = theme();
    openModal(s.story, `<p class="eyebrow">${s.category}</p><p class="modal-text">${s.body}</p><div class="wisdom"><strong>옛 지혜를 오늘로</strong>${s.wisdom}</div><p class="field-hint">계절 생활을 위한 편집 콘텐츠예요. 지역별 날씨·주거 환경을 반영한 권고는 아니에요.</p><button class="primary-button full" data-story-task>${s.action} 담기</button>`);
  }
  else if ('storyTask' in d) { modal.close(); openTask(todayKey(), theme().action); }
  else if ('export' in d) {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version:1, ...state }, null, 2)], { type:'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `imamttae-${todayKey()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'month-select') { state.month = Number(event.target.value) || null; save(); render(); }
});
document.addEventListener('submit', event => {
  if (!['task-form','record-form'].includes(event.target.id)) return;
  event.preventDefault();
  const data = new FormData(event.target);
  const date = data.get('date');
  const value = String(data.get(event.target.id === 'task-form' ? 'title' : 'text') || '').trim();
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('날짜와 내용을 확인해 주세요.'); return; }
  if (event.target.id === 'task-form') state.tasks.push({ id:crypto.randomUUID(), date, title:value.slice(0,100), done:false });
  else state.entries.push({ id:crypto.randomUUID(), date, text:value.slice(0,1000) });
  const persisted = save(); modal.close(); render(); if (persisted) toast('나의 이맘때에 담았어요.');
});
readPage();
if (loadError) toast('저장된 데이터를 읽지 못했어요. 저장 공간 설정을 확인해 주세요.');
