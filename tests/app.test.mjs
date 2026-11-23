import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonForMonth, calendarCells, dateKey, sanitizeState } from '../data.js';
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
  assert.deepEqual(sanitizeState(null), { tasks:[], entries:[], month:null });
  const value = sanitizeState({ month:13, tasks:[null,{id:'a',date:'2026-11-23',title:'할 일',done:'false'},{id:1}], entries:[{id:'b',date:'2026-11-23',text:'기록'},false] });
  assert.equal(value.tasks.length,1);
  assert.equal(value.tasks[0].done,false);
  assert.equal(value.entries.length,1);
  assert.equal(value.month,null);
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
