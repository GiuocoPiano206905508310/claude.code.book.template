// playwright はローカル/グローバルどちらのインストールでも動くように解決する
const { chromium } = await import('playwright')
  .catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const BASE = process.env.BASE || 'http://127.0.0.1:8777/line-puzzle/';
const SHOTS = process.env.SP || new URL('.', import.meta.url).pathname;
const fail = [];
function chk(cond, msg) { console.log((cond ? '  ok  ' : '  FAIL') + ' ' + msg); if (!cond) fail.push(msg); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });

console.log('\n== レベルデータ ==');
const meta = await page.evaluate(() => ({
  n: window.LEVELS.length,
  cells: window.LEVELS.map(l => l.g.join('').split('').filter(c => c === '.').length),
  sols: window.LEVELS.map(l => l.sol.length),
}));
chk(meta.n === 50, `50ステージ (実際: ${meta.n})`);
chk(meta.sols.every(s => s >= 3), '全ステージ 3手以上');
const blocks = await page.evaluate(() =>
  window.LEVELS.map(l => l.g.join('').split('').filter(c => c === '#').length));
chk(blocks.every(b => b >= 1), `全ステージにお邪魔ブロックがある (最少${Math.min(...blocks)}個)`);
chk(blocks.reduce((a, b) => a + b, 0) / blocks.length > 10,
    `ブロックが十分ある (平均${(blocks.reduce((a, b) => a + b, 0) / blocks.length).toFixed(1)}個 / 最大${Math.max(...blocks)}個)`);
console.log('   最短手数:', meta.sols.join(','));

console.log('\n== 登録不要で始められる ==');
chk(!(await page.$('#screen-login')), 'ログイン画面が存在しない');
chk(!(await page.$('#username-input')), 'ユーザー名の入力欄が存在しない');
chk(await page.isVisible('#screen-select'), '開いた直後にステージ選択が表示される');

console.log('\n== ステージ選択 ==');
const st = await page.evaluate(() => ({
  total: document.querySelectorAll('.stage-btn').length,
  locked: document.querySelectorAll('.stage-btn.is-locked').length,
}));
chk(st.total === 50, `ステージボタン50個 (${st.total})`);
chk(st.locked === 49, `未クリア時のロック49個 (${st.locked})`);

console.log('\n== 全50ステージ 自動プレイ ==');
const KEY = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' };
let allCleared = true;
for (let id = 1; id <= 50; id++) {
  await page.evaluate(i => document.querySelectorAll('.stage-btn')[i - 1].click(), id);
  await page.waitForSelector('#screen-game.is-active');
  await page.waitForTimeout(60);
  const sol = await page.evaluate(i => window.LEVELS[i - 1].sol, id);
  for (const ch of sol) {
    await page.keyboard.press(KEY[ch]);
    await page.waitForTimeout(460);   // 1手の最長アニメーション(約362ms)より長く待つ
  }
  await page.waitForFunction(() => !document.getElementById('modal-clear').hidden,
                             null, { timeout: 4000 }).catch(() => {});
  const left = await page.textContent('#stat-left');
  const clearShown = await page.isVisible('#modal-clear');
  if (left !== '0' || !clearShown) { allCleared = false; console.log(`  FAIL Level ${id}: 残り=${left} clear=${clearShown}`); }
  if (id === 1) await page.screenshot({ path: SHOTS + '/shot-clear.png' });
  await page.click('#clear-select');
  await page.waitForTimeout(120);
}
chk(allCleared, '50ステージすべて手順通りにクリアできる');
const prog = await page.textContent('#select-progress');
chk(/50 \/ 50/.test(prog), `進捗表示 "${prog}"`);
await page.screenshot({ path: SHOTS + '/shot-select-all.png' });

console.log('\n== 自動保存 / 再開 ==');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(200);
chk(await page.isVisible('#screen-select'), 'リロード後も進捗が保持される');
const lockedAfter = await page.$$eval('.stage-btn.is-locked', n => n.length);
chk(lockedAfter === 0, `クリア済みステージが解放されている (locked=${lockedAfter})`);

