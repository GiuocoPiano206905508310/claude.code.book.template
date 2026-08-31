"""裏ステージ（裏1〜30）を候補プールから選んで ura-levels.js を書き出す。

裏ステージは本編50ステージをすべてクリアすると解放される、石が点在する難しい盤面。
候補は generate-scattered.py で作る（石が1〜2マスの粒として散らばり、歩ける範囲が
広いぶん分岐も手数も多い）。

    python3 generate-scattered.py scattered.json
    python3 build-ura-levels.py scattered.json ../ura-levels.js

難易度の指標
  n       : 塗るマスの数
  L       : 最短手数（長いほど先の見通しが要る）
  choices : 正解手順上で「2方向以上選べた」回数の合計＝迷いどころ
  holes   : 石の数
  iso     : 孤立している石の割合＝まばらさ
"""
import json, sys
from collections import deque

DIRS = [(0, -1), (0, 1), (-1, 0), (1, 0)]
DCH = 'UDLR'
N_URA = 30


def verify(lv):
    """新ルールで解答を再生し、全マス塗れるか確認する。"""
    w, h, rows = lv['w'], lv['h'], lv['g']
    assert len(rows) == h and all(len(r) == w for r in rows), '盤面の形が w,h と合わない'
    grid = {(x, y) for y in range(h) for x in range(w) if rows[y][x] == '.'}
    p = (lv['s'][0], lv['s'][1])
    assert p in grid, 'スタートが石の上'
    painted = {p}
    for ch in lv['sol']:
        dx, dy = DIRS[DCH.index(ch)]
        steps = 0
        while True:
            nb = (p[0] + dx, p[1] + dy)
            if nb not in grid or nb in painted:
                break                       # 石・盤面の端・通過済み で止まる
            p = nb
            painted.add(nb)
            steps += 1
        assert steps > 0, '空振りの手が含まれている'
    assert painted == grid, f'全マス塗れていない {len(painted)}/{len(grid)}'
    s = next(iter(grid))
    seen, dq = {s}, deque([s])
    while dq:
        cx, cy = dq.popleft()
        for dx, dy in DIRS:
            nb = (cx + dx, cy + dy)
            if nb in grid and nb not in seen:
                seen.add(nb)
                dq.append(nb)
    assert len(seen) == len(grid), '盤面が分断されている'


def stone_stats(lv):
    w, h, rows = lv['w'], lv['h'], lv['g']
    walls = {(x, y) for y in range(h) for x in range(w) if rows[y][x] == '#'}
    if not walls:
        return 0, 1.0, 0
    iso = sum(1 for (x, y) in walls
              if not any((x + dx, y + dy) in walls for dx, dy in DIRS))
    seen, biggest = set(), 0
    for c in walls:
        if c in seen:
            continue
        comp, dq = {c}, deque([c])
        seen.add(c)
        while dq:
            cx, cy = dq.popleft()
            for dx, dy in DIRS:
                nb = (cx + dx, cy + dy)
                if nb in walls and nb not in seen:
                    seen.add(nb)
                    comp.add(nb)
                    dq.append(nb)
        biggest = max(biggest, len(comp))
    return len(walls), iso / len(walls), biggest


def score(v):
    """裏ステージの難易度。手数と迷いどころを重く見る。"""
    return 1.0 * v['n'] + 3.0 * v['L'] + 6.0 * v['choices'] + 1.2 * v['holes']


def main():
    pool = json.load(open(sys.argv[1]))
    out_path = sys.argv[2]

    cand = [v for v in pool
            if v['clump'] <= 2 and v['iso'] >= 0.45 and v['minproven']
            and v['choices'] >= 3 and v['holes'] >= 8
            and v['w'] * v['h'] >= 90]
    print(f'候補 {len(cand)}/{len(pool)} 件'
          f'（最大塊2以下・孤立率45%以上・最短確認済み・迷い3以上・石8個以上・90マス以上）')
    assert len(cand) >= N_URA, f'候補が足りない ({len(cand)} < {N_URA})'

    for v in cand:
        v['score'] = score(v)
    cand.sort(key=lambda v: v['score'])

    # 難易度がなだらかに上がるよう、下から上まで均等に間引いて選ぶ
    chosen, used = [], set()
    for i in range(N_URA):
        t = (i / (N_URA - 1)) ** 1.05
        pct = 0.22 + (1.00 - 0.22) * t
        k = min(len(cand) - 1, int(pct * (len(cand) - 1)))
        while k in used and k > 0:
            k -= 1
        while k in used and k < len(cand) - 1:
            k += 1
        used.add(k)
        chosen.append(cand[k])
    chosen.sort(key=lambda v: v['score'])

    out = []
    print(f"\n{'裏':>3} {'盤面':>6} {'マス':>4} {'石':>3} {'孤立':>5} {'塊':>3} {'手数':>4} {'迷い':>4}")
    for i, v in enumerate(chosen, 1):
        lv = {'id': i, 'w': v['w'], 'h': v['h'], 'g': v['g'], 's': v['s'], 'sol': v['sol']}
        verify(lv)
        out.append(lv)
        nb, iso, big = stone_stats(lv)
        print(f'{i:3d} {v["w"]:2d}x{v["h"]:<3d} {v["n"]:4d} {nb:3d} '
              f'{iso * 100:4.0f}% {big:3d} {len(v["sol"]):4d} {v["choices"]:4d}')

    js = ('/* 自動生成: 裏ステージ 全30面（新ルールで解答可能であることを検証済み）\n'
          '   本編50ステージをすべてクリアすると解放される、石が点在する難しい盤面。\n'
          '   w,h: 盤面サイズ / g: \'.\'=通れるマス \'#\'=石 / s:[x,y]=スタート'
          ' / sol: 最短手順(U D L R) */\n'
          'window.URA_LEVELS = [\n')
    for lv in out:
        js += '  {id:%d,w:%d,h:%d,g:[%s],s:[%d,%d],sol:"%s"},\n' % (
            lv['id'], lv['w'], lv['h'],
            ','.join('"%s"' % r for r in lv['g']),
            lv['s'][0], lv['s'][1], lv['sol'])
    js += '];\n'
    open(out_path, 'w').write(js)
    print('\nwrote', out_path, len(js), 'bytes')


if __name__ == '__main__':
    main()
