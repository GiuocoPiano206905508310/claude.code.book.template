"""もみじ（イロハモミジ）のマス用SVGを作る。

参考にいただいた写真・イラストに合わせた作り。
  * 葉は左斜め上に開き、葉柄（軸）は右下へ伸ばす
    （ステージ1〜50の葉と同じ、左上→右下の対角の向き）
  * 濃い輪郭線は引かず、葉はベタ塗りのシルエット
  * 葉脈は葉と同系の少し濃い色の実線。基部から各裂片の先へ放射状に1本ずつ
  * 裂片の縁には細かい鋸歯（ギザギザ）を付ける
  * 中央の裂片の先を左上の角、葉柄の先を右下の角に届かせ、対角いっぱいに使う
  * 描いたあとに実寸を測り、縦横それぞれを正方形いっぱいに広げる
  * 裂片は根元が太く丸みを帯び、先へ向かって細く尖る（bulge_at で調整）
  * 中央の裂片がいちばん長く、葉柄側へ向かうほど短くなる（falloff で調整）

盤面の1マス＝葉1枚。CSS の背景画像として preserveAspectRatio='none' で
引き伸ばして使うため 100x100 の座標で描く。
"""
import math, json

PAD = 0.0          # 正方形の縁からの余白。0 で四辺に触れる


def pol(cx, cy, ang, r):
    return (cx + r * math.cos(ang), cy - r * math.sin(ang))


def f(p):
    return '%.1f %.1f' % p


def taper(p0, p1, w0, w1):
    """p0 側 w0・p1 側 w1 の太さで変化する帯（葉柄）を塗りのパスで返す。

    葉柄は葉との付け根(p0)を細く、先端(p1)を太くする。先端はマスの角に
    重なるので、太さのはみ出した分はマスの外として切り落とされる。
    """
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L, dx / L
    q = [(x0 + nx * w0 / 2, y0 + ny * w0 / 2),
         (x1 + nx * w1 / 2, y1 + ny * w1 / 2),
         (x1 - nx * w1 / 2, y1 - ny * w1 / 2),
         (x0 - nx * w0 / 2, y0 - ny * w0 / 2)]
    return 'M' + ' L'.join(f(pt) for pt in q) + ' Z'


def teeth_edge(p0, p1, n, depth):
    """2点のあいだを、外向きの鋸歯でつなぐ。もみじの縁のギザギザ。"""
    if n <= 0:
        return [p1]
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    if L < 1e-6:
        return [p1]
    nx, ny = -dy / L, dx / L
    pts = []
    for k in range(1, n + 1):
        t_v, t_p = (k - 0.5) / n, k / n
        pts.append((x0 + dx * t_v - nx * depth * L * 0.30,
                    y0 + dy * t_v - ny * depth * L * 0.30))
        if k < n:
            pts.append((x0 + dx * t_p + nx * depth * L,
                        y0 + dy * t_p + ny * depth * L))
    pts.append(p1)
    return pts


