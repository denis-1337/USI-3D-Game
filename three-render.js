/* three-render.js — 3D render loop and sync with game state */

/*
 * Dispose Three.js object and all its children recursively.
 * Frees GPU memory for geometries and materials.
 */
function disposeThreeObject(obj) {
  if (!obj) return;
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) {
      for (var m = 0; m < obj.material.length; m++) obj.material[m].dispose();
    } else {
      obj.material.dispose();
    }
  }
  if (obj.children) {
    for (var c = 0; c < obj.children.length; c++) disposeThreeObject(obj.children[c]);
  }
}

/*
 * Main 3D render call — called from gameLoop each frame.
 * Syncs 3D objects with 2D game state, then renders.
 */
function render3DFrame() {
  if (!renderer3D || !scene || !camera) return;

  updateCameraFromGame();
  updateShips3D();
  updateSelectionFrames3D();
  updatePlanets3D();
  updateShields3D();
  updateEffects3D();

  renderer3D.render(scene, camera);
}

/*
 * Update camera position to follow game camera, with tilt angle.
 * At 0°: orthographic top-down. At >0°: perspective angled view.
 */
function updateCameraFromGame() {
  var cx = GAME_AREA_X + GameAreaWidth / 2.0;
  var cy = GAME_AREA_Y + GameAreaHeight / 2.0;

  /* World position the camera is looking at */
  var wx = (-bx - GAME_AREA_X + cx) / zoomScale;
  var wy = (-by - GAME_AREA_Y + cy) / zoomScale;

  /* Convert to 3D world coords (centered at origin) */
  var targetX = wx - seite / 2;
  var targetZ = wy - seite / 2;

  updateCameraFromTilt();
  camera.lookAt(targetX, 0, targetZ);

  /* Update frustum size for zoom changes */
  updateCameraFromZoom();
}

/*
 * Update camera tilt angle — switch between orthographic and perspective.
 * Called when cameraTiltAngle changes via the slider.
 */
function updateCameraFromTilt() {
  var cx = GAME_AREA_X + GameAreaWidth / 2.0;
  var cy = GAME_AREA_Y + GameAreaHeight / 2.0;
  var wx = (-bx - GAME_AREA_X + cx) / zoomScale;
  var wy = (-by - GAME_AREA_Y + cy) / zoomScale;
  var targetX = wx - seite / 2;
  var targetZ = wy - seite / 2;

  var tiltRad = cameraTiltAngle * Math.PI / 180;

  /* Camera distance from target based on tilt and field of view */
  var fov = 50;
  var fovRad = fov * Math.PI / 180;
  var dist = seite / (2 * Math.tan(fovRad / 2) * zoomScale);

  /* Camera position: at 0° directly above, at >0° angled back */
  var camX = targetX;
  var camY = dist * Math.sin(tiltRad);
  var camZ = targetZ + dist * Math.cos(tiltRad);

  /* Ensure we have a PerspectiveCamera */
  if (camera.type !== 'PerspectiveCamera') {
    var aspect = curW / curH;
    var newCam = new THREE.PerspectiveCamera(fov, aspect, 1, 10000);
    newCam.position.set(camX, camY, camZ);
    newCam.lookAt(targetX, 0, targetZ);
    camera = newCam;
  } else {
    camera.position.set(camX, camY, camZ);
  }
}

/*
 * Sync 3D ship meshes with 2D ship data.
 */
