import {fileURLToPath} from 'node:url';
import {createNaverClient} from '../naver-caldav.mjs';

try {
  try {process.loadEnvFile(fileURLToPath(new URL('../.env',import.meta.url)));}
  catch(problem) {if(problem.code!=='ENOENT') throw new Error('로컬 .env 설정을 읽지 못했어요. 파일 형식을 확인해 주세요.');}
  const client=createNaverClient({username:process.env.NAVER_CALDAV_USERNAME,password:process.env.NAVER_CALDAV_APP_PASSWORD});
  if(!client.configured) throw new Error('네이버 설정이 비어 있어요. 직접 연 터미널에서 npm run setup:naver를 먼저 실행해 주세요.');
  if(process.argv.includes('--offline')) {
    process.stdout.write('로컬 설정 항목이 있어요. 네이버 접속·인증은 확인하지 않았어요.\n');
  } else {
    const calendars=await client.list();
    process.stdout.write(`네이버 인증과 캘린더 목록 조회를 확인했어요. 조회 가능한 캘린더: ${calendars.length}개.\n`);
    process.stdout.write('개별 일정은 앱의 기록 → 기록 연결에서 캘린더를 선택해 확인해 주세요.\n');
  }
} catch(problem) {
  process.stderr.write(`${problem.message || '네이버 연결을 확인하지 못했어요.'}\n`);
  process.exitCode=1;
}
