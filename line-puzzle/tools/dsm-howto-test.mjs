/* 深海迷路: 遊び方(画面写真つきのポップアップ)の動きを確かめる。

   使い方(リポジトリのルートで簡易サーバーを立ててから):
     python3 -m http.server 8777 &
     PW_CHROMIUM=/opt/pw-browsers/chromium node line-puzzle/tools/dsm-howto-test.mjs

   ・深海1マイルを初めて開いたときだけ自動で出るか
   ・画面写真が4枚とも読めているか
   ・最後の1枚で OK になり、閉じるとゲームが再開するか
   ・2回目は自動で出ず、「?」からはいつでも開けるか
*/
const { chromium } = await import('playwright')
  .catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const b = await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
const p = await b.newPage({ viewport:{width:390,height:844}, hasTouch:true });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
let pass=0,fail=0; const ok=(c,n,x)=>{c?(pass++,console.log('PASS - '+n)):(fail++,console.log('FAIL - '+n+(x!==undefined?' :: '+JSON.stringify(x):'')));};
await p.goto((process.env.BASE || 'http://127.0.0.1:8777/line-puzzle/') + 'index.html?dsmdebug=1',{waitUntil:'load'});
await p.waitForTimeout(300);
await p.locator('#play-guest').click(); await p.waitForTimeout(150);
await p.locator('#choose-deep-sea-maze').click(); await p.waitForTimeout(200);
await p.evaluate(()=>document.querySelectorAll('#dsm-stage-grid .stage-btn')[0].click());
await p.waitForTimeout(700);
let st = await p.evaluate(()=>({open:!document.getElementById('modal-dsm-help').hidden,
  paused:window.DeepSeaMaze.debug.getGame().paused,
  label:document.getElementById('dsm-tut-steplabel').textContent}));
ok(st.open && st.paused, '深海1マイルを初めて開くと遊び方が出て、ゲームは止まる', st);
ok(/STEP 1 \/ 4/.test(st.label), 'STEP 1 から始まる', st);

// 画像が4枚とも読めているか
const imgs = await p.evaluate(()=>[...document.querySelectorAll('#modal-dsm-help .dsm-tut-shot')]
  .map(i=>({src:i.getAttribute('src'), w:i.naturalWidth})));
ok(imgs.length===4 && imgs.every(i=>i.w>0), '画面写真が4枚とも読み込めている', imgs);

// 最後まで送ると OK ボタンになる
for (let i=0;i<3;i++){ await p.locator('#dsm-tut-next').click(); await p.waitForTimeout(120); }
st = await p.evaluate(()=>({txt:document.getElementById('dsm-tut-next').textContent,
  label:document.getElementById('dsm-tut-steplabel').textContent}));
ok(st.txt==='OK' && /STEP 4 \/ 4/.test(st.label), '4枚目で OK ボタンになる', st);

await p.locator('#dsm-tut-next').click(); await p.waitForTimeout(200);
st = await p.evaluate(()=>({open:!document.getElementById('modal-dsm-help').hidden,
  paused:window.DeepSeaMaze.debug.getGame().paused}));
ok(!st.open && !st.paused, 'OK で閉じてゲームが再開する', st);

// 2回目は自動で出ない
await p.evaluate(()=>window.DeepSeaMaze.openSelect()); await p.waitForTimeout(200);
await p.evaluate(()=>document.querySelectorAll('#dsm-stage-grid .stage-btn')[0].click());
await p.waitForTimeout(600);
st = await p.evaluate(()=>({open:!document.getElementById('modal-dsm-help').hidden}));
ok(!st.open, '2回目は自動で出ない', st);

// 「?」ボタンからはいつでも開ける
await p.locator('#dsm-help').click(); await p.waitForTimeout(200);
st = await p.evaluate(()=>({open:!document.getElementById('modal-dsm-help').hidden,
  paused:window.DeepSeaMaze.debug.getGame().paused,
  label:document.getElementById('dsm-tut-steplabel').textContent}));
ok(st.open && st.paused && /STEP 1 \/ 4/.test(st.label), '「?」から1枚目を開ける', st);
console.log('\n'+pass+'/'+(pass+fail)+' passed'); console.log('errors:',JSON.stringify(errs));
await b.close(); process.exit(fail?1:0);
