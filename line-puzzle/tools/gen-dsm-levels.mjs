// 深海迷路: 全30ステージ分の海底迷路データを生成する。
//
// 考え方:
//   1. 荒いグリッド上に「棒倒し法寄りのランダムDFS/Prim's法混合」で
//      全域木(スパニングツリー)を作る。木なのでSTARTからGOALへの経路は
//      必ず一意に存在し、その他の枝がそのまま行き止まり/ダミールートになる。
//      branchBias を上げるほどPrim's寄り(短い枝が増える=分岐が増える)に、
//      下げるほどDFS寄り(長い一本道が増える)になる。
//   2. 難易度が上がるほど extraLoopFraction で木に閉路(周回ルート)を追加し、
//      「複数方向への分岐」を増やす。
//   3. 次数2のノード(素通りする点)を1本のチェーンにまとめ、Catmull-Rom
//      スプラインで滑らかに補間する。これにより直線だけでなくS字・蛇行・
//      ゆるいカーブが自然に生まれる(次数1=行き止まり/START/GOAL、
//      次数3以上=分岐点として残る)。
//   4. 生成したチェーン(=通路の中心線+幅)がそのまま「描画データ」と
//      「当たり判定データ」の両方になる(ズレの心配がない)。
//   5. 最後にラスタライズ+BFSで実際にSTART→GOALへ到達できるかを検証する
//      (ゲーム本体のあたり判定と同じ「中心線までの距離 <= 幅/2-船半径」を使う)。
//      不合格ならシードを変えて作り直す。
//
// 出力: dsm-levels.js に window.DSM_LEVELS = [ ...30件... ] を書き出す。

/* ---------- 基本ユーティリティ ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 迷路DSL: 点列+幅の「通路」を作る補助関数 ----------
   line()/curve()/arc() はいずれも {points:[[x,y],...], width} を返す。
   同じ点列が描画にも当たり判定にも使われるため、見た目とヒットボックスは
   絶対にズレない。 */
function line(a, b, width) {
  return { points: [[a.x, a.y], [b.x, b.y]], width };
}
// Catmull-Rom スプライン。3点以上のときに滑らかなカーブ/S字/蛇行を作る。
function curve(nodePts, width, samplesPerSeg) {
  samplesPerSeg = samplesPerSeg || 10;
  if (nodePts.length < 3) return line(nodePts[0], nodePts[nodePts.length - 1], width);
  const n = nodePts.length;
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = nodePts[Math.max(0, i - 1)];
    const p1 = nodePts[i];
    const p2 = nodePts[i + 1];
    const p3 = nodePts[Math.min(n - 1, i + 2)];
    const startJ = i === 0 ? 0 : 1;
    for (let j = startJ; j <= samplesPerSeg; j++) {
      const t = j / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.push([x, y]);
    }
  }
  return { points: out, width };
}
// 2点間を弧状に膨らませる(短いチェーンでも「カーブ」を作るため)
function bow(a, b, bulge, width, samplesPerSeg) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const ctrl = { x: mx + nx * bulge, y: my + ny * bulge };
  return curve([a, ctrl, b], width, samplesPerSeg || 10);
}
function arc(center, r, a0, a1, width, steps) {
  steps = steps || 16;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    pts.push([center.x + Math.cos(a) * r, center.y + Math.sin(a) * r]);
  }
  return { points: pts, width };
}

