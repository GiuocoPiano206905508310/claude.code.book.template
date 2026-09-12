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

/* ---------- 経路(START→GOAL)をノードキーの配列で取り出す ---------- */
function routeKeys(prevMap, goalKey) {
  const out = [goalKey];
  let cur = goalKey;
  while (prevMap.has(cur)) { cur = prevMap.get(cur); out.push(cur); }
  return out.reverse();
}

/* ---------- 迂回路をつくる(「ウニの通せんぼ」用) ----------
   正解ルートの1辺(A,B)を選び、その辺を通らずに A から B へ戻れる回り道を
   グリッド上に作る。全域木はすべてのセルを訪れているので、既存のセル同士を
   追加でつなぐだけでよく、連結性は絶対に壊れない。
   返した辺の上に「通せんぼのウニ」を置くと、
   「まっすぐ行くと塞がれている → 回り道すると先に出られる」構図になる。 */
function addDetourLoop(rng, adj, gw, gh, route) {
  const key = (x, y) => x + ',' + y;
  const inB = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh;
  const lo = Math.max(1, Math.floor(route.length * 0.25));
  const hi = Math.max(lo + 1, Math.floor(route.length * 0.75));
  const idxs = [];
  for (let i = lo; i < hi && i + 1 < route.length; i++) idxs.push(i);

  for (const i of shuffle(rng, idxs)) {
    const A = keyToXY(route[i]), B = keyToXY(route[i + 1]);
    const dx = B.x - A.x, dy = B.y - A.y;
    // A→B に対して横へ張り出す箱型の回り道の候補を並べる
    const cands = [];
    if (dx === 0 || dy === 0) {
      const perps = dx === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
      for (const [px, py] of perps) {
        for (const depth of [1, 2]) {
          const path = [];
          for (let d = 1; d <= depth; d++) path.push({ x: A.x + px * d, y: A.y + py * d });
          for (let d = depth; d >= 1; d--) path.push({ x: B.x + px * d, y: B.y + py * d });
          cands.push(path);
        }
      }
    } else {
      // 斜めの辺は、直角に曲がる2辺で回り込める
      cands.push([{ x: A.x + dx, y: A.y }]);
      cands.push([{ x: A.x, y: A.y + dy }]);
    }
    for (const path of shuffle(rng, cands)) {
      const chain = [A, ...path, B];
      let ok = true;
      for (const c of path) if (!inB(c.x, c.y) || !adj.has(key(c.x, c.y))) { ok = false; break; }
      if (!ok) continue;
      // 塞ぐつもりの辺(A,B)そのものを回り道が使ってしまっては意味がない
      for (let j = 0; j < chain.length - 1 && ok; j++) {
        const a = chain[j], b = chain[j + 1];
        if (a.x === b.x && a.y === b.y) ok = false;
        if ((a.x === A.x && a.y === A.y && b.x === B.x && b.y === B.y) ||
            (a.x === B.x && a.y === B.y && b.x === A.x && b.y === A.y)) ok = false;
      }
      if (!ok) continue;
      for (let j = 0; j < chain.length - 1; j++) {
        const k1 = key(chain[j].x, chain[j].y), k2 = key(chain[j + 1].x, chain[j + 1].y);
        adj.get(k1).add(k2); adj.get(k2).add(k1);
      }
      return { blockEdge: [route[i], route[i + 1]] };
    }
  }
  return null;
}

/* ---------- だまし分岐をつくる ----------
   プレイヤーが必ず通る分岐点Jの、2本の枝の先どうしを繋ぐ。すると
   「3本に分かれていて、1本を選んで進んだら、ぐるっと回って分岐の
   別の枝から同じ分岐点に戻ってきた」という構図になる。 */
