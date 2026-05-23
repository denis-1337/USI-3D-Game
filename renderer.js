/* renderer.js — 3D rendering engine with Three.js + Canvas 2D overlay.
 *
 * 3D (Three.js): Ships, planets, projectiles, explosions, effects
 * 2D Overlay: UI elements, minimap, planet menu, selection frames
 *
 * Dependencies:
 *   constants.js, vec.js, entities.js, globals.js,
 *   three-init.js, three-objects.js, three-render.js
 */

/* ================================================================ */
/* VGA Palette (16 colors) — for 2D overlay rendering              */
/* ================================================================ */
var VGA_PALETTE = [
  { r:   0, g:   0, b:   0, a: 255 },  // 0  black
  { r:   0, g:   0, b: 188, a: 255 },  // 1  blue
  { r:   0, g: 188, b:   0, a: 255 },  // 2  green
  { r:   0, g: 188, b: 188, a: 255 },  // 3  cyan
  { r: 188, g:   0, b:   0, a: 255 },  // 4  red
  { r: 188, g:   0, b: 188, a: 255 },  // 5  magenta
  { r: 188, g: 155, b:   0, a: 255 },  // 6  brown / orange
  { r: 188, g: 188, b: 188, a: 255 },  // 7  light grey
  { r:  94, g:  94, b:  94, a: 255 },  // 8  dark grey
  { r:   0, g:   0, b: 255, a: 255 },  // 9  bright blue
  { r:   0, g: 255, b:   0, a: 255 },  // 10 bright green
  { r:   0, g: 255, b: 255, a: 255 },  // 11 bright cyan
  { r: 255, g:   0, b:   0, a: 255 },  // 12 bright red
  { r: 255, g:   0, b: 255, a: 255 },  // 13 bright magenta
  { r: 255, g: 255, b:   0, a: 255 },  // 14 yellow
  { r: 255, g: 255, b: 255, a: 255 }   // 15 white
];

function vgaColor(c) {
  if (c > 15) c = 0;
  var col = VGA_PALETTE[c];
  return 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',' + (col.a / 255).toFixed(2) + ')';
}

/* ================================================================ */
/* Clipping and coordinate helpers                                  */
/* ================================================================ */
var GAME_AREA_X = 0;
var GAME_AREA_Y = 0;
var CLIP_MARGIN = 18;
var CLIP_X_MIN = 0;
var CLIP_Y_MIN = 0;

/* Shared temp vectors — avoid per-frame GC in hot paths */
var _tmpVec = { x: 0, y: 0 };
var _tmpVec2 = { x: 0, y: 0 };
var _tmpPos = { x: 0, y: 0 };

function GetClipXMax() {
  return GAME_AREA_X + GameAreaWidth;
}

function GetClipYMax() {
  return GAME_AREA_Y + GameAreaHeight;
}

function inGameArea(px, py) {
  return (px >= GAME_AREA_X) && (px < GAME_AREA_X + GameAreaWidth) &&
         (py >= GAME_AREA_Y) && (py < GAME_AREA_Y + GameAreaHeight);
}

function inClipRect(px, py) {
  var cxMax = GetClipXMax();
  var cyMax = GetClipYMax();
  if (px >= CLIP_X_MIN && px <= cxMax && py >= CLIP_Y_MIN && py <= cyMax)
    return true;
  if (px >= cxMax && px < curW && py >= 0 && py < curH)
    return true;
  return false;
}

