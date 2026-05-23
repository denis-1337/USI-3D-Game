unit planeten;
{$N+}
{$G+}
interface
uses crt,graph,vec1,mouse,bild,constant;

const maxpl = 10;

type
         kolonie = record a:byte;  {anzahl besetzter sektoren}
                          inf:word; {einheiten}
                          def:word; {verteidiger}
                          auf:byte; {derzeitiger auftrag}
                          x:word;  {stand der ausfÅhrung}
                          max:word; {nach wieviel es fertig ist}
                          m:byte;{menge}
                          war:byte; {0 = verschanzen}
                          f:byte;{Faktor fÅr Lebensbedingungen}
                          f2:boolean;
                          gf:integer;
                          fn:byte;
                          end;

         planet = record s:vec; {standort}
                         name:string[20];
                         f:array[1..8] of byte; {farben der sektoren}
                         a:byte; {anzahl besetzter sektoren}
                         e:boolean; {false = noch nicht betreten worden}
                         war:boolean; { false = frieden }
                         k:array[1..3] of kolonie;
                         end;
         allep = array[1..maxpl] of planet;
      spieler = array[1..3] of record an:byte;{momentane Schiffanzahl}
                                      max:byte;{maximal mîgliche Anzahl}
                                         j,aj,b,t:byte;
                                         end;

var  pl:allep;
     sp:spieler;
     pview:boolean;
     pnr:byte; {nummer des planeten}

procedure showplanet;
procedure planettest(var a:byte);
procedure pmenu(var p:planet);
procedure text(x,y:integer;a:single);
procedure produktion(var p:planet);
procedure prodstand(var p:planet);
procedure live(p:planet);
procedure newship(p:vec;a,typ:byte);
procedure speichernladen(was:byte);
procedure pkampf(var p:planet);
procedure initdaten;

implementation


procedure initdaten;
var i:byte;
begin
for i:= 1 to 9 do
begin
s[i].ex:=true;
s[i].typ:=i mod 9 + 1;
s[i].v.x:=10;
s[i].v.y:=0;
case s[i].typ of
1,2,3:begin s[i].gr:=1;inc(sp[1].an);end;
4,5,6:begin s[i].gr:=2;inc(sp[2].an);end;
7,8,9:begin s[i].gr:=3;inc(sp[3].an);end;
end;
case s[i].typ of
1,4,7:begin s[i].panz:=100;s[i].shield:=50;s[i].sx:=50;s[i].pm:=100;inc(sp[s[i].gr].j); end;
2,5,8:begin s[i].panz:=120;s[i].shield:=70;s[i].sx:=70;s[i].pm:=120;inc(sp[s[i].gr].aj); end;
3,6,9:begin s[i].panz:=150;s[i].shield:=100;s[i].sx:=100;s[i].pm:=150;inc(sp[s[i].gr].b); end;
end;

case s[i].gr of
1:begin s[i].z.x:=200+random(100)-50;
        s[i].z.y:=200+random(100)-50; end;
2:begin s[i].z.x:=3800+random(100)-50;
        s[i].z.y:=500+random(100)-50; end;
3:begin s[i].z.x:=1000+random(100)-50;
        s[i].z.y:=3800+random(100)-50; end;
end;
s[i].s:=s[i].z;
end;



fillchar(pl,sizeof(pl),0);
for i:= 1 to maxpl do
begin
sv(pl[i].s,100+random(seite-200),100+random(seite-200));
case i of
1:pl[i].name:='Nupto';
2:pl[i].name:='Orion';
3:pl[i].name:='Poletz';
4:pl[i].name:='Byan';
5:pl[i].name:='Leptis';
6:pl[i].name:='Kleks';
7:pl[i].name:='Knopa';
8:pl[i].name:='Schnief';
9:pl[i].name:='Retil';
10:pl[i].name:='Arantka';
end;

pl[i].f[1]:=8;
pl[i].f[2]:=8;
pl[i].f[3]:=8;
pl[i].f[4]:=8;
pl[i].f[5]:=8;
pl[i].f[6]:=8;
pl[i].f[7]:=8;
pl[i].f[8]:=8;
pl[i].k[1].f:=50+random(50);
pl[i].k[2].f:=50+random(50);
pl[i].k[3].f:=50+random(50);
end;

