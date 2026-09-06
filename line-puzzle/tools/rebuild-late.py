"""本編の11〜50と裏の11〜30だけを選び直して、少しずつ難しくする。

序盤（本編1〜10・裏1〜10）はルールを覚える帯なので、今のまま残す。
ここでは「後半だけを作り直す」ことに徹していて、既存のファイルから
残す分をそのまま読み、後ろの分だけを候補プールから選び直す。

    python3 rebuild-late.py pool.json scattered.json

難易度の指標
  n       : 塗るマスの数（盤面の大きさ）
  holes   : 石（お邪魔ブロック）の数
  L       : 最短手数
  choices : 正解手順上で「2方向以上選べた」回数の合計＝迷いどころ
  nodes   : 全解探索で辿ったノード数＝後戻りの多さ（本編のプールのみ）
  nsol    : 解の総数（少ないほど難しい）（本編のプールのみ）
"""
import json, math, re, statistics, sys
from collections import deque
from pathlib import Path

DIRS = [(0, -1), (0, 1), (-1, 0), (1, 0)]
DCH = 'UDLR'
ROOT = Path(__file__).resolve().parent.parent

KEEP_MAIN = 10      # 本編1〜10はそのまま
N_MAIN = 50
KEEP_URA = 10       # 裏1〜10はそのまま
N_URA = 30


# ---------------------------------------------------------------- 既存の読み書き

LEVEL_RE = re.compile(
    r'\{id:(\d+),w:(\d+),h:(\d+),g:\[(.*?)\],s:\[(\d+),(\d+)\],sol:"([A-Z]*)"\}')


def read_levels(path):
    out = []
    for m in LEVEL_RE.finditer(Path(path).read_text()):
        out.append({
            'id': int(m.group(1)), 'w': int(m.group(2)), 'h': int(m.group(3)),
            'g': [s.strip('"') for s in m.group(4).split(',')],
            's': [int(m.group(5)), int(m.group(6))], 'sol': m.group(7),
        })
    return out


def write_levels(path, header, varname, levels):
    js = header + 'window.%s = [\n' % varname
    for lv in levels:
        js += '  {id:%d,w:%d,h:%d,g:[%s],s:[%d,%d],sol:"%s"},\n' % (
            lv['id'], lv['w'], lv['h'],
            ','.join('"%s"' % r for r in lv['g']),
            lv['s'][0], lv['s'][1], lv['sol'])
    js += '];\n'
    Path(path).write_text(js)
    return len(js)


# ---------------------------------------------------------------- 検証

def verify(lv):
    """新ルールで解答を再生し、全マス塗れるか・盤面がつながっているかを確かめる。"""
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
                break
            p = nb
            painted.add(nb)
            steps += 1
        assert steps > 0, '空振りの手が含まれている'
    assert painted == grid, '全マス塗れていない %d/%d' % (len(painted), len(grid))
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


# ---------------------------------------------------------------- 選ぶ

def pick(cand, count, lo, hi, gamma):
    """難易度順に並べた候補から、下から上へ等間隔に count 件取る。

    lo/hi は取る範囲（0=いちばん易しい 1=いちばん難しい）。gamma>1 で後半ほど急に上がる。
    """
    chosen, used = [], set()
    for i in range(count):
        t = (i / (count - 1)) ** gamma if count > 1 else 0.0
        k = min(len(cand) - 1, int((lo + (hi - lo) * t) * (len(cand) - 1)))
        while k in used and k > 0:
            k -= 1
        while k in used and k < len(cand) - 1:
            k += 1
        used.add(k)
        chosen.append(cand[k])
    chosen.sort(key=lambda v: v['score'])
    return chosen


def pick_targets(bands, targets, used_ids=None):
    """狙った難度にいちばん近い候補を順に取る。

    bands は (候補リスト, その帯で使う件数) の並び。順位で切ると帯の変わり目で
    難度が段差になる（前の帯の一番上より、次の帯の一番下が低い）ため、
    ここでは「この番号はこのくらいの難しさ」を先に決めて、そこへ寄せる。
    """
    used = set() if used_ids is None else used_ids
    out, k = [], 0
    for cand, count in bands:
        for _ in range(count):
            want = targets[k]
            k += 1
            best, best_d = None, None
            for v in cand:
                if id(v) in used:
                    continue
                d = abs(v['score'] - want)
                if best_d is None or d < best_d:
                    best, best_d = v, d
            assert best is not None, '候補が足りない'
            used.add(id(best))
            out.append(best)
    return out


