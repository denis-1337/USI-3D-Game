/* ui.js — UI overlay rendering for the browser port.
 *
 * Handles all UI elements rendered on top of the game canvas:
 *   - Minimap (top-right area)
 *   - Faction info display
 *   - Save/Load buttons
 *   - Planet management menu (when pview is true)
 *   - Selection frames around selected ships
 *   - Mouse cursor (crosshair/circle/arrow)
 *   - Pause indicator
 *   - Player selection screen
 *
 * Dependencies (all globals loaded via <script> tags before this file):
 *   - constants.js  (maxships, seite, ...)
 *   - globals.js    (bx, by, mouseX, mouseY, snr, pview, pnr, paused,
 *                    running, zoomLevel, zoomScale,
 *                    curW, curH, GameAreaWidth, GameAreaHeight,
 *                    rahmen, rx, ry, befehl, boxR, tickCount, ...)
 *   - entities.js   (ships, planets, factionStats)
 *   - renderer.js   (DrawText, DrawFilledRect, DrawRect, DrawLine,
 *                    DrawCircle, DrawPixel, vgaColor, WorldToScreen,
 *                    DrawFilledRectUnclipped, SetDrawColor, inClipRect)
 *   - planeten.js   (rahmenbild, pmenu)
 *   - input.js      (isPlayerSelectionActive, getPlayerSelectionChoice,
 *                    endPlayerSelection)
 *
 * Canvas context `ctx` and canvas element `canvas` are set by game.js
 * before this file is loaded.
 *
 * Exports:
 *   - renderUI(): main UI render function (called each frame after game rendering)
 *   - renderMinimap(): render minimap
 *   - renderFactionInfo(): render faction ship counts
 *   - renderPlanetMenu(): render planet management menu (delegates to pmenu)
 *   - renderPlayerSelection(): render initial player selection screen
 *   - renderCursor(): render mouse cursor
 */

/* Faction colors for minimap — module-scope to avoid per-frame allocation */
var FACTION_COLORS_MAP = { 1: '#ff4444', 2: '#44ff44', 3: '#ffff44' };

/* ================================================================ */
/* Helper: compute panel layout                                     */
/* ================================================================ */
function getPanelLayout() {
  var panelX = GameAreaWidth + 5;
  var panelW = curW - panelX;
  if (panelW < 40) panelW = 40;
  return { panelX: panelX, panelW: panelW };
}