/* ---------- グリッド上に全域木(+少しの閉路)を作る ---------- */
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function buildTree(rng, gw, gh, branchBias, diagonalChance, extraLoopFraction) {
  const key = (x, y) => x + ',' + y;
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh;
  const visited = new Set();
  const adj = new Map(); // key -> Set(key)
  function ensure(k) { if (!adj.has(k)) adj.set(k, new Set()); }
  function connect(k1, k2) { ensure(k1); ensure(k2); adj.get(k1).add(k2); adj.get(k2).add(k1); }

  const startX = Math.floor(gw / 2), startY = Math.floor(gh / 2);
  const root = key(startX, startY);
  visited.add(root); ensure(root);

  // frontier: 候補となる「訪問済みセルから伸ばせる辺」のリスト
  let frontier = []; // { from:[x,y], to:[x,y] }
  function pushFrontierFrom(cx, cy) {
    const neigh = diagonalChance > 0 ? ORTHO.concat(DIAG) : ORTHO;
    for (const [dx, dy] of neigh) {
      if (dx !== 0 && dy !== 0 && rng() > diagonalChance) continue; // 斜めは確率で間引く
      const nx = cx + dx, ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      frontier.push({ from: [cx, cy], to: [nx, ny] });
    }
  }
  pushFrontierFrom(startX, startY);
  let lastCell = [startX, startY];

  while (frontier.length) {
    // branchBias が低いほど「直前に追加したセルの続き」を優先(DFS的=長い一本道)、
    // 高いほどフロンティア全体からランダムに選ぶ(Prim's的=枝分かれが増える)
    let idx;
    if (rng() > branchBias) {
      // 直前セル起点の候補を優先して探す(無ければランダム)
      const fromLast = [];
      for (let i = frontier.length - 1; i >= 0; i--) {
        if (frontier[i].from[0] === lastCell[0] && frontier[i].from[1] === lastCell[1]) fromLast.push(i);
      }
      idx = fromLast.length ? fromLast[Math.floor(rng() * fromLast.length)] : Math.floor(rng() * frontier.length);
    } else {
      idx = Math.floor(rng() * frontier.length);
    }
    const edge = frontier[idx];
    frontier.splice(idx, 1);
    const tk = key(edge.to[0], edge.to[1]);
    if (visited.has(tk)) continue; // 別経路ですでに訪問済み(古い候補)
    visited.add(tk);
    connect(key(edge.from[0], edge.from[1]), tk);
    lastCell = edge.to;
    pushFrontierFrom(edge.to[0], edge.to[1]);
  }

  // 閉路を少し追加(周回ルート・複数分岐を作る)。すでに繋がっている
  // 近傍同士を追加でつなぐだけなので、連結性は絶対に壊れない。
  const allCells = [...visited];
  const extraCount = Math.round(allCells.length * extraLoopFraction);
  let added = 0, tries = 0;
  while (added < extraCount && tries < extraCount * 30) {
    tries++;
    const [cx, cy] = pick(rng, allCells).split(',').map(Number);
    const [dx, dy] = pick(rng, ORTHO.concat(DIAG));
    const nx = cx + dx, ny = cy + dy;
    if (!inBounds(nx, ny)) continue;
    const k1 = key(cx, cy), k2 = key(nx, ny);
    if (!visited.has(k2)) continue;
    if (adj.get(k1).has(k2)) continue;
    connect(k1, k2);
    added++;
  }

  return { adj, startCell: [startX, startY] };
}

/* ---------- 木の直径(両端が必ず葉になる2点)を求め、START/GOALにする ---------- */
function bfsFarthest(adj, fromKey) {
  const dist = new Map([[fromKey, 0]]);
  const prev = new Map();
  const q = [fromKey];
  let qi = 0;
  let far = fromKey;
  while (qi < q.length) {
    const cur = q[qi++];
    if (dist.get(cur) > dist.get(far)) far = cur;
    for (const nb of adj.get(cur)) {
      if (!dist.has(nb)) { dist.set(nb, dist.get(cur) + 1); prev.set(nb, cur); q.push(nb); }
    }
  }
  return { far, dist, prev };
}

/* ---------- 次数2のノードをチェーンにまとめる ---------- */
function buildChains(adj) {
  const edgeKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const visitedEdges = new Set();
  const chains = [];
  for (const id of adj.keys()) {
    const deg = adj.get(id).size;
    if (deg === 2) continue;
    for (const nb of adj.get(id)) {
      const ek = edgeKey(id, nb);
      if (visitedEdges.has(ek)) continue;
      visitedEdges.add(ek);
      const chainNodes = [id, nb];
      let prev = id, cur = nb;
      while (adj.get(cur).size === 2) {
        const nexts = [...adj.get(cur)].filter((x) => x !== prev);
        if (!nexts.length) break;
        const next = nexts[0];
        const ek2 = edgeKey(cur, next);
        if (visitedEdges.has(ek2)) break;
        visitedEdges.add(ek2);
        chainNodes.push(next);
        prev = cur; cur = next;
      }
      chains.push(chainNodes);
    }
  }
  // 残った辺(すべて次数2のノードだけで作る孤立閉路。まれなケースの保険)
  for (const id of adj.keys()) {
    for (const nb of adj.get(id)) {
      const ek = edgeKey(id, nb);
      if (visitedEdges.has(ek)) continue;
      visitedEdges.add(ek);
      chains.push([id, nb]);
    }
  }
  return chains;
}

