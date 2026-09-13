/* 深海迷路: スタート地点で敵に当たったときに、やり直しが連鎖しないか。

   使い方(リポジトリのルートで簡易サーバーを立ててから):
     python3 -m http.server 8777 &
     PW_CHROMIUM=/opt/pw-browsers/chromium node line-puzzle/tools/dsm-respawn-test.mjs

   ライトに寄ってきた魚は船に貼りつく。その状態で当たるとスタートに戻る
   が、魚もスタート地点に居るため戻った瞬間にまた当たる……を毎フレーム
   繰り返し、操作を受け付けないまま画面が固まったように見えていた。

   ここでは「魚がスタート地点に貼りついた状態」を作り、そこから船が
   動き出せることを確かめる。直す前はこのテストで移動距離が0になる。 */
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
await page.evaluate(() => { const c = {}; for (let i = 1; i <= 49; i++) c[i] = true;
  window.LinePuzzleGame.saveDeepSeaMaze({ cleared: c, lastStage: 1 }); });
await page.evaluate(() => window.DeepSeaMaze.openSelect()); await page.waitForTimeout(150);
// 泳ぐ敵が居るステージ(深海15マイル)で試す
await page.evaluate(() => document.querySelectorAll('#dsm-stage-grid .stage-btn')[14].click());
await page.waitForTimeout(600);

const r = await page.evaluate(async () => {
  const dbg = window.DeepSeaMaze.debug, g = dbg.getGame();
  const sx = g.stage.startPosition.x, sy = g.stage.startPosition.y;
  // 実際に起きている形をそのまま作る: ライトに寄ってきた魚が
  // スタート地点(＝船が戻る場所)に貼りついている状態
  const sw = g.swimmers[0];
  sw._x = sx; sw._y = sy; sw._attracted = true;
  g.ship.x = sx; g.ship.y = sy; g.invulnUntil = 0; g.resetCount = 0;

  // 壁に突き当たらないよう、スタート時の向き(と、その逆・上下左右)へ動かす
  const a = g.stage.startAngle * Math.PI / 180;
  const dirs = [[Math.cos(a), Math.sin(a)], [-Math.cos(a), -Math.sin(a)],
                [1, 0], [-1, 0], [0, 1], [0, -1]];
  let maxDist = 0, snapBacks = 0, prev = 0;
  for (let i = 0; i < 120; i++) {
    for (const [dx, dy] of dirs) {
      const bx = g.ship.x, by = g.ship.y;
      dbg.simulateMove(dx * 6, dy * 6);
      if (Math.hypot(g.ship.x - bx, g.ship.y - by) > 0.5) break;
    }
    await new Promise(res => requestAnimationFrame(res));
    const d = Math.hypot(g.ship.x - sx, g.ship.y - sy);
    if (prev > 5 && d < 1) snapBacks++;      // スタートへ引き戻された回数
    prev = d;
    maxDist = Math.max(maxDist, d);
  }
  return { maxDist: Math.round(maxDist), snapBacks, resets: g.resetCount,
           swimmerDist: Math.round(Math.hypot(sw._x - sx, sw._y - sy)) };
});

ok(r.maxDist > 100, 'スタートに魚が居ても船が動き出せる', r);
ok(r.snapBacks <= 2, 'やり直しが毎フレーム連鎖しない', r);
ok(r.swimmerDist > 50, '戻った直後は魚が寄ってこない(巡回に戻る)', r);

console.log('\n' + pass + '/' + (pass + fail) + ' passed');
console.log('errors:', JSON.stringify(errors));
await browser.close();
process.exit(fail ? 1 : 0);
