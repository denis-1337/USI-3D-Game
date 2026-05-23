unit AS;
{$N+}
{$G+}
interface
uses bild,planeten,vec1,mouse,graph,constant;



procedure rahmenbild(x,y,p,s,pm,sm:integer);
procedure beweg(var sh:ship);
procedure aufladen(var s:ship);
procedure zielsuchen(x:vec;gr:byte;var k:byte);
function searchgf(p:vec;gr:byte;var feind:boolean;var fn:byte):integer;
procedure pki(g:byte);
procedure ki(g:byte);

implementation

procedure pki(g:byte);
var t,l,a:byte;
    ge:boolean;
begin
ge:=false;
for t:=1 to maxpl do
begin
if pl[t].k[g].inf>250 then pl[t].k[g].war:=1
else pl[t].k[g].war:=0;
if (pl[t].k[g].x=0) or (pl[t].k[g].auf=0) then
begin
a:=random(pl[t].k[g].a)+1;
if (a=3) and (pl[t].k[g].a>3) then a:=5;
if (a=5) and (pl[t].k[g].a>5) then a:=7;
if (a=7) and (sp[g].b>65) then a:=0;
if (a=4) and (pl[t].war=true) then a:=0;
case a of

1:if pl[t].a<8 then
begin pl[t].k[g].auf:=1;pl[t].k[g].x:=0;
pl[t].k[g].max:=2*nlevel-trunc(nlevel*pl[t].k[g].f/100);ge:=true;
pl[t].k[g].m:=1;end;

2:if pl[t].k[g].a*200>pl[t].k[g].inf then
begin pl[t].k[g].auf:=2;pl[t].k[g].x:=0;
pl[t].k[g].max:=soldaten;ge:=true;pl[t].k[g].m:=1;end;

3:if sp[g].an<sp[g].max then begin
pl[t].k[g].m:=1;
pl[t].k[g].auf:=3;
pl[t].k[g].max:=jager;
ge:=true;
end;

4:if (pl[t].k[g].inf>=100) and (sp[g].an<sp[g].max) then begin
pl[t].k[g].auf:=4;pl[t].k[g].x:=0;pl[t].k[g].max:=transporter;ge:=true;
pl[t].k[g].m:=1;end;

5:if sp[g].an<sp[g].max then begin
pl[t].k[g].auf:=5;pl[t].k[g].x:=0;pl[t].k[g].max:=advjager;ge:=true;
pl[t].k[g].m:=1;end;

6:if pl[t].k[g].a>pl[t].k[g].def then begin
pl[t].k[g].auf:=6;pl[t].k[g].x:=0;
pl[t].k[g].max:=forts;ge:=true;pl[t].k[g].m:=1;end;

7:if sp[g].an<sp[g].max then begin
pl[t].k[g].auf:=7;pl[t].k[g].x:=0;pl[t].k[g].max:=bomber;ge:=true;
pl[t].k[g].m:=1;end;
end;
if ge=false then
begin pl[t].k[g].auf:=0;pl[t].k[g].x:=0;end;

end;
end;

end;


procedure ki(g:byte);
var t,l:byte;

begin

{besiedlung freier Planeten}
for t:=1 to maxpl do
begin
if (pl[t].k[g].gf>=0) and (pl[t].k[g].a=0) and (random(100)<30) then
begin
for l:=1 to max do
if (s[l].ex=true) and (s[l].gr=g) and (s[l].typ>9) and (s[l].f=false)
and (s[l].pl=false) and (random(100)<20) then
begin
s[l].k:=t;
s[l].pl:=true;
end;
end;
end;

{unterstÅtzng mit truppen}
for t:=1 to maxpl do
begin
if (pl[t].k[g].gf>=0) and (pl[t].k[g].inf<200) and (random(100)<10)
 and (pl[t].k[g].a>0) and (pl[t].war=true)
then
begin
for l:=1 to max do
if (s[l].ex=true) and (s[l].gr=g) and (s[l].typ>9)
and (random(100)<20) then
begin
s[l].k:=t;
s[l].pl:=true;
end;
end;
end;

{schÅtzen der eigenen Planeten }
for t:=1 to maxpl do
begin
if (pl[t].k[g].gf<0)and(pl[t].k[g].a>0) then
begin
for l:=1 to max do
if (s[l].ex=true) and (s[l].gr=g) and (s[l].typ<10) and (s[l].f=false)
and (s[l].pl=false) and (pl[t].k[g].gf+s[l].gf> 10) then
begin
s[l].z.x:=pl[t].s.x+random(100)-50;
s[l].z.y:=pl[t].s.y+random(100)-50;
s[l].pl:=true;
end;
end
else for l:=1 to max do if (s[l].ex=true) and (s[l].gr=g) and (s[l].typ<10) then
s[l].pl:=false;
end;

