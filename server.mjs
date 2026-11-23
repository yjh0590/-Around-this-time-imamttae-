import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {createNaverClient, NaverConnectionError} from './naver-caldav.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const allowed = new Set(['index.html','styles.css','app.js','data.js','imports.js','journal.js','naver.js','assets/icon.svg','assets/seasonal-companion.png']);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png' };
export function createServer({naverClient=createNaverClient({username:process.env.NAVER_CALDAV_USERNAME,password:process.env.NAVER_CALDAV_APP_PASSWORD})}={}) {
  let syncing=false;
  return http.createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html'; }
    catch { response.writeHead(400).end('Bad request'); return; }
    if(pathname.startsWith('api/naver/')) {
      const json=(status,value)=>response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(value));
      const host=request.headers.host || '';
      if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || request.headers['x-imamttae-request']!=='1' || (request.headers.origin && request.headers.origin!==`http://${host}`)) {json(403,{error:'이 앱에서만 연결을 요청할 수 있어요.'});return;}
      if((pathname==='api/naver/status' || pathname==='api/naver/calendars') && request.method!=='GET' || pathname==='api/naver/sync' && request.method!=='POST') {json(405,{error:'지원하지 않는 요청이에요.'});return;}
      try {
        if(pathname==='api/naver/status') {json(200,{configured:naverClient.configured});return;}
        if(pathname==='api/naver/calendars') {json(200,{calendars:await naverClient.list()});return;}
        if(pathname==='api/naver/sync') {
          if(syncing) {json(429,{error:'이미 일정을 확인하고 있어요. 잠시 후 다시 시도해 주세요.'});return;}
          if(!request.headers['content-type']?.startsWith('application/json')) {json(415,{error:'JSON 요청이 필요해요.'});return;}
          let size=0;const chunks=[];
          for await(const chunk of request) {size+=chunk.length;if(size>4096) {json(413,{error:'요청이 너무 커요.'});return;}chunks.push(chunk);}
          let body;try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {json(400,{error:'요청 내용을 확인해 주세요.'});return;}
          syncing=true;
          try {json(200,await naverClient.sync(body?.date,body?.calendarIds));} finally {syncing=false;}
          return;
        }
        json(404,{error:'지원하지 않는 연결 경로예요.'});
      } catch(problem) {json(problem instanceof NaverConnectionError ? problem.status : 502,{error:problem instanceof NaverConnectionError ? problem.message : '연결을 완료하지 못했어요. 서버 설정을 확인해 주세요.'});}
      return;
    }
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405, { Allow:'GET, HEAD' }).end(); return; }
    if (!allowed.has(pathname)) { response.writeHead(404).end('Not found'); return; }
    try {
      const content = await readFile(path.join(root, pathname));
      response.writeHead(200, { 'Content-Type':types[path.extname(pathname)], 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache', 'Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(500).end('Unable to read file'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if(process.loadEnvFile) {try {process.loadEnvFile(path.join(root,'.env'));} catch(problem) {if(problem.code!=='ENOENT') {console.error('로컬 .env 설정을 읽지 못했어요. 파일 형식을 확인해 주세요.');process.exit(1);}}}
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '127.0.0.1', () => console.log(`이맘때: http://localhost:${port}`));
}
