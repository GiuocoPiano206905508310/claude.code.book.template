"""新ルール（通過済みのマスは通れない）でステージ候補を作る。

移動: 壁・盤面の端・すでに塗ったマス のいずれかに当たるまで直進し、通った全マスを塗る。
クリア: 全マスを塗る（＝直線移動だけで作るハミルトン路）。
"""
import random, sys, time, json
from collections import deque
sys.setrecursionlimit(10000)
DIRS=[(0,-1),(0,1),(-1,0),(1,0)]; DCH='UDLR'
import os
# 緑（灰色）のお邪魔ブロックの割合。環境変数で調整できるようにしておく
HOLE_LO=float(os.environ.get('HOLE_LO','0.15'))
HOLE_HI=float(os.environ.get('HOLE_HI','0.45'))

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


def carve(w, h, rng, p_early=0.55, max_moves_mul=4):
    """正解の経路を先に引き、止めたい位置にブロックを置いていく逆算生成。

    ランダムに穴を開ける方式では、解ける盤面がほぼブロック0〜1個のものに
    偏ってしまうため、経路側から作る。各手で「行けるところまで」ではなく
    途中で止めたい場合は、その一つ先にブロックを新設する（＝停止理由を作る）。
    経路が通らなかったマスは最後にブロックへ変換する。経路上でも停止理由でも
    ないマスなので、変換しても経路は一切変わらない。
    """
    walls=set(); pos=(rng.randrange(w), rng.randrange(h)); painted={pos}
    start=pos
    for _ in range(max_moves_mul*w*h):
        opts=[]
        for d,(dx,dy) in enumerate(DIRS):
            x,y=pos; k=0
            while True:
                nb=(x+dx,y+dy)
                if not (0<=nb[0]<w and 0<=nb[1]<h) or nb in walls or nb in painted: break
                x,y=nb; k+=1
            if k: opts.append((d,k))
        if not opts: break
        d,maxk=rng.choice(opts)
        dx,dy=DIRS[d]
        k=maxk
        if maxk>1 and rng.random()<p_early:
            k=rng.randint(1,maxk-1)
        x,y=pos
        for _ in range(k):
            x,y=x+dx,y+dy; painted.add((x,y))
        pos=(x,y)
        if k<maxk:
            walls.add((x+dx,y+dy))      # ここで止まる理由を作る
        if len(painted)+len(walls)==w*h: break
    # 経路が通らなかったマスもブロックにする（経路には影響しない）
    for yy in range(h):
        for xx in range(w):
            if (xx,yy) not in painted and (xx,yy) not in walls: walls.add((xx,yy))
    grid={(x,y) for y in range(h) for x in range(w) if (x,y) not in walls}
    return grid, start

if __name__=='__main__':
    rng=random.Random(int(sys.argv[2]) if len(sys.argv)>2 else 7)
    pool={}
    sizes=[(5,4),(5,5),(6,5),(6,6),(7,6),(7,7),(8,7),(8,8),(9,8),(9,9),(10,9),(10,10),(11,10),(11,11),(12,11)]
    scale=float(os.environ.get('BUDGET_SCALE','1'))
    budget={k:v*scale for k,v in {
        (5,4):10,(5,5):12,(6,5):15,(6,6):25,(7,6):35,(7,7):45,
        (8,7):55,(8,8):65,(9,8):75,(9,9):85,(10,9):95,(10,10):110,
        (11,10):120,(11,11):130,(12,11):140}.items()}
    # 早期停止の確率＝ブロックの作られやすさ。幅を持たせて多様なブロック数を得る
    P_LO=float(os.environ.get('P_LO','0.25')); P_HI=float(os.environ.get('P_HI','0.85'))
    MIN_CELL_RATIO=float(os.environ.get('MIN_CELL_RATIO','0.55'))
    t0=time.time()
    for (w,h) in sizes:
        area=w*h; tend=time.time()+budget[(w,h)]; got=0; att=0
        while time.time()<tend and got<int(os.environ.get('PER_SIZE','400')):
            att+=1
            grid,start=carve(w,h,rng,rng.uniform(P_LO,P_HI))
            if len(grid)<8 or len(grid)<MIN_CELL_RATIO*area: continue
            cells,idx,n,full,ray=build(grid,w,h)
            s_i=idx[start]
            sol,nsol,nodes,capped=analyse(n,full,ray,s_i)
            if sol is None or capped or nsol==0: continue
            key=(w,h,tuple(rows_of(w,h,grid)),start)
            if key in pool: continue
            soltxt=''.join(DCH[d] for d in sol)
            pool[key]={"w":w,"h":h,"g":rows_of(w,h,grid),"s":[start[0],start[1]],
                       "sol":soltxt,"n":n,"L":len(sol),"nsol":nsol,"nodes":nodes,
                       "choices":count_choices(ray,s_i,soltxt),"holes":area-n}
            got+=1
        print(f"{w}x{h}: {got}/{att}  {time.time()-t0:.0f}s",flush=True)
    lv=list(pool.values())
    print("pool",len(lv))
    if lv:
        import statistics
        for k,label in [('n','マス数'),('holes','ブロック数'),('L','手数'),
                        ('choices','迷い'),('nodes','探索'),('nsol','解の数')]:
            print(f"  {label}: {min(v[k] for v in lv)} - {max(v[k] for v in lv)}"
                  f"  中央値 {statistics.median(v[k] for v in lv)}")
    json.dump(lv,open(sys.argv[1],'w'))
