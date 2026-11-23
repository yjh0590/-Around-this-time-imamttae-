import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNaverClient,naverURL,parseMultistatus} from '../naver-caldav.mjs';
import {createServer} from '../server.mjs';
import {sanitizeState,mergeBackup} from '../data.js';

const multistatus=body=>`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${body}</d:multistatus>`;
const row=(href,props,status='200 OK')=>`<d:response><d:href>${href}</d:href><d:propstat><d:prop>${props}</d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response>`;
const xmlResponse=value=>new Response(value,{status:207,headers:{'content-type':'application/xml'}});
const calendar=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-event\r\nDTSTART;VALUE=DATE:20251123\r\nSUMMARY:네이버에서 가져온 약속\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:recurring\r\nDTSTART;VALUE=DATE:20251123\r\nSUMMARY:반복 일정\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT\r\nEND:VCALENDAR`;
function fakeNaver(log) {
  return async(url,options)=>{
    log.push({url,options});
    assert.equal(new URL(url).origin,'https://caldav.calendar.naver.com');
    assert.ok(['PROPFIND','REPORT'].includes(options.method));
    assert.equal(options.redirect,'manual');
    if(url.endsWith('/principal/')) return xmlResponse(multistatus(row('/principal/','<c:calendar-home-set><d:href>/home/</d:href></c:calendar-home-set>')));
    if(url.endsWith('/home/')) return xmlResponse(multistatus(row('/home/','<d:resourcetype><d:collection/></d:resourcetype>')+row('/home/default/','<d:displayname>나의 캘린더 &amp; 일상</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype>')));
    if(url.endsWith('/home/default/')) return xmlResponse(multistatus(row('/home/default/event.ics',`<c:calendar-data><![CDATA[${calendar}]]></c:calendar-data>`)));
    return xmlResponse(multistatus(row('/','<d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal>')));
  };
}
test('네이버 CalDAV 발견·선택 조회는 읽기 메서드만 사용한다',async()=>{
  const log=[];const client=createNaverClient({username:'test-user',password:'test-secret',fetcher:fakeNaver(log)});
  const calendars=await client.list();
  assert.equal(calendars.length,1);
  assert.equal(calendars[0].name,'나의 캘린더 & 일상');
  assert.match(calendars[0].id,/^[a-f0-9]{24}$/);
  assert.equal(JSON.stringify(calendars).includes('test-user'),false);
  await client.list();assert.equal(log.length,3,'calendar discovery is cached');
  const result=await client.sync('2026-11-23',[calendars[0].id]);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].title,'네이버에서 가져온 약속');
  assert.equal(result.items[0].source,'네이버 캘린더 · 나의 캘린더 & 일상');
  assert.equal(result.skipped,1);
  assert.deepEqual(result.range,{start:'2025-11-09',end:'2025-12-07'});
  assert.ok(log.at(-1).options.body.includes('time-range'));
  assert.equal(log[0].options.headers.Authorization,`Basic ${Buffer.from('test-user:test-secret').toString('base64')}`);
  await assert.rejects(()=>client.sync('2026-11-23',['unknown']),error=>error.status===400);
});
test('네이버 연결은 외부 주소·리다이렉트·DTD와 실패한 속성을 거부한다',async()=>{
  for(const url of ['http://caldav.calendar.naver.com/','https://evil.example/','https://user:pass@caldav.calendar.naver.com/','//evil.example/']) assert.throws(()=>naverURL(url));
  assert.equal(naverURL('/calendar/'),'https://caldav.calendar.naver.com/calendar/');
  assert.throws(()=>parseMultistatus('<!DOCTYPE foo [<!ENTITY test SYSTEM "file:///etc/passwd">]><foo/>'));
  assert.deepEqual(parseMultistatus(multistatus(row('/','<d:displayname>권한 없음</d:displayname>','403 Forbidden')))[0].props,{});
  const redirect=createNaverClient({username:'u',password:'secret',fetcher:async()=>new Response('',{status:302,headers:{location:'https://evil.example/'}})});
  await assert.rejects(()=>redirect.list(),/다른 주소/);
  const auth=createNaverClient({username:'u',password:'secret',fetcher:async()=>new Response('secret',{status:401})});
  await assert.rejects(()=>auth.list(),error=>error.status===401 && !error.message.includes('secret'));
});
test('설정이 없으면 네트워크를 호출하지 않고 응답 크기를 제한한다',async()=>{
  let called=false;
  const missing=createNaverClient({fetcher:async()=>{called=true;}});
  assert.equal(missing.configured,false);
  await assert.rejects(()=>missing.list(),error=>error.status===503);
  assert.equal(called,false);
  const large=createNaverClient({username:'u',password:'secret',fetcher:async()=>new Response('data',{status:207,headers:{'content-length':String(10*1024*1024)}})});
  await assert.rejects(()=>large.list(),/너무 커요/);
});
test('연결 API는 동일 출처와 전용 헤더를 요구하고 비밀 정보를 반환하지 않는다',async()=>{
  const calls=[];
  const server=createServer({naverClient:{configured:true,list:async()=>{calls.push('list');return [{id:'a'.repeat(24),name:'일상'}];},sync:async(date,ids)=>{calls.push('sync');return {items:[],skipped:0,range:{start:date,end:date}};}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={'X-Imamttae-Request':'1'};
  try {
    assert.equal((await fetch(`${base}/api/naver/status`)).status,403);
    assert.equal((await fetch(`${base}/api/naver/status`,{headers:{...headers,Origin:'https://evil.example'}})).status,403);
    const status=await fetch(`${base}/api/naver/status`,{headers});
    assert.equal(status.headers.get('cache-control'),'no-store');
    assert.deepEqual(await status.json(),{configured:true});
    assert.equal((await fetch(`${base}/api/naver/calendars`,{headers})).status,200);
    assert.equal((await fetch(`${base}/api/naver/sync`,{headers})).status,405);
    assert.equal((await fetch(`${base}/api/naver/sync`,{method:'POST',headers,body:'{}'})).status,415);
    assert.equal((await fetch(`${base}/api/naver/sync`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'invalid'})).status,400);
    assert.equal((await fetch(`${base}/api/naver/sync`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({date:'2026-11-23',calendarIds:['a'.repeat(24)]})})).status,200);
    for(const name of ['.env','.env.example','naver-caldav.mjs','node_modules/fast-xml-parser/package.json']) assert.equal((await fetch(`${base}/${name}`)).status,404);
    assert.deepEqual(calls,['list','sync']);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('네이버 선택은 검증하고 가져온 백업으로 자동 수집을 켜지 않는다',()=>{
  const current=sanitizeState(null);
  const incoming=sanitizeState({naver:{calendarIds:['a'.repeat(24)],automatic:true,lastSyncDate:'2026-11-23'}});
  assert.equal(incoming.naver.automatic,true);
  assert.deepEqual(mergeBackup(current,incoming).state.naver,current.naver);
  assert.equal(sanitizeState({naver:{calendarIds:['bad'],automatic:true}}).naver.automatic,false);
});
