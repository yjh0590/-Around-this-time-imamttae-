import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {updateNaverConfig,hasNaverConfig,saveNaverConfig} from '../scripts/naver-config.mjs';

test('네이버 설정은 다른 변수·주석·줄바꿈을 보존하고 중복 키를 정리한다',()=>{
  const original='# 보존할 주석\r\nPORT=3001\r\nNAVER_CALDAV_USERNAME=old\r\nexport NAVER_CALDAV_USERNAME=duplicate\r\nOTHER="keep # value"\r\n';
  const updated=updateNaverConfig(original,'test-user','test-secret#value');
  assert.ok(updated.includes('# 보존할 주석\r\nPORT=3001\r\n'));
  assert.ok(updated.includes('OTHER="keep # value"'));
  const parsed=parseEnv(updated);
  assert.equal(parsed.NAVER_CALDAV_USERNAME,'test-user');
  assert.equal(parsed.NAVER_CALDAV_APP_PASSWORD,'test-secret#value');
  assert.equal(updated.match(/^NAVER_CALDAV_USERNAME=/gm).length,1);
  const multiline='UNRELATED="보존할 여러 줄\nNAVER_CALDAV_USERNAME=문자열 내부\n마지막 줄"\nNAVER_CALDAV_APP_PASSWORD="기존\n비밀번호"\n';
  const changed=updateNaverConfig(multiline,'test-user','new-secret');
  assert.equal(parseEnv(changed).UNRELATED,parseEnv(multiline).UNRELATED);
  assert.equal(parseEnv(changed).NAVER_CALDAV_APP_PASSWORD,'new-secret');
  assert.equal(changed.includes('기존'),false);
  assert.throws(()=>updateNaverConfig('UNRELATED="닫히지 않은 값','test-user','new-secret'));
});
test('설정 값은 코드로 평가하지 않으며 줄바꿈·잘못된 사용자 입력을 거부한다',()=>{
  const value='literal $(never-run) `never-run` "quoted"';
  assert.equal(parseEnv(updateNaverConfig('','test-user',value)).NAVER_CALDAV_APP_PASSWORD,value);
  for(const [username,password] of [['','secret'],['with space','secret'],['id:bad','secret'],['test','secret\nOTHER=bad'],['test',''],['test','both\'and"quotes']]) assert.throws(()=>updateNaverConfig('',username,password));
  assert.equal(hasNaverConfig('NAVER_CALDAV_USERNAME=""\nNAVER_CALDAV_APP_PASSWORD=\n'),false);
  assert.equal(hasNaverConfig('NAVER_CALDAV_APP_PASSWORD=existing\n'),true);
});
test('설정 저장은 변경 충돌 시 기존 파일을 덮어쓰지 않는다',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'imamttae-config-'));
  const file=path.join(dir,'.env');
  await saveNaverConfig(file,'','test-user','test-secret');
  assert.equal(parseEnv(await readFile(file,'utf8')).NAVER_CALDAV_APP_PASSWORD,'test-secret');
  await writeFile(file,'PORT=4000\n');
  await assert.rejects(()=>saveNaverConfig(file,'PORT=3000\n','test-user','new-secret'),/변경/);
  assert.equal(await readFile(file,'utf8'),'PORT=4000\n');
  assert.deepEqual(await readdir(dir),['.env']);
});
test('비대화형 실행은 비밀번호를 받거나 설정 파일을 만들지 않는다',()=>{
  const result=spawnSync(process.execPath,['scripts/setup-naver.mjs'],{encoding:'utf8',input:'not-a-real-password\n'});
  assert.equal(result.status,1);
  assert.ok(result.stderr.includes('직접 연 터미널'));
  assert.equal(`${result.stdout}${result.stderr}`.includes('not-a-real-password'),false);
});
