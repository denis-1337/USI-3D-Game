unit bild;
{$N+}
{$G+}
interface
uses graph,vec1,mouse,constant;


type  vecreihe = array [1..14] of vec;
      poly = record a:array [1..3] of byte;
                    f:byte; end;
      polyreihe = array [1..8] of poly;
      objekt = record v:vecreihe;
                      p:polyreihe;
                      maxv:byte;
                      maxp:byte;
                      end;
      schilddat= array [1..14] of vec;
      explodat = array [1..32] of vec;
      allexplo = array [1..20] of record ed:explodat;
                                          e:byte;
                                          ex:boolean;
                                          s:vec;
                                          end;
      sddat = array [1..20] of record
                               ex:boolean;
                               v:vec;
                               k:byte;
                               e:shortint;
                               end;
      ship = record ex:boolean;
                    s,v,z:vec;  {ort,richtung,ziel}
                    k:byte; {ziel}
                    m:single; {drehmoment}
                    typ:byte;
                    gr:byte;{gruppe}
                    ge:byte;{geschwindigkeit}
                    r:boolean;{true = eingerahmt}
                    panz:integer;
                    shield:integer;
                    sx:integer; {max schild}
                    pm:integer; {max panzer}
                    h:vec;
                    nr:byte;{nummer des verbandes }
                    gf:integer;{das wichtigste berhaupt}
                    pl:boolean;{gibt an ob ein Planet angegriffen wird}
                    f:boolean;
                    fn:byte;
                    end;
      ganzviel =array [1..max] of ship;
      ammo = array [1..200] of record s,x:vec;
                                      gr:byte;
                                      e:byte;
                                      ex:boolean;
                                      end;
      rakete = record ex:boolean;
                    s,v:vec;
                    k:byte;
                    e:byte;
                    gr:byte;
                    end;
      raketen = array[1..50] of rakete;
      smarties = array[1..50] of rakete;
      antriebdat = array[0..4] of vec;
      antriebe = array[1..50] of antriebdat;

var a1,b1,c1,a2,b2,c2,a3,b3,c3,pla,k1,k2,k3:objekt;
    sd:sddat;
    ex:schilddat;
    aex:allexplo;

    page:boolean;
    s:ganzviel;
    a:ammo;
    r:raketen;
    h:smarties;
    g:antriebe;
    bx,by:integer;
    snr:byte;{nummer der eigenen gruppe }
    rahmen:boolean;
    rx,ry:word; {rahmen werte}
    p:vec;{ort der maus}

    befehl:boolean;

procedure sp(var p:poly;x,y,z,f:byte);
procedure aktivships;
procedure one(x,s:vec;v:vecreihe;p:polyreihe;maxv,maxp:byte);
procedure erzeuge;
procedure waitretrace;
procedure change;
procedure showschild;
procedure showexplos;
procedure showammo;
procedure showraks;
procedure showsmart;
procedure initexplo(s:vec);
procedure initschild(k:byte;schaden:integer;v:vec);
procedure initammo(s,v:vec;typ:byte);
procedure initraks(s,v:vec;gr:byte);
procedure initsmart(t,v:vec;gr:byte);
procedure shiptest;
function sichtbar(s:vec):boolean;

implementation

function sichtbar(s:vec):boolean;
var x,y:single;
begin
sichtbar:=false;
x:=s.x+bx;
y:=s.y*0.729+by;
if (x>-20) and (y>-20) and (x < 520 ) and (y<370) then
sichtbar:=true;
end;


procedure shiptest;
var i:byte;
    y,x1,x2,y1,y2:word;
begin
y:=mousey;
if (rx<p.x) and (ry< y) then
begin x1:=rx;x2:=trunc(p.x);y1:=ry;y2:=y;end
else if (rx<p.x) and (ry> y) then
begin x1:=rx;x2:=trunc(p.x);y1:=y;y2:=ry;end
else if (rx>p.x) and (ry> y) then
begin x1:=trunc(p.x);x2:=rx;y1:=y;y2:=ry;end
else if (rx>p.x) and (ry< y) then
begin x1:=trunc(p.x);x2:=rx;y1:=ry;y2:=y;end;

