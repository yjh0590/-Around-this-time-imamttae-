import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeState,localDate,parseBackup} from '../data.js';
import {memoryDays,suggestedMemory,memoryDistance,memoryStage,worldContext} from '../recollection.js';

const now=localDate(2026,10,24);
test('회상에는 선택한 종류의 과거 기록만 포함한다',()=>{
  const state=sanitizeState({entries:[{id:'old',date:'2025-11-24',text:'그날의 일기'},{id:'now',date:'2026-11-24',text:'오늘'},{id:'future',date:'2026-11-25',text:'미래'}],tasks:[{id:'plan',date:'2025-11-24',title:'약속'}]});
  const days=memoryDays(state,now);
  assert.equal(days.length,1);assert.equal(days[0].items.length,2);
  assert.equal(memoryDays(state,now,'diary')[0].items.length,1);
  assert.deepEqual(memoryDays({...state,categories:[]},now),[]);
});

test('그날의 바깥은 당일 자료와 7일 안의 분류된 소식을 구분한다',()=>{
  const date='2025-11-24';
  const record={type:'world',source:'검증용',title:'소식',url:'https://example.com/news'};
  const memories=[
    {...record,id:'exact',date},
    {...record,id:'local',date:'2025-11-26',worldKind:'local',area:'<동네>',url:'',currentUrl:'https://example.com/current'},
    {...record,id:'boundary',date:'2025-11-17',worldKind:'event'},
    {...record,id:'outside',date:'2025-11-16',worldKind:'event'},
    {...record,id:'legacy-nearby',date:'2025-11-25'},
    {...record,id:'today',date:'2025-11-27',worldKind:'event'},
  ];
  const context=worldContext(memories,date,'2025-11-27');
  assert.deepEqual(context.exact.map(item=>item.id),['exact']);
  assert.deepEqual(context.nearby.map(item=>item.id),['local','boundary']);
  const html=memoryStage([{date,items:[memories[0]]}],date,{now,context});
  assert.match(html,/&lt;동네&gt;/);
  assert.match(html,/현재 정보 확인/);
  const backup={version:3,tasks:[],entries:[],memories,categories:['world']};
  assert.equal(parseBackup(JSON.stringify(backup)).memories[1].area,'<동네>');
  memories[1].currentUrl='javascript:alert(1)';
  assert.throws(()=>parseBackup(JSON.stringify(backup)),/잘못된 통합 기록/);
});
test('작년 같은 시기를 우선 제안하고 없으면 최근 과거를 보여준다',()=>{
  const days=[{date:'2026-10-01',items:[]},{date:'2025-11-25',items:[]},{date:'2025-11-24',items:[]}];
  const before=JSON.stringify(days);
  assert.equal(suggestedMemory(days,now),'2025-11-24');
  assert.equal(JSON.stringify(days),before);
  assert.equal(suggestedMemory([days[0]],now),'2026-10-01');
  assert.equal(suggestedMemory([],now),null);
  assert.equal(memoryDistance('2025-11-24',now),'작년 이맘때');
  assert.equal(memoryDistance('2025-11-25',now),'작년 이 무렵');
  assert.equal(memoryDistance('2026-11-23',now),'어제');
  assert.equal(suggestedMemory([{date:'2023-02-28',items:[]}],localDate(2024,1,29)),'2023-02-28');
});
test('회상 문구는 실제 글을 그대로 이스케이프하고 빈 기억을 만들지 않는다',()=>{
  const date='2025-11-24';
  const days=[{date,items:[{type:'diary',title:'<img src=x onerror=alert(1)> 내가 쓴 글',date}]}];
  const html=memoryStage(days,date,{now});
  assert.ok(html.includes('&lt;img'));
  assert.equal(html.includes('<img src=x'),false);
  assert.ok(html.includes('내가 쓴 글'));
  assert.ok(html.includes('data-memory-open="2025-11-24"'));
  assert.equal(memoryStage([],null,{now}).includes('<blockquote>'),false);
  assert.ok(memoryStage([],null,{now,rangeActive:true}).includes('이 무렵의 기록은 아직 없어요'));
  const photoHTML=memoryStage([{date,items:[{type:'photos',title:'가족 & 산책',imageData:'data:image/jpeg;base64,AA==',date}]}],date,{now});
  assert.ok(photoHTML.includes('class="recollection-photo"'));
  assert.ok(photoHTML.includes('alt="가족 &amp; 산책"'));
  assert.equal(photoHTML.includes('<blockquote>'),false,'a photo alone does not invent diary text');
});
