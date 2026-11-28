#!/usr/bin/env python3
# 경제 흐름 어림 계산 (2026-11-28): 장비 사다리 3천원~120억원 + 특수(레벨 장비, Lv.100 이면 다음 장비)
# 가장 싼 것부터 사는 단순한 플레이어로 "몇 번 왕복하면 무엇을 사는지" 출력. 숫자는 게임 코드와 손으로 맞춰 둠(가격을 바꾸면 같이 고칠 것)
#   python3 tools/econ-sim.py
import math
VAL={6:60,2:100,3:250,8:500,4:800,9:1400,5:3000,10:2000,11:6000}
GEN=[(6,2,4,50,150,.09,.012,.02),(2,0,0,70,160,.08,.015,.08),(3,20,45,130,260,.06,.015,.004),(8,50,85,170,290,.04,.012,.003),(4,90,130,230,340,.035,.012,.003),(9,130,175,290,700,.028,.014,.0025),(5,175,235,500,1000,.022,.016,.0025),(10,230,290,900,1600,.018,.016,.002),(11,280,340,2400,2400,.014,.014,.0015)]
def prob(g,d):
    i,s,rs,re,e,pk,tl,tr=g
    if d<s: return 0
    if d<rs: return tr+(pk-tr)*((d-s)/(rs-s))**2 if rs>s else pk
    if d<=re: return pk
    if d<e: return pk+(tl-pk)*(d-re)/(e-re)
    return tl
def avgval(D):
    tot=0;w=0
    for d in range(max(0,D-80),D+1):
        for g in GEN:
            p=prob(g,d); tot+=p*VAL[g[0]]; w+=p
    return tot/w
PICK=[3000,9000,25000,70000,200000]
CARGO=[(18,4000),(34,34000),(66,280000),(114,2400000),(184,20000000),(284,170000000),(424,1400000000),(624,12000000000)]
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
        cap=10 if st['cargo']==0 else CARGO[st['cargo']-1][0]
        return cap*avgval(depth())*gmul()*(1+lsum())*1.3
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
