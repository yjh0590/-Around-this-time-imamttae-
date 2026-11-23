export const SEASONS = {
  spring: { name: '봄', title: '봄이 머무는 이맘때', greeting: '작은 시작이 피어나는 하루예요.', color: '#71865a', tint: '#edf1e7', position: '0%', task: '봄옷 정리하기', story: '햇빛을 들이는 집의 지혜', category: '계절과 생활', body: '계절이 바뀌면 집 안에 드는 빛도 달라져요. 오늘은 창가에 잠시 앉아 햇빛이 닿는 곳을 살펴보세요. 커튼을 열고 가구 주변을 정리하는 작은 행동으로 계절을 맞이해 볼까요?', wisdom: '한옥의 처마는 해의 높이에 따라 들어오는 햇빛을 조절하는 데 도움을 줘요. 실제 효과는 건물의 방향과 처마의 길이, 주변 환경에 따라 달라져요.', action: '창가 정리하기' },
  summer: { name: '여름', title: '여름을 보내는 이맘때', greeting: '잠깐 쉬어 가도 좋은 하루예요.', color: '#5a8ca9', tint: '#eaf2f6', position: '33.333333%', task: '여름 침구 정리하기', story: '바람이 지나는 자리', category: '옛 지혜, 오늘의 생활', body: '침구와 가구 사이에 공기가 지날 공간이 있는지 살펴보세요. 오늘은 침구의 관리 표시를 확인하고, 세탁하거나 말릴 일정을 정해 보아요.', wisdom: '대나무를 엮은 죽부인은 몸과 침구 사이에 공간을 만들어 공기가 통하도록 도왔어요. 통풍의 원리를 떠올리며 나의 잠자리를 살펴보세요.', action: '침구 관리 표시 확인하기' },
  autumn: { name: '가을', title: '가을이 깊어지는 이맘때', greeting: '계절의 속도로 천천히 걸어봐요.', color: '#b07854', tint: '#f5eee7', position: '66.666667%', task: '가을옷 꺼내기', story: '계절을 담아 두는 방법', category: '계절과 생활', body: '옷장 속에 다음 계절을 위한 자리를 만들어 볼까요? 자주 입을 옷을 꺼내고, 넣어 둘 옷은 관리 표시를 확인해 정리해 보세요.', wisdom: '계절에 맞춰 생활 도구와 옷을 손질하고 보관해 온 습관을 오늘의 옷장에도 이어 볼 수 있어요. 물건을 오래 쓰는 작은 기록을 남겨 보세요.', action: '옷장 한 칸 정리하기' },
  winter: { name: '겨울', title: '겨울을 지나는 이맘때', greeting: '포근한 하루를 함께 준비해요.', color: '#718b9e', tint: '#ecf0f4', position: '100%', task: '창가 살펴보기', story: '발끝에서 시작되는 따뜻함', category: '옛 지혜, 오늘의 생활', body: '겨울의 집에서 가장 좋아하는 자리는 어디인가요? 바닥의 온기와 창가의 빛을 느끼며, 나를 편안하게 하는 공간을 기록해 보세요.', wisdom: '전통 온돌은 바닥 아래로 열을 전달하고 바닥에 열을 머금게 하는 난방 방식이에요. 오늘날의 온수 바닥난방과는 열을 전달하는 구조에 차이가 있어요.', action: '겨울 침구 살펴보기' }
};
export const MONTH_NOTES = ['목도리를 여미는 1월', '봄을 기다리는 2월', '새싹을 만나는 3월', '꽃잎이 머무는 4월', '초록이 짙어지는 5월', '햇살이 길어지는 6월', '그늘이 반가운 7월', '여름을 간직하는 8월', '바람이 달라지는 9월', '낙엽을 만나는 10월', '겨울을 준비하는 11월', '온기를 나누는 12월'];
export function seasonForMonth(month) {
  if (month < 1 || month > 12 || !Number.isInteger(month)) throw new RangeError('월은 1~12 사이의 정수여야 합니다.');
  return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
}
export function dateKey(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localDate(year, month, day = 1) {
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}
export function calendarCells(year, month) {
  const first = localDate(year, month);
  const last = localDate(year, month + 1, 0);
  const offset = first.getDay();
  const count = last.getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i >= offset && i < offset + count ? i - offset + 1 : null);
}
export function sanitizeState(raw) {
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks.filter(t => t && typeof t.id === 'string' && isDateKey(t.date) && typeof t.title === 'string').map(t => ({ id: t.id, date: t.date, title: t.title.slice(0, 100), done: t.done === true })) : [];
  const entries = Array.isArray(raw?.entries) ? raw.entries.filter(e => e && typeof e.id === 'string' && isDateKey(e.date) && typeof e.text === 'string').map(e => ({ id: e.id, date: e.date, text: e.text.slice(0, 1000) })) : [];
  const memories = Array.isArray(raw?.memories) ? raw.memories.filter(validMemory).map(cleanMemory) : [];
  const categories = Array.isArray(raw?.categories) ? [...new Set(raw.categories.filter(key => typeof key === 'string' && Object.hasOwn(CATEGORIES,key)))] : Object.keys(CATEGORIES);
  return { tasks, entries, memories, categories, month: Number.isInteger(raw?.month) && raw.month >= 1 && raw.month <= 12 ? raw.month : null };
}

export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}

