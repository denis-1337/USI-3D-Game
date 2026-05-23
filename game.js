/* game.js — Main game loop, initialization, and orchestration.
 *
 * 3D version: Three.js for world rendering, Canvas 2D overlay for UI.
 *
 * Exports:
 *   - init(): entry point called from index.html on window load.
 */

var canvasEl = null;
var ctx = null;

/* Reusable refs for searchgf() — avoid per-frame GC */
var _fRef = { val: 0 };
var _fnRef = { val: 0 };
var lastFrameTime = 0;

/* ================================================================ */
/* init — Initialize everything and start the game loop             */
/* ================================================================ */
function init() {
  /* Get 3D canvas */
  canvasEl = document.getElementById('gameCanvas3D');

  /* Set initial window size */
  curW = canvasEl.width;
  curH = canvasEl.height;
  CalcLayout();

  /* Initialize Three.js */
  initThree();
  initSelectionFrames();

  /* Initialize 3D minimap */
  initMinimap3D();

  /* Safety: ensure main camera is not the same object as minimap camera */
  if (camera === minimapCamera) {
    console.warn('camera === minimapCamera after init! Re-creating main camera.');
    var fov = 50;
    var aspect = curW / curH;
    camera = new THREE.PerspectiveCamera(fov, aspect, 1, 10000);
    camera.position.set(0, 2000, 0);
    camera.lookAt(0, 0, 0);
  }

  /* Initialize input (keyboard + mouse event listeners) */
  initInput(canvasEl);

  /* Restore persisted camera settings */
  loadCameraSettings();
  updateCameraFromTilt();

  /* Game state init */
  running = true;
  paused = false;
  frameCount = 0;
  tickCount = 0;

  pview = false;
  rahmen = false;
  befehl = false;
  pnr = 0;
  mb = 0;
  bx = 0;
  by = 0;
  prevLeftDown = false;

  /* Zoom: default 1:1 */
  zoomLevel = 2;
  zoomScale = 1.0;

  /* Set max ship counts per faction */
  factionStats[0].max = 85;
  factionStats[1].max = 85;
  factionStats[2].max = 85;

  /* Show player selection screen */
  startPlayerSelection();

  /* Run the player-selection mini-loop first */
  runPlayerSelectionLoop();
}

/* ================================================================ */
/* runPlayerSelectionLoop — Render selection screen until confirmed */
/* ================================================================ */
function runPlayerSelectionLoop() {
  function selectionFrame() {
    if (!running) return;

    /* Clear overlay */
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    /* Render 3D background (starfield) */
    if (renderer3D && scene && camera) {
      renderer3D.render(scene, camera);
    }

    /* Render player selection on overlay */
    renderPlayerSelection();

    /* Render cursor */
    renderCursor();

    /* Check if player confirmed selection */
    if (!isPlayerSelectionActive()) {
      snr = getPlayerSelectionChoice();
      if (snr < 1) snr = 1;

      /* Create ship/planet models */
      erzeuge();

      /* Initialize planets, factions, starting ships */
      initdaten();

      /* Create 3D planet meshes for all planets */
      for (var pi = 0; pi < maxpl; pi++) {
        createPlanet3D(pi);
      }

      gameWon = false;
      gameLost = false;

      /* Add starting transporters */
      newship(ships[1].s, 1, 4);
      newship(ships[1].s, 1, 4);
      newship(ships[3].s, 2, 4);
      newship(ships[3].s, 2, 4);
      newship(ships[6].s, 3, 4);
      newship(ships[6].s, 3, 4);

      /* Center initial camera */
      var cnt = 0;
      var cx = 0;
      var cy = 0;
      for (var i = 0; i < maxships; i++) {
        if (ships[i].ex && (ships[i].gr === snr)) {
          cx = cx + ships[i].s.x;
          cy = cy + ships[i].s.y;
          cnt = cnt + 1;
        }
      }
      if (cnt > 0) {
        cx = cx / cnt;
        cy = cy / cnt;
        by = Math.trunc(GameAreaHeight / 2.0 - cy);
        bx = Math.trunc(GameAreaWidth / 2.0 - cx);
      }

      mouseX = -1;
      mouseY = -1;

      /* Start the main game loop */
      lastFrameTime = 0;
      gameLoop();
      return;
    }

    requestAnimationFrame(selectionFrame);
  }

  requestAnimationFrame(selectionFrame);
}