for i:=1 to max do
if (s[i].ex = true) and (s[i].gr=snr) and  (s[i].s.x+bx > x1) and (s[i].s.x+bx < x2)
and (s[i].s.y*0.729+by > y1) and (s[i].s.y*0.729+by < y2) then
s[i].r:=true;

end;

procedure smart(var r:rakete;var t:antriebdat);
var i1:byte;
    a:vec;
    l,g:single;
begin

t[(r.e)mod 5]:=r.s;
if r.e>4 then
begin
setcolor(7);
circle(trunc(t[(r.e)mod 5].x)+bx,trunc(t[(r.e)mod 5].y*0.729)+by,2);
putpixel(trunc(t[(r.e)mod 5].x)+bx,trunc(t[(r.e)mod 5].y*0.729)+by,14);
setcolor(14);
circle(trunc(t[(r.e)mod 5].x)+bx,trunc(t[(r.e)mod 5].y*0.729)+by,1);
putpixel(trunc(t[(r.e)mod 5].x)+bx,trunc(t[(r.e)mod 5].y*0.729)+by,15);
setcolor(14);
circle(trunc(t[(r.e-1)mod 5].x)+bx,trunc(t[(r.e-1)mod 5].y*0.729)+by,1);
putpixel(trunc(t[(r.e-2)mod 5].x)+bx,trunc(t[(r.e-2)mod 5].y*0.729)+by,15);
putpixel(trunc(t[(r.e-3)mod 5].x)+bx,trunc(t[(r.e-3)mod 5].y*0.729)+by,14);
putpixel(trunc(t[(r.e-4)mod 5].x)+bx,trunc(t[(r.e-4)mod 5].y*0.729)+by,7);
end;

subv(r.s,s[r.k].s,a);
l:=lang(a);

if l<14 then
begin
r.e:=250;
divi(a,l,a);
mult(a,10,a);
initschild(r.k,smartk,a);
s[r.k].m:=entf(r.s,r.v,s[r.k].s)*2;
end;

if r.k>0 then
g:=entf(r.s,r.v,s[r.k].s)/50 else
g:=0;
addv(r.s,r.v,r.s);
if g<-0.5 then g:=-0.5;
if g>0.5 then g:= 0.5;
drehen(r.v,g);
divi(r.v,3,r.v);
setcolor(5);
moveto(trunc(r.s.x)+bx,trunc(r.s.y*0.729)+by);
linerel(trunc(r.v.x),trunc(r.v.y*0.729));
inc(r.e);
if r.e > 250 then
begin
r.ex:=false;
initexplo(r.s);
end;
end;

procedure showsmart;
var i6:byte;
begin
for i6:=1 to 50 do
if h[i6].ex=true then
smart(h[i6],g[i6]);
end;

procedure initsmart(t,v:vec;gr:byte);
var i9,i2,k:byte;
    e1,e2:single;
begin
for i9:=1 to 50 do
if h[i9].ex=false then
begin
h[i9].ex:=true;
h[i9].s:=t;
h[i9].e:=1;
divi(v,3,h[i9].v);
h[i9].k:=0;
e1:=1000;

for i2:=1 to max do
if (s[i2].ex = true) and (s[i2].gr<>gr) then
begin
e2:=abstand(s[i2].s,t);
if (e1 >= e2) and (e2>1)  then
begin
e1:=e2;
h[i9].k:=i2;
end;
end;

i9:=50;
end;

end;

procedure initraks(s,v:vec;gr:byte);
var i9:byte;
begin
for i9:=1 to 50 do
if r[i9].ex=false then
begin
r[i9].ex:=true;
r[i9].s:=s;
r[i9].e:=1;
r[i9].gr:=gr;
divi(v,5,r[i9].v);
i9:=50;
end;

