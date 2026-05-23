program vectest;
{$N+}
{$G+}
{$M 65500, 0,655000 }
uses crt,graph,vec1,bild,mouse,drivers,dos,planeten,as,constant;



var a,b:integer;
    c,d,e:word;
    ch:char;
    i,mb,t:byte;
    befehl:boolean; {gibt an ob irgendwelche schiffe aktiv sind}



begin

clrscr;
writeln('Welche Gruppe (1-3 mîglich) :');
readln(snr);
if (snr<1) or (snr>3) then snr:=1;

z:=0;
pview:=false;
rahmen:=false;
befehl:=false;
pnr:=0;
erzeuge;



fillchar(sp,sizeof(sp),0);
{max anzahlen der Schiffe jeder 85}

sp[1].max:=85;sp[2].max:=85;sp[3].max:=85;

initdaten;

newship(s[2].s,1,4);
newship(s[2].s,1,4);
newship(s[4].s,2,4);
newship(s[4].s,2,4);
newship(s[7].s,3,4);
newship(s[7].s,3,4);

repeat
inc(z);
change;

setviewport(0,0,500,getmaxy,true);

cleardevice;

p.x:=mousex;
p.y:=mousey*1.38;

if pview = false then
begin

{scrollen am Bildschirmrand}
if (p.x<3) and (bx<0) then inc(bx,5);
if (p.x>638) and (bx>-seite+500) then dec(bx,5);
if (p.y<3) and (by<0) then inc(by,5);
if (p.y>477) and (by>-seite+620) then dec(by,5);

{KI Steuerung}
for i:= 1 to max do
if s[i].ex=true then
begin
beweg(s[i]);
aufladen(s[i]);
end;

for i:=1 to 3 do
sp[i].an:=sp[i].t+sp[i].j+ sp[i].aj+sp[i].b;



{alles zeichnen was so da ist}
showplanet;
showammo;
aktivships;
showschild;
showexplos;
showraks;
showsmart;

for i:=1 to 3 do
if i<>snr then
begin
ki(i);
pki(i);
end;

{Planetenzeugs}
for i:=1 to maxpl do
begin
if z mod pge = 0 then pkampf(pl[i]);
produktion(pl[i]);
if sichtbar(pl[i].s) then
begin
prodstand(pl[i]);
live(pl[i]);
end;
end;

{zeichnen der rahmen}
for i:= 1 to max do
if (s[i].ex=true) and (s[i].r=true) then begin
befehl:=true;
rahmenbild(trunc(s[i].s.x)+bx,trunc(s[i].s.y*0.729)+by,s[i].panz,s[i].shield,
           s[i].pm,s[i].sx);
end;


if getmousebutton=2 then
begin
befehl:=false;
for i:= 1 to max do s[i].r:=false;
end;

if (befehl=true) and (mausinfeld(0,0,500,349)) then
begin
planettest(mb);
if mb>0 then pview:=false;
end;

{ziel von schiffen festlegen}
if (getmousebutton=1) and (befehl=true)and (mausinfeld(0,0,500,349)) then
begin
for i:= 1 to max do
if (s[i].r=true) and (s[i].ex=true) then begin
s[i].z.x:=mousex-bx+random(100)-50 ;
s[i].z.y:=(mousey-by)*1.38+random(100)-50;

if mb>0 then
 begin
 s[i].k:=mb;
 s[i].pl:=true;
 end
 else
 begin
 s[i].k:=0;
 s[i].pl:=false;
 end;
end;
end;

{gf fÅr schiffe bestimmen}
a:=( z mod 51) +1;
a:=a*5;
if s[a].ex = true then
s[a].gf:=searchgf(s[a].s,s[a].gr,s[a].f,s[a].fn);
if s[a-1].ex = true then
s[a-1].gf:=searchgf(s[a-1].s,s[a-1].gr,s[a-1].f,s[a-1].fn);
if s[a-2].ex = true then
s[a-2].gf:=searchgf(s[a-2].s,s[a-2].gr,s[a-2].f,s[a-2].fn);
if s[a-3].ex = true then
s[a-3].gf:=searchgf(s[a-3].s,s[a-3].gr,s[a-3].f,s[a-3].fn);
if s[a-4].ex = true then
s[a-4].gf:=searchgf(s[a-4].s,s[a-4].gr,s[a-4].f,s[a-4].fn);

{gf fÅr planeten}
a:=( z mod 10) +1;

for i:=1 to 3 do
begin
pl[a].k[i].gf:=searchgf(pl[a].s,i,pl[a].k[i].f2,pl[a].k[i].fn);
if pl[a].k[i].a>6 then inc(pl[a].k[i].gf,10);
if pl[a].k[i].a>0 then inc(pl[a].k[i].gf,10);
end;



end
else pmenu(pl[pnr]);

setviewport(0,0,getmaxx,getmaxy,true);

setcolor(15);
rectangle(0,0,500,349);
rectangle(501,0,639,102);

if ButtonDown then begin

if (pview = false) and (rahmen = false) and (befehl=false) and (mausinfeld(0,0,500,349)) then
begin planettest(pnr);if pview=true then delay(100);end;
if (pview = false) and (mausinfeld(0,0,500,349)) then
begin
if rahmen = false then begin rahmen:= true;rx:=mousex;ry:=mousey; end;
if rahmen = true then rectangle(rx,ry,mousex,mousey);