function ClipInt(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/* ================================================================ */
/* sp — set polygon vertices (helper for model building)            */
/* ================================================================ */
function sp(poly, x, y, z, f) {
  poly.a[0] = x;
  poly.a[1] = y;
  poly.a[2] = z;
  poly.f = f;
}

/* ================================================================ */
/* ClearScreen — now renders the 3D scene                          */
/* ================================================================ */
function ClearScreen() {
  /* 3D render handles clearing */
}

function PresentFrame() {
  /* Three.js render is called in render3DFrame() */
}

/* ================================================================ */
/* WorldToScreen / ScreenToWorld                                    */
/* Still needed for UI overlay and 2D effects                       */
/* ================================================================ */
var _w2s = { x: 0, y: 0 };
function WorldToScreen(wx, wy) {
  var cx = GAME_AREA_X + GameAreaWidth / 2.0;
  var cy = GAME_AREA_Y + GameAreaHeight / 2.0;
  _w2s.x = (wx + bx + GAME_AREA_X - cx) * zoomScale + cx;
  _w2s.y = (wy + by + GAME_AREA_Y - cy) * zoomScale + cy;
  return _w2s;
}

function ScreenToWorld(sx, sy) {
  var cx = GAME_AREA_X + GameAreaWidth / 2.0;
  var cy = GAME_AREA_Y + GameAreaHeight / 2.0;
  var wx = (sx - cx) / zoomScale - bx - GAME_AREA_X + cx;
  var wy = (sy - cy) / zoomScale - by - GAME_AREA_Y + cy;
  return { x: wx, y: wy };
}

/* ================================================================ */
/* 3D-aware projection using Three.js camera + raycaster            */
/* Used for box selection and right-click targeting                 */
/* ================================================================ */

var _raycaster3D = null;
var _rayPlane = null;
var _rayIntersect = { x: 0, y: 0 };

/* Convert 2D world coords to 3D world coords:
   Game world (wx, wy) range [0, seite] -> Three.js (wx-seite/2, 0, wy-seite/2) */
function screenToWorld3D(sx, sy) {
  if (!camera || !renderer3D) return ScreenToWorld(sx, sy);

  /* Ensure raycaster/plane exist */
  if (!_raycaster3D) {
    _raycaster3D = new THREE.Raycaster();
    _rayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  /* Get the 3D canvas element for proper NDC calculation */
  var c3d = document.getElementById('gameCanvas3D');
  if (!c3d) return ScreenToWorld(sx, sy);

  /* Compute NDC (-1 to +1) relative to the 3D canvas position */
  var rect3D = c3d.getBoundingClientRect();
  var c3dLeft = rect3D.left;
  var c3dTop = rect3D.top;

  /* sx,sy are overlay-canvas coords (pixel). Overlay canvas is at window
     position 0,0 (fixed). The 3D canvas is offset by GAME_AREA_X in
     overlay coords, but in window coords it's at rect3D.left. */
  var mouseWinX = sx + window.scrollX;
  var mouseWinY = sy + window.scrollY;

  var ndcX = ((mouseWinX - rect3D.left) / rect3D.width) * 2 - 1;
  var ndcY = -((mouseWinY - rect3D.top) / rect3D.height) * 2 + 1;

  var ndc = new THREE.Vector2(ndcX, ndcY);
  _raycaster3D.setFromCamera(ndc, camera);

  var pt = new THREE.Vector3();
  var hit = _raycaster3D.ray.intersectPlane(_rayPlane, pt);

  if (hit) {
    /* Convert 3D world coords back to game world coords */
    _rayIntersect.x = pt.x + seite / 2;
    _rayIntersect.y = pt.z + seite / 2;
    return _rayIntersect;
  }

  /* Fallback to 2D */
  return ScreenToWorld(sx, sy);
}

/* Project 3D world position to 2D screen coords using Three.js camera */
/* yOverride: optional Y in 3D world (default: WORLD_HEIGHT for ships) */
function worldToScreen3D(wx, wy, yOverride) {
  if (!camera || !renderer3D) return WorldToScreen(wx, wy);

  var c3d = document.getElementById('gameCanvas3D');
  if (!c3d) return WorldToScreen(wx, wy);

  var y3d = (yOverride !== undefined) ? yOverride : WORLD_HEIGHT;
  var v = new THREE.Vector3(wx - seite / 2, y3d, wy - seite / 2);
  v.project(camera);

  /* NDC -> canvas coords */
  var rect3d = c3d.getBoundingClientRect();
  var cx = (v.x * 0.5 + 0.5) * c3d.width + (rect3d.left - GAME_AREA_X);
  var cy = (-v.y * 0.5 + 0.5) * c3d.height + (rect3d.top);

  _w2s.x = cx;
  _w2s.y = cy;
  return _w2s;
}

/* ================================================================ */
/* sichtable — frustum culling (2D screen-space check)              */
/* ================================================================ */
function sichtable(pos) {
  var sp = WorldToScreen(pos.x, pos.y);
  return (sp.x > -60) && (sp.y > -60) &&
         (sp.x < GAME_AREA_X + GameAreaWidth + 60) &&
         (sp.y < GAME_AREA_Y + GameAreaHeight + 60);
}

/* ================================================================ */
/* 2D Drawing primitives (on overlay canvas)                        */
/* ================================================================ */

function SetDrawColor(colorIdx) {
  if (!overlayCtx) return;
  overlayCtx.fillStyle = vgaColor(colorIdx);
  overlayCtx.strokeStyle = vgaColor(colorIdx);
}

function DrawPixel(x, y, colorIdx) {
  if (!overlayCtx) return;
  if (!inClipRect(x, y)) return;
  overlayCtx.fillStyle = vgaColor(colorIdx);
  overlayCtx.fillRect(x, y, 1, 1);
}

function DrawLine(x1, y1, x2, y2, colorIdx) {
  if (!overlayCtx) return;
  var cxMax = GetClipXMax();
  var cyMax = GetClipYMax();
  var nx1 = ClipInt(x1, CLIP_X_MIN, cxMax);
  var ny1 = ClipInt(y1, CLIP_Y_MIN, cyMax);
  var nx2 = ClipInt(x2, CLIP_X_MIN, cxMax);
  var ny2 = ClipInt(y2, CLIP_Y_MIN, cyMax);
  if (nx1 === CLIP_X_MIN && nx2 === CLIP_X_MIN && (x1 < CLIP_X_MIN || x2 < CLIP_X_MIN)) return;
  if (nx1 === cxMax && nx2 === cxMax && (x1 > cxMax || x2 > cxMax)) return;
  if (ny1 === CLIP_Y_MIN && ny2 === CLIP_Y_MIN && (y1 < CLIP_Y_MIN || y2 < CLIP_Y_MIN)) return;
  if (ny1 === cyMax && ny2 === cyMax && (y1 > cyMax || y2 > cyMax)) return;
  overlayCtx.strokeStyle = vgaColor(colorIdx);
  overlayCtx.lineWidth = 1;
  overlayCtx.beginPath();
  overlayCtx.moveTo(nx1, ny1);
  overlayCtx.lineTo(nx2, ny2);
  overlayCtx.stroke();
}

function DrawTriangle(x1, y1, x2, y2, x3, y3, colorIdx) {
  DrawLine(x1, y1, x2, y2, colorIdx);
  DrawLine(x2, y2, x3, y3, colorIdx);
  DrawLine(x3, y3, x1, y1, colorIdx);
}

function DrawFilledTriangle(x1, y1, x2, y2, x3, y3, colorIdx) {
  if (!overlayCtx) return;
  overlayCtx.fillStyle = vgaColor(colorIdx);
  overlayCtx.beginPath();
  overlayCtx.moveTo(x1, y1);
  overlayCtx.lineTo(x2, y2);
  overlayCtx.lineTo(x3, y3);
  overlayCtx.closePath();
  overlayCtx.fill();
}

function DrawCircle(cx, cy, radius, colorIdx) {
  if (!overlayCtx || radius <= 0) return;
  if (cx + radius < CLIP_X_MIN || cx - radius > GetClipXMax() ||
      cy + radius < CLIP_Y_MIN || cy - radius > GetClipYMax()) return;
  overlayCtx.strokeStyle = vgaColor(colorIdx);
  overlayCtx.lineWidth = 1;
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  overlayCtx.stroke();
}

function DrawRect(x, y, w, h, colorIdx) {
  if (!overlayCtx) return;
  overlayCtx.strokeStyle = vgaColor(colorIdx);
  overlayCtx.lineWidth = 1;
  overlayCtx.beginPath();
  overlayCtx.moveTo(x, y);
  overlayCtx.lineTo(x + w, y);
  overlayCtx.lineTo(x + w, y + h);
  overlayCtx.lineTo(x, y + h);
  overlayCtx.lineTo(x, y);
  overlayCtx.stroke();
}

function DrawFilledRect(x, y, w, h, colorIdx) {
  if (!overlayCtx || w <= 0 || h <= 0) return;
  if (x + w < CLIP_X_MIN || x >= curW || y + h < CLIP_Y_MIN || y >= curH) return;
  overlayCtx.fillStyle = vgaColor(colorIdx);
  overlayCtx.fillRect(
    Math.max(x, CLIP_X_MIN),
    Math.max(y, CLIP_Y_MIN),
    Math.min(w, curW - Math.max(x, CLIP_X_MIN)),
    Math.min(h, curH - Math.max(y, CLIP_Y_MIN))
  );
}

function DrawFilledRectUnclipped(x, y, w, h, colorIdx) {
  if (!overlayCtx || w <= 0 || h <= 0) return;
  overlayCtx.fillStyle = vgaColor(colorIdx);
  overlayCtx.fillRect(x, y, w, h);
}

/* ================================================================ */
/* DrawText — on overlay canvas                                     */
/* ================================================================ */
function DrawText(x, y, text, colorIdx) {
  if (!overlayCtx || !text || colorIdx === 0) return;
  overlayCtx.font = '10px monospace';
  overlayCtx.fillStyle = vgaColor(colorIdx);
  overlayCtx.textBaseline = 'top';
  overlayCtx.fillText(text, x, y - 3);
}

/* ================================================================ */
/* one — render a single ship model (2D fallback for planet menu)  */
/* ================================================================ */
function one(dir, pos, verts, polys, maxv, maxp) {
  if (!overlayCtx) return;
  var scaledDir = { x: dir.x / 10, y: dir.y / 10 };
  var orthv = { x: -scaledDir.y, y: scaledDir.x };
  var sx = [];
  var cx = GAME_AREA_X + GameAreaWidth / 2.0;
  var cy = GAME_AREA_Y + GameAreaHeight / 2.0;
  for (var i = 0; i < maxv; i++) {
    var v = verts[i];
    var ax = scaledDir.x * v.x;
    var ay = scaledDir.y * v.x;
    var orthBx = orthv.x * v.y;
    var orthBy = orthv.y * v.y;
    var tvx = (ax + orthBx) + pos.x;
    var tvy = (ay + orthBy) + pos.y;
    sx.push({
      x: Math.round((tvx + bx + GAME_AREA_X - cx) * zoomScale + cx),
      y: Math.round((tvy + by + GAME_AREA_Y - cy) * zoomScale + cy)
    });
  }
  for (var i = 0; i < maxp; i++) {
    var poly = polys[i];
    var p1 = sx[poly.a[0] - 1];
    var p2 = sx[poly.a[1] - 1];
    var p3 = sx[poly.a[2] - 1];
    DrawFilledTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, poly.f);
  }
}

/* ================================================================ */
/* aktivships — NOW delegates to 3D render                         */
/* ================================================================ */
function aktivships() {
  /* Ships are rendered in 3D by updateShips3D() in three-render.js */
}

/* ================================================================ */
/* erzeuge — initialize all ship / planet models                    */
/* ================================================================ */
function erzeuge() {
  sv(shieldVecData[0],  13, 0);   sv(shieldVecData[1],  13, 1);
  sv(shieldVecData[2], 12.8, 2); sv(shieldVecData[3], 12.6, 3);
  sv(shieldVecData[4], 12.3, 4); sv(shieldVecData[5],  12, 5);
  sv(shieldVecData[6], 11.5, 6); sv(shieldVecData[7], 10.9, 7);
  sv(shieldVecData[8], 10.2, 8); sv(shieldVecData[9],  9.4, 9);
  sv(shieldVecData[10], 8.3, 10);sv(shieldVecData[11], 6.9, 11);
  sv(shieldVecData[12],  5, 12); sv(shieldVecData[13],  0, 13);

  pla.maxv = 9;
  pla.maxp = 8;
  sv(pla.v[0],   0,  0); sv(pla.v[1],   0, 20);
  sv(pla.v[2], -14, 14); sv(pla.v[3], -20,  0);
  sv(pla.v[4], -14,-14); sv(pla.v[5],   0,-20);
  sv(pla.v[6],  14,-14); sv(pla.v[7],  20,  0);
  sv(pla.v[8],  14, 14);

  sp(pla.p[0], 1, 2, 3, 1); sp(pla.p[1], 1, 3, 4, 3);
  sp(pla.p[2], 1, 4, 5, 3); sp(pla.p[3], 1, 5, 6, 3);
  sp(pla.p[4], 1, 6, 7, 3); sp(pla.p[5], 1, 7, 8, 4);
  sp(pla.p[6], 1, 8, 9, 4); sp(pla.p[7], 1, 9, 2, 1);

  a1.maxv = 6; a1.maxp = 4;
  sv(a1.v[0],  8,  0);  sv(a1.v[1],  1, -3);
  sv(a1.v[2],  1,  3);  sv(a1.v[3], -3,  0);
  sv(a1.v[4], -8,  7);  sv(a1.v[5], -8, -7);
  sp(a1.p[0], 1, 2, 4, 1); sp(a1.p[1], 1, 3, 4, 1);
  sp(a1.p[2], 3, 4, 5, 4); sp(a1.p[3], 2, 4, 6, 4);

  b1.maxv = 7; b1.maxp = 5;
  sv(b1.v[0], 10, -3);  sv(b1.v[1],  0, -5);
  sv(b1.v[2],-7, -2);  sv(b1.v[3], -7,  2);
  sv(b1.v[4],  0,  5);  sv(b1.v[5], 10,  3);
  sv(b1.v[6],  2,  0);
  sp(b1.p[0], 1, 2, 7, 1); sp(b1.p[1], 2, 3, 7, 3);
  sp(b1.p[2], 3, 4, 7, 4); sp(b1.p[3], 4, 5, 7, 3);
  sp(b1.p[4], 5, 6, 7, 1);

  c1.maxv = 10; c1.maxp = 8;
  sv(c1.v[0], 10,  5);  sv(c1.v[1], 10, -5);
  sv(c1.v[2],  7,  0);  sv(c1.v[3],  2,  3);
  sv(c1.v[4],  2, -3);  sv(c1.v[5],  0,  8);
  sv(c1.v[6], -6,  6);  sv(c1.v[7], -9,  0);
  sv(c1.v[8], -6, -6);  sv(c1.v[9],  0, -8);
  sp(c1.p[0], 3, 4, 5, 1); sp(c1.p[1], 1, 4, 6, 3);
  sp(c1.p[2], 2, 5,10, 3); sp(c1.p[3], 4, 6, 7, 3);
  sp(c1.p[4], 5, 9,10, 3); sp(c1.p[5], 4, 7, 8, 4);
  sp(c1.p[6], 5, 8, 9, 4); sp(c1.p[7], 4, 5, 8, 1);

  a2.maxv = 10; a2.maxp = 4;
  sv(a2.v[0],  1,  2);  sv(a2.v[1],  1, -2);
  sv(a2.v[2], -3,  2);  sv(a2.v[3], -3, -2);
  sv(a2.v[4],  8,  2);  sv(a2.v[5],  8, -2);
  sv(a2.v[6],  0,  6);  sv(a2.v[7],  0, -6);
  sv(a2.v[8], -6,  2);  sv(a2.v[9],-6, -2);
  sp(a2.p[0], 1, 3, 4, 14); sp(a2.p[1], 1, 2, 4, 14);
  sp(a2.p[2], 5, 7, 9, 10); sp(a2.p[3], 6, 8,10, 10);

  b2.maxv = 10; b2.maxp = 4;
  sv(b2.v[0],  8,  2);  sv(b2.v[1],  8, -2);
  sv(b2.v[2],  0,  5);  sv(b2.v[3],  0, -5);
  sv(b2.v[4], -6,  2);  sv(b2.v[5], -6, -2);
  sv(b2.v[6],-8,  8);  sv(b2.v[7],-8, -8);
  sv(b2.v[8],-3,  3.5); sv(b2.v[9],-3,-3.5);
  sp(b2.p[0], 3, 1, 5,  2); sp(b2.p[1], 2, 4, 6,  2);
  sp(b2.p[2], 3, 7, 9, 14); sp(b2.p[3], 4, 8,10, 14);

  c2.maxv = 14; c2.maxp = 6;
  sv(c2.v[0],  10,   2);  sv(c2.v[1],  10,  -2);
  sv(c2.v[2],   5,   8);  sv(c2.v[3],   5,  -8);
  sv(c2.v[4],   3,   5);  sv(c2.v[5],   3,  -5);
  sv(c2.v[6],   0,   5);  sv(c2.v[7],   0,  -5);
  sv(c2.v[8],  -5.5, 2);  sv(c2.v[9],-5.5,-2);
  sv(c2.v[10], -7,   8);  sv(c2.v[11], -7, -8);
  sv(c2.v[12], -9,   0);  sv(c2.v[13],  0,  0);
  sp(c2.p[0], 3,  1, 5, 10); sp(c2.p[1], 2,  4, 6, 10);
  sp(c2.p[2], 3, 13,14,  2); sp(c2.p[3], 4, 13,14,  2);
  sp(c2.p[4], 7,  9,11, 14); sp(c2.p[5], 8, 10,12, 14);

  a3.maxv = 8; a3.maxp = 4;
  sv(a3.v[0], 10,  2);  sv(a3.v[1],  7, -5);
  sv(a3.v[2],-3,  3);  sv(a3.v[3], -2, -2);
  sv(a3.v[4],-8,  8);  sv(a3.v[5], -6, -6);
  sv(a3.v[6],-4,  2);  sv(a3.v[7],  0,  0);
  sp(a3.p[0], 1, 3, 8, 7);  sp(a3.p[1], 8, 2, 4, 8);
  sp(a3.p[2], 5, 4, 8, 8);  sp(a3.p[3], 6, 4, 7, 15);

  b3.maxv = 10; b3.maxp = 6;
  sv(b3.v[0],  9,  7);  sv(b3.v[1],  5, -7);
  sv(b3.v[2],  2,  0);  sv(b3.v[3],  1,  4);
  sv(b3.v[4],  0, -3);  sv(b3.v[5], -6,  9);
  sv(b3.v[6], -4,  0);  sv(b3.v[7],-5, -4);
  sv(b3.v[8],-6, -9);  sv(b3.v[9],-10,-2);
  sp(b3.p[0], 1, 3, 4, 7);  sp(b3.p[1], 2, 3, 5, 8);
  sp(b3.p[2], 3, 4, 7, 15); sp(b3.p[3], 6, 4, 7, 15);
  sp(b3.p[4], 3, 7, 9, 7);  sp(b3.p[5], 8,10, 7, 8);

  c3.maxv = 12; c3.maxp = 5;
  sv(c3.v[0],  8,  3);  sv(c3.v[1],  9, -4);
  sv(c3.v[2],  5, -4);  sv(c3.v[3],  4,  0);
  sv(c3.v[4],  0, -4);  sv(c3.v[5], -2,  5);
  sv(c3.v[6], -5,  8);  sv(c3.v[7],-4, -8);
  sv(c3.v[8],-5, -4);  sv(c3.v[9],-9, -4);
  sv(c3.v[10],-7,  5);  sv(c3.v[11],-9,  5);
  sp(c3.p[0], 4, 1,  7, 8);  sp(c3.p[1], 1, 3, 5, 7);
  sp(c3.p[2], 2, 8, 10, 8);  sp(c3.p[3], 5, 9,11, 7);
  sp(c3.p[4], 7, 6, 12, 15);

  k1m.maxv = 10; k1m.maxp = 8;
  sv(k1m.v[0], 13,  0);  sv(k1m.v[1],  8,  4);
  sv(k1m.v[2],  8, -4);  sv(k1m.v[3],  1,  8);
  sv(k1m.v[4],  1,  3);  sv(k1m.v[5],  1, -3);
  sv(k1m.v[6],  1, -8);  sv(k1m.v[7], -2,  4);
  sv(k1m.v[8], -2, -4);  sv(k1m.v[9],-10, 0);
  sp(k1m.p[0], 1, 6, 5, 1);  sp(k1m.p[1], 2, 4, 5, 3);
  sp(k1m.p[2], 3, 6, 7, 3);  sp(k1m.p[3], 4, 5, 8, 3);
  sp(k1m.p[4], 6, 9, 7, 3);  sp(k1m.p[6], 5,10, 8, 4);
  sp(k1m.p[7], 5, 6,10, 1);  sp(k1m.p[5], 6, 9,10, 4);

  k2m.maxv = 11; k2m.maxp = 5;
  sv(k2m.v[0],  8,  5);  sv(k2m.v[1],  8, -5);
  sv(k2m.v[2],  0,  8);  sv(k2m.v[3],  0,  2);
  sv(k2m.v[4],  0, -2);  sv(k2m.v[5],  0, -8);
  sv(k2m.v[6],-8,  5);  sv(k2m.v[7],-8, -5);
  sv(k2m.v[8],  0,  0);  sv(k2m.v[9],-8,  2);
  sv(k2m.v[10],-8, -2);
  sp(k2m.p[0], 1, 3, 4,  2); sp(k2m.p[1], 5, 2, 6, 10);
  sp(k2m.p[2], 3, 4, 7, 10); sp(k2m.p[3], 5, 6, 8,  2);
  sp(k2m.p[4], 9,10,11, 14);

  k3m.maxv = 11; k3m.maxp = 5;
  sv(k3m.v[0],  9,  2);  sv(k3m.v[1],  7,  1);
  sv(k3m.v[2],  8, -3);  sv(k3m.v[3],  5, -2);
  sv(k3m.v[4],  0,  5);  sv(k3m.v[5],  2, -1);
  sv(k3m.v[6], -2, 11);  sv(k3m.v[7],-4, -4);
  sv(k3m.v[8],-9,  3);  sv(k3m.v[9],-9, -8);
  sv(k3m.v[10],-6, -2);
  sp(k3m.p[0], 2, 3,  6, 15); sp(k3m.p[1], 1, 5, 6, 8);
  sp(k3m.p[2], 7, 6, 11, 15); sp(k3m.p[3], 4, 8, 9, 7);
  sp(k3m.p[4], 8, 4,10,  8);

  for (var idx = 0; idx < maxships; idx++) {
    ships[idx].ex = false;
    ships[idx].r = false;
    ships[idx].f = true;
    ships[idx].pl = false;
    ships[idx].ge = 0;
  }
  for (var idx = 0; idx < 200; idx++) ammo[idx].ex = false;
  for (var idx = 0; idx < 50; idx++) {
    rockets[idx].ex = false;
    smartMissiles[idx].ex = false;
  }
  for (var idx = 0; idx < 20; idx++) {
    explosions[idx].ex = false;
    shieldHits[idx].ex = false;
  }
  page = false;
}

/* ================================================================ */
/* shiptest — box selection of ships                                */
/* ================================================================ */
function shiptest(x1, y1, x2, y2) {
  var found = false;
  for (var i = 0; i < maxships; i++) {
    if (!ships[i].ex) continue;
    if (ships[i].gr !== snr) continue;
    var sp = worldToScreen3D(ships[i].s.x, ships[i].s.y);
    var px = Math.trunc(sp.x);
    var py = Math.trunc(sp.y);
    if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
      ships[i].r = true;
      found = true;
    }
  }
  return found;
}