end;

procedure raks(var r:rakete);
var i1:byte;
    a:vec;
    l:single;
begin

if r.e>5 then
for i1:= 1 to max do
if (s[i1].ex=true) and (s[i1].gr<>r.gr) then
begin
subv(r.s,s[i1].s,a);
l:=lang(a);
if l<14 then
begin
r.e:=55;
divi(a,l,a);
mult(a,10,a);
initschild(i1,rakk,a);
initexplo(r.s);
s[i1].m:=entf(r.s,r.v,s[i1].s)*2;
i1:=max;
end;
end;

with r do
begin

mult(v,1.035,v);
addv(s,v,s);
setcolor(14);
circle(trunc(s.x)+bx,trunc(s.y*0.729)+by,1);
inc(e);
if e>55 then
ex:=false;

end;
end;

procedure showraks;
var i6:byte;
begin
for i6:=1 to 50 do
if r[i6].ex=true then
raks(r[i6]);
end;

procedure initammo(s,v:vec;typ:byte);
var i9,e:byte;
    x:vec;
begin
case typ of
1,4,7:e:=1;
2,5,6,8,9:e:=2;
3:e:=3;
end;

for i9:=1 to 200 do
if a[i9].ex=false then
begin
a[i9].e:=1;
divi(v,2,a[i9].x);
a[i9].ex:=true;
case typ of
1,2,3:a[i9].gr:=1;
4,5,6:a[i9].gr:=2;
7,8,9:a[i9].gr:=3;
end;
case typ of
1,4,7: a[i9].s:=s;
2,5,6,8,9:begin
 orth(v,x);
 divi(x,2,x);
 if e = 2 then addv(s,x,s);
 if e = 1 then begin subv(s,x,s);subv(s,x,s); end;
 a[i9].s:=s;
 end;

3:begin
if e = 3 then begin orth(v,x);divi(x,2,x);subv(s,x,s);end;
if e = 2 then addv(s,x,s);
if e = 1 then addv(s,x,s);
a[i9].s:=s;
end;
end;

dec(e);
if e=0 then
i9:=200;
end;

end;

procedure am(var s2:vec; x:vec;var e,gr:byte);
var i1:byte;
    a:vec;
    l:single;
begin
if e>5 then
for i1:= 1 to max do
if (s[i1].ex=true) and (s[i1].gr<>gr) then
begin
subv(s2,s[i1].s,a);
l:=lang(a);
if l<14 then
begin
e:=50;
divi(a,l,a);
mult(a,10,a);
initschild(i1,ammok,a);
s[i1].m:=entf(s2,x,s[i1].s);
i1:=max;
end;
end;

addv(s2,x,s2);
inc(e);
putpixel(trunc(s2.x)+bx,trunc(s2.y*0.729)+by,15);
if e>50 then
e:=0;
end;

procedure showammo;
var i6:byte;
begin
for i6:=1 to 200 do
if a[i6].ex=true then
begin
am(a[i6].s,a[i6].x,a[i6].e,a[i6].gr);
if a[i6].e=0 then a[i6].ex:=false;
end;
end;

procedure initexplo(s:vec);
var i6,i5:byte;
begin
for i6:=1 to 20 do
if aex[i6].ex=false then
begin
for i5:=1 to 8 do
sv(aex[i6].ed[i5],s.x+random(5)+1,s.y+random(5)+1);
for i5:=9 to 16 do
sv(aex[i6].ed[i5],s.x-(random(5)+1),s.y+random(5)+1);
for i5:=17 to 24 do
sv(aex[i6].ed[i5],s.x+random(5)+1,s.y-(random(5)+1));
for i5:=25 to 32 do
sv(aex[i6].ed[i5],s.x-(random(5)+1),s.y-(random(5)+1));
aex[i6].s:=s;
aex[i6].ex:=true;
aex[i6].e:=1;
i6:=20;
end;