end;



function kampf(k:kolonie):longint;
var c:longint;
begin
if k.inf> 200 then k.inf:=200;
if k.def> 2 then k.def:=2;

if k.war = 1 then
c:=trunc(k.inf*(1+k.f/100))
else c:=trunc(k.inf*(1+k.f/100)*1.25)+25*k.def;
if k.auf=0 then c:=trunc(c*1.25);

kampf:=random(c);
end;

procedure pkampf(var p:planet);
var a,b,e,i5:byte;
    c,c1,c2,d:longint;
begin
if p.a>1 then
begin
c:=1000000;
c1:=1000000;
c2:=1000000;
b:=0;
e:=0;

for a:= 1 to 3 do
begin
if p.k[a].inf = 1 then p.k[a].war:=0;
inc(b,p.k[a].war);
end;


for a:= 1 to 3 do
if p.k[a].a>0 then
inc(e);

if (b>0) and (e>1) then
p.war:=true else p.war:=false;

if p.war=true then
begin

if p.k[1].a>0 then
c:=kampf(p.k[1]);
if p.k[2].a>0 then
c1:=kampf(p.k[2]);
if p.k[3].a>0 then
c2:=kampf(p.k[3]);

if c>c1 then begin d:=c1; a:=2; end
else begin d:=c; a:=1; end;
if d>c2 then a:=3;

dec(p.k[a].inf);

if (p.k[a].war=0) and (random(100)<3) and (p.k[a].a>1) then
begin
Dec(p.k[a].a);
Dec(p.a);
case a of
1:b:=11;
2:b:=10;
3:b:=15;
end;
for i5:=1 to 8 do
if p.f[i5]=b then
begin
p.f[i5]:=8;
i5:=8;
end;

if p.k[a].def > 0 then dec(p.k[a].def);
end;

if p.k[a].inf=0 then
begin
e:=p.k[a].f;
Dec(p.a,p.k[a].a);
fillchar(p.k[a],sizeof(p.k[a]),0);
p.k[a].f:=e;
case a of
1:b:=11;
2:b:=10;
3:b:=15;
end;
for i5:=1 to 8 do
if p.f[i5]=b then
p.f[i5]:=8;

b:=0;
e:=0;
for a:= 1 to 3 do
inc(b,p.k[a].war);

for a:= 1 to 3 do
if p.k[a].a>0 then
inc(e);

if (b>0) and (e>1) then
p.war:=true else p.war:=false;

end;

end;

end;
end;


procedure text(x,y:integer;a:single);
var b:string;
begin
str(a:4:0,b);
outtextxy(x,y,b);
end;

procedure showplanet;
var i,k:byte;
    v:vec;
begin
sv(v,10,0);
for i:= 1 to maxpl do
begin

for k:= 1 to 8 do
pla.p[k].f:=pl[i].f[k];

one(v,pl[i].s,pla.v,pla.p,pla.maxv,pla.maxp);

end;
end;

procedure pmenu(var p:planet);
begin

outtextxy(50,20,'Level');
text(80,20,p.k[snr].a);
outtextxy(240,20,p.name);
outtextxy(445,320,'zurÅck');
outtextxy(50,70,'Bauen:');
if p.a<8 then
begin
outtextxy(120,70,'nÑchstes Level');
rectangle(115,65,235,80);
end;

if p.k[snr].a*200>p.k[snr].inf then begin
outtextxy(120,90,'Soldaten');
rectangle(115,85,235,100);
end;

