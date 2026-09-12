/* 深海迷路: 全ステージの「コース全体像」を1枚のページで見るためのデータを作る。

   使い方: node tools/dsm-maps.mjs > tools/dsm-maps.out.js

   dsm-levels.js を読み、通路・START・GOAL・ウニ・最短ルートを座標だけに
   切り詰めて書き出す。描画専用なので座標は整数に丸め、ルートも間引く。
   当たり判定そのものではないため、ここでの通行判定が本番と 1px 違っても
   ゲームの挙動には影響しない(本番の判定は deep-sea-maze.js が持つ)。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const src = fs.readFileSync(path.join(root, 'dsm-levels.js'), 'utf8');
const sandbox = { window: {} };
new Function('window', src)(sandbox.window);
const STAGES = sandbox.window.DSM_LEVELS;

/* ---------- 通行判定(deep-sea-maze.js の isPassable と同じ考え方) ---------- */
const BUCKET = 90;
const RING = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)];
});
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len > 0 ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function buildIndex(stage) {
  const subs = [], map = new Map();
  for (const seg of stage.segments) {
    const halfW = seg.width / 2;
    for (let i = 0; i < seg.points.length - 1; i++) {
      const sg = { ax: seg.points[i][0], ay: seg.points[i][1],
                   bx: seg.points[i + 1][0], by: seg.points[i + 1][1], halfW };
      const id = subs.push(sg) - 1;
      const x0 = Math.min(sg.ax, sg.bx) - halfW, x1 = Math.max(sg.ax, sg.bx) + halfW;
      const y0 = Math.min(sg.ay, sg.by) - halfW, y1 = Math.max(sg.ay, sg.by) + halfW;
      for (let cy = Math.floor(y0 / BUCKET); cy <= Math.floor(y1 / BUCKET); cy++) {
        for (let cx = Math.floor(x0 / BUCKET); cx <= Math.floor(x1 / BUCKET); cx++) {
          const k = cx + '_' + cy;
          let arr = map.get(k);
          if (!arr) { arr = []; map.set(k, arr); }
          arr.push(id);
        }
      }
    }
  }
  return { subs, map };
}
const buf = [];
function near(ix, x, y) {
  buf.length = 0;
  const cx = Math.floor(x / BUCKET), cy = Math.floor(y / BUCKET);
  for (let gy = cy - 1; gy <= cy + 1; gy++) {
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const arr = ix.map.get(gx + '_' + gy);
      if (arr) for (const id of arr) buf.push(ix.subs[id]);
    }
  }
  return buf;
}
function inside(ix, x, y) {
  const list = near(ix, x, y);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (distSeg(x, y, s.ax, s.ay, s.bx, s.by) <= s.halfW) return true;
  }
  return false;
}
function passable(ix, r, x, y) {
  const list = near(ix, x, y);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (distSeg(x, y, s.ax, s.ay, s.bx, s.by) <= s.halfW - r) return true;
  }
  if (!inside(ix, x, y)) return false;
  for (const [rx, ry] of RING) if (!inside(ix, x + rx * r, y + ry * r)) return false;
  return true;
}

/* ---------- START→GOAL の最短ルート(表示用) ---------- */
const CELL = 6;
function route(stage) {
  const ix = buildIndex(stage);
  const gw = Math.ceil(stage.mazeBounds.width / CELL) + 2;
  const gh = Math.ceil(stage.mazeBounds.height / CELL) + 2;
  const cache = new Int8Array(gw * gh).fill(-1);
  const ok = (gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return 0;
    const i = gy * gw + gx;
    if (cache[i] < 0) cache[i] = passable(ix, stage.shipSize, gx * CELL, gy * CELL) ? 1 : 0;
    return cache[i];
  };
  const si = Math.round(stage.startPosition.x / CELL), sj = Math.round(stage.startPosition.y / CELL);
  if (!ok(si, sj)) return [];
  const reach = stage.goalRadius - stage.shipSize * 0.3;
  const prev = new Int32Array(gw * gh).fill(-2);
  const start = sj * gw + si;
  prev[start] = -1;
  const q = [start];
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const cur = q[h], cx = cur % gw, cy = (cur / gw) | 0;
    if (Math.hypot(cx * CELL - stage.goalPosition.x, cy * CELL - stage.goalPosition.y) <= reach) { hit = cur; break; }
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      const ni = ny * gw + nx;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh || prev[ni] !== -2 || !ok(nx, ny)) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (hit < 0) return [];
  const pts = [];
  for (let c = hit; c >= 0; c = prev[c]) pts.push([(c % gw) * CELL, ((c / gw) | 0) * CELL]);
  pts.reverse();
  return simplify(pts, 5);
}
// Ramer-Douglas-Peucker。BFS の階段状の線をなめらかな折れ線に間引く。
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  let far = 0, best = -1;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distSeg(pts[i][0], pts[i][1], ax, ay, bx, by);
    if (d > far) { far = d; best = i; }
  }
  if (far <= eps) return [pts[0], pts[pts.length - 1]];
  return simplify(pts.slice(0, best + 1), eps).slice(0, -1).concat(simplify(pts.slice(best), eps));
}

/* ---------- 書き出し ---------- */
const R = (v) => Math.round(v);
const maps = STAGES.map((st) => {
  const urchins = st.enemies.urchins || [];
  return {
    i: st.stageId,
    w: R(st.mazeBounds.width), h: R(st.mazeBounds.height),
    sh: R(st.shipSize),
    s: [R(st.startPosition.x), R(st.startPosition.y)],
    g: [R(st.goalPosition.x), R(st.goalPosition.y), R(st.goalRadius)],
    sg: st.segments.map((seg) => [R(seg.width / 2)].concat(seg.points.flatMap((p) => [R(p[0]), R(p[1])]))),
    ur: urchins.map((u) => [R(u.x), R(u.y), R(u.r), R(u.moveX || 0), u.blocker ? 1 : 0, u.variant === 'tentacle' ? 1 : 0]),
    rt: route(st).flatMap((p) => [p[0], p[1]]),
    st: {
      route: st.stats.routeLength, walk: st.stats.walkLength,
      detour: st.stats.detourExtra, junctions: st.stats.junctions,
      deadEnds: st.stats.deadEnds, width: st.stats.corridorWidth,
    },
  };
});
process.stdout.write('window.DSM_MAPS = ' + JSON.stringify(maps) + ';\n');
process.stderr.write('stages ' + maps.length + ' / route欠け ' + maps.filter((m) => !m.rt.length).length + '\n');
