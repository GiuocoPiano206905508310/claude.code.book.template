#!/usr/bin/env python3
"""index.html / style.css / levels.js / game.js を1枚のHTMLにまとめる。

「HTMLを1ファイルだけ置ける配布先」に載せるとき用。
既定では <!doctype>/<html>/<head>/<body> を含まない本文だけを出力する
（配布先が用意する head に取り込まれる形式）。
--standalone を付けると、単体でブラウザで開ける完全なHTMLを書き出す。

  python3 build-single-file.py out.html
  python3 build-single-file.py out.html --standalone
"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
read = lambda name: (root / name).read_text(encoding='utf-8')
html, css, levels, game = read('index.html'), read('style.css'), read('levels.js'), read('game.js')

for code in (css, levels, game):
    for token in ('</script>', '</style>'):
        assert token not in code, '埋め込むコードに %s が含まれている' % token

body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
title = re.search(r'<title>(.*?)</title>', html, re.S).group(1)

# 外部参照の script タグを、中身をそのまま埋め込んだ script に置き換える
inline = '<script>\n%s</script>\n<script>\n%s</script>' % (levels, game)
body, hit = re.subn(r'<script src="levels\.js"></script>\s*<script src="game\.js"></script>',
                    lambda m: inline, body)
assert hit == 1, 'script タグを置換できなかった'

out = '<title>%s</title>\n<style>\n%s</style>\n%s\n' % (title, css, body.strip())

if '--standalone' in sys.argv:
    out = ('<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1.0, '
           'maximum-scale=1.0, user-scalable=no, viewport-fit=cover">\n'
           '<meta name="theme-color" content="#3f9a45">\n'
           '<style>body{margin:0}[hidden]{display:none!important}</style>\n'
           + out.split('\n', 1)[0] + '\n' + out.split('\n', 1)[1].split('</style>')[0]
           + '</style>\n</head>\n<body>\n'
           + out.split('</style>\n', 1)[1] + '</body>\n</html>\n')

dest = next((a for a in sys.argv[1:] if not a.startswith('--')), None)
if dest:
    pathlib.Path(dest).write_text(out, encoding='utf-8')
    print('wrote %s (%.1f KB)' % (dest, len(out.encode()) / 1024))
else:
    sys.stdout.write(out)
