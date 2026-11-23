import { isDateKey } from './data.js';

const unescapeText = value => value.replace(/\\[nN]/g,'\n').replace(/\\([,;\\])/g,'$1');
export function parseCalendar(text, source = '캘린더 파일') {
  const lines = text.replace(/^\uFEFF/,'').replace(/\r?\n[ \t]/g,'').split(/\r?\n/);
  if (!lines.includes('BEGIN:VCALENDAR') || !lines.includes('END:VCALENDAR')) throw new Error('올바른 ICS 캘린더 파일을 선택해 주세요.');
  const events = [];
  const cancelled = lines.includes('METHOD:CANCEL');
  let event = null;
  let alarm = false;
  let unsupported = 0;
  const ids = new Set();
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { if (event) throw new Error('일정 구조를 읽을 수 없어요.'); event = {}; continue; }
    if (!event) continue;
    if (line === 'BEGIN:VALARM') { alarm = true; continue; }
    if (line === 'END:VALARM') { alarm = false; continue; }
    if (alarm) continue;
    if (line === 'END:VEVENT') {
      const value = event.DTSTART || '';
      const match = /^(\d{4})(\d{2})(\d{2})(?:T(?:[01]\d|2[0-3])[0-5]\d[0-5]\dZ?)?$/.exec(value);
      const date = match && `${match[1]}-${match[2]}-${match[3]}`;
      if (event.RRULE || event.RDATE || event.EXDATE || event['RECURRENCE-ID']) { unsupported++; event = null; continue; }
      if (cancelled || event.STATUS === 'CANCELLED') { unsupported++; event = null; continue; }
      if (!event.UID || !date || !isDateKey(date) || !event.SUMMARY?.trim()) throw new Error('제목·시작 날짜·고유 번호가 없는 일정이 있어요. 파일은 적용하지 않았어요.');
      const id = `ics:${event.UID}`;
      if (ids.has(id)) throw new Error('중복된 고유 번호의 일정이 있어요. 파일은 적용하지 않았어요.');
      ids.add(id);
      events.push({id,type:'calendar',date,title:unescapeText(event.SUMMARY).slice(0,200),text:unescapeText([event.LOCATION,event.DESCRIPTION].filter(Boolean).join('\n')).slice(0,2000),source:source.slice(0,200)});
      if (events.length > 5000) throw new Error('한 번에 5,000개 이하의 일정을 가져올 수 있어요.');
      event = null; continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const property = line.slice(0,colon).split(';')[0].toUpperCase();
    event[property] = line.slice(colon+1);
  }
  if (event) throw new Error('끝나지 않은 일정이 있어요.');
  return {items:events, skipped:unsupported};
}

export function parseCSV(text) {
  const rows = []; let row = []; let value = ''; let quoted = false; let closed = false;
  const input = text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  for (let i=0;i<input.length;i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i+1] === '"') { value += '"'; i++; }
      else if (!quoted && value.length) throw new Error('CSV 따옴표 형식을 확인해 주세요.');
      else { quoted = !quoted; closed = !quoted; }
    } else if (char === ',' && !quoted) { row.push(value); value = ''; closed=false; }
    else if (char === '\n' && !quoted) { row.push(value); if (row.some(cell => cell.trim())) rows.push(row); row=[]; value=''; closed=false; }
    else { if(closed && !quoted) throw new Error('CSV 따옴표 뒤의 내용을 확인해 주세요.'); value += char; }
  }
  if (quoted) throw new Error('CSV 따옴표가 닫히지 않았어요.');
  row.push(value); if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}
