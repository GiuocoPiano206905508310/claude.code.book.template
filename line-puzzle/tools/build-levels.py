"""候補プールから、難易度が単調に上がる50ステージを選んで levels.js を書き出す。

難易度の指標
  n       : 塗るマスの数（盤面の大きさ）
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
    return (1.0*v['n'] + 2.2*v['choices'] + 5.0*math.log2(v['nodes']+1)
            - 3.0*math.log2(v['nsol']))

for v in pool: v['score']=score(v)
pool.sort(key=lambda v: v['score'])

N=50
lo_pct, hi_pct = 0.30, 1.00      # 易しすぎる下位3割は使わない
chosen=[]; used=set()
for i in range(N):
    t=(i/(N-1))**1.15
    pct=lo_pct+(hi_pct-lo_pct)*t
    j=min(len(pool)-1, int(pct*(len(pool)-1)))
    # 既に選んだものと重ならない最も近い候補へずらす
    k=j
    while k in used and k>0: k-=1
    while k in used and k<len(pool)-1: k+=1
    used.add(k); chosen.append(pool[k])
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
    print(f"L{i:2d} {v['w']:>2}x{v['h']:<2} マス{v['n']:3d} {v['L']:2d}手 "
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