/* ================================================================ */
/* initammo, initraks, initsmart, initexplo, initschild             */
/* (unchanged — pure game logic)                                    */
/* ================================================================ */
function initammo(src, vel, typ) {
  var e;
  switch (typ) {
    case 1: case 4: case 7: e = 1; break;
    case 2: case 5: case 6: case 8: case 9: e = 2; break;
    case 3: e = 3; break;
    default: e = 1; break;
  }
  var bulletsCreated = 0;
  for (var i9 = 0; i9 < 200 && bulletsCreated < e; i9++) {
    if (!ammo[i9].ex) {
      ammo[i9].e = 1;
      divi(vel, 2, ammo[i9].x);
      ammo[i9].ex = true;
      if (typ === 1 || typ === 2 || typ === 3) ammo[i9].gr = 1;
      else if (typ === 4 || typ === 5 || typ === 6) ammo[i9].gr = 2;
      else if (typ === 7 || typ === 8 || typ === 9) ammo[i9].gr = 3;
      var x = { x: 0, y: 0 };
      var pos = { x: src.x, y: src.y };
      if (typ === 1 || typ === 4 || typ === 7) {
        ammo[i9].s.x = pos.x; ammo[i9].s.y = pos.y;
      } else if (typ === 2 || typ === 5 || typ === 6 || typ === 8 || typ === 9) {
        orth(vel, x); divi(x, 2, x);
        if (bulletsCreated === 0) { addv(pos, x, pos); }
        else { subv(pos, x, pos); subv(pos, x, pos); }
        ammo[i9].s.x = pos.x; ammo[i9].s.y = pos.y;
      } else if (typ === 3) {
        orth(vel, x); divi(x, 2, x);
        if (bulletsCreated === 0) { subv(pos, x, pos); }
        else if (bulletsCreated === 1) { addv(pos, x, pos); }
        else { addv(pos, x, pos); }
        ammo[i9].s.x = pos.x; ammo[i9].s.y = pos.y;
      }
      bulletsCreated++;
    }
  }
}

