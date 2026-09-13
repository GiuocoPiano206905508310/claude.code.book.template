/* 深海迷路: 中断/再開と、スマホのダブルタップ拡大の防止を確かめる。

   使い方(リポジトリのルートで簡易サーバーを立ててから):
     python3 -m http.server 8777 &
     PW_CHROMIUM=/opt/pw-browsers/chromium node line-puzzle/tools/dsm-interrupt-test.mjs

   ・別アプリ/別タブへ切り替えると「中断中」になり、つづけるで再開できるか
   ・同じ場所の連打でブラウザの拡大が起きないか
   ・その対策でボタンの連打が効かなくなっていないか
*/
const { chromium } = await import('playwright')
  .catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const BASE = process.env.BASE || 'http://127.0.0.1:8777/line-puzzle/';
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; console.log('PASS - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); } };

await page.goto(BASE + 'index.html?dsmdebug=1', { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.locator('#play-guest').click(); await page.waitForTimeout(150);
await page.locator('#choose-deep-sea-maze').click(); await page.waitForTimeout(150);
await page.evaluate(() => document.querySelectorAll('#dsm-stage-grid .stage-btn')[0].click());
await page.waitForTimeout(400);

// --- 1. window の blur(別アプリへ切り替え) ---
let st = await page.evaluate(() => {
  window.dispatchEvent(new Event('blur'));
  const g = window.DeepSeaMaze.debug.getGame();
  return { paused: g.paused, modal: !document.getElementById('modal-dsm-pause').hidden };
});
ok(st.paused && st.modal, '別アプリへ切り替えると中断中のポーズ画面が出る', st);

// --- 2. 「つづける」で再開する ---
st = await page.evaluate(() => {
  document.getElementById('dsm-pause-resume').click();
  const g = window.DeepSeaMaze.debug.getGame();
  return { paused: g.paused, modal: !document.getElementById('modal-dsm-pause').hidden };
});
ok(!st.paused && !st.modal, '「つづける」で再開する', st);

// --- 3. 再開後に船が動く(固まっていない) ---
st = await page.evaluate(async () => {
  const g = window.DeepSeaMaze.debug.getGame();
  const before = { x: g.ship.x, y: g.ship.y };
  window.DeepSeaMaze.debug.simulateMove(1, 0);
  await new Promise(r => requestAnimationFrame(r));
  return { before, after: { x: g.ship.x, y: g.ship.y } };
});
ok(st.before.x !== st.after.x || st.before.y !== st.after.y, '再開後は船が動く', st);

// --- 4. visibilitychange(タブを隠す)でも中断中になる ---
st = await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  const g = window.DeepSeaMaze.debug.getGame();
  return { paused: g.paused, modal: !document.getElementById('modal-dsm-pause').hidden };
});
ok(st.paused && st.modal, 'タブを隠しても中断中のポーズ画面が出る', st);
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  document.getElementById('dsm-pause-resume').click();
});

// --- 5. 同じ場所を素早く2回叩くと、2回目は既定動作(拡大)が止まる ---
st = await page.evaluate(() => {
  const el = document.getElementById('dsm-stick-knob');
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const tap = (cx, cy) => {
    const t = new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
    const ev = new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [t] });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const first = tap(x, y);
  const second = tap(x, y);
  return { first, second };
});
ok(st.first === false && st.second === true, '同じ場所の連続タップは2回目を止める(拡大しない)', st);

// --- 6. 離れた場所のタップは止めない(別々のボタン操作を壊さない) ---
st = await page.evaluate(() => {
  const el = document.getElementById('dsm-stick-knob');
  const r = el.getBoundingClientRect();
  const tap = (cx, cy) => {
    const t = new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
    const ev = new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [t] });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  tap(r.left, r.top);
  return { far: tap(r.left + 200, r.top + 200) };
});
ok(st.far === false, '離れた場所の連続タップは止めない', st);

// --- 7. クリア演出が出ているときは中断のポーズ画面を割り込ませない ---
st = await page.evaluate(() => {
  const g = window.DeepSeaMaze.debug.getGame();
  g.paused = false;
  document.getElementById('modal-dsm-clear').hidden = false;
  window.dispatchEvent(new Event('blur'));
  const r = { pauseModal: !document.getElementById('modal-dsm-pause').hidden };
  document.getElementById('modal-dsm-clear').hidden = true;
  return r;
});
ok(!st.pauseModal, 'クリア演出中は中断のポーズ画面を出さない', st);

// --- 8. ボタンの上では止めない(連打が効かなくなるのを防ぐ) ---
st = await page.evaluate(() => {
  const el = document.getElementById('dsm-pause-btn');
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const tap = () => {
    const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const ev = new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [t] });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  tap();
  return { second: tap(), touchAction: getComputedStyle(el).touchAction };
});
ok(st.second === false && st.touchAction === 'manipulation',
  'ボタンの連打は止めない(拡大はCSSで防ぐ)', st);

// --- 9. ブロックフィットの「回転」ボタンは連打しても効き続ける ---
st = await page.evaluate(async () => {
  document.getElementById('dsm-back').click();
  await new Promise(r => setTimeout(r, 150));
  document.getElementById('dsm-select-back').click();
  await new Promise(r => setTimeout(r, 150));
  document.getElementById('choose-block-fit').click();
  await new Promise(r => setTimeout(r, 250));
  document.querySelectorAll('#bf-stage-grid .stage-btn')[0].click();
  await new Promise(r => setTimeout(r, 300));
  const btn = document.getElementById('bf-rotate');
  // ピースを選ぶまでは押せないボタンなので、連打の検証のために開けておく
  btn.disabled = false;
  const r = btn.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  let clicks = 0;
  btn.addEventListener('click', () => { clicks++; });
  for (let i = 0; i < 3; i++) {
    const t = new Touch({ identifier: 1, target: btn, clientX: x, clientY: y });
    const ev = new TouchEvent('touchend', { bubbles: true, cancelable: true, changedTouches: [t] });
    btn.dispatchEvent(ev);
    if (!ev.defaultPrevented) btn.click();
  }
  return { clicks, prevented: false };
});
ok(st.clicks === 3, '回転ボタンは素早く3回叩いても3回とも効く', st);

console.log('\n' + pass + '/' + (pass + fail) + ' passed');
console.log('errors:', JSON.stringify(errors));
await browser.close();
process.exit(fail ? 1 : 0);