console.log('\n== 部分進捗の保存 ==');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(200);
for (let id = 1; id <= 3; id++) {
  await page.evaluate(i => document.querySelectorAll('.stage-btn')[i - 1].click(), id);
  await page.waitForSelector('#screen-game.is-active');
  const sol = await page.evaluate(i => window.LEVELS[i - 1].sol, id);
  for (const ch of sol) { await page.keyboard.press(KEY[ch]); await page.waitForTimeout(460); }
  await page.waitForFunction(() => !document.getElementById('modal-clear').hidden,
                             null, { timeout: 4000 });
  await page.click('#clear-select');
  await page.waitForTimeout(120);
}
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(200);
const after = await page.evaluate(() => ({
  prog: document.getElementById('select-progress').textContent,
  locked: document.querySelectorAll('.stage-btn.is-locked').length,
}));
chk(/3 \/ 50/.test(after.prog), `3ステージ分が保存されている "${after.prog}"`);
chk(after.locked === 46, `4番目まで解放 (locked=${after.locked}, 期待46)`);
await page.click('#select-continue');
await page.waitForSelector('#screen-game.is-active');
chk((await page.textContent('#level-label')) === 'Level 4', 'つづきからで Level 4 が開く');

console.log('\n== ボタン (やり直す/中断/ヒント) ==');
{
  const id = parseInt((await page.textContent('#level-label')).replace(/\D/g, ''), 10);
  const first = await page.evaluate(i => window.LEVELS[i - 1].sol[0], id);
  await page.keyboard.press(KEY[first]); await page.waitForTimeout(500);
}
const movesBefore = await page.textContent('#stat-moves');
await page.click('#btn-retry'); await page.waitForTimeout(250);
chk(movesBefore !== '0' && (await page.textContent('#stat-moves')) === '0', 'やり直すで手数がリセットされる');

await page.click('#btn-pause'); await page.waitForTimeout(200);
chk(await page.isVisible('#modal-pause'), '中断ボタンでモーダルが開く');
await page.screenshot({ path: SHOTS + '/shot-pause.png' });
await page.click('#pause-resume'); await page.waitForTimeout(150);
chk(!(await page.isVisible('#modal-pause')), 'つづけるで閉じる');

await page.click('#btn-hint'); await page.waitForTimeout(250);
chk(await page.isVisible('#hint-arrow'), 'ヒントで矢印が表示される');
chk((await page.textContent('#hint-badge')) === '1', 'ヒント使用回数が記録される');
await page.screenshot({ path: SHOTS + '/shot-hint.png' });

// 手順から外れた状態でもヒントが応答するか（詰んでいる場合は案内、解ける場合は矢印）
await page.click('#btn-retry'); await page.waitForTimeout(250);
const dirs = ['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight'];
for (const d of dirs) { await page.keyboard.press(d); await page.waitForTimeout(460); }
chk(!(await page.$('#modal-stuck')), '行き止まりの自動表示は行わない（要素そのものが無い）');
const t0 = Date.now();
await page.click('#btn-hint');
await page.waitForTimeout(400);
const hinted = await page.isVisible('#hint-arrow');
const toasted = await page.isVisible('#toast');
chk(hinted || toasted, `任意局面でヒントが必ず応答する (矢印=${hinted} 案内=${toasted})`);
chk(Date.now() - t0 < 2500, `任意局面からのヒント計算が高速 (${Date.now() - t0}ms)`);