/* ---------- 通路チェーン(グリッド座標)をワールド座標のセグメントへ ---------- */
function keyToXY(k) { const [x, y] = k.split(',').map(Number); return { x, y }; }

function buildStage(stageId, rng, tier) {
  const { adj, startCell } = buildTree(rng, tier.gw, tier.gh, tier.branchBias, tier.diagonalChance, tier.extraLoopFraction);
  const rootKey = startCell.join(',');
  const sweep1 = bfsFarthest(adj, rootKey);
  const sweep2 = bfsFarthest(adj, sweep1.far);
  const startKey = sweep2.far;
  // startからいちばん遠い葉をGOALにする(直径のもう一方の端)
  const sweep3 = bfsFarthest(adj, startKey);
  const goalKey = sweep3.far;

  // ノードのワールド座標(グリッド座標+ジッター)
  const nodeWorld = new Map();
  for (const k of adj.keys()) {
    const { x, y } = keyToXY(k);
    const jx = (rng() * 2 - 1) * tier.jitter;
    const jy = (rng() * 2 - 1) * tier.jitter;
    nodeWorld.set(k, { x: x * tier.spacing + jx, y: y * tier.spacing + jy });
  }

  const chains = buildChains(adj);
  const segments = [];
  let curveChainCount = 0;
  let diagonalEdgeCount = 0;
  for (const chain of chains) {
    const pts = chain.map((k) => nodeWorld.get(k));
    // 斜め移動を含むチェーンかどうか(統計用)
    for (let i = 0; i < chain.length - 1; i++) {
      const a = keyToXY(chain[i]), b = keyToXY(chain[i + 1]);
      if (a.x !== b.x && a.y !== b.y) diagonalEdgeCount++;
    }
    if (pts.length >= 3) {
      segments.push(curve(pts, tier.width));
      curveChainCount++;
    } else if (rng() < tier.curveChance) {
      const bulge = (rng() * 0.5 + 0.3) * tier.spacing * (rng() < 0.5 ? -1 : 1);
      segments.push(bow(pts[0], pts[1], bulge, tier.width));
      curveChainCount++;
    } else {
      segments.push(line(pts[0], pts[1], tier.width));
    }
  }

  // 次数から分岐点/行き止まりを数える
  let deadEnds = 0, junctions = 0;
  for (const k of adj.keys()) {
    const deg = adj.get(k).size;
    if (deg === 1) deadEnds++;
    else if (deg >= 3) junctions++;
  }

  // START/GOAL方向(隣接ノードへ向く角度)
  const startPos = nodeWorld.get(startKey);
  const startNeighbor = nodeWorld.get([...adj.get(startKey)][0]);
  const startAngle = Math.atan2(startNeighbor.y - startPos.y, startNeighbor.x - startPos.x) * 180 / Math.PI;
  const goalPos = nodeWorld.get(goalKey);

  // 正解ルートの長さ(START→GOALの木の距離。ワールド距離で計算)
  let routeLen = 0;
  {
    let cur = goalKey;
    while (sweep3.prev.has(cur)) {
      const p = sweep3.prev.get(cur);
      routeLen += dist(nodeWorld.get(cur), nodeWorld.get(p));
      cur = p;
    }
  }

  // 境界を求めて正規化(左上を margin だけ空ける)
  const margin = tier.width;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const seg of segments) {
    for (const [x, y] of seg.points) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const offX = margin - minX, offY = margin - minY;
  segments.forEach((seg) => { seg.points = seg.points.map(([x, y]) => [Math.round((x + offX) * 10) / 10, Math.round((y + offY) * 10) / 10]); });
  const shift = (p) => ({ x: Math.round((p.x + offX) * 10) / 10, y: Math.round((p.y + offY) * 10) / 10 });
  const startPosOut = shift(startPos);
  const goalPosOut = shift(goalPos);
  const boundsW = Math.round(maxX - minX + margin * 2);
  const boundsH = Math.round(maxY - minY + margin * 2);

  // 装飾(岩・海藻など): 通路の外側(壁側)にランダムに点在させる
  const decorations = pickDecorations(rng, segments, boundsW, boundsH, tier);

  return {
    stageId,
    difficultyTier: tier.tier,
    theme: tier.theme,
    mazeBounds: { width: boundsW, height: boundsH },
    startPosition: startPosOut,
    startAngle: Math.round(startAngle),
    goalPosition: goalPosOut,
    goalRadius: Math.round(tier.width * 0.85),
    shipSize: SHIP_RADIUS,
    fogRadius: tier.fogRadius || 0,
    segments,
    decorations,
    stats: {
      routeLength: Math.round(routeLen),
      deadEnds, junctions,
      curveChains: curveChainCount,
      diagonalEdges: diagonalEdgeCount,
      corridorWidth: tier.width,
      totalChains: chains.length
    }
  };
}