function updateShips3D() {
  var time = Date.now() * 0.001;

  for (var i = 0; i < maxships; i++) {
    if (!ships[i] || !ships[i].ex) {
      if (shipMeshes[i]) {
        disposeThreeObject(shipMeshes[i]);
        shipsGroup.remove(shipMeshes[i]);
        shipMeshes[i] = null;
      }
      /* Clean up spray only if all particles are dead */
      if (ships[i] && ships[i].sprayPoints && ships[i].sprayActive) {
        var allDead = true;
        for (var _sd = 0; _sd < ships[i].sprayLifetimes.length; _sd++) {
          if (ships[i].sprayLifetimes[_sd] > 0) { allDead = false; break; }
        }
        if (allDead) {
          effectsGroup.remove(ships[i].sprayPoints);
          ships[i].sprayPoints.geometry.dispose();
          ships[i].sprayPoints = null;
          ships[i].sprayActive = false;
        }
      }
      continue;
    }

    var ship = ships[i];

    if (!shipMeshes[i]) {
      var mesh = loadShipModelJSON(ship.typ).clone(true);
      // Clone materials so opacity/transparent changes don't affect other ships of the same type
      for (var fc = 0; fc < mesh.children.length; fc++) {
        var child = mesh.children[fc];
        child.frustumCulled = false;
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
        }
      }
      // Use YXZ order: Yaw first, then Roll around the ship's nose axis
      mesh.rotation.order = 'YXZ';
      mesh.userData.prevAngle = 0;
      mesh.userData.smoothTurn = 0;
      shipMeshes[i] = mesh;
      shipsGroup.add(mesh);
    }

    var mesh = shipMeshes[i];

    /* Convert game coords to 3D world coords */
    var p3d = gameTo3D(ship.s.x, ship.s.y);

    /* Hover animation */
    var hover = Math.sin(time * 2 + i) * 0.5;
    mesh.position.set(p3d.x, WORLD_HEIGHT + hover, p3d.z);

    /* Rotation — ship faces its velocity/heading direction (top-down view) */
    var dir = (ship.v.x !== 0 || ship.v.y !== 0) ? ship.v : ship.h;
    var speed = Math.sqrt(dir.x * dir.x + dir.y * dir.y);

    if (speed > 0.1) {
      var rotAngle = Math.atan2(dir.y, dir.x);
      var targetRot = -rotAngle;

      /* Smooth rotation via lerp — no jitter at long range, no stuttering in curves */
      var diff = targetRot - mesh.rotation.y;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      mesh.rotation.y += diff * 0.4;

      /* Bank/roll in curves — smooth via lerp on turn rate */
      var prevAngle = mesh.userData.prevAngle || rotAngle;
      var turnRate = rotAngle - prevAngle;
      while (turnRate > Math.PI) turnRate -= 2 * Math.PI;
      while (turnRate < -Math.PI) turnRate += 2 * Math.PI;
      mesh.userData.prevAngle = rotAngle;

      /* Smooth the turn rate itself — eliminates jitter */
      var smoothTurn = (mesh.userData.smoothTurn || 0) + (turnRate - (mesh.userData.smoothTurn || 0)) * 0.25;
      mesh.userData.smoothTurn = smoothTurn;

      /* Roll proportional to smoothed turn rate */
      var targetRoll = smoothTurn * 6;
      if (targetRoll > 1.57) targetRoll = 1.57;
      if (targetRoll < -1.57) targetRoll = -1.57;
      mesh.rotation.x += (targetRoll - mesh.rotation.x) * 0.3;
    } else {
      /* Ship stopped — slowly return to upright */
      mesh.rotation.x += (0 - mesh.rotation.x) * 0.05;
    }

    /* Hide dead/dying ships — mesh is a Group, so iterate children */
    if (ship.panz <= 0) {
      /* Ship is dying — keep visible until it's fully destroyed (panz < -5000).
       * Fade starts only in the last phase so the ship is visible while exploding. */
      var opacity = Math.max(0, 1 + (ship.panz + 5000) / 5000);
      mesh.visible = opacity > 0.05;
      for (var mc = 0; mc < mesh.children.length; mc++) {
        var child = mesh.children[mc];
        if (child.material) {
          child.material.transparent = true;
          child.material.opacity = opacity;
        }
      }
    } else {
      mesh.visible = true;
      for (var mc2 = 0; mc2 < mesh.children.length; mc2++) {
        var child2 = mesh.children[mc2];
        if (child2.material) {
          child2.material.transparent = false;
          child2.material.opacity = 1;
        }
      }
    }
  }
}

/*
 * Update 3D selection frames — show above selected ships, billboard to camera.
 * Shows bracket frame + armor/shield bars like the original rahmenbild.
 */