function walkBranch(adj, from, first, steps) {
  let prev = from, cur = first;
  for (let i = 0; i < steps; i++) {
    const nexts = [...adj.get(cur)].filter((x) => x !== prev);
    if (!nexts.length) break;
    prev = cur; cur = nexts[0];
  }
  return cur;
}
function addFalseLoop(rng, adj, gw, gh, route) {
  const key = (x, y) => x + ',' + y;
  const inB = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh;
  const cands = shuffle(rng, route.filter((k) => adj.get(k).size >= 3));
  for (const J of cands) {
    const nbs = shuffle(rng, [...adj.get(J)]);
    for (let a = 0; a < nbs.length; a++) {
      for (let b = a + 1; b < nbs.length; b++) {
        const t1 = walkBranch(adj, J, nbs[a], 2 + Math.floor(rng() * 2));
        const t2 = walkBranch(adj, J, nbs[b], 2 + Math.floor(rng() * 2));
        if (t1 === t2 || t1 === J || t2 === J) continue;
        const p1 = keyToXY(t1), p2 = keyToXY(t2);
        const man = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
        if (man < 1 || man > 4) continue;               // 遠すぎる繋ぎは大きな近道になる
        // L字に1マスずつ繋ぐ。分岐点Jを通ってしまう繋ぎ方は使わない。
        const path = [p1];
        let c = { x: p1.x, y: p1.y };
        while (c.x !== p2.x) { c = { x: c.x + Math.sign(p2.x - c.x), y: c.y }; path.push(c); }
        while (c.y !== p2.y) { c = { x: c.x, y: c.y + Math.sign(p2.y - c.y) }; path.push(c); }
        let ok = true;
        for (const q of path) {
          if (!inB(q.x, q.y) || !adj.has(key(q.x, q.y))) { ok = false; break; }
          if (key(q.x, q.y) === J) { ok = false; break; }
        }
        if (!ok) continue;
        let added = 0;
        for (let j = 0; j < path.length - 1; j++) {
          const k1 = key(path[j].x, path[j].y), k2 = key(path[j + 1].x, path[j + 1].y);
          if (k1 === k2 || adj.get(k1).has(k2)) continue;
          adj.get(k1).add(k2); adj.get(k2).add(k1);
          added++;
        }
        if (!added) continue;                           // すでに繋がっていた=周回にならない
        return { junction: J };
      }
    }
  }
  return null;
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

  // ここまでは木(閉路なし)。ここから「意図した閉路」だけを2つ足す。
  // ランダムに閉路をばらまくと、どの枝を選んでも同じ道に合流してしまい
  // 分岐の意味が無くなるので、閉路は必ずこの2つだけにする。
  //   detour … 正解ルートの1辺を迂回できる回り道(その辺をウニで塞ぐ)
  //   false  … 分岐の2本の枝の先を繋ぎ、進むと同じ分岐点に戻る周回路
  const route = routeKeys(sweep3.prev, goalKey);
  const detour = addDetourLoop(rng, adj, tier.gw, tier.gh, route);
  const falseLoop = addFalseLoop(rng, adj, tier.gw, tier.gh, route);

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

  // 敵キャラ: Stage1〜10は固定のウニ、11〜50は遊泳するピラニア/ウツボ
  const routeWorld = route.map((k) => shift(nodeWorld.get(k)));
  const blockAt = detour ? shift({
    x: (nodeWorld.get(detour.blockEdge[0]).x + nodeWorld.get(detour.blockEdge[1]).x) / 2,
    y: (nodeWorld.get(detour.blockEdge[0]).y + nodeWorld.get(detour.blockEdge[1]).y) / 2
  }) : null;
  const enemies = pickEnemies(rng, stageId, adj, nodeWorld, startKey, goalKey, shift, segments, blockAt, routeWorld);

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
    enemies,
    stats: {
      routeLength: Math.round(routeLen),
      deadEnds, junctions,
      detourLoop: !!detour, falseLoop: !!falseLoop,
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

/* ---------- 敵キャラ配置 ----------
   Stage1〜10: 固定のウニのみ。
     ・行き止まり(次数1のノード。START/GOALを除く)には「不揃いトゲ
       (野性的)」型を数体(難易度が上がるほど増える)。
     ・通路の途中(道中の端・隅。壁寄りだが船が横を通れる余地は必ず残す)
       には「しなる触手」型を数体。
   Stage11〜50: 遊泳する敵(下記)に加えて、固定のウニも2体(行き止まりに
   1体・道中の端に1体)だけ配置する。
     Stage11〜20: ゆっくり泳ぐ深海ピラニア(提灯付きアンコウ型)。
     Stage21〜30: 速く泳ぐ深海ピラニア(棘状背びれ型)。
     Stage31〜40: ゆっくり泳ぐウツボ(ヒカリウツボ)。
     Stage41〜50: 速く泳ぐウツボ(ノーマルウツボ)。
     ウツボは用意してもらったイラスト(8コマのスプライトシート)をそのまま
     使うので、variant はシート名(glow / normal)と対応する。
   遊泳する敵は探査船と違って壁の当たり判定を持たず、通路の外(壁の中)も
   自由に横切って泳ぐ想定なので、経路はノード座標をランダムに繋ぐだけで
   良い(壁を避ける必要がない)。実際の当たり判定・見た目はゲーム本体
   (deep-sea-maze.js)側で持つ定数から作るため、ここでは座標と種類・速さ
   だけを持たせる。 */
const URCHIN_R = 18;
const TENTACLE_HIT_MUL = 1.4;   // deep-sea-maze.js の checkEnemyHit と必ず同じ値にする

// 行き止まり(次数1のノード。START/GOALを除く)に固定のウニを置く
// (「不揃いトゲ(野性的)」型。行き止まりは本編の必須ルートに無いので
// 大きさ・当たり判定の余裕は気にせず目立たせてよい)。
function placeDeadEndUrchins(rng, count, adj, nodeWorld, startKey, goalKey, shift, urchins) {
  const deadEndKeys = [];
  for (const k of adj.keys()) {
    if (adj.get(k).size === 1 && k !== startKey && k !== goalKey) deadEndKeys.push(k);
  }
  const n = Math.min(deadEndKeys.length, count);
  shuffle(rng, deadEndKeys).slice(0, n).forEach((k) => {
    const p = shift(nodeWorld.get(k));
    urchins.push({ variant: 'irregular', x: p.x, y: p.y, r: URCHIN_R, rot: Math.round(rng() * 360) });
  });
}

// 道中の端・隅(壁寄り)に「しなる触手」型を置く。船が反対側を通り抜けられる
// 余地(gap)は必ず残すが、体の半分ほどが通路にはみ出す・ギリギリ避けて
// 進める程度まで壁際いっぱいに押し込む。通路幅はステージが進むほど狭く
// なる(74px→36px)ので、固定サイズのままだと後半ステージでは余地が
// 負になってしまう。そこで、その通路幅で確保できる最大サイズまで
// ウニ自体を縮めることで、どのステージでも「ギリギリ避けられる」余地を
// 必ず残す(＝通路が狭いステージほど、このウニも自然に小さくなる)。
function placeTentacleUrchins(rng, count, segments, shift, urchins, routeWorld) {
  const subsegs = [];
  let totalLen = 0;
  for (const seg of segments) {
    for (let i = 0; i < seg.points.length - 1; i++) {
      const ax = seg.points[i][0], ay = seg.points[i][1];
      const bx = seg.points[i + 1][0], by = seg.points[i + 1][1];
      const len = dist({ x: ax, y: ay }, { x: bx, y: by });
      if (len < 4) continue;
      subsegs.push({ ax, ay, bx, by, len, halfW: seg.width / 2 });
      totalLen += len;
    }
  }
  if (!subsegs.length) return;
  // 「ゴールまでの道のりにウニがいない=簡単すぎる」ので、正解ルートの
  // 近くにある区間を優先して選ぶ。近い区間が無ければ全区間から選ぶ。
  const routePts = routeWorld && routeWorld.length ? routeWorld.map((q) => [q.x, q.y]) : null;
  const onRoute = routePts
    ? subsegs.filter((sg) => distToPolyline({ x: (sg.ax + sg.bx) / 2, y: (sg.ay + sg.by) / 2 }, routePts) <= sg.halfW * 1.2)
    : [];
  // gap = 2*halfW - wallMargin - hitR - 2*shipR (壁いっぱい(d=halfW-wallMargin)
  // まで押し込んだときに船の中心が動ける幅)。gap >= minGap になるように
  // r の上限を逆算する。全ステージ中もっとも狭い通路(Stage50, width=36)
  // でも minGap(shipR*0.25 ≈ 3.25px)は正の値で確保できる計算式。
  const wallMargin = 3;
  const minGap = SHIP_RADIUS * 0.25;
  const halfW = subsegs[0].halfW;
  const rMaxForSafety = (2 * halfW - wallMargin - 2 * SHIP_RADIUS - minGap) / TENTACLE_HIT_MUL;
  const r = Math.max(3, Math.min(URCHIN_R, rMaxForSafety));
  for (let i = 0; i < count; i++) {
    const pool = onRoute.length ? onRoute : subsegs;
    const poolLen = pool.reduce((a, sg) => a + sg.len, 0);
    let target = rng() * poolLen, chosen = pool[pool.length - 1];
    for (const s of pool) {
      if (target <= s.len) { chosen = s; break; }
      target -= s.len;
    }
    const tt = rng();
    const px = lerp(chosen.ax, chosen.bx, tt), py = lerp(chosen.ay, chosen.by, tt);
    const dx = chosen.bx - chosen.ax, dy = chosen.by - chosen.ay;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const side = rng() < 0.5 ? 1 : -1;
    const offset = (chosen.halfW - wallMargin) * side;
    const p = shift({ x: px + nx * offset, y: py + ny * offset });
    // 緑のウニは左右に揺れる。振れ幅はウニ3個分(直径×3)をこの位置で
    // 確保できるぶんまで。実際に通れるかは validateHazards() で確かめ、
    // 通れなければ後段で振れ幅を詰める。
    urchins.push({ variant: 'tentacle', x: p.x, y: p.y, r: Math.round(r * 10) / 10,
      rot: Math.round(rng() * 360), moveX: Math.round(r * 3 * 10) / 10,
      phase: Math.round(rng() * 100) / 100 });
  }
}

// 通路の中心線のうち、与えた点にいちばん近いところを返す(幅つき)
function nearestOnSegments(segments, p) {
  let best = null, bd = Infinity;
  for (const seg of segments) {
    for (let i = 0; i < seg.points.length - 1; i++) {
      const a = { x: seg.points[i][0], y: seg.points[i][1] };
      const b = { x: seg.points[i + 1][0], y: seg.points[i + 1][1] };
      const dx = b.x - a.x, dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
      const q = { x: a.x + dx * t, y: a.y + dy * t };
      const d = dist(p, q);
      if (d < bd) { bd = d; best = { x: q.x, y: q.y, halfW: seg.width / 2 }; }
    }
  }
  return best;
}

// 「通せんぼ」のウニ。回り道が用意してある辺の上に、通路を完全に塞ぐ
// 大きさで置く。船の中心が左右どちらからも抜けられないよう、
// 当たり半径(r×1.15)+船の半径 が通路の半幅以上になる大きさを逆算する。
function placeBlockerUrchin(rng, blockAt, segments, urchins) {
  if (!blockAt) return false;
  const spot = nearestOnSegments(segments, blockAt);
  if (!spot) return false;
  const needed = (spot.halfW - SHIP_RADIUS) / 1.15 + 1.5;   // 完全に塞ぐのに要る半径
  const r = Math.max(needed, spot.halfW * 0.55);
  urchins.push({ variant: 'irregular', x: Math.round(spot.x * 10) / 10, y: Math.round(spot.y * 10) / 10,
    r: Math.round(r * 10) / 10, rot: Math.round(rng() * 360), blocker: true });
  return true;
}

function pickEnemies(rng, stageId, adj, nodeWorld, startKey, goalKey, shift, segments, blockAt, routeWorld) {
  const urchins = [];
  // どのステージにも「通せんぼのウニ」を1体。回り道は addDetourLoop() が
  // 作ってあるので、まっすぐ行けない代わりに迂回すれば先へ進める。
  placeBlockerUrchin(rng, blockAt, segments, urchins);
  if (stageId <= 10) {
    // 序盤(固定の危険物のみ): 難易度が上がるほど数を増やす
    placeDeadEndUrchins(rng, 3 + Math.floor(stageId / 2), adj, nodeWorld, startKey, goalKey, shift, urchins);
    placeTentacleUrchins(rng, 2 + Math.floor(stageId / 3), segments, shift, urchins, routeWorld);
    return { urchins, swimmers: [] };
  }

  // Stage11以降も、遊泳する敵に加えて固定のウニを2体(行き止まりに1体・
  // 正解ルートの端に1体)だけ配置する。
  placeDeadEndUrchins(rng, 1, adj, nodeWorld, startKey, goalKey, shift, urchins);
  placeTentacleUrchins(rng, 1, segments, shift, urchins, routeWorld);

  const nodeKeys = [...adj.keys()];
  function randomWaypoints() {
    const k = 3 + Math.floor(rng() * 2);
    return shuffle(rng, nodeKeys).slice(0, Math.min(k, nodeKeys.length)).map((key) => {
      const p = shift(nodeWorld.get(key));
      return [p.x, p.y];
    });
  }

  let variant, speed, count, type, size;
  if (stageId <= 20) {
    type = 'fish'; variant = 'anglerfish'; speed = 52; size = 30;
    count = 5 + Math.floor((stageId - 11) / 3);
  } else if (stageId <= 30) {
    type = 'fish'; variant = 'spinydorsal'; speed = 108; size = 30;
    count = 6 + Math.floor((stageId - 21) / 3);
  } else if (stageId <= 40) {
    type = 'eel'; variant = 'glow'; speed = 38; size = 180;
    count = 4 + Math.floor((stageId - 31) / 4);
  } else {
    // 骨ウツボは1体が大きいので、増やし方はひかえめにする
    type = 'eel'; variant = 'normal'; speed = 82; size = 300;
    count = 4 + Math.floor((stageId - 41) / 4);
  }
  const swimmers = [];
  for (let i = 0; i < count; i++) {
    swimmers.push({ type, variant, speed, size, waypoints: randomWaypoints(), phase: Math.round(rng() * 1000) / 1000 });
  }
  return { urchins, swimmers };
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

/* ---------- 検証2: ウニを避けてSTART→GOALに到達できるか ----------
   validateStage() は壁だけを見て「物理的に移動できるか」を確認するが、
   ウニは壁ではなく「触れたら即やり直し」の危険物なので、別に検証する。
   壁の当たり判定と同じラスタライズ+BFSに、ウニの危険範囲を通行不可として
   重ねるだけで確認できる。

   ここでは2つ測る。
     direct … ウニを無視したときのSTART→GOALの最短(セル数)
     free   … ウニを避けたときの最短
   「通せんぼのウニ」は正解ルートを完全に塞ぐ大きさで置いてあるので、
   回り道がちゃんと機能していれば free は direct より長くなる。free が
   見つからなければ詰み、direct と変わらなければ通せんぼが効いていない。

   左右に揺れる緑のウニは、揺れて通る範囲すべて(横向きのカプセル)を危険と
   みなす。こうしておけば「揺れの向こう側で待たされて詰む」ことが無く、
   どの瞬間でも通り抜けられることを保証できる。 */
function urchinDanger(urchins, shipR, px, py) {
  for (const u of urchins) {
    // 1.15 / TENTACLE_HIT_MUL は deep-sea-maze.js の checkEnemyHit と同じ値
    const hitR = u.r * (u.variant === 'tentacle' ? TENTACLE_HIT_MUL : 1.15) + shipR;
    const dx = u.moveX ? Math.max(0, Math.abs(px - u.x) - u.moveX) : px - u.x;
    if (Math.hypot(dx, py - u.y) <= hitR) return true;
  }
  return false;
}

function rasterPassable(stage, CELL) {
  const { width: W, height: H } = stage.mazeBounds;
  const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
  const passable = new Uint8Array(gw * gh);
  const shipR = stage.shipSize;
  for (const seg of stage.segments) {
    const halfW = seg.width / 2 - shipR;
    if (halfW <= 0) continue;
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
  return { passable, gw, gh };
}

// START から GOAL までの最短セル数。avoid=true ならウニを避ける。
function bfsCells(stage, CELL, grid, avoid) {
  const { passable, gw, gh } = grid;
  const urchins = (stage.enemies && stage.enemies.urchins) || [];
  const shipR = stage.shipSize;
  const toCell = (p) => [Math.max(0, Math.min(gw - 1, Math.floor(p.x / CELL))),
                         Math.max(0, Math.min(gh - 1, Math.floor(p.y / CELL)))];
  const [sx, sy] = toCell(stage.startPosition);
  const [gx, gy] = toCell(stage.goalPosition);
  const startIdx = sy * gw + sx, goalIdx = gy * gw + gx;
  if (avoid && urchinDanger(urchins, shipR, sx * CELL + CELL / 2, sy * CELL + CELL / 2)) return -1;
  const distArr = new Int32Array(gw * gh).fill(-1);
  distArr[startIdx] = 0;
  const q = [startIdx];
  let qi = 0;
  while (qi < q.length) {
    const cur = q[qi++];
    if (cur === goalIdx) return distArr[cur];
    const cx = cur % gw, cy = (cur / gw) | 0;
    const neigh = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const ni = ny * gw + nx;
      if (!passable[ni] || distArr[ni] >= 0) continue;
      if (avoid && urchinDanger(urchins, shipR, nx * CELL + CELL / 2, ny * CELL + CELL / 2)) continue;
      distArr[ni] = distArr[cur] + 1;
      q.push(ni);
    }
  }
  return -1;
}

// 1つの候補につきラスタライズは1回だけ。揺れ幅を詰めながら何度も
// 確かめるので、毎回作り直すと生成が極端に遅くなる。
function hazardChecker(stage) {
  const CELL = 6;
  const grid = rasterPassable(stage, CELL);
  const direct = bfsCells(stage, CELL, grid, false);
  return function () {
    const free = bfsCells(stage, CELL, grid, true);
    if (free < 0) return -1;                       // ウニを避けると到達不能
    return direct > 0 ? Math.round((free / direct - 1) * 100) : 0;
  };
}

// 緑のウニの揺れ幅は、そのステージで実際に通り抜けられる範囲まで詰める。
// 揺れて通る範囲すべてを危険とみなして検証するので、ここを通れば
// 「揺れのせいでいつまでも通れない」ことは起きない。
// あわせて、通せんぼが効いているか(迂回で道のりが伸びるか)も確かめる。
function validateHazards(stage, requireDetour) {
  const urchins = (stage.enemies && stage.enemies.urchins) || [];
  if (!urchins.length) return null;
  const test = hazardChecker(stage);
  const swaying = urchins.filter((u) => u.moveX);
  let extra = test();
  for (let k = 0; k < 8 && extra < 0 && swaying.length; k++) {
    let shrunk = false;
    for (const u of swaying) {
      if (u.moveX > 0.4) { u.moveX = Math.round(u.moveX * 0.6 * 10) / 10; shrunk = true; }
    }
    if (!shrunk) break;
    extra = test();
  }
  if (extra < 0 && swaying.length) {
    for (const u of swaying) u.moveX = 0;          // 最後は揺れなしで確かめる
    extra = test();
  }
  if (extra < 0) return 'ウニを避けるとSTARTからGOALへの経路が見つかりません';
  stage.stats.detourExtra = extra;
  stage.stats.swayKept = swaying.length ? Math.max(...swaying.map((u) => u.moveX)) : 0;
  if (requireDetour && extra < 6) return '通せんぼのウニが効いていません(迂回しても道のりが伸びない)';
  return null;
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
  // Stage1(t=0)はどんな指数でも te=0 になり従来どおり最小パラメータのまま。
  // 指数を1.3→0.62に下げて「序盤ほど速く」難化させ、Stage2の時点で
  // すでにマップが目に見えて広がり分岐も増えるようにする。
  const te = Math.pow(t, 0.62);

  const gw = Math.round(lerp2(4, 22, te));
  const gh = Math.round(lerp2(4, 28, te)) + (stageId % 3 === 0 ? 1 : 0);
  const spacing = lerp2(128, 94, te);
  const width = lerp2(74, 36, te);
  const branchBias = lerp2(0.12, 0.95, te);
  // extraLoopFraction は「すでに繋がっている2点を追加でつなぐ」処理のため、
  // 本来は行き止まりになるはずの別々の分岐同士が閉路でショートカットされ、
  // 「どちらを選んでも同じ1本道に合流する」状態を生んでしまう。分岐を
  // 複雑にする(選択を有効に保つ)ため、閉路の追加そのものをやめる。
  const extraLoopFraction = 0;
  const diagonalChance = lerp2(0, 0.42, te);
  const curveChance = lerp2(0.25, 0.72, te);
  const jitter = lerp2(8, 22, te);

  const band = Math.min(THEMES.length, Math.floor((stageId - 1) / 5) + 1);
  const fogRadius = stageId >= DARK_FROM_STAGE
    ? Math.round(lerp2(320, 180, (stageId - DARK_FROM_STAGE) / (TOTAL_STAGES - DARK_FROM_STAGE)))
    : 0;

  return {
    tier: band, gw, gh, spacing, width, branchBias, extraLoopFraction, diagonalChance, curveChance, jitter,
    theme: THEMES[band - 1], fogRadius
  };
}

/* ---------- 生成本体 ---------- */
const STAGES = [];
const ONLY = process.env.DSM_ONLY ? Number(process.env.DSM_ONLY) : 0;
for (let stageId = ONLY || 1; stageId <= (ONLY || TOTAL_STAGES); stageId++) {
  const tier = tierFor(stageId);
  if (process.env.DSM_TRACE) console.error('stage ' + stageId + ' start');
  let stage = null, err = null;
  // まずは「通せんぼがちゃんと効いている(迂回で道のりが伸びる)」ものを
  // 探し、どうしても見つからなければ条件を緩めて作り直す。
  for (let pass = 0; pass < 2 && !stage; pass++) {
    const requireDetour = pass === 0;
    for (let seedTry = 0; seedTry < 200 && !stage; seedTry++) {
      const rng = mulberry32(stageId * 92821 + seedTry * 733);
      if (process.env.DSM_TRACE) console.error('  pass=' + pass + ' seed=' + seedTry);
      const candidate = buildStage(stageId, rng, tier);
      err = validateStage(candidate) || validateHazards(candidate, requireDetour);
      if (!err) stage = candidate;
    }
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
    `diag=${st.diagonalEdges} width=${Math.round(st.corridorWidth)} ` +
    `迂回+${st.detourExtra}% 揺れ${st.swayKept} ` +
    `通せんぼ=${s.enemies.urchins.some((u) => u.blocker) ? 'あり' : 'なし'} ` +
    `だまし分岐=${st.falseLoop ? 'あり' : 'なし'} 回り道=${st.detourLoop ? 'あり' : 'なし'}`
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