{eroberung}
for t:=1 to maxpl do
begin
if (pl[t].k[g].gf<0)and(pl[t].k[g].a=0) then
for l:=1 to max do
if (s[l].ex=true) and (s[l].gr=g) and (s[l].typ<10) and (s[l].f=false)
and (s[l].pl=false) and (pl[t].k[g].gf+s[l].gf> 100) and (random(100)<4) then
begin
s[l].z.x:=pl[t].s.x+random(100)-50;
s[l].z.y:=pl[t].s.y+random(100)-50;
s[l].pl:=true;
end;
end;


for l:=1 to max do
if (s[l].ex=true) and (s[l].gr=g) and (s[l].typ<10)and
(abstand(s[l].z,s[l].s)<300) then
if (s[l].gf>20 ) or (s[l].gf<0 ) then
s[l].pl:=false;


end;

function searchgf(p:vec;gr:byte;var feind:boolean;var fn:byte):integer;
var t:byte;
    a,b,c:integer;
begin
b:=0;
c:=0;
fn:=0;
for t:=1 to max do
if (s[t].ex=true) and (abstand(p,s[t].s)<400) then
begin
case s[t].typ of
1,4,7:a:=3;
2,5,8:a:=4;
3,6,9:a:=5;
10,11,12:a:=1;
13:a:=10;
end;
if s[t].gr = gr then inc(b,a) else
begin
 inc(c,a);
if (fn=0)and (abstand(p,s[t].s)<250) and (random(100)<50) then fn:=t;
end;
end;
searchgf:=b*mut-c;
if c>0 then feind:=true else feind:=false;
end;

procedure aufladen(var s:ship);
begin
if (z mod 10 = 0) and (s.shield< s.sx) then inc(s.shield);
if (s.panz >-1000) and (s.panz<1) then s.h:=s.v;
if (s.panz < 1) and (z mod 20 = 0 ) then
begin
initexplo(s.s);
dec(s.panz,1000);
end;
if s.panz < -5000 then
begin
s.ex:=false;
dec(sp[s.gr].an);
case s.typ of
1,4,7:dec(sp[s.gr].j);
2,5,8:dec(sp[s.gr].aj);
3,6,9:dec(sp[s.gr].b);
10,11,12:dec(sp[s.gr].t);
end;
end;

end;

procedure fliegezu(var x,s,v:vec; var g:single);
begin
g:=entf(s,v,x)/50;
if g<-0.5 then g:=-0.5;
if g>0.5 then g:= 0.5;
drehen(v,g);
end;

procedure attack(var s:ship;var p:planet);
var i5,g:byte;
begin
g:=0;
if (p.a<8) and (p.k[s.gr].a=0) then
begin
inc(p.a);inc(p.k[s.gr].a);
for i5:=1 to 8 do
if p.f[i5]=8 then
begin
case s.gr of
1:p.f[i5]:=11;
2:p.f[i5]:=10;
3:p.f[i5]:=15;
end;
i5:=8;
end;
end;

if (p.a=8) and (p.k[s.gr].a=0) then
begin
inc(p.k[s.gr].a);

for i5:=1 to 3 do
if i5<>s.gr then
if p.k[i5].a>g then g:=i5;

dec(p.k[g].a);

case g of
1:g:=11;
2:g:=10;
3:g:=15;
end;

for i5:=1 to 8 do
if p.f[i5]=g then
begin
case s.gr of
1:p.f[i5]:=11;
2:p.f[i5]:=10;
3:p.f[i5]:=15;
end;
i5:=8;
end;
end;

inc(p.k[s.gr].inf,100);
dec(sp[s.gr].t);
s.ex:=false;

end;

procedure beweg(var sh:ship);
var g,g1:single;
    o:vec;
    a,b:integer;
    t:byte;
begin
a:=-30000;

orth(sh.v,o);
{bewegen}

if sh.s.x > seite then sh.v.x:=abs(sh.v.x)*-1;
if sh.s.x < 0 then sh.v.x:=abs(sh.v.x);
if sh.s.y > seite then sh.v.y:=abs(sh.v.y)*-1;
if sh.s.y < 0 then sh.v.y:=abs(sh.v.y);

