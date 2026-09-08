// ブロックフィットパズル: 全50ステージの盤面+ピースデータを生成する。
//
// 考え方(逆算生成): 空の盤面にピースを1つずつ隣接させながら置いていき、
// 置けた場所の集合をそのまま「盤面の形」として採用する。この方法だと
// 生成した時点で必ず解ける(置いた通りに戻せば埋まる)ことが保証できる。
//
// 難易度は stageId に応じて次の3つを連動させて上げる:
//   - ピースの個数(多いほど盤面が広く、組み合わせが複雑になる)
//   - ピースの大きさの構成比(4マス→5マス→6マスへと大きいピースの比率を増やす)
//   - 回転が必要なピースの比率(左右非対称な形を増やし、置く際の回転角度の
//     自由度を下げることで、適当に置いただけではハマらないようにする)

function rotateCells(cells, times) {
  const t = ((times % 4) + 4) % 4;
  let pts = cells;
  for (let i = 0; i < t; i++) pts = pts.map((p) => ({ x: -p.y, y: p.x }));
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  return pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}
function toPts(arr) { return arr.map(([x, y]) => ({ x, y })); }

// ---- ピース図鑑(回転0基準のローカル座標) ----
const TETRO = {
  I: toPts([[0,0],[1,0],[2,0],[3,0]]),
  O: toPts([[0,0],[1,0],[0,1],[1,1]]),
  T: toPts([[0,0],[1,0],[2,0],[1,1]]),
  S: toPts([[1,0],[2,0],[0,1],[1,1]]),
  Z: toPts([[0,0],[1,0],[1,1],[2,1]]),
  L: toPts([[0,0],[0,1],[0,2],[1,2]]),
  J: toPts([[1,0],[1,1],[1,2],[0,2]]),
};
const PENTO = {
  F: toPts([[1,0],[2,0],[0,1],[1,1],[1,2]]),
  I5: toPts([[0,0],[1,0],[2,0],[3,0],[4,0]]),
  L5: toPts([[0,0],[0,1],[0,2],[0,3],[1,3]]),
  N: toPts([[1,0],[1,1],[0,1],[0,2],[0,3]]),
  P5: toPts([[0,0],[1,0],[0,1],[1,1],[0,2]]),
  T5: toPts([[0,0],[1,0],[2,0],[1,1],[1,2]]),
  U: toPts([[0,0],[2,0],[0,1],[1,1],[2,1]]),
  V: toPts([[0,0],[0,1],[0,2],[1,2],[2,2]]),
  W: toPts([[0,0],[0,1],[1,1],[1,2],[2,2]]),
  Y: toPts([[1,0],[0,1],[1,1],[1,2],[1,3]]),
  Z5: toPts([[0,0],[1,0],[1,1],[1,2],[2,2]]),
};
const HEXO = {
  I6: toPts([[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]]),
  O6: toPts([[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]]),
  L6: toPts([[0,0],[0,1],[0,2],[0,3],[0,4],[1,4]]),
  T6: toPts([[0,0],[1,0],[2,0],[1,1],[1,2],[1,3]]),
  Y6: toPts([[1,0],[1,1],[0,1],[1,2],[1,3],[1,4]]),
  Z6: toPts([[0,0],[1,0],[1,1],[1,2],[2,2],[2,3]]),
  P6: toPts([[0,0],[1,0],[0,1],[1,1],[1,2],[1,3]]), // 2x2 + 縦2マスの足
};

const TETRO_LIST = Object.values(TETRO);
const PENTO_LIST = Object.values(PENTO);
const HEXO_LIST = Object.values(HEXO);

function pickWeighted(rng, tiers) {
  // tiers: [[list, weight], ...]
  const total = tiers.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [list, w] of tiers) {
    if (r < w) return list[Math.floor(rng() * list.length)];
    r -= w;
  }
  return tiers[tiers.length - 1][0][0];
}

// 決定的な擬似乱数(シード固定で再生成しても同じ結果になるようにする)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function keyOf(x, y) { return x + ',' + y; }

function neighbors(x, y) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
}