end;

procedure initschild(k:byte;schaden:integer;v:vec);
var i7:byte;
begin
if s[k].shield > 0 then
begin
dec(s[k].shield,schaden);
if s[k].shield < 0 then begin inc(s[k].panz,s[k].shield);s[k].shield:=0; end;
for i7:=1 to 20 do
if sd[i7].ex=false then
begin
sd[i7].v:=v;
sd[i7].k:=k;
sd[i7].ex:=true;
sd[i7].e:=1;
i7:=20;
end;
end
else dec(s[k].panz,schaden);
end;

procedure explo(s:vec;var ed:explodat;var e:byte);
var i4,f :byte;
    a:vec;
    z:single;
begin
z:=1-e/200;
for i4:= 1 to 32 do
if (odd(i4)=false) or (e<100) then
begin
if odd(i4)=true then f:=14
else f:=12;
putpixel(trunc(ed[i4].x)+bx,trunc(ed[i4].y*0.729)+by,f);
subv(ed[i4],s,a);
ev(a,a);
mult(a,z,a);
addv(ed[i4],a,ed[i4]);

end;
inc(e);
if e>150 then e:=0;

end;

procedure showexplos;
var i6:byte;
begin
for i6:=1 to 20 do
if aex[i6].ex=true then
begin
explo(aex[i6].s,aex[i6].ed,aex[i6].e);
if aex[i6].e=0 then aex[i6].ex:=false;
end;
end;

procedure schild(k:byte;x:vec;var e:shortint);
var i3:shortint;
    a,b,y,c,d,s1:vec;
    f:byte;
begin
s1:=s[k].s;
divi(x,10,x);
orth(x,y);
for i3:=e-13 to e do
if (i3 >0) and (i3< 15 )then
begin
a:=ex[i3];
if a.x > 12 then f:=14
else if a.x >9 then f:=15 else f:=7;

mult(x,a.x,c);
mult(y,a.y,d);
addv(c,d,d);
addv(d,s1,d);
mult(y,-a.y,b);
addv(c,b,b);
addv(b,s1,b);

putpixel(round(d.x)+bx,round(d.y*0.729)+by,f);
putpixel(round(b.x)+bx,round(b.y*0.729)+by,f);
end;

e:=e+1;
if e>28 then e:=0;

end;

procedure showschild;
var i6:byte;
begin
for i6:=1 to 20 do
if sd[i6].ex=true then
begin
schild(sd[i6].k,sd[i6].v,sd[i6].e);
if sd[i6].e=0 then sd[i6].ex:=false;
end;
end;

procedure change;
begin
if page=true then
begin

setvisualpage(0);
setactivepage(1);
page:=false;
waitretrace;
end
else
begin

setvisualpage(1);
setactivepage(0);
page:=true;
waitretrace;
end;
end;

procedure waitretrace;assembler;
asm
  mov dx,3dah
@wait1:
  in al,dx
  test al,08h
  jnz @wait1
@wait2:
  in al,dx
  test al,08h
  jz @wait2
  ret

end;

procedure one(x,s:vec;v:vecreihe;p:polyreihe;maxv,maxp:byte);
var i1,i2:byte;
    d:array[1..3] of pointtype;
    y,a,b:vec;
begin
divi(x,10,x);
orth(x,y);
for i1:=1 to maxv do
begin
mult(x,v[i1].x,a);
mult(y,v[i1].y,b);
addv(a,b,a);
addv(a,s,v[i1]);
end;


for i1:=1 to maxp do
begin

for i2:=1 to 3 do
begin
d[i2].x:=round(v[p[i1].a[i2]].x)+bx;
d[i2].y:=round(v[p[i1].a[i2]].y*0.729)+by;
end;

setcolor(p[i1].f);
setfillstyle(1,p[i1].f);
fillpoly(3,d);
end;

end;

procedure aktivships;
var i9:byte;
begin

