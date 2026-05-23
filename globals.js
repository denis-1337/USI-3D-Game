/* globals.js — global state variables, ported from globals.pas */

/* ===== Game loop state ===== */
var running   = false;
var paused    = false;
var frameCount = 0;
var tickCount  = 0;

/* ===== Window / layout ===== */
var curW = 0;
var curH = 0;
var GameAreaWidth  = 0;
var GameAreaHeight = 0;

/* ===== Camera ===== */
var bx = 0;
var by = 0;

/* ===== Mouse state ===== */
var mouseX = -1;
var mouseY = -1;
var isMouseDown    = false;
var isRightDown    = false;
var prevLeftDown   = false;
var prevPDown      = false;
var dragStartX = 0;
var dragStartY = 0;
var dragEndX   = 0;
var dragEndY   = 0;
var isDragging = false;
var mouseDownX = 0;
var mouseDownY = 0;

/* ===== Selection ===== */
var rahmen  = false;
var rx = 0;
var ry = 0;
var befehl = false;
var mb = 0;  // mouse planet - index of planet under cursor (0 = none)
var boxR = { x: 0, y: 0, w: 0, h: 0 };

/* ===== Planet menu ===== */
var pview = false;
var pnr   = 0;
var menuX = 0;
var menuY = 0;

/* ===== Player faction ===== */
var snr = 1;  // player faction 1/2/3

/* ===== Zoom (6 discrete levels; default 2 = 1.0) ===== */
var zoomLevels = [0.6, 0.8, 1.0, 1.4, 2.0, 3.0];
var zoomLevel  = 2;
var zoomScale  = 1.0;

/* ===== SDL2 handles (kept for compat) ===== */
var sdlWindow   = null;
var sdlRenderer = null;

/* ===== Game end state ===== */
var gameWon  = false;
var gameLost = false;

/* ===== Save/Load feedback flash ===== */
var saveFlashTick = 0;  /* >0 means show "GESPEICHERT" flash */
var loadFlashTick = 0;  /* >0 means show "GELADEN" flash */

/* ===== 3D Globals (Three.js) ===== */
var scene        = null;
var camera       = null;
var renderer3D   = null;
var overlayCanvas  = null;
var overlayCtx   = null;
var starField    = null;

/* 3D object groups */
var shipsGroup   = null;
var planetsGroup = null;
var effectsGroup = null;

/* Per-ship 3D meshes (indexed by ship array index) */
var shipMeshes   = [];

/* Per-planet 3D meshes */
var planetMeshes = [];

/* Per-planet 3D shield spheres */
var shieldMeshes = [];

/* Final explosion effects (dynamic — created on ship death, removed after animation) */
var finalExplosions = [];

/* Dying ship spray effects (dynamic — created when ship starts dying, removed after animation) */
var dyingSprays = [];

/* Shared shader material for all particle systems */
var particleShaderMaterial = null;

/* Shared shader material for planetary shields */
var shieldShaderMaterial = null;

/* 3D coordinate mapping: world (x,y) -> 3D (x, height, z) */
var WORLD_HEIGHT = 42;   // ships float just above planets (planet radius is 40)
var PLANET_HEIGHT = -5;  // planets sit below ships

/* Minimap 3D (declared here, initialized in three-minimap.js) */
var minimapRenderer = null;
var minimapCamera   = null;
var minimapScene    = null;

/* Minimap layout — computed in resizeMinimapCanvas, used everywhere */
var mmX = 0;
var mmY = 0;
var mmSize = 0; /* square minimap: mmW == mmH == mmSize */

/* Camera tilt angle (degrees) — 0 = top-down, up to 90 = side view */
var cameraTiltAngle = 70;  // default: 70° perspective for first-time players

/* Check if camera is tilted (for UI: show/hide slider label) */
function isPerspectiveMode() {
  return cameraTiltAngle > 0;
}

/* ================================================================ */
/* Persist camera settings to / from localStorage                   */
/* ================================================================ */
function saveCameraSettings() {
  try {
    localStorage.setItem('usi_cameraTiltAngle', String(cameraTiltAngle));
  } catch (e) { /* ignore */ }
}

function loadCameraSettings() {
  try {
    var savedAngle = localStorage.getItem('usi_cameraTiltAngle');
    if (savedAngle !== null) {
      cameraTiltAngle = parseFloat(savedAngle);
      if (isNaN(cameraTiltAngle) || cameraTiltAngle < 0) cameraTiltAngle = 0;
      if (cameraTiltAngle > 90) cameraTiltAngle = 90;
    }
  } catch (e) { /* ignore */ }
}