if sh.panz>0 then
begin
sh.s.x:=sh.s.x+sh.v.x*0.002*sh.ge;
sh.s.y:=sh.s.y+sh.v.y*0.002*sh.ge;

{Flucht vor Åbermacht}
if sh.gf<0 then
begin

for t:= 1 to max do
if (s[t].gf>sh.gf) and (s[t].ex=true) and (s[t].gr=sh.gr) then
if s[t].gf > a then
begin
a:=s[t].gf;
sh.z.x:=s[t].s.x+random(100)-50;
sh.z.y:=s[t].s.y+random(100)-50;
sh.pl:=false;
sh.k:=0;
end;

for t:= 1 to maxpl do
if pl[t].k[sh.gr].gf>sh.gf then
if pl[t].k[sh.gr].gf > a then
begin
a:=pl[t].k[sh.gr].gf;
sh.z.x:=pl[t].s.x+random(100)-50;
sh.z.y:=pl[t].s.y+random(100)-50;
sh.pl:=false;
sh.k:=0;
end;
end;

{fÅr alle anderen}
if sh.typ<10 then
begin
if (sh.ge<100) and (sh.f=true) then inc(sh.ge);
if (sh.f=true) and (sh.gf>0) then
begin

if (sh.fn>0) and (s[sh.fn].ex=true) then
begin
fliegezu(s[sh.fn].s,sh.s,sh.v,g);

g:=entf(sh.s,sh.v,s[sh.fn].s)/50;
g1:=entf(sh.s,o,s[sh.fn].s);
if g<-0.5 then g:=-0.5;
if g>0.5 then g:= 0.5;
if (z mod 5 =0) and (abs(g*50)< random(6)) and (g1<0) and (abstand(sh.s,s[sh.fn].s)<150) then
begin
if  sh.typ mod 3 =0 then
begin
if (sh.typ <7) and (z mod 30 = 0) then initsmart(sh.s,sh.v,sh.gr);
if (sh.typ >7) and (z mod 15 = 0) then initraks(sh.s,sh.v,sh.gr);
end;
initammo(sh.s,sh.v,sh.typ);
end;
end

end;
if sh.fn=0 then fliegezu(sh.z,sh.s,sh.v,g);

end;

if sh.typ > 9 then
begin {fÅr transporter  }
if (sh.ge<100) and (sh.f=true) then inc(sh.ge);
if sh.k>0 then
begin

if sh.ge<99 then inc(sh.ge,2);
fliegezu(pl[sh.k].s,sh.s,sh.v,g);
if abstand(pl[sh.k].s,sh.s)<25 then
attack(sh,pl[sh.k]);

end
else
if sh.fn=0 then
fliegezu(sh.z,sh.s,sh.v,g);
end;

if (sh.pl=true) and (sh.k>0) then
g1:=abstand(pl[sh.k].s,sh.s)
else
if sh.k=0 then
g1:=abstand(sh.z,sh.s);

if (g1>100) and (sh.ge<100) then inc(sh.ge);
if (g1<100) and (sh.f=false) and (sh.ge>0) then dec(sh.ge);



{schlingern bei treffer}
if abs(sh.m)>0.5 then
drehen(sh.v,sh.m/2);
sh.m:=sh.m*0.7;
end {wenn es nicht mehr heil ist}
else
begin
drehen(sh.v,sh.m/2);
sh.s.x:=sh.s.x+sh.h.x*0.004*sh.ge;
sh.s.y:=sh.s.y+sh.h.y*0.004*sh.ge;
end;


end;

procedure zielsuchen(x:vec;gr:byte;var k:byte);
var i2:byte;
    e1,e2:single;
begin
e2:=301;

for i2:=1 to max do
if (s[i2].ex=true) and (gr<>s[i2].gr) then
begin
e1:=abstand(x,s[i2].s);
if (e1 < e2) and (e1 > 120) then begin k:=i2;e2:=e1 end;
end;

end;

procedure rahmenbild(x,y,p,s,pm,sm:integer);
begin
setcolor(7);
moveto(x,y);
moverel(-5,-10);linerel(-5,0);linerel(0,5);
moverel(0,10);linerel(0,5);linerel(5,0);
moverel(10,0);linerel(5,0);linerel(0,-5);
moverel(0,-10);linerel(0,-5);linerel(-5,0);
if p>1 then begin
p:=trunc(20*p/pm);
s:=trunc(20*s/sm);
setcolor(4);
moverel(-15,0);linerel(p,0);
setcolor(11);
moverel(-p,20);linerel(s,0);
end;
end;

end.