def maple(lobes=5, axis=135, R=66, notch=0.44, spread=196,
          falloff=0.08, bulge=0.15, bulge_at=0.32, stem_len=0.50,
          teeth=6, tooth=0.035, side_veins=True):
    """掌状のもみじ。axis=135 で左斜め上に開き、葉柄は反対の右下へ伸びる。

    bulge_at : 裂片のいちばん太いところが、切れ込みから先端までのどのあたりに
               来るか（0=切れ込み側、1=先端側）。小さいほど「根元が太くて丸く、
               先が細く尖る」もみじらしい裂片になる。
    """
    cx = cy = 50.0
    mid = (lobes - 1) / 2
    tip_len = [1.0 - falloff * (abs(i - mid) / mid) ** 1.6 for i in range(lobes)]

    half = math.radians(spread) / 2
    ax = math.radians(axis)
    tips = [ax - half + 2 * half * i / (lobes - 1) for i in range(lobes)]
    step = 2 * half / (lobes - 1)
    sin_ang = [tips[0] - step * 0.5]
    for i in range(lobes - 1):
        sin_ang.append((tips[i] + tips[i + 1]) / 2)
    sin_ang.append(tips[-1] + step * 0.5)

    # 葉の輪郭を閉じる点。葉柄側へずらすと、そこへ向かう細い出っ張りが
    # 葉から生えてしまうので、中心にそろえて閉じる。
    base = (cx, cy)

    def outline(tl):
        """裂片の長さ tl から葉の輪郭を組み立てる。

        切れ込みの深さは、隣り合う裂片の長さに比例させる。深さを一定にすると、
        短い裂片ほど切れ込みとの差が無くなって塊に見えてしまう。
        """
        sin_r = [R * notch * tl[0]]
        for i in range(lobes - 1):
            sin_r.append(R * notch * (tl[i] + tl[i + 1]) / 2)
        sin_r.append(R * notch * tl[-1])

        pts = [base, pol(cx, cy, sin_ang[0], sin_r[0])]
        for i in range(lobes):
            r_t = R * tl[i]
            p_s = pol(cx, cy, sin_ang[i], sin_r[i])
            p_t = pol(cx, cy, tips[i], r_t)
            p_e = pol(cx, cy, sin_ang[i + 1], sin_r[i + 1])
            r_s = (sin_r[i] + sin_r[i + 1]) / 2
            # いちばん太いところを切れ込み寄りに置き、先端へ向けて細く絞る
            a_l = sin_ang[i] + (tips[i] - sin_ang[i]) * bulge_at
            a_r = sin_ang[i + 1] + (tips[i] - sin_ang[i + 1]) * bulge_at
            r_w = (r_s + (r_t - r_s) * bulge_at) * (1 + bulge)
            m_l = pol(cx, cy, a_l, r_w)
            m_r = pol(cx, cy, a_r, r_w)
            pts += teeth_edge(p_s, m_l, teeth, tooth)
            pts += teeth_edge(m_l, p_t, teeth, tooth)
            pts += teeth_edge(p_t, m_r, teeth, tooth)
            pts += teeth_edge(m_r, p_e, teeth, tooth)
        pts.append(base)
        return pts

    pts = outline(tip_len)

    # 中央の裂片は左上の角まで届かせる。
    # 角にいちばん近い点が別の裂片になっていると、引き伸ばしても角に触れない。
    # 中央の裂片の先が縦にも横にもいちばん外側になる長さまで伸ばしてから組み直す。
    ci = (lobes - 1) // 2
    cd = (math.cos(tips[ci]), -math.sin(tips[ci]))
    if lobes % 2 == 1 and cd[0] < -1e-6 and cd[1] < -1e-6:
        others = [p for p in pts]
        need = max((min(p[0] for p in others) - cx) / cd[0],
                   (min(p[1] for p in others) - cy) / cd[1])
        want = (need + 0.5) / R
        if want > tip_len[ci]:
            tip_len[ci] = want
            pts = outline(tip_len)

    mains, sides = [], []
    for i in range(lobes):
        r_t = R * tip_len[i]
        mains.append((pol(cx, cy, tips[i], r_t * 0.12), pol(cx, cy, tips[i], r_t * 0.88)))
        if not side_veins or tip_len[i] < 0.84:
            continue
        # 側脈の開き角は裂片の幅に合わせる。固定角にすると裂片の数が多いとき
        # 隣の切れ込みへはみ出してしまう
        for u in (0.44, 0.64):
            for sg in (+1, -1):
                a = tips[i] + sg * step * 0.34
                sides.append((pol(cx, cy, tips[i], r_t * u),
                              pol(cx, cy, a, r_t * (u + 0.11))))
    # 葉柄は右下の角まで届かせる。
    # 角に一番近い点が裂片の先になっていると、引き伸ばしたときに葉柄が角に触れない。
    # 葉柄の先が縦横とも最大になる長さを求めてから伸ばす。
    sd = (math.cos(ax + math.pi), -math.sin(ax + math.pi))
    leafpts = list(pts) + [p for seg in mains + sides for p in seg]
    need = 0.0
    if sd[0] > 1e-6:
        need = max(need, (max(p[0] for p in leafpts) - cx) / sd[0])
    if sd[1] > 1e-6:
        need = max(need, (max(p[1] for p in leafpts) - cy) / sd[1])
    L = max(R * stem_len, need + 0.5)
    stem = ((cx, cy), (cx + sd[0] * L, cy + sd[1] * L))

    # ---- 正方形いっぱいに広げる ----
    # 葉と葉柄の外接矩形を測り、縦横それぞれを 0〜100 ぴったりに伸ばす。
    # 縦横で別々の倍率をかけるので、裂片の先と葉柄の先が四辺に触れる。
    # マスの背景画像は preserveAspectRatio='none' で引き伸ばして使うため、
    # ここで縦横比を変えても実際の見た目は破綻しない。
    allpts = list(pts) + [p for seg in mains + sides + [stem] for p in seg]
    xs = [p[0] for p in allpts]
    ys = [p[1] for p in allpts]
    x0, y0 = min(xs), min(ys)
    w, h = max(xs) - x0, max(ys) - y0
    room = 100 - 2 * PAD
    kx = room / w if w > 0 else 1.0
    ky = room / h if h > 0 else 1.0

    def fit(p):
        return ((p[0] - x0) * kx + PAD, (p[1] - y0) * ky + PAD)

    d = 'M' + ' L'.join(f(fit(p)) for p in pts) + ' Z'
    mains_d = ['M%s L%s' % (f(fit(a)), f(fit(b))) for a, b in mains]
    sides_d = ['M%s L%s' % (f(fit(a)), f(fit(b))) for a, b in sides]
    stem_d = taper(fit(stem[0]), fit(stem[1]), 2.0, 3.0)
    return d, mains_d, sides_d, stem_d