def ramp(count, lo, hi, gamma=1.0):
    """lo から hi へ、count 段の狙い値を作る。gamma>1 で後半ほど急に上がる。"""
    if count == 1:
        return [hi]
    return [lo + (hi - lo) * ((i / (count - 1)) ** gamma) for i in range(count)]


def main_score(v):
    return (1.0 * v['n'] + 1.6 * v['holes'] + 2.2 * v['choices']
            + 5.0 * math.log2(v['nodes'] + 1) - 3.0 * math.log2(v['nsol']))


def ura_score(v):
    """裏は手数と迷いどころを重く見る。"""
    return 1.0 * v['n'] + 3.0 * v['L'] + 6.0 * v['choices'] + 1.2 * v['holes']


def report(title, levels, extra=None):
    print('\n' + title)
    for lv in levels:
        line = '%3s %2dx%-3d マス%3d 石%3d %3d手' % (
            lv['id'], lv['w'], lv['h'],
            sum(r.count('.') for r in lv['g']),
            sum(r.count('#') for r in lv['g']), len(lv['sol']))
        if extra and lv['id'] in extra:
            line += extra[lv['id']]
        print(line)


# ---------------------------------------------------------------- 本編 11〜50

def rebuild_main(pool_path):
    pool = json.load(open(pool_path))
    for v in pool:
        v['score'] = main_score(v)

    keep = read_levels(ROOT / 'levels.js')[:KEEP_MAIN]
    assert len(keep) == KEEP_MAIN, '本編の1〜10が読めない'
    keep_grids = {tuple(lv['g']) for lv in keep}

    # 一本道（分岐なし＝考える余地がない）と、石が少なすぎる盤面は除く。
    # 「少しだけ難しく」なので、今より一段だけ条件を上げる:
    #   石は盤面の10%以上（これまでは8%）、迷いどころは中盤3つ・終盤4つ以上
    #   （これまでは2つ・3つ）。盤面を広げるだけだと歩く手間が増えるだけなので、
    #   分岐の数のほうを確実に確保する。
    def usable(v, min_choices, min_area):
        return (v['holes'] >= 6 and v['holes'] >= 0.10 * v['w'] * v['h']
                and v['choices'] >= min_choices and v['w'] * v['h'] >= min_area
                and tuple(v['g']) not in keep_grids)

    mid = sorted((v for v in pool if usable(v, 3, 72)), key=lambda v: v['score'])
    late = sorted((v for v in pool if usable(v, 4, 90)), key=lambda v: v['score'])
    print('本編の候補: 中盤(迷い3以上) %d件 / 終盤(迷い4以上) %d件' % (len(mid), len(late)))

    # 11〜30 は中盤の帯、31〜50 は終盤の帯（分岐がより多い）から選ぶ。
    # 「少しだけ難しく」なので、いまの11番(難度118)より少し上から始めて、
    # いまの50番(難度223)より少し上で終わる線を引き、そこへ寄せる。
    targets = ramp(40, 126.0, 228.0, 1.06)
    new = pick_targets([(mid, 20), (late, 20)], targets)

    out = list(keep)
    for i, v in enumerate(new, KEEP_MAIN + 1):
        lv = {'id': i, 'w': v['w'], 'h': v['h'], 'g': v['g'], 's': v['s'], 'sol': v['sol']}
        verify(lv)
        out.append(lv)
    assert len(out) == N_MAIN
    return out, new


# ---------------------------------------------------------------- 裏 11〜30

