import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {hasNaverConfig,readConfigFile,saveNaverConfig} from './naver-config.mjs';

const file=fileURLToPath(new URL('../.env',import.meta.url));
async function prompt(label,hidden=false) {
  if(hidden) process.stdout.write(label);
  const output=hidden ? new Writable({write(_chunk,_encoding,done){done();}}) : process.stdout;
  const reader=createInterface({input:process.stdin,output,terminal:true,historySize:0});
  const interrupted=new Promise((_,reject)=>{reader.once('SIGINT',()=>reject(new Error('설정을 취소했어요.')));reader.once('close',()=>reject(new Error('입력이 종료되어 설정을 취소했어요.')));});
  try {return await Promise.race([reader.question(hidden ? '' : label),interrupted]);}
  finally {reader.close();if(hidden) {output.end();process.stdout.write('\n');}}
}
try {
  if(!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('직접 연 터미널에서 npm run setup:naver를 실행해 주세요. 비밀번호는 인수·파일 출력·파이프로 받지 않아요.');
  const original=await readConfigFile(file);
  if(hasNaverConfig(original) && !process.argv.includes('--replace')) throw new Error('기존 네이버 설정을 보존했어요. 연결 확인은 npm run check:naver, 교체하려면 npm run setup:naver -- --replace를 사용하세요.');
  process.stdout.write('네이버 전용 앱 비밀번호를 로컬 .env에 저장해요. 입력한 비밀번호는 표시하지 않아요.\n');
  const username=(await prompt('네이버 아이디: ')).trim();
  let password=await prompt('전용 애플리케이션 비밀번호: ',true);
  await saveNaverConfig(file,original,username,password);
  password='';
  process.stdout.write('로컬 설정을 저장했어요. npm run check:naver로 연결을 확인하고, 실행 중인 서버는 다시 시작해 주세요.\n');
} catch(problem) {
  process.stderr.write(`${problem.message || '설정을 저장하지 못했어요.'}\n`);
  process.exitCode=1;
}
