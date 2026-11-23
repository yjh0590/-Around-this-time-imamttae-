import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';

// No browser-test dependency: Chrome DevTools Protocol over Node's WebSocket.
const browserPath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const output = path.resolve('test-results');
await mkdir(output, { recursive:true });
const profile = await mkdtemp(path.join(output, 'browser-profile-'));
const server = createServer();
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = spawn(browserPath, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`, 'about:blank'], { windowsHide:true, stdio:['ignore','ignore','pipe'] });
let socket;
let id = 0;
const pending = new Map();
const errors = [];
try {
  const endpoint = await new Promise((resolve,reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('Chrome did not start within 20 seconds')),20000);
    browser.on('error', error => { clearTimeout(timeout); reject(error); });
    browser.stderr.on('data', chunk => { buffer += chunk; const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    browser.on('exit', code => { clearTimeout(timeout); reject(new Error(`Chrome exited: ${code}`)); });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve,reject) => { socket.addEventListener('open',resolve,{once:true}); socket.addEventListener('error',reject,{once:true}); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) { const {resolve,reject,timer} = pending.get(message.id); clearTimeout(timer); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
  });
  const send = (method,params={},sessionId) => new Promise((resolve,reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); },10000);
    pending.set(key,{resolve,reject,timer}); socket.send(JSON.stringify({id:key,method,params,...(sessionId ? {sessionId} : {})}));
  });
  const {targetId} = await send('Target.createTarget',{url:'about:blank'});
  const {sessionId} = await send('Target.attachToTarget',{targetId,flatten:true});
  const cdp = (method,params) => send(method,params,sessionId);
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async expression => {
    const started = Date.now();
    while (Date.now()-started < 8000) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve,80)); }
    throw new Error(`Timed out: ${expression}`);
  };
  await cdp('Page.navigate',{url:origin});
  await waitFor("document.querySelector('.mascot') && document.querySelector('.bottom-nav a')");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'mobile horizontal overflow');
  await evaluate("document.fonts.ready.then(() => new Promise(resolve => { const image=new Image(); image.src='assets/seasonal-companion.png'; image.decode().then(resolve); }))");
  const initial = await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(path.join(output,'home-current.png'),Buffer.from(initial.data,'base64'));
  await evaluate("document.querySelector('[data-add-task]').click()");
  await evaluate("document.querySelector('#task-title').value = '브라우저 검증 할 일'; document.querySelector('#task-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelector('.task-title').textContent"),'브라우저 검증 할 일');
  await evaluate("document.querySelector('[data-toggle]').click()");
  assert.equal(await evaluate("document.querySelector('[data-toggle]').getAttribute('aria-pressed')"),'true');
  await evaluate("document.querySelector('[data-add-record]').click()");
  await evaluate("document.querySelector('#record-text').value = '<img src=x onerror=alert(1)> 계절 기록'; document.querySelector('#record-form').requestSubmit(); location.hash = 'records'");
  await waitFor("document.querySelector('.record-card')");
  assert.equal(await evaluate("document.querySelector('.record-card p').textContent"),'<img src=x onerror=alert(1)> 계절 기록');
  assert.equal(await evaluate("document.querySelector('.record-card img')"),null,'record text must not become HTML');
  await cdp('Page.reload');
  await waitFor("document.querySelector('.record-card')");
  assert.equal(await evaluate("document.querySelectorAll('.record-card').length"),1,'record persists on reload');
  await evaluate("location.hash = 'calendar'");
  await waitFor("document.querySelector('.calendar-grid')");
  assert.equal(await evaluate("document.querySelector('[data-toggle]').getAttribute('aria-pressed')"),'true','task completion persists');
  await evaluate("document.querySelector('[data-calendar-move=\"1\"]').click(); document.querySelector('[data-date]').click(); document.querySelector('[data-add-task]').click(); document.querySelector('#task-title').value='다음 달 일정'; document.querySelector('#task-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelector('.task-title').textContent"),'다음 달 일정');
  await evaluate("location.hash = 'today'");
  await waitFor("document.querySelector('.mascot')");
  for (const [month,season] of [[4,'봄'],[7,'여름'],[10,'가을'],[1,'겨울']]) {
    await evaluate(`document.querySelector('#settings-button').click(); document.querySelector('#month-select').value='${month}'; document.querySelector('#month-select').dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('[data-close]').click()`);
    assert.ok((await evaluate("document.querySelector('h1').textContent")).includes(season));
    await evaluate("document.fonts.ready.then(() => new Promise(resolve => { const image=new Image(); image.src='assets/seasonal-companion.png'; image.decode().then(resolve); }))");
    await evaluate("document.querySelector('#toast').classList.remove('visible')");
    const image = await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(path.join(output,`mobile-${month}.png`),Buffer.from(image.data,'base64'));
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  const desktop = await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(path.join(output,'desktop.png'),Buffer.from(desktop.data,'base64'));
  await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
  for (const destination of ['today','calendar','records']) {
    await evaluate(`location.hash='${destination}'`);
    await waitFor(`document.querySelector('.nav-item[aria-current="page"]').getAttribute('href') === '#${destination}'`);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`320px overflow on ${destination}`);
  }
  assert.deepEqual(errors,[],'uncaught browser exceptions');
  console.log('PASS: mobile layout, tasks, completion, records, XSS escaping, persistence, calendar, four seasonal themes. Screenshots: test-results/');
} finally {
  socket?.close();
  browser.kill();
  for (const item of pending.values()) clearTimeout(item.timer);
  await new Promise(resolve => server.close(resolve));
}
