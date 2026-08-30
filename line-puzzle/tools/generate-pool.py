import random, json, sys, time
from collections import deque
DIRS=[(0,-1),(0,1),(-1,0),(1,0)]; DCH='UDLR'
def build(grid):
    cells=sorted(grid,key=lambda p:(p[1],p[0])); idx={c:i for i,c in enumerate(cells)}
    n=len(cells); full=(1<<n)-1; moves=[[None]*4 for _ in range(n)]
    for c in cells:
        i=idx[c]
        for d,(dx,dy) in enumerate(DIRS):
            x,y=c; mask=0; st=0
            while (x+dx,y+dy) in grid:
                x,y=x+dx,y+dy; mask|=1<<idx[(x,y)]; st+=1
            if st: moves[i][d]=(idx[(x,y)],mask)
    return cells,idx,n,full,moves
def solve(n,full,moves,start,cap=200000):
    s0=(start,1<<start)
    if s0[1]==full: return []
    parent={s0:None}; q=deque([s0]); cnt=0
    while q:
        p,m=q.popleft(); cnt+=1
        if cnt>cap: return None
        for d in range(4):
            mv=moves[p][d]
            if not mv: continue
            np_,am=mv; st=(np_,m|am)
            if st in parent: continue
            parent[st]=((p,m),d)
            if st[1]==full:
                path=[];cur=st
                while parent[cur] is not None:
                    pr,dd=parent[cur]; path.append(dd); cur=pr
                return path[::-1]
            q.append(st)
    return None
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
        if len(cand)<6: break
        if not connected(cand): continue
        grid=cand; rem+=1
    return grid
def rows_of(w,h,g): return [''.join('.' if (x,y) in g else '#' for x in range(w)) for y in range(h)]
pool={}; rng=random.Random(20260830)
sizes=[(3,3),(4,3),(4,4),(5,4),(5,5),(6,5),(6,6),(7,6),(7,7),(8,7),(8,8)]
budget={(3,3):20,(4,3):20,(4,4):25,(5,4):30,(5,5):40,(6,5):60,(6,6):90,(7,6):140,(7,7):240,(8,7):340,(8,8):420}
t0=time.time()
for (w,h) in sizes:
    area=w*h; tend=time.time()+budget[(w,h)]; got=0; att=0
    while time.time()<tend and got<400:
        att+=1
        holes=max(1,int(area*rng.uniform(0.10,0.42)))
        grid=make_shape(w,h,holes,rng)
        if len(grid)<6: continue
        cells,idx,n,full,moves=build(grid)
        rowsv=tuple(rows_of(w,h,grid))
        starts=list(range(n)); rng.shuffle(starts)
        for s in starts[:6]:
            sol=solve(n,full,moves,s)
            if sol is None or len(sol)<3: continue
            key=(w,h,rowsv,cells[s])
            if key in pool: continue
            pool[key]={"w":w,"h":h,"g":list(rowsv),"s":[cells[s][0],cells[s][1]],
                       "sol":''.join(DCH[d] for d in sol),"n":n,"L":len(sol)}
            got+=1
    print(f"{w}x{h}: {got} ({att} att) total={time.time()-t0:.0f}s",flush=True)
lv=list(pool.values())
print("pool",len(lv))
from collections import Counter
print(sorted(Counter((v['w'],v['h'],v['L']) for v in lv).items())[:5])
json.dump(lv,open(sys.argv[1],'w'))