function pickDecorations(rng, segments, w, h, tier) {
  const count = Math.round(10 + Math.min(20, (w * h) / 26000));
  const decos = [];
  let tries = 0;
  while (decos.length < count && tries < count * 40) {
    tries++;
    const x = rng() * w, y = rng() * h;
    // 通路の中心線から十分離れている(=壁側)点だけを装飾に使う
    let minD = Infinity;
    for (const seg of segments) {
      const d = distToPolyline({ x, y }, seg.points);
      if (d < minD) minD = d;
      if (minD < seg.width * 0.5 + 14) break;
    }
    if (minD < tier.width * 0.5 + 14) continue; // 通路に近すぎる(船とぶつかる位置)
    if (minD > tier.width * 2.2) continue; // 遠すぎる(何もない空間に浮く)
    const type = pick(rng, ['rock', 'rock', 'plant', 'glow']);
    decos.push({ type, x: Math.round(x), y: Math.round(y), scale: Math.round((0.7 + rng() * 0.8) * 100) / 100, rot: Math.round(rng() * 360) });
  }
  return decos;
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + dx * t, y: a.y + dy * t });
}
function distToPolyline(p, points) {
  let min = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = { x: points[i][0], y: points[i][1] };
    const b = { x: points[i + 1][0], y: points[i + 1][1] };
    const d = distToSegment(p, a, b);
    if (d < min) min = d;
  }
  return min;
}

/* ---------- 検証: ラスタライズ+BFSでSTART→GOALに実際に到達できるか ---------- */
function validateStage(stage) {
  const CELL = 6;
  const { width: W, height: H } = stage.mazeBounds;
  const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
  const passable = new Uint8Array(gw * gh);
  const shipR = stage.shipSize;

  for (const seg of stage.segments) {
    const halfW = seg.width / 2 - shipR;
    if (halfW <= 0) return '通路幅が船より狭いセグメントがあります';
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of seg.points) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    const gx0 = Math.max(0, Math.floor((minX - halfW) / CELL));
    const gy0 = Math.max(0, Math.floor((minY - halfW) / CELL));
    const gx1 = Math.min(gw - 1, Math.ceil((maxX + halfW) / CELL));
    const gy1 = Math.min(gh - 1, Math.ceil((maxY + halfW) / CELL));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const idx = gy * gw + gx;
        if (passable[idx]) continue;
        const px = gx * CELL + CELL / 2, py = gy * CELL + CELL / 2;
        if (distToPolyline({ x: px, y: py }, seg.points) <= halfW) passable[idx] = 1;
      }
    }
  }

  const toCell = (p) => [Math.max(0, Math.min(gw - 1, Math.floor(p.x / CELL))), Math.max(0, Math.min(gh - 1, Math.floor(p.y / CELL)))];
  const [sx, sy] = toCell(stage.startPosition);
  const [gx, gy] = toCell(stage.goalPosition);
  if (!passable[sy * gw + sx]) return 'START地点が通路内にありません';
  if (!passable[gy * gw + gx]) return 'GOAL地点が通路内にありません';

  const seen = new Uint8Array(gw * gh);
  const q = [sy * gw + sx];
  seen[sy * gw + sx] = 1;
  let qi = 0;
  const goalIdx = gy * gw + gx;
  while (qi < q.length) {
    const cur = q[qi++];
    if (cur === goalIdx) return null; // 到達できた
    const cx = cur % gw, cy = (cur / gw) | 0;
    const neigh = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const ni = ny * gw + nx;
      if (passable[ni] && !seen[ni]) { seen[ni] = 1; q.push(ni); }
    }
  }
  return 'STARTからGOALへの経路が見つかりません';
}

