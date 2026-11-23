/* input.js — Keyboard and mouse event handling for the browser port.
 *
 * Replaces SDL2 event handling from main.pas and fpcontrol_c.c.
 *
 * Dependencies (globals loaded via <script> tags before this file):
 *   - constants.js  (maxships, seite, ...)
 *   - globals.js    (mouseX, mouseY, isMouseDown, isRightDown, prevLeftDown,
 *                    rahmen, rx, ry, befehl, mb, pview, pnr, snr,
 *                    paused, running, bx, by, zoomLevel, zoomScale,
 *                    curW, curH, GameAreaWidth, GameAreaHeight,
 *                    boxR, isBoxSelecting, ...)
 *   - entities.js   (ships, planets, factionStats)
 *   - renderer.js   (WorldToScreen, ScreenToWorld, shiptest)
 *   - planeten.js   (planettest, planettest_at, rahmenbild)
 *
 * Canvas context `ctx` and canvas element `canvas` are set by game.js
 * before this file is loaded.
 *
 * Exports:
 *   - initInput(canvas): attach all event listeners.
 *   - processInput(): called each frame for continuous input (edge scrolling,
 *                     drag state, minimap navigation, planet view detection).
 *   - handleKeyPress(key): process keyboard input.
 *   - getMouseWorldPos(): convert mouse screen coords to world coords.
 */

/* ================================================================ */
/* Internal state for rising-edge key detection                     */
/* ================================================================ */
var _keyDown = {};  // tracks which keys are currently held down

/* Previous frame key states for rising-edge detection */
var _lastPDown     = false;
var _last1Down     = false, _last2Down    = false, _last3Down = false;
var _last4Down     = false, _last5Down    = false, _last6Down = false;
var _last7Down     = false, _last8Down    = false;
var _lastShift1    = false, _lastShift2   = false, _lastShift3 = false;
var _lastShift4    = false, _lastShift5   = false, _lastShift6 = false;
var _lastSlash     = false, _lastShift9   = false;
var _lastShift     = false;
var _lastPM1       = false, _lastPM2      = false, _lastPM3 = false;
var _lastPM4       = false, _lastPM5      = false, _lastPM6 = false;
var _lastPM7       = false, _lastPMC      = false, _lastPMW = false;
var _lastPS1       = false, _lastPS2      = false, _lastPS3 = false;
var _lastPSUp      = false, _lastPSDown   = false;
var _lastPSEnter   = false, _lastPSSpace  = false;

/* Player selection state */
var _playerSelectionActive = false;
var _playerSelectionChoice = 1;

/* Box selection state */
var _isBoxSelecting = false;
var _boxStartX = 0;
var _boxStartY = 0;

/* Minimap drag state */
var _isMinimapDragging = false;

/* ================================================================ */
/* Helper: check if (mx,my) is inside rectangle (rx,ry,rw,rh)       */
/* ================================================================ */
function inRect(mx, my, rx, ry, rw, rh) {
  return (mx >= rx) && (mx < rx + rw) && (my >= ry) && (my < ry + rh);
}

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
/* Helper: camera pan limits in the 3D convention                    */
/* camera target = (screen center - bx/by) / zoomScale               */
/* ================================================================ */
function getCameraPanBounds() {
  return {
    bxMin: GameAreaWidth - seite * zoomScale,
    bxMax: 0,
    byMin: GameAreaHeight - seite * zoomScale,
    byMax: 0
  };
}

/* ================================================================ */
/* Helper: recompute befehl (true if any ship is selected)           */
/* ================================================================ */
function recomputeBefehl() {
  befehl = false;
  for (var i = 0; i < maxships; i++) {
    if (ships[i].ex && ships[i].r) {
      befehl = true;
      break;
    }
  }
}

/* ================================================================ */
/* Helper: deselect all ships                                        */
/* ================================================================ */
function deselectAllShips() {
  for (var i = 0; i < maxships; i++) {
    ships[i].r = false;
  }
  befehl = false;
}

/* ================================================================ */
/* Helper: assign selected ships to a group (1-8)                    */
/* ================================================================ */
function assignGroup(groupNum) {
  for (var i = 0; i < maxships; i++) {
    if (ships[i].ex) {
      if (ships[i].nr === groupNum) ships[i].nr = 0;
      if (ships[i].r) ships[i].nr = groupNum;
    }
  }
}

/* ================================================================ */
/* Helper: select all ships in a group (1-8)                         */
/* ================================================================ */
function selectGroup(groupNum) {
  for (var i = 0; i < maxships; i++) {
    if (ships[i].ex && ships[i].nr === groupNum) {
      ships[i].r = true;
    }
  }
  recomputeBefehl();
}