function initraks(src, vel, gr) {
  for (var i9 = 0; i9 < 50; i9++) {
    if (!rockets[i9].ex) {
      rockets[i9].ex = true;
      rockets[i9].s.x = src.x; rockets[i9].s.y = src.y;
      rockets[i9].e = 1; rockets[i9].gr = gr;
      divi(vel, 3, rockets[i9].v);
      break;
    }
  }
}

function initsmart(target, vel, gr) {
  for (var i9 = 0; i9 < 50; i9++) {
    if (!smartMissiles[i9].ex) {
      smartMissiles[i9].ex = true;
      smartMissiles[i9].s.x = target.x; smartMissiles[i9].s.y = target.y;
      smartMissiles[i9].e = 1;
      divi(vel, 3, smartMissiles[i9].v);
      smartMissiles[i9].k = 0;
      var e1 = 1000;
      for (var i2 = 0; i2 < maxships; i2++) {
        if (ships[i2].ex && ships[i2].gr !== gr) {
          var e2 = abstand(ships[i2].s, target);
          if (e1 >= e2 && e2 > 1) { e1 = e2; smartMissiles[i9].k = i2; }
        }
      }
      break;
    }
  }
}

/* initPlanetMissile — Fire a smart missile from a planet at a specific ship */
function initPlanetMissile(planetPos, targetShipIndex, factionGr) {
  /* Find which planet this is */
  var planetIdx = -1;
  for (var pi = 0; pi < maxpl; pi++) {
    if (planets[pi].s.x === planetPos.x && planets[pi].s.y === planetPos.y) {
      planetIdx = pi;
      break;
    }
  }

  for (var i9 = 0; i9 < 50; i9++) {
    if (!smartMissiles[i9].ex) {
      smartMissiles[i9].ex = true;
      smartMissiles[i9].s.x = planetPos.x;
      smartMissiles[i9].s.y = planetPos.y;
      smartMissiles[i9].e = 1;
      smartMissiles[i9].gr = factionGr;
      smartMissiles[i9].k = targetShipIndex;

      /* Mark as planet-launched so we can decrement activeMissiles on expiry */
      smartMissiles[i9].planetOrigin = { p: planetIdx, g: factionGr - 1 };

      /* Velocity toward target ship */
      var tShip = ships[targetShipIndex];
      var dx = tShip.s.x - planetPos.x;
      var dy = tShip.s.y - planetPos.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        smartMissiles[i9].v.x = (dx / d) * 15;
        smartMissiles[i9].v.y = (dy / d) * 15;
      } else {
        smartMissiles[i9].v.x = 10;
        smartMissiles[i9].v.y = 0;
      }
      break;
    }
  }
}