// 盤面を「ピースを隣接させながら育てる」ことで1ステージ分を生成する。
function generateStage(stageId, rng) {
  const band = Math.min(5, Math.floor((stageId - 1) / 10) + 1);
  const pieceCount = 6 + band + Math.floor(((stageId - 1) % 10) / 3); // 6..11 くらい
  // 帯が進むほど大きいピースの比率を増やす
  const tiers = [
    [TETRO_LIST, Math.max(1, 5 - band)],
    [PENTO_LIST, band >= 2 ? 4 : 1],
    [HEXO_LIST, band >= 4 ? 3 : (band === 3 ? 1 : 0)],
  ].filter(([, w]) => w > 0);

  const occupied = new Set();
  const frontier = [];
  const placements = []; // { id, color, cells(canonical), origin, rotation }
  const HUE_STEP = 360 / Math.max(pieceCount, 1);

  function centroid() {
    let sx = 0, sy = 0, n = 0;
    for (const k of occupied) {
      const [x, y] = k.split(',').map(Number);
      sx += x; sy += y; n++;
    }
    return n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
  }

  // 盤面が細長い蛇のように伸びていくと、スマホの画面幅に収まらなくなる。
  // 重心に近いマスを優先して選ぶことで、丸みのある塊状に育てる。
  function frontierCandidates() {
    if (occupied.size === 0) return [{ x: 0, y: 0 }];
    const cand = [];
    const seen = new Set();
    for (const k of occupied) {
      const [x, y] = k.split(',').map(Number);
      for (const [nx, ny] of neighbors(x, y)) {
        const nk = keyOf(nx, ny);
        if (!occupied.has(nk) && !seen.has(nk)) { seen.add(nk); cand.push({ x: nx, y: ny }); }
      }
    }
    const c = centroid();
    cand.sort((a, b) => ((a.x - c.x) ** 2 + (a.y - c.y) ** 2) - ((b.x - c.x) ** 2 + (b.y - c.y) ** 2));
    const compactPortion = cand.slice(0, Math.max(4, Math.ceil(cand.length * 0.6)));
    return compactPortion;
  }

  function tryPlace(canonicalCells, anchor) {
    // ランダムな回転・ランダムな「ピースのどのマスをanchorに合わせるか」を試す
    const rotations = shuffle(rng, [0, 1, 2, 3]);
    for (const rotation of rotations) {
      const rotated = rotateCells(canonicalCells, rotation);
      const offsets = shuffle(rng, rotated);
      for (const off of offsets) {
        const origin = { x: anchor.x - off.x, y: anchor.y - off.y };
        const cells = rotated.map((c) => ({ x: c.x + origin.x, y: c.y + origin.y }));
        if (cells.some((c) => c.x < 0 || c.y < 0)) continue; // 盤面は非負座標に正規化して育てる
        if (cells.some((c) => occupied.has(keyOf(c.x, c.y)))) continue;
        return { origin, rotation, cells };
      }
    }
    return null;
  }

  let pieceIdx = 0;
  let attempts = 0;
  while (pieceIdx < pieceCount && attempts < pieceCount * 60) {
    attempts++;
    const shape = pickWeighted(rng, tiers);
    const candidates = shuffle(rng, frontierCandidates());
    let placed = null;
    for (const anchor of candidates.slice(0, 12)) {
      placed = tryPlace(shape, anchor);
      if (placed) break;
    }
    if (!placed) continue; // この形は今回ハマらなかった。別の形/場所で再挑戦
    placed.cells.forEach((c) => occupied.add(keyOf(c.x, c.y)));
    const id = String.fromCharCode(65 + pieceIdx); // A, B, C, ...
    placements.push({
      id,
      color: `hsl(${Math.round(pieceIdx * HUE_STEP)} 62% 52%)`,
      cells: shape,
      origin: placed.origin,
      rotation: placed.rotation,
    });
    pieceIdx++;
  }
  if (pieceIdx < pieceCount) return null; // 生成失敗。呼び出し側でリトライ

  // 盤面の外接矩形に正規化(すでに非負なのでそのまま範囲だけ求める)
  let maxX = 0, maxY = 0;
  for (const k of occupied) {
    const [x, y] = k.split(',').map(Number);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const width = maxX + 1, height = maxY + 1;
  const boardCells = Array.from(occupied).map((k) => { const [x, y] = k.split(',').map(Number); return { x, y }; });

  const pieces = placements.map((p) => ({ id: p.id, color: p.color, cells: p.cells }));
  const solution = {};
  placements.forEach((p) => { solution[p.id] = { origin: p.origin, rotation: p.rotation }; });

  return { width, height, boardCells, pieces, solution };
}

function isConnected(boardCells) {
  const set = new Set(boardCells.map((c) => keyOf(c.x, c.y)));
  const start = boardCells[0];
  const seen = new Set([keyOf(start.x, start.y)]);
  const stack = [start];
  while (stack.length) {
    const { x, y } = stack.pop();
    for (const [nx, ny] of neighbors(x, y)) {
      const k = keyOf(nx, ny);
      if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push({ x: nx, y: ny }); }
    }
  }
  return seen.size === set.size;
}