if (p.k[snr].a>1) and (sp[snr].an<sp[snr].max) then begin
outtextxy(120,110,'JÑger');
rectangle(115,105,235,120);
end;
if (p.k[snr].inf>=100) and (p.k[snr].a>2) and (sp[snr].an<sp[snr].max) then begin
outtextxy(120,130,'Transporter');
rectangle(115,125,235,140);
end;
if (p.k[snr].a>3) and (sp[snr].an<sp[snr].max) then begin
outtextxy(270,70,'Adv. JÑger');
rectangle(265,65,385,80);
end;
if (p.k[snr].a>4) and (p.k[snr].a>p.k[snr].def) then begin
outtextxy(270,90,'Forts');
rectangle(265,85,385,100);
end;
if (p.k[snr].a>5) and (sp[snr].an<sp[snr].max) then begin
outtextxy(270,110,'Bomber');
rectangle(265,105,385,120);
end;
outtextxy(270,130,'Nichts');
rectangle(265,125,385,140);

outtextxy(50,155,'Auftrag:');
case p.k[snr].auf of
0:outtextxy(120,155,'Nichts');
1:outtextxy(120,155,'n. Level');
2:outtextxy(120,155,'Soldaten');
3:outtextxy(120,155,'JÑger');
4:outtextxy(120,155,'Transporter');
5:outtextxy(120,155,'Adv. JÑger');
6:outtextxy(120,155,'Forts');
7:outtextxy(120,155,'Bomber');
end;

outtextxy(50,170,'Anzahl:');
text(120,170,p.k[snr].m);
outtextxy(170,167,'+');
outtextxy(170,177,'-');

outtextxy(50,205,'Info:');
outtextxy(120,205,'Soldaten:');text(190,205,p.k[snr].inf);
outtextxy(120,225,'Forts:');text(190,225,p.k[snr].def);
outtextxy(120,245,'Verhalten:');
outtextxy(120,265,'Planet:');

if p.k[snr].war=1 then outtextxy(220,245,'Angriff')
else outtextxy(220,245,'Verteidigung');
rectangle(215,240,335,255);

if p.war=true then outtextxy(220,265,'Krieg')
else outtextxy(220,265,'Frieden');

outtextxy(120,285,'alle Armeen:');
setcolor(11);
text(230,285,p.k[1].inf);
setcolor(10);
text(230,305,p.k[2].inf);
setcolor(15);
text(230,325,p.k[3].inf);

outtextxy(270,205,'Schild:');
outtextxy(270,225,'Kanonen:');

if p.k[snr].a<7 then outtextxy(350,225,'inaktiv')
else outtextxy(350,225,'aktiv');
if p.k[snr].a<8 then outtextxy(350,205,'inaktiv')
else outtextxy(350,205,'aktiv');

if p.k[snr].auf>0 then
begin
moveto(100,200);linerel(trunc(p.k[snr].x/p.k[snr].max*200),0);end;

rectangle(440,315,495,330);
if ButtonDown then
begin
if (p.a<8) and (mausinfeld(115,65,235,80)) then begin p.k[snr].auf:=1;p.k[snr].x:=0;
p.k[snr].max:=2*nlevel-trunc(nlevel*p.k[snr].f/100);end;
if (p.k[snr].a*200>p.k[snr].inf) and (mausinfeld(115,85,235,100)) then begin p.k[snr].auf:=2;p.k[snr].x:=0;
p.k[snr].max:=soldaten;end;
if (p.k[snr].a>1) and  (mausinfeld(115,105,235,120)) then begin p.k[snr].auf:=3;p.k[snr].x:=0;p.k[snr].max:=jager;end;
if (p.k[snr].a>2) and  (mausinfeld(115,125,235,140)) then begin p.k[snr].auf:=4;p.k[snr].x:=0;p.k[snr].max:=transporter;end;
if (p.k[snr].a>3) and  (mausinfeld(265,65,385,80)) then begin p.k[snr].auf:=5;p.k[snr].x:=0;p.k[snr].max:=advjager;end;
if (p.k[snr].a>4) and (p.k[snr].a>p.k[snr].def) and  (mausinfeld(265,85,385,100)) then begin p.k[snr].auf:=6;p.k[snr].x:=0;
p.k[snr].max:=forts;end;
if (p.k[snr].a>5) and  (mausinfeld(265,105,385,120)) then begin p.k[snr].auf:=7;p.k[snr].x:=0;p.k[snr].max:=bomber;end;
if mausinfeld(265,125,385,140) then begin p.k[snr].auf:=0;p.k[snr].x:=0;end;
if mausinfeld(440,315,495,330) then pview:=false;
if mausinfeld(170,165,190,175) then inc(p.k[snr].m);
if mausinfeld(170,175,190,185) then dec(p.k[snr].m);
if mausinfeld(215,240,335,255) then begin
if p.k[snr].war =1 then p.k[snr].war:=0 else p.k[snr].war:=1;
delay(100); end;

