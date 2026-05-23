unit vec1;
{$N+}
{$G+}
interface

type vec = record  x,y:single ;
                   end;



procedure addv(a,b:vec;var c:vec);
procedure subv(a,b:vec;var c:vec);
procedure orth(a:vec;var c:vec);
function lang(a:vec):single;
function abstand(a,b:vec):single;
procedure mult(a:vec;b:single;var c:vec);
procedure divi(a:vec;b:single;var c:vec);
procedure ev(a:vec;var b:vec);
function smult(a,b:vec):single;
function entf(p,v,x:vec):single;
procedure drehen(var a:vec;x:single);
procedure relat(x,s,p:vec;var e:vec);
procedure sv(var a:vec;x,y:single);

implementation

function abstand(a,b:vec):single;
begin
a.x:=a.x-b.x;
a.y:=a.y-b.y;
abstand:=sqrt(sqr(a.x)+sqr(a.y));
end;

procedure sv(var a:vec;x,y:single);
begin
a.x:=x;
a.y:=y;
end;

procedure relat(x,s,p:vec;var e:vec);
var y:vec;
begin
divi(x,10,x);
orth(x,y);
mult(x,p.x,x);
mult(y,p.y,y);
addv(x,y,x);
addv(x,s,e);
end;

procedure drehen(var a:vec;x:single);
var b:vec;
begin
orth(a,b);
mult(b,x/10,b);
addv(a,b,a);
ev(a,a);
mult(a,10,a);
end;

function entf(p,v,x:vec):single;
begin
orth(v,v);
subv(x,p,x);
entf:=smult(v,x)/lang(v);
end;

function smult(a,b:vec):single;
begin
smult:=a.x*b.x+a.y*b.y;
end;

procedure ev(a:vec;var b:vec);
var l:single;
begin
l:=lang(a);
b.x:=a.x/l;
b.y:=b.y/l;
end;

procedure mult(a:vec;b:single;var c:vec);
begin
c.x:=a.x*b; c.y:=a.y*b;
end;

procedure divi(a:vec;b:single;var c:vec);
begin
c.x:=a.x/b; c.y:=a.y/b;
end;

procedure addv(a,b:vec;var c:vec);
begin
c.x:=a.x+b.x;
c.y:=a.y+b.y;
end;

procedure subv(a,b:vec;var c:vec);
begin
c.x:=a.x-b.x;
c.y:=a.y-b.y;
end;

procedure orth(a:vec;var c:vec);
begin
c.x:=-a.y;
c.y:=a.x;
end;

function lang(a:vec):single;
begin
lang:=sqrt(sqr(a.x)+sqr(a.y));
end;


end.