/* ================================================================ */
/* gameLoop — Main game loop using requestAnimationFrame            */
/* ================================================================ */
function gameLoop() {
  function loop(timestamp) {
    if (!running) {
      runPlayerSelectionLoop();
      return;
    }

    /* FPS throttling: target ~30 FPS */
    if (lastFrameTime > 0) {
      var elapsed = timestamp - lastFrameTime;
      if (elapsed < 33) {
        requestAnimationFrame(loop);
        return;
      }
    }
    lastFrameTime = timestamp;

    frameCount++;
    tickCount++;

    try {
      _gameLoopBody();
    } catch (e) {
      console.error('CRASH tick=' + tickCount + ' ' + (e && e.message ? e.message : String(e)));
      /* Keep going — don't stop the loop */
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

function _gameLoopBody() {

    /* Process continuous input */
    processInput();

    if (!pview) {
      /* Show 3D canvases again when leaving planet menu */
      var c3dElShow = document.getElementById('gameCanvas3D');
      var mm3dElShow = document.getElementById('minimapCanvas3D');
      if (c3dElShow) c3dElShow.style.visibility = '';
      if (mm3dElShow) mm3dElShow.style.visibility = '';

      if (!paused) {
        /* ---- SHIP MOVEMENT & AI ---- */
        for (var i = 0; i < maxships; i++) {
          if (ships[i].ex) {
            beweg(ships[i]);
            aufladen(ships[i]);
          }
        }

        /* ---- FACTION SHIP COUNT UPDATE ---- */
        for (var f = 0; f < 3; f++) {
          factionStats[f].an =
            factionStats[f].t +
            factionStats[f].j +
            factionStats[f].aj +
            factionStats[f].b;
        }

        /* ---- RENDER ORDER ---- */
        /* 3D: planets, ships, projectiles, effects */
        showplanet();
        showammo();
        aktivships();
        showschild();
        showexplos();
        showraks();
        showsmart();

        /* Render 3D scene */
        render3DFrame();

        /* Render 3D minimap */
        renderMinimap3DFrame();

        /* ---- WIN/LOSE OVERLAY (2D) ---- */
        if (gameWon || gameLost) {
          var cx = Math.trunc(GameAreaWidth / 2);
          var cy = 60;
          if (gameWon) {
            DrawText(cx, cy, t('won'), 11);
          } else {
            DrawText(cx, cy, t('lost'), 4);
          }
        }

        /* ---- STRATEGIC AI ---- */
        for (var i = 1; i <= 3; i++) {
          if (i !== snr) {
            ki(i);
            pki(i);
          }
        }

        /* ---- PLANET PROCESSING ---- */
        for (var i = 0; i < maxpl; i++) {
          if (tickCount % pge === 0) {
            pkampf(planets[i]);
          }
          produktion(planets[i]);
          if (sichtable(planets[i].s)) {
            prodstand(planets[i]);
            live(planets[i]);
          }
        }

        /* ---- PLANET DEFENSES (cannons & shields) ---- */
        planetDefenses();

        /* ---- CHECK WIN/LOSE ---- */
        if (tickCount % 60 === 0) {
          checkWinLose();
        }

        /* ---- SELECTION FRAMES (2D overlay) ---- */
        renderSelectionFrames();

        /* ---- RIGHT-CLICK ORDER ---- */
        if (isRightDown) {
          handleRightClickOrder(mouseX, mouseY);
        }

        /* ---- searchgf() for ships ---- */
        var j = ((tickCount % 51) + 1) * 5 - 1;
        if (j >= maxships) j = maxships - 1;
        if (ships[j].ex) {
          _fRef.val = ships[j].f;
          _fnRef.val = ships[j].fn;
          ships[j].gf = searchgf(ships[j].s, ships[j].gr, _fRef, _fnRef);
          ships[j].f = _fRef.val;
          ships[j].fn = _fnRef.val;
        }
        if ((j - 1 >= 0) && ships[j - 1].ex) {
          _fRef.val = ships[j - 1].f;
          _fnRef.val = ships[j - 1].fn;
          ships[j - 1].gf = searchgf(ships[j - 1].s, ships[j - 1].gr, _fRef, _fnRef);
          ships[j - 1].f = _fRef.val;
          ships[j - 1].fn = _fnRef.val;
        }
        if ((j - 2 >= 0) && ships[j - 2].ex) {
          _fRef.val = ships[j - 2].f;
          _fnRef.val = ships[j - 2].fn;
          ships[j - 2].gf = searchgf(ships[j - 2].s, ships[j - 2].gr, _fRef, _fnRef);
          ships[j - 2].f = _fRef.val;
          ships[j - 2].fn = _fnRef.val;
        }
        if ((j - 3 >= 0) && ships[j - 3].ex) {
          _fRef.val = ships[j - 3].f;
          _fnRef.val = ships[j - 3].fn;
          ships[j - 3].gf = searchgf(ships[j - 3].s, ships[j - 3].gr, _fRef, _fnRef);
          ships[j - 3].f = _fRef.val;
          ships[j - 3].fn = _fnRef.val;
        }
        if ((j - 4 >= 0) && ships[j - 4].ex) {
          _fRef.val = ships[j - 4].f;
          _fnRef.val = ships[j - 4].fn;
          ships[j - 4].gf = searchgf(ships[j - 4].s, ships[j - 4].gr, _fRef, _fnRef);
          ships[j - 4].f = _fRef.val;
          ships[j - 4].fn = _fnRef.val;
        }

        /* ---- searchgf() for planets ---- */
        var _f2Ref = {}, _fn2Ref = {};
        var j2 = (tickCount % 10);
        for (var fi = 0; fi < 3; fi++) {
          _f2Ref.val = planets[j2].k[fi].f2;
          _fn2Ref.val = planets[j2].k[fi].fn;
          planets[j2].k[fi].gf = searchgf(planets[j2].s, fi + 1, _f2Ref, _fn2Ref);
          planets[j2].k[fi].f2 = _f2Ref.val;
          planets[j2].k[fi].fn = _fn2Ref.val;
          if (planets[j2].k[fi].a > 6) planets[j2].k[fi].gf += 10;
          if (planets[j2].k[fi].a > 0)  planets[j2].k[fi].gf += 10;
        }
      }
      /* end if not paused */
    }
    /* end if not pview */
    else {
      /* Planet menu active — keep minimap 3D canvas visible for background */
      /* Hide only the main 3D canvas */
      var c3dEl = document.getElementById('gameCanvas3D');
      var mm3dEl = document.getElementById('minimapCanvas3D');
      if (c3dEl) c3dEl.style.visibility = 'hidden';
      if (mm3dEl) mm3dEl.style.visibility = '';

      /* Render the minimap 3D background (black) */
      renderMinimap3DFrame();

      /* Clear overlay and render planet menu */
      if (overlayCtx) {
        overlayCtx.fillStyle = '#000000';
        overlayCtx.fillRect(0, 0, curW, curH);
      }
      if (pnr >= 1 && pnr <= maxpl) {
        pmenu(planets[pnr - 1]);
      }
    }

    /* ---- UI OVERLAY (2D) ---- */
    renderUI();

    /* ---- CURSOR (2D) ---- */
    renderCursor();

    /* ---- BOX SELECTION (2D overlay) — AFTER renderUI so it's not cleared ---- */
    if (_isBoxSelecting && rahmen) {
      renderBoxSelection();
    }

    /* ---- Present (3D already rendered above) ---- */
    PresentFrame();

    /* Cleanup old effects periodically */
    if (tickCount % 300 === 0) {
      cleanupEffects3D();
    }
  }

/* ================================================================ */
/* createPlanet3D — Create 3D mesh for a planet                     */
/* ================================================================ */
function createPlanet3D(index) {
  var planet = planets[index];
  if (!planet) return;

  var radius = 40;
  var body = createPlanetMesh(radius, planet.f);

  var fc = FACTION_COLORS[planet.snr > 0 ? planet.snr : 1];
  var atmos = createPlanetAtmosphere(radius, fc.body);

  var group = new THREE.Group();
  group.add(body);
  group.add(atmos);

  /* Info group (bars + name) */
  var infoGroup = createPlanetInfoGroup(index);
  group.add(infoGroup);

  /* Name sprite */
  var nameSprite = createPlanetNameSprite(planet.name);
  infoGroup.add(nameSprite);
  infoGroup.userData.nameSprite = nameSprite;

  var p3d = gameTo3D(planet.s.x, planet.s.y);
  group.position.set(p3d.x, PLANET_HEIGHT, p3d.z);

  planetsGroup.add(group);

  planetMeshes[index] = {
    group: group,
    body: body,
    atmosphere: atmos,
    infoGroup: infoGroup,
    radius: radius,
    rotSpeed: (0.002 + Math.random() * 0.006) * (Math.random() < 0.5 ? 1 : -1)
  };
}
