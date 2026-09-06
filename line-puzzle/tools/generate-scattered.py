"""石が点在する（塊にならない）終盤ステージの候補を作る。

generate-pool.py の carve() は「経路が通らなかったマスをまとめてブロックにする」ため、
盤面の4割前後が一枚岩の石壁になり、実際に歩ける場所が細い通路に狭まっていた。
石が多いのに通路が一本道なので、見た目ほど難しくない。

ここでは経路と石を同時に、後戻りありで探索する。

  * 各手は「行けるところまで進む」か「途中で止めて、その一つ先に石を置く」
  * 未通過のマスが分断された時点でその枝を捨てる（連結性の枝刈り）
  * 石は隣り合わせにできる数を max_clump までに制限する

連結性の枝刈りのおかげで取り残しのポケットが生まれないため、盤面は
「経路 + 止まる理由の石」だけで埋まる。石は 1〜2 マスの粒として散らばり、
歩ける範囲が広いぶん分岐も手数も増える。

環境変数: PER_SIZE / BUDGET_SCALE / MAX_CLUMP / NODE_CAP
"""
import json, os, random, sys, time
from collections import deque

DIRS = [(0, -1), (0, 1), (-1, 0), (1, 0)]
DCH = 'UDLR'
sys.setrecursionlimit(100000)


# ---------------------------------------------------------------- 盤面の道具

def build(grid):
    """マスに通し番号を振り、各マスから4方向に伸びるマス列 ray を作る。"""
    cells = sorted(grid, key=lambda p: (p[1], p[0]))
    idx = {c: i for i, c in enumerate(cells)}
    ray = [[None] * 4 for _ in cells]
    for c in cells:
        i = idx[c]
        for d, (dx, dy) in enumerate(DIRS):
            x, y = c
            seq = []
            while (x + dx, y + dy) in grid:
                x, y = x + dx, y + dy
                seq.append(idx[(x, y)])
            ray[i][d] = seq
    return cells, idx, len(cells), ray


def rows_of(w, h, g):
    return [''.join('.' if (x, y) in g else '#' for x in range(w)) for y in range(h)]


def components(cells):
    """マス集合を連結成分に分ける。"""
    seen, out = set(), []
    for c in cells:
        if c in seen:
            continue
        comp = {c}
        seen.add(c)
        dq = deque([c])
        while dq:
            cx, cy = dq.popleft()
            for dx, dy in DIRS:
                nb = (cx + dx, cy + dy)
                if nb in cells and nb not in seen:
                    seen.add(nb)
                    comp.add(nb)
                    dq.append(nb)
        out.append(comp)
    return out


def scatter_stats(walls):
    """石のまばらさ。孤立している石の割合と、最大の塊の大きさ。"""
    if not walls:
        return 1.0, 0
    iso = sum(1 for (x, y) in walls
              if not any((x + dx, y + dy) in walls for dx, dy in DIRS))
    comps = components(set(walls))
    return iso / len(walls), max(len(c) for c in comps)


# ---------------------------------------------------------------- 生成