console.log('\n== 新ルール: 通ったマスは通れない ==');
await page.click('#game-back'); await page.waitForTimeout(150);
await page.evaluate(() => document.querySelectorAll('.stage-btn:not(.is-locked)')[0].click());
await page.waitForSelector('#screen-game.is-active');
await page.waitForTimeout(150);
const firstDir = await page.evaluate(() => window.LEVELS[0].sol[0]);
const backDir = { U: 'D', D: 'U', L: 'R', R: 'L' }[firstDir];
await page.keyboard.press(KEY[firstDir]); await page.waitForTimeout(500);
const afterFirst = await page.evaluate(() => ({
  moves: document.getElementById('stat-moves').textContent,
  left: document.getElementById('stat-left').textContent,
}));
// 来た道を戻ろうとしても、そこは塗り済みなので1マスも動けない
await page.keyboard.press(KEY[backDir]); await page.waitForTimeout(500);
const afterBack = await page.evaluate(() => ({
  moves: document.getElementById('stat-moves').textContent,
  left: document.getElementById('stat-left').textContent,
}));
chk(afterFirst.moves === '1', `1手目が成立する (手数=${afterFirst.moves})`);
chk(afterBack.moves === afterFirst.moves && afterBack.left === afterFirst.left,
    `塗り済みのマスへは戻れず手数が増えない (${afterFirst.moves}手→${afterBack.moves}手)`);

console.log('\n== ボタン配置と盤面の大きさ ==');
const layout = await page.evaluate(() => {
  const act = document.querySelector('.action-btns').getBoundingClientRect();
  const frame = document.getElementById('board-frame').getBoundingClientRect();
  const area = document.querySelector('.board-area').getBoundingClientRect();
  return {
    hasPad: !!document.querySelector('.dpad'),
    actCx: act.left + act.width / 2, actBottom: act.bottom,
    frameCx: frame.left + frame.width / 2, frameCy: frame.top + frame.height / 2,
    areaCx: area.left + area.width / 2, areaCy: area.top + area.height / 2,
    frameW: frame.width, w: innerWidth, h: innerHeight,
  };
});
chk(!layout.hasPad, '十字ボタンは廃止されている');
chk(layout.actCx < layout.w / 2, `やり直す・ヒントが左下 (中心x=${Math.round(layout.actCx)} < ${Math.round(layout.w / 2)})`);
chk(layout.actBottom > layout.h * 0.8, `やり直す・ヒントが画面下部 (下端y=${Math.round(layout.actBottom)} > ${Math.round(layout.h * 0.8)})`);
chk(Math.abs(layout.frameCx - layout.areaCx) < 2 && Math.abs(layout.frameCy - layout.areaCy) < 2,
    '盤面が表示領域の中央にある');
chk(layout.frameW > layout.w * 0.82, `盤面が画面幅を活かしている (幅=${Math.round(layout.frameW)} / ${layout.w})`);

console.log('\n== スワイプ操作 ==');
await page.click('#btn-retry'); await page.waitForTimeout(300);
const before = await page.textContent('#stat-moves');
const box = await page.locator('#board').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
let swipeWorked = false;
for (const [dx, dy] of [[0, 90], [0, -90], [90, 0], [-90, 0]]) {
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(500);
  if ((await page.textContent('#stat-moves')) !== before) { swipeWorked = true; break; }
}
chk(swipeWorked, 'スワイプで移動できる（十字キーが無くても操作可能）');

console.log('\n== クリア画面の再チャレンジ ==');
await page.click('#game-back'); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelectorAll('.stage-btn:not(.is-locked)')[0].click());
await page.waitForSelector('#screen-game.is-active');
{
  const sol = await page.evaluate(() => window.LEVELS[0].sol);
  for (const ch of sol) { await page.keyboard.press(KEY[ch]); await page.waitForTimeout(460); }
  await page.waitForFunction(() => !document.getElementById('modal-clear').hidden, null, { timeout: 4000 });
  const order = await page.evaluate(() => Array.from(
    document.querySelectorAll('#modal-clear button')).map(b => b.id));
  chk(order.join(',') === 'clear-next,clear-retry,clear-select',
      `ボタン順が 次のステージへ → 再チャレンジ → ステージ選択へ (${order.join(' / ')})`);
  const label = await page.textContent('#clear-retry');
  chk(label.trim() === '再チャレンジ', `再チャレンジのラベル "${label.trim()}"`);
  await page.click('#clear-retry'); await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    level: document.getElementById('level-label').textContent,
    moves: document.getElementById('stat-moves').textContent,
    onGame: document.getElementById('screen-game').classList.contains('is-active'),
    modal: !document.getElementById('modal-clear').hidden,
  }));
  chk(after.onGame && !after.modal && after.level === 'Level 1' && after.moves === '0',
      `再チャレンジで同じステージを最初からやり直す (${after.level} / ${after.moves}手)`);
}

