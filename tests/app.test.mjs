import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonForMonth, calendarCells, dateKey, sanitizeState, isDateKey, parseBackup, mergeBackup, searchEntries, CATEGORIES } from '../data.js';
import { createServer } from '../server.mjs';

test('12개월 계절 경계와 잘못된 월', () => {
  assert.deepEqual(Array.from({length:12}, (_,i) => seasonForMonth(i+1)), ['winter','winter','spring','spring','spring','summer','summer','summer','autumn','autumn','autumn','winter']);
  for (const value of [0,13,1.5,NaN]) assert.throws(() => seasonForMonth(value), RangeError);
});
test('달력은 윤년과 주 시작일을 보존한다', () => {
  const leap = calendarCells(2024,1);
  assert.equal(leap.filter(Boolean).length,29);
  assert.equal(leap[4],1);
  assert.equal(calendarCells(2025,1).filter(Boolean).length,28);
  assert.equal(calendarCells(2026,10)[0],1);
  assert.equal(dateKey(new Date(2026,0,2)), '2026-01-02');
});
test('손상된 저장 상태와 미지원 필드를 안전하게 정리한다', () => {
  assert.deepEqual(sanitizeState(null), { tasks:[], entries:[], memories:[], categories:Object.keys(CATEGORIES), month:null });
  const value = sanitizeState({ month:13, tasks:[null,{id:'a',date:'2026-11-23',title:'할 일',done:'false'},{id:1}], entries:[{id:'b',date:'2026-11-23',text:'기록'},false] });
  assert.equal(value.tasks.length,1);
  assert.equal(value.tasks[0].done,false);
  assert.equal(value.entries.length,1);
  assert.equal(value.month,null);
});

test('실제 존재하는 로컬 날짜만 허용한다', () => {
  for (const value of ['2024-02-29','2026-11-23','0001-01-01','0099-12-31']) assert.equal(isDateKey(value),true,value);
  for (const value of ['2025-02-29','2026-02-30','2026-13-01','0000-01-01','2026-1-01',null]) assert.equal(isDateKey(value),false,String(value));
  assert.equal(sanitizeState({tasks:[{id:'a',date:'2026-02-30',title:'x'}]}).tasks.length,0);
});

test('이전 버전 백업을 읽고 잘못된 백업은 전체를 거부한다', () => {
  const backup = { version:1, month:4, tasks:[{id:'a',date:'2026-11-23',title:'할 일',done:true}], entries:[{id:'b',date:'2026-11-23',text:'<b>문자 그대로</b>'}] };
  assert.equal(parseBackup(JSON.stringify(backup)).tasks[0].done,true);
  assert.equal(parseBackup(JSON.stringify(backup)).entries[0].text,'<b>문자 그대로</b>');
  for (const invalid of [null,{...backup,version:2},{...backup,tasks:[{...backup.tasks[0],date:'2026-02-30'}]},{...backup,tasks:[{...backup.tasks[0],done:'true'}]},{...backup,entries:[{...backup.entries[0],text:' '}]},{...backup,tasks:[backup.tasks[0],backup.tasks[0]]}]) {
    assert.throws(() => parseBackup(JSON.stringify(invalid)));
  }
  assert.throws(() => parseBackup('{broken'));
});

test('백업 병합은 현재 항목과 테마를 유지하며 반복 실행해도 중복되지 않는다', () => {
  const current = {month:10,tasks:[{id:'a',date:'2026-11-23',title:'수정한 일정',done:true}],entries:[]};
  const incoming = {month:4,tasks:[{...current.tasks[0],title:'예전 일정',done:false},{id:'b',date:'2026-11-24',title:'추가할 일정',done:false}],entries:[{id:'c',date:'2026-11-23',text:'추가할 기록'}]};
  const before = JSON.stringify(current);
  const result = mergeBackup(current,incoming);
  assert.equal(result.state.month,10);
  assert.equal(result.state.tasks[0].title,'수정한 일정');
  assert.equal(result.state.tasks[0].done,true);
  assert.deepEqual([result.addedTasks,result.addedEntries,result.skipped],[1,1,1]);
  assert.equal(JSON.stringify(current),before);
  const repeated = mergeBackup(result.state,incoming);
  assert.deepEqual([repeated.addedTasks,repeated.addedEntries,repeated.skipped],[0,0,3]);
});

test('기록은 내용·날짜로 검색하고 원본 배열을 변경하지 않는다', () => {
  const entries = [{id:'a',date:'2026-01-01',text:'봄을 기다리며'},{id:'b',date:'2026-11-23',text:'COZY 겨울'}];
  assert.equal(searchEntries(entries,'봄')[0].id,'a');
  assert.equal(searchEntries(entries,' cozy ')[0].id,'b');
  assert.equal(searchEntries(entries,'2026-11').length,1);
  assert.equal(searchEntries(entries,'없는 단어').length,0);
  assert.equal(searchEntries(entries,'')[0].id,'b');
  assert.equal(entries[0].id,'a');
});
test('서버는 앱 자산을 제공하고 저장소 내부 파일을 차단한다', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const name of ['','styles.css','app.js','data.js','assets/icon.svg','assets/seasonal-companion.png']) {
      const response = await fetch(`${base}/${name}`);
      assert.equal(response.status,200,name);
      assert.ok((await response.arrayBuffer()).byteLength > 0);
    }
    for (const name of ['.git/config','package.json','docs/DEVELOPMENT.md','missing.js']) assert.equal((await fetch(`${base}/${name}`)).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
