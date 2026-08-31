"""裏ステージ選択ボタンの金属光沢CSSを作る。

磨いた金属の円柱と同じ見え方にする。左右の縁が暗く、内側に主ハイライトと
二次ハイライトが縦の帯として並ぶ（横方向のグラデーションなので帯は縦に走る）。
そこへ上辺の映り込みと、上下の陰影を重ねる。
"""

# 帯ごとの基準色（もみじの葉と同じ色）
BASE = {
    1: dict(name='緑', base='#4e9c33'),
    2: dict(name='黄', base='#f0c020'),
    3: dict(name='赤', base='#e02718'),
}


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in c)


def mix(a, b, t):
    ra, rb = hex2rgb(a), hex2rgb(b)
    return rgb2hex([ra[i] + (rb[i] - ra[i]) * t for i in range(3)])


def light(c, t):
    return mix(c, '#ffffff', t)


def dark(c, t):
    return mix(c, '#000000', t)


def ramp(base):
    """縦縞のクローム。円柱の研磨面と同じ見え方にする。

    左右の縁が暗く、内側に強いハイライトと二次ハイライトが縦の帯として並ぶ。
    磨いた金属の円柱は、光がこの並びで映り込む。
    横方向（90deg）のグラデーションなので、帯は縦に走る。
    """
    return ('linear-gradient(90deg,'
            ' %s 0%%,'      # 左の縁: 暗い
            ' %s 7%%,'
            ' %s 17%%,'
            ' %s 26%%,'     # 主ハイライト
            ' %s 35%%,'
            ' %s 46%%,'
            ' %s 57%%,'     # いったん落ちる
            ' %s 67%%,'
            ' %s 75%%,'     # 二次ハイライト
            ' %s 84%%,'
            ' %s 93%%,'
            ' %s 100%%)' % (
                dark(base, .48), dark(base, .22), light(base, .52), light(base, .88),
                light(base, .34), base, dark(base, .30), dark(base, .08),
                light(base, .46), light(base, .12), dark(base, .30), dark(base, .52)))


def sheen():
    """上下の陰影。上辺を少し明るく、下辺を少し暗くして厚みを出す。

    斜めのシャインは縦の帯と向きがぶつかって濁るので使わない。
    """
    return ('linear-gradient(180deg,'
            ' rgba(255,255,255,.28) 0%,'
            ' rgba(255,255,255,0) 22%,'
            ' rgba(0,0,0,0) 72%,'
            ' rgba(0,0,0,.22) 100%)')


def spec():
    """上辺に沿ってにじむ、細い映り込み。"""
    return ('radial-gradient(75% 26% at 50% 6%,'
            ' rgba(255,255,255,.55), rgba(255,255,255,0) 78%)')


def rule(sel, base):
    return (
        '%s {\n'
        '  background:\n'
        '    %s,\n'
        '    %s,\n'
        '    %s;\n'
        '  box-shadow: 0 4px 0 %s,\n'
        '              inset 0 1px 0 rgba(255,255,255,.85),\n'
        '              inset 0 -2px 0 rgba(255,255,255,.28),\n'
        '              inset 0 0 0 1px rgba(0,0,0,.20);\n'
        '  text-shadow: 0 1px 3px rgba(0,0,0,.55);\n'
        '}\n' % (sel, spec(), sheen(), ramp(base), dark(base, .62)))


def build_css(sel_fmt):
    """帯ごとのCSSを組み立てる。sel_fmt には %d で帯番号が入るセレクタを渡す。"""
    out = ['/* 裏ステージの選択ボタン。形はステージ1〜50と同じ角丸の四角のまま、',
           '   色をもみじの葉と同じ色にして縦縞のクローム光沢を乗せる。 */']
    for i, v in BASE.items():
        out.append('/* 裏%d〜%d: %sのもみじと同じ %s */' % (
            (i - 1) * 10 + 1, i * 10, v['name'], v['base']))
        out.append(rule(sel_fmt % i, v['base']).rstrip())
    return '\n'.join(out)
