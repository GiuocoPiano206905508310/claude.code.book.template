"""裏ステージのもみじと選択ボタンのCSSを作り、style.css の該当箇所を書き換える。

もみじのマス絵（momiji.py）と選択ボタンの金属光沢（metal.py）は、色の段を細かく
刻むため手書きだと崩れやすい。ここで組み立てて style.css の
「自動生成」マーカーのあいだだけを差し替える。

    python3 gen-ura-style.py          # style.css を書き換える
    python3 gen-ura-style.py --check  # ずれていれば終了コード1
"""
import sys, urllib.parse
from pathlib import Path

import momiji
import metal

BEGIN = '/* === 自動生成: 裏ステージのもみじと選択ボタン (tools/gen-ura-style.py) === */'
END = '/* === ここまで自動生成 === */'

# 裏1-10 緑 / 裏11-20 黄 / 裏21-30 赤
BANDS = [('green', '裏1〜10 緑のもみじ'), ('yellow', '裏11〜20 黄のもみじ'),
         ('red', '裏21〜30 赤のもみじ')]
# 薄い地の上でもマスの境目が分かるよう、控えめな暗い輪郭にする
OUTLINE = {'green': 'rgba(15,50,14,.34)', 'yellow': 'rgba(85,55,6,.34)',
           'red': 'rgba(60,14,11,.36)'}


def datauri(svg):
    return 'url("data:image/svg+xml,%s")' % urllib.parse.quote(svg, safe="/:=' ")


def build():
    out = [BEGIN, '']
    out.append('/* 裏ステージのマス。1マス＝もみじ1枚。葉は左斜め上に開き、葉柄は右下の角へ。 */')
    for i, (key, label) in enumerate(BANDS, 1):
        col = momiji.BANDS[key]
        svg = momiji.svg_cell(**col, **momiji.VARIANTS['B'])
        out.append('/* %s */' % label)
        out.append('.board.ura-band-%d {' % i)
        out.append('  --leaf-base: %s;' % col['base'])
        out.append('  --leaf-veins: %s;' % datauri(svg))
        out.append('  --leaf-outline: %s;' % OUTLINE[key])
        out.append('}')
    out.append('')
    out.append(metal.build_css('.stage-btn.is-cleared.ura-band-%d'))
    out.append(END)
    return '\n'.join(out) + '\n'


def main():
    css_path = Path(__file__).resolve().parent.parent / 'style.css'
    css = css_path.read_text(encoding='utf-8')
    assert BEGIN in css and END in css, 'style.css に自動生成のマーカーがない'
    head, rest = css.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    new = head + build() + tail.lstrip('\n')
    if '--check' in sys.argv:
        if new != css:
            print('style.css の自動生成部分がずれています。'
                  'python3 tools/gen-ura-style.py を実行してください。')
            return 1
        print('style.css の自動生成部分は最新です。')
        return 0
    css_path.write_text(new, encoding='utf-8')
    print('wrote', css_path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