end;
end;

procedure newship(p:vec;a,typ:byte);
var i2:byte;
begin
for i2:=1 to max do
if s[i2].ex= false then
begin
s[i2].ex:=true;
case typ of
3:begin
if a=1 then s[i2].typ:=1;
if a=2 then s[i2].typ:=4;
if a=3 then s[i2].typ:=7;
end;
4:begin
if a=1 then s[i2].typ:=10;
if a=2 then s[i2].typ:=11;
if a=3 then s[i2].typ:=12;
end;
5:begin
if a=1 then s[i2].typ:=2;
if a=2 then s[i2].typ:=5;
if a=3 then s[i2].typ:=8;
end;
7:begin
if a=1 then s[i2].typ:=3;
if a=2 then s[i2].typ:=6;
if a=3 then s[i2].typ:=9;
end;

end;

case s[i2].typ of
1,2,3,10:begin s[i2].gr:=1;inc(sp[1].an);end;
4,5,6,11:begin s[i2].gr:=2;inc(sp[2].an);end;
7,8,9,12:begin s[i2].gr:=3;inc(sp[3].an);end;
end;
case s[i2].typ of
1,4,7:begin s[i2].panz:=100;s[i2].shield:=50;s[i2].sx:=50;s[i2].pm:=100;inc(sp[s[i2].gr].j); end;
2,5,8:begin s[i2].panz:=120;s[i2].shield:=70;s[i2].sx:=70;s[i2].pm:=120;inc(sp[s[i2].gr].aj); end;
3,6,9:begin s[i2].panz:=150;s[i2].shield:=100;s[i2].sx:=100;s[i2].pm:=150;inc(sp[s[i2].gr].b); end;
10,11,12:begin s[i2].panz:=300;s[i2].shield:=150;s[i2].sx:=150;s[i2].pm:=300;inc(sp[s[i2].gr].t);end;

end;
s[i2].v.x:=10;
s[i2].v.y:=0;
s[i2].s.x:=p.x+random(200)-100;
s[i2].s.y:=p.y+random(200)-100;
s[i2].k:=0;
s[i2].z.x:=s[i2].s.x+random(100)-50;
s[i2].z.y:=s[i2].s.y+random(100)-50;
s[i2].r:=false;
s[i2].ge:=0;
s[i2].nr:=0;
s[i2].gf:=0;
s[i2].m:=0;
s[i2].fn:=0;
s[i2].f:=false;
s[i2].pl:=false;
i2:=max
end;
end;


procedure produktion(var p:planet);
var i1,i5:byte;
begin
if p.a>0 then
for i1:=1 to 3 do
if p.k[i1].a>0 then
begin
if p.k[i1].m=0 then p.k[i1].auf:=0;
if p.k[i1].auf>0 then
begin
inc(p.k[i1].x);

if p.k[i1].x=p.k[i1].max then
begin
case p.k[i1].auf of
1:if p.a<8 then
begin
inc(p.a);inc(p.k[i1].a);
if p.a=8 then p.k[i1].m:=1;
for i5:=1 to 8 do
if p.f[i5]=8 then
begin
case i1 of
1:p.f[i5]:=11;
2:p.f[i5]:=10;
3:p.f[i5]:=15;
end;
i5:=8;
end;
end;
2: begin
inc(p.k[i1].inf,50);
if (p.k[i1].m-1)*50 > p.k[i1].a*200-p.k[i1].inf then
p.k[i1].m:=(p.k[i1].a*200-p.k[i1].inf) div 50+1;
end;
3:begin
if sp[i1].an<sp[i1].max then
newship(p.s,i1,3)
else p.k[i1].m:=1;
end;
4:begin
if (sp[i1].an<sp[i1].max) and (p.k[i1].inf>=100) then
begin
newship(p.s,i1,4);
dec(p.k[i1].inf,100);
end
else p.k[i1].m:=1;
end;
5:begin
if sp[i1].an<sp[i1].max then
newship(p.s,i1,5)
else p.k[i1].m:=1;
end;
6:begin
if p.k[i1].a>p.k[i1].def then inc(p.k[i1].def)
else p.k[i1].m:=1;
end;
7:begin
if sp[i1].an<sp[i1].max then
newship(p.s,i1,7)
else p.k[i1].m:=1;
end;


