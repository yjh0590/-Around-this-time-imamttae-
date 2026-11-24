import {timelineItems,dateKey,lastYearRange,safeLink,WORLD_KINDS} from './data.js';
import {escapeHTML as e} from './journal.js';

export function memoryDays(state,now=new Date(),filter='all') {
  const today=dateKey(now),days=new Map();
  for(const item of timelineItems(state)) {
    if(item.date>=today || filter!=='all' && item.type!==filter)continue;
    if(!days.has(item.date))days.set(item.date,[]);
    days.get(item.date).push(item);
  }
  return [...days].map(([date,items])=>({date,items})).sort((a,b)=>b.date.localeCompare(a.date));
}
export function suggestedMemory(days,now=new Date()) {
  if(!days.length)return null;
  const range=lastYearRange(now);
  const nearby=days.filter(day=>day.date>=range.start && day.date<=range.end);
  return nearby.sort((a,b)=>Math.abs(Date.parse(a.date)-Date.parse(range.anchor))-Math.abs(Date.parse(b.date)-Date.parse(range.anchor)))[0]?.date || days[0].date;
}
export function memoryDistance(date,now=new Date()) {
  const today=dateKey(now),range=lastYearRange(now);
  if(date===range.anchor)return '작년 이맘때';
  if(date>=range.start && date<=range.end)return '작년 이 무렵';
  const difference=Math.round((Date.parse(today)-Date.parse(date))/86400000);
  if(difference===1)return '어제';
  return difference>0 ? `${difference.toLocaleString('ko-KR')}일 전` : '기록';
}
export function worldContext(memories,date,today) {
  const anchor=Date.parse(date);
  const exact=[];
  const nearby=[];
  for (const item of memories) {
    if (item.type!=='world' || item.date>=today) continue;
    const gap=Math.abs(Date.parse(item.date)-anchor)/86400000;
    if (gap===0) exact.push(item);
    else if (gap<=7 && ['event','local'].includes(item.worldKind)) nearby.push({item,gap});
  }
  nearby.sort((a,b)=>a.gap-b.gap || b.item.date.localeCompare(a.item.date));
  return {exact,nearby:nearby.map(({item})=>item)};
}

function worldPanel(date,{exact,nearby}) {
  const groups=[['그날',exact],['그 무렵',nearby]];
  return `<details class="memory-world-context" data-world-context="${date}">
    <summary>그날의 바깥</summary>
    ${groups.filter(([,items])=>items.length).map(([label,items])=>`<section class="memory-world-group">
      <h3>${label}</h3>
      <ul>${items.map(item=>{
        const sourceUrl=safeLink(item.url);
        const currentUrl=safeLink(item.currentUrl);
        const kind=WORLD_KINDS[item.worldKind] || (item.id.startsWith('weather:') ? '날씨' : '자료');
        return `<li>
          <p class="context-title">${e(item.title)}</p>
          ${item.text ? `<p class="context-text">${e(item.text)}</p>` : ''}
          <p class="context-meta"><time datetime="${item.date}">${item.date}</time> · ${e(kind)}${item.area ? ` · ${e(item.area)}` : ''} · ${e(item.source)}</p>
          <div class="context-actions">
            ${sourceUrl ? `<a href="${e(sourceUrl)}" target="_blank" rel="noopener noreferrer">${item.worldKind==='local' || item.worldKind==='event' ? '당시 소식' : '출처 보기'} ↗</a>` : ''}
            ${currentUrl ? `<a href="${e(currentUrl)}" target="_blank" rel="noopener noreferrer">현재 정보 확인 ↗</a>` : ''}
            ${item.worldKind==='local' ? `<button data-context-plan="${e(item.id)}">일정에 담기</button>` : ''}
          </div>
        </li>`;
      }).join('')}</ul>
    </section>`).join('')}
    ${exact.length || nearby.length ? '' : '<p class="context-meta">이 날짜 근처에 저장한 소식이 없어요.</p>'}
    <button class="context-add" data-add-world="${date}">소식 남기기</button>
  </details>`;
}

export function memoryStage(days,date,{now=new Date(),direction=0,rangeActive=false,context=null}={}) {
  const index=days.findIndex(day=>day.date===date);
  const day=days[index];
  const lastYearButton='<button class="memory-year" data-show-lastyear>작년 이맘때</button>';
  if(!day)return `
    <section class="recollection" aria-label="지난 기록">
      <div class="memory-toolbar">${lastYearButton}</div>
      <div class="recollection-empty">
        <div class="recollection-friend" aria-hidden="true"></div>
        <div>
          <h2>${rangeActive ? '이 무렵의 기록은 아직 없어요' : '지난 기록이 아직 없어요'}</h2>
          <button class="small-button" data-connections>사진이나 일기 가져오기</button>
        </div>
      </div>
    </section>`;
  const photo=day.items.find(item=>item.type==='photos');
  const diary=day.items.find(item=>item.type==='diary');
  const other=day.items.find(item=>!['photos','diary'].includes(item.type));
  const written=diary?.title || other?.title || photo?.text || '';
  const fullDate=new Date(`${day.date}T12:00:00`).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
  const motionClass=direction>0 ? 'turn-older' : direction<0 ? 'turn-newer' : '';
  return `
    <section class="recollection" aria-label="지난 기록">
      <div class="memory-toolbar">
        ${lastYearButton}
        <div class="memory-controls" ${days.length===1?'hidden':''}>
          <button data-memory-step="-1" aria-label="더 최근 기억" aria-controls="memory-stage" ${index<=0?'disabled':''}>←</button>
          <button data-memory-step="1" aria-label="더 오래된 기억" aria-controls="memory-stage" ${index>=days.length-1?'disabled':''}>→</button>
        </div>
      </div>
      <div id="memory-stage" class="memory-stage ${motionClass}" data-memory-stage ${days.length>1?'data-swipeable':''} tabindex="0" role="group" aria-label="${e(fullDate)}. ${memoryDistance(day.date,now)}.${days.length>1?' 좌우 방향키나 스와이프로 넘기기':''}">
        <div class="memory-paper">
          <time datetime="${day.date}">${e(fullDate)}</time>
          ${photo?`<figure class="recollection-figure"><img class="recollection-photo" src="${e(photo.imageData)}" alt="${e(photo.title)}" draggable="false"></figure>`:''}
          ${written ? `<blockquote>${e(written)}</blockquote>` : ''}
        </div>
      </div>
      <div class="recollection-bottom">
        <button data-memory-open="${day.date}">그날의 기록 보기 <span aria-hidden="true">→</span></button>
      </div>
      ${context ? worldPanel(day.date,context) : ''}
    </section>`;
}
