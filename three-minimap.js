/* three-minimap.js — Separate 3D renderer for the minimap view.
 *
 * Renders a top-down 3D view of the entire game world in the minimap
 * panel area (top-right). Uses its own WebGL renderer, camera, and
 * lightweight copies of the scene objects.
 *
 * The minimap is SQUARE — matching the square game world.
 * Ships/planets are drawn as 2D dots on the overlay (ui.js).
 * The viewport rectangle/trapezoid is drawn on the overlay (ui.js).
 *
 * Dependencies: three-init.js (for gameTo3D, FACTION_COLORS)
 *               globals.js, entities.js
 *
 * Exports:
 *   - initMinimap3D(): called after initThree()
 *   - resizeMinimapCanvas(): reposition/resize the minimap canvas
 *   - renderMinimap3DFrame(): render one minimap frame
 */

/* Lightweight object groups for minimap */
var mmShipsGroup   = null;
var mmPlanetsGroup = null;

/* Per-entity minimap proxies (simple colored shapes) */
var mmShipMeshes   = [];
var mmPlanetMeshes = [];

/*
 * Initialize the minimap 3D renderer.
 * Called from game.js init() after initThree().
 */
function initMinimap3D() {
  var canvasMM = document.getElementById('minimapCanvas3D');

  minimapRenderer = new THREE.WebGLRenderer({
    canvas: canvasMM,
    antialias: false,
    alpha: false
  });
  minimapRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
  minimapRenderer.shadowMap.enabled = false;

  /* Scene */
  minimapScene = new THREE.Scene();
  minimapScene.background = new THREE.Color(0x000000);

  /* Orthographic camera — top-down view of the entire world (square) */
  minimapCamera = new THREE.OrthographicCamera(
    -seite / 2, seite / 2,
     seite / 2, -seite / 2,
    1, 10000
  );
  minimapCamera.position.set(0, 3000, 0);
  minimapCamera.lookAt(0, 0, 0);

  /* Make sure minimapCamera is strictly separate from the main camera */
  if (minimapCamera === camera) {
    console.warn('Minimap camera same as main camera! Re-creating minimap camera.');
    minimapCamera = new THREE.OrthographicCamera(
      -seite / 2, seite / 2,
       seite / 2, -seite / 2,
      1, 10000
    );
    minimapCamera.position.set(0, 3000, 0);
    minimapCamera.lookAt(0, 0, 0);
  }

  /* Groups */
  mmShipsGroup = new THREE.Group();
  mmPlanetsGroup = new THREE.Group();
  minimapScene.add(mmPlanetsGroup);
  minimapScene.add(mmShipsGroup);

  /* Init ship mesh array */
  for (var i = 0; i < maxships; i++) {
    mmShipMeshes[i] = null;
  }

  /* Initial sizing */
  resizeMinimapCanvas();
}

/*
 * Position and resize the minimap canvas to match the panel area.
 * The minimap is SQUARE — mmSize = panelW - 2 (1px border each side).
 * Sets global mmX, mmY, mmSize used by ui.js and input.js.
 */
function resizeMinimapCanvas() {
  if (!minimapRenderer) return;

  var panelX = GameAreaWidth + 5;
  var panelW = curW - panelX;
  if (panelW < 40) panelW = 40;

  /* Square minimap: 1px border inside the panel */
  mmSize = panelW - 2;
  mmX = panelX + 1;
  mmY = 1;

  var canvasMM = document.getElementById('minimapCanvas3D');
  canvasMM.style.left   = mmX + 'px';
  canvasMM.style.top    = mmY + 'px';
  canvasMM.style.width  = mmSize + 'px';
  canvasMM.style.height = mmSize + 'px';
  canvasMM.width  = mmSize;
  canvasMM.height = mmSize;

  minimapRenderer.setSize(mmSize, mmSize, false);

  /* Square frustum — world is square */
  minimapCamera.left   = -seite / 2;
  minimapCamera.right  =  seite / 2;
  minimapCamera.top    =  seite / 2;
  minimapCamera.bottom = -seite / 2;
  minimapCamera.updateProjectionMatrix();
}

/*
 * Render one minimap frame.
 * The 3D minimap only renders the background (black).
 * Ships/planets and viewport rect are drawn on the overlay (ui.js).
 */
function renderMinimap3DFrame() {
  if (!minimapRenderer || !minimapScene || !minimapCamera) return;

  minimapRenderer.render(minimapScene, minimapCamera);
}
