export const WEATHER_REGIONS={
  seoul:{name:'서울',latitude:37.57,longitude:126.98},busan:{name:'부산',latitude:35.18,longitude:129.08},
  incheon:{name:'인천',latitude:37.46,longitude:126.71},daegu:{name:'대구',latitude:35.87,longitude:128.60},
  daejeon:{name:'대전',latitude:36.35,longitude:127.38},gwangju:{name:'광주',latitude:35.16,longitude:126.85},
  gangneung:{name:'강릉',latitude:37.75,longitude:128.88},jeju:{name:'제주',latitude:33.50,longitude:126.53}
};
export const WEATHER_SOURCE='https://open-meteo.com/en/docs/historical-weather-api';
export function weatherDescription(weather) {
  return `${weather.regionLabel} 대표 좌표 · 최저 ${weather.minimum}°C / 최고 ${weather.maximum}°C · 하루 강수량 ${weather.precipitation}mm\nOpen-Meteo ERA5 재분석 자료예요. 실제 관측 지점의 측정값이나 당시 내 위치를 의미하지 않아요.`;
}
