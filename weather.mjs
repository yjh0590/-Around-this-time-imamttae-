import {isDateKey,dateKey,localDate} from './data.js';
import {WEATHER_REGIONS,WEATHER_SOURCE} from './weather-data.js';
export class WeatherError extends Error {constructor(message,status=502){super(message);this.status=status;}}
export function createWeatherClient({fetcher=fetch,now=()=>new Date()}={}) {
  const cache=new Map();
  async function history(date,regionId) {
    const latest=now();const cutoff=dateKey(localDate(latest.getFullYear(),latest.getMonth(),latest.getDate()-7));
    if(!isDateKey(date) || date<'1940-01-01' || date>cutoff || typeof regionId!=='string' || !Object.hasOwn(WEATHER_REGIONS,regionId)) throw new WeatherError('지역과 날짜를 확인해 주세요. 1940년부터 7일 전까지 조회할 수 있어요.',400);
    const key=`${date}:${regionId}`;const cached=cache.get(key);
    if(cached && Date.now()-cached.time<86400000) return cached.value;
    const region=WEATHER_REGIONS[regionId];
    const url=new URL('https://archive-api.open-meteo.com/v1/archive');
    for(const [key,value] of Object.entries({latitude:region.latitude,longitude:region.longitude,start_date:date,end_date:date,daily:'temperature_2m_max,temperature_2m_min,precipitation_sum',timezone:'Asia/Seoul',models:'era5'})) url.searchParams.set(key,String(value));
    let response;
    try {response=await fetcher(url.href,{signal:AbortSignal.timeout(12000),redirect:'manual'});} catch {throw new WeatherError('날씨 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');}
    if(!response.ok) throw new WeatherError('날씨 서비스가 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    const reader=response.body?.getReader();if(!reader) throw new WeatherError('날씨 자료가 비어 있어요.');
    const chunks=[];let size=0;
    try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw new WeatherError('날씨 응답이 예상보다 커요.');}chunks.push(value);}}
    catch(problem){if(problem instanceof WeatherError)throw problem;throw new WeatherError('날씨 자료를 읽는 중 연결이 끊겼어요.');}finally{reader.releaseLock();}
    let data;try {data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new WeatherError('날씨 자료 형식을 확인하지 못했어요.');}
    const minimum=data.daily?.temperature_2m_min?.[0],maximum=data.daily?.temperature_2m_max?.[0],precipitation=data.daily?.precipitation_sum?.[0];
    if(data.daily?.time?.[0]!==date || ![minimum,maximum,precipitation].every(value=>typeof value==='number' && Number.isFinite(value)) || minimum>maximum || precipitation<0 || data.daily_units?.temperature_2m_min!=='°C' || data.daily_units?.temperature_2m_max!=='°C' || data.daily_units?.precipitation_sum!=='mm') throw new WeatherError('해당 날짜의 날씨 자료가 없거나 단위를 확인하지 못했어요.');
    const value={date,regionId,regionLabel:region.name,minimum,maximum,precipitation,sourceUrl:WEATHER_SOURCE};
    if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),value});
    return value;
  }
  return {history};
}