/* ================================================================ */
/* Helper: handle right-click move/attack order                      */
/* ================================================================ */
function handleRightClickOrder(clickX, clickY) {
  if (!inRect(clickX, clickY, 0, 0, GameAreaWidth, GameAreaHeight)) return;

  recomputeBefehl();

  if (befehl) {
    /* Detect planet at click position */
    planettest_at(clickX, clickY);

    var worldPos = screenToWorld3D(clickX, clickY);
    var wx = worldPos.x;
    var wy = worldPos.y;

    for (var i = 0; i < maxships; i++) {
      if (ships[i].r && ships[i].ex && (ships[i].gr === snr)) {
        ships[i].z.x = wx + Math.random() * 100 - 50;
        ships[i].z.y = wy + Math.random() * 100 - 50;

        if (mb > 0) {
          ships[i].k  = mb;
          ships[i].pl = true;
        } else {
          ships[i].k  = 0;
          ships[i].pl = false;
        }
        ships[i].fn = 0;
      }
    }

    if (mb > 0) pview = false;
  } else {
    /* No ships selected: clear selection */
    befehl = false;
    for (var i = 0; i < maxships; i++) {
      ships[i].r = false;
    }
  }
}

/* ================================================================ */
/* Helper: handle planet menu key presses                            */
/* ================================================================ */
function handlePlanetMenuKey(key) {
  if (pnr < 1 || pnr > maxpl) return;
  var k = planets[pnr - 1].k[snr - 1];

  switch (key) {
    case 1: /* Level up */
      if (k.a < 8) {
        k.auf = 1;
        k.x = 0;
        k.max = 2 * nlevel - Math.trunc(nlevel * k.f / 100);
      }
      break;
    case 2: /* Soldiers */
      if (k.a * 200 > k.inf) {
        k.auf = 2;
        k.x = 0;
        k.max = soldaten;
        if (k.m < 1) k.m = 1;
      }
      break;
    case 3: /* Jager */
      if (k.a > 1 && factionStats[snr - 1].an < factionStats[snr - 1].max) {
        k.auf = 3;
        k.x = 0;
        k.max = jager;
        if (k.m < 1) k.m = 1;
      }
      break;
    case 4: /* Transporter */
      if (k.inf >= 100 && k.a > 2 && factionStats[snr - 1].an < factionStats[snr - 1].max) {
        k.auf = 4;
        k.x = 0;
        k.max = transporter;
        if (k.m < 1) k.m = 1;
      }
      break;
    case 5: /* Adv Jager */
      if (k.a > 3 && factionStats[snr - 1].an < factionStats[snr - 1].max) {
        k.auf = 5;
        k.x = 0;
        k.max = advjager;
        if (k.m < 1) k.m = 1;
      }
      break;
    case 6: /* Forts */
      if (k.a > 4 && k.a > k.def) {
        k.auf = 6;
        k.x = 0;
        k.max = forts;
        if (k.m < 1) k.m = 1;
      }
      break;
    case 7: /* Bomber */
      if (k.a > 5 && factionStats[snr - 1].an < factionStats[snr - 1].max) {
        k.auf = 7;
        k.x = 0;
        k.max = bomber;
        if (k.m < 1) k.m = 1;
      }
      break;
    case 8: /* Cancel / "Nichts" */
      k.auf = 0;
      k.x = 0;
      break;
    case 9: /* Toggle attack/defend */
      if (k.war === 1) k.war = 0;
      else k.war = 1;
      break;
  }
}