function initexplo(pos, color) {
  for (var i6 = 0; i6 < 20; i6++) {
    if (!explosions[i6].ex) {
      var r = function() { return Math.floor(Math.random() * 5) + 1; };
      for (var i5 = 0; i5 < 8; i5++)
        sv(explosions[i6].ed[i5], pos.x + r(), pos.y + r());
      for (var i5 = 8; i5 < 16; i5++)
        sv(explosions[i6].ed[i5], pos.x - r(), pos.y + r());
      for (var i5 = 16; i5 < 24; i5++)
        sv(explosions[i6].ed[i5], pos.x + r(), pos.y - r());
      for (var i5 = 24; i5 < 32; i5++)
        sv(explosions[i6].ed[i5], pos.x - r(), pos.y - r());
      explosions[i6].s.x = pos.x; explosions[i6].s.y = pos.y;
      explosions[i6].explosionColor = color || 0xffff00;
      explosions[i6].ex = true; explosions[i6].e = 1;
      /* Reset 3D particle positions to origin */
      if (explosions[i6].mesh3d) {
        var _pos = explosions[i6].mesh3d.geometry.attributes.position.array;
        for (var _p = 0; _p < _pos.length; _p++) _pos[_p] = 0;
        explosions[i6].mesh3d.geometry.attributes.position.needsUpdate = true;
      }
      break;
    }
  }
}