def svg_cell(base, leaf, stemcol, vein, **kw):
    d, mains, sides, stem = maple(**kw)
    body = "<rect width='100' height='100' fill='%s'/>" % base
    body += "<path d='%s' fill='%s'/>" % (stem, stemcol)
    body += "<path d='%s' fill='%s'/>" % (d, leaf)
    # 葉脈。葉の形で切り抜いて、縁からはみ出さないようにする
    body += "<defs><clipPath id='lf'><path d='%s'/></clipPath></defs>" % d
    body += ("<g clip-path='url(#lf)' fill='none' stroke='%s' stroke-linecap='round'>"
             "<g stroke-width='1.3' opacity='.85'>%s</g>"
             "<g stroke-width='0.85' opacity='.7'>%s</g>"
             "</g>") % (vein,
                        ''.join("<path d='%s'/>" % p for p in mains),
                        ''.join("<path d='%s'/>" % p for p in sides))
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' "
            "preserveAspectRatio='none'>%s</svg>") % body


# 裏1-10 緑 / 裏11-20 黄 / 裏21-30 赤
# 地の色は帯ごとに、葉と同系の濃い色にする。
BANDS = {
    'green':  dict(base='#2a5c2c', leaf='#4e9c33', stemcol='#3f7d2a', vein='#2f6b1e'),
    'yellow': dict(base='#8a5f0f', leaf='#f0c020', stemcol='#c79a15', vein='#c2930d'),
    'red':    dict(base='#6f1c18', leaf='#e02718', stemcol='#b81f12', vein='#a5150a'),
}

VARIANTS = {
    # 採用: 7裂・切れ込み多め。参考写真のもみじに近い形
    'B': dict(lobes=7, R=66, notch=0.42, spread=192, bulge=0.22, bulge_at=0.30,
              falloff=0.40, teeth=5, side_veins=False),
}


def overflow(paths):
    """与えたパスの全座標を見て、0〜100 をどれだけはみ出しているかを返す。"""
    import re
    worst = 0.0
    for d in paths:
        for x in re.findall(r'-?\d+\.?\d*', d):
            v = float(x)
            worst = max(worst, v - 100, -v)
    return max(worst, 0.0)