function updateSelectionFrames3D() {
  var time = Date.now() * 0.001;
  for (var i = 0; i < maxships; i++) {
    var frame = selectionFrameMeshes[i];
    if (!frame) continue;

    var ship = ships[i];

    if (ship && ship.ex && ship.r && ship.panz > 0) {
      frame.visible = true;
      var p3d = gameTo3D(ship.s.x, ship.s.y);
      var hover = Math.sin(time * 2 + i) * 0.5;
      frame.position.set(p3d.x, WORLD_HEIGHT + hover + FRAME_Y_OFFSET, p3d.z);

      /* Pulse effect */
      var pulse = 1 + Math.sin(time * 3 + i * 0.7) * 0.08;
      frame.scale.set(pulse, pulse, pulse);

      /* Billboard: always face the camera */
      frame.quaternion.copy(camera.quaternion);

      /* Update armor/shield bars */
      updateSelectionFrameData(frame, ship);
    } else {
      frame.visible = false;
    }
  }
}

/*
 * Create 3D planet with atmosphere and info group.
 */
/*
 * Sync 3D planet meshes with 2D planet data.
 */
function updatePlanets3D() {
  var time = Date.now() * 0.001;

  for (var i = 0; i < planets.length; i++) {
    var planet = planets[i];
    if (!planet) continue;

    if (!planetMeshes[i]) {
      createPlanet3D(i);
    }

    var pm = planetMeshes[i];
    if (!pm || !pm.group) continue;

    var p3d = gameTo3D(planet.s.x, planet.s.y);
    pm.group.position.set(p3d.x, PLANET_HEIGHT, p3d.z);

    /* Slow rotation — each planet has its own speed and direction */
    if (pm.body) pm.body.rotation.y += pm.rotSpeed || 0.005;

    /* Billboard: info group always faces the camera */
    if (pm.infoGroup) pm.infoGroup.quaternion.copy(camera.quaternion);

    /* Update sector texture */
    updatePlanetTexture(i);

    /* Update 3D bars */
    updatePlanetBars3D(i);
    updatePlanetProdBar3D(i);
    updatePlanetSectorBar3D(i);
  }
}

/*
 * Update 3D effects (explosions, projectiles, shield hits).
 * Uses pre-allocated meshes — toggles visibility instead of create/destroy.
 */
