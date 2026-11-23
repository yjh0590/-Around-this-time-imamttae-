import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

const USER='NAVER_CALDAV_USERNAME';
const PASSWORD='NAVER_CALDAV_APP_PASSWORD';
const assignment=new RegExp(`^\\s*(?:export\\s+)?(${USER}|${PASSWORD})\\s*=`);
function literal(value) {
  if(typeof value!=='string' || !value.trim() || /[\r\n\0]/.test(value)) throw new Error('한 줄로 된 아이디와 앱 비밀번호를 입력해 주세요.');
  if(!value.includes("'")) return `'${value}'`;
  if(!value.includes('"')) return `"${value}"`;
  throw new Error('설정 파일에 저장할 수 없는 문자가 있어요. 전용 앱 비밀번호를 확인해 주세요.');
}
export function updateNaverConfig(content,username,password) {
  if(typeof username!=='string' || username.length>100 || /[:\s]/.test(username)) throw new Error('네이버 아이디를 확인해 주세요.');
  if(typeof password!=='string' || password.length>512) throw new Error('전용 앱 비밀번호를 확인해 주세요.');
  const values={[USER]:literal(username),[PASSWORD]:literal(password)};
  const newline=content.includes('\r\n') ? '\r\n' : '\n';
  const seen=new Set();
  const original=content.split(/\r?\n/).filter((line,index,all)=>index<all.length-1 || line!=='');
  const blocks=[];
  for(let i=0;i<original.length;i++) {
    const block=[original[i]];
    const quoted=/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(['"`])/.exec(original[i]);
    if(quoted && !original[i].slice(quoted[0].length).includes(quoted[1])) {
      let closed=false;
      while(++i<original.length) {block.push(original[i]);if(original[i].includes(quoted[1])) {closed=true;break;}}
      if(!closed) throw new Error('설정 파일에 닫히지 않은 따옴표가 있어요. 기존 파일은 변경하지 않았어요.');
    }
    blocks.push(block);
  }
  const lines=blocks.flatMap(block=>{
    const match=assignment.exec(block[0]);
    if(!match) return block;
    if(seen.has(match[1])) return [];
    seen.add(match[1]);return [`${match[1]}=${values[match[1]]}`];
  });
  for(const key of [USER,PASSWORD]) if(!seen.has(key)) lines.push(`${key}=${values[key]}`);
  return lines.join(newline)+newline;
}
export function hasNaverConfig(content) {
  return content.split(/\r?\n/).some(line=>{
    const match=assignment.exec(line);
    if(!match) return false;
    const value=line.slice(line.indexOf('=')+1).trim();
    return value && !['""',"''"].includes(value) && !value.startsWith('#');
  });
}
export async function readConfigFile(file) {
  try {return await readFile(file,'utf8');} catch(problem) {if(problem.code==='ENOENT') return '';throw new Error('로컬 설정 파일을 읽지 못했어요. 파일 접근 권한을 확인해 주세요.');}
}
export async function saveNaverConfig(file,original,username,password) {
  const updated=updateNaverConfig(original,username,password);
  const temporary=path.join(path.dirname(file),`.env.setup-${randomUUID()}`);
  try {
    await writeFile(temporary,updated,{flag:'wx',mode:0o600});
    if(await readConfigFile(file)!==original) throw new Error('입력 중 설정 파일이 변경됐어요. 덮어쓰지 않았으니 다시 실행해 주세요.');
    await rename(temporary,file);
  } finally {await unlink(temporary).catch(()=>{});}
}