/* ================================================================ */
/* renderUI — Main UI render function (called each frame)            */
/* ================================================================ */
function renderUI() {
  /* Player selection screen (shown before game starts) */
  if (typeof isPlayerSelectionActive === 'function' && isPlayerSelectionActive()) {
    renderPlayerSelection();
    return;
  }

  /* Clear overlay canvas — use canvas dimensions, not curW/curH */
  var ctx = overlayCtx;
  if (ctx) {
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  if (pview) {
    /* Planet menu mode: render the planet management overlay */
    renderPlanetMenu();
  } else {
    /* Normal game mode: render side panel UI */
    renderSidePanel();
  }

  /* Always render cursor and pause indicator on top */
  renderCursor();
  if (paused) {
    renderPauseIndicator();
  }

  /* Save/Load flash feedback */
  renderSaveLoadFlash();
}

/* ================================================================ */
/* renderSidePanel — Render right panel: minimap, buttons, stats    */
/* ================================================================ */
function renderSidePanel() {
  var layout = getPanelLayout();
  var panelX = layout.panelX;
  var panelW = layout.panelW;

  /* Fill entire panel area with black background (covers 3D world behind) */
  DrawFilledRectUnclipped(panelX, 0, panelW, curH, 0);

  /* Minimap area: square, uses global mmX/mmY/mmSize */
  DrawRect(mmX, mmY, mmSize, mmSize, 15);

  /* Gap between minimap and content below */
  var contentY = mmY + mmSize + 10;

  /* Viewport rectangle/trapezoid on minimap */
  renderMinimapViewportRect();

  /* Camera angle slider — always visible, 0° = top-down */
  renderCameraAngleSlider(panelX, contentY);

  /* Save/Load buttons */
  renderSaveLoadButtons(panelX, contentY + 42);

  /* Faction ship counts */
  renderFactionInfo(panelX, contentY + 105);
}

/* ================================================================ */
/* renderMinimapViewportRect — Draw viewport rect/trapezoid on minimap */
/* Uses global mmX/mmY/mmSize. Draws a trapezoid when camera is tilted. */
/* ================================================================ */
function renderMinimapViewportRect() {
  var ctx = overlayCtx;
  if (!ctx) return;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  /* Compute visible world bounds from the Three.js camera.
   * We project the four corners of the camera's near plane onto the
   * game world plane (y=0) and convert back to game coordinates.
   */
  var visibleBounds = getVisibleWorldBounds();
  if (!visibleBounds) return;

  /* visibleBounds = { nearLeft, nearRight, nearTop, nearBottom,
                         farLeft, farRight, farTop, farBottom }
     All in game world coordinates (0..seite).
     For orthographic: near == far (rectangle).
     For perspective: near and far differ (trapezoid).
   */

  /* Map to minimap pixel coords (square) */
  function mapX(wx) { return mmX + (wx / seite) * mmSize; }
  function mapY(wy) { return mmY + (wy / seite) * mmSize; }

  /* Near plane corners (closer to camera) */
  var xL_near = mapX(visibleBounds.nearLeft);
  var xR_near = mapX(visibleBounds.nearRight);
  var yT_near = mapY(visibleBounds.nearTop);
  var yB_near = mapY(visibleBounds.nearBottom);

  /* Far plane corners (further from camera) */
  var xL_far = mapX(visibleBounds.farLeft);
  var xR_far = mapX(visibleBounds.farRight);
  var yT_far = mapY(visibleBounds.farTop);
  var yB_far = mapY(visibleBounds.farBottom);

  /* Clamp all to minimap bounds */
  function clampX(v) { return Math.max(mmX, Math.min(mmX + mmSize, v)); }
  function clampY(v) { return Math.max(mmY, Math.min(mmY + mmSize, v)); }

  /* Clamp the entire trapezoid as a unit — don't clamp individual edges,
   * otherwise the shape distorts when panning near map edges.
   * Compute the bounding box of the trapezoid, clamp it, then apply
   * the same offset to all corners. */
  var trapezoidMinX = Math.min(xL_near, xR_near, xL_far, xR_far);
  var trapezoidMaxX = Math.max(xL_near, xR_near, xL_far, xR_far);
  var trapezoidMinY = Math.min(yT_near, yB_near, yT_far, yB_far);
  var trapezoidMaxY = Math.max(yT_near, yB_near, yT_far, yB_far);

  var clampOffsetX = Math.max(0, mmX - trapezoidMinX) - Math.max(0, trapezoidMaxX - (mmX + mmSize));
  var clampOffsetY = Math.max(0, mmY - trapezoidMinY) - Math.max(0, trapezoidMaxY - (mmY + mmSize));

  xL_near += clampOffsetX; xR_near += clampOffsetX;
  yT_near += clampOffsetY; yB_near += clampOffsetY;
  xL_far  += clampOffsetX; xR_far  += clampOffsetX;
  yT_far  += clampOffsetY; yB_far  += clampOffsetY;

  if (cameraTiltAngle > 0) {
    /* Perspective trapezoid on minimap — draw the exact shape from the
     * engine, clipped to the minimap bounds. No scaling, no shifting,
     * no distortion — just clip what's outside.
     *
     * Camera is tilted: it looks from +Z toward -Z (bottom of game → top of game).
     * Near edge = closer to camera = larger game Y = bottom of minimap → narrower.
     * Far edge  = further from camera = smaller game Y = top of minimap → wider.
     */
    var topLeftX    = mapX(visibleBounds.farLeft);
    var topLeftY    = mapY(visibleBounds.farTop);
    var topRightX   = mapX(visibleBounds.farRight);
    var topRightY   = mapY(visibleBounds.farTop);
    var bottomLeftX  = mapX(visibleBounds.nearLeft);
    var bottomLeftY  = mapY(visibleBounds.nearBottom);
    var bottomRightX = mapX(visibleBounds.nearRight);
    var bottomRightY = mapY(visibleBounds.nearBottom);

    /* Clip to minimap bounds so nothing draws outside */
    ctx.save();
    ctx.beginPath();
    ctx.rect(mmX, mmY, mmSize, mmSize);
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(Math.round(topLeftX), Math.round(topLeftY));
    ctx.lineTo(Math.round(topRightX), Math.round(topRightY));
    ctx.lineTo(Math.round(bottomRightX), Math.round(bottomRightY));
    ctx.lineTo(Math.round(bottomLeftX), Math.round(bottomLeftY));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  } else {
    /* Orthographic: simple rectangle */
    var rectX = Math.min(xL_near, xL_far);
    var rectY = Math.min(yT_near, yT_far);
    var rectW = Math.max(xR_near, xR_far) - rectX;
    var rectH = Math.max(yB_near, yB_far) - rectY;
    ctx.strokeRect(Math.round(rectX), Math.round(rectY), Math.round(rectW), Math.round(rectH));
  }

  /* --- Draw ships and planets as 2D dots --- */
  renderMinimapEntities();
}

/*
 * Get visible world bounds from the Three.js camera.
 * Unprojects screen corners to world rays, intersects with y=0 plane,
 * and converts to game world coordinates.
 * Returns { nearLeft, nearRight, nearTop, nearBottom,
 *           farLeft, farRight, farTop, farBottom } in game coords.
 * "near" = closer to camera (wider in perspective), "far" = further (narrower).
 */
function getVisibleWorldBounds() {
  if (!camera || !renderer3D) return null;

  var cx = GAME_AREA_X + GameAreaWidth / 2.0;
  var cy = GAME_AREA_Y + GameAreaHeight / 2.0;

  if (camera.type === 'OrthographicCamera') {
    /* Invert WorldToScreen to get world bounds from screen edges:
     * sx = (wx + bx + GAME_AREA_X - cx) * zoomScale + cx
     * => wx = (sx - cx) / zoomScale - bx - GAME_AREA_X + cx
     * Left edge:  sx = GAME_AREA_X   => wx = (-GameAreaWidth/2)/zoom - bx - GAME_AREA_X + cx
     * Right edge: sx = GAME_AREA_X+GameAreaWidth => wx = (GameAreaWidth/2)/zoom - bx - GAME_AREA_X + cx
     */
    var halfW = (GameAreaWidth / 2) / zoomScale;
    var halfH = (GameAreaHeight / 2) / zoomScale;
    var centerX = -bx - GAME_AREA_X + cx;
    var centerY = -by - GAME_AREA_Y + cy;
    var worldLeft   = centerX - halfW;
    var worldRight  = centerX + halfW;
    var worldTop    = centerY - halfH;
    var worldBottom = centerY + halfH;
    return {
      nearLeft: worldLeft, nearRight: worldRight,
      nearTop: worldTop, nearBottom: worldBottom,
      farLeft: worldLeft, farRight: worldRight,
      farTop: worldTop, farBottom: worldBottom
    };
  }

  /* Perspective: compute the four viewport corners projected onto the
   * game world plane (y=0 in Three.js space) using the actual camera
   * projection matrix. This gives the exact visible area.
   */
  var centerX = -bx - GAME_AREA_X + cx;
  var centerY = -by - GAME_AREA_Y + cy;

  /* Base half-width/height from 2D zoom (same as orthographic) */
  var baseHalfW = (GameAreaWidth / 2) / zoomScale;
  var baseHalfH = (GameAreaHeight / 2) / zoomScale;

  if (camera.type === 'PerspectiveCamera' && cameraTiltAngle > 0) {
    /* Cast rays through the four viewport corners and find where they
     * intersect the ground plane (y = 0).
     *
     * NDC coordinates:
     *   (-1, +1) = top-left of screen  → far edge (top of game world)
     *   (+1, +1) = top-right of screen → far edge
     *   (-1, -1) = bottom-left of screen → near edge (bottom of game world)
     *   (+1, -1) = bottom-right of screen → near edge
     */
    /* Reusable temp vectors — avoid per-frame GC pressure */
    var _tmpVec = new THREE.Vector3();
    var _tmpDir = new THREE.Vector3();

    function unprojectCorner(ndcX, ndcY) {
      _tmpVec.set(ndcX, ndcY, 0.5); /* z=0.5 = middle of near/far clip */
      _tmpVec.unproject(camera);

      /* Direction of the ray from camera through this screen corner */
      _tmpDir.copy(_tmpVec).sub(camera.position).normalize();

      /* Intersect with y=0 plane: t = -camPos.y / _tmpDir.y */
      if (Math.abs(_tmpDir.y) < 0.0001) {
        /* Ray is almost parallel to ground — use a large distance */
        _tmpDir.y = _tmpDir.y >= 0 ? 0.0001 : -0.0001;
      }
      var t = -camera.position.y / _tmpDir.y;
      if (t < 0) t = 10000; /* Behind camera — clamp */

      var worldX = camera.position.x + _tmpDir.x * t;
      var worldZ = camera.position.z + _tmpDir.z * t;

      /* Convert 3D world coords to game coords */
      return {
        gx: worldX + seite / 2,
        gy: worldZ + seite / 2
      };
    }

    /* Top corners (far edge — top of screen, further from camera) */
    var farTL = unprojectCorner(-1, 1);
    var farTR = unprojectCorner(1, 1);

    /* Bottom corners (near edge — bottom of screen, closer to camera) */
    var nearBL = unprojectCorner(-1, -1);
    var nearBR = unprojectCorner(1, -1);

    return {
      /* Near edge (bottom of screen = closer to camera) */
      nearLeft:   nearBL.gx,
      nearRight:  nearBR.gx,
      nearTop:    Math.min(nearBL.gy, nearBR.gy),
      nearBottom: Math.max(nearBL.gy, nearBR.gy),
      /* Far edge (top of screen = further from camera) */
      farLeft:    farTL.gx,
      farRight:   farTR.gx,
      farTop:     Math.min(farTL.gy, farTR.gy),
      farBottom:  Math.max(farTL.gy, farTR.gy)
    };
  }

  /* Fallback: rectangle (orthographic or 0° tilt) */
  return {
    nearLeft:  centerX - baseHalfW,
    nearRight: centerX + baseHalfW,
    nearTop:   centerY - baseHalfH,
    nearBottom: centerY + baseHalfH,
    farLeft:   centerX - baseHalfW,
    farRight:  centerX + baseHalfW,
    farTop:    centerY - baseHalfH,
    farBottom: centerY + baseHalfH
  };
}

/* ================================================================ */
/* renderMinimapEntities — Draw ships/planets as 2D dots on overlay  */
/* Uses global mmX/mmY/mmSize.                                         */
/* ================================================================ */
function renderMinimapEntities() {
  var ctx = overlayCtx;
  if (!ctx) return;

  /* Draw planets as white dots */
  ctx.fillStyle = '#ffffff';
  for (var i = 0; i < planets.length; i++) {
    var p = planets[i];
    if (!p) continue;
    var px = mmX + (p.s.x / seite) * mmSize;
    var py = mmY + (p.s.y / seite) * mmSize;
    if (p.war && (tickCount % 20 < 10)) {
      ctx.fillStyle = '#ff00ff';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(Math.floor(px), Math.floor(py), 2, 2);
  }

  /* Draw ships as colored dots (minimum 2x2) */
  for (var i = 0; i < maxships; i++) {
    if (!ships[i].ex) continue;
    var color = FACTION_COLORS_MAP[ships[i].gr] || '#888888';
    ctx.fillStyle = color;
    var sx = mmX + (ships[i].s.x / seite) * mmSize;
    var sy = mmY + (ships[i].s.y / seite) * mmSize;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
  }
}

/* ================================================================
/* renderCameraAngleSlider — Draw tilt angle slider in panel         */
/* ================================================================ */
function renderCameraAngleSlider(panelX, startY) {

  var panelW = curW - panelX;
  DrawText(panelX + 5, startY, t('camera_label'), 13);
  DrawText(panelX + 70, startY, String(Math.round(cameraTiltAngle)) + '\u00b0', 13);
  /* Draw a simple slider bar */
  var sliderX = panelX + 5;
  var sliderY = startY + 10;
  var sliderW = panelW - 10;
  var sliderH = 8;
  var sliderVal = cameraTiltAngle / 90; /* 0..90 degrees mapped to 0..1 */
  if (sliderVal < 0) sliderVal = 0;
  if (sliderVal > 1) sliderVal = 1;

  /* Background — dark grey (VGA 8) */
  DrawFilledRectUnclipped(sliderX, sliderY, sliderW, sliderH, 8);
  /* Fill — light grey (VGA 7) */
  var fillStart = sliderX + sliderW * (1 - sliderVal);
  DrawFilledRectUnclipped(fillStart, sliderY, sliderW * sliderVal, sliderH, 7);
  /* Border — white (VGA 15) */
  DrawRect(sliderX, sliderY, sliderW, sliderH, 15);
  /* Thumb — grey (VGA 7=light grey, 8=dark grey border) */
  var thumbX = sliderX + sliderW * (1 - sliderVal) - 4;
  DrawFilledRectUnclipped(thumbX, sliderY - 2, 8, sliderH + 4, 7);
  DrawRect(thumbX, sliderY - 2, 8, sliderH + 4, 8);
}

/* ================================================================ */
/* renderSaveLoadButtons — Render Save/Load buttons                  */
/* ================================================================ */
function renderSaveLoadButtons(panelX, startY) {
  var saveText = t('save_btn');
  var loadText = t('load_btn');
  var btnW = 80;

  /* Save button — center text */
  DrawRect(panelX + 10, startY, btnW, 20, 15);
  var saveW = overlayCtx ? overlayCtx.measureText(saveText).width : 60;
  DrawText(panelX + 10 + Math.round((btnW - saveW) / 2), startY + 8, saveText, 7);

  /* Load button — center text */
  DrawRect(panelX + 10, startY + 30, btnW, 20, 15);
  var loadW = overlayCtx ? overlayCtx.measureText(loadText).width : 30;
  DrawText(panelX + 10 + Math.round((btnW - loadW) / 2), startY + 38, loadText, 7);
}

/* ================================================================ */
/* renderFactionInfo — Render faction ship counts                    */
/* ================================================================ */
function renderFactionInfo(panelX, startY) {
  var fs = factionStats[snr - 1];

  DrawText(panelX + 10, startY, t('fighter_label'), 14);
  DrawText(panelX + 10, startY + 15, t('adv_fighter_label'), 14);
  DrawText(panelX + 10, startY + 30, t('bomber_label'), 14);
  DrawText(panelX + 10, startY + 45, t('transporter_label'), 14);

  DrawText(panelX + 100, startY, String(fs.j), 14);
  DrawText(panelX + 100, startY + 15, String(fs.aj), 14);
  DrawText(panelX + 100, startY + 30, String(fs.b), 14);
  DrawText(panelX + 100, startY + 45, String(fs.t), 14);
}

/* ================================================================ */
/* renderPlanetMenu — Render planet management menu                  */
/* Minimap is drawn via 3D canvas + overlay (same as normal mode)    */
/* ================================================================ */
function renderPlanetMenu() {
  if (pnr >= 1 && pnr <= maxpl) {
    pmenu(planets[pnr - 1]);
  }
  /* Draw minimap border + entities + viewport rect on overlay */
  DrawRect(mmX, mmY, mmSize, mmSize, 15);
  renderMinimapViewportRect();
}

/* ================================================================ */
/* renderSelectionFrames — Set befehl flag based on selected ships */
/* Selection visuals are now rendered as 3D rings in three-render.js */
/* ================================================================ */
function renderSelectionFrames() {
  befehl = false;
  for (var i = 0; i < maxships; i++) {
    if (ships[i].ex && ships[i].r) {
      befehl = true;
    }
  }
}

/* ================================================================ */
/* renderBoxSelection — Draw the box selection rectangle             */
/* ================================================================ */
function renderBoxSelection() {
  if (rahmen && isMouseDown) {
    DrawRect(boxR.x, boxR.y, boxR.w, boxR.h, 1);
  }
}

/* ================================================================ */
/* renderCursor — Render mouse cursor based on game state            */
/* ================================================================ */
function renderCursor() {
  /* Confine to screen bounds */
  if (mouseX < 0 || mouseY < 0 || mouseX >= curW || mouseY >= curH) return;

  if (typeof isPlayerSelectionActive === 'function' && isPlayerSelectionActive()) {
    /* Arrow cursor during player selection */
    DrawPixel(mouseX, mouseY, 15);
    DrawPixel(mouseX + 1, mouseY + 1, 15);
    DrawPixel(mouseX - 1, mouseY + 1, 15);
    DrawPixel(mouseX, mouseY + 2, 15);
    return;
  }

  if (!pview && befehl) {
    /* Crosshair when giving orders */
    DrawPixel(mouseX, mouseY, 15);
    DrawPixel(mouseX - 1, mouseY, 15);
    DrawPixel(mouseX + 1, mouseY, 15);
    DrawPixel(mouseX, mouseY - 1, 15);
    DrawPixel(mouseX, mouseY + 1, 15);
  } else if (!pview && isMouseDown) {
    /* Small circle when clicking */
    DrawCircle(mouseX, mouseY, 3, 14);
  } else {
    /* Normal arrow cursor */
    DrawPixel(mouseX, mouseY, 15);
    DrawPixel(mouseX + 1, mouseY + 1, 15);
    DrawPixel(mouseX - 1, mouseY + 1, 15);
    DrawPixel(mouseX, mouseY + 2, 15);
  }
}

/* ================================================================ */
/* renderPauseIndicator — Show "PAUSED" text when paused             */
/* ================================================================ */
function renderPauseIndicator() {
  DrawText(curW / 2 - 30, curH / 2 - 8, t('paused'), 14);
}

/* ================================================================ */
/* renderPlayerSelection — Render initial player selection screen    */
/* ================================================================ */
function renderPlayerSelection() {
  var sel = typeof getPlayerSelectionChoice === 'function'
            ? getPlayerSelectionChoice() : 1;

  /* Title */
  DrawText(180, 60, t('title'), 15);

  /* Prompt */
  DrawText(130, 100, t('choose_group'), 14);

  /* Instructions */
  DrawText(120, 130, t('select_hint'), 7);

  /* Faction list with colors */
  /* Faction 1: red (12) */
  if (sel === 1)
    DrawText(220, 180, t('arrow') + ' ' + t('group1'), 12);
  else
    DrawText(220, 180, '   ' + t('group1'), 12);

  /* Faction 2: green (10) */
  if (sel === 2)
    DrawText(220, 210, t('arrow') + ' ' + t('group2'), 10);
  else
    DrawText(220, 210, '   ' + t('group2'), 10);

  /* Faction 3: yellow (14) */
  if (sel === 3)
    DrawText(220, 240, t('arrow') + ' ' + t('group3'), 14);
  else
    DrawText(220, 240, '   ' + t('group3'), 14);

  /* Language toggle button — show current language */
  var langBtn = getLang() === 'de' ? 'DE' : 'EN';
  DrawRect(260, 280, 60, 18, 7);
  DrawText(270, 284, langBtn, 14);

  /* Help link button */
  DrawRect(190, 280, 60, 18, 11);
  DrawText(200, 284, t('help_link'), 11);
}

/* ================================================================ */
/* renderSaveLoadFlash — Show "GESPEICHERT"/"GELADEN" flash text     */
/* ================================================================ */
function renderSaveLoadFlash() {
  var ctx = overlayCtx;
  if (!ctx) return;

  var cx = Math.trunc(GameAreaWidth / 2);

  if (saveFlashTick > 0) {
    saveFlashTick--;
    /* Pulsating opacity */
    var alpha = 0.5 + 0.5 * Math.sin(saveFlashTick * 0.3);
    ctx.globalAlpha = alpha;
    DrawText(cx, 60, t('saved'), 10);
    ctx.globalAlpha = 1;
  }

  if (loadFlashTick > 0) {
    loadFlashTick--;
    var alpha = 0.5 + 0.5 * Math.sin(loadFlashTick * 0.3);
    ctx.globalAlpha = alpha;
    DrawText(cx, 60, t('loaded'), 10);
    ctx.globalAlpha = 1;
  }
}