function initschild(k, schaden, v, withExplosion) {
  var target = ships[k];

  if (target.shield > 0) {
    target.shield -= schaden;
    if (target.shield < 0) {
      target.panz += target.shield;
      target.shield = 0;
    }
    for (var i7 = 0; i7 < 20; i7++) {
      if (!shieldHits[i7].ex) {
        shieldHits[i7].v.x = v.x; shieldHits[i7].v.y = v.y;
        shieldHits[i7].k = k;
        shieldHits[i7].ex = true; shieldHits[i7].e = 1;
        break;
      }
    }
    /* Blue explosion on shield hit (rockets/missiles only) */
    if (withExplosion) initexplo(target.s, 0x4488ff);
  } else {
    target.panz -= schaden;
    /* Yellow explosion on direct hit (rockets/missiles only) */
    if (withExplosion) initexplo(target.s, 0xffff00);
  }
}

/* Calculate type-based damage multiplier
 * Returns a multiplier based on attacker type vs target type */
function getTypeDamageMult(attackerTyp, targetTyp) {
  var isAttJager = (attackerTyp === 1 || attackerTyp === 4 || attackerTyp === 7);
  var isAttAdvJager = (attackerTyp === 2 || attackerTyp === 5 || attackerTyp === 8);
  var isAttBomber = (attackerTyp === 3 || attackerTyp === 6 || attackerTyp === 9);
  var isAttTransporter = (attackerTyp >= 10 && attackerTyp <= 12);

  var isTgtJager = (targetTyp === 1 || targetTyp === 4 || targetTyp === 7);
  var isTgtAdvJager = (targetTyp === 2 || targetTyp === 5 || targetTyp === 8);
  var isTgtBomber = (targetTyp === 3 || targetTyp === 6 || targetTyp === 9);
  var isTgtTransporter = (targetTyp >= 10 && targetTyp <= 12);

  /* Jäger vs Bomber: +40% */
  if (isAttJager && (isTgtBomber || isTgtAdvJager)) return JAGER_VS_BOMBER_MULT;

  /* Adv Jäger vs Bomber: +25% */
  if (isAttAdvJager && isTgtBomber) return ADVJAGER_VS_BOMBER_MULT;

  /* Adv Jäger vs Transporter: -10% */
  if (isAttAdvJager && isTgtTransporter) return ADVJAGER_VS_TRANSPORTER_MULT;

  /* Bomber vs Transporter: +50% */
  if (isAttBomber && isTgtTransporter) return BOMBER_VS_TRANSPORTER_MULT;

  /* Transporter vs Jäger: +35% */
  if (isAttTransporter && isTgtJager) return TRANSPORTER_VS_JAGER_MULT;

  return 1.0;
}

