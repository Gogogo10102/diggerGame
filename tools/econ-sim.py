#!/usr/bin/env python3
# 경제 흐름 어림 계산 (2026-11-28): 장비 사다리 3천원~120억원 + 특수(레벨 장비, Lv.100 이면 다음 장비)
# 방치형 개편(2026-11-28 밤): 지층 전용 광물 · 한 번에 여러 개(yield × (1 + 행운)) · 화물 = 칸 × 쌓기 · 값은 지층마다 ~4배
#   한 번 나갈 때 캐는 횟수(DIGS) × 한 번의 평균 값 — 화물 칸이 차면 거기까지
# 가장 싼 것부터 사는 단순한 플레이어로 "몇 번 왕복하면 무엇을 사는지" 출력. 숫자는 게임 코드와 손으로 맞춰 둠(가격을 바꾸면 같이 고칠 것)
#   python3 tools/econ-sim.py
import math
VAL={6:8,2:12,20:15,3:40,8:50,21:60,4:130,9:200,22:170,5:600,10:500,23:680,11:2400,24:2000,25:3000,26:9200,27:17000,28:35000,29:62000,30:150000,31:600000}
YLD={6:10,2:10,20:9,3:8,8:8,21:6,4:6,9:6,22:6,5:5,10:5,23:5,11:4,24:4,25:4,26:3,27:2,28:2,29:1.5,30:1.5,31:0.5}
LB=[0,60,140,250,450,800,1300,1900,2401]
LORES=[[(6,.06),(2,.05),(20,.03)],[(3,.05),(8,.035),(21,.015)],[(4,.035),(9,.025),(22,.03)],[(5,.025),(10,.02),(23,.02)],[(11,.02),(24,.025),(25,.012)],[(26,.025),(27,.008)],[(28,.018),(29,.007)],[(30,.014),(31,.004)]]
def prob(g,d):
    i,s,rs,re,e,pk,tl,tr=g
    if d<s: return 0
    if d<rs: return tr+(pk-tr)*((d-s)/(rs-s))**2 if rs>s else pk
    if d<=re: return pk
    if d<e: return pk+(tl-pk)*(d-re)/(e-re)
    return tl
def layer(D):
    i=0
    while i+1<len(LB)-1 and D>=LB[i+1]: i+=1
    return i
def perdig(D,luck):                       # 그 깊이에서 한 번 캘 때 평균 (값, 개수)
    gs=LORES[layer(D)]; t=sum(p for _,p in gs)
    v=sum(p/t*VAL[i]*YLD[i]*(1+1*luck) for i,p in gs); n=sum(p/t*YLD[i]*(1+1*luck) for i,p in gs)
    return v,n
PICK=[3000,9000,25000,70000,200000]
CARGO=[(6*200,4000),(8*1000,34000),(10*5000,280000),(12*20000,2400000),(16*100000,20000000),(20*500000,170000000),(24*3000000,1400000000),(30*20000000,12000000000)]
FUEL=[3000,26000,230000,2000000,18000000,160000000,1400000000,12000000000]
DRILL=[300000,1400000,6200000,28000000,130000000,580000000,2600000000,12000000000]
ROBOT=150000
def run(R,GOLD,LUCK,verbose=False):
    st=dict(pick=0,cargo=0,fuel=0,robot=0,drill=0); gl=[0]*len(GOLD); ll=[0]*len(LUCK); money=0; trips=0; log=[]
    def gmul():
        m=1
        for (b,p),l in zip(GOLD,gl): m*=1+p*l
        return m
    def lsum(): return sum(p*l for (b,p),l in zip(LUCK,ll))
    def depth():
        if st['robot']: D=150+110*st['drill']
        else: D=30+22*st['pick']
        return min(D, 50+75*st['fuel'] if not st['robot'] else 140+120*st['fuel'])
    def income():
        cap=4*50 if st['cargo']==0 else CARGO[st['cargo']-1][0]
        digs=12+3*st['pick'] if not st['robot'] else 20+9*st['fuel']   # 한 번 나갈 때 캐는 횟수 (연료·곡괭이)
        v,n=perdig(depth(),lsum())
        k=min(1.0,cap/(digs*n))                                         # 화물이 차면 거기까지
        return digs*v*k*gmul()
    def options():
        o=[]
        if not st['robot']:
            if st['pick']<5: o.append(('pick',PICK[st['pick']]))
            if st['pick']>=3: o.append(('robot',ROBOT))
        elif st['drill']<8: o.append(('drill',DRILL[st['drill']]))
        if st['cargo']<8: o.append(('cargo',CARGO[st['cargo']][1]))
        if st['fuel']<8: o.append(('fuel',FUEL[st['fuel']]))
        for i,(b,p) in enumerate(GOLD):
            if gl[i]<100 and (i==0 or gl[i-1]>=100): o.append((('g',i),b*R**gl[i]))
        for i,(b,p) in enumerate(LUCK):
            if ll[i]<100 and (i==0 or ll[i-1]>=100): o.append((('l',i),b*R**ll[i]))
        return o
    while trips<9000:
        if st['drill']==8 and st['cargo']==8 and st['fuel']==8: break
        k,c=min(options(),key=lambda x:x[1])
        while money<c: money+=income(); trips+=1
        money-=c
        if isinstance(k,tuple):
            arr=gl if k[0]=='g' else ll; arr[k[1]]+=1
            if arr[k[1]]==100: log.append((trips,"%s%d=100"%k,c,income()))
        else: st[k]+=1; log.append((trips,k+str(st[k]),c,income()))
    if verbose:
        for r in log: print("왕복 %4d %-8s 값 %16s 수입 %15s"%(r[0],r[1],format(round(r[2]),','),format(round(r[3]),',')))
    return trips,gmul(),lsum(),gl,ll
if __name__=="__main__":
    # 특수(레벨 장비): (산 값, 레벨 1당 효과) — items.ts 와 맞출 것. 골드는 곱하기, 행운은 더하기
    G=[(1000,.02),(50000,.03),(2000000,.04),(100000000,.05)]; L=[(1500,.01),(100000,.02),(5000000,.03)]
    t,g,l,gl,ll=run(1.04,G,L,True)
    print("총 왕복",t,"· 골드 배율 ×%.0f · 행운 +%d%%"%(g,l*100))