/* ================================================================ */
/* Helper: handle planet menu mouse click                            */
/* ================================================================ */
function handlePlanetMenuClick(mx, my) {
  if (!pview || pnr < 1 || pnr > maxpl) return;
  var p = planets[pnr - 1];
  var k = p.k[snr - 1];

  /* Build/order buttons — same hit boxes as pmenu() draws */
  var buttons = getPlanetMenuButtons(p);
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    if (!inRect(mx, my, b.rect.x, b.rect.y, b.rect.w, b.rect.h)) continue;
    switch (b.id) {
      case 1:
        k.auf = 1; k.x = 0;
        k.max = 2 * nlevel - Math.trunc(nlevel * k.f / 100);
        break;
      case 2:
        k.auf = 2; k.x = 0; k.max = soldaten;
        if (k.m < 1) k.m = 1;
        break;
      case 3:
        k.auf = 3; k.x = 0; k.max = jager;
        if (k.m < 1) k.m = 1;
        break;
      case 4:
        k.auf = 4; k.x = 0; k.max = transporter;
        if (k.m < 1) k.m = 1;
        break;
      case 5:
        k.auf = 5; k.x = 0; k.max = advjager;
        if (k.m < 1) k.m = 1;
        break;
      case 6:
        k.auf = 6; k.x = 0; k.max = forts;
        if (k.m < 1) k.m = 1;
        break;
      case 7:
        k.auf = 7; k.x = 0; k.max = bomber;
        if (k.m < 1) k.m = 1;
        break;
      case 8:
        k.auf = 0; k.x = 0;
        break;
    }
    break;  /* first hit wins */
  }

  /* Quantity +/- buttons */
  var qty = getPlanetMenuQuantityButtons(p);
  for (var i = 0; i < qty.length; i++) {
    var q = qty[i];
    if (!inRect(mx, my, q.rect.x, q.rect.y, q.rect.w, q.rect.h)) continue;
    if (q.id === 1) {
      if (k.m < 255) k.m++;
    } else if (q.id === -1) {
      if (k.m > 0) k.m--;
    } else if (q.id === 10) {
      if (k.m + 10 <= 255) k.m = k.m + 10;
      else k.m = 255;
    } else if (q.id === -10) {
      if (k.m - 10 > 0) k.m = k.m - 10;
      else k.m = 1;
    }
    break;
  }

  /* Verhalten: attack/defend toggle */
  var beh = getPlanetMenuBehaviorRect(p);
  if (inRect(mx, my, beh.x, beh.y, beh.w, beh.h)) {
    if (k.war === 1) k.war = 0;
    else k.war = 1;
  }

  /* zurueck: exit planet view */
  var back = getPlanetMenuBackRect(p);
  if (inRect(mx, my, back.x, back.y, back.w, back.h)) {
    pview = false;
    befehl = false;
    rahmen = false;
  }
}

/* ================================================================ */
/* Helper: CalcLayout — compute GameAreaWidth/Height                 */
/* ================================================================ */
function CalcLayout() {
  var REF_W = 640, REF_H = 480;
  var REF_PANEL_W = 140;

  /* Scale the whole retro UI with the window: 1.0 at the original
   * 640x480 size, capped so text does not get gigantic on 4K screens. */
  uiScale = Math.min(curW / REF_W, curH / REF_H);
  if (uiScale < 1) uiScale = 1;
  if (uiScale > 3.2) uiScale = 3.2;

  /* Scale the side panel with the UI so labels and buttons fit */
  var panelW = Math.round(REF_PANEL_W * uiScale);
  if (panelW > curW - 300) panelW = Math.max(40, curW - 300);

  GameAreaWidth = curW - panelW - 5;
  if (GameAreaWidth < 300) GameAreaWidth = 300;

  GameAreaHeight = curH;
  if (GameAreaHeight < 349) GameAreaHeight = 349;
}

/* ================================================================ */
/* Helper: getPlayerSelectionLayout — shared by ui.js renderer       */
/* and the mouse handler so draw/hit boxes match.                   */
/* ================================================================ */
function getPlayerSelectionLayout() {
  var s = uiScale || 1;
  var cx = Math.round(GameAreaWidth / 2);
  var titleY = Math.round(GameAreaHeight * 0.16);
  var promptY = titleY + Math.round(48 * s);
  var hintY = promptY + Math.round(34 * s);
  var rowH = Math.round(34 * s);
  var gap = Math.round(10 * s);
  var rowW = Math.min(Math.round(420 * s), GameAreaWidth - 40);
  var rowsTotal = 3 * rowH + 2 * gap;
  var rowsTop = hintY + Math.round(46 * s);
  var minBottom = Math.round(110 * s);
  if (rowsTop + rowsTotal > GameAreaHeight - minBottom)
    rowsTop = GameAreaHeight - minBottom - rowsTotal;

  var rows = [];
  for (var i = 0; i < 3; i++) {
    rows.push({
      x: Math.round(cx - rowW / 2),
      y: rowsTop + i * (rowH + gap),
      w: rowW,
      h: rowH
    });
  }

  var btnW = Math.round(90 * s);
  var btnH = Math.round(30 * s);
  var btnY = Math.round(GameAreaHeight - 46 * s);
  var help = { x: cx - btnW - Math.round(8 * s), y: btnY, w: btnW, h: btnH };
  var lang = { x: cx + Math.round(8 * s), y: btnY, w: btnW, h: btnH };

  return {
    s: s, cx: cx, titleY: titleY, promptY: promptY, hintY: hintY,
    rows: rows, help: help, lang: lang
  };
}

/* ================================================================ */
/* Helper: getInGameMenuLayout — bottom-right game buttons          */
/* (DE/EN language buttons + HILFE), shared by ui.js and input.js   */
/* ================================================================ */
function getInGameMenuLayout() {
  var pad = Math.max(6, Math.round(8 * uiScale));
  var gap = Math.max(4, Math.round(6 * uiScale));
  var btnH = Math.max(22, Math.round(28 * uiScale));
  var deW = Math.max(36, Math.round(44 * uiScale));
  var enW = deW;
  var helpW = Math.max(70, Math.round(90 * uiScale));
  var total = deW + enW + helpW + gap * 2;
  var x = GameAreaWidth - pad - total;
  var y = GameAreaHeight - pad - btnH;

  var de = { x: x, y: y, w: deW, h: btnH };
  var en = { x: de.x + deW + gap, y: y, w: enW, h: btnH };
  var help = { x: en.x + enW + gap, y: y, w: helpW, h: btnH };
  return { de: de, en: en, help: help };
}

