// Logical portrait viewports derived from the manufacturer display dimensions / 3.
// Device frames and safe areas are visual approximations, not OS emulation.
export const DEVICES = {
  iphone16: {name:'iPhone 16',width:393,height:852,top:59,bottom:34,family:'iphone',source:'https://support.apple.com/en-gb/121029'},
  iphone16pro: {name:'iPhone 16 Pro',width:402,height:874,top:62,bottom:34,family:'iphone',source:'https://support.apple.com/en-us/121031'},
  galaxys24: {name:'Galaxy S24',width:360,height:780,top:32,bottom:24,family:'galaxy',source:'https://images.samsung.com/is/content/samsung/assets/jp/explore/news/galaxy-s24-launch/NewsRelease_galaxy-s24-launch_240403_v3.pdf'}
};
export function previewOptions(search) {
  const params=new URLSearchParams(search);
  const device=params.get('previewDevice');
  if(!Object.hasOwn(DEVICES,device)) return null;
  const month=Number(params.get('previewMonth'));
  return {device,month:Number.isInteger(month) && month>=1 && month<=12 ? month : null};
}
