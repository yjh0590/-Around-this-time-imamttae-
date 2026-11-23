import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDates,expenseSummary} from '../planning.js';
import {parseDiary} from '../imports.js';
import {sanitizeState,parseBackup,mergeBackup} from '../data.js';
import {createWeatherClient} from '../weather.mjs';
import {createServer} from '../server.mjs';

test('반복 일정은 월말·윤년·종료일을 반영하고 과도한 생성을 거부한다',()=>{
  assert.deepEqual(scheduleDates('2025-01-31','monthly','2025-04-30'),['2025-01-31','2025-02-28','2025-03-31','2025-04-30']);
  assert.deepEqual(scheduleDates('2024-02-29','yearly','2028-02-29'),['2024-02-29','2025-02-28','2026-02-28','2027-02-28','2028-02-29']);
  assert.deepEqual(scheduleDates('2026-11-23','weekly','2026-12-07'),['2026-11-23','2026-11-30','2026-12-07']);
  assert.deepEqual(scheduleDates('9999-12-31','daily','9999-12-31'),['9999-12-31']);
  assert.throws(()=>scheduleDates('2025-01-01','daily','2026-12-31'));
  assert.throws(()=>scheduleDates('2025-01-31','weekly','2025-01-01'));
});
test('버전 3 백업은 반복 묶음과 완료 상태를 보존한다',()=>{
  const state=sanitizeState({tasks:[{id:'t',date:'2025-11-23',title:'환기',done:true,seriesId:'group',repeat:'weekly'}]});
  const restored=parseBackup(JSON.stringify({version:3,...state}));
  assert.equal(restored.tasks[0].repeat,'weekly');
  assert.equal(restored.tasks[0].seriesId,'group');
  assert.equal(restored.tasks[0].done,true);
  assert.throws(()=>parseBackup(JSON.stringify({version:3,...state,tasks:[{...state.tasks[0],repeat:'unknown'}]})));
});
test('월별 지출 요약은 저장된 지출만 정확한 정수로 합산한다',()=>{
  const items=[{type:'expenses',date:'2026-01-01',title:'커피',amount:4500},{type:'expenses',date:'2026-01-02',title:'식사',amount:12000},{type:'expenses',date:'2025-12-01',amount:3000},{type:'expenses',date:'2025-01-01',amount:8000},{type:'photos',date:'2026-01-01',amount:99999}];
  const result=expenseSummary(items,'2026-01');
  assert.deepEqual([result.total,result.previous,result.lastYear,result.count],[16500n,3000n,8000n,2]);
  assert.equal(result.largest.title,'식사');
  assert.equal(expenseSummary([],'2026-01').total,0n);
});
test('일기 CSV는 여러 줄과 출처를 보존하고 재가져오기를 중복 제거한다',async()=>{
  const text='date,text\n2025-11-23,"가을 바람\n두 번째 줄"';
  const entries=await parseDiary(text,'일기 CSV · test.csv');
  assert.equal(entries[0].text,'가을 바람\n두 번째 줄');
  assert.equal(entries[0].source,'일기 CSV · test.csv');
  const state=sanitizeState({entries});
  assert.equal(mergeBackup(state,{tasks:[],entries:await parseDiary(text),memories:[]}).addedEntries,0);
  await assert.rejects(()=>parseDiary('date,text\n2025-02-30,잘못된 날짜'));
});
const units={temperature_2m_min:'°C',temperature_2m_max:'°C',precipitation_sum:'mm'};
test('날씨는 고정 API·지역·과거 날짜를 검증하고 자료와 단위를 확인한다',async()=>{
  let calls=0;
  const client=createWeatherClient({now:()=>new Date('2026-11-23T12:00:00'),fetcher:async url=>{
    calls++;const parsed=new URL(url);assert.equal(parsed.origin,'https://archive-api.open-meteo.com');assert.equal(parsed.searchParams.get('models'),'era5');assert.equal(parsed.searchParams.get('timezone'),'Asia/Seoul');
    return Response.json({daily:{time:['2025-11-23'],temperature_2m_min:[1.5],temperature_2m_max:[10.8],precipitation_sum:[0]},daily_units:units});
  }});
  const weather=await client.history('2025-11-23','seoul');
  assert.equal(weather.minimum,1.5);assert.equal(weather.regionLabel,'서울');
  await client.history('2025-11-23','seoul');assert.equal(calls,1,'cached date/region');
  await assert.rejects(()=>client.history('2026-11-23','seoul'),error=>error.status===400);
  await assert.rejects(()=>client.history('2025-11-23','https://evil.example'),error=>error.status===400);
  const missing=createWeatherClient({now:()=>new Date('2026-11-23T12:00:00'),fetcher:async()=>Response.json({daily:{time:['2025-11-23'],temperature_2m_min:[null],temperature_2m_max:[10],precipitation_sum:[0]},daily_units:units})});
  await assert.rejects(()=>missing.history('2025-11-23','seoul'),/자료가 없거나/);
});
test('날씨 API는 동일 출처 요청만 받고 외부 URL 입력을 전달하지 않는다',async()=>{
  const server=createServer({weatherClient:{history:async(date,region)=>({date,region})}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(`${base}/api/weather/history`)).status,403);
    const headers={'X-Imamttae-Request':'1','Content-Type':'application/json'};
    assert.equal((await fetch(`${base}/api/weather/history`,{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
    const response=await fetch(`${base}/api/weather/history`,{method:'POST',headers,body:JSON.stringify({date:'2025-11-23',region:'seoul',url:'https://evil.example'})});
    assert.deepEqual(await response.json(),{date:'2025-11-23',region:'seoul'});
    assert.equal((await fetch(`${base}/weather.mjs`)).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
