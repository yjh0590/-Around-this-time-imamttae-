import {timelineItems,dateKey,lastYearRange} from './data.js';
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
export function memoryStage(days,date,{now=new Date(),direction=0,rangeActive=false}={}) {
  const index=days.findIndex(day=>day.date===date),day=days[index];
  if(!day)return `<section class="recollection-empty"><div class="recollection-friend" role="img" aria-label="계절 옷을 입은 이맘때 캐릭터"></div><div><p class="recollection-overline">다시 만나는 이맘때</p><h2>${rangeActive ? '이 무렵의 기록은 아직 없어요.' : '처음 만나는 이맘때'}</h2><p>예전 사진이나 일기를 가져오면<br>이 자리에서 다시 볼 수 있어요.</p><button class="small-button" data-connections>지난 기록 가져오기 ↗</button></div></section>`;
  const photo=day.items.find(item=>item.type==='photos');
  const diary=day.items.find(item=>item.type==='diary');
  const counts=[['photos','사진'],['diary','일기'],['calendar','일정'],['expenses','지출'],['world','소식']].map(([type,label])=>{const count=day.items.filter(item=>item.type===type).length;return count?`${label} ${count}`:'';}).filter(Boolean).join(' · ');
  const other=day.items.find(item=>!['photos','diary'].includes(item.type));
  const written=diary?.title || other?.title || photo?.text || '';
  const fullDate=new Date(`${day.date}T12:00:00`).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
  return `<section class="recollection" aria-label="지난 순간 돌아보기"><div class="recollection-top"><span>${memoryDistance(day.date,now)}</span><div class="memory-controls"><button data-memory-step="-1" aria-label="더 최근 기억" aria-controls="memory-stage" ${index<=0?'disabled':''}>←</button><button data-memory-step="1" aria-label="더 오래된 기억" aria-controls="memory-stage" ${index>=days.length-1?'disabled':''}>→</button></div></div><div id="memory-stage" class="memory-stage ${direction ? direction>0?'turn-older':'turn-newer' : ''}" data-memory-stage tabindex="0" role="group" aria-label="${e(fullDate)} 기억. 좌우 방향키나 스와이프로 넘기기"><div class="memory-paper">${photo?`<figure class="recollection-figure"><img class="recollection-photo" src="${e(photo.imageData)}" alt="${e(photo.title)}"></figure>`:''}<div class="recollection-writing"><time datetime="${day.date}">${e(fullDate)}</time>${written ? `<blockquote>${e(written)}</blockquote>` : '<p class="memory-photo-caption">그날 남긴 사진</p>'}<p class="memory-origin">${diary?'그날 쓴 일기':other?'그날 남긴 기록':'내가 선택한 사진'}</p></div></div></div><div class="recollection-bottom"><span>${counts}</span><button data-memory-open="${day.date}">그날로 돌아가기 ↗</button></div><p class="memory-position" aria-live="polite">${index+1} / ${days.length}<span>옆으로 넘겨보세요</span></p></section>`;
}