// Import is stricter than local-state recovery: never silently drop backup data.
export function parseBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('JSON 파일을 읽지 못했어요. 이맘때에서 내려받은 백업을 선택해 주세요.'); }
  if (!raw || ![1,2].includes(raw.version) || !Array.isArray(raw.tasks) || !Array.isArray(raw.entries)) {
    throw new Error('지원하는 이맘때 백업 형식이 아니에요.');
  }
  if (raw.version === 2) {
    if (!Array.isArray(raw.memories) || !Array.isArray(raw.categories) || raw.categories.some(key => typeof key !== 'string' || !Object.hasOwn(CATEGORIES,key))) throw new Error('기록 종류를 읽을 수 없는 백업이에요.');
    const ids = new Set();
    for (const memory of raw.memories) {
      if (!validMemory(memory) || ids.has(memory.id)) throw new Error('백업에 잘못된 통합 기록이 있어요. 현재 데이터는 변경하지 않았어요.');
      ids.add(memory.id);
    }
  }
  for (const [key, field, limit] of [['tasks', 'title', 100], ['entries', 'text', 1000]]) {
    const ids = new Set();
    for (const item of raw[key]) {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id) ||
          !isDateKey(item.date) || typeof item[field] !== 'string' || !item[field].trim() ||
          item[field].length > limit || (key === 'tasks' && typeof item.done !== 'boolean')) {
        throw new Error('백업에 잘못된 날짜나 항목이 있어요. 현재 데이터는 변경하지 않았어요.');
      }
      ids.add(item.id);
    }
  }
  return sanitizeState(raw);
}

export function mergeBackup(current, incoming) {
  const tasks = new Set(current.tasks.map(task => task.id));
  const entries = new Set(current.entries.map(entry => entry.id));
  const newTasks = incoming.tasks.filter(task => !tasks.has(task.id));
  const newEntries = incoming.entries.filter(entry => !entries.has(entry.id));
  const memories = new Set((current.memories || []).map(memory => memory.id));
  const newMemories = (incoming.memories || []).filter(memory => !memories.has(memory.id));
  return {
    state: { ...current, tasks: [...current.tasks, ...newTasks], entries: [...current.entries, ...newEntries], memories:[...(current.memories || []), ...newMemories] },
    addedTasks: newTasks.length,
    addedEntries: newEntries.length,
    addedMemories: newMemories.length,
    skipped: incoming.tasks.length + incoming.entries.length + (incoming.memories || []).length - newTasks.length - newEntries.length - newMemories.length
  };
}

export const CATEGORIES = { calendar:'캘린더', photos:'사진', expenses:'가계부', diary:'일기', world:'그 무렵의 세상' };
export function safeLink(value) {
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function validMemory(item) {
  if (!item || typeof item.id !== 'string' || !item.id || !['calendar','photos','expenses','world'].includes(item.type) || !isDateKey(item.date) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200 || typeof item.source !== 'string' || !item.source.trim() || item.source.length > 200) return false;
  if (item.text != null && (typeof item.text !== 'string' || item.text.length > 2000)) return false;
  if (item.type === 'photos' && (typeof item.imageData !== 'string' || item.imageData.length > 350000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(item.imageData))) return false;
  if (item.type === 'expenses' && (!Number.isSafeInteger(item.amount) || item.amount <= 0 || item.amount > 1e12)) return false;
  if (item.type === 'world' && !safeLink(item.url)) return false;
  return true;
}
function cleanMemory(item) {
  return {id:item.id,type:item.type,date:item.date,title:item.title,source:item.source,text:item.text || '',...(item.type === 'photos' ? {imageData:item.imageData,dateBasis: ['촬영일','파일명','직접 선택'].includes(item.dateBasis) ? item.dateBasis : '직접 선택'} : {}),...(item.type === 'expenses' ? {amount:item.amount} : {}),...(item.type === 'world' ? {url:safeLink(item.url)} : {})};
}
export function timelineItems(state, query = '') {
  const categories = state.categories || Object.keys(CATEGORIES);
  const items = [...(state.memories || [])];
  if (categories.includes('diary')) items.push(...state.entries.map(entry => ({...entry,type:'diary',title:entry.text,text:'',source:'내가 쓴 일기'})));
  if (categories.includes('calendar')) items.push(...state.tasks.map(task => ({...task,type:'calendar',text:'',source:'내가 담은 일정'})));
  const needle = query.trim().normalize('NFC').toLocaleLowerCase('ko-KR');
  return items.filter(item => categories.includes(item.type) && (!needle || `${item.date} ${item.title} ${item.text} ${item.source}`.normalize('NFC').toLocaleLowerCase('ko-KR').includes(needle))).sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function lastYearRange(date, radius = 7) {
  const year = date.getFullYear() - 1;
  const day = Math.min(date.getDate(), localDate(year,date.getMonth()+1,0).getDate());
  const anchor = localDate(year,date.getMonth(),day);
  const start = localDate(year,date.getMonth(),day-radius);
  const end = localDate(year,date.getMonth(),day+radius);
  return {anchor:dateKey(anchor),start:dateKey(start),end:dateKey(end)};
}

export function searchEntries(entries, query) {
  const needle = query.trim().normalize('NFC').toLocaleLowerCase('ko-KR');
  return [...entries].filter(entry => !needle || `${entry.date} ${entry.text}`.normalize('NFC').toLocaleLowerCase('ko-KR').includes(needle))
    .sort((a, b) => b.date.localeCompare(a.date));
}
