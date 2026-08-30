"""新ルール（通過済みのマスは通れない）でステージ候補を作る。

移動: 壁・盤面の端・すでに塗ったマス のいずれかに当たるまで直進し、通った全マスを塗る。
クリア: 全マスを塗る（＝直線移動だけで作るハミルトン路）。
"""
import random, sys, time, json
from collections import deque
sys.setrecursionlimit(10000)
DIRS=[(0,-1),(0,1),(-1,0),(1,0)]; DCH='UDLR'

def build(grid, w, h):
    cells=sorted(grid,key=lambda p:(p[1],p[0])); idx={c:i for i,c in enumerate(cells)}
    n=len(cells); full=(1<<n)-1
    ray=[[None]*4 for _ in range(n)]
    for c in cells:
        i=idx[c]
        for d,(dx,dy) in enumerate(DIRS):
            x,y=c; seq=[]
            while (x+dx,y+dy) in grid:
                x,y=x+dx,y+dy; seq.append(idx[(x,y)])
            ray[i][d]=seq
    return cells,idx,n,full,ray

def analyse(n, full, ray, start, node_cap=200000, sol_cap=200):
    """全解を数え上げ、最小手数の解・探索ノード数・解の総数を返す。"""
    best=[None]; sols=[0]; nodes=[0]; capped=[False]
    path=[]
    def dfs(pos, mask):
        if capped[0]: return
        nodes[0]+=1
        if nodes[0]>node_cap: capped[0]=True; return
        if mask==full:
            sols[0]+=1
            if best[0] is None or len(path)<len(best[0]): best[0]=path[:]
            if sols[0]>=sol_cap: capped[0]=True
            return
        for d in range(4):
            nm=mask; last=-1; moved=False
            for j in ray[pos][d]:
                if nm>>j & 1: break
                nm|=1<<j; last=j; moved=True
            if not moved: continue
            path.append(d); dfs(last, nm); path.pop()
            if capped[0]: return
    dfs(start, 1<<start)
    return best[0], sols[0], nodes[0], capped[0]

def count_choices(ray, start, sol):
    """解答をなぞりながら、各手で「選べた方向の数-1」を合計する（迷いどころの多さ）。"""
    pos=start; mask=1<<start; total=0
    for ch in sol:
        legal=0
        for d in range(4):
            for j in ray[pos][d]:
                if mask>>j & 1: break
                legal+=1; break
        total+=max(0, legal-1)
        d=DCH.index(ch); 
        for j in ray[pos][d]:
            if mask>>j & 1: break
            mask|=1<<j; pos=j
    return total

def connected(cand):
    if not cand: return False
    s=next(iter(cand)); seen={s}; dq=deque([s])
    while dq:
        cx,cy=dq.popleft()
        for dx,dy in DIRS:
            nb=(cx+dx,cy+dy)
            if nb in cand and nb not in seen: seen.add(nb); dq.append(nb)
    return len(seen)==len(cand)

def make_shape(w,h,holes,rng):
    grid={(x,y) for x in range(w) for y in range(h)}; rem=0; tr=0
    while rem<holes and tr<400:
        tr+=1; p=(rng.randrange(w),rng.randrange(h))
        if p not in grid: continue
        cand=grid-{p}
        if len(cand)<8: break
        if not connected(cand): continue
        grid=cand; rem+=1
    return grid

def rows_of(w,h,g): return [''.join('.' if (x,y) in g else '#' for x in range(w)) for y in range(h)]

if __name__=='__main__':
    rng=random.Random(int(sys.argv[2]) if len(sys.argv)>2 else 7)
    pool={}
    sizes=[(4,4),(5,4),(5,5),(6,5),(6,6),(7,6),(7,7),(8,7),(8,8),(9,8),(9,9),(10,9),(10,10)]
    budget={(4,4):10,(5,4):10,(5,5):12,(6,5):15,(6,6):20,(7,6):45,(7,7):55,
            (8,7):70,(8,8):80,(9,8):100,(9,9):110,(10,9):130,(10,10):150}
    t0=time.time()
    for (w,h) in sizes:
        area=w*h; tend=time.time()+budget[(w,h)]; got=0; att=0
        while time.time()<tend and got<300:
            att+=1
            grid=make_shape(w,h,max(0,int(area*rng.uniform(0.0,0.34))),rng)
            if len(grid)<8: continue
            cells,idx,n,full,ray=build(grid,w,h)
            s=rng.randrange(n)
            sol,nsol,nodes,capped=analyse(n,full,ray,s)
            if sol is None or capped or nsol==0: continue
            key=(w,h,tuple(rows_of(w,h,grid)),cells[s])
            if key in pool: continue
            soltxt=''.join(DCH[d] for d in sol)
            pool[key]={"w":w,"h":h,"g":rows_of(w,h,grid),"s":[cells[s][0],cells[s][1]],
                       "sol":soltxt,"n":n,"L":len(sol),"nsol":nsol,"nodes":nodes,
                       "choices":count_choices(ray,s,soltxt),"holes":area-n}
            got+=1
        print(f"{w}x{h}: {got}/{att}  {time.time()-t0:.0f}s",flush=True)
    lv=list(pool.values())
    print("pool",len(lv))
    if lv:
        import statistics
        print("cells", min(v['n'] for v in lv), "-", max(v['n'] for v in lv))
        print("moves", min(v['L'] for v in lv), "-", max(v['L'] for v in lv))
        print("nsol ", min(v['nsol'] for v in lv), "-", max(v['nsol'] for v in lv),
              " 中央値", statistics.median(v['nsol'] for v in lv))
        print("nodes", min(v['nodes'] for v in lv), "-", max(v['nodes'] for v in lv),
              " 中央値", statistics.median(v['nodes'] for v in lv))
        print("choices", min(v['choices'] for v in lv), "-", max(v['choices'] for v in lv),
              " 中央値", statistics.median(v['choices'] for v in lv))
    json.dump(lv,open(sys.argv[1],'w'))