def rebuild_ura(scat_path):
    pool = json.load(open(scat_path))
    for v in pool:
        v['score'] = ura_score(v)

    keep = read_levels(ROOT / 'ura-levels.js')[:KEEP_URA]
    assert len(keep) == KEEP_URA, '裏の1〜10が読めない'
    keep_grids = {tuple(lv['g']) for lv in keep}
    keep_max = max(len(lv['sol']) for lv in keep)

    def usable(v, min_choices, min_moves, min_area):
        return (v['clump'] <= 2 and v['iso'] >= 0.45 and v['minproven']
                and v['choices'] >= min_choices and len(v['sol']) >= min_moves
                and v['holes'] >= 8 and v['w'] * v['h'] >= min_area
                and tuple(v['g']) not in keep_grids)

    # 段ごとに条件を上げる。裏1〜10 は 39〜43手なので、
    #   裏11〜20 … それより長い手数・迷いどころ4つ以上・110マス以上
    #   裏21〜30 … さらに長い手数・迷いどころ6つ以上・130マス以上（本編より大きい盤面）
    band2 = sorted((v for v in pool if usable(v, 4, keep_max + 1, 110)), key=lambda v: v['score'])
    band3 = sorted((v for v in pool if usable(v, 6, keep_max + 12, 130)), key=lambda v: v['score'])
    print('裏の候補: 裏11〜20用 %d件 / 裏21〜30用 %d件（裏1〜10は最長 %d手）'
          % (len(band2), len(band3), keep_max))
    assert len(band2) >= 10 and len(band3) >= 10, '候補が足りない'

    # 裏1〜10 の一番上（難度276）のすぐ上から始めて、候補の一番上まで一気に上げる
    targets = ramp(20, 285.0, 460.0, 1.15)
    new = pick_targets([(band2, 10), (band3, 10)], targets)

    out = list(keep)
    for i, v in enumerate(new, KEEP_URA + 1):
        lv = {'id': i, 'w': v['w'], 'h': v['h'], 'g': v['g'], 's': v['s'], 'sol': v['sol']}
        verify(lv)
        out.append(lv)
    assert len(out) == N_URA
    return out, new


if __name__ == '__main__':
    pool_path, scat_path = sys.argv[1], sys.argv[2]

    main_levels, main_new = rebuild_main(pool_path)
    ura_levels, ura_new = rebuild_ura(scat_path)

    extra = {}
    for lv, v in zip(main_levels[KEEP_MAIN:], main_new):
        extra[lv['id']] = ' 迷い%2d 探索%4d 解%3d 難度%6.1f' % (
            v['choices'], v['nodes'], v['nsol'], v['score'])
    report('== 本編 ==', main_levels, extra)

    extra = {}
    for lv, v in zip(ura_levels[KEEP_URA:], ura_new):
        extra[lv['id']] = ' 迷い%2d 孤立%3.0f%% 難度%6.1f' % (
            v['choices'], v['iso'] * 100, v['score'])
    report('== 裏 ==', ura_levels, extra)

    def band(levels, a, b):
        seg = levels[a - 1:b]
        return '%d〜%d: %d〜%d手 (中央値%.0f) / %d〜%dマス' % (
            a, b, min(len(l['sol']) for l in seg), max(len(l['sol']) for l in seg),
            statistics.median(len(l['sol']) for l in seg),
            min(sum(r.count('.') for r in l['g']) for l in seg),
            max(sum(r.count('.') for r in l['g']) for l in seg))

    print('\n本編  ' + band(main_levels, 1, 10))
    print('本編  ' + band(main_levels, 11, 30))
    print('本編  ' + band(main_levels, 31, 50))
    print('裏    ' + band(ura_levels, 1, 10))
    print('裏    ' + band(ura_levels, 11, 20))
    print('裏    ' + band(ura_levels, 21, 30))

    n1 = write_levels(
        ROOT / 'levels.js',
        '/* 自動生成: 全50ステージ（新ルールで解答可能であることを検証済み）\n'
        '   ルール: 壁・盤面の端・すでに通ったマス に当たるまで直進する\n'
        '   w,h: 盤面サイズ / g: \'.\'=通れるマス \'#\'=ブロック'
        ' / s:[x,y]=スタート / sol: 最短手順(U D L R) */\n',
        'LEVELS', main_levels)
    n2 = write_levels(
        ROOT / 'ura-levels.js',
        '/* 自動生成: 裏ステージ 全30面（新ルールで解答可能であることを検証済み）\n'
        '   本編50ステージをすべてクリアすると解放される、石が点在する難しい盤面。\n'
        '   w,h: 盤面サイズ / g: \'.\'=通れるマス \'#\'=石 / s:[x,y]=スタート'
        ' / sol: 最短手順(U D L R) */\n',
        'URA_LEVELS', ura_levels)
    print('\nwrote levels.js (%d bytes) / ura-levels.js (%d bytes)' % (n1, n2))