end;

{herumklicken in der Åbersicht}
if mausinfeld(500,0,640,103) then
begin
bx:=-trunc((p.x-500)*seite/140)+250;
by:=-trunc((p.y*0.729)*seite/140)+175;
end;

end;

{aus wÑhlen der eingrahmten schiffe}
if (rahmen= true) and (buttonup) then
begin
shiptest;
rahmen:=false;
end;

{sorgt dafÅr das nicht Åber das Spielfeld hinaus gescrolt wird}
if bx>0 then bx:=0;
if bx<-seite+500 then bx:=-seite+500;
if by>0 then by:=0;
if by<-seite+620+262*((seite div 1000)-1) then by:=-seite+620+262*((seite div 1000)-1);

{anzeigen der schiffe in der Åbersicht}
for i:=1 to max do
if s[i].ex = true then
begin
a:=trunc(140/seite*s[i].s.x);
b:=trunc(102/seite*s[i].s.y);
case s[i].typ of
1,2,3,10:putpixel(500+a,b,12);
4,5,6,11:putpixel(500+a,b,10);
7,8,9,12:putpixel(500+a,b,14);
end;
end;

{anzeigen der planeten in der Åbersicht}
for i:=1 to maxpl do
begin
a:=trunc(140/seite*pl[i].s.x);
b:=trunc(102/seite*pl[i].s.y);
if (pl[i].war = true) and (z mod 20 <10) then
putpixel(500+a,b,13) else
putpixel(500+a,b,15);
end;

a:=500-trunc(bx/seite*140);
b:=trunc(140/seite*(-by));
rectangle(a,b,a+trunc(500/seite*140),b+trunc(140/seite*350));

{speichern,laden}
if (mausinfeld(510,230,590,250)) and (buttondown) then
speichernladen(1);
if (mausinfeld(510,260,590,280)) and (buttondown) then
speichernladen(2);

rectangle(510,260,590,280);
rectangle(510,230,590,250);
outtextxy(515,238,'Speichern');
outtextxy(530,268,'Laden');

outtextxy(510,150,'JÑger:');
outtextxy(510,170,'Adv.JÑger:');
outtextxy(510,190,'Bomber:');
outtextxy(510,210,'Trans.:');
text(580,150,sp[snr].j);
text(580,170,sp[snr].aj);
text(580,190,sp[snr].b);
text(580,210,sp[snr].t);

{diverse Mauszeiger}
if (pview=false) and (befehl) then
begin
if mb>0 then
mausbild3 else
mausbild2;
end
else
mausbild;

ch:='X';

{alle tastaturbefehle}
if keypressed then
ch:=readkey;
case ch of
#27:begin
    if pview=true then begin pview:=false; ch:='X'; end;
    end;
'1':for i:= 1 to max do
if (s[i].ex=true) and (s[i].nr=1) then s[i].r:=true;
'2':for i:= 1 to max do
if (s[i].ex=true) and (s[i].nr=2) then s[i].r:=true;
'3':for i:= 1 to max do
if (s[i].ex=true) and (s[i].nr=3) then s[i].r:=true;
'4':for i:= 1 to max do
if (s[i].ex=true) and (s[i].nr=4) then s[i].r:=true;
'5':for i:= 1 to max do
if (s[i].ex=true) and (s[i].nr=5) then s[i].r:=true;
'6':for i:= 1 to max do
if (s[i].ex=true) and (s[i].nr=6) then s[i].r:=true;
'7':for i:= 1 to max do
if (s[i].ex=true) and (s[i].nr=7) then s[i].r:=true;
'8':for i:= 1 to max do
if (s[i].ex=true) and (s[i].nr=8) then s[i].r:=true;
end;

{gruppen fÅr schiffe festlegen}
if befehl = true then
case ch of
'!':for i:= 1 to max do
if s[i].ex=true then
begin
if s[i].nr=1 then s[i].nr:=0;
if s[i].r=true then s[i].nr:=1;
end;
'"':for i:= 1 to max do
if s[i].ex=true then
begin
if s[i].nr=2 then s[i].nr:=0;
if s[i].r=true then s[i].nr:=2;
end;
'ı':for i:= 1 to max do
if s[i].ex=true then
begin
if s[i].nr=3 then s[i].nr:=0;
if s[i].r=true then s[i].nr:=3;
end;
'$':for i:= 1 to max do
if s[i].ex=true then
begin
if s[i].nr=4 then s[i].nr:=0;
if s[i].r=true then s[i].nr:=4;
end;
'%':for i:= 1 to max do
if s[i].ex=true then
begin
if s[i].nr=5 then s[i].nr:=0;
if s[i].r=true then s[i].nr:=5;
end;
'&':for i:= 1 to max do
if s[i].ex=true then
begin
if s[i].nr=6 then s[i].nr:=0;
if s[i].r=true then s[i].nr:=6;
end;
'/':for i:= 1 to max do
if s[i].ex=true then
begin
if s[i].nr=7 then s[i].nr:=0;
if s[i].r=true then s[i].nr:=7;
end;
'(':for i:= 1 to max do
if s[i].ex=true then
begin
if s[i].nr=8 then s[i].nr:=0;
if s[i].r=true then s[i].nr:=8;
end;

end;

until ch=#27;
closegraph;

end.