function updateEffects3D() {
  /* --- Explosions --- */
  for (var i = 0; i < explosions.length; i++) {
    var e = explosions[i];
    if (!e.mesh3d) continue;

    if (!e.ex) {
      e.mesh3d.visible = false;
      continue;
    }

    e.mesh3d.visible = true;

    var p3d = gameTo3D(e.s.x, e.s.y);
    e.mesh3d.position.set(p3d.x, WORLD_HEIGHT, p3d.z);

    var positions = e.mesh3d.geometry.attributes.position.array;
    var velocities = e.mesh3d.userData.velocities;
    var lifeRatio = e.e / 40;  /* Fast fade — gone in ~40 frames */

    for (var j = 0; j < velocities.length; j++) {
      positions[j * 3]     += velocities[j].x * 0.5;
      positions[j * 3 + 1] += velocities[j].y * 0.5;
      positions[j * 3 + 2] += velocities[j].z * 0.5;
    }
    e.mesh3d.geometry.attributes.position.needsUpdate = true;
    /* Apply custom color if set (e.g., blue for shield hit) */
    if (e.explosionColor) {
      e.mesh3d.material.color.setHex(e.explosionColor);
    }
    e.mesh3d.material.opacity = 1 - lifeRatio;
  }

  /* --- Standard ammo (projectiles) --- */
  for (var i = 0; i < ammo.length; i++) {
    if (!ammo[i].mesh3d) continue;

    if (!ammo[i].ex) {
      ammo[i].mesh3d.visible = false;
      continue;
    }

    ammo[i].mesh3d.visible = true;
    var p3d = gameTo3D(ammo[i].s.x, ammo[i].s.y);
    ammo[i].mesh3d.position.set(p3d.x, WORLD_HEIGHT, p3d.z);
  }

  /* --- Rockets --- */
  for (var i = 0; i < rockets.length; i++) {
    if (!rockets[i].mesh3d) continue;

    if (!rockets[i].ex) {
      rockets[i].mesh3d.visible = false;
      if (rockets[i].trailPoints) {
        effectsGroup.remove(rockets[i].trailPoints);
        rockets[i].trailPoints.geometry.dispose();
        rockets[i].trailPoints = null;
      }
      continue;
    }

    rockets[i].mesh3d.visible = true;
    var p3d = gameTo3D(rockets[i].s.x, rockets[i].s.y);
    rockets[i].mesh3d.position.set(p3d.x, WORLD_HEIGHT, p3d.z);

    var rvx = rockets[i].v.x;
    var rvy = rockets[i].v.y;
    var rSpeed = Math.sqrt(rvx * rvx + rvy * rvy);
    if (rSpeed > 0.1) {
      var rAngle = Math.atan2(rvy, rvx);
      rockets[i].mesh3d.rotation.y = -rAngle + Math.PI / 2;
    }

    /* Flicker engine glow */
    var engine = rockets[i].mesh3d.children[2];
    if (engine && engine.userData.isEngine) {
      engine.material.opacity = 0.5 + Math.random() * 0.5;
      var eScale = 0.8 + Math.random() * 0.6;
      engine.scale.set(eScale, eScale, eScale);
    }

    /* Rocket trail — particles left behind at engine position */
    if (!rockets[i].trailPoints) {
      var trailCount = 40;
      var trailGeo = new THREE.BufferGeometry();
      var trailPos = new Float32Array(trailCount * 3);
      var trailColors = new Float32Array(trailCount * 3);
      var trailAlive = new Float32Array(trailCount);
      var trailAlpha = new Float32Array(trailCount);
      for (var ti = 0; ti < trailCount; ti++) {
        trailPos[ti * 3] = 0; trailPos[ti * 3 + 1] = 0; trailPos[ti * 3 + 2] = 0;
        trailColors[ti * 3] = 1; trailColors[ti * 3 + 1] = 1; trailColors[ti * 3 + 2] = 1;
        trailAlive[ti] = 0;
        trailAlpha[ti] = 0;
      }
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
      trailGeo.setAttribute('alive', new THREE.BufferAttribute(trailAlive, 1));
      trailGeo.setAttribute('alpha', new THREE.BufferAttribute(trailAlpha, 1));
      rockets[i].trailPoints = new THREE.Points(trailGeo, particleShaderMaterial);
      effectsGroup.add(rockets[i].trailPoints);
      rockets[i].trailData = [];
    }

    /* Engine position (behind rocket) */
    var rvx2 = rockets[i].v.x;
    var rvy2 = rockets[i].v.y;
    var rSpd2 = Math.sqrt(rvx2 * rvx2 + rvy2 * rvy2);
    var ex = p3d.x - (rvx2 / rSpd2) * 3;
    var ez = p3d.z - (rvy2 / rSpd2) * 3;

    /* Add trail particle at engine position with slight spread */
    var td = rockets[i].trailData;
    td.unshift({
      x: ex + (Math.random() - 0.5) * 2,
      z: ez + (Math.random() - 0.5) * 2,
      life: 1.0
    });
    if (td.length > 40) td.length = 40;

    /* Update trail — particles stay, fade by age */
    var trailPositions = rockets[i].trailPoints.geometry.attributes.position.array;
    var trailColors = rockets[i].trailPoints.geometry.attributes.color.array;
    var trailAliveArr = rockets[i].trailPoints.geometry.attributes.alive.array;
    var trailAlphaArr = rockets[i].trailPoints.geometry.attributes.alpha.array;
    for (var ti = 0; ti < td.length; ti++) {
      trailPositions[ti * 3]     = td[ti].x;
      trailPositions[ti * 3 + 1] = WORLD_HEIGHT;
      trailPositions[ti * 3 + 2] = td[ti].z;
      td[ti].life -= 0.12;
      var a = Math.max(0, td[ti].life);
      trailAliveArr[ti] = 1.0;
      trailAlphaArr[ti] = a;
      /* Keep white color constant — alpha drives the fade */
      trailColors[ti * 3]     = 1.0;
      trailColors[ti * 3 + 1] = 1.0;
      trailColors[ti * 3 + 2] = 1.0;
    }
    while (td.length > 0 && td[td.length - 1].life <= 0) td.pop();
    for (var ti = td.length; ti < 40; ti++) {
      trailAliveArr[ti] = 0.0;
      trailAlphaArr[ti] = 0.0;
    }
    rockets[i].trailPoints.geometry.attributes.position.needsUpdate = true;
    rockets[i].trailPoints.geometry.attributes.color.needsUpdate = true;
    rockets[i].trailPoints.geometry.attributes.alive.needsUpdate = true;
    rockets[i].trailPoints.geometry.attributes.alpha.needsUpdate = true;
  }

  /* --- Smart missiles --- */
  for (var i = 0; i < smartMissiles.length; i++) {
    if (!smartMissiles[i].mesh3d) continue;

    if (!smartMissiles[i].ex) {
      smartMissiles[i].mesh3d.visible = false;
      if (smartMissiles[i].trailPoints) {
        effectsGroup.remove(smartMissiles[i].trailPoints);
        smartMissiles[i].trailPoints.geometry.dispose();
        smartMissiles[i].trailPoints = null;
      }
      continue;
    }

    smartMissiles[i].mesh3d.visible = true;
    var p3d = gameTo3D(smartMissiles[i].s.x, smartMissiles[i].s.y);

    /* Planet missiles start at planet surface and rise to ship level */
    var missileY = WORLD_HEIGHT;
    if (smartMissiles[i].planetOrigin !== undefined) {
      var riseFrames = 15;
      var riseProgress = Math.min(smartMissiles[i].e / riseFrames, 1);
      missileY = PLANET_HEIGHT + (WORLD_HEIGHT - PLANET_HEIGHT) * riseProgress;
    }
    smartMissiles[i].mesh3d.position.set(p3d.x, missileY, p3d.z);

    /* Planet-launched missiles get a different color (orange/yellow) */
    if (smartMissiles[i].planetOrigin !== undefined) {
      smartMissiles[i].mesh3d.children[0].material.color.setHex(0xffcc00);  /* nose: bright yellow */
      smartMissiles[i].mesh3d.children[1].material.color.setHex(0xff8800);  /* body: orange */
      smartMissiles[i].mesh3d.children[2].material.color.setHex(0xffaa44);  /* engine: warm orange */
    } else {
      smartMissiles[i].mesh3d.children[0].material.color.setHex(0xaa44ff);  /* nose: purple */
      smartMissiles[i].mesh3d.children[1].material.color.setHex(0x7733cc);  /* body: dark purple */
      smartMissiles[i].mesh3d.children[2].material.color.setHex(0xaa66ff);  /* engine: purple */
    }

    var svx = smartMissiles[i].v.x;
    var svy = smartMissiles[i].v.y;
    var sSpeed = Math.sqrt(svx * svx + svy * svy);
    if (sSpeed > 0.1) {
      var sAngle = Math.atan2(svy, svx);
      smartMissiles[i].mesh3d.rotation.y = -sAngle + Math.PI / 2;
    }

    /* Flicker smart missile engine */
    var engine = smartMissiles[i].mesh3d.children[2];
    if (engine && engine.userData.isEngine) {
      engine.material.opacity = 0.5 + Math.random() * 0.5;
      var eScale = 0.8 + Math.random() * 0.6;
      engine.scale.set(eScale, eScale, eScale);
    }

    /* Smart missile trail — particles left behind at engine position */
    if (!smartMissiles[i].trailPoints) {
      var smTrailCount = 40;
      var smTrailGeo = new THREE.BufferGeometry();
      var smTrailPos = new Float32Array(smTrailCount * 3);
      var smTrailColors = new Float32Array(smTrailCount * 3);
      var smTrailAlive = new Float32Array(smTrailCount);
      var smTrailAlpha = new Float32Array(smTrailCount);
      for (var smti = 0; smti < smTrailCount; smti++) {
        smTrailPos[smti * 3] = 0; smTrailPos[smti * 3 + 1] = 0; smTrailPos[smti * 3 + 2] = 0;
        smTrailColors[smti * 3] = 1; smTrailColors[smti * 3 + 1] = 1; smTrailColors[smti * 3 + 2] = 1;
        smTrailAlive[smti] = 0;
        smTrailAlpha[smti] = 0;
      }
      smTrailGeo.setAttribute('position', new THREE.BufferAttribute(smTrailPos, 3));
      smTrailGeo.setAttribute('color', new THREE.BufferAttribute(smTrailColors, 3));
      smTrailGeo.setAttribute('alive', new THREE.BufferAttribute(smTrailAlive, 1));
      smTrailGeo.setAttribute('alpha', new THREE.BufferAttribute(smTrailAlpha, 1));
      smartMissiles[i].trailPoints = new THREE.Points(smTrailGeo, particleShaderMaterial);
      effectsGroup.add(smartMissiles[i].trailPoints);
      smartMissiles[i].trailData = [];
    }

    /* Engine position (behind missile) */
    var svx3 = smartMissiles[i].v.x;
    var svy3 = smartMissiles[i].v.y;
    var sSpd3 = Math.sqrt(svx3 * svx3 + svy3 * svy3);
    var smEx = p3d.x - (svx3 / sSpd3) * 3;
    var smEz = p3d.z - (svy3 / sSpd3) * 3;

    /* Add trail particle at engine position */
    var smTd = smartMissiles[i].trailData;
    smTd.unshift({
      x: smEx + (Math.random() - 0.5) * 2,
      z: smEz + (Math.random() - 0.5) * 2,
      life: 1.0
    });
    if (smTd.length > 40) smTd.length = 40;

    /* Update trail — particles stay, fade by age */
    var smTrailPositions = smartMissiles[i].trailPoints.geometry.attributes.position.array;
    var smTrailColors2 = smartMissiles[i].trailPoints.geometry.attributes.color.array;
    var smTrailAliveArr = smartMissiles[i].trailPoints.geometry.attributes.alive.array;
    var smTrailAlphaArr = smartMissiles[i].trailPoints.geometry.attributes.alpha.array;
    for (var smti = 0; smti < smTd.length; smti++) {
      smTrailPositions[smti * 3]     = smTd[smti].x;
      smTrailPositions[smti * 3 + 1] = WORLD_HEIGHT;
      smTrailPositions[smti * 3 + 2] = smTd[smti].z;
      smTd[smti].life -= 0.12;
      var sma = Math.max(0, smTd[smti].life);
      smTrailAliveArr[smti] = 1.0;
      smTrailAlphaArr[smti] = sma;
      /* Keep white color constant — alpha drives the fade */
      smTrailColors2[smti * 3]     = 1.0;
      smTrailColors2[smti * 3 + 1] = 1.0;
      smTrailColors2[smti * 3 + 2] = 1.0;
    }
    while (smTd.length > 0 && smTd[smTd.length - 1].life <= 0) smTd.pop();
    for (var smti = smTd.length; smti < 40; smti++) {
      smTrailAliveArr[smti] = 0.0;
      smTrailAlphaArr[smti] = 0.0;
    }
    smartMissiles[i].trailPoints.geometry.attributes.position.needsUpdate = true;
    smartMissiles[i].trailPoints.geometry.attributes.color.needsUpdate = true;
    smartMissiles[i].trailPoints.geometry.attributes.alive.needsUpdate = true;
    smartMissiles[i].trailPoints.geometry.attributes.alpha.needsUpdate = true;
  }

  /* --- Shield hits --- */
  for (var i = 0; i < shieldHits.length; i++) {
    if (!shieldHits[i].mesh3d) continue;

    if (!shieldHits[i].ex) {
      shieldHits[i].mesh3d.visible = false;
      continue;
    }

    shieldHits[i].mesh3d.visible = true;
    var sh = shieldHits[i];
    var shipRef = ships[sh.k];
    if (shipRef) {
      var p3d = gameTo3D(shipRef.s.x, shipRef.s.y);
      shieldHits[i].mesh3d.position.set(p3d.x, WORLD_HEIGHT, p3d.z);
    }

    var lifeRatio = shieldHits[i].e / 28;
    if (shieldHits[i].mesh3d.material) {
      shieldHits[i].mesh3d.material.opacity = (1 - lifeRatio) * 0.3;
    }
  }

  /* --- Final explosions (dynamic, created on ship death) --- */
  for (var fi = finalExplosions.length - 1; fi >= 0; fi--) {
    var fe = finalExplosions[fi];
    fe.userData.life--;

    var lifeRatio = 1 - fe.userData.life / fe.userData.maxLife;

    if (fe.userData.life <= 0) {
      effectsGroup.remove(fe);
      for (var fc = fe.children.length - 1; fc >= 0; fc--) {
        var child = fe.children[fc];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            for (var mi = 0; mi < child.material.length; mi++) child.material[mi].dispose();
          } else {
            child.material.dispose();
          }
        }
      }
      finalExplosions.splice(fi, 1);
      continue;
    }

    fe.visible = true;

    /* Animate blast ring and particles */
    for (var rc = 0; rc < fe.children.length; rc++) {
      var child = fe.children[rc];

      if (child.userData && child.userData.isBlastRing) {
        var ringScale = 1 + lifeRatio * 75;
        child.scale.set(ringScale, ringScale, ringScale);
        child.material.opacity = Math.max(0, 0.25 * (1 - lifeRatio * 15));
      }

      if (child.isPoints && child.userData.velocities) {
        var positions = child.geometry.attributes.position.array;
        var velocities = child.userData.velocities;
        for (var j = 0; j < velocities.length; j++) {
          positions[j * 3]     += velocities[j].x * 0.1;
          positions[j * 3 + 1] += velocities[j].y * 0.1;
          positions[j * 3 + 2] += velocities[j].z * 0.1;
        }
        child.geometry.attributes.position.needsUpdate = true;
        child.material.opacity = 1 - lifeRatio;
      }
    }
  }

  /* --- Per-ship dying spray (particles stored on each ship) --- */
  for (var shi = 0; shi < maxships; shi++) {
    var shp = ships[shi];
    if (!shp || !shp.sprayActive || !shp.sprayPoints) continue;

    var sPos = shp.sprayPositions;
    var sCol = shp.sprayColors;
    var sVel = shp.sprayVelocities;
    var sLife = shp.sprayLifetimes;
    var sprayAlive = shp.sprayAlive;
    var sprayAlpha = shp.sprayAlpha;
    var maxS = shp._sprayMaxSparks || 64;

    /* Emit sparks only if ship is still alive */
    if (shp.ex) {
      /* Compute rear position from ship heading */
      var sp3d = gameTo3D(shp.s.x, shp.s.y);
      var hx = shp.h.x, hy = shp.h.y;
      var hLen = Math.sqrt(hx * hx + hy * hy);
      if (hLen < 0.01) { hx = 1; hy = 0; hLen = 1; }
      var rearX = sp3d.x - (hx / hLen) * 3;
      var rearZ = sp3d.z - (hy / hLen) * 3;
      var sdx = -(hx / hLen);
      var sdz = -(hy / hLen);
      var vpX = shp.v.x * 0.8;
      var vpZ = shp.v.y * 0.8;

      /* Emit 3-5 sparks per frame */
      var emitCount = 3 + Math.floor(Math.random() * 3);
      for (var e = 0; e < emitCount; e++) {
        for (var sp = 0; sp < maxS; sp++) {
          if (sLife[sp] <= 0) {
            sPos[sp * 3]     = rearX;
            sPos[sp * 3 + 1] = WORLD_HEIGHT;
            sPos[sp * 3 + 2] = rearZ;
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.acos(2 * Math.random() - 1);
            var spd = 0.5 + Math.random() * 2;
            sVel[sp].x = spd * Math.sin(phi) * Math.cos(theta) + sdx * 4 + vpX;
            sVel[sp].y = spd * Math.sin(phi) * Math.sin(theta);
            sVel[sp].z = spd * Math.cos(phi) * Math.sin(phi) + sdz * 4 + vpZ;
            sLife[sp] = 10 + Math.random() * 16;
            break;
          }
        }
      }
    }

    /* Update all sparks — even after ship is gone */
    for (var sp2 = 0; sp2 < maxS; sp2++) {
      if (sLife[sp2] > 0) {
        sLife[sp2]--;
        sPos[sp2 * 3]     += sVel[sp2].x * 0.1;
        sPos[sp2 * 3 + 1] += sVel[sp2].y * 0.1;
        sPos[sp2 * 3 + 2] += sVel[sp2].z * 0.1;
        var lifeRatio = sLife[sp2] / 26;
        if (lifeRatio > 1) lifeRatio = 1;
        sprayAlive[sp2] = 1.0;
        sprayAlpha[sp2] = lifeRatio;
        /* Keep orange color constant — alpha handles the fade */
        sCol[sp2 * 3]     = 1.0;
        sCol[sp2 * 3 + 1] = 0.67;
        sCol[sp2 * 3 + 2] = 0.0;
      } else {
        sprayAlive[sp2] = 0.0;
        sprayAlpha[sp2] = 0.0;
      }
    }

    shp.sprayPoints.geometry.attributes.position.needsUpdate = true;
    shp.sprayPoints.geometry.attributes.color.needsUpdate = true;
    shp.sprayPoints.geometry.attributes.alive.needsUpdate = true;
    shp.sprayPoints.geometry.attributes.alpha.needsUpdate = true;
    shp.sprayPoints.visible = true;

    /* Auto-deactivate when all particles are dead and ship is not dying */
    var anyAlive = false;
    for (var _sa = 0; _sa < maxS; _sa++) {
      if (sLife[_sa] > 0) { anyAlive = true; break; }
    }
    if (!anyAlive && !shp.ex) {
      effectsGroup.remove(shp.sprayPoints);
      shp.sprayPoints.geometry.dispose();
      shp.sprayPoints = null;
      shp.sprayActive = false;
    }
  }
}