for i9:= 1 to max do
if (s[i9].ex=true) and (sichtbar(s[i9].s)) then
case s[i9].typ of
1:one(s[i9].v,s[i9].s,a1.v,a1.p,a1.maxv,a1.maxp);
2:one(s[i9].v,s[i9].s,b1.v,b1.p,b1.maxv,b1.maxp);
3:one(s[i9].v,s[i9].s,c1.v,c1.p,c1.maxv,c1.maxp);
4:one(s[i9].v,s[i9].s,a2.v,a2.p,a2.maxv,a2.maxp);
5:one(s[i9].v,s[i9].s,b2.v,b2.p,b2.maxv,b2.maxp);
6:one(s[i9].v,s[i9].s,c2.v,c2.p,c2.maxv,c2.maxp);
7:one(s[i9].v,s[i9].s,a3.v,a3.p,a3.maxv,a3.maxp);
8:one(s[i9].v,s[i9].s,b3.v,b3.p,b3.maxv,b3.maxp);
9:one(s[i9].v,s[i9].s,c3.v,c3.p,c3.maxv,c3.maxp);
10:one(s[i9].v,s[i9].s,k1.v,k1.p,k1.maxv,k1.maxp);
11:one(s[i9].v,s[i9].s,k2.v,k2.p,k2.maxv,k2.maxp);
12:one(s[i9].v,s[i9].s,k3.v,k3.p,k3.maxv,k3.maxp);

end;
end;

procedure sp(var p:poly;x,y,z,f:byte);
begin
p.a[1]:=x;
p.a[2]:=y;
p.a[3]:=z;
p.f:=f;
end;

procedure erzeuge;
var a,b:integer;
begin

a:=9;
b:=1;
initgraph(a,b,'');
initmouse;
hidemouse;
randomize;

page:=true;
bx:=0;
by:=0;

fillchar(sd,sizeof(sd),0);
fillchar(aex,sizeof(aex),0);
fillchar(s,sizeof(s),0);
fillchar(a,sizeof(a),0);
fillchar(r,sizeof(r),0);
fillchar(h,sizeof(h),0);
fillchar(g,sizeof(g),0);

{Schildanimation Daten}
sv(ex[1],13,0);sv(ex[2],13,1);sv(ex[3],12.8,2);sv(ex[4],12.6,3);
sv(ex[5],12.3,4);sv(ex[6],12,5);sv(ex[7],11.5,6);sv(ex[8],10.9,7);
sv(ex[9],10.2,8);sv(ex[10],9.4,9);sv(ex[11],8.3,10);sv(ex[12],6.9,11);
sv(ex[13],5,12);sv(ex[14],0,13);

{Bilddaten der Objekte}

pla.maxv:=9;
pla.maxp:=8;
sv(pla.v[1],0,0);sv(pla.v[2],0,20);
sv(pla.v[3],-14,14);sv(pla.v[4],-20,0);
sv(pla.v[5],-14,-14);sv(pla.v[6],0,-20);
sv(pla.v[7],14,-14);sv(pla.v[8],20,0);
sv(pla.v[9],14,14);

sp(pla.p[1],1,2,3,1);sp(pla.p[2],1,3,4,3);
sp(pla.p[3],1,4,5,3);sp(pla.p[4],1,5,6,3);
sp(pla.p[5],1,6,7,3);sp(pla.p[6],1,7,8,4);
sp(pla.p[7],1,8,9,4);sp(pla.p[8],1,9,2,1);


a1.maxv:=6;
a1.maxp:=4;
sv(a1.v[1],8,0);sv(a1.v[2],1,-3);
sv(a1.v[3],1,+3);sv(a1.v[4],-3,0);
sv(a1.v[5],-8,7);sv(a1.v[6],-8,-7);

sp(a1.p[1],1,2,4,1);sp(a1.p[2],1,3,4,1);
sp(a1.p[3],3,4,5,4);sp(a1.p[4],2,4,6,4);