export async function parseExpenses(text, source = '가계부 CSV') {
  const rows = parseCSV(text);
  if (rows.shift()?.join(',') !== 'date,title,amount') throw new Error('첫 줄은 date,title,amount여야 해요.');
  if (rows.length > 5000) throw new Error('한 번에 5,000개 이하의 지출을 가져올 수 있어요.');
  const occurrences = new Map();
  const items = [];
  for (const row of rows) {
    const [date,title,amountText] = row.map(cell => cell.trim());
    const amount = Number(amountText);
    if (row.length !== 3 || !isDateKey(date) || !title || title.length > 200 || !/^\d+$/.test(amountText) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1e12) throw new Error('가계부의 날짜·내용·금액을 확인해 주세요. 금액은 원 단위 양의 정수로 적어 주세요.');
    const key = JSON.stringify([date,title,amount]);
    const occurrence = (occurrences.get(key) || 0) + 1;
    occurrences.set(key,occurrence);
    items.push({id:`expense:${await digest(`${key}:${occurrence}`)}`,type:'expenses',date,title,amount,source:source.slice(0,200),text:''});
  }
  return {items,skipped:0};
}
export async function parseDiary(text,source='일기 CSV') {
  const rows=parseCSV(text);
  if(rows.shift()?.join(',')!=='date,text') throw new Error('일기 CSV 첫 줄은 date,text여야 해요.');
  if(rows.length>5000) throw new Error('한 번에 5,000개 이하의 일기를 가져올 수 있어요.');
  const entries=[];const occurrences=new Map();
  for(const row of rows) {
    const date=row[0]?.trim();const text=row[1]?.trim();
    if(row.length!==2 || !isDateKey(date) || !text || text.length>1000) throw new Error('일기의 날짜와 내용을 확인해 주세요. 글은 1,000자까지 지원해요.');
    const key=JSON.stringify([date,text]);const count=(occurrences.get(key)||0)+1;occurrences.set(key,count);
    entries.push({id:`diary:${await digest(`${key}:${count}`)}`,date,text,source:source.slice(0,200)});
  }
  return entries;
}
export async function digest(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte => byte.toString(16).padStart(2,'0')).join('');
}

export function photoDate(buffer, filename = '') {
  try {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    if (view.getUint16(0) === 0xffd8) {
      let offset = 2;
      while (offset+4 <= view.byteLength) {
        if (bytes[offset] !== 0xff || [0xda,0xd9].includes(bytes[offset+1])) break;
        const marker = bytes[offset+1]; const length = view.getUint16(offset+2);
        if (length < 2 || offset+2+length > view.byteLength) break;
        if (marker === 0xe1 && String.fromCharCode(...bytes.slice(offset+4,offset+10)) === 'Exif\0\0') {
          const base = offset+10; const end = offset+2+length;
          const endian = view.getUint16(base); if (![0x4949,0x4d4d].includes(endian)) break;
          const little = endian === 0x4949;
          const u16 = position => { if (position < base || position+2 > end) throw new Error(); return view.getUint16(position,little); };
          const u32 = position => { if (position < base || position+4 > end) throw new Error(); return view.getUint32(position,little); };
          if (u16(base+2) !== 42) break;
          const ifd = base+u32(base+4); const count = u16(ifd);
          for (let i=0;i<count;i++) {
            const tag = ifd+2+i*12;
            if (u16(tag) !== 0x8769 || u16(tag+2) !== 4 || u32(tag+4) !== 1) continue;
            const exif = base+u32(tag+8); const total = u16(exif);
            for (let j=0;j<total;j++) {
              const field = exif+2+j*12;
              if (u16(field) !== 0x9003 || u16(field+2) !== 2 || u32(field+4) < 19) continue;
              const start = base+u32(field+8); if (start < base || start+19 > end) continue;
              const raw = String.fromCharCode(...bytes.slice(start,start+19));
              const match = /^(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}$/.exec(raw);
              const date = match && `${match[1]}-${match[2]}-${match[3]}`;
              if (isDateKey(date)) return {date,basis:'촬영일'};
            }
          }
        }
        offset += length+2;
      }
    }
  } catch { /* Missing or corrupt EXIF falls back to an explicit date, never lastModified. */ }
  const match = /(?:^|\D)((?:19|20)\d{2})[-_]?([01]\d)[-_]?([0-3]\d)(?=\D|$)/.exec(filename);
  const date = match && `${match[1]}-${match[2]}-${match[3]}`;
  return isDateKey(date) ? {date,basis:'파일명'} : {date:'',basis:'직접 선택'};
}

export async function preparePhoto(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15*1024*1024) throw new Error('사진은 15MB 이하의 JPEG·PNG·WebP를 선택해 주세요.');
  const buffer = await file.arrayBuffer();
  const detected = photoDate(buffer,file.name);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.naturalWidth || image.naturalWidth*image.naturalHeight > 60000000) throw new Error('사진 크기가 너무 커요. 작은 사진을 선택해 주세요.');
    const scale = Math.min(1,800 / Math.max(image.naturalWidth,image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context = canvas.getContext('2d'); context.fillStyle='#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
    let imageData = canvas.toDataURL('image/jpeg',.75);
    if (imageData.length > 350000) imageData = canvas.toDataURL('image/jpeg',.45);
    if (imageData.length > 350000) throw new Error('사진을 저장할 크기로 줄이지 못했어요. 다른 사진을 선택해 주세요.');
    return {id:`photo:${await digest(buffer)}`,type:'photos',date:detected.date,dateBasis:detected.basis,title:file.name.slice(0,200) || '나의 사진',text:'',source:'내가 선택한 사진',imageData};
  } finally { URL.revokeObjectURL(url); }
}
