import {createHash} from 'node:crypto';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {parseCalendar} from './imports.js';
import {dateKey, isDateKey, lastYearRange} from './data.js';

const BASE='https://caldav.calendar.naver.com/';
const MAX_BYTES=8*1024*1024;
const parser=new XMLParser({removeNSPrefix:true,ignoreAttributes:false,parseTagValue:false,trimValues:false});
const array=value=>value == null ? [] : Array.isArray(value) ? value : [value];
export class NaverConnectionError extends Error {
  constructor(message,status=502) {super(message);this.status=status;}
}
export function naverURL(href,base=BASE) {
  let url;
  try {url=new URL(href,base);} catch {throw new NaverConnectionError('캘린더 서버 주소를 확인하지 못했어요.');}
  if(url.origin!==new URL(BASE).origin || url.username || url.password || url.hash) throw new NaverConnectionError('허용되지 않은 캘린더 서버 주소예요.');
  return url.href;
}
export function parseMultistatus(xml) {
  if(/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml)!==true) throw new NaverConnectionError('캘린더 응답 형식을 확인하지 못했어요.');
  const parsed=parser.parse(xml);
  if(!parsed.multistatus) throw new NaverConnectionError('캘린더 응답에 조회 결과가 없어요.');
  return array(parsed.multistatus.response).map(response=>({href:response.href,props:Object.assign({},...array(response.propstat).filter(part=>/\s200\s/.test(part.status || '')).map(part=>part.prop || {}))}));
}
export function createNaverClient({username='',password='',fetcher=fetch}={}) {
  const configured=Boolean(username.trim() && password);
  let calendars=new Map();
  let cachedUntil=0;
  let reading=null;
  const authorization=`Basic ${Buffer.from(`${username}:${password}`,'utf8').toString('base64')}`;
  async function request(href,method,body,depth='0') {
    if(!configured) throw new NaverConnectionError('로컬 서버에 네이버 연결 설정이 필요해요.',503);
    let response;
    try {
      response=await fetcher(naverURL(href),{method,headers:{Authorization:authorization,'Content-Type':'application/xml; charset=utf-8',Depth:depth},body,redirect:'manual',signal:AbortSignal.timeout(15000)});
    } catch {throw new NaverConnectionError('네이버에 연결하지 못했어요. 네트워크와 서버 설정을 확인해 주세요.');}
    if(response.status===401 || response.status===403) throw new NaverConnectionError('네이버 인증을 확인해 주세요. 서버의 아이디와 애플리케이션 비밀번호 설정을 점검해 주세요.',401);
    if(response.status>=300 && response.status<400) throw new NaverConnectionError('캘린더 서버가 다른 주소로 이동을 요청해 연결을 중단했어요.');
    if(!response.ok) throw new NaverConnectionError('네이버 캘린더가 조회 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    if(Number(response.headers.get('content-length'))>MAX_BYTES) {await response.body?.cancel();throw new NaverConnectionError('조회 결과가 너무 커요. 캘린더를 줄여서 선택해 주세요.');}
    const reader=response.body?.getReader();let size=0;const chunks=[];
    if(!reader) throw new NaverConnectionError('캘린더 응답이 비어 있어요.');
    try {
      while(true) {const {value,done}=await reader.read();if(done) break;size+=value.length;if(size>MAX_BYTES) {await reader.cancel();throw new NaverConnectionError('조회 결과가 너무 커요. 캘린더를 줄여서 선택해 주세요.');}chunks.push(value);}
    } catch(problem) {if(problem instanceof NaverConnectionError) throw problem;throw new NaverConnectionError('조회 도중 연결이 끊겼어요. 다시 시도해 주세요.');}
    finally {reader.releaseLock();}
    return parseMultistatus(Buffer.concat(chunks).toString('utf8'));
  }
  const propBody=content=>`<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>${content}</d:prop></d:propfind>`;
  async function discover() {
    const roots=await request(BASE,'PROPFIND',propBody('<d:current-user-principal/>'));
    const principal=roots.find(row=>row.props['current-user-principal']?.href)?.props['current-user-principal'].href;
    if(!principal) throw new NaverConnectionError('네이버의 캘린더 계정 경로를 확인하지 못했어요.');
    const principals=await request(naverURL(principal),'PROPFIND',propBody('<c:calendar-home-set/>'));
    const home=principals.find(row=>row.props['calendar-home-set']?.href)?.props['calendar-home-set'].href;
    if(!home) throw new NaverConnectionError('네이버의 캘린더 목록 경로를 확인하지 못했어요.');
    const rows=await request(naverURL(home),'PROPFIND',propBody('<d:displayname/><d:resourcetype/>'),'1');
    const found=new Map();
    for(const row of rows) {
      if(!row.href || !row.props.resourcetype || !Object.hasOwn(row.props.resourcetype,'calendar')) continue;
      const url=naverURL(row.href,naverURL(home));
      const id=createHash('sha256').update(url).digest('hex').slice(0,24);
      const name=typeof row.props.displayname==='string' ? row.props.displayname.trim().slice(0,100) : '';
      found.set(id,{id,name:name || '네이버 캘린더',url});
    }
    calendars=found;cachedUntil=Date.now()+300000;
    return [...found.values()].map(({id,name})=>({id,name}));
  }
  async function list() {
    if(Date.now()<cachedUntil) return [...calendars.values()].map(({id,name})=>({id,name}));
    if(!reading) reading=discover().finally(()=>{reading=null;});
    return reading;
  }
  async function sync(date,ids) {
    if(!isDateKey(date) || !Array.isArray(ids) || !ids.length || ids.length>10 || new Set(ids).size!==ids.length || ids.some(id=>typeof id!=='string')) throw new NaverConnectionError('조회 날짜와 캘린더 선택을 확인해 주세요.',400);
    await list();
    if(ids.some(id=>!calendars.has(id))) throw new NaverConnectionError('선택한 캘린더가 변경됐어요. 목록을 다시 확인해 주세요.',400);
    const range=lastYearRange(new Date(`${date}T12:00:00`),14);
    const start=new Date(`${range.start}T12:00:00`);start.setDate(start.getDate()-1);
    const end=new Date(`${range.end}T12:00:00`);end.setDate(end.getDate()+2);
    if(!isDateKey(dateKey(start)) || !isDateKey(dateKey(end))) throw new NaverConnectionError('지원하는 날짜 범위를 벗어났어요.',400);
    const begin=dateKey(start).replaceAll('-','')+'T000000Z';
    const finish=dateKey(end).replaceAll('-','')+'T000000Z';
    const body=`<?xml version="1.0" encoding="UTF-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${begin}" end="${finish}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
    const items=[];let skipped=0;const seen=new Set();
    for(const id of ids) {
      const calendar=calendars.get(id);
      const rows=await request(calendar.url,'REPORT',body,'1');
      for(const row of rows) {
        const value=row.props['calendar-data'];if(typeof value!=='string' || !value.trim()) continue;
        let result;
        try {result=parseCalendar(value,`네이버 캘린더 · ${calendar.name}`);} catch {throw new NaverConnectionError('네이버 일정 일부를 읽지 못해 이번 조회를 적용하지 않았어요. ICS 파일 가져오기를 이용해 주세요.');}
        skipped+=result.skipped;
        for(const item of result.items) {
          if(item.date<range.start || item.date>range.end) continue;
          const key=`naver:${id}:${item.id}`;
          if(seen.has(key)) continue;
          seen.add(key);items.push({...item,id:key});
          if(items.length>5000) throw new NaverConnectionError('조회 일정이 너무 많아요. 캘린더를 줄여서 선택해 주세요.');
        }
      }
    }
    return {items,skipped,range:{start:range.start,end:range.end}};
  }
  return {configured,list,sync};
}
