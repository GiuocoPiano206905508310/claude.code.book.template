/* 深海迷路: 全50ステージが本当にクリアできるかを、本番のコードで確かめる。

   使い方(リポジトリのルートで簡易サーバーを立ててから):
     python3 -m http.server 8777 &
     PW_CHROMIUM=/opt/pw-browsers/chromium node line-puzzle/tools/dsm-clearable.mjs

   ・通れる／通れないは実行時の isPassable() をそのまま呼ぶ
   ・ウニの当たる半径は checkEnemyHit() を二分探索して実測する
     (テスト側に式を書き写すと、本番とずれても気づけないため。
      複数のウニが同じ向きに並ぶと二分探索が誤るので、1体ずつ測る)
   ・ゴール判定も本番と同じ式を使う
   ・泳ぐ敵は動きつづけるので、通行可否の判定からは外す

   dsm-levels.js を作り直したら必ず流してください。 */
// playwright はローカル/グローバルどちらのインストールでも動くように解決する
const { chromium } = await import('playwright')
  .catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const BASE = process.env.BASE || 'http://127.0.0.1:8777/line-puzzle/';
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(BASE + 'index.html?dsmdebug=1', { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.locator('#play-guest').click(); await page.waitForTimeout(150);
await page.locator('#choose-deep-sea-maze').click(); await page.waitForTimeout(150);
await page.evaluate(() => { const c = {}; for (let i = 1; i <= 49; i++) c[i] = true;
  window.LinePuzzleGame.saveDeepSeaMaze({ cleared: c, lastStage: 1 }); });

let bad = 0;
const results = [];
for (let sid = 1; sid <= 50; sid++) {
  await page.evaluate(() => window.DeepSeaMaze.openSelect()); await page.waitForTimeout(120);
  await page.evaluate((i) => document.querySelectorAll('#dsm-stage-grid .stage-btn')[i].click(), sid - 1);
  await page.waitForTimeout(220);
  const r = await page.evaluate(() => {
    const dbg = window.DeepSeaMaze.debug, g = dbg.getGame();
    g.paused = true;
    g.swimmers.length = 0;              // 泳ぐ敵は動くので、通行可否の判定からは外す
    const st = g.stage, CELL = 3;
    const sx = st.startPosition.x, sy = st.startPosition.y;

    // ウニの「当たる半径」を本番の判定から実測する(船の中心が入れない距離)
    const urchins = (st.enemies && st.enemies.urchins) || [];
    // 二分探索は「遠いほど当たらない」前提なので、他のウニが同じ向きに
    // 並んでいると誤った値を拾う。1体だけ残して測り、あとで戻す。
    const hitR = urchins.map((u) => {
      st.enemies.urchins = [u];
      let lo = 0, hi = 400;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        dbg.warpTo(u.x + mid, u.y);
        if (dbg.enemyHit()) lo = mid; else hi = mid;
      }
      return hi;
    });
    st.enemies.urchins = urchins;
    const onUrchin = (x, y) => {
      for (let i = 0; i < urchins.length; i++) {
        const u = urchins[i];
        if (Math.hypot(x - u.x, y - u.y) <= hitR[i]) return true;
      }
      return false;
    };

    const W = Math.ceil(st.mazeBounds.width / CELL) + 4;
    const H = Math.ceil(st.mazeBounds.height / CELL) + 4;
    const seen = new Uint8Array(W * H);
    const si = Math.round(sx / CELL), sj = Math.round(sy / CELL);
    const startOK = dbg.isPassable(sx, sy) && !onUrchin(sx, sy);
    // ゴール判定は本番と同じ式
    const goalOK = (x, y) => Math.hypot(x - st.goalPosition.x, y - st.goalPosition.y) <= st.goalRadius - st.shipSize * 0.3;

    const q = [si * H + sj];
    seen[si * H + sj] = 1;
    let reached = false, visited = 0, nearest = Infinity;
    const N4 = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = (k / H) | 0, j = k % H;
      const x = i * CELL, y = j * CELL;
      visited++;
      const dg = Math.hypot(x - st.goalPosition.x, y - st.goalPosition.y);
      if (dg < nearest) nearest = dg;
      if (goalOK(x, y)) { reached = true; break; }
      for (const [di, dj] of N4) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nk = ni * H + nj;
        if (seen[nk]) continue;
        seen[nk] = 1;
        const nx = ni * CELL, ny = nj * CELL;
        if (!dbg.isPassable(nx, ny)) continue;
        if (onUrchin(nx, ny)) continue;
        q.push(nk);
      }
    }
    return { stageId: st.stageId, reached, startOK, visited,
      urchins: urchins.length, hitR: hitR.map((v) => +v.toFixed(1)),
      nearest: +nearest.toFixed(1), goalRadius: st.goalRadius, shipSize: st.shipSize };
  });
  results.push(r);
  const ok = r.reached && r.startOK;
  if (!ok) bad++;
  const mark = ok ? 'OK ' : '★NG';
  console.log(`${mark} stage ${String(r.stageId).padStart(2)}  START可=${r.startOK ? 'はい' : 'いいえ'}  ゴール到達=${r.reached ? 'はい' : 'いいえ'}  ウニ${r.urchins}体(当たる半径 ${r.hitR.join('/')})  到達セル${r.visited}  ゴールまで最短${r.nearest}`);
}
console.log('');
console.log(bad === 0 ? `全50ステージ クリア可能を確認` : `★ ${bad} ステージが到達不能`);
console.log('errors:', JSON.stringify(errors));
await browser.close();
process.exit(bad === 0 ? 0 : 1);
