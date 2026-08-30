import json, sys, random
from collections import deque
DIRS=[(0,-1),(0,1),(-1,0),(1,0)]; DCH='UDLR'

pool=json.load(open(sys.argv[1]))
print("pool size", len(pool))
Ls=sorted(set(v['L'] for v in pool))
print("L range", min(Ls), max(Ls))
import statistics
by=dict()
for v in pool: by.setdefault(v['L'],[]).append(v)
print({k:len(by[k]) for k in sorted(by)})

N=50
Lmax=max(v['L'] for v in pool)
Ltop=min(Lmax, 30)
nmax=max(v['n'] for v in pool)

def curve(i, lo, hi, p):
    t=((i)/(N-1))**p
    return lo+(hi-lo)*t

used=set(); chosen=[]
for i in range(N):
    tL=curve(i,3,Ltop,1.25)
    tN=curve(i,8,min(nmax,46),1.0)
    best=None
    for j,v in enumerate(pool):
        if j in used: continue
        sc=abs(v['L']-tL)*3.0+abs(v['n']-tN)*0.55
        # 単調性を保つため、直前より易しすぎるものを避ける
        if chosen and v['L'] < chosen[-1]['L']-1: sc+=6
        if best is None or sc<best[0]: best=(sc,j,v)
    used.add(best[1]); chosen.append(best[2])

# ---- 検証: 解答を再生して全マス塗れるか確認 ----
def verify(lv):
    w,h,rows=lv['w'],lv['h'],lv['g']
    grid={(x,y) for y in range(h) for x in range(w) if rows[y][x]=='.'}
    assert len(grid)==lv['n'], (len(grid), lv['n'])
    p=(lv['s'][0],lv['s'][1]); assert p in grid
    painted={p}
    for ch in lv['sol']:
        dx,dy=DIRS[DCH.index(ch)]
        steps=0
        while (p[0]+dx,p[1]+dy) in grid:
            p=(p[0]+dx,p[1]+dy); painted.add(p); steps+=1
        assert steps>0, "no-op move in solution"
    assert painted==grid, f"not complete: {len(painted)}/{len(grid)}"
    # 連結性
    s=next(iter(grid)); seen={s}; dq=deque([s])
    while dq:
        cx,cy=dq.popleft()
        for dx,dy in DIRS:
            nb=(cx+dx,cy+dy)
            if nb in grid and nb not in seen: seen.add(nb); dq.append(nb)
    assert len(seen)==len(grid), "disconnected"
    return True

out=[]
for i,v in enumerate(chosen,1):
    lv={"id":i,"w":v['w'],"h":v['h'],"g":v['g'],"s":v['s'],"sol":v['sol'],"n":v['n']}
    verify(lv)
    out.append(lv)
    print(f"L{i:2d}  {v['w']}x{v['h']}  cells={v['n']:2d}  最短={v['L']:2d}手")

js="/* 自動生成: 全50ステージ（すべて解答可能であることを検証済み）\n"
js+="   w,h: 盤面サイズ / g: '.'=通れるマス '#'=ブロック / s:[x,y]=スタート / sol: 最短手順(U D L R) */\n"
js+="window.LEVELS = [\n"
for lv in out:
    js+='  {id:%d,w:%d,h:%d,g:[%s],s:[%d,%d],sol:"%s"},\n'%(
        lv['id'],lv['w'],lv['h'],','.join('"%s"'%r for r in lv['g']),lv['s'][0],lv['s'][1],lv['sol'])
js+="];\n"
open(sys.argv[2],'w').write(js)
print("\nwrote", sys.argv[2], len(js), "bytes")