end;
p.k[i1].x:=0;
dec(p.k[i1].m);
end;
end;
end;

end;

procedure live(p:planet);
begin
moveto(trunc(p.s.x)+bx,trunc(p.s.y*0.729)+by);
if p.war = true then setcolor(4)
else setcolor(8);
moverel(25,0);linerel(30,0);
moverel(-30,10);linerel(30,0);
moverel(-30,10);linerel(30,0);
moverel(-30,-20);
setcolor(11);
linerel(trunc(p.k[1].f/100*30),0);
moverel(-trunc(p.k[1].f/100*30),10);
setcolor(10);
linerel(trunc(p.k[2].f/100*30),0);
moverel(-trunc(p.k[2].f/100*30),10);
setcolor(15);
linerel(trunc(p.k[3].f/100*30),0);
end;

procedure prodstand(var p:planet);
begin
if (p.k[snr].a>0) and (p.k[snr].auf>0) then
begin
moveto(trunc(p.s.x)+bx,trunc(p.s.y*0.729)+by);
moverel(-20,-25);
setcolor(14);
linerel(trunc(p.k[snr].x/p.k[snr].max*40),0)
end;
end;

procedure planettest(var a:byte);
var i:byte;
begin
a:=0;
for i:= 1 to maxpl do
if mausinfeld( trunc(pl[i].s.x)+bx-20,trunc(pl[i].s.y*0.729)+by-20,
               trunc(pl[i].s.x)+bx+20,trunc(pl[i].s.y*0.729)+by+20 )
                then
begin
if pl[i].k[snr].a>0 then pview:=true;
a:=i;
i:=maxpl;
end;

end;

procedure speichernladen(was:byte);
type allesaufeinmal = record
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
               snr:byte;
               rahmen:boolean;
               rx,ry:word;
               p:vec;
               pl:allep;
               sp:spieler;
               pview:boolean;
               pnr:byte;
               z:longint;
               befehl:boolean;
           end;
var alles:file of allesaufeinmal;
    he:allesaufeinmal;
begin

if was= 1 then
begin
he.sd:=sd;
he.ex:=ex;
he.aex:=aex;
he.page:=page;
he.s:=s;
he.a:=a;
he.r:=r;
he.h:=h;
he.g:=g;
he.bx:=bx;
he.by:=by;
he.snr:=snr;
he.rahmen:=rahmen;
he.rx:=rx;
he.ry:=ry;
he.p:=p;
he.pl:=pl;
he.sp:=sp;
he.pview:=pview;
he.pnr:=pnr;
he.z:=z;
he.befehl:=befehl;
Assign(alles,'usi.sav');
rewrite(alles);
seek(alles,0);
write(alles,he);
close(alles);

end
else
begin
Assign(alles,'usi.sav');
reset(alles);
seek(alles,0);
read(alles,he);
close(alles);
sd:=he.sd;
ex:=he.ex;
aex:=he.aex;
page:=he.page;
s:=he.s;
a:=he.a;
r:=he.r;
h:=he.h;
g:=he.g;
bx:=he.bx;
by:=he.by;
snr:=he.snr;
rahmen:=he.rahmen;
rx:=he.rx;
ry:=he.ry;
p:=he.p;
pl:=he.pl;
sp:=he.sp;
pview:=he.pview;
pnr:=he.pnr;
z:=he.z;
befehl:=he.befehl;
end;
end;

end.