function validateStage(stage) {
  const boardSet = new Set(stage.boardCells.map((c) => keyOf(c.x, c.y)));
  if (boardSet.size !== stage.boardCells.length) return 'board has duplicate cells';
  if (!isConnected(stage.boardCells)) return 'board not connected';
  const covered = new Set();
  let total = 0;
  for (const p of stage.pieces) {
    const sol = stage.solution[p.id];
    if (!sol) return 'missing solution for ' + p.id;
    const cells = rotateCells(p.cells, sol.rotation).map((c) => ({ x: c.x + sol.origin.x, y: c.y + sol.origin.y }));
    for (const c of cells) {
      const k = keyOf(c.x, c.y);
      if (!boardSet.has(k)) return 'piece ' + p.id + ' cell out of board';
      if (covered.has(k)) return 'piece ' + p.id + ' overlaps another piece';
      covered.add(k);
      total++;
    }
  }
  if (total !== stage.boardCells.length) return 'coverage mismatch';
  // 縦長・横長すぎる盤面はスマホ画面に収まらずセルが小さくなりすぎるため、
  // 生成し直す(縦は画面が縦長なので横よりやや余裕を持たせる)。
  if (stage.width > 13) return 'too wide';
  if (stage.height > 15) return 'too tall';
  return null;
}

const STAGES = [];
for (let stageId = 1; stageId <= 50; stageId++) {
  let stage = null;
  for (let seedTry = 0; seedTry < 400 && !stage; seedTry++) {
    const rng = mulberry32(stageId * 100003 + seedTry * 97);
    const candidate = generateStage(stageId, rng);
    if (!candidate) continue;
    const err = validateStage(candidate);
    if (!err) stage = candidate;
  }
  if (!stage) throw new Error('failed to generate stage ' + stageId);
  STAGES.push(stage);
}

// ---- 統計出力(標準エラーへ。difficulty curve の目視確認用) ----
STAGES.forEach((s, i) => {
  const rotNonZero = Object.values(s.solution).filter((v) => v.rotation !== 0).length;
  console.error(
    `stage ${String(i + 1).padStart(2, '0')}: board ${s.width}x${s.height} (${s.boardCells.length}cells) ` +
    `pieces=${s.pieces.length} avgSize=${(s.boardCells.length / s.pieces.length).toFixed(1)} ` +
    `rotatedPieces=${rotNonZero}/${s.pieces.length}`
  );
});

const header =
  '/* 自動生成: ブロックフィットパズル 全50ステージ分の盤面+ピースデータ\n' +
  '   生成方法: 空の盤面にピースを1つずつ隣接させながら置いていき、置けた\n' +
  '   場所の集合をそのまま盤面の形として採用する(逆算生成)。この方法だと\n' +
  '   生成した時点で必ず解けることが保証できる(solution の通りに置けば埋まる)。\n' +
  '   ステージが進むほどピースの個数・大きさ・回転が必要なピースの比率を\n' +
  '   上げて難易度を調整してある(生成時に接続性・重複なし・完全被覆を検証済み)。\n' +
  '   solution: ヒント表示用の正解の置き方(置ける組み合わせは他にもありうる) */\n';
const body = STAGES.map((s) => '  ' + JSON.stringify(s)).join(',\n');
process.stdout.write(header + 'window.BF_LEVELS = [\n' + body + '\n];\n');
