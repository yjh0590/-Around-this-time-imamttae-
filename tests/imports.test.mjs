import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCalendar,parseCSV,parseExpenses,photoDate} from '../imports.js';
import {sanitizeState,parseBackup,mergeBackup,timelineItems,lastYearRange,localDate,safeLink} from '../data.js';

const ics = events => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR`;
const event = (uid,start,extra='') => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART${start}\r\nSUMMARY:여행\\, 강릉\r\n${extra}\r\nEND:VEVENT`;
test('ICS 종일·시간 지정·접힌 행과 텍스트 이스케이프를 읽는다',()=>{
  const result=parseCalendar(ics(event('one',';VALUE=DATE:20251123','DESCRIPTION:긴 설명\r\n 을 이어요\\n두 번째 줄')+'\r\n'+event('two',';TZID=Asia/Seoul:20251124T090000')));
  assert.equal(result.items.length,2);
  assert.equal(result.items[0].date,'2025-11-23');
  assert.equal(result.items[0].title,'여행, 강릉');
  assert.equal(result.items[0].text,'긴 설명을 이어요\n두 번째 줄');
  assert.equal(result.items[1].date,'2025-11-24');
  assert.equal(result.items[1].id,'ics:two');
});
test('ICS 반복·취소는 개수를 알리고 잘못된 날짜·중복 UID는 거부한다',()=>{
  const result=parseCalendar(ics(event('repeat',':20251123T090000','RRULE:FREQ=WEEKLY')+'\r\n'+event('cancel',':20251123T090000','STATUS:CANCELLED')));
  assert.deepEqual(result,{items:[],skipped:2});
  assert.throws(()=>parseCalendar(ics(event('bad',':20250230T090000'))));
  assert.throws(()=>parseCalendar(ics(event('dup',':20251123T090000')+'\r\n'+event('dup',':20251124T090000'))));
  assert.throws(()=>parseCalendar('not an ICS'));
});
test('CSV는 따옴표 안 쉼표·줄바꿈을 보존한다',()=>{
  assert.deepEqual(parseCSV('date,title,amount\r\n2025-11-23,"커피, 케이크",4500'),[['date','title','amount'],['2025-11-23','커피, 케이크','4500']]);
  assert.deepEqual(parseCSV('"두\n줄","따옴표 ""예시"""'),[['두\n줄','따옴표 "예시"']]);
  assert.throws(()=>parseCSV('"열린 문자열'));
});
test('가계부 CSV는 재가져오기 시 안정적인 ID로 중복을 막는다',async()=>{
  const csv='date,title,amount\n2025-11-23,커피,4500\n2025-11-23,커피,4500';
  const first=await parseExpenses(csv);
  const second=await parseExpenses(csv);
  assert.equal(first.items[0].id,second.items[0].id);
  assert.notEqual(first.items[0].id,first.items[1].id);
  const state=sanitizeState({memories:first.items});
  assert.equal(mergeBackup(state,{tasks:[],entries:[],memories:second.items}).addedMemories,0);
  await assert.rejects(()=>parseExpenses('date,title,amount\n2025-02-30,커피,4500'));
  await assert.rejects(()=>parseExpenses('date,title,amount\n2025-11-23,커피,-1'));
});
function exifJPEG(little) {
  const bytes=new Uint8Array(78);const view=new DataView(bytes.buffer);
  bytes.set([0xff,0xd8,0xff,0xe1,0,72,69,120,105,102,0,0]);
  const base=12;
  const u16=(offset,value)=>view.setUint16(base+offset,value,little);
  const u32=(offset,value)=>view.setUint32(base+offset,value,little);
  u16(0,little?0x4949:0x4d4d);u16(2,42);u32(4,8);
  u16(8,1);u16(10,0x8769);u16(12,4);u32(14,1);u32(18,26);
  u16(26,1);u16(28,0x9003);u16(30,2);u32(32,20);u32(36,44);
  bytes.set(new TextEncoder().encode('2025:11:23 09:30:00\0'),56);
  bytes.set([0xff,0xd9],76);
  return bytes.buffer;
}
test('사진 날짜는 EXIF 원본 촬영일, 파일명, 직접 선택 순으로 처리한다',()=>{
  for(const little of [true,false]) assert.deepEqual(photoDate(exifJPEG(little),'20240101.jpg'),{date:'2025-11-23',basis:'촬영일'});
  assert.deepEqual(photoDate(new ArrayBuffer(0),'IMG_20251123_090000.jpg'),{date:'2025-11-23',basis:'파일명'});
  assert.deepEqual(photoDate(new ArrayBuffer(1),'20250230.jpg'),{date:'',basis:'직접 선택'});
  assert.deepEqual(photoDate(new ArrayBuffer(0),'사진.jpg'),{date:'',basis:'직접 선택'});
});
test('기록 종류 선택은 데이터 삭제 없이 타임라인과 회고만 필터링한다',()=>{
  const state=sanitizeState({tasks:[{id:'t',date:'2025-11-23',title:'약속'}],entries:[{id:'d',date:'2025-11-23',text:'일기'}],memories:[{id:'e',date:'2025-11-23',type:'expenses',title:'커피',amount:4500,source:'직접 입력'}],categories:['expenses']});
  assert.equal(timelineItems(state).length,1);
  assert.equal(timelineItems(state)[0].amount,4500);
  assert.equal(state.entries.length,1);
  assert.equal(timelineItems({...state,categories:[]}).length,0);
  assert.equal(timelineItems({...state,categories:['diary']},'일기').length,1);
  assert.deepEqual(lastYearRange(localDate(2024,1,29),0),{anchor:'2023-02-28',start:'2023-02-28',end:'2023-02-28'});
  assert.deepEqual(lastYearRange(localDate(2026,0,1),7),{anchor:'2025-01-01',start:'2024-12-25',end:'2025-01-08'});
});
test('버전 2 백업은 사진을 포함하고 기존 기록·카테고리를 덮어쓰지 않는다',()=>{
  const memory={id:'p',date:'2025-11-23',type:'photos',title:'사진',source:'직접 선택',imageData:'data:image/jpeg;base64,/9j/2Q==',dateBasis:'촬영일'};
  const state=sanitizeState({memories:[memory],categories:['photos']});
  const parsed=parseBackup(JSON.stringify({version:2,...state}));
  assert.equal(parsed.memories[0].imageData,memory.imageData);
  assert.equal(mergeBackup(state,parsed).skipped,1);
  const invalid={version:2,...state,memories:[{...memory,imageData:'javascript:alert(1)'}]};
  assert.throws(()=>parseBackup(JSON.stringify(invalid)));
  assert.equal(safeLink('javascript:alert(1)'),'');
  assert.equal(safeLink('https://user:password@example.com'),'');
  assert.equal(safeLink('https://example.com/news'),'https://example.com/news');
});