/* ================================================================ */
/* am — update ammo (logic only, 3D rendering in three-render.js)   */
/* ================================================================ */
function am(s2, xvel, e, gr) {
  if (e > 5) {
    for (var i1 = 0; i1 < maxships; i1++) {
      if (ships[i1].ex && ships[i1].gr !== gr) {
        _tmpVec.x = 0; _tmpVec.y = 0;
        subv(s2, ships[i1].s, _tmpVec);
        var l = lang(_tmpVec);
        if (l < 14) {
          divi(_tmpVec, l, _tmpVec); mult(_tmpVec, 10, _tmpVec);
          /* Find the attacker ship to determine type-based damage */
          var attTyp = 0;
          for (var ai = 0; ai < maxships; ai++) {
            if (ships[ai].ex && ships[ai].gr === gr && ships[ai].typ < 10) {
              var ad = abstand(s2, ships[ai].s);
              if (ad < 200) { attTyp = ships[ai].typ; break; }
            }
          }
          var dmgMult = getTypeDamageMult(attTyp, ships[i1].typ);
          var finalDmg = Math.trunc(ammok * dmgMult);
          initschild(i1, finalDmg, _tmpVec, false);
          _tmpPos.x = ships[i1].s.x; _tmpPos.y = ships[i1].s.y;
          ships[i1].m = entf(s2, xvel, _tmpPos);
          return 50;
        }
      }
    }
  }
  addv(s2, xvel, s2);
  var newE = e + 1;
  if (newE > 50) newE = 0;
  return newE;
}

function showammo() {
  for (var i6 = 0; i6 < 200; i6++) {
    if (ammo[i6].ex) {
      ammo[i6].e = am(ammo[i6].s, ammo[i6].x, ammo[i6].e, ammo[i6].gr);
      if (ammo[i6].e === 0) ammo[i6].ex = false;
    }
  }
}

