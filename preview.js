import {DEVICES} from './devices.js';
const device=document.querySelector('#device');
const season=document.querySelector('#season');
const zoom=document.querySelector('#zoom');
const phone=document.querySelector('#phone');
const slot=document.querySelector('#phone-slot');
const stage=document.querySelector('#stage');
const frame=document.querySelector('#app-preview');
const params=new URLSearchParams(location.search);
if(Object.hasOwn(DEVICES,params.get('device'))) device.value=params.get('device');
if(['1','4','7','10'].includes(params.get('month'))) season.value=params.get('month');
function resize() {
  const model=DEVICES[device.value];
  const edge=model.family==='galaxy' ? 20 : 24;
  const width=model.width+edge,height=model.height+edge;
  const style=getComputedStyle(stage);
  const availableWidth=stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const availableHeight=stage.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const scale=zoom.value==='actual' ? 1 : Math.max(.15,Math.min(1,availableWidth/width,availableHeight/height));
  phone.style.transform=`scale(${scale})`;
  slot.style.width=`${width*scale}px`;slot.style.height=`${height*scale}px`;
  document.querySelector('#device-info').textContent=`${model.width} × ${model.height} · ${Math.round(scale*100)}%`;
}
function update() {
  const model=DEVICES[device.value];
  phone.dataset.family=model.family;
  phone.style.setProperty('--screen-width',`${model.width}px`);
  phone.style.setProperty('--screen-height',`${model.height}px`);
  const hash=frame.contentWindow?.location.hash || '#today';
  const query=new URLSearchParams({previewDevice:device.value,previewMonth:season.value || String(new Date().getMonth()+1)});
  frame.title=`${model.name}에서 이맘때 미리보기`;
  frame.src=`/?${query}${hash}`;
  const url=new URL(location.href);url.searchParams.set('device',device.value);
  if(season.value) url.searchParams.set('month',season.value);else url.searchParams.delete('month');
  history.replaceState(null,'',url);
  resize();
}
device.addEventListener('change',update);season.addEventListener('change',update);
zoom.addEventListener('change',resize);new ResizeObserver(resize).observe(stage);
update();
