#!/usr/bin/env python3
"""index.html の CSS/JS 参照に、中身から作った版数(?v=)を付け直す。

GitHub Pages は静的ファイルをブラウザにキャッシュさせるため、版数を付けずに
更新すると、利用者には古い CSS/JS が読み込まれ続けて変更が反映されない。
このリポジトリの他のアプリ（payroll-system / timeclock）も同じ理由で
?v= を付けている。

手で番号を増やす運用だと付け忘れる（実際この作法は過去に一度漏れている）ため、
ファイルの内容そのもののハッシュを版数にする。中身が変われば版数も必ず変わり、
中身が同じなら版数も変わらない。

    python3 stamp-assets.py          # 付け直す
    python3 stamp-assets.py --check  # ずれていれば終了コード1（テスト用）
"""
import hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
# index.html が ?v= 付きで読み込むファイルはすべてここに並べる。
# 手で番号を増やす運用のまま残すと、そのファイルだけ付け忘れる。
ASSETS = [
    'style.css', 'levels.js', 'ura-levels.js', 'cloud.js', 'game.js',
    'game-select.js',
    'block-fit-puzzle.css', 'block-fit-puzzle.js', 'bf-levels.js',
    'deep-sea-maze.css', 'deep-sea-maze.js', 'dsm-levels.js',
]

def digest(name):
    return hashlib.sha1((ROOT / name).read_bytes()).hexdigest()[:10]

def images():
    return sorted(p.name for p in ROOT.iterdir() if p.suffix in ('.png', '.jpg'))

def stamp_images_in_js(write):
    """JS の中の画像参照( 'xxx.png' )にも版数を付け直す。

    画像はファイル名で参照しているので、中身を差し替えてもファイル名が同じ
    だと、ブラウザは古い画像を使い続ける。JS の中の文字列に ?v= を付ければ、
    画像が変わる → JS の中身が変わる → JS のハッシュが変わる → index.html の
    ?v= も変わる、と自動で連鎖する(手で番号を増やす場所を作らない)。
    """
    stale = []
    for js in [a for a in ASSETS if a.endswith('.js')]:
        path = ROOT / js
        before = path.read_text(encoding='utf-8')
        after = before
        for img in images():
            after = re.sub(r"(['\"])%s(?:\?v=[0-9a-f]+)?\1" % re.escape(img),
                           lambda m, i=img: '%s%s?v=%s%s' % (m.group(1), i, digest(i), m.group(1)),
                           after)
        if after != before:
            stale.append(js)
            if write:
                path.write_text(after, encoding='utf-8')
    return stale

def stamp(html):
    for name in ASSETS:
        html = re.sub(r'(["\'])%s(?:\?v=[0-9a-f]+)?\1' % re.escape(name),
                      lambda m: '%s%s?v=%s%s' % (m.group(1), name, digest(name), m.group(1)),
                      html)
    return html

def main():
    path = ROOT / 'index.html'
    check = '--check' in sys.argv
    # 画像の版数を先に JS へ入れる(JSの中身が変わるとハッシュも変わるため)
    stale_js = stamp_images_in_js(not check)
    before = path.read_text(encoding='utf-8')
    after = stamp(before)
    if check:
        if stale_js:
            print('画像の版数が JS と一致していません: ' + ', '.join(stale_js), file=sys.stderr)
            return 1
        if before == after:
            print('版数は最新です: ' + ', '.join('%s?v=%s' % (n, digest(n)) for n in ASSETS))
            return 0
        print('版数が中身と一致していません。stamp-assets.py を実行してください。', file=sys.stderr)
        for name in ASSETS:
            cur = re.search(r'%s\?v=([0-9a-f]+)' % re.escape(name), before)
            print('  %-21s 記載=%s  実際=%s' % (name, cur.group(1) if cur else '(なし)', digest(name)),
                  file=sys.stderr)
        return 1
    path.write_text(after, encoding='utf-8')
    print('更新: ' + ', '.join('%s?v=%s' % (n, digest(n)) for n in ASSETS))
    if stale_js:
        print('画像の版数を入れ直した JS: ' + ', '.join(stale_js))
    return 0

if __name__ == '__main__':
    sys.exit(main())
