/* vec.js — 2D vector math library, ported from vec.pas */

// sv — set vector components
function sv(a, x, y) {
  a.x = x;
  a.y = y;
}

// addv — c = a + b
function addv(a, b, c) {
  c.x = a.x + b.x;
  c.y = a.y + b.y;
}

// subv — c = a - b
function subv(a, b, c) {
  c.x = a.x - b.x;
  c.y = a.y - b.y;
}

// mult — c = a * scalar
function mult(a, b, c) {
  c.x = a.x * b;
  c.y = a.y * b;
}

// divi — c = a / b  (safe divide)
function divi(a, b, c) {
  if (b !== 0) {
    c.x = a.x / b;
    c.y = a.y / b;
  } else {
    c.x = 0;
    c.y = 0;
  }
}

// lang — length (magnitude) of vector
function lang(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

// abstand — distance between two vectors
function abstand(a, b) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// orth — perpendicular vector: c = (-a.y, a.x)
function orth(a, c) {
  var tx = a.x;
  c.x = -a.y;
  c.y = tx;
}

// smult — dot product
function smult(a, b) {
  return a.x * b.x + a.y * b.y;
}

// ev — normalize: b = unit vector of a
function ev(a, b) {
  var l = lang(a);
  if (l > 0) {
    b.x = a.x / l;
    b.y = a.y / l;
  } else {
    b.x = 0;
    b.y = 0;
  }
}

// drehen — rotate/steer vector by small orthogonal displacement
// Not a sin/cos rotation; uses orthogonal offset + normalization
function drehen(a, x) {
  var b = { x: 0, y: 0 };
  orth(a, b);          // b = (-a.y, a.x)
  mult(b, x / 10, b);  // small orthogonal displacement
  addv(a, b, a);       // a = a + b
  ev(a, a);            // normalize to length 1
  mult(a, 10, a);      // scale back to length 10
}

// entf — perpendicular distance from point to line
// Pascal passes v by value, so orth(v,v) only modifies a local copy.
// In JS objects are pass-by-reference, so we must copy v ourselves
// to avoid corrupting the caller's velocity vector.
function entf(p, v, x) {
  var nv = { x: v.x, y: v.y };  // local copy — Pascal pass-by-value
  orth(nv, nv);                  // orthogonalize the copy
  subv(x, p, x);                 // x = x - p in-place (caller provides a copy when needed)
  var lv = lang(nv);
  if (lv > 0)
    return smult(nv, x) / lv;
  else
    return 0;
}

// relat — relative positioning
function relat(x, s, p, e) {
  var y = { x: 0, y: 0 };
  divi(x, 10, x);
  orth(x, y);
  mult(x, p.x, x);
  mult(y, p.y, y);
  addv(x, y, x);
  addv(x, s, e);
}