/* ---------- 難易度カーブ(連続的) ----------
   ステージ番号を0〜1に正規化し、緩やかに加速するカーブ(t^1.2)に通してから
   各パラメータを線形補間する。段階(tier)で区切らず連続にすることで、
   「1ステージ増えただけで急に難しくなる」段差が生まれにくく、後から
   TOTAL_STAGES を増やして Stage 51〜 を足すのも tierFor() を触らずに
   自然に繋がる。
   帯(5ステージごと)は見た目のテーマ切り替えにだけ使う。
   Stage 31以降は fogRadius(視界半径)を設定し、探査船の周り以外を
   徐々に暗くして「先が見えづらい」深海の終盤らしさを出す。 */
const SHIP_RADIUS = 13;
const TOTAL_STAGES = 50;
const DARK_FROM_STAGE = 31;
const THEMES = [
  'entrance', 'reef', 'cavern', 'canyon', 'wreck', 'ruins',
  'trench', 'abyss', 'forgotten', 'deepest'
];
function lerp2(a, b, t) { return a + (b - a) * t; }
function tierFor(stageId) {
  const t = (stageId - 1) / (TOTAL_STAGES - 1);
  const te = Math.pow(t, 1.2);   // 序盤はゆっくり、終盤ほど速く難しくする

  const gw = Math.round(lerp2(4, 13, te));
  const gh = Math.round(lerp2(4, 16, te)) + (stageId % 3 === 0 ? 1 : 0);
  const spacing = lerp2(128, 96, te);
  const width = lerp2(74, 38, te);
  const branchBias = lerp2(0.12, 0.8, te);
  const extraLoopFraction = lerp2(0, 0.26, te);
  const diagonalChance = lerp2(0, 0.36, te);
  const curveChance = lerp2(0.25, 0.7, te);
  const jitter = lerp2(8, 20, te);

  const band = Math.min(THEMES.length, Math.floor((stageId - 1) / 5) + 1);
  const fogRadius = stageId >= DARK_FROM_STAGE
    ? Math.round(lerp2(340, 210, (stageId - DARK_FROM_STAGE) / (TOTAL_STAGES - DARK_FROM_STAGE)))
    : 0;

  return {
    tier: band, gw, gh, spacing, width, branchBias, extraLoopFraction, diagonalChance, curveChance, jitter,
    theme: THEMES[band - 1], fogRadius
  };
}

/* ---------- 生成本体 ---------- */
const STAGES = [];
for (let stageId = 1; stageId <= TOTAL_STAGES; stageId++) {
  const tier = tierFor(stageId);
  let stage = null, err = null;
  for (let seedTry = 0; seedTry < 250 && !stage; seedTry++) {
    const rng = mulberry32(stageId * 92821 + seedTry * 733);
    const candidate = buildStage(stageId, rng, tier);
    err = validateStage(candidate);
    if (!err) stage = candidate;
  }
  if (!stage) throw new Error('stage ' + stageId + ' 生成に失敗: ' + err);
  STAGES.push(stage);
}

// ---- 統計出力(標準エラーへ。難易度カーブの目視確認用) ----
STAGES.forEach((s) => {
  const st = s.stats;
  console.error(
    `stage ${String(s.stageId).padStart(2, '0')} [band${s.difficultyTier}] ` +
    `bounds=${s.mazeBounds.width}x${s.mazeBounds.height} route=${st.routeLength} ` +
    `deadEnds=${st.deadEnds} junctions=${st.junctions} curves=${st.curveChains}/${st.totalChains} ` +
    `diag=${st.diagonalEdges} width=${st.corridorWidth} fog=${s.fogRadius || '-'}`
  );
});

const header =
  '/* 自動生成: 深海迷路 全' + STAGES.length + 'ステージ分の海底迷路データ\n' +
  '   生成方法: グリッド上にランダムDFS/Prim\'s混合で全域木を作り(必ず連結)、\n' +
  '   START-GOAL間はその木の直径(最も長い経路)に取る。次数2のノードは\n' +
  '   Catmull-Romスプラインでチェーン化し、直線だけでなく曲線・S字・蛇行を\n' +
  '   自然に作る。descriptions は同じ点列を描画にも当たり判定にも使うため、\n' +
  '   見た目とヒットボックスがズレない。生成後、ラスタライズ+BFSで\n' +
  '   STARTからGOALへ実際に到達できることを検証済み(tools/gen-dsm-levels.mjs)。\n' +
  '   segments[].points は [x,y] のワールド座標(px)。 */\n';
const body = STAGES.map((s) => '  ' + JSON.stringify(s)).join(',\n');
process.stdout.write(header + 'window.DSM_LEVELS = [\n' + body + '\n];\n');