console.log('\n== 星の表示 ==');
await page.click('#game-back'); await page.waitForTimeout(300);
const starInfo = await page.evaluate(() => {
  const els = document.querySelectorAll('#stage-grid .stage-stars .ic');
  const on = Array.from(els).find(e => !e.classList.contains('off'));
  const off = Array.from(els).find(e => e.classList.contains('off'));
  const cs = on && getComputedStyle(on);
  const use = on && on.querySelector('use');
  return {
    count: els.length,
    allStar: Array.from(els).every(e => e.classList.contains('star')),
    color: cs && cs.color,
    useFill: use && getComputedStyle(use).fill,
    offOpacity: (function () {
      // 未獲得の星が実データに無いことがあるので、同じクラスの要素で見え方を測る
      const probe = off || (function () {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        p.setAttribute('class', 'ic star off');
        document.body.appendChild(p);
        return p;
      })();
      const op = getComputedStyle(probe).opacity;
      if (!off) probe.remove();
      return op;
    })(),
  };
});
chk(starInfo.count > 0 && starInfo.allStar, `星に star クラスが付いている (${starInfo.count}個)`);
chk(starInfo.color === 'rgb(242, 183, 5)', `星が黄色 (${starInfo.color})`);
chk(starInfo.useFill === 'rgb(242, 183, 5)', `星が塗りつぶし (fill=${starInfo.useFill})`);
chk(parseFloat(starInfo.offOpacity) < 0.5, `未獲得の星は薄く表示 (opacity=${starInfo.offOpacity})`);

console.log('\n== アイコンがモノクロか ==');
const colors = await page.evaluate(() => ['btn-retry', 'btn-pause', 'btn-hint'].map(id => {
  const s = getComputedStyle(document.getElementById(id).querySelector('.ic'));
  return { id, stroke: s.stroke, fill: s.fill, color: s.color };
}));
console.log('  ', JSON.stringify(colors));
chk(colors.every(c => c.stroke === c.color || c.stroke === 'none'), '各アイコンは currentColor 1色で描画');

console.log('\n== 全ステージのソルバー整合性 (ブラウザ内) ==');
const solverCheck = await page.evaluate(() => {
  // levels.js の sol が本当に全マス塗るか、ページ内で再検証
  // 新ルール: 壁・盤面の端・すでに塗ったマス の手前で止まる
  const D = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const bad = [];
  for (const lv of window.LEVELS) {
    const floor = new Set();
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) if (lv.g[y][x] === '.') floor.add(x + ',' + y);
    let [px, py] = lv.s;
    if (!floor.has(px + ',' + py)) { bad.push(lv.id + ':start'); continue; }
    const painted = new Set([px + ',' + py]);
    let noop = false;
    for (const ch of lv.sol) {
      const [dx, dy] = D[ch]; let steps = 0;
      for (;;) {
        const k = (px + dx) + ',' + (py + dy);
        if (!floor.has(k) || painted.has(k)) break;   // 通過済みも壁として扱う
        px += dx; py += dy; painted.add(k); steps++;
      }
      if (!steps) noop = true;
    }
    if (noop) bad.push(lv.id + ':noop');
    if (painted.size !== floor.size) bad.push(lv.id + ':incomplete');
  }
  return bad;
});
chk(solverCheck.length === 0, `解答データ検証 ${solverCheck.length ? solverCheck.join(',') : '全50件OK'}`);

await browser.close();
console.log('\n== JSエラー ==');
if (errs.length) { errs.forEach(e => console.log('  ' + e)); fail.push('JS errors'); } else console.log('  なし');
console.log(fail.length ? `\n❌ ${fail.length} 件失敗` : '\n✅ すべて成功');
process.exit(fail.length ? 1 : 0);
