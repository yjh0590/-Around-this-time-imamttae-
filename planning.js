import {dateKey,isDateKey,localDate} from './data.js';

export const REPEATS={none:'반복 안 함',daily:'매일',weekly:'매주',monthly:'매월',yearly:'매년'};
export function scheduleDates(start,repeat='none',until=start) {
  if(!isDateKey(start) || !Object.hasOwn(REPEATS,repeat) || repeat!=='none' && (!isDateKey(until) || until<start)) throw new Error('시작일과 반복 종료일을 확인해 주세요.');
  if(repeat==='none') return [start];
  const anchor=new Date(`${start}T12:00:00`);const dates=[];
  for(let i=0;i<=366;i++) {
    let current;
    if(repeat==='daily' || repeat==='weekly') current=localDate(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+i*(repeat==='weekly'?7:1));
    else {
      const month=localDate(anchor.getFullYear()+(repeat==='yearly'?i:0),anchor.getMonth()+(repeat==='monthly'?i:0));
      current=localDate(month.getFullYear(),month.getMonth(),Math.min(anchor.getDate(),localDate(month.getFullYear(),month.getMonth()+1,0).getDate()));
    }
    const date=dateKey(current);
    if(current.getFullYear()>9999)break;
    if(date>until) break;
    if(!isDateKey(date) || i===366) throw new Error('한 번에 366개 이하의 반복 일정을 만들어 주세요.');
    dates.push(date);
  }
  return dates;
}
export function expenseSummary(memories,month) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('월을 확인해 주세요.');
  const [year,index]=month.split('-').map(Number);
  const previousMonth=dateKey(localDate(year,index-2,1)).slice(0,7);
  const yearMonth=`${String(year-1).padStart(4,'0')}-${String(index).padStart(2,'0')}`;
  const expenses=memories.filter(item=>item.type==='expenses');
  const selected=expenses.filter(item=>item.date.startsWith(month));
  const totalFor=key=>expenses.filter(item=>item.date.startsWith(key)).reduce((sum,item)=>sum+BigInt(item.amount),0n);
  return {month,count:selected.length,total:totalFor(month),previous:totalFor(previousMonth),lastYear:totalFor(yearMonth),largest:selected.reduce((best,item)=>!best || item.amount>best.amount ? item : best,null)};
}
