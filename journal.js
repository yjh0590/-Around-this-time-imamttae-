import { CATEGORIES, timelineItems, dateKey, safeLink } from './data.js';
import {expenseSummary} from './planning.js';

export const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const e = escapeHTML;
const sectionNames={calendar:'일정',photos:'사진',expenses:'가계부',diary:'일기',world:'세상'};
const sectionPaths={calendar:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-11 4h2m3 0h1"/>',photos:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 5-5 4 3 3-5 4 7"/>',expenses:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8m-8 4h5"/>',diary:'<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2zm0 14h14M9 7h6m-6 4h4"/>',world:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18z"/>'};
const sectionIcon=key=>`<svg viewBox="0 0 24 24" aria-hidden="true">${sectionPaths[key]}</svg>`;
export function entryActions(kind,id,label) {
  return `<details class="entry-options"><summary aria-label="${e(label)} 메뉴">···</summary><div class="entry-menu"><button data-edit-${kind}="${e(id)}">수정</button><button data-delete-${kind}="${e(id)}">삭제</button></div></details>`;
}
export function memoryCard(item) {
  return `<article class="card memory-card memory-${item.type}"><div class="record-head"><span class="source-badge">${CATEGORIES[item.type]}</span>${entryActions('memory',item.id,item.title)}</div>${item.type === 'photos' ? `<button class="photo-button" data-open-photo="${e(item.id)}" aria-label="${e(item.title)} 크게 보기"><img class="memory-photo" loading="lazy" src="${e(item.imageData)}" alt="${e(item.title)}"></button>` : ''}<h3 class="${item.type==='photos' && /\.(jpe?g|png|webp)$/i.test(item.title) ? 'photo-filename' : ''}">${e(item.title)}</h3>${item.type === 'expenses' ? `<p class="expense-amount">${item.amount.toLocaleString('ko-KR')}원</p>` : ''}${item.text ? `<p class="memory-text">${e(item.text)}</p>` : ''}${item.type === 'world' && safeLink(item.url) ? `<a class="source-link" href="${e(safeLink(item.url))}" target="_blank" rel="noopener noreferrer">원문 ↗</a>` : ''}<p class="source-caption">${e(item.source)}${item.dateBasis ? ` · ${e(item.dateBasis)}` : ''}</p></article>`;
}

export function journalShell(state, query, filter) {
  const items=timelineItems(state);
  const keys=Object.keys(CATEGORIES).filter(key=>state.categories.includes(key));
  return `<div class="archive-page"><header class="archive-heading"><div><p class="archive-edition">${new Date().getFullYear()} <span>이맘때</span></p><h1>이맘때의 나<span class="archive-mark" aria-hidden="true"></span></h1></div><button class="archive-write" data-add-record="${dateKey(new Date())}" aria-label="기록 남기기">${sectionIcon('diary')}<span>일기 쓰기</span></button></header><nav class="archive-sections" aria-label="기록 종류" style="--section-count:${Math.max(1,keys.length)}">${keys.map(key=>`<button data-journal-filter="${key}" aria-pressed="${key===filter}" aria-label="${sectionNames[key]} ${items.filter(item=>item.type===key).length}개">${sectionIcon(key)}<span>${sectionNames[key]}</span><small>${items.filter(item=>item.type===key).length}</small></button>`).join('')}</nav><div class="memory-intro"><span>지난날 다시 보기</span><button data-show-lastyear>작년 이맘때 ↗</button></div><div id="recollection"></div><div class="archive-tools"><button class="archive-all" data-journal-filter="all" aria-pressed="${filter==='all'}">남겨둔 기록 <span>${items.length}</span></button><button class="archive-import" data-connections>가져오기 ↗</button></div><label class="sr-only" for="record-search">기록 내용이나 날짜 검색</label><input type="search" id="record-search" maxlength="1000" placeholder="날짜나 내용 찾기" value="${e(query)}" aria-controls="record-results"><p class="search-count" id="search-count" role="status"></p><div id="record-results"></div>${state.categories.includes('world') ? `<aside class="world-note"><strong>그날의 바깥</strong><button class="small-button" data-add-world>링크 남기기 ↗</button></aside>` : ''}<details class="archive-storage"><summary>저장 위치 · 백업</summary><p>이 브라우저에 저장돼요. 상단 설정에서 백업을 내려받을 수 있어요.</p></details></div>`;
}

export function journalResults(state, query, filter, recordCard, taskRows) {
  const items = timelineItems(state,query).filter(item=>filter === 'all' || item.type === filter);
  const grouped = new Map();
  for (const item of items) { if (!grouped.has(item.date)) grouped.set(item.date,[]); grouped.get(item.date).push(item); }
  const html = [...grouped].map(([date,records])=>{
    const [year,month,day]=date.split('-');
    const weekday=new Date(`${date}T12:00:00`).toLocaleDateString('ko-KR',{weekday:'short'});
    const photos=records.filter(item=>item.type==='photos');
    let photosRendered=false;
    const content=records.map(item=>{
      if(item.type==='photos') {if(photosRendered)return '';photosRendered=true;return `<div class="archive-photos ${photos.length>1 ? 'multiple' : ''}">${photos.map(memoryCard).join('')}</div>`;}
      if(item.type==='diary')return recordCard(state.entries.find(entry=>entry.id===item.id));
      if(item.type==='calendar' && !state.memories.some(memory=>memory.id===item.id))return `<div class="archive-plan"><span class="archive-kind">일정</span>${taskRows(date,item.id)}</div>`;
      return memoryCard(item);
    }).join('');
    return `<section class="archive-day"><h2 class="archive-date"><time datetime="${date}"><span class="archive-year">${year}</span><span class="archive-day-number">${day}</span><span class="archive-month">${Number(month)}월 · ${weekday}</span></time></h2><div class="archive-content">${content}</div></section>`;
  }).join('');
  return { count:items.length, html: html || `<div class="archive-empty"><div class="empty-page" aria-hidden="true"><i></i><i></i><i></i></div><p>${query.trim() ? '일치하는 기록이 없어요.' : state.categories.length ? '아직 비어 있는 페이지.' : '표시할 기록 종류를 골라주세요.'}</p>${query.trim() ? '<button class="small-button" data-clear-search>검색 지우기</button>' : `<div class="empty-actions"><button class="small-button" data-add-record="${dateKey(new Date())}">일기 쓰기</button><button class="small-button" data-connections>기록 가져오기 ↗</button></div>`}</div>` };
}
export function expensePanel(state,month) {
  const summary=expenseSummary(state.memories,month);
  return `<section class="card expense-summary"><div class="card-head"><h2>월별 지출</h2><label class="sr-only" for="expense-month">요약할 월</label><input id="expense-month" type="month" min="0001-01" max="9999-12" value="${month}"></div><p class="expense-total">${summary.total.toLocaleString('ko-KR')}<span>원</span></p><p class="source-caption">저장된 지출 ${summary.count}건 · 전체 금융 거래 내역이 아니에요.</p><div class="expense-comparison"><span>지난달<strong>${summary.previous.toLocaleString('ko-KR')}원</strong></span><span>작년 같은 달<strong>${summary.lastYear.toLocaleString('ko-KR')}원</strong></span></div>${summary.largest ? `<p class="source-caption">가장 큰 지출 · ${e(summary.largest.title)} ${summary.largest.amount.toLocaleString('ko-KR')}원</p>` : ''}</section>`;
}
export function diaryConnectionContent() {
  return '<section class="connection-section"><h3>일기 가져오기</h3><p class="field-hint">UTF-8 CSV 첫 줄은 date,text로 맞춰 주세요. 날짜와 1,000자 이하의 글을 가져와요. 다른 앱의 계정에 직접 접속하지 않아요.</p><label for="diary-file">일기 CSV 파일</label><input id="diary-file" type="file" accept=".csv,text/csv"></section>';
}
export function diaryPreview(entries,existing) {
  return `<form id="diary-import-form"><p class="modal-text">일기 ${entries.length-existing}개를 새로 추가하고, 이미 있는 ${existing}개는 유지해요.</p><div class="source-preview">${entries.map(entry=>`<div class="preview-item"><span>${e(entry.date)}</span><p class="memory-text">${e(entry.text)}</p></div>`).join('')}</div><p class="form-error" id="diary-error" role="alert"></p><button type="submit" class="primary-button full" ${entries.length===existing ? 'disabled' : ''}>확인한 일기 가져오기</button></form>`;
}

export function connectionsContent(state) {
  return `<p class="modal-text">다시 만나고 싶은 기록을 골라주세요.<br>선택을 해제해도 저장한 기록은 지워지지 않아요.</p><div class="category-settings">${Object.entries(CATEGORIES).map(([key,label])=>`<label><input type="checkbox" data-category="${key}" ${state.categories.includes(key) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div><section class="connection-section"><h3>캘린더 가져오기</h3><p class="field-hint">캘린더에서 내보낸 ICS 파일을 선택하세요. 일정에 적힌 시작일 기준으로 가져와요. 시간대는 변환하지 않아요. 반복·취소 일정은 제외하고 개수를 미리 알려드려요. 네이버 시험 연결은 아래에서 별도로 설정해요.</p><label for="calendar-file">ICS 파일</label><input id="calendar-file" type="file" accept=".ics,text/calendar"></section><section class="connection-section"><h3>사진 가져오기</h3><p class="field-hint">한 번에 10장, 장당 15MB 이하의 JPEG·PNG·WebP. 촬영일 또는 파일명 날짜를 찾아 제안하고, 저장 전에 날짜를 확인해요. 사진은 축소본으로 보관하며 원본은 변경하지 않아요.</p><label for="photo-files">사진 선택</label><input id="photo-files" type="file" accept="image/jpeg,image/png,image/webp" multiple></section><section class="connection-section"><h3>가계부 가져오기</h3><p class="field-hint">은행 계정과 연결하지 않아요. CSV 첫 줄을 date,title,amount로 맞춰 주세요. 예: 2025-11-23,커피,4500. 금액은 원 단위 지출이며, 같은 날짜·내용·금액은 같은 거래로 간주하며, 중복 건은 파일 안의 등장 횟수로 구분해요.</p><label for="expense-file">지출 CSV 파일</label><input id="expense-file" type="file" accept=".csv,text/csv"><button class="small-button" data-add-expense>지출 직접 남기기 ↗</button></section><p class="form-error" id="source-error" role="alert"></p><p class="field-hint">선택한 파일은 이 기기에서 읽어요. 전체 사진 보관함이나 다른 앱에 접근하지 않아요. 백업은 화면 설정의 내려받기·가져오기를 이용하세요.</p>`;
}

export function sourcePreview(items, skipped, existing = 0, duplicates = 0) {
  return `<form id="source-form"><p class="modal-text">${items.length-existing}개를 새로 추가해요. 이미 있는 ${existing}개는 현재 내용을 유지해요.${duplicates ? ` 같은 파일 ${duplicates}개는 하나로 모았어요.` : ''}</p>${skipped ? `<p class="import-notice">반복·취소 일정 ${skipped}개는 제외했어요.</p>` : ''}<div class="source-preview">${items.map((item,i)=>`<div class="preview-item">${item.imageData ? `<img src="${e(item.imageData)}" alt="${e(item.title)}">` : ''}<strong>${e(item.title)}</strong>${item.type === 'photos' ? `<label for="photo-date-${i}">기억할 날짜 · ${e(item.dateBasis)}</label><input id="photo-date-${i}" data-photo-date="${i}" type="date" min="0001-01-01" max="9999-12-31" value="${item.date}" required>` : `<span>${e(item.date)}${item.amount ? ` · ${item.amount.toLocaleString('ko-KR')}원` : ''}</span>`}</div>`).join('')}</div><p class="form-error" id="source-error" role="alert"></p><button class="primary-button full" type="submit" ${items.length===existing ? 'disabled' : ''}>확인한 기록 가져오기</button></form>`;
}