/* ================================================================ */
/* initInput — Set up all event listeners on the canvas              */
/* ================================================================ */
var canvas = null;  // canvas element reference

function initInput(canvasEl) {
  canvas = canvasEl;
  /* Attach mouse events to both canvases (overlay is on top) */
  var attachTarget = canvasEl;
  if (typeof overlayCanvas !== 'undefined' && overlayCanvas) {
    overlayCanvas.style.pointerEvents = 'auto';
    attachTarget = overlayCanvas;
  }

  /* --- Keyboard events --- */
  document.addEventListener('keydown', function(e) {
    /* Prevent default for game keys to avoid browser shortcuts */
    var gameKeys = [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Enter', ' ', 'p', 'P', 'c', 'C', 'w', 'W',
      '1', '2', '3', '4', '5', '6', '7', '8', '9',
      '!', '"', '#', '$', '%', '&', '/', '('
    ];

    /* Track key state */
    _keyDown[e.code] = true;

    /* Player selection screen input */
    if (_playerSelectionActive) {
      if (e.key === '1') _playerSelectionChoice = 1;
      else if (e.key === '2') _playerSelectionChoice = 2;
      else if (e.key === '3') _playerSelectionChoice = 3;
      else if (e.key === 'ArrowUp') { if (_playerSelectionChoice > 1) _playerSelectionChoice--; }
      else if (e.key === 'ArrowDown') { if (_playerSelectionChoice < 3) _playerSelectionChoice++; }
      else if (e.key === 'Enter' || e.key === ' ') {
        _playerSelectionActive = false;
        snr = _playerSelectionChoice;
        return;
      }
      e.preventDefault();
      return;
    }

    /* --- P: Toggle pause --- */
    if (e.code === 'KeyP') {
      paused = !paused;
      e.preventDefault();
      return;
    }

    /* --- Planet menu keys (1-7, C, W, ESC) --- */
    if (pview) {
      if (e.code === 'Escape') {
        pview = false;
        befehl = false;
        e.preventDefault();
        return;
      }
      if (e.key >= '1' && e.key <= '7') {
        handlePlanetMenuKey(parseInt(e.key));
        e.preventDefault();
        return;
      }
      if (e.key === '8' || e.key.toLowerCase() === 'c') {
        handlePlanetMenuKey(8);
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === 'w') {
        handlePlanetMenuKey(9);
        e.preventDefault();
        return;
      }
      /* Number keys 1-9 in planet menu for production orders */
      if (e.key === '9') {
        handlePlanetMenuKey(9);
        e.preventDefault();
        return;
      }
    }

    /* --- Group selection (1-8) when not in planet menu --- */
    if (!pview && !paused) {
      if (e.key >= '1' && e.key <= '8') {
        var group = parseInt(e.key);
        selectGroup(group);
        e.preventDefault();
        return;
      }

      /* --- Group assignment (Shift+Digit1..Digit8) when ships are selected --- */
      if (befehl && e.shiftKey && /^Digit[1-8]$/.test(e.code)) {
        assignGroup(parseInt(e.code.charAt(5), 10));
        e.preventDefault();
        return;
      }
    }

    /* --- Arrow keys for general navigation --- */
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', function(e) {
    _keyDown[e.code] = false;
  });

  /* Clear held keys when the window loses focus (prevents stuck WASD panning) */
  window.addEventListener('blur', function() {
    _keyDown = {};
  });

  /* --- Mouse events --- */
  attachTarget.addEventListener('mousedown', function(e) {
    e.preventDefault();
    var rect = attachTarget.getBoundingClientRect();
    var scaleX = attachTarget.width / rect.width;
    var scaleY = attachTarget.height / rect.height;
    mouseX = Math.floor((e.clientX - rect.left) * scaleX);
    mouseY = Math.floor((e.clientY - rect.top) * scaleY);

    if (e.button === 0) {
      /* Left button */
      isMouseDown = true;
      mouseDownX = mouseX;
      mouseDownY = mouseY;

      /* Player selection screen clicks */
      if (_playerSelectionActive) {
        var L = getPlayerSelectionLayout();
        for (var i = 0; i < L.rows.length; i++) {
          var r = L.rows[i];
          if (inRect(mouseX, mouseY, r.x, r.y, r.w, r.h)) {
            _playerSelectionChoice = i + 1;
            _playerSelectionActive = false;
            snr = i + 1;
            return;
          }
        }
        /* Language toggle button */
        if (inRect(mouseX, mouseY, L.lang.x, L.lang.y, L.lang.w, L.lang.h)) {
          if (getLang() === 'de') setLang('en');
          else setLang('de');
          return;
        }
        /* Help link button */
        if (inRect(mouseX, mouseY, L.help.x, L.help.y, L.help.w, L.help.h)) {
          window.open('help.html', '_blank');
          return;
        }
        return;
      }

      /* Bottom-right in-game buttons: DE / EN / HILFE */
      if (!pview) {
        var gm = getInGameMenuLayout();
        if (inRect(mouseX, mouseY, gm.de.x, gm.de.y, gm.de.w, gm.de.h)) {
          setLang('de');
          return;
        }
        if (inRect(mouseX, mouseY, gm.en.x, gm.en.y, gm.en.w, gm.en.h)) {
          setLang('en');
          return;
        }
        if (inRect(mouseX, mouseY, gm.help.x, gm.help.y, gm.help.w, gm.help.h)) {
          window.open('help.html', '_blank');
          return;
        }
      }

      /* Planet menu click handling */
      if (pview) {
        handlePlanetMenuClick(mouseX, mouseY);
        return;
      }

      /* Save/Load buttons — positions match renderSaveLoadButtons() */
      var panelX = GameAreaWidth + 5;
      var btns = getSaveLoadButtons(panelX, getPanelContentY() + uiPx(40));
      if (inRect(mouseX, mouseY, btns.save.x, btns.save.y, btns.save.w, btns.save.h)) {
        speichernladen(1);
        return;
      }
      if (inRect(mouseX, mouseY, btns.load.x, btns.load.y, btns.load.w, btns.load.h)) {
        speichernladen(2);
        return;
      }

      /* Start box selection in game area */
      if (inRect(mouseX, mouseY, 0, 0, GameAreaWidth, GameAreaHeight)) {
        _boxStartX = mouseX;
        _boxStartY = mouseY;
        _isBoxSelecting = true;
      }

      /* Camera angle slider click */
      var slider = getCameraSliderRect(panelX, getPanelContentY());
      if (inRect(mouseX, mouseY, slider.x, slider.y, slider.w, slider.h)) {
        /* Inverted: left = 90° (top-down), right = 0° (perspective) */
        var sliderVal = 1 - (mouseX - slider.x) / slider.w;
        if (sliderVal < 0) sliderVal = 0;
        if (sliderVal > 1) sliderVal = 1;
        cameraTiltAngle = sliderVal * 90;
        updateCameraFromTilt();
        saveCameraSettings();
        return;
      }

      /* Start minimap drag */
      if (inRect(mouseX, mouseY, mmX, mmY, mmSize, mmSize)) {
        _isMinimapDragging = true;
      }

    } else if (e.button === 2 || e.button === 1) {
      /* Right or middle button -> move order */
      isRightDown = true;
    }
  });

  attachTarget.addEventListener('mouseup', function(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    mouseX = Math.floor((e.clientX - rect.left) * scaleX);
    mouseY = Math.floor((e.clientY - rect.top) * scaleY);

    if (e.button === 0) {
      /* Left button up */
      if (_playerSelectionActive) return;

      if (_isMinimapDragging) {
        _isMinimapDragging = false;
        isMouseDown = false;
      }

      if (pview) {
        isMouseDown = false;
        _isBoxSelecting = false;
        return;
      }

      /* Finalize selection / deselect */
      if (_isBoxSelecting && inRect(mouseX, mouseY, 0, 0, GameAreaWidth, GameAreaHeight)) {
        var dragDx = Math.abs(mouseX - _boxStartX);
        var dragDy = Math.abs(mouseY - _boxStartY);
        var dragged = (dragDx > 5) || (dragDy > 5);

        if (dragged) {
          /* Box select */
          shiptest(
            Math.min(_boxStartX, mouseX), Math.min(_boxStartY, mouseY),
            Math.max(_boxStartX, mouseX), Math.max(_boxStartY, mouseY)
          );
        } else {
          /* Simple click (no drag): select or deselect */
          var found = shiptest(
            _boxStartX - 5, _boxStartY - 5,
            _boxStartX + 5, _boxStartY + 5
          );

          if (!found) {
            /* Clicked empty space -> deselect all ships */
            deselectAllShips();
          }

          /* Planet click: only on simple click (no drag) */
          planettest();
        }
      }

      /* Always clear selection frame on mouse up in game area */
      if (_isBoxSelecting) rahmen = false;

      /* Minimap navigation on click */
      if (!pview && inRect(mouseX, mouseY, mmX, mmY, mmSize, mmSize)) {
        /* Clamp mouse to minimap bounds in perspective mode so the
         * camera can't pan outside the world boundaries. */
        var _mmx = mouseX, _mmy = mouseY;
        if (isPerspectiveMode()) {
          if (_mmx < mmX) _mmx = mmX;
          if (_mmx > mmX + mmSize) _mmx = mmX + mmSize;
          if (_mmy < mmY) _mmy = mmY;
          if (_mmy > mmY + mmSize) _mmy = mmY + mmSize;
        }
        var wx = ((_mmx - mmX) / mmSize) * seite;
        var wy = ((_mmy - mmY) / mmSize) * seite;
        bx = Math.trunc(GameAreaWidth / 2 - wx * zoomScale);
        by = Math.trunc(GameAreaHeight / 2 - wy * zoomScale);
      }

      isMouseDown = false;
      _isBoxSelecting = false;

    } else if (e.button === 2 || e.button === 1) {
      /* Right or middle button up -> process move order */
      if (isRightDown) {
        handleRightClickOrder(mouseX, mouseY);
      }
      isRightDown = false;
    }
  });

  attachTarget.addEventListener('mousemove', function(e) {
    var rect = attachTarget.getBoundingClientRect();
    var scaleX = attachTarget.width / rect.width;
    var scaleY = attachTarget.height / rect.height;
    mouseX = Math.floor((e.clientX - rect.left) * scaleX);
    mouseY = Math.floor((e.clientY - rect.top) * scaleY);

    /* Update box selection rectangle only if actually dragging */
    if (isMouseDown && _isBoxSelecting && inRect(mouseX, mouseY, 0, 0, GameAreaWidth, GameAreaHeight)) {
      var _bdx = Math.abs(mouseX - _boxStartX);
      var _bdy = Math.abs(mouseY - _boxStartY);
      if (_bdx > 5 || _bdy > 5) {
        rahmen = true;
        rx = mouseX;
        ry = mouseY;
        boxR.x = Math.min(_boxStartX, mouseX);
        boxR.y = Math.min(_boxStartY, mouseY);
        boxR.w = _bdx + 1;
        boxR.h = _bdy + 1;
      }
    }

    /* Slider drag */
    if (isMouseDown) {
      var panelX = GameAreaWidth + 5;
      var slider = getCameraSliderRect(panelX, getPanelContentY());
      if (inRect(mouseX, mouseY, slider.x, slider.y - uiPx(4),
                 slider.w, slider.h + uiPx(8))) {
        /* Inverted: left = 90° (top-down), right = 0° (perspective) */
        var sliderVal = 1 - (mouseX - slider.x) / slider.w;
        if (sliderVal < 0) sliderVal = 0;
        if (sliderVal > 1) sliderVal = 1;
        cameraTiltAngle = sliderVal * 90;
        updateCameraFromTilt();
        saveCameraSettings();
      }
    }

    /* Minimap drag navigation */
    if (isMouseDown && _isMinimapDragging) {
      var _mmx = mouseX, _mmy = mouseY;
      if (isPerspectiveMode()) {
        if (_mmx < mmX) _mmx = mmX;
        if (_mmx > mmX + mmSize) _mmx = mmX + mmSize;
        if (_mmy < mmY) _mmy = mmY;
        if (_mmy > mmY + mmSize) _mmy = mmY + mmSize;
      }
      bx = -Math.trunc((_mmx - mmX) * seite / mmSize * zoomScale) + Math.trunc(GameAreaWidth / 2);
      by = -Math.trunc((_mmy - mmY) * seite / mmSize * zoomScale) + Math.trunc(GameAreaHeight / 2);
    }
  });

  /* Prevent context menu on right click */
  attachTarget.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });

  /* --- Mouse wheel: zoom in/out toward cursor position --- */
  attachTarget.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (pview) return;

    var oldZoomScale = zoomScale;

    if (e.deltaY < 0) {
      if (zoomLevel < 5) {
        zoomLevel++;
        zoomScale = zoomLevels[zoomLevel];
      }
    } else if (e.deltaY > 0) {
      if (zoomLevel > 0) {
        zoomLevel--;
        zoomScale = zoomLevels[zoomLevel];
      }
    }

    if (zoomScale !== oldZoomScale) {
      var _cx = GAME_AREA_X + GameAreaWidth / 2;
      var _cy = GAME_AREA_Y + GameAreaHeight / 2;

      /* Check if mouse is over minimap — if so, zoom to center of view */
      var rect = attachTarget.getBoundingClientRect();
      var mx = (e.clientX - rect.left) * (attachTarget.width / rect.width);
      var my = (e.clientY - rect.top) * (attachTarget.height / rect.height);
      var zoomToCursor = !inRect(mx, my, mmX, mmY, mmSize, mmSize);

      if (zoomScale > oldZoomScale) {
        /* Zoom IN */
        if (zoomToCursor) {
          /* Zoom toward cursor position */
          var sx = mx;
          var sy = my;
          var w = screenToWorld3D(sx, sy);
          bx = Math.round(_cx - GAME_AREA_X - w.x * zoomScale);
          by = Math.round(_cy - GAME_AREA_Y - w.y * zoomScale);
        } else {
          /* Zoom toward center of view */
          var wCenter = screenToWorld3D(_cx, _cy);
          bx = Math.round(_cx - GAME_AREA_X - wCenter.x * zoomScale);
          by = Math.round(_cy - GAME_AREA_Y - wCenter.y * zoomScale);
        }
      } else {
        /* Zoom OUT from center — keep camera world position the same. */
        var camWx = (-bx - GAME_AREA_X + _cx) / oldZoomScale;
        var camWy = (-by - GAME_AREA_Y + _cy) / oldZoomScale;
        bx = Math.round(_cx - GAME_AREA_X - camWx * zoomScale);
        by = Math.round(_cy - GAME_AREA_Y - camWy * zoomScale);
      }
    }
  });

  /* --- Window resize --- */
  window.addEventListener('resize', function() {
    var rect = canvas.getBoundingClientRect();
    curW = canvas.width;
    curH = canvas.height;
    if (curW < 640) curW = 640;
    if (curH < 480) curH = 480;
    CalcLayout();
  });
}

