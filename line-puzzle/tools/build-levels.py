"""候補プールから、難易度が単調に上がる50ステージを選んで levels.js を書き出す。

難易度の指標
  n       : 塗るマスの数（盤面の大きさ）
  holes   : お邪魔ブロックの数
  choices : 正解手順上で「2方向以上選べた」回数の合計＝迷いどころ
  nodes   : 全解探索で辿ったノード数＝後戻りの多さ
  nsol    : 解の総数（少ないほど難しい）
"""
import json, sys, math
from collections import deque
DIRS=[(0,-1),(0,1),(-1,0),(1,0)]; DCH='UDLR'

pool=json.load(open(sys.argv[1]))
print("pool", len(pool))

def score(v):
    return (1.0*v['n'] + 1.6*v['holes'] + 2.2*v['choices']
            + 5.0*math.log2(v['nodes']+1) - 3.0*math.log2(v['nsol']))

for v in pool: v['score']=score(v)

# お邪魔ブロックが少なすぎる盤面（ただ一周するだけ）と、
# 一本道（分岐なし＝考える余地がない）盤面は除く。
# 最初の数ステージだけは、分岐1つの易しい帯からも選べるようにする。
MIN_BLOCKS = 4
def usable(v, min_choices):
    return v['holes'] >= MIN_BLOCKS and v['holes'] >= 0.08*v['w']*v['h'] and v['choices'] >= min_choices
easy = sorted((v for v in pool if usable(v, 1)), key=lambda v: v['score'])
hard = sorted((v for v in pool if usable(v, 2)), key=lambda v: v['score'])
print(f"分岐1つ以上 {len(easy)}件 / 分岐2つ以上 {len(hard)}件（ブロック{MIN_BLOCKS}個以上）")

N=50
TUTORIAL=4          # 最初の数ステージはルールを覚えるための易しめの帯から選ぶ
chosen=[]; usedH=set(); usedE=set()
for i in range(N):
    if i < TUTORIAL:
        src, seen = easy, usedE
        pct = 0.05 + (0.25-0.05)*(i/(TUTORIAL-1))
    else:
        src, seen = hard, usedH
        t=((i-TUTORIAL)/(N-1-TUTORIAL))**1.15
        pct = 0.30 + (1.00-0.30)*t
    k=min(len(src)-1, int(pct*(len(src)-1)))
    # 既に選んだものと重ならない最も近い候補へずらす
    while k in seen and k>0: k-=1
    while k in seen and k<len(src)-1: k+=1
    seen.add(k); chosen.append(src[k])
chosen.sort(key=lambda v: v['score'])

# ---- 検証: 新ルールで解答を再生し、全マス塗れるか確認 ----
def verify(lv):
    w,h,rows=lv['w'],lv['h'],lv['g']
    grid={(x,y) for y in range(h) for x in range(w) if rows[y][x]=='.'}
    p=(lv['s'][0],lv['s'][1])
    assert p in grid, "スタートが壁の上"
    painted={p}
    for ch in lv['sol']:
        dx,dy=DIRS[DCH.index(ch)]; steps=0
        while True:
            nb=(p[0]+dx,p[1]+dy)
            if nb not in grid or nb in painted: break   # 通過済みも壁扱い
            p=nb; painted.add(nb); steps+=1
        assert steps>0, "空振りの手が含まれている"
    assert painted==grid, f"全マス塗れていない {len(painted)}/{len(grid)}"
    s=next(iter(grid)); seen={s}; dq=deque([s])
    while dq:
        cx,cy=dq.popleft()
        for dx,dy in DIRS:
            nb=(cx+dx,cy+dy)
            if nb in grid and nb not in seen: seen.add(nb); dq.append(nb)
    assert len(seen)==len(grid), "盤面が分断されている"

out=[]
for i,v in enumerate(chosen,1):
    lv={"id":i,"w":v['w'],"h":v['h'],"g":v['g'],"s":v['s'],"sol":v['sol']}
    verify(lv); out.append(lv)
    print(f"L{i:2d} {v['w']:>2}x{v['h']:<2} マス{v['n']:3d} ブロック{v['holes']:2d} {v['L']:2d}手 "
          f"迷い{v['choices']:2d} 探索{v['nodes']:4d} 解{v['nsol']:3d} 難度{v['score']:6.1f}")

js=("/* 自動生成: 全50ステージ（新ルールで解答可能であることを検証済み）\n"
    "   ルール: 壁・盤面の端・すでに通ったマス に当たるまで直進する\n"
    "   w,h: 盤面サイズ / g: '.'=通れるマス '#'=ブロック / s:[x,y]=スタート / sol: 最短手順(U D L R) */\n"
    "window.LEVELS = [\n")
for lv in out:
    js+='  {id:%d,w:%d,h:%d,g:[%s],s:[%d,%d],sol:"%s"},\n'%(
        lv['id'],lv['w'],lv['h'],','.join('"%s"'%r for r in lv['g']),lv['s'][0],lv['s'][1],lv['sol'])
js+="];\n"
open(sys.argv[2],'w').write(js)
print("\nwrote", sys.argv[2], len(js), "bytes")
