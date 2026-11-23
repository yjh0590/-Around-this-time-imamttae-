import {escapeHTML} from './journal.js';

async function api(path,body) {
  const response=await fetch(`/api/naver/${path}`,{method:body ? 'POST' : 'GET',headers:{'X-Imamttae-Request':'1',...(body ? {'Content-Type':'application/json'} : {})},...(body ? {body:JSON.stringify(body)} : {})});
  let value;try {value=await response.json();} catch {throw new Error('서버를 최신 버전으로 다시 실행해 주세요.');}
  if(!response.ok) throw new Error(value.error || '네이버 연결을 완료하지 못했어요.');
  return value;
}
export const naverStatus=()=>api('status');
export const naverCalendars=()=>api('calendars');
export const syncNaver=(date,calendarIds)=>api('sync',{date,calendarIds});
export function naverPanel(state) {
  return `<section class="connection-section naver-connection"><h3>네이버 캘린더 · 시험 연결</h3><p class="field-hint">선택한 캘린더에서 지난해 이맘때 전후 14일의 일정을 읽어와요. 일정 등록·수정·삭제는 하지 않아요. 반복·취소 일정은 제외될 수 있어요.</p><p id="naver-status" class="field-hint" role="status">서버 연결 상태를 확인하고 있어요…</p><div id="naver-calendars"></div><div class="naver-buttons"><button class="connection-button" data-naver-list disabled>캘린더 목록 확인</button><button class="connection-button" data-naver-sync disabled>지금 가져오기</button></div><label class="auto-sync-label"><input type="checkbox" id="naver-auto" ${state.naver.automatic ? 'checked' : ''} ${state.naver.calendarIds.length ? '' : 'disabled'}><span>앱을 열 때 하루 한 번 자동으로 가져오기</span></label><p class="field-hint"><span id="naver-last-check">${state.naver.lastSyncDate ? `마지막 확인: ${state.naver.lastSyncDate}` : '아직 확인한 일정이 없어요.'}</span> · 원본의 변경·삭제를 양방향 동기화하지 않아요.</p><p id="naver-error" class="form-error" role="alert"></p><a class="source-link" target="_blank" rel="noopener noreferrer" href="https://help.naver.com/service/5620/contents/2426">네이버 공식 연결 안내 ↗</a></section>`;
}
export function calendarChoices(calendars,selected) {
  if(!calendars.length) return '<p class="field-hint">조회 가능한 캘린더가 없어요. ICS 파일로 가져올 수도 있어요.</p>';
  return `<p class="field-hint">가져올 캘린더를 선택해 주세요. 최대 10개까지 선택할 수 있어요.</p>${calendars.map(calendar=>`<label class="naver-calendar-option"><input type="checkbox" data-naver-calendar="${calendar.id}" ${selected.includes(calendar.id) ? 'checked' : ''}><span>${escapeHTML(calendar.name)}</span></label>`).join('')}`;
}
