unit Mouse;

interface
uses graph;
var    z:longint;

    function mausinfeld(x1,y1,x2,y2:word):boolean;
    procedure InitMouse;
    function getmousebutton:word; {Liefert zurck, welcher Mouseknopf
                                    gedrckt wurde (1 fr linken Button
                                                    2 fr rechten Button
                                                    {3 fr mittleren Button)}
                                                 {  4 fr linken und rechten}
    procedure ShowMouse;
	procedure HideMouse;

	function MouseX:word;
	function MouseY:word;
    function GetMouseRelX:word;
	function GetMouseRelY:word;

    function ReturnPressedButton:word;
    function ButtonDown:boolean;
    function ButtonUp:boolean;
    procedure mausbild;
    procedure mausbild2;
    procedure mausbild3;
    procedure SetMouseSensitivity(x,y:word);

implementation

procedure mausbild3;
begin
setcolor(4);
moveto(mousex+5,mousey+5);
lineto(mousex-5,mousey-5);
moveto(mousex-5,mousey+5);
lineto(mousex+5,mousey-5);
circle(mousex,mousey,z mod-8);
end;

procedure mausbild2;
begin
setcolor(15);
moveto(mousex+5,mousey+5);
lineto(mousex-5,mousey-5);
moveto(mousex-5,mousey+5);
lineto(mousex+5,mousey-5);
circle(mousex,mousey,3);
end;

procedure mausbild;
begin
setcolor(15);
moveto(mousex+5,mousey);
lineto(mousex-5,mousey);
moveto(mousex,mousey+5);
lineto(mousex,mousey-5);
end;

function getmousebutton:word;
assembler;
asm
mov ax,0003h
int 33h
mov ax,bx
end;

function mausinfeld(x1,y1,x2,y2:word):boolean;
var x,y:word;
begin
x:=mousex;y:=mousey;
if (x > x1) and (x < x2) and (y > y1) and (y < y2) then
mausinfeld:=true else
mausinfeld:=false;
end;

    procedure InitMouse;
    var
    	Temp:word;
    begin
    	asm
        	mov ax,00h
            int 33h
            mov [Temp],bx
        end; {asm}
    end; {InitMouse}

    procedure ShowMouse;
    begin
    	asm
        	mov ax,01h
            int 33h
        end; {asm}
    end; {ShowMouse}

	procedure HideMouse;
    begin
    	asm
        	mov ax,02h
            int 33h
        end; {asm}
    end; {HideMouse}

	function MouseX:word;
    var
    	Temp:word;
    begin
    	asm
        	mov ax,03h
            int 33h
        	mov [Temp],cx
        end; {asm}
		MouseX:=trunc(Temp);
    end; {GetMouseX}

	function MouseY:word;
    var
    	Temp:word;
    begin
    	asm
        	mov ax,03h
            int 33h
            mov [Temp],dx
        end; {asm}
        MouseY:=Temp;
    end; {GetMouseY}

    function GetMouseRelX:word;
    var
    	Temp:word;
    begin
    	asm
        	mov ax,0Bh
            int 33h
            mov [Temp],cx
        end; {asm}
        GetMouseRelX:=Temp;
    end; {GetMouseRelX}

	function GetMouseRelY:word;
    var
    	Temp:word;
    begin
    	asm
        	mov ax,0Bh
			int 33h
            mov [Temp],dx
		end; {asm}
		GetMouseRelY:=Temp;
    end; {GetMouseRelY}

	function ReturnPressedButton:word;
	var
    	Temp:word;
	begin
		asm
        	mov ax,03h
			int 33h
			mov [Temp],bx
        end; {asm}
        ReturnPressedButton:=Temp;
    end; {ReturnPressedButton}

    function ButtonDown:boolean;
    begin
		ButtonDown:=ReturnPressedButton<>0;
    end; {ButtonDown}

    function ButtonUp:boolean;
    begin
    	ButtonUp:=ReturnPressedButton=0;
    end; {ButtonUp}

    procedure SetMouseSensitivity(x,y:word);
    begin
        asm
        	mov ax,1ah
            mov bx,[x]
            mov cx,[y]
            mov dx,1
            int 33h
        end; {asm}
    end; {SetMouseSensitivity}
end. {Mouse}