/* ================================================================ */
/* raks — update rockets (logic only, 3D rendering in three-render) */
/* ================================================================ */
function raks(rk) {
  if (rk.e > 5) {
    for (var i1 = 0; i1 < maxships; i1++) {
      if (ships[i1].ex && ships[i1].gr !== rk.gr) {
        _tmpVec.x = 0; _tmpVec.y = 0;
        subv(rk.s, ships[i1].s, _tmpVec);
        var l = lang(_tmpVec);
        if (l < 14) {
          rk.e = 55;
          divi(_tmpVec, l, _tmpVec); mult(_tmpVec, 10, _tmpVec);
          /* Find the attacker ship for type-based damage */
          var attTyp = 0;
          for (var ai = 0; ai < maxships; ai++) {
            if (ships[ai].ex && ships[ai].gr === rk.gr && ships[ai].typ < 10) {
              var ad = abstand(rk.s, ships[ai].s);
              if (ad < 200) { attTyp = ships[ai].typ; break; }
            }
          }
          var dmgMult = getTypeDamageMult(attTyp, ships[i1].typ);
          var finalDmg = Math.trunc(rakk * dmgMult);
          initschild(i1, finalDmg, _tmpVec, true);
          _tmpPos.x = ships[i1].s.x; _tmpPos.y = ships[i1].s.y;
          ships[i1].m = entf(rk.s, rk.v, _tmpPos) * 2;
          break;
        }
      }
    }
  }
  mult(rk.v, 1.035, rk.v);
  addv(rk.s, rk.v, rk.s);
  rk.e++;
  if (rk.e > 55) rk.ex = false;
}

function showraks() {
  for (var i6 = 0; i6 < 50; i6++) {
    if (rockets[i6].ex) raks(rockets[i6]);
  }
}

/* ================================================================ */
/* smart — update smart missiles (logic only, 3D in three-render)   */
/* ================================================================ */
function smart(rk, trails) {
  trails[rk.e % 5].x = rk.s.x; trails[rk.e % 5].y = rk.s.y;

  var g = 0;
  if (rk.k > 0) {
    var a = { x: 0, y: 0 };
    subv(rk.s, ships[rk.k].s, a);
    var l = lang(a);
    if (l < 14) {
      rk.e = 250;
      divi(a, l, a); mult(a, 10, a);
      /* Find the attacker ship for type-based damage */
      var attTyp = 0;
      for (var ai = 0; ai < maxships; ai++) {
        if (ships[ai].ex && ships[ai].gr === rk.gr && ships[ai].typ < 10) {
          var ad = abstand(rk.s, ships[ai].s);
          if (ad < 200) { attTyp = ships[ai].typ; break; }
        }
      }
      var dmgMult = getTypeDamageMult(attTyp, ships[rk.k].typ);
      var finalDmg = Math.trunc(smartk * dmgMult);
      initschild(rk.k, finalDmg, a, true);
      var targetPos = { x: ships[rk.k].s.x, y: ships[rk.k].s.y };
      ships[rk.k].m = entf(rk.s, rk.v, targetPos) * 2;
    }
    var targetPos = { x: ships[rk.k].s.x, y: ships[rk.k].s.y };
    g = entf(rk.s, rk.v, targetPos) / 50;
  }
  addv(rk.s, rk.v, rk.s);
  if (g < -0.5) g = -0.5;
  if (g > 0.5) g = 0.5;
  drehen(rk.v, g);
  divi(rk.v, 3, rk.v);
  rk.e++;
  if (rk.e > 250) {
    rk.ex = false;
    initexplo(rk.s);
  }
}

function showsmart() {
  for (var i6 = 0; i6 < 50; i6++) {
    if (smartMissiles[i6].ex) {
      smart(smartMissiles[i6], thrusters[i6]);
      /* If a planet-launched missile expired, decrement the colony counter */
      if (!smartMissiles[i6].ex && smartMissiles[i6].planetOrigin !== undefined) {
        var po = smartMissiles[i6].planetOrigin;
        if (po.p < maxpl && po.g < 3) {
          planets[po.p].k[po.g].activeMissiles--;
          if (planets[po.p].k[po.g].activeMissiles < 0) planets[po.p].k[po.g].activeMissiles = 0;
        }
        /* Clear planetOrigin so reused slot doesn't inherit planet styling */
        smartMissiles[i6].planetOrigin = undefined;
      }
    }
  }
}

/* ================================================================ */
/* explo — update explosions (logic only, 3D in three-render)       */
/* ================================================================ */
function explo(center, ed, e) {
  var z = 1 - e / 200;
  _tmpVec.x = 0; _tmpVec.y = 0;
  for (var i4 = 0; i4 < 32; i4++) {
    if (i4 % 2 === 0 || e < 100) {
      subv(ed[i4], center, _tmpVec);
      ev(_tmpVec, _tmpVec);
      mult(_tmpVec, z, _tmpVec);
      addv(ed[i4], _tmpVec, ed[i4]);
    }
  }
  var newE = e + 1;
  if (newE > 150) newE = 0;
  return newE;
}

function showexplos() {
  for (var i6 = 0; i6 < 20; i6++) {
    if (explosions[i6].ex) {
      explosions[i6].e = explo(explosions[i6].s, explosions[i6].ed, explosions[i6].e);
      if (explosions[i6].e === 0) explosions[i6].ex = false;
    }
  }
}

/* ================================================================ */
/* schild — shield hit effect (logic only, 3D in three-render)      */
/* ================================================================ */
function schild(k, xv, e) {
  var s1 = ships[k].s;
  divi(xv, 10, xv);
  var yv = { x: -xv.y, y: xv.x };
  for (var i3 = e - 13; i3 <= e; i3++) {
    if (i3 > 0 && i3 < 15) {
      var a = shieldVecData[i3 - 1];
    }
  }
  var newE = e + 1;
  if (newE > 28) newE = 0;
  return newE;
}

function showschild() {
  for (var i6 = 0; i6 < 20; i6++) {
    if (shieldHits[i6].ex) {
      shieldHits[i6].e = schild(shieldHits[i6].k, shieldHits[i6].v, shieldHits[i6].e);
      if (shieldHits[i6].e === 0) shieldHits[i6].ex = false;
    }
  }
}