b1.maxv:=7;
b1.maxp:=5;
sv(b1.v[1],10,-3);sv(b1.v[2],0,-5);
sv(b1.v[3],-7,-2);sv(b1.v[4],-7,2);
sv(b1.v[5],0,5);sv(b1.v[6],10,3);
sv(b1.v[7],2,0);

sp(b1.p[1],1,2,7,1);sp(b1.p[2],2,3,7,3);
sp(b1.p[3],3,4,7,4);sp(b1.p[4],4,5,7,3);
sp(b1.p[5],5,6,7,1);

c1.maxv:=10;
c1.maxp:=8;
sv(c1.v[1],10,5);sv(c1.v[2],10,-5);
sv(c1.v[3],7,0);sv(c1.v[4],2,3);
sv(c1.v[5],2,-3);sv(c1.v[6],0,8);
sv(c1.v[7],-6,6);sv(c1.v[8],-9,0);
sv(c1.v[9],-6,-6);sv(c1.v[10],0,-8);

sp(c1.p[1],3,4,5,1);sp(c1.p[2],1,4,6,3);
sp(c1.p[3],2,5,10,3);sp(c1.p[4],4,6,7,3);
sp(c1.p[5],5,9,10,3);sp(c1.p[6],4,7,8,4);
sp(c1.p[7],5,8,9,4);sp(c1.p[8],4,5,8,1);

a2.maxv:=10;
a2.maxp:=4;
sv(a2.v[1],1,2);sv(a2.v[2],1,-2);
sv(a2.v[3],-3,2);sv(a2.v[4],-3,-2);
sv(a2.v[5],8,2);sv(a2.v[6],8,-2);
sv(a2.v[7],0,6);sv(a2.v[8],0,-6);
sv(a2.v[9],-6,2);sv(a2.v[10],-6,-2);

sp(a2.p[1],1,3,4,14);sp(a2.p[2],1,2,4,14);
sp(a2.p[3],5,7,9,10);sp(a2.p[4],6,8,10,10);

b2.maxv:=10;
b2.maxp:=4;
sv(b2.v[1],8,2);sv(b2.v[2],8,-2);
sv(b2.v[3],0,5);sv(b2.v[4],0,-5);
sv(b2.v[5],-6,2);sv(b2.v[6],-6,-2);
sv(b2.v[7],-8,8);sv(b2.v[8],-8,-8);
sv(b2.v[9],-3,3.5);sv(b2.v[10],-3,-3.5);

sp(b2.p[1],3,1,5,2);sp(b2.p[2],2,4,6,2);
sp(b2.p[3],3,7,9,14);sp(b2.p[4],4,8,10,14);

c2.maxv:=14;
c2.maxp:=6;
sv(c2.v[1],10,2);sv(c2.v[2],10,-2);
sv(c2.v[3],5,8);sv(c2.v[4],5,-8);
sv(c2.v[5],3,5);sv(c2.v[6],3,-5);
sv(c2.v[7],0,5);sv(c2.v[8],0,-5);
sv(c2.v[9],-5.5,2);sv(c2.v[10],-5.5,-2);
sv(c2.v[11],-7,8);sv(c2.v[12],-7,-8);
sv(c2.v[13],-9,0);sv(c2.v[14],0,0);

sp(c2.p[1],3,1,5,10);sp(c2.p[2],2,4,6,10);
sp(c2.p[3],3,13,14,2);sp(c2.p[4],4,13,14,2);
sp(c2.p[5],7,9,11,14);sp(c2.p[6],8,10,12,14);

a3.maxv:=8;
a3.maxp:=4;
sv(a3.v[1],10,2);sv(a3.v[2],7,-5);
sv(a3.v[3],-3,3);sv(a3.v[4],-2,-2);
sv(a3.v[5],-8,8);sv(a3.v[6],-6,-6);
sv(a3.v[7],-4,2);sv(a3.v[8],0,0);

