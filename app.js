import { SEASONS, MONTH_NOTES, seasonForMonth, dateKey, localDate, calendarCells, sanitizeState, isDateKey, parseBackup, mergeBackup, CATEGORIES, timelineItems, lastYearRange, safeLink, WORLD_KINDS } from './data.js';
import { parseCalendar, parseExpenses, parseDiary, preparePhoto } from './imports.js';
import { journalShell, journalResults, memoryCard, entryActions,connectionsContent, sourcePreview,expensePanel,diaryConnectionContent,diaryPreview } from './journal.js';
import {REPEATS,scheduleDates} from './planning.js';
import {WEATHER_REGIONS,WEATHER_SOURCE,weatherDescription} from './weather-data.js';
import {naverStatus,naverCalendars,syncNaver,naverPanel,calendarChoices} from './naver.js';
import {DEVICES,previewOptions} from './devices.js';
import {memoryDays,suggestedMemory,memoryStage,worldContext} from './recollection.js';

const devicePreview=previewOptions(location.search);
if(devicePreview) {
  const model=DEVICES[devicePreview.device];
  document.documentElement.dataset.devicePreview=devicePreview.device;
  document.documentElement.style.setProperty('--device-safe-top',`${model.top}px`);
  document.documentElement.style.setProperty('--device-safe-bottom',`${model.bottom}px`);
}

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
let pendingSource = null;
let journalFilter = 'all';
let journalRange = null;
let expenseMonth=dateKey(new Date()).slice(0,7);
let pendingDiary=null;
let pendingWeather=null;
let rememberedDate=null;
let memoryDrag=null;
let naverRunning=false;
let naverConfigured=false;
let lastAutoAttempt='';
const main = document.querySelector('#main');
const modal = document.querySelector('#modal');
const todayKey = () => dateKey(new Date());
const theme = () => SEASONS[seasonForMonth(devicePreview?.month || state.month || new Date().getMonth() + 1)];
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
  catch { toast('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'); return false; }
}
function tasksFor(date) { return state.tasks.filter(task => task.date === date); }
function taskRows(date, id) {
  const tasks = tasksFor(date).filter(task => !id || task.id === id);
  return tasks.length ? tasks.map(task => `<div class="task-row ${task.done ? 'done' : ''}"><button class="task-toggle" data-toggle="${escapeHTML(task.id)}" aria-pressed="${task.done}" aria-label="${escapeHTML(task.title)} 완료">${task.done ? icon('check') : ''}</button><button class="task-title" data-edit-task="${escapeHTML(task.id)}" aria-label="${escapeHTML(task.title)} 수정">${escapeHTML(task.title)}${task.repeat ? `<span class="repeat-label">${REPEATS[task.repeat]} · 반복 일정</span>` : ''}</button><button class="delete-button" data-delete-task="${escapeHTML(task.id)}" aria-label="${escapeHTML(task.title)} 삭제">${icon('bin')}</button></div>`).join('') : '<p class="empty">아직 챙길 일이 없어요.<br>나를 위한 작은 할 일을 담아보세요.</p>';
}
function completionSummary() {
  const tasks = tasksFor(todayKey());
  if (!tasks.length) return '';
  const complete = tasks.filter(task => task.done).length;
  return `<div class="completion-summary"><span>${complete === tasks.length ? '오늘의 작은 약속을 모두 지켰어요.' : '하나씩, 나의 속도로 챙겨요.'}</span><span>${complete}/${tasks.length}</span></div><progress class="completion-progress" max="${tasks.length}" value="${complete}" aria-label="오늘 할 일 완료 현황"></progress>`;
}
function render() {
  document.body.classList.toggle('records-view',page==='records');
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
    const range = lastYearRange(new Date());
    const memories = timelineItems(state).filter(item => item.date >= range.start && item.date <= range.end);
    if (memories.length) main.querySelectorAll('.card')[1].insertAdjacentHTML('afterend', `<section class="card lastyear-card"><div class="card-head"><h2>작년 이맘때</h2><button class="small-button" data-show-lastyear>펼쳐보기 ↗</button></div><p class="source-caption">${range.start} ~ ${range.end} · 선택한 기록 ${memories.length}개</p>${memories.slice(0,3).map(item=>`<div class="memory-peek"><span>${CATEGORIES[item.type]}</span><p>${escapeHTML(item.title)}</p></div>`).join('')}</section>`);
  }
}
function renderToday() {
  const season = theme();
  const month = devicePreview?.month || state.month || new Date().getMonth() + 1;
  const memories = [];
  main.innerHTML = `${(state.month && !devicePreview?.month) ? `<div class="preview-banner"><span>${month}월 테마 미리보기 · 날짜와 일정은 오늘 기준</span><button data-auto>현재 계절로</button></div>` : ''}<p class="eyebrow">${fullDate(new Date())}</p><h1>${season.title}</h1><div class="accent-line"></div><section class="hero" aria-label="${season.name} 캐릭터"><span class="month-chip">${MONTH_NOTES[month - 1]}</span><div class="mascot" role="img" aria-label="${season.name} 옷을 입은 둥근 돌 캐릭터"></div><p class="hero-note">${season.greeting}</p></section><section class="card"><div class="card-head"><h2>오늘 챙길 일</h2><button class="small-button" data-add-task="${todayKey()}" aria-label="오늘 할 일 추가">${icon('plus')} 추가</button></div>${taskRows(todayKey())}${!tasksFor(todayKey()).length ? `<button class="small-button" data-suggest-task>${season.task} 담기 ${icon('right')}</button>` : ''}</section><section class="card"><div class="card-head"><h2>이맘때 이야기</h2></div><button class="story-button" data-story><span class="story-symbol">${icon('leaf')}</span><span class="story-copy"><span>${season.category}</span><strong>${season.story}</strong></span>${icon('right')}</button></section>${memories.length ? `<section class="card"><h2>작년 이맘때</h2>${memories.map(entry => `<div class="memory"><span>${escapeHTML(entry.date)}</span><p>${escapeHTML(entry.text)}</p></div>`).join('')}</section>` : `<button class="memory" data-add-record="${todayKey()}"><span>오늘을 기억하는 작은 방법</span><p>지금의 계절을 한 줄로 남겨볼까요? ↗</p></button>`}<p class="quiet-note">계절은 천천히, 나의 하루는 나답게.<br>대한민국의 월별 계절 테마 · 실시간 날씨 미연동</p>`;
}
function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const selected = dateKey(selectedDate);
  const cells = calendarCells(year, month);
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">계절 사이, 나의 일정</p><h1>달력</h1></div><button class="small-button" data-calendar-today>오늘로</button></div><section class="card"><div class="calendar-head"><strong>${year}년 ${month + 1}월</strong><div class="calendar-controls"><button class="icon-button" data-calendar-move="-1" aria-label="이전 달">${icon('left')}</button><button class="icon-button" data-calendar-move="1" aria-label="다음 달">${icon('right')}</button></div></div><div class="calendar-grid" role="group" aria-label="${year}년 ${month + 1}월 날짜 선택">${['일','월','화','수','목','금','토'].map(day => `<span class="weekday">${day}</span>`).join('')}${cells.map(day => {
    if (!day) return '<span></span>';
    const key = dateKey(localDate(year, month, day));
    const hasData = tasksFor(key).length || state.entries.some(entry => entry.date === key) || state.memories.some(memory => memory.date === key);
    return `<button class="day ${key === todayKey() ? 'today' : ''} ${key === selected ? 'selected' : ''} ${hasData ? 'has-data' : ''}" data-date="${key}" aria-pressed="${key === selected}" aria-label="${month + 1}월 ${day}일${hasData ? ', 일정 또는 기록 있음' : ''}" ${key === todayKey() ? 'aria-current="date"' : ''}>${day}</button>`;
  }).join('')}</div></section><div class="card-head selected-heading"><h2>${fullDate(selectedDate)}</h2><button class="small-button" data-add-task="${selected}">${icon('plus')} 일정</button></div><section class="card">${taskRows(selected)}</section><div class="card-head selected-heading"><h2>이날의 기록</h2><button class="small-button" data-add-record="${selected}">${icon('plus')} 기록</button></div>${state.entries.filter(e => e.date === selected).map(recordCard).join('') || '<p class="empty">이날의 순간을 한 줄로 남겨보세요.</p>'}${state.memories.filter(memory=>memory.date === selected && state.categories.includes(memory.type)).map(memoryCard).join('')}`;
}
function recordCard(entry) {
  return `<article class="card record-card diary-entry"><div class="record-head"><time datetime="${escapeHTML(entry.date)}">${escapeHTML(entry.date.replaceAll('-', '. '))}</time><span class="diary-label">일기</span>${entryActions('record',entry.id,`${entry.date} 일기`)}</div><p>${escapeHTML(entry.text)}</p>${entry.source ? `<p class="source-caption">${escapeHTML(entry.source)}</p>` : ''}</article>`;
}
function renderRecords() {
  const openContextDate=main.querySelector('[data-world-context][open]')?.dataset.worldContext;
  if (journalFilter !== 'all' && !state.categories.includes(journalFilter)) journalFilter = 'all';
  main.innerHTML = journalShell(state, recordQuery, journalFilter);
  renderMemoryStage();
  const context=main.querySelector('[data-world-context]');
  if (context && context.dataset.worldContext===openContextDate) context.open=true;
  if(journalFilter==='expenses') document.querySelector('#record-search').insertAdjacentHTML('beforebegin',expensePanel(state,expenseMonth));
  const world=main.querySelector('.world-note');if(world) world.insertAdjacentHTML('beforeend','<button class="small-button" data-weather>그날의 날씨 찾기 ↗</button>');
  if (journalRange) {
    const {start,end}=journalRange;
    const period=start===end ? start : `${start} ~ ${end}`;
    document.querySelector('#record-search').insertAdjacentHTML('beforebegin', `<div class="preview-banner"><span>${period}</span><button data-clear-range>전체 기간</button></div>`);
  }
  renderRecordResults();
}
function renderRecordResults() {
  const results = document.querySelector('#record-results');
  if (!results) return;
  let filteredState = journalRange ? {...state,tasks:state.tasks.filter(item=>inRange(item)),entries:state.entries.filter(item=>inRange(item)),memories:state.memories.filter(item=>inRange(item))} : state;
  if(journalFilter==='expenses') filteredState={...filteredState,memories:filteredState.memories.filter(item=>item.date.startsWith(expenseMonth))};
  const result = journalResults(filteredState, recordQuery, journalFilter, recordCard, taskRows);
  document.querySelector('#search-count').textContent = `${result.count}개`;
  results.innerHTML = result.html;
}
function inRange(item) { return item.date >= journalRange.start && item.date <= journalRange.end; }
function availableMemories() {
  return memoryDays(state,new Date(),journalFilter).filter(day=>!journalRange || inRange(day));
}
function renderMemoryStage(direction=0) {
  const target=document.querySelector('#recollection');if(!target)return;
  resetMemoryDrag();
  const days=availableMemories();
  if(!days.some(day=>day.date===rememberedDate))rememberedDate=suggestedMemory(days);
  target.hidden=Boolean(recordQuery.trim());
  const context=rememberedDate && state.categories.includes('world')
    ? worldContext(state.memories,rememberedDate,todayKey()) : null;
  target.innerHTML=memoryStage(days,rememberedDate,{direction,rangeActive:Boolean(journalRange),context});
}
function stepMemory(step) {
  const days=availableMemories();const index=days.findIndex(day=>day.date===rememberedDate);
  const next=days[index+step];if(!next)return;
  const focused=document.activeElement?.dataset.memoryStep;
  const stageFocused=document.activeElement?.hasAttribute('data-memory-stage');
  rememberedDate=next.date;renderMemoryStage(step);
  if(stageFocused) document.querySelector('[data-memory-stage]')?.focus({preventScroll:true});
  else if(focused){const button=document.querySelector(`[data-memory-step="${focused}"]`);if(button && !button.disabled)button.focus({preventScroll:true});else document.querySelector('[data-memory-stage]')?.focus({preventScroll:true});}
}
function resetMemoryDrag() {
  if (!memoryDrag) return;
  memoryDrag.stage.classList.remove('is-dragging');
  memoryDrag.stage.style.removeProperty('--memory-offset');
  memoryDrag=null;
}
document.addEventListener('pointerdown', event=>{
  const stage=event.target.closest('[data-swipeable]');
  if (!stage || !event.isPrimary || event.button!==0) return;
  resetMemoryDrag();
  memoryDrag={stage, id:event.pointerId, x:event.clientX, y:event.clientY};
});
document.addEventListener('pointermove', event=>{
  if (memoryDrag?.id!==event.pointerId) return;
  const {stage,x,y}=memoryDrag;
  const deltaX=event.clientX-x;
  const deltaY=event.clientY-y;
  if (!stage.classList.contains('is-dragging')) {
    if (Math.abs(deltaY)>8 && Math.abs(deltaY)>=Math.abs(deltaX)) {
      resetMemoryDrag();
      return;
    }
    if (Math.abs(deltaX)<8 || Math.abs(deltaX)<=Math.abs(deltaY)*1.5) return;
    stage.classList.add('is-dragging');
    if (event.isTrusted) stage.setPointerCapture(event.pointerId);
  }
  const step=deltaX<0 ? 1 : -1;
  const atEdge=stage.closest('.recollection').querySelector(`[data-memory-step="${step}"]`).disabled;
  const offset=Math.max(-64,Math.min(64,deltaX*(atEdge ? .16 : .62)));
  stage.style.setProperty('--memory-offset',`${offset}px`);
});
document.addEventListener('pointerup', event=>{
  if (memoryDrag?.id!==event.pointerId) return;
  const {stage,x,y}=memoryDrag;
  const deltaX=event.clientX-x;
  const deltaY=event.clientY-y;
  resetMemoryDrag();
  if (stage.isConnected && Math.abs(deltaX)>45 && Math.abs(deltaX)>Math.abs(deltaY)*1.5) {
    stepMemory(deltaX<0 ? 1 : -1);
  }
});
for (const type of ['pointercancel','lostpointercapture']) {
  document.addEventListener(type,event=>{
    if (memoryDrag?.id===event.pointerId) resetMemoryDrag();
  });
}
window.addEventListener('blur',resetMemoryDrag);
document.addEventListener('keydown',event=>{
  if(event.target.matches('[data-memory-stage]') && ['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();stepMemory(event.key==='ArrowRight'?1:-1);}
});
function openModal(title, body) {
  document.querySelector('#modal-content').innerHTML = `<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-close aria-label="닫기">${icon('close')}</button></div>${body}`;
  modal.showModal();
}
function openTask(date, title = '', id = '') {
  openModal(id ? '챙길 일 수정' : '챙길 일 담기', `<form id="task-form"><input type="hidden" name="entryId" value="${escapeHTML(id)}"><label for="task-title">어떤 일을 챙길까요?</label><input id="task-title" name="title" maxlength="100" required placeholder="예: 겨울 침구 꺼내기" value="${escapeHTML(title)}"><label for="task-date">날짜</label><input id="task-date" name="date" type="date" min="0001-01-01" max="9999-12-31" required value="${date}"><button class="primary-button full" type="submit">${id ? '수정한 내용 저장' : '달력에 담기'}</button><p class="field-hint">선택한 날짜에 저장돼요. 알림 기능은 아직 제공하지 않아요.</p></form>`);
  const submit=document.querySelector('#task-form button[type=submit]');
  submit.insertAdjacentHTML('beforebegin',id ? '<p class="field-hint">반복해서 만든 일정도 선택한 한 건만 수정해요.</p><p class="form-error" id="task-error" role="alert"></p>' : `<label for="task-repeat">반복</label><select id="task-repeat" name="repeat">${Object.entries(REPEATS).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><label for="task-until">반복 종료일</label><input id="task-until" name="until" type="date" min="${date}" max="9999-12-31" disabled><p class="field-hint">종료일까지 최대 366개의 일정을 만들어요. 매월·매년 반복 시 없는 날짜는 그달 말일로 맞춰요.</p><p class="form-error" id="task-error" role="alert"></p>`);
}
function openRecord(date, text = '', id = '') {
  openModal(id ? '기록 수정' : '오늘의 한 줄', `<form id="record-form"><input type="hidden" name="entryId" value="${escapeHTML(id)}"><label for="record-date">기억할 날짜</label><input id="record-date" name="date" type="date" min="0001-01-01" max="9999-12-31" required value="${date}"><label for="record-text">어떤 순간을 남길까요?</label><textarea id="record-text" name="text" maxlength="1000" required placeholder="오늘 바람에서 겨울 냄새가 났다.">${escapeHTML(text)}</textarea><p class="character-count" id="character-count">${text.length}/1000</p><button class="primary-button full" type="submit">${id ? '수정한 내용 저장' : '기록 남기기'}</button><p class="field-hint">글은 이 기기의 브라우저에만 저장돼요.</p></form>`);
}
function openSettings() {
  openModal('나의 이맘때', `<p class="modal-text">계절은 바뀌어도, 나의 하루는 여기에서.</p><label for="month-select">계절 테마</label><select id="month-select"><option value="">현재 월에 맞춰 자동</option>${MONTH_NOTES.map((note,i) => `<option value="${i+1}" ${state.month === i+1 ? 'selected' : ''}>${note}</option>`).join('')}</select><p class="field-hint">미리보기는 캐릭터와 계절 이야기만 바꿔요. 일정과 기록의 날짜는 바뀌지 않아요. 옷차림과 배경은 사계절 단위로, 문구는 월별로 달라져요.</p><button class="primary-button full" data-export>내 일정과 기록 내려받기</button><p class="field-hint">현재 기기의 데이터를 JSON 파일로 보관할 수 있어요. 계정 동기화·알림·날씨 자동 연동은 이후 업데이트 항목이에요.</p>`);
  document.querySelector('#modal-content').insertAdjacentHTML('beforeend', `<div class="backup-section"><h2>백업에서 다시 이어가기</h2><label for="backup-file">이맘때 백업 파일 선택</label><input type="file" id="backup-file" accept=".json,application/json"><p class="field-hint">10MB 이하의 JSON 파일을 선택해 주세요. 내용을 확인한 뒤 새 항목만 추가해요. 이전에 가져온 항목은 현재 내용을 유지해요.</p><p id="import-error" class="form-error" role="alert"></p></div>`);
  document.querySelector('#modal-content').insertAdjacentHTML('beforeend','<button class="primary-button full" data-connections>기록 종류와 가져오기 설정</button>');
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
    openModal('백업을 가져올까요?', `<p class="modal-text">새로운 계절의 조각을 지금의 기록에 이어 붙여요.</p><dl class="import-summary"><div><dt>추가할 일정</dt><dd>${result.addedTasks}개</dd></div><div><dt>추가할 일기</dt><dd>${result.addedEntries}개</dd></div><div><dt>추가할 통합 기록</dt><dd>${result.addedMemories}개</dd></div><div><dt>이미 있는 항목</dt><dd>${result.skipped}개</dd></div></dl><p class="field-hint">현재 데이터와 테마 설정, 기록 종류 선택은 유지해요. 이미 있는 항목은 백업 내용으로 덮어쓰지 않아요.</p><p id="restore-error" class="form-error" role="alert"></p><button class="primary-button full" data-confirm-import ${result.addedTasks + result.addedEntries + result.addedMemories ? '' : 'disabled'}>새 항목 가져오기</button>`);
  } catch (problem) {
    if (error.isConnected && modal.open) error.textContent = problem.message || '파일을 읽지 못했어요. 다시 선택해 주세요.';
  } finally {
    input.disabled = false;
    input.value = '';
  }
}
async function previewSource(input) {
  const error=document.querySelector('#source-error');
  const files=[...input.files]; if(!files.length) return;
  input.disabled=true; error.textContent='파일을 확인하고 있어요…';
  try {
    let result;
    if(input.id === 'photo-files') {
      if(files.length > 10) throw new Error('사진은 한 번에 10장까지 선택해 주세요.');
      const items=[]; for(const file of files) items.push(await preparePhoto(file));
      result={items,skipped:0};
    } else {
      if(files[0].size > 2*1024*1024) throw new Error('2MB 이하의 파일을 선택해 주세요.');
      const text=await files[0].text();
      if(input.id==='diary-file') {
        const entries=await parseDiary(text,`일기 CSV · ${files[0].name}`);
        if(!input.isConnected || !modal.open)return;
        if(!entries.length)throw new Error('가져올 일기가 없어요.');
        pendingDiary=entries;const ids=new Set(state.entries.map(entry=>entry.id));
        openModal('일기를 확인해 주세요',diaryPreview(entries,entries.filter(entry=>ids.has(entry.id)).length));return;
      }
      result=input.id === 'calendar-file' ? parseCalendar(text,files[0].name) : await parseExpenses(text,files[0].name);
    }
    if(!input.isConnected || !modal.open) return;
    if(!result.items.length) throw new Error(`가져올 항목이 없어요.${result.skipped ? ` 반복·취소 일정 ${result.skipped}개는 지원하지 않아요.` : ''}`);
    pendingSource=[...new Map(result.items.map(item=>[item.id,item])).values()];
    const currentIds=new Set(state.memories.map(item=>item.id));
    const existing=pendingSource.filter(item=>currentIds.has(item.id)).length;
    openModal('기록을 확인해 주세요',sourcePreview(pendingSource,result.skipped,existing,result.items.length-pendingSource.length));
  } catch(problem) { if(error.isConnected && modal.open) error.textContent=problem.message || '파일을 읽지 못했어요. 지원하는 파일인지 확인해 주세요.'; }
  finally { input.disabled=false;input.value=''; }
}
function openMemoryForm(type, item, date=todayKey()) {
  const labels={expenses:'지출',photos:'사진',calendar:'가져온 일정',world:'그날의 바깥'};
  const kind=item?.worldKind || 'link';
  const worldFields=type==='world' ? `
    <label for="memory-kind">소식 종류</label>
    <select id="memory-kind" name="worldKind">${Object.entries(WORLD_KINDS).map(([key,label])=>`<option value="${key}" ${key===kind?'selected':''}>${label}</option>`).join('')}</select>
    <div class="memory-area" ${kind==='local'?'':'hidden'}>
      <label for="memory-area">동네 이름</label>
      <input id="memory-area" name="area" maxlength="80" value="${escapeHTML(item?.area || '')}" ${kind==='local'?'required':''}>
    </div>` : '';
  const sourceFields=type==='world' ? `
    <label for="memory-source">출처 이름</label>
    <input id="memory-source" name="source" maxlength="200" value="${escapeHTML(item?.url ? item.source : '')}" ${kind==='local'?'':'required'}>
    <label for="memory-url">당시 자료 링크</label>
    <input id="memory-url" name="url" type="url" value="${escapeHTML(item?.url || '')}" ${kind==='local'?'':'required'}>
    <p class="field-hint">직접 본 동네 변화는 링크 없이 남길 수 있어요.</p>
    <label for="memory-current-url">현재 정보 링크 (선택)</label>
    <input id="memory-current-url" name="currentUrl" type="url" value="${escapeHTML(item?.currentUrl || '')}">` : '';
  openModal(`${labels[type]} ${item ? '수정' : '남기기'}`,`<form id="memory-form">
    <input name="memoryId" type="hidden" value="${escapeHTML(item?.id || '')}">
    <input name="memoryType" type="hidden" value="${type}">
    ${worldFields}
    <label for="memory-date">${type==='world' ? '일어난 날 또는 직접 본 날' : '기억할 날짜'}</label>
    <input id="memory-date" name="date" type="date" min="0001-01-01" max="9999-12-31" value="${item?.date || date}" required>
    <label for="memory-title">내용</label>
    <input id="memory-title" name="title" maxlength="200" value="${escapeHTML(item?.title || '')}" required>
    ${type === 'expenses' ? `<label for="memory-amount">지출 금액 · 원</label><input id="memory-amount" name="amount" type="number" min="1" max="1000000000000" step="1" value="${item?.amount || ''}" required>` : ''}
    ${sourceFields}
    <label for="memory-note">메모</label>
    <textarea id="memory-note" name="text" maxlength="2000">${escapeHTML(item?.text || '')}</textarea>
    <p id="source-error" class="form-error" role="alert"></p>
    <button type="submit" class="primary-button full">저장하기</button>
  </form>`);
}
function openWeather() {
  pendingWeather=null;
  const date=lastYearRange(new Date(),0).anchor;
  const latest=new Date();latest.setDate(latest.getDate()-7);
  openModal('그날의 날씨',`<form id="weather-form"><label for="weather-date">기억할 날짜</label><input id="weather-date" name="date" type="date" min="1940-01-01" max="${dateKey(latest)}" value="${date}" required><label for="weather-region">그때 있던 지역</label><select id="weather-region" name="region">${Object.entries(WEATHER_REGIONS).map(([id,region])=>`<option value="${id}">${region.name} · 대표 좌표</option>`).join('')}</select><p class="field-hint">조회하면 선택한 날짜와 지역 대표 좌표를 Open-Meteo로 보내요. 당시 내 위치는 자동으로 추정하지 않아요. 제공되는 재분석 자료는 관측소의 실제 측정값과 다를 수 있어요.</p><p id="weather-error" class="form-error" role="alert"></p><button type="submit" class="primary-button full">과거 날씨 조회</button></form><div id="weather-result"></div>`);
}
async function queryWeather(form) {
  const error=document.querySelector('#weather-error');const result=document.querySelector('#weather-result');const button=form.querySelector('button');
  pendingWeather=null;result.innerHTML='';button.disabled=true;button.textContent='날씨를 확인하고 있어요…';error.textContent='';
  try {
    const data=new FormData(form);const date=data.get('date'),region=data.get('region');
    const response=await fetch('/api/weather/history',{method:'POST',headers:{'Content-Type':'application/json','X-Imamttae-Request':'1'},body:JSON.stringify({date,region})});
    const weather=await response.json();
    if(!result.isConnected || !modal.open)return;
    if(!response.ok)throw new Error(weather.error || '날씨를 확인하지 못했어요.');
    if(weather.date!==date || weather.regionId!==region || !Object.hasOwn(WEATHER_REGIONS,region) || ![weather.minimum,weather.maximum,weather.precipitation].every(value=>typeof value==='number' && Number.isFinite(value)))throw new Error('날씨 자료를 확인하지 못했어요.');
    pendingWeather={...weather,regionLabel:WEATHER_REGIONS[region].name};
    result.innerHTML=`<section class="weather-result"><p class="eyebrow">${weather.date} · ${WEATHER_REGIONS[region].name} 대표 좌표</p><h3>${weather.minimum}°C <span>~</span> ${weather.maximum}°C</h3><p>하루 강수량 ${weather.precipitation}mm</p><p class="field-hint">Open-Meteo · ERA5 재분석 · 기온 °C / 강수 mm<br>해당 지역 대표 좌표의 자료예요.</p><a class="source-link" href="${WEATHER_SOURCE}" target="_blank" rel="noopener noreferrer">자료 출처와 설명 ↗</a><button class="primary-button full" data-save-weather>이 날짜의 기록으로 담기</button></section>`;
  }catch(problem){if(error.isConnected)error.textContent=problem.message || '조회에 실패했어요. 잠시 후 다시 시도해 주세요.';}
  finally{button.disabled=false;button.textContent='과거 날씨 조회';}
}
function saveWeather() {
  if(!pendingWeather)return;
  const weather=pendingWeather;
  const memory={id:`weather:${weather.regionId}:${weather.date}`,type:'world',date:weather.date,title:`${weather.regionLabel} · 그날의 날씨`,text:`${weatherDescription(weather)}\n조회일: ${todayKey()}`,source:'Open-Meteo · ERA5 재분석',url:WEATHER_SOURCE};
  const merged=mergeBackup(state,{tasks:[],entries:[],memories:[memory]});
  if(!save(merged.state)){document.querySelector('#weather-error').textContent='저장하지 못했어요. 기존 기록은 유지했어요.';return;}
  state=merged.state;pendingWeather=null;modal.close();render();toast(merged.addedMemories ? '그날의 날씨를 기록에 담았어요.' : '이미 기록한 지역과 날짜예요. 기존 기록을 유지했어요.');
}
document.addEventListener('submit',event=>{
  if(event.target.id==='weather-form'){event.preventDefault();queryWeather(event.target);}
  else if(event.target.id==='diary-import-form') {
    event.preventDefault();if(!pendingDiary)return;
    const merged=mergeBackup(state,{tasks:[],entries:pendingDiary,memories:[]});
    if(!save(merged.state)){document.querySelector('#diary-error').textContent='일기를 저장하지 못했어요. 기존 기록은 유지했어요.';return;}
    state=merged.state;pendingDiary=null;recordQuery='';modal.close();render();toast(`일기 ${merged.addedEntries}개를 가져왔어요.`);
  }
});
document.addEventListener('submit',event=>{
  if(!['source-form','memory-form'].includes(event.target.id)) return;
  event.preventDefault();
  const error=document.querySelector('#source-error');
  let next;
  if(event.target.id === 'source-form') {
    if(!pendingSource) return;
    const items=pendingSource.map(item=>({...item}));
    for(const input of event.target.querySelectorAll('[data-photo-date]')) {
      const item=items[Number(input.dataset.photoDate)];
      if(!isDateKey(input.value)) {error.textContent='모든 사진의 날짜를 확인해 주세요.';return;}
      if(item.date!==input.value) item.dateBasis='직접 선택';
      item.date=input.value;
    }
    const unique=[...new Map(items.map(item=>[item.id,item])).values()];
    const verified=sanitizeState({...state,memories:unique}).memories;
    if(verified.length!==unique.length) {error.textContent='기록의 날짜와 내용을 다시 확인해 주세요.';return;}
    next=mergeBackup(state,{tasks:[],entries:[],memories:verified}).state;
  } else {
    const data=new FormData(event.target);
    const id=data.get('memoryId');
    const previous=state.memories.find(item=>item.id===id);
    if(id && !previous) return;
    const type=data.get('memoryType');
    const date=data.get('date');
    const item={...previous,id:id || crypto.randomUUID(),type,date,title:String(data.get('title') || '').trim(),text:String(data.get('text') || '').trim(),source:previous?.source || '직접 쓴 가계부'};
    if(type==='expenses') item.amount=Number(data.get('amount'));
    if(type==='world') {
      item.worldKind=data.get('worldKind');
      item.area=String(data.get('area') || '').trim();
      const url=String(data.get('url') || '').trim();
      const currentUrl=String(data.get('currentUrl') || '').trim();
      item.url=safeLink(url);
      item.currentUrl=safeLink(currentUrl);
      if ((url && !item.url) || (currentUrl && !item.currentUrl)) {
        error.textContent='http 또는 https 링크를 입력해 주세요.';
        return;
      }
      item.source=item.worldKind==='local' && !item.url ? '직접 남긴 메모' : String(data.get('source') || '').trim();
    }
    if(type==='photos' && date!==previous.date) item.dateBasis='직접 선택';
    const verified=sanitizeState({...state,memories:[item]}).memories;
    if(!verified.length) {error.textContent='실제 날짜·내용·금액·출처 링크를 확인해 주세요.';return;}
    next={...state,memories:previous ? state.memories.map(memory=>memory.id===id ? verified[0] : memory) : [...state.memories,verified[0]]};
  }
  if(!save(next)) {error.textContent='저장하지 못했어요. 기존 기록은 유지했어요. 백업 후 저장 공간을 확인해 주세요.';return;}
  state=next;pendingSource=null;modal.close();render();toast('나의 기록에 담았어요.');
});
async function openConnections() {
  openModal('기록 연결',connectionsContent(state)+diaryConnectionContent()+naverPanel(state));
  const status=document.querySelector('#naver-status');
  try {
    const result=await naverStatus();
    if(!status.isConnected || !modal.open) return;
    naverConfigured=result.configured===true;
    status.textContent=naverConfigured ? '서버 설정이 있어요. 캘린더 목록을 확인하고 가져올 대상을 골라주세요.' : '로컬 서버에 네이버 연결 설정이 필요해요. 설정 전에는 ICS 파일로 가져올 수 있어요.';
    document.querySelector('[data-naver-list]').disabled=!naverConfigured || naverRunning;
    document.querySelector('[data-naver-sync]').disabled=!naverConfigured || !state.naver.calendarIds.length || naverRunning;
    document.querySelector('#naver-auto').disabled=!naverConfigured || !state.naver.calendarIds.length;
  } catch(problem) {if(status.isConnected) status.textContent=problem.message;}
}
async function loadNaverCalendars(button) {
  const target=document.querySelector('#naver-calendars');
  const error=document.querySelector('#naver-error');
  button.disabled=true;error.textContent='';
  try {
    const result=await naverCalendars();
    if(!target.isConnected || !modal.open) return;
    target.innerHTML=calendarChoices(result.calendars,state.naver.calendarIds);
  } catch(problem) {if(error.isConnected) error.textContent=problem.message;}
  finally {button.disabled=false;}
}
async function runNaverSync(automatic=false) {
  if(naverRunning || !state.naver.calendarIds.length) return;
  naverRunning=true;
  const syncDate=todayKey();
  const error=document.querySelector('#naver-error');
  if(error) error.textContent='';
  for(const button of document.querySelectorAll('[data-naver-sync],[data-naver-list],[data-naver-calendar]')) button.disabled=true;
  try {
    const result=await syncNaver(syncDate,state.naver.calendarIds);
    if(!Array.isArray(result.items) || !Number.isInteger(result.skipped) || result.skipped<0) throw new Error('네이버 조회 결과를 확인하지 못했어요.');
    const verified=sanitizeState({...state,memories:result.items}).memories;
    if(verified.length!==result.items.length) throw new Error('네이버 일정의 날짜와 내용을 확인하지 못해 이번 조회를 적용하지 않았어요.');
    const merged=mergeBackup(state,{tasks:[],entries:[],memories:verified});
    const next={...merged.state,naver:{...state.naver,lastSyncDate:syncDate}};
    if(!save(next)) throw new Error('가져온 일정을 저장하지 못했어요. 기존 기록은 유지했어요.');
    state=next;render();
    const status=document.querySelector('#naver-status');
    const message=`네이버에서 새 일정 ${merged.addedMemories}개를 가져왔어요.${result.skipped ? ` 반복·취소 ${result.skipped}개는 제외했어요.` : ''}`;
    if(status) status.textContent=message;
    const lastCheck=document.querySelector('#naver-last-check');if(lastCheck) lastCheck.textContent=`마지막 확인: ${syncDate}`;
    if(!automatic || merged.addedMemories || result.skipped) toast(message);
  } catch(problem) {if(error?.isConnected) error.textContent=problem.message;else toast(problem.message);}
  finally {
    naverRunning=false;
    for(const input of document.querySelectorAll('[data-naver-calendar]')) input.disabled=false;
    const sync=document.querySelector('[data-naver-sync]'); if(sync) sync.disabled=!naverConfigured || !state.naver.calendarIds.length;
    const list=document.querySelector('[data-naver-list]'); if(list) list.disabled=!naverConfigured;
  }
}
function maybeAutoNaver() {
  if(state.naver.automatic && state.naver.calendarIds.length && state.naver.lastSyncDate!==todayKey() && lastAutoAttempt!==todayKey()) {lastAutoAttempt=todayKey();runNaverSync(true);}
}
function readPage() {
  page = ['calendar','records'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
  render();
}
document.querySelector('#settings-button').innerHTML = icon('settings');
document.querySelector('#settings-button').addEventListener('click', openSettings);
modal.addEventListener('close', () => { if (!modal.open) { pendingImport = null; pendingSource = null;pendingDiary=null;pendingWeather=null; } });
window.addEventListener('hashchange', () => { readPage(); main.focus(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !modal.open) {render();maybeAutoNaver();} });
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const d = button.dataset;
  if ('close' in d) modal.close();
  else if ('connections' in d) openConnections();
  else if ('naverList' in d) loadNaverCalendars(button);
  else if ('naverSync' in d) runNaverSync();
  else if ('memoryStep' in d) stepMemory(Number(d.memoryStep));
  else if ('memoryOpen' in d) {
    journalRange={start:d.memoryOpen,end:d.memoryOpen};renderRecords();
    document.querySelector('#record-results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  else if ('weather' in d) openWeather();
  else if ('saveWeather' in d) saveWeather();
  else if ('journalFilter' in d) { journalFilter=d.journalFilter; renderRecords(); }
  else if ('showLastyear' in d) { journalRange=lastYearRange(new Date()); recordQuery=''; journalFilter='all'; if(location.hash === '#records') renderRecords(); else location.hash='records'; }
  else if ('clearRange' in d) { journalRange=null; renderRecords(); }
  else if ('openPhoto' in d) { const item=state.memories.find(item=>item.id===d.openPhoto); if(item) openModal('기억 속 사진', `<img class="full-photo" src="${escapeHTML(item.imageData)}" alt="${escapeHTML(item.title)}"><p class="source-caption">${item.date} · ${escapeHTML(item.title)}</p>`); }
  else if ('editMemory' in d) { const item=state.memories.find(item=>item.id===d.editMemory); if(item) openMemoryForm(item.type,item); }
  else if ('deleteMemory' in d) openModal('기록을 삭제할까요?', `<p class="modal-text">선택한 기록만 삭제해요. 원본 파일은 변경하지 않아요.</p><button class="primary-button full" data-confirm-memory="${escapeHTML(d.deleteMemory)}">삭제하기</button>`);
  else if ('confirmMemory' in d) { const next={...state,memories:state.memories.filter(item=>item.id!==d.confirmMemory)}; if(save(next)) {state=next;modal.close();render();} }
  else if ('addExpense' in d) openMemoryForm('expenses');
  else if ('addWorld' in d) openMemoryForm('world',undefined,isDateKey(d.addWorld) ? d.addWorld : todayKey());
  else if ('contextPlan' in d) {
    const item=state.memories.find(memory=>memory.id===d.contextPlan && memory.worldKind==='local');
    if (item) openTask(todayKey(),`${item.area} 둘러보기`.slice(0,100));
  }
  else if ('auto' in d) { state.month = null; save(); render(); }
  else if ('addTask' in d) openTask(d.addTask);
  else if ('suggestTask' in d) openTask(todayKey(), theme().task);
  else if ('addRecord' in d) openRecord(d.addRecord);
  else if ('editTask' in d) { const task = state.tasks.find(t => t.id === d.editTask); if (task) openTask(task.date, task.title, task.id); }
  else if ('editRecord' in d) { const entry = state.entries.find(e => e.id === d.editRecord); if (entry) openRecord(entry.date, entry.text, entry.id); }
  else if ('clearSearch' in d) { recordQuery = ''; document.querySelector('#record-search').value = ''; renderRecordResults();renderMemoryStage(); document.querySelector('#record-search').focus(); }
  else if ('confirmImport' in d && pendingImport) {
    const result = mergeBackup(state, pendingImport);
    if (!save(result.state)) { document.querySelector('#restore-error').textContent = '기기에 저장하지 못했어요. 기존 데이터는 유지했어요. 저장 공간을 확인하고 다시 시도해 주세요.'; return; }
    state = result.state;
    pendingImport = null;
    modal.close(); render(); toast(`${result.addedTasks+result.addedEntries+result.addedMemories}개의 기록을 가져왔어요.`);
  }
  else if ('toggle' in d) {const next={...state,tasks:state.tasks.map(task=>task.id===d.toggle ? {...task,done:!task.done} : task)};if(save(next)){state=next;render();}}
  else if ('deleteTask' in d) {
    const task = state.tasks.find(t => t.id === d.deleteTask);
    if (task) openModal('할 일을 삭제할까요?', `<p class="modal-text">${escapeHTML(task.title)}</p><button class="primary-button full" data-confirm-task="${escapeHTML(task.id)}">선택한 일정만 삭제</button>${task.seriesId ? `<button class="small-button full" data-delete-series="${escapeHTML(task.seriesId)}">이 반복 일정 전체 삭제…</button>` : ''}`);
  }
  else if ('deleteSeries' in d) openModal('반복 일정 전체를 삭제할까요?',`<p class="modal-text">이 묶음의 ${state.tasks.filter(task=>task.seriesId===d.deleteSeries).length}개 일정을 삭제해요. 완료한 과거 일정도 포함되며 되돌릴 수 없어요.</p><button class="primary-button full" data-confirm-series="${escapeHTML(d.deleteSeries)}">반복 일정 전체 삭제</button>`);
  else if ('confirmSeries' in d) {const next={...state,tasks:state.tasks.filter(task=>task.seriesId!==d.confirmSeries)};if(save(next)){state=next;modal.close();render();}}
  else if ('confirmTask' in d) {const next={...state,tasks:state.tasks.filter(t=>t.id!==d.confirmTask)};if(save(next)){state=next;modal.close();render();}}
  else if ('deleteRecord' in d) openModal('기록을 삭제할까요?', `<p class="modal-text">삭제한 기록은 되돌릴 수 없어요.</p><button class="primary-button full" data-confirm-record="${escapeHTML(d.deleteRecord)}">삭제하기</button>`);
  else if ('confirmRecord' in d) {const next={...state,entries:state.entries.filter(e=>e.id!==d.confirmRecord)};if(save(next)){state=next;modal.close();render();}}
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
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version:3, ...state }, null, 2)], { type:'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `imamttae-${todayKey()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'month-select') { state.month = Number(event.target.value) || null; save(); render(); }
  else if (event.target.id === 'memory-kind') {
    const local=event.target.value==='local';
    const form=event.target.form;
    form.querySelector('.memory-area').hidden=!local;
    form.elements.area.required=local;
    form.elements.source.required=!local;
    form.elements.url.required=!local;
  }
  else if (event.target.id === 'backup-file') previewBackup(event.target.files[0]);
  else if (['calendar-file','expense-file','photo-files','diary-file'].includes(event.target.id)) previewSource(event.target);
  else if(event.target.id==='expense-month' && /^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) {expenseMonth=event.target.value;renderRecords();}
  else if(event.target.id==='task-repeat') {const until=document.querySelector('#task-until');until.disabled=event.target.value==='none';until.required=!until.disabled;}
  else if(event.target.id==='task-date' && document.querySelector('#task-until')) document.querySelector('#task-until').min=event.target.value;
  else if (event.target.matches('[data-naver-calendar]')) {
    const ids=[...document.querySelectorAll('[data-naver-calendar]:checked')].map(input=>input.dataset.naverCalendar);
    if(ids.length>10) {event.target.checked=false;document.querySelector('#naver-error').textContent='한 번에 최대 10개까지 선택할 수 있어요.';return;}
    const next={...state,naver:{...state.naver,calendarIds:ids,automatic:ids.length>0 && state.naver.automatic,lastSyncDate:null}};
    if(save(next)) {state=next;document.querySelector('[data-naver-sync]').disabled=!ids.length;document.querySelector('#naver-auto').disabled=!ids.length;document.querySelector('#naver-auto').checked=next.naver.automatic;}
    else event.target.checked=!event.target.checked;
  }
  else if(event.target.id==='naver-auto') {
    const next={...state,naver:{...state.naver,automatic:event.target.checked && state.naver.calendarIds.length>0}};
    if(save(next)) state=next;else event.target.checked=!event.target.checked;
  }
  else if (event.target.matches('[data-category]')) {
    const category=event.target.dataset.category;
    const next={...state,categories:event.target.checked ? [...new Set([...state.categories,category])] : state.categories.filter(key=>key!==category)};
    if(save(next)) { state=next; render(); } else event.target.checked=!event.target.checked;
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'record-search') { recordQuery = event.target.value; renderRecordResults(); const stage=document.querySelector('#recollection');if(stage)stage.hidden=Boolean(recordQuery.trim()); }
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
  let next;
  if (event.target.id === 'task-form') {
    const task = state.tasks.find(t => t.id === id);
    if (id && !task) return;
    if(task) next={...state,tasks:state.tasks.map(item=>item.id===id ? {...item,date,title:value.slice(0,100)} : item)};
    else {
      try {
        const repeat=data.get('repeat') || 'none';const dates=scheduleDates(date,repeat,data.get('until') || date);const seriesId=crypto.randomUUID();
        next={...state,tasks:[...state.tasks,...dates.map(date=>({id:crypto.randomUUID(),date,title:value.slice(0,100),done:false,...(repeat!=='none' ? {seriesId,repeat} : {})}))]};
      } catch(problem){document.querySelector('#task-error').textContent=problem.message;return;}
    }
  } else {
    const entry = state.entries.find(e => e.id === id);
    if (id && !entry) return;
    next={...state,entries:entry ? state.entries.map(item=>item.id===id ? {...item,date,text:value.slice(0,1000)} : item) : [...state.entries,{id:crypto.randomUUID(),date,text:value.slice(0,1000)}]};
    recordQuery = '';
  }
  if(!save(next)) {const hint=event.target.querySelector('.field-hint');if(hint)hint.textContent='저장하지 못했어요. 기존 기록은 유지했어요. 저장 공간을 확인해 주세요.';return;}
  state=next;modal.close();render();toast('나의 이맘때에 담았어요.');
});
readPage();
maybeAutoNaver();
if (loadError) toast('저장된 데이터를 읽지 못했어요. 저장 공간 설정을 확인해 주세요.');
