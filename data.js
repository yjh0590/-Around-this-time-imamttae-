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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function calendarCells(year, month) {
  const offset = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => i >= offset && i < offset + count ? i - offset + 1 : null);
}
export function sanitizeState(raw) {
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks.filter(t => t && typeof t.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && typeof t.title === 'string').map(t => ({ id: t.id, date: t.date, title: t.title.slice(0, 100), done: t.done === true })) : [];
  const entries = Array.isArray(raw?.entries) ? raw.entries.filter(e => e && typeof e.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.text === 'string').map(e => ({ id: e.id, date: e.date, text: e.text.slice(0, 1000) })) : [];
  return { tasks, entries, month: Number.isInteger(raw?.month) && raw.month >= 1 && raw.month <= 12 ? raw.month : null };
}