sp(a3.p[1],1,3,8,7);sp(a3.p[2],8,2,4,8);
sp(a3.p[3],5,4,8,8);sp(a3.p[4],6,4,7,15);

b3.maxv:=10;
b3.maxp:=6;
sv(b3.v[1],9,7);sv(b3.v[2],5,-7);
sv(b3.v[3],2,0);sv(b3.v[4],1,4);
sv(b3.v[5],0,-3);sv(b3.v[6],-6,9);
sv(b3.v[7],-4,0);sv(b3.v[8],-5,-4);
sv(b3.v[9],-6,-9);sv(b3.v[10],-10,-2);

sp(b3.p[1],1,3,4,7);sp(b3.p[2],2,3,5,8);
sp(b3.p[3],3,4,7,15);sp(b3.p[4],6,4,7,15);
sp(b3.p[5],3,7,9,7);sp(b3.p[6],8,10,7,8);

c3.maxv:=12;
c3.maxp:=5;
sv(c3.v[1],8,3);sv(c3.v[2],9,-4);
sv(c3.v[3],5,-4);sv(c3.v[4],4,0);
sv(c3.v[5],0,-4);sv(c3.v[6],-2,5);
sv(c3.v[7],-5,8);sv(c3.v[8],-4,-8);
sv(c3.v[9],-5,-4);sv(c3.v[10],-9,-4);
sv(c3.v[11],-7,5);sv(c3.v[12],-9,5);

sp(c3.p[1],4,1,7,8);sp(c3.p[2],1,3,5,7);
sp(c3.p[3],2,8,10,8);sp(c3.p[4],5,9,11,7);
sp(c3.p[5],7,6,12,15);

k1.maxv:=10;
k1.maxp:=8;
sv(k1.v[1],13,0);sv(k1.v[2],8,4);
sv(k1.v[3],8,-4);sv(k1.v[4],1,8);
sv(k1.v[5],1,3);sv(k1.v[6],1,-3);
sv(k1.v[7],1,-8);sv(k1.v[8],-2,4);
sv(k1.v[9],-2,-4);sv(k1.v[10],-10,0);

sp(k1.p[1],1,6,5,1);sp(k1.p[2],2,4,5,3);
sp(k1.p[3],3,6,7,3);sp(k1.p[4],4,5,8,3);
sp(k1.p[5],6,9,7,3);sp(k1.p[7],5,10,8,4);
sp(k1.p[8],5,6,10,1);sp(k1.p[6],6,9,10,4);

k2.maxv:=11;
k2.maxp:=5;
sv(k2.v[1],8,5);sv(k2.v[2],8,-5);
sv(k2.v[3],0,8);sv(k2.v[4],0,2);
sv(k2.v[5],0,-2);sv(k2.v[6],0,-8);
sv(k2.v[7],-8,5);sv(k2.v[8],-8,-5);
sv(k2.v[9],0,0);sv(k2.v[10],-8,2);
sv(k2.v[11],-8,-2);

sp(k2.p[1],1,3,4,2);sp(k2.p[2],5,2,6,10);
sp(k2.p[3],3,4,7,10);sp(k2.p[4],5,6,8,2);
sp(k2.p[5],9,10,11,14);

k3.maxv:=11;
k3.maxp:=5;
sv(k3.v[1],9,2);sv(k3.v[2],7,1);
sv(k3.v[3],8,-3);sv(k3.v[4],5,-2);
sv(k3.v[5],0,5);sv(k3.v[6],2,-1);
sv(k3.v[7],-2,11);sv(k3.v[8],-4,-4);
sv(k3.v[9],-9,3);sv(k3.v[10],-9,-8);
sv(k3.v[11],-6,-2);

sp(k3.p[1],2,3,6,15);sp(k3.p[2],1,5,6,8);
sp(k3.p[3],7,6,11,15);sp(k3.p[4],4,8,9,7);
sp(k3.p[5],8,4,10,8);

end;

end.