/* ================================================================ */
/* processInput — Called each frame for continuous input handling    */
/* ================================================================ */
function processInput() {
  /* Player selection screen: handled in renderPlayerSelection */
  if (_playerSelectionActive) return;

  if (paused) return;
  if (pview) return;

  var layout = getPanelLayout();

  /* --- Minimap drag: update camera every frame while dragging --- */
  if (isMouseDown && _isMinimapDragging) {
    var _mmx = mouseX, _mmy = mouseY;
    if (isPerspectiveMode()) {
      if (_mmx < mmX) _mmx = mmX;
      if (_mmx > mmX + mmSize) _mmx = mmX + mmSize;
      if (_mmy < mmY) _mmy = mmY;
      if (_mmy > mmY + mmSize) _mmy = mmY + mmSize;
    }
    bx = -Math.trunc((_mmx - mmX) * seite / mmSize * zoomScale) + Math.trunc(GameAreaWidth / 2);
    by = -Math.trunc((_mmy - mmY) * seite / mmSize * zoomScale) + Math.trunc(GameAreaHeight / 2);
  }

  /* --- WASD camera pan --- */
  var panBounds = getCameraPanBounds();
  var canPanX = GameAreaWidth / zoomScale < seite;
  var canPanY = GameAreaHeight / zoomScale < seite;

  if (canPanX) {
    if (_keyDown['KeyA'] && bx < panBounds.bxMax) bx += 30;
    if (_keyDown['KeyD'] && bx > panBounds.bxMin) bx -= 30;
  }
  if (canPanY) {
    if (_keyDown['KeyW'] && by < panBounds.byMax) by += 30;
    if (_keyDown['KeyS'] && by > panBounds.byMin) by -= 30;
  }

  /* --- Edge scrolling at the browser/window borders --- */
  if (mouseX >= 0 && mouseY >= 0 &&
      mouseX <= curW && mouseY <= curH &&
      !(_isMinimapDragging && isMouseDown)) {
    /* Only pan if the zoomed viewport is smaller than the world. */
    if (canPanX) {
      if (mouseX < 3 && bx < panBounds.bxMax) {
        bx += 30;
      }
      /* The right edge is the browser window edge, not the side-panel
       * border — the mouse only has to touch the right screen edge. */
      if (mouseX > curW - 3 && bx > panBounds.bxMin) {
        bx -= 30;
      }
    }
    if (canPanY) {
      if (mouseY < 3 && by < panBounds.byMax) {
        by += 30;
      }
      if (mouseY > curH - 3 && by > panBounds.byMin) {
        by -= 30;
      }
    }
  }

  /* --- Planet hover detection: always update mb and pnr for highlight ring --- */
  if (inRect(mouseX, mouseY, 0, 0, GameAreaWidth, GameAreaHeight)) {
    var hoverPnr = 0;
    for (var _pi = 0; _pi < maxpl; _pi++) {
      var _ps = worldToScreen3D(planets[_pi].s.x, planets[_pi].s.y, PLANET_HEIGHT);
      var _hitR = getPlanetScreenRadius(planets[_pi].s.x, planets[_pi].s.y);
      var _px1 = Math.round(_ps.x) - _hitR;
      var _py1 = Math.round(_ps.y) - _hitR;
      var _px2 = Math.round(_ps.x) + _hitR;
      var _py2 = Math.round(_ps.y) + _hitR;
      if (mouseX >= _px1 && mouseX <= _px2 && mouseY >= _py1 && mouseY <= _py2) {
        hoverPnr = _pi + 1;
        break;
      }
    }
    mb = hoverPnr;
    if (!pview) {
      pnr = hoverPnr;
    }
  }

  /* --- Planet view detection: handled in mouseup, not here --- */

  /* --- Draw selection rectangle only if actually dragging (mouse moved) --- */
  if (isMouseDown && _isBoxSelecting && inRect(mouseX, mouseY, 0, 0, GameAreaWidth, GameAreaHeight)) {
    var _ddx = Math.abs(mouseX - _boxStartX);
    var _ddy = Math.abs(mouseY - _boxStartY);
    if (_ddx > 5 || _ddy > 5) {
      rahmen = true;
      rx = mouseX;
      ry = mouseY;
    }
  }

  /* --- Camera boundary clamping ---
   * In orthographic mode: clamp so the viewport edges touch the world boundaries.
   * In perspective mode: skip clamping — the minimap mouse is already clamped,
   * and the 3D perspective naturally shows the world edge.
   */

  var effW = GameAreaWidth / zoomScale;
  var effH = GameAreaHeight / zoomScale;

  if (!isPerspectiveMode()) {
    var halfW = GameAreaWidth / 2;
    var halfH = GameAreaHeight / 2;

    if (effW >= seite) {
      bx = Math.trunc((-seite + seite) / 2);
    } else {
      var bxMax = halfW * (1 - 1 / zoomScale);
      var bxMin = halfW * (1 + 1 / zoomScale) - seite;
      if (bx > bxMax) bx = Math.trunc(bxMax);
      if (bx < bxMin) bx = Math.trunc(bxMin);
    }

    if (effH >= seite) {
      by = 0;
    } else {
      var byMax = halfH * (1 - 1 / zoomScale);
      var byMin = halfH * (1 + 1 / zoomScale) - seite;
      if (by > byMax) by = Math.trunc(byMax);
      if (by < byMin) by = Math.trunc(byMin);
    }
  }

  /* Recompute visible world bounds after clamping */
  var _cx = GAME_AREA_X + GameAreaWidth / 2;
  var _cy = GAME_AREA_Y + GameAreaHeight / 2;
  var wxLeft  = -bx + _cx * (1 - 1 / zoomScale) - GAME_AREA_X;
  var wyTop   = -by + _cy * (1 - 1 / zoomScale) - GAME_AREA_Y;

  var boxX = mmX + (wxLeft  / seite) * mmSize;
  var boxY = mmY + (wyTop   / seite) * mmSize;
  var vRectW = (effW / seite) * mmSize;
  var vRectH = (effH / seite) * mmSize;

  /* Clamp rect to minimap bounds (for drawing only) */
  if (boxX < mmX) boxX = mmX;
  if (boxY < mmY) boxY = mmY;
  if (boxX + vRectW > mmX + mmSize) vRectW = mmX + mmSize - boxX;
  if (boxY + vRectH > mmY + mmSize) vRectH = mmY + mmSize - boxY;

  /* --- Update prevLeftDown and box selection state --- */
  prevLeftDown = isMouseDown;
  if (!isMouseDown) {
    _isBoxSelecting = false;
    _isMinimapDragging = false;
  }
}

