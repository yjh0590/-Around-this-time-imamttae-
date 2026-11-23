import { SEASONS, MONTH_NOTES, seasonForMonth, dateKey, localDate, calendarCells, sanitizeState, isDateKey, parseBackup, mergeBackup, searchEntries } from './data.js';

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
let calendarDate = localDate(selectedDate.getFullYear(), selectedDate.getMonth());
let page = 'today';
let toastTimer;
let recordQuery = '';
let pendingImport = null;
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
function save(nextState = state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState)); return true; }
  catch { toast('저장 공간을 사용할 수 없어 이번 화면에서만 유지돼요.'); return false; }
}
function tasksFor(date) { return state.tasks.filter(task => task.date === date); }
function taskRows(date) {
  const tasks = tasksFor(date);
  return tasks.length ? tasks.map(task => `<div class="task-row ${task.done ? 'done' : ''}"><button class="task-toggle" data-toggle="${escapeHTML(task.id)}" aria-pressed="${task.done}" aria-label="${escapeHTML(task.title)} 완료">${task.done ? icon('check') : ''}</button><button class="task-title" data-edit-task="${escapeHTML(task.id)}" aria-label="${escapeHTML(task.title)} 수정">${escapeHTML(task.title)}</button><button class="delete-button" data-delete-task="${escapeHTML(task.id)}" aria-label="${escapeHTML(task.title)} 삭제">${icon('bin')}</button></div>`).join('') : '<p class="empty">아직 챙길 일이 없어요.<br>나를 위한 작은 할 일을 담아보세요.</p>';
}
function completionSummary() {
  const tasks = tasksFor(todayKey());
  if (!tasks.length) return '';
  const complete = tasks.filter(task => task.done).length;
  return `<div class="completion-summary"><span>${complete === tasks.length ? '오늘의 작은 약속을 모두 지켰어요.' : '하나씩, 나의 속도로 챙겨요.'}</span><span>${complete}/${tasks.length}</span></div><progress class="completion-progress" max="${tasks.length}" value="${complete}" aria-label="오늘 할 일 완료 현황"></progress>`;
}
function render() {
  const season = theme();
  document.documentElement.style.setProperty('--accent', season.color);
  document.documentElement.style.setProperty('--tint', season.tint);
  document.documentElement.style.setProperty('--position', season.position);
  document.querySelector('.bottom-nav').innerHTML = [['today','오늘','today'],['calendar','달력','calendar'],['records','기록','records']].map(([key,label,svg]) => `<a href="#${key}" class="nav-item" ${page === key ? 'aria-current="page"' : ''}>${icon(svg)}<span>${label}</span></a>`).join('');
  if (page === 'calendar') renderCalendar();
  else if (page === 'records') renderRecords();
  else {
    renderToday();
    main.querySelector('.card').insertAdjacentHTML('beforeend', completionSummary());
  }
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
    const key = dateKey(localDate(year, month, day));
    const hasData = tasksFor(key).length || state.entries.some(entry => entry.date === key);
    return `<button class="day ${key === todayKey() ? 'today' : ''} ${key === selected ? 'selected' : ''} ${hasData ? 'has-data' : ''}" data-date="${key}" aria-pressed="${key === selected}" aria-label="${month + 1}월 ${day}일${hasData ? ', 일정 또는 기록 있음' : ''}" ${key === todayKey() ? 'aria-current="date"' : ''}>${day}</button>`;
  }).join('')}</div></section><div class="card-head selected-heading"><h2>${fullDate(selectedDate)}</h2><button class="small-button" data-add-task="${selected}">${icon('plus')} 일정</button></div><section class="card">${taskRows(selected)}</section><div class="card-head selected-heading"><h2>이날의 기록</h2><button class="small-button" data-add-record="${selected}">${icon('plus')} 기록</button></div>${state.entries.filter(e => e.date === selected).map(recordCard).join('') || '<p class="empty">이날의 순간을 한 줄로 남겨보세요.</p>'}`;
}
function recordCard(entry) {
  return `<article class="card record-card"><div class="record-head"><time datetime="${escapeHTML(entry.date)}">${escapeHTML(entry.date.replaceAll('-', '. '))}</time><div class="record-actions"><button class="delete-button" data-edit-record="${escapeHTML(entry.id)}" aria-label="${escapeHTML(entry.date)} 기록 수정">${icon('records')}</button><button class="delete-button" data-delete-record="${escapeHTML(entry.id)}" aria-label="${escapeHTML(entry.date)} 기록 삭제">${icon('bin')}</button></div></div><p>${escapeHTML(entry.text)}</p></article>`;
}
function renderRecords() {
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">다시 꺼내 볼 오늘의 조각</p><h1>기록</h1></div><button class="icon-button" data-add-record="${todayKey()}" aria-label="기록 남기기">${icon('plus')}</button></div><p class="intro">거창하지 않아도 괜찮아요.<br>오늘의 기분, 계절의 작은 변화를 담아보세요.</p>${state.entries.length ? `<label class="sr-only" for="record-search">기록 내용이나 날짜 검색</label><input type="search" id="record-search" maxlength="1000" placeholder="내용이나 날짜로 기억 찾기" value="${escapeHTML(recordQuery)}" aria-controls="record-results"><p class="search-count" id="search-count" role="status"></p><div id="record-results"></div>` : `<div class="hero"><div class="mascot" role="img" aria-label="오늘을 함께하는 계절 캐릭터"></div></div><section class="card"><h2>아직 비어 있는 나의 계절</h2><p class="empty">첫 기록이 쌓이면 나만의 이야기가 시작돼요.</p><button class="primary-button full" data-add-record="${todayKey()}">${icon('records')} 첫 기록 남기기</button></section>`}<p class="quiet-note">기록은 이 브라우저에 저장돼요.<br>브라우저 데이터를 지우면 함께 삭제될 수 있어요.</p>`;
  renderRecordResults();
}
function renderRecordResults() {
  const results = document.querySelector('#record-results');
  if (!results) return;
  const entries = searchEntries(state.entries, recordQuery);
  document.querySelector('#search-count').textContent = recordQuery.trim() ? `${state.entries.length}개의 기록 중 ${entries.length}개를 찾았어요.` : `나의 계절이 ${entries.length}개 쌓였어요.`;
  results.innerHTML = entries.length ? entries.map(recordCard).join('') : '<div class="card"><p class="empty">찾는 기록이 없어요.<br>다른 단어나 날짜로 찾아보세요.</p><button class="small-button" data-clear-search>전체 기록 보기</button></div>';
}
function openModal(title, body) {
  document.querySelector('#modal-content').innerHTML = `<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-close aria-label="닫기">${icon('close')}</button></div>${body}`;
  modal.showModal();
}
function openTask(date, title = '', id = '') {
  openModal(id ? '챙길 일 수정' : '챙길 일 담기', `<form id="task-form"><input type="hidden" name="entryId" value="${escapeHTML(id)}"><label for="task-title">어떤 일을 챙길까요?</label><input id="task-title" name="title" maxlength="100" required placeholder="예: 겨울 침구 꺼내기" value="${escapeHTML(title)}"><label for="task-date">날짜</label><input id="task-date" name="date" type="date" min="0001-01-01" max="9999-12-31" required value="${date}"><button class="primary-button full" type="submit">${id ? '수정한 내용 저장' : '달력에 담기'}</button><p class="field-hint">선택한 날짜에 저장돼요. 알림 기능은 아직 제공하지 않아요.</p></form>`);
}
function openRecord(date, text = '', id = '') {
  openModal(id ? '기록 수정' : '오늘의 한 줄', `<form id="record-form"><input type="hidden" name="entryId" value="${escapeHTML(id)}"><label for="record-date">기억할 날짜</label><input id="record-date" name="date" type="date" min="0001-01-01" max="9999-12-31" required value="${date}"><label for="record-text">어떤 순간을 남길까요?</label><textarea id="record-text" name="text" maxlength="1000" required placeholder="오늘 바람에서 겨울 냄새가 났다.">${escapeHTML(text)}</textarea><p class="character-count" id="character-count">${text.length}/1000</p><button class="primary-button full" type="submit">${id ? '수정한 내용 저장' : '기록 남기기'}</button><p class="field-hint">글은 이 기기의 브라우저에만 저장돼요.</p></form>`);
}
function openSettings() {
  openModal('나의 이맘때', `<p class="modal-text">계절은 바뀌어도, 나의 하루는 여기에서.</p><label for="month-select">계절 테마</label><select id="month-select"><option value="">현재 월에 맞춰 자동</option>${MONTH_NOTES.map((note,i) => `<option value="${i+1}" ${state.month === i+1 ? 'selected' : ''}>${note}</option>`).join('')}</select><p class="field-hint">미리보기는 캐릭터와 계절 이야기만 바꿔요. 일정과 기록의 날짜는 바뀌지 않아요. 옷차림과 배경은 사계절 단위로, 문구는 월별로 달라져요.</p><button class="primary-button full" data-export>내 일정과 기록 내려받기</button><p class="field-hint">현재 기기의 데이터를 JSON 파일로 보관할 수 있어요. 계정 동기화·사진 첨부·알림·날씨 연동은 이후 업데이트 항목이에요.</p>`);
  document.querySelector('#modal-content').insertAdjacentHTML('beforeend', `<div class="backup-section"><h2>백업에서 다시 이어가기</h2><label for="backup-file">이맘때 백업 파일 선택</label><input type="file" id="backup-file" accept=".json,application/json"><p class="field-hint">10MB 이하의 JSON 파일을 선택해 주세요. 내용을 확인한 뒤 새 항목만 추가해요. 이전에 가져온 항목은 현재 내용을 유지해요.</p><p id="import-error" class="form-error" role="alert"></p></div>`);
}
async function previewBackup(file) {
  if (!file) return;
  const input = document.querySelector('#backup-file');
  const error = document.querySelector('#import-error');
  input.disabled = true;
  error.textContent = '';
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하의 백업 파일을 선택해 주세요.');
    const incoming = parseBackup(await file.text());
    if (!input.isConnected || !modal.open) return;
    pendingImport = incoming;
    const result = mergeBackup(state, incoming);
    openModal('백업을 가져올까요?', `<p class="modal-text">새로운 계절의 조각을 지금의 기록에 이어 붙여요.</p><dl class="import-summary"><div><dt>추가할 일정</dt><dd>${result.addedTasks}개</dd></div><div><dt>추가할 기록</dt><dd>${result.addedEntries}개</dd></div><div><dt>이미 있는 항목</dt><dd>${result.skipped}개</dd></div></dl><p class="field-hint">현재 데이터와 테마 설정은 유지해요. 이미 있는 항목은 백업 내용으로 덮어쓰지 않아요. 다른 기기에서 따로 만든 항목은 내용이 같아도 추가될 수 있어요.</p><p id="restore-error" class="form-error" role="alert"></p><button class="primary-button full" data-confirm-import ${result.addedTasks + result.addedEntries ? '' : 'disabled'}>새 항목 가져오기</button>`);
  } catch (problem) {
    if (error.isConnected && modal.open) error.textContent = problem.message || '파일을 읽지 못했어요. 다시 선택해 주세요.';
  } finally {
    input.disabled = false;
    input.value = '';
  }
}
function readPage() {
  page = ['calendar','records'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
  render();
}
document.querySelector('#settings-button').innerHTML = icon('settings');
document.querySelector('#settings-button').addEventListener('click', openSettings);
modal.addEventListener('close', () => { pendingImport = null; });
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
  else if ('editTask' in d) { const task = state.tasks.find(t => t.id === d.editTask); if (task) openTask(task.date, task.title, task.id); }
  else if ('editRecord' in d) { const entry = state.entries.find(e => e.id === d.editRecord); if (entry) openRecord(entry.date, entry.text, entry.id); }
  else if ('clearSearch' in d) { recordQuery = ''; document.querySelector('#record-search').value = ''; renderRecordResults(); document.querySelector('#record-search').focus(); }
  else if ('confirmImport' in d && pendingImport) {
    const result = mergeBackup(state, pendingImport);
    if (!save(result.state)) { document.querySelector('#restore-error').textContent = '기기에 저장하지 못했어요. 기존 데이터는 유지했어요. 저장 공간을 확인하고 다시 시도해 주세요.'; return; }
    state = result.state;
    pendingImport = null;
    modal.close(); render(); toast(`일정 ${result.addedTasks}개와 기록 ${result.addedEntries}개를 가져왔어요.`);
  }
  else if ('toggle' in d) { const task = state.tasks.find(t => t.id === d.toggle); if (task) { task.done = !task.done; save(); render(); } }
  else if ('deleteTask' in d) {
    const task = state.tasks.find(t => t.id === d.deleteTask);
    if (task) openModal('할 일을 삭제할까요?', `<p class="modal-text">${escapeHTML(task.title)}</p><button class="primary-button full" data-confirm-task="${escapeHTML(task.id)}">삭제하기</button>`);
  }
  else if ('confirmTask' in d) { state.tasks = state.tasks.filter(t => t.id !== d.confirmTask); save(); modal.close(); render(); }
  else if ('deleteRecord' in d) openModal('기록을 삭제할까요?', `<p class="modal-text">삭제한 기록은 되돌릴 수 없어요.</p><button class="primary-button full" data-confirm-record="${escapeHTML(d.deleteRecord)}">삭제하기</button>`);
  else if ('confirmRecord' in d) { state.entries = state.entries.filter(e => e.id !== d.confirmRecord); save(); modal.close(); render(); }
  else if ('calendarMove' in d) {
    const target = localDate(calendarDate.getFullYear(), calendarDate.getMonth() + Number(d.calendarMove));
    if (target.getFullYear() < 1 || target.getFullYear() > 9999) return;
    calendarDate = target;
    selectedDate = localDate(target.getFullYear(), target.getMonth(), Math.min(selectedDate.getDate(), localDate(target.getFullYear(), target.getMonth()+1, 0).getDate()));
    render();
  }
  else if ('calendarToday' in d) { selectedDate = new Date(); calendarDate = localDate(selectedDate.getFullYear(), selectedDate.getMonth()); render(); }
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
  else if (event.target.id === 'backup-file') previewBackup(event.target.files[0]);
});
document.addEventListener('input', event => {
  if (event.target.id === 'record-search') { recordQuery = event.target.value; renderRecordResults(); }
  else if (event.target.id === 'record-text') document.querySelector('#character-count').textContent = `${event.target.value.length}/1000`;
});
document.addEventListener('submit', event => {
  if (!['task-form','record-form'].includes(event.target.id)) return;
  event.preventDefault();
  const data = new FormData(event.target);
  const date = data.get('date');
  const value = String(data.get(event.target.id === 'task-form' ? 'title' : 'text') || '').trim();
  if (!value || !isDateKey(date)) {
    const field = event.target.querySelector(!value ? '[name="title"], [name="text"]' : '[name="date"]');
    field.setCustomValidity('날짜와 내용을 확인해 주세요.'); field.reportValidity();
    field.addEventListener('input', () => field.setCustomValidity(''), { once:true }); return;
  }
  const id = data.get('entryId');
  if (event.target.id === 'task-form') {
    const task = state.tasks.find(t => t.id === id);
    if (id && !task) return;
    if (task) Object.assign(task, { date, title:value.slice(0,100) });
    else state.tasks.push({ id:crypto.randomUUID(), date, title:value.slice(0,100), done:false });
  } else {
    const entry = state.entries.find(e => e.id === id);
    if (id && !entry) return;
    if (entry) Object.assign(entry, { date, text:value.slice(0,1000) });
    else state.entries.push({ id:crypto.randomUUID(), date, text:value.slice(0,1000) });
    recordQuery = '';
  }
  const persisted = save(); modal.close(); render(); if (persisted) toast('나의 이맘때에 담았어요.');
});
readPage();
if (loadError) toast('저장된 데이터를 읽지 못했어요. 저장 공간 설정을 확인해 주세요.');