def generate(w, h, rng, node_cap, max_clump, min_blocks, max_blocks, p_stop):
    """全マス踏破の経路と、止まる理由の石を同時に決める。"""
    area = w * h
    inb = lambda p: 0 <= p[0] < w and 0 <= p[1] < h
    walls, painted = set(), set()
    start = (rng.randrange(w), rng.randrange(h))
    painted.add(start)
    moves = []
    nodes = [0]
    out = [None]

    def clump_ok(p):
        """石 p を足しても、つながった石の塊が max_clump を超えないか。"""
        comp = {p}
        dq = deque([p])
        while dq:
            cx, cy = dq.popleft()
            for dx, dy in DIRS:
                nb = (cx + dx, cy + dy)
                if nb in walls and nb not in comp:
                    comp.add(nb)
                    dq.append(nb)
                    if len(comp) > max_clump:
                        return False
        return True

    def rest_reachable(cur):
        """未通過のマスが1つのかたまりで、かつ現在地の隣から辿り着けるか。"""
        rest = {(x, y) for y in range(h) for x in range(w)
                if (x, y) not in painted and (x, y) not in walls}
        if not rest:
            return True
        seeds = [nb for nb in ((cur[0] + dx, cur[1] + dy) for dx, dy in DIRS) if nb in rest]
        if not seeds:
            return False
        seen = set(seeds)
        dq = deque(seeds)
        while dq:
            cx, cy = dq.popleft()
            for dx, dy in DIRS:
                nb = (cx + dx, cy + dy)
                if nb in rest and nb not in seen:
                    seen.add(nb)
                    dq.append(nb)
        return len(seen) == len(rest)

    def dfs(pos):
        nodes[0] += 1
        if nodes[0] > node_cap:
            return False
        if len(painted) + len(walls) == area:
            if min_blocks <= len(walls) <= max_blocks and len(moves) >= 10:
                out[0] = (set(walls), ''.join(DCH[d] for d in moves))
                return True
            return False
        opts = []
        for d, (dx, dy) in enumerate(DIRS):
            x, y = pos
            run = []
            while True:
                nb = (x + dx, y + dy)
                if not inb(nb) or nb in walls or nb in painted:
                    break
                x, y = nb
                run.append(nb)
            if run:
                opts.append((d, run))
        rng.shuffle(opts)
        for d, run in opts:
            dx, dy = DIRS[d]
            ks = list(range(1, len(run) + 1))
            rng.shuffle(ks)
            if len(ks) > 1 and rng.random() < p_stop:
                ks.sort(key=lambda k: k == len(run))    # 途中で止める案を先に試す
            for k in ks:
                stop = run[k - 1]
                wall = (stop[0] + dx, stop[1] + dy)
                need_wall = k < len(run)
                if need_wall and (len(walls) >= max_blocks or not clump_ok(wall)):
                    continue
                seg = run[:k]
                painted.update(seg)
                if need_wall:
                    walls.add(wall)
                if rest_reachable(stop):
                    moves.append(d)
                    if dfs(stop):
                        return True
                    moves.pop()
                if need_wall:
                    walls.discard(wall)
                painted.difference_update(seg)
        return False

    if dfs(start) and out[0]:
        walls_final, sol = out[0]
        grid = {(x, y) for y in range(h) for x in range(w) if (x, y) not in walls_final}
        return grid, start, walls_final, sol
    return None


# ---------------------------------------------------------------- 難易度の指標

def count_choices(ray, start, sol):
    """解答をなぞりながら、各手で「選べた方向の数-1」を合計する（迷いどころ）。"""
    pos, total = start, 0
    painted = bytearray(len(ray))
    painted[start] = 1
    for ch in sol:
        legal = 0
        for d in range(4):
            for j in ray[pos][d]:
                if painted[j]:
                    break
                legal += 1
                break
        total += max(0, legal - 1)
        for j in ray[pos][DCH.index(ch)]:
            if painted[j]:
                break
            painted[j] = 1
            pos = j
    return total


def shortest(n, ray, start, limit, node_cap):
    """limit 手以下の解を探す。見つかれば手順、無ければ None。

    打ち切った場合は ('capped', None) を返し、最短だと言い切れないことを伝える。
    """
    painted = bytearray(n)
    painted[start] = 1
    path = []
    nodes = [0]

    def dfs(pos, filled):
        if nodes[0] > node_cap:
            return 'capped'
        nodes[0] += 1
        if filled == n:
            return True
        if len(path) >= limit:
            return False
        capped = False
        for d in range(4):
            run = []
            for j in ray[pos][d]:
                if painted[j]:
                    break
                run.append(j)
            if not run:
                continue
            for j in run:
                painted[j] = 1
            path.append(DCH[d])
            r = dfs(run[-1], filled + len(run))
            if r is True:
                return True            # 見つけた手順は path に残したまま返す
            path.pop()
            for j in run:
                painted[j] = 0
            if r == 'capped':
                capped = True
        return 'capped' if capped else False

    r = dfs(start, 1)
    if r is True:
        return ''.join(path), False
    return None, (r == 'capped')