/*
 * Clean up old 3D effects — no-op now, effects are pre-allocated.
 */
function cleanupEffects3D() {
  /* nothing to clean up */
}

/*
 * Update 3D shield spheres around planets with active shields.
 */
function updateShields3D() {
  if (typeof shieldMeshes === 'undefined') return;

  var shieldTime = performance.now() * 0.001;

  for (var p = 0; p < maxpl; p++) {
    var hasShield = false;
    var maxHP = 0;
    var curHP = 0;

    /* Check all factions on this planet for active shields */
    for (var g = 0; g < 3; g++) {
      var k = planets[p].k[g];
      if (k.a >= 8 && k.shieldHP > 0) {
        hasShield = true;
        if (k.shieldHP > curHP) {
          curHP = k.shieldHP;
          maxHP = k.maxShieldHP;
        }
      }
    }

    if (hasShield) {
      if (!shieldMeshes[p]) {
        var geom = new THREE.SphereGeometry(150, 32, 32);
        shieldMeshes[p] = new THREE.Mesh(geom, shieldShaderMaterial.clone());
        effectsGroup.add(shieldMeshes[p]);
      }

      shieldMeshes[p].visible = true;
      var p3d = gameTo3D(planets[p].s.x, planets[p].s.y);
      shieldMeshes[p].position.set(p3d.x, PLANET_HEIGHT, p3d.z);

      var hpRatio = maxHP > 0 ? curHP / maxHP : 0;
      var mat = shieldMeshes[p].material;
      var uniforms = mat.uniforms;

      /* Update shader uniforms */
      uniforms.uTime.value = shieldTime;
      uniforms.uShieldHP.value = hpRatio;

      /* Update hit events from the planet's shieldHitEvents array */
      var hitEvents = planets[p].shieldHitEvents || [];
      var hitCount = Math.min(hitEvents.length, 5);
      uniforms.uHitCount.value = hitCount;

      /* Age hit events and remove expired ones (max age ~2.5 seconds) */
      var AGE_STEP = 0.033;  /* ~30 FPS */
      var MAX_AGE = 2.5;
      for (var ae = hitEvents.length - 1; ae >= 0; ae--) {
        hitEvents[ae].time += AGE_STEP;
        if (hitEvents[ae].time > MAX_AGE) {
          hitEvents.splice(ae, 1);
        }
      }
      /* Recalculate count after cleanup */
      hitCount = Math.min(hitEvents.length, 5);
      uniforms.uHitCount.value = hitCount;

      for (var h = 0; h < 5; h++) {
        var uPos = uniforms['uHitPos' + h];
        var uTime = uniforms['uHitTime' + h];
        if (h < hitCount && hitEvents[h]) {
          uPos.value.copy(hitEvents[h].pos);
          uTime.value = hitEvents[h].time;
        } else {
          uPos.value.set(0, 0, 0);
          uTime.value = 0;
        }
      }
    } else {
      if (shieldMeshes[p]) {
        shieldMeshes[p].visible = false;
      }
    }
  }
}