/* ================================================================ */
/* handleKeyPress — Process keyboard input (called each frame)       */
/* ================================================================ */
function handleKeyPress(key) {
  /* This function is a convenience wrapper for external callers.
   * Most key handling is done inline in the event listeners for
   * responsiveness, but this can be used for gamepad or custom input. */
  if (key === 'p' || key === 'P') {
    paused = !paused;
  } else if (key === 'Escape') {
    if (pview) {
      pview = false;
      befehl = false;
      rahmen = false;
    }
  } else if (key === 'F5') {
    speichernladen(1);
  } else if (key === 'F9') {
    speichernladen(2);
  }
}

/* ================================================================ */
/* getMouseWorldPos — Convert mouse screen coords to world coords    */
/* ================================================================ */
function getMouseWorldPos() {
  return screenToWorld3D(mouseX, mouseY);
}

/* ================================================================ */
/* Player selection screen helpers                                  */
/* ================================================================ */
function startPlayerSelection() {
  _playerSelectionActive = true;
  _playerSelectionChoice = 1;
}

function isPlayerSelectionActive() {
  return _playerSelectionActive;
}

function getPlayerSelectionChoice() {
  return _playerSelectionChoice;
}

function endPlayerSelection() {
  _playerSelectionActive = false;
  snr = _playerSelectionChoice;
}
