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
ASSETS = ['style.css', 'levels.js', 'game.js']

def digest(name):
    return hashlib.sha1((ROOT / name).read_bytes()).hexdigest()[:10]

def stamp(html):
    for name in ASSETS:
        html = re.sub(r'(["\'])%s(?:\?v=[0-9a-f]+)?\1' % re.escape(name),
                      lambda m: '%s%s?v=%s%s' % (m.group(1), name, digest(name), m.group(1)),
                      html)
    return html

def main():
    path = ROOT / 'index.html'
    before = path.read_text(encoding='utf-8')
    after = stamp(before)
    if '--check' in sys.argv:
        if before == after:
            print('版数は最新です: ' + ', '.join('%s?v=%s' % (n, digest(n)) for n in ASSETS))
            return 0
        print('版数が中身と一致していません。stamp-assets.py を実行してください。', file=sys.stderr)
        for name in ASSETS:
            cur = re.search(r'%s\?v=([0-9a-f]+)' % re.escape(name), before)
            print('  %-11s 記載=%s  実際=%s' % (name, cur.group(1) if cur else '(なし)', digest(name)),
                  file=sys.stderr)
        return 1
    path.write_text(after, encoding='utf-8')
    print('更新: ' + ', '.join('%s?v=%s' % (n, digest(n)) for n in ASSETS))
    return 0

if __name__ == '__main__':
    sys.exit(main())