def replays(n, ray, start, sol):
    """手順をなぞって全マス塗れるか（空振りの手が無いか）を確かめる。"""
    if not sol:
        return False
    painted = bytearray(n)
    painted[start] = 1
    filled, pos = 1, start
    for ch in sol:
        moved = 0
        for j in ray[pos][DCH.index(ch)]:
            if painted[j]:
                break
            painted[j] = 1
            pos = j
            filled += 1
            moved += 1
        if not moved:
            return False
    return filled == n


def minimise(n, ray, start, sol, node_cap):
    """より短い解が無いか調べ、最短手順と「最短だと確認できたか」を返す。"""
    best = sol
    while True:
        shorter, capped = shortest(n, ray, start, len(best) - 1, node_cap)
        if shorter is None:
            return best, not capped
        assert replays(n, ray, start, shorter), "短い解の再生に失敗"
        best = shorter


# ---------------------------------------------------------------- 実行

if __name__ == '__main__':
    out_path = sys.argv[1]
    rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 20260830)
    # 裏の後半（裏21〜30）用に、本編より大きい盤面まで用意する。
    # マスは画面に合わせて縮むので、13x12 でも横320pxの端末で20px角に収まる。
    sizes = [(9, 9), (10, 9), (10, 10), (11, 10), (11, 11), (12, 11),
             (12, 12), (13, 11), (13, 12)]
    scale = float(os.environ.get('BUDGET_SCALE', '1'))
    budget = {(9, 9): 60, (10, 9): 70, (10, 10): 90, (11, 10): 110,
              (11, 11): 130, (12, 11): 150, (12, 12): 170, (13, 11): 180,
              (13, 12): 200}
    per_size = int(os.environ.get('PER_SIZE', '60'))
    max_clump = int(os.environ.get('MAX_CLUMP', '2'))
    node_cap = int(os.environ.get('NODE_CAP', '20000'))
    min_node_cap = int(os.environ.get('MIN_NODE_CAP', '300000'))

    pool = {}
    t0 = time.time()
    for (w, h) in sizes:
        area = w * h
        tend = time.time() + budget[(w, h)] * scale
        got = att = 0
        while time.time() < tend and got < per_size:
            att += 1
            r = generate(w, h, rng, node_cap, max_clump,
                         min_blocks=max(8, int(area * 0.07)),
                         max_blocks=int(area * 0.24),
                         p_stop=rng.uniform(0.35, 0.8))
            if not r:
                continue
            grid, start, walls, sol = r
            iso, big = scatter_stats(walls)
            cells, idx, n, ray = build(grid)
            s_i = idx[start]
            sol, proven = minimise(n, ray, s_i, sol, min_node_cap)
            assert replays(n, ray, s_i, sol), "手順の再生に失敗"
            key = (w, h, tuple(rows_of(w, h, grid)), start)
            if key in pool:
                continue
            pool[key] = {
                "w": w, "h": h, "g": rows_of(w, h, grid),
                "s": [start[0], start[1]], "sol": sol,
                "n": n, "L": len(sol), "holes": area - n,
                "choices": count_choices(ray, s_i, sol),
                "iso": round(iso, 3), "clump": big, "minproven": proven,
            }
            got += 1
        print(f"{w}x{h}: {got}/{att}  {time.time() - t0:.0f}s", flush=True)

    lv = list(pool.values())
    print("pool", len(lv))
    if lv:
        import statistics
        for k, label in [('n', 'マス数'), ('holes', '石の数'), ('L', '手数'),
                         ('choices', '迷い'), ('clump', '最大塊')]:
            print(f"  {label}: {min(v[k] for v in lv)} - {max(v[k] for v in lv)}"
                  f"  中央値 {statistics.median(v[k] for v in lv)}")
        print(f"  孤立率: 中央値 {statistics.median(v['iso'] for v in lv):.0%}")
        print(f"  最短を確認できたもの: {sum(1 for v in lv if v['minproven'])}/{len(lv)}")
    json.dump(lv, open(out_path, 'w'))
    print("wrote", out_path)
