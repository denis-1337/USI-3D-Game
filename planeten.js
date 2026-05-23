/* planeten.js — Core game logic: planet management, production, combat,
   ship movement, boarding, save/load, planet menu.
   Ported from fpc_port/src/planeten.pas (+ ai.pas for beweg/aufladen/searchgf).

   Dependencies (all globals loaded via <script> tags before this file):
     - constants.js  (maxships, maxpl, seite, pge, mut, soldaten, nlevel, ...)
     - globals.js    (bx, by, mouseX, mouseY, snr, pview, pnr, tickCount, ...)
     - entities.js   (ships, planets, factionStats, ammo, rockets, ...)
     - vec.js        (sv, addv, subv, mult, divi, lang, abstand, orth, ...)
   Rendering primitives (DrawLine, DrawText, etc.) come from renderer.js.
*/

/* ================================================================ */
/* maxpl constant — also in constants.js but defined here for safety */
/* ================================================================ */
var maxpl = 10;

/* ================================================================ */
/* Rendering functions are in renderer.js (loaded before this file) */
/* WorldToScreen, DrawLine, DrawRect, DrawFilledRect, DrawPixel,   */
/* DrawCircle, DrawText, SetDrawColor, initammo, initraks,         */
/* initsmart, initexplo, one — all defined in renderer.js           */
/* ================================================================ */

/* ================================================================ */
/* initdaten — Initialize game world: ships + planets               */
/* ================================================================ */
function initdaten() {
  var i, j, styp, faction;

  /* Planet names */
  var pname = [
    '', 'Nupto', 'Orion', 'Poletz', 'Byan', 'Leptis',
    'Kleks', 'Knopa', 'Schnief', 'Retil', 'Arantka'
  ];

  /* Initialize faction stats */
  for (i = 0; i < 3; i++) {
    factionStats[i].an = 0;
    factionStats[i].max = 85;
    factionStats[i].j = 0;
    factionStats[i].aj = 0;
    factionStats[i].b = 0;
    factionStats[i].t = 0;
  }

  /* Initialize 9 starting ships */
  for (i = 0; i < 9; i++) {
    styp = (i % 9) + 1;  /* cycle types 1..9 */

    /* Determine faction based on ship type */
    if (styp <= 3)       faction = 1;
    else if (styp <= 6)  faction = 2;
    else                 faction = 3;

    factionStats[faction - 1].an++;

    ships[i].ex = true;
    ships[i].typ = styp;
    ships[i].k = 0;
    ships[i].sprayActive = false;
    /* Remove old spray mesh from scene if it exists */
    if (ships[i].sprayPoints && typeof effectsGroup !== 'undefined') {
      effectsGroup.remove(ships[i].sprayPoints);
      ships[i].sprayPoints.geometry.dispose();
    }
    ships[i].sprayPoints = null;
    ships[i].gr = faction;
    ships[i].r = false;
    ships[i].f = false;
    ships[i].pl = false;
    ships[i].fn = 0;
    ships[i].ge = 0;
    ships[i].gf = 0;

    /* Set armor/shield/sx/pm based on type
     * Revised balance: Jäger is faster and more agile, Bomber is heavier and slower */
    if (styp === 1 || styp === 4 || styp === 7) {
      ships[i].panz = 80;        // reduced from 100 — light armor
      ships[i].shield = 40;      // reduced from 50 — light shield
      ships[i].sx = 35;          // reduced from 50 — lower per-shot damage
      ships[i].pm = 180;         // increased from 100 — much faster (evades better)
      factionStats[faction - 1].j++;
    } else if (styp === 2 || styp === 5 || styp === 8) {
      ships[i].panz = 110;       // reduced from 120 — moderate armor
      ships[i].shield = 60;      // reduced from 70 — moderate shield
      ships[i].sx = 55;          // reduced from 70 — moderate per-shot damage
      ships[i].pm = 150;         // increased from 120 — faster than bomber
      factionStats[faction - 1].aj++;
    } else {
      /* styp 3, 6, 9 — bomber */
      ships[i].panz = 180;       // increased from 150 — heavy armor
      ships[i].shield = 120;     // increased from 100 — heavy shield
      ships[i].sx = 120;         // increased from 100 — high per-shot damage
      ships[i].pm = 90;          // reduced from 150 — slow (easy to evade)
      factionStats[faction - 1].b++;
    }

    /* Set goal position based on faction */
    if (faction === 1)
      sv(ships[i].z, 200 + Math.floor(Math.random() * 100) - 50,
                 200 + Math.floor(Math.random() * 100) - 50);
    else if (faction === 2)
      sv(ships[i].z, 3800 + Math.floor(Math.random() * 100) - 50,
                  500 + Math.floor(Math.random() * 100) - 50);
    else
      sv(ships[i].z, 1000 + Math.floor(Math.random() * 100) - 50,
                  3800 + Math.floor(Math.random() * 100) - 50);

    /* Position ship at its goal */
    sv(ships[i].s, ships[i].z.x, ships[i].z.y);

    /* Velocity starts horizontal */
    sv(ships[i].v, 10, 0);
    /* Heading follows velocity direction */
    sv(ships[i].h, 10, 0);
    ships[i].m = 0;
    ships[i].nr = 0;
    ships[i].ge = 0;
    ships[i].f = false;
  }

  /* Initialize 10 planets */
  var MIN_PLANET_DIST = 400;  // minimum distance between planet centers (5x planet diameter)
  for (i = 0; i < maxpl; i++) {
    planets[i].name = pname[i + 1];
    planets[i].e = true;
    planets[i].war = false;
    planets[i].a = 0;
    planets[i].shieldHitEvents = [];  /* Visual hit events for the shader */

    /* Random position within game world, ensuring minimum distance from other planets */
    var placed = false;
    var attempts = 0;
    while (!placed && attempts < 200) {
      var px = 100 + Math.floor(Math.random() * (seite - 200));
      var py = 100 + Math.floor(Math.random() * (seite - 200));
      placed = true;
      for (j = 0; j < i; j++) {
        var dx = px - planets[j].s.x;
        var dy = py - planets[j].s.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_PLANET_DIST) {
          placed = false;
          break;
        }
      }
      attempts++;
    }
    planets[i].s.x = px;
    planets[i].s.y = py;

    /* All sectors start neutral (color 8) */
    for (j = 0; j < 8; j++)
      planets[i].f[j] = 8;

    /* Initialize colonies for all 3 factions */
    for (j = 0; j < 3; j++) {
      planets[i].k[j].a = 0;
      planets[i].k[j].inf = 0;
      planets[i].k[j].def = 0;
      planets[i].k[j].auf = 0;
      planets[i].k[j].x = 0;
      planets[i].k[j].max = 0;
      planets[i].k[j].m = 0;
      planets[i].k[j].war = 0;
      planets[i].k[j].f = 50 + Math.floor(Math.random() * 50);
      planets[i].k[j].f2 = false;
      planets[i].k[j].gf = 0;
      planets[i].k[j].fn = 0;
      planets[i].k[j].shieldHP = 0;
      planets[i].k[j].maxShieldHP = 0;
      planets[i].k[j].missileCooldown = 0;
      planets[i].k[j].activeMissiles = 0;
    }
  }
}

/* ================================================================ */
/* kampf — Calculate colony combat strength                         */
/* Returns a random value up to the calculated combat power.        */
/* ================================================================ */
function kampf(k) {
  var c;

  /* Cap infantry and defense */
  if (k.inf > 200) k.inf = 200;
  if (k.def > 2) k.def = 2;

  /* Attack vs defend formulas */
  if (k.war === 1)
    c = Math.trunc(k.inf * (1 + k.f / 100));
  else
    c = Math.trunc(k.inf * (1 + k.f / 100) * 1.25) + 25 * k.def;

  /* No production gives +25% combat bonus */
  if (k.auf === 0)
    c = Math.trunc(c * 1.25);

  /* Return random value up to calculated strength */
  return Math.floor(Math.random() * Math.max(c, 1));
}

/* ================================================================ */
/* pkampf — Planet combat resolution                                */
/* ================================================================ */
function pkampf(p) {
  var a, b, e, i5;
  var c, c1, c2, d;

  /* Need more than 1 faction present on planet */
  if (p.a > 1) {
    c = 1000000;
    c1 = 1000000;
    c2 = 1000000;
    b = 0;
    e = 0;

    /* If any faction has only 1 infantry, force them to peace */
    for (a = 0; a < 3; a++)
      if (p.k[a].inf === 1)
        p.k[a].war = 0;

    /* Count attacking factions */
    for (a = 0; a < 3; a++)
      b += p.k[a].war;

    /* Count active factions */
    for (a = 0; a < 3; a++)
      if (p.k[a].a > 0)
        e++;

    /* War if at least one attacker and more than one faction present */
    if (b > 0 && e > 1)
      p.war = true;
    else
      p.war = false;

    if (p.war) {
      /* Calculate combat strength for each faction present */
      if (p.k[0].a > 0)
        c = kampf(p.k[0]);
      if (p.k[1].a > 0)
        c1 = kampf(p.k[1]);
      if (p.k[2].a > 0)
        c2 = kampf(p.k[2]);

      /* Find faction with LOWEST combat strength — they lose */
      if (c > c1) { d = c1; a = 1; }
      else         { d = c;  a = 0; }
      if (d > c2)
        a = 2;

      /* Loser loses 1 infantry, but don't allow negative values */
      if (p.k[a].inf > 0)
        p.k[a].inf--;

      /* If defending and has >1 sectors, 3% chance to lose sector + fort */
      if (p.k[a].war === 0 && Math.floor(Math.random() * 100) < 3 && p.k[a].a > 1) {
        p.k[a].a--;
        p.a--;

        /* Determine faction color to recolor */
        if (a === 0) b = 11;
        else if (a === 1) b = 10;
        else b = 15;

        /* Recolor one sector back to neutral (8) */
        for (i5 = 0; i5 < 8; i5++)
          if (p.f[i5] === b) {
            p.f[i5] = 8;
            break;
          }

        /* Possibly lose a fort too */
        if (p.k[a].def > 0)
          p.k[a].def--;
      }

      /* If loser's infantry reaches 0 or below, fully remove faction from planet */
      if (p.k[a].inf <= 0) {
        e = p.k[a].f;  /* save living conditions */

        /* Remove all sectors */
        p.a -= p.k[a].a;

        /* Clear faction data */
        p.k[a].a = 0;
        p.k[a].inf = 0;
        p.k[a].def = 0;
        p.k[a].auf = 0;
        p.k[a].x = 0;
        p.k[a].max = 0;
        p.k[a].m = 0;
        p.k[a].war = 0;
        p.k[a].f = e;
        p.k[a].f2 = false;
        p.k[a].gf = 0;
        p.k[a].fn = 0;
        p.k[a].shieldHP = 0;
        p.k[a].maxShieldHP = 0;
        p.k[a].missileCooldown = 0;
        p.k[a].activeMissiles = 0;
        p.k[a].rocketAmmo = 0;

        /* Recolor all their sectors to neutral */
        if (a === 0) b = 11;
        else if (a === 1) b = 10;
        else b = 15;

        for (i5 = 0; i5 < 8; i5++)
          if (p.f[i5] === b)
            p.f[i5] = 8;

        /* Recalculate war status */
        b = 0;
        e = 0;
        for (a = 0; a < 3; a++)
          b += p.k[a].war;

        for (a = 0; a < 3; a++)
          if (p.k[a].a > 0)
            e++;

        if (b > 0 && e > 1)
          p.war = true;
        else
          p.war = false;
      }
    }
  }
}

/* ================================================================ */
/* showplanet — Render all planets on screen                        */
/* ================================================================ */
function showplanet() {
  var i;

  for (i = 0; i < maxpl; i++) {
    /* Update 3D planet mesh sector colors — only when ownership changed */
    if (planetMeshes[i] && planetMeshes[i].body) {
      updatePlanetTexture(i);
    }

    /* If in planet view mode and this is the selected planet, draw highlight ring on overlay */
    if (pview && (pnr === (i + 1))) {
      var screenPos = WorldToScreen(planets[i].s.x, planets[i].s.y);
      DrawCircle(Math.trunc(screenPos.x), Math.trunc(screenPos.y), 40, 15);
    }
  }
}

/* Update planet texture to reflect current sector ownership */
/* Only redraw when sector ownership actually changed */
var _planetPrevF = [];  /* Legacy — kept for compatibility, no longer used */

function updatePlanetTexture(index) {
  /* Planet texture is now static (randomized surface generated at creation).
     Sector ownership is shown by the 3D sector bar above the planet instead. */
}

/* ================================================================ */
/* newship — Spawn a new ship near position p for faction a         */
/* typ: 3=jager, 4=transporter, 5=adv jager, 7=bomber               */
/* ================================================================ */
function newship(p, a, typ) {
  var i, finalType;

  /* Map category to actual ship type based on faction */
  if (typ === 3) {        /* jager */
    if (a === 1) finalType = 1;
    else if (a === 2) finalType = 4;
    else finalType = 7;
  } else if (typ === 4) { /* transporter */
    if (a === 1) finalType = 10;
    else if (a === 2) finalType = 11;
    else finalType = 12;
  } else if (typ === 5) { /* advanced jager */
    if (a === 1) finalType = 2;
    else if (a === 2) finalType = 5;
    else finalType = 8;
  } else if (typ === 7) { /* bomber */
    if (a === 1) finalType = 3;
    else if (a === 2) finalType = 6;
    else finalType = 9;
  } else {
    finalType = typ;
  }

  /* Find a free slot in the ship array */
  for (i = 0; i < maxships; i++) {
    if (!ships[i].ex) {
      ships[i].ex = true;
      ships[i].typ = finalType;
      ships[i].sprayActive = false;
      /* Remove old spray mesh from scene if it exists */
      if (ships[i].sprayPoints && typeof effectsGroup !== 'undefined') {
        effectsGroup.remove(ships[i].sprayPoints);
        ships[i].sprayPoints.geometry.dispose();
      }
      ships[i].sprayPoints = null;

      /* Determine faction from type */
      if (finalType <= 3 || finalType === 10)
        ships[i].gr = 1;
      else if (finalType >= 4 && finalType <= 6 || finalType === 11)
        ships[i].gr = 2;
      else if (finalType >= 7 && finalType <= 9 || finalType === 12)
        ships[i].gr = 3;
      else
        ships[i].gr = a;

      /* Set stats based on type
       * Revised balance: Jäger is faster and more agile, Bomber is heavier and slower */
      if (finalType === 1 || finalType === 4 || finalType === 7) {
        ships[i].panz = 80;
        ships[i].shield = 40;
        ships[i].sx = 35;
        ships[i].pm = 180;
      } else if (finalType === 2 || finalType === 5 || finalType === 8) {
        ships[i].panz = 110;
        ships[i].shield = 60;
        ships[i].sx = 55;
        ships[i].pm = 150;
      } else if (finalType === 3 || finalType === 6 || finalType === 9) {
        ships[i].panz = 180;
        ships[i].shield = 120;
        ships[i].sx = 120;
        ships[i].pm = 90;
      } else if (finalType >= 10 && finalType <= 12) {
        ships[i].panz = 300;
        ships[i].shield = 150;
        ships[i].sx = 150;
        ships[i].pm = 300;
      } else {
        ships[i].panz = 100;
        ships[i].shield = 50;
        ships[i].sx = 50;
        ships[i].pm = 100;
      }

      /* Increment faction ship type counters */
      var g = ships[i].gr - 1;
      if (finalType === 1 || finalType === 4 || finalType === 7) factionStats[g].j++;
      else if (finalType === 2 || finalType === 5 || finalType === 8) factionStats[g].aj++;
      else if (finalType === 3 || finalType === 6 || finalType === 9) factionStats[g].b++;
      else if (finalType >= 10 && finalType <= 12) factionStats[g].t++;
      factionStats[g].an++;

      ships[i].v.x = 10;
      ships[i].v.y = 0;
      ships[i].h.x = 10;
      ships[i].h.y = 0;

      /* Position near planet with random offset */
      ships[i].s.x = p.x + Math.floor(Math.random() * 200) - 100;
      ships[i].s.y = p.y + Math.floor(Math.random() * 200) - 100;

      /* Goal near ship's own position */
      ships[i].z.x = ships[i].s.x + Math.floor(Math.random() * 100) - 50;
      ships[i].z.y = ships[i].s.y + Math.floor(Math.random() * 100) - 50;

      /* Reset flags */
      ships[i].k = 0;
      ships[i].r = false;
      ships[i].ge = 0;
      ships[i].nr = 0;
      ships[i].gf = 0;
      ships[i].m = 0;
      ships[i].fn = 0;
      ships[i].f = false;
      ships[i].pl = false;

      /* --- Spawn retreat: only flee if spawning directly inside an enemy
         defended planet's range, and no friendly ships are already there to
         absorb the initial fire. */
      if (finalType < 10) {
        var myFaction = ships[i].gr;

        for (var sp = 0; sp < maxpl; sp++) {
          var plDist = abstand(ships[i].s, planets[sp].s);

          /* Only flee if spawning dangerously close (inside cannon range) */
          if (plDist > 250) continue;
          if (plDist < 50) continue;  /* own planet, skip */

          /* Check if this nearby planet is defended by an enemy faction */
          var enemyDefended = false;
          for (var spg = 0; spg < 3; spg++) {
            if (spg + 1 === myFaction) continue;
            if (planets[sp].k[spg].a >= 7) {
              enemyDefended = true;
              break;
            }
          }
          if (!enemyDefended) continue;

          /* Check if friendly ships are already parked nearby — if so,
             this ship can stay and join them */
          var friendlyNearby = false;
          for (var ns = 0; ns < maxships; ns++) {
            if (ns === i) continue;
            if (!ships[ns].ex || ships[ns].gr !== myFaction) continue;
            if (abstand(ships[i].s, ships[ns].s) < 150) {
              friendlyNearby = true;
              break;
            }
          }

          /* Only flee if we're the first ship and in immediate danger */
          if (!friendlyNearby) {
            var fdx = ships[i].s.x - planets[sp].s.x;
            var fdy = ships[i].s.y - planets[sp].s.y;
            var fd = Math.sqrt(fdx * fdx + fdy * fdy);
            if (fd < 1) fd = 1;
            ships[i].z.x = ships[i].s.x + (fdx / fd) * 300;
            ships[i].z.y = ships[i].s.y + (fdy / fd) * 300;
            ships[i].f = true;
            break;
          }
        }
      }

      /* Per-ship dying spray — initialized in entities.js createShip() */

      break;  /* Done — found and filled a slot */
    }
  }
}

/* ================================================================ */
/* produktion — Process production queues for each faction on planet */
/* ================================================================ */
function produktion(p) {
  var i1, i5;

  /* Only process if at least one faction present */
  if (p.a > 0) {
    for (i1 = 0; i1 < 3; i1++) {
      if (p.k[i1].a > 0) {
        /* If game ended, block player's production */
        if ((gameWon || gameLost) && (i1 + 1 === snr)) {
          p.k[i1].auf = 0;
          continue;
        }

        /* No batch quantity = no production */
        if (p.k[i1].m === 0)
          p.k[i1].auf = 0;

        if (p.k[i1].auf > 0) {
          /* Constant +1 per tick */
          p.k[i1].x++;

          if (p.k[i1].x === p.k[i1].max) {
            switch (p.k[i1].auf) {
              case 1: /* Level up — gain a sector */
                if (p.a < 8) {
                  p.a++;
                  p.k[i1].a++;

                  if (p.a === 8)
                    p.k[i1].m = 1;

                  /* Color a free sector with faction color */
                  for (i5 = 0; i5 < 8; i5++) {
                    if (p.f[i5] === 8) {
                      if (i1 === 0) p.f[i5] = 11;
                      else if (i1 === 1) p.f[i5] = 10;
                      else p.f[i5] = 15;
                      break;
                    }
                  }
                }
                break;

              case 2: /* Soldiers — +50 per batch */
                p.k[i1].inf += 50;

                /* Adjust m based on planet capacity formula */
                if ((p.k[i1].m - 1) * 50 > p.k[i1].a * 200 - p.k[i1].inf)
                  p.k[i1].m = Math.floor((p.k[i1].a * 200 - p.k[i1].inf) / 50) + 1;
                break;

              case 3: /* Jager ship */
                if (factionStats[i1].an < factionStats[i1].max)
                  newship(p.s, i1 + 1, 3);
                else
                  p.k[i1].m = 1;
                break;

              case 4: /* Transporter — requires 100 infantry */
                if (factionStats[i1].an < factionStats[i1].max && p.k[i1].inf >= 100) {
                  newship(p.s, i1 + 1, 4);
                  p.k[i1].inf -= 100;
                  if (p.k[i1].inf < 0) p.k[i1].inf = 0;
                } else {
                  p.k[i1].m = 1;
                }
                break;

              case 5: /* Advanced Jager ship */
                if (factionStats[i1].an < factionStats[i1].max)
                  newship(p.s, i1 + 1, 5);
                else
                  p.k[i1].m = 1;
                break;

              case 6: /* Forts — limited by sector count */
                if (p.k[i1].a > p.k[i1].def)
                  p.k[i1].def++;
                else
                  p.k[i1].m = 1;
                break;

              case 7: /* Bomber ship */
                if (factionStats[i1].an < factionStats[i1].max)
                  newship(p.s, i1 + 1, 7);
                else
                  p.k[i1].m = 1;
                break;
            }

            /* Reset progress and decrement batch count */
            p.k[i1].x = 0;
            if (p.k[i1].m > 0)
              p.k[i1].m--;
            /* If no more batches, clear the order to avoid underflow */
            if (p.k[i1].m <= 0) {
              p.k[i1].m = 0;
              p.k[i1].auf = 0;
            }
          }
        }
      }
    }
  }
}

/* ================================================================ */
/* prodstand — Draw production progress bar above planet on map     */
/* ================================================================ */
function prodstand(p) {
  // Now rendered in 3D by updatePlanetProdBar3D()
}

function live(p) {
  // Now rendered in 3D by updatePlanetBars3D()
}

/* ================================================================ */
/* mausinfeld — check if mouse is inside a rectangle                */
/* ================================================================ */
function mausinfeld(x1, y1, x2, y2) {
  return (mouseX >= x1) && (mouseX <= x2) && (mouseY >= y1) && (mouseY <= y2);
}

/* ================================================================ */
/* planettest — Check if mouse is over any planet                   */
/* Sets mb to planet index (1-based) and pview if player owns it.   */
/* ================================================================ */
function planettest() {
  var i;
  var sx, sy;
  var x1, y1, x2, y2;
  var hitRadius;

  mb = 0;
  for (i = 0; i < maxpl; i++) {
    sx = worldToScreen3D(planets[i].s.x, planets[i].s.y, PLANET_HEIGHT).x;
    sy = worldToScreen3D(planets[i].s.x, planets[i].s.y, PLANET_HEIGHT).y;

    hitRadius = getPlanetScreenRadius(planets[i].s.x, planets[i].s.y);

    x1 = Math.round(sx) - hitRadius;
    y1 = Math.round(sy) - hitRadius;
    x2 = Math.round(sx) + hitRadius;
    y2 = Math.round(sy) + hitRadius;

    if (mausinfeld(x1, y1, x2, y2)) {
      if (planets[i].k[snr - 1].a > 0) {
        pview = true;
        pnr = i + 1;
      }
      mb = i + 1;
      break;
    }
  }
}

/* ================================================================ */
/* getPlanetScreenRadius — Calculate visual planet radius in pixels  */
/* Projects planet edge points to screen and measures the distance.  */
/* ================================================================ */
function getPlanetScreenRadius(wx, wy) {
  if (!camera || !renderer3D) return 30;

  var c3d = document.getElementById('gameCanvas3D');
  if (!c3d) return 30;

  /* Planet center in 3D — use PLANET_HEIGHT to match actual planet position */
  var center3D = new THREE.Vector3(wx - seite / 2, PLANET_HEIGHT, wy - seite / 2);
  center3D.project(camera);
  var rect3d = c3d.getBoundingClientRect();
  var cx = (center3D.x * 0.5 + 0.5) * c3d.width + (rect3d.left - GAME_AREA_X);
  var cy = (-center3D.y * 0.5 + 0.5) * c3d.height + (rect3d.top);

  /* Sample 4 edge points (planet radius = 40 in 3D) */
  var planetRadius = 40;
  var maxDist = 0;
  var dirs = [
    {dx: planetRadius, dy: 0},
    {dx: -planetRadius, dy: 0},
    {dx: 0, dy: planetRadius},
    {dx: 0, dy: -planetRadius}
  ];

  for (var d = 0; d < dirs.length; d++) {
    var edge3D = new THREE.Vector3(
      (wx + dirs[d].dx) - seite / 2,
      PLANET_HEIGHT,
      (wy + dirs[d].dy) - seite / 2
    );
    edge3D.project(camera);
    var ex = (edge3D.x * 0.5 + 0.5) * c3d.width + (rect3d.left - GAME_AREA_X);
    var ey = (-edge3D.y * 0.5 + 0.5) * c3d.height + (rect3d.top);
    var dist = Math.sqrt((ex - cx) * (ex - cx) + (ey - cy) * (ey - cy));
    if (dist > maxDist) maxDist = dist;
  }

  /* Clamp to reasonable range */
  if (maxDist < 15) maxDist = 15;
  if (maxDist > 100) maxDist = 100;
  return Math.round(maxDist);
}

/* ================================================================ */
/* planettest_at — Check if given coords are over a planet          */
/* Same logic as planettest, but uses (mx,my) instead of mouseX/Y.  */
/* ================================================================ */
function planettest_at(mx, my) {
  var i;
  var sx, sy;

  mb = 0;
  for (i = 0; i < maxpl; i++) {
    sx = worldToScreen3D(planets[i].s.x, planets[i].s.y, PLANET_HEIGHT).x;
    sy = worldToScreen3D(planets[i].s.x, planets[i].s.y, PLANET_HEIGHT).y;
    var hitRadius = getPlanetScreenRadius(planets[i].s.x, planets[i].s.y);

    if (mx >= Math.round(sx) - hitRadius &&
        mx <= Math.round(sx) + hitRadius &&
        my >= Math.round(sy) - hitRadius &&
        my <= Math.round(sy) + hitRadius) {
      if (planets[i].k[snr - 1].a > 0) {
        pview = true;
        pnr = i + 1;
      }
      mb = i + 1;
      break;
    }
  }
}

/* ================================================================ */
/* speichernladen — Save (mode=1) or load (mode=2) to localStorage  */
/* ================================================================ */
function speichernladen(mode) {
  var SAVE_KEY = 'usi_savegame';
  var magic = 'USIFPC01';

  if (mode === 1) {
    /* ----- SAVE ----- */
    var data = {
      magic: magic,
      ships: [],
      planets: [],
      factionStats: [],
      ammo: [],
      rockets: [],
      smartMissiles: [],
      explosions: [],
      shieldHits: [],
      camX: bx,
      camY: by,
      playerFaction: snr,
      pviewFlag: pview,
      pnrVal: pnr,
      befehlFlag: befehl,
      rahmenFlag: rahmen,
      rxVal: rx,
      ryVal: ry,
      mouseX: mouseX,
      mouseY: mouseY,
      page: page,
      frameCount: frameCount,
      tickCount: tickCount
    };

    /* Serialize ships */
    for (var i = 0; i < maxships; i++) {
      data.ships.push({
        ex: ships[i].ex,
        s: { x: ships[i].s.x, y: ships[i].s.y },
        v: { x: ships[i].v.x, y: ships[i].v.y },
        z: { x: ships[i].z.x, y: ships[i].z.y },
        k: ships[i].k,
        m: ships[i].m,
        typ: ships[i].typ,
        gr: ships[i].gr,
        ge: ships[i].ge,
        nr: ships[i].nr,
        fn: ships[i].fn,
        r: ships[i].r,
        panz: ships[i].panz,
        shield: ships[i].shield,
        sx: ships[i].sx,
        pm: ships[i].pm,
        h: { x: ships[i].h.x, y: ships[i].h.y },
        gf: ships[i].gf,
        pl: ships[i].pl,
        f: ships[i].f
      });
    }

    /* Serialize planets */
    for (var i = 0; i < maxpl; i++) {
      data.planets.push({
        s: { x: planets[i].s.x, y: planets[i].s.y },
        name: planets[i].name,
        f: planets[i].f.slice(),
        a: planets[i].a,
        e: planets[i].e,
        war: planets[i].war,
        k: planets[i].k.map(function (col) {
          return {
            a: col.a, inf: col.inf, def: col.def, auf: col.auf,
            x: col.x, max: col.max, m: col.m, war: col.war,
            f: col.f, f2: col.f2, gf: col.gf, fn: col.fn,
            shieldHP: col.shieldHP, maxShieldHP: col.maxShieldHP,
            missileCooldown: col.missileCooldown, activeMissiles: col.activeMissiles,
            rocketAmmo: col.rocketAmmo, rocketReloadTimer: col.rocketReloadTimer
          };
        })
      });
    }

    /* Serialize faction stats */
    for (var i = 0; i < 3; i++) {
      data.factionStats.push({
        an: factionStats[i].an,
        max: factionStats[i].max,
        j: factionStats[i].j,
        aj: factionStats[i].aj,
        b: factionStats[i].b,
        t: factionStats[i].t
      });
    }

    /* Serialize effects (projectiles, rockets, smart missiles, explosions, shield hits) */
    for (var i = 0; i < ammo.length; i++) {
      data.ammo.push({ ex: ammo[i].ex, x: ammo[i].x, y: ammo[i].y, dx: ammo[i].dx, dy: ammo[i].dy, f: ammo[i].f, gf: ammo[i].gf, fn: ammo[i].fn, r: ammo[i].r, t: ammo[i].t });
    }
    for (var i = 0; i < rockets.length; i++) {
      data.rockets.push({ ex: rockets[i].ex, x: rockets[i].x, y: rockets[i].y, dx: rockets[i].dx, dy: rockets[i].dy, f: rockets[i].f, gf: rockets[i].gf, fn: rockets[i].fn, r: rockets[i].r, t: rockets[i].t, z: rockets[i].z, typ: rockets[i].typ, n: rockets[i].n, d: rockets[i].d });
    }
    for (var i = 0; i < smartMissiles.length; i++) {
      data.smartMissiles.push({ ex: smartMissiles[i].ex, x: smartMissiles[i].x, y: smartMissiles[i].y, dx: smartMissiles[i].dx, dy: smartMissiles[i].dy, f: smartMissiles[i].f, gf: smartMissiles[i].gf, fn: smartMissiles[i].fn, r: smartMissiles[i].r, t: smartMissiles[i].t, z: smartMissiles[i].z, typ: smartMissiles[i].typ, n: smartMissiles[i].n, d: smartMissiles[i].d });
    }
    for (var i = 0; i < explosions.length; i++) {
      data.explosions.push({ ex: explosions[i].ex, x: explosions[i].x, y: explosions[i].y, dx: explosions[i].dx, dy: explosions[i].dy, t: explosions[i].t, f: explosions[i].f, r: explosions[i].r });
    }
    for (var i = 0; i < shieldHits.length; i++) {
      data.shieldHits.push({ ex: shieldHits[i].ex, x: shieldHits[i].x, y: shieldHits[i].y, dx: shieldHits[i].dx, dy: shieldHits[i].dy, t: shieldHits[i].t, f: shieldHits[i].f, r: shieldHits[i].r });
    }

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      saveFlashTick = 90;  /* Show flash for ~3 seconds (30 FPS * 3) */
    } catch (e) {
      /* Silently handle save errors */
    }

  } else if (mode === 2) {
    /* ----- LOAD ----- */
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return;
    }

    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (data.magic !== magic) {
      return;
    }

    /* Restore ships */
    for (var i = 0; i < maxships && i < data.ships.length; i++) {
      var sd = data.ships[i];
      ships[i].ex = sd.ex;
      sv(ships[i].s, sd.s.x, sd.s.y);
      sv(ships[i].v, sd.v.x, sd.v.y);
      sv(ships[i].z, sd.z.x, sd.z.y);
      ships[i].k = sd.k;
      ships[i].m = sd.m;
      ships[i].typ = sd.typ;
      ships[i].gr = sd.gr;
      ships[i].ge = sd.ge;
      ships[i].nr = sd.nr;
      ships[i].fn = sd.fn;
      ships[i].r = sd.r;
      ships[i].panz = sd.panz;
      ships[i].shield = sd.shield;
      ships[i].sx = sd.sx;
      ships[i].pm = sd.pm;
      sv(ships[i].h, sd.h.x, sd.h.y);
      ships[i].gf = sd.gf;
      ships[i].pl = sd.pl;
      ships[i].f = sd.f;
    }

    /* Restore planets */
    for (var i = 0; i < maxpl && i < data.planets.length; i++) {
      var pd = data.planets[i];
      sv(planets[i].s, pd.s.x, pd.s.y);
      planets[i].name = pd.name;
      for (var j = 0; j < 8; j++) planets[i].f[j] = pd.f[j];
      planets[i].a = pd.a;
      planets[i].e = pd.e;
      planets[i].war = pd.war;
      planets[i].shieldHitEvents = [];
      for (var j = 0; j < 3; j++) {
        var cd = pd.k[j];
        planets[i].k[j].a = cd.a;
        planets[i].k[j].inf = cd.inf;
        planets[i].k[j].def = cd.def;
        planets[i].k[j].auf = cd.auf;
        planets[i].k[j].x = cd.x;
        planets[i].k[j].max = cd.max;
        planets[i].k[j].m = cd.m;
        planets[i].k[j].war = cd.war;
        planets[i].k[j].f = cd.f;
        planets[i].k[j].f2 = cd.f2;
        planets[i].k[j].gf = cd.gf;
        planets[i].k[j].fn = cd.fn;
        planets[i].k[j].shieldHP = cd.shieldHP || 0;
        planets[i].k[j].maxShieldHP = cd.maxShieldHP || 0;
        planets[i].k[j].missileCooldown = cd.missileCooldown || 0;
        planets[i].k[j].activeMissiles = cd.activeMissiles || 0;
        planets[i].k[j].rocketAmmo = cd.rocketAmmo || 0;
        planets[i].k[j].rocketReloadTimer = cd.rocketReloadTimer || 0;
      }
    }

    /* Restore faction stats */
    for (var i = 0; i < 3 && i < data.factionStats.length; i++) {
      var fsd = data.factionStats[i];
      factionStats[i].an = fsd.an;
      factionStats[i].max = fsd.max;
      factionStats[i].j = fsd.j;
      factionStats[i].aj = fsd.aj;
      factionStats[i].b = fsd.b;
      factionStats[i].t = fsd.t;
    }

    /* Restore effects */
    if (data.ammo) {
      for (var i = 0; i < ammo.length && i < data.ammo.length; i++) {
        var ad = data.ammo[i];
        ammo[i].ex = ad.ex; ammo[i].x = ad.x; ammo[i].y = ad.y;
        ammo[i].dx = ad.dx; ammo[i].dy = ad.dy; ammo[i].f = ad.f;
        ammo[i].gf = ad.gf; ammo[i].fn = ad.fn; ammo[i].r = ad.r; ammo[i].t = ad.t;
      }
    }
    if (data.rockets) {
      for (var i = 0; i < rockets.length && i < data.rockets.length; i++) {
        var rd = data.rockets[i];
        rockets[i].ex = rd.ex; rockets[i].x = rd.x; rockets[i].y = rd.y;
        rockets[i].dx = rd.dx; rockets[i].dy = rd.dy; rockets[i].f = rd.f;
        rockets[i].gf = rd.gf; rockets[i].fn = rd.fn; rockets[i].r = rd.r;
        rockets[i].t = rd.t; rockets[i].z = rd.z; rockets[i].typ = rd.typ;
        rockets[i].n = rd.n; rockets[i].d = rd.d;
      }
    }
    if (data.smartMissiles) {
      for (var i = 0; i < smartMissiles.length && i < data.smartMissiles.length; i++) {
        var sd = data.smartMissiles[i];
        smartMissiles[i].ex = sd.ex; smartMissiles[i].x = sd.x; smartMissiles[i].y = sd.y;
        smartMissiles[i].dx = sd.dx; smartMissiles[i].dy = sd.dy; smartMissiles[i].f = sd.f;
        smartMissiles[i].gf = sd.gf; smartMissiles[i].fn = sd.fn; smartMissiles[i].r = sd.r;
        smartMissiles[i].t = sd.t; smartMissiles[i].z = sd.z; smartMissiles[i].typ = sd.typ;
        smartMissiles[i].n = sd.n; smartMissiles[i].d = sd.d;
      }
    }
    if (data.explosions) {
      for (var i = 0; i < explosions.length && i < data.explosions.length; i++) {
        var ed = data.explosions[i];
        explosions[i].ex = ed.ex; explosions[i].x = ed.x; explosions[i].y = ed.y;
        explosions[i].dx = ed.dx; explosions[i].dy = ed.dy;
        explosions[i].t = ed.t; explosions[i].f = ed.f; explosions[i].r = ed.r;
      }
    }
    if (data.shieldHits) {
      for (var i = 0; i < shieldHits.length && i < data.shieldHits.length; i++) {
        var shd = data.shieldHits[i];
        shieldHits[i].ex = shd.ex; shieldHits[i].x = shd.x; shieldHits[i].y = shd.y;
        shieldHits[i].dx = shd.dx; shieldHits[i].dy = shd.dy;
        shieldHits[i].t = shd.t; shieldHits[i].f = shd.f; shieldHits[i].r = shd.r;
      }
    }

    /* Restore camera, UI, misc */
    bx = data.camX;
    by = data.camY;
    snr = data.playerFaction;
    pview = data.pviewFlag;
    pnr = data.pnrVal;
    befehl = data.befehlFlag;
    rahmen = data.rahmenFlag;
    rx = data.rxVal;
    ry = data.ryVal;
    mouseX = data.mouseX;
    mouseY = data.mouseY;
    page = data.page;
    frameCount = data.frameCount;
    tickCount = data.tickCount;

    /* Reset 3D ship meshes so they are recreated with correct ship types */
    for (var mi = 0; mi < shipMeshes.length; mi++) {
      if (shipMeshes[mi]) {
        disposeThreeObject(shipMeshes[mi]);
        shipsGroup.remove(shipMeshes[mi]);
      }
    }
    shipMeshes = [];

    /* Reset trail data on rockets and smart missiles (not saved in game state) */
    for (var ti = 0; ti < rockets.length; ti++) {
      if (rockets[ti].trailPoints) {
        if (typeof effectsGroup !== 'undefined') effectsGroup.remove(rockets[ti].trailPoints);
        rockets[ti].trailPoints.geometry.dispose();
        rockets[ti].trailPoints = null;
      }
      rockets[ti].trailData = null;
    }
    for (var ti = 0; ti < smartMissiles.length; ti++) {
      if (smartMissiles[ti].trailPoints) {
        if (typeof effectsGroup !== 'undefined') effectsGroup.remove(smartMissiles[ti].trailPoints);
        smartMissiles[ti].trailPoints.geometry.dispose();
        smartMissiles[ti].trailPoints = null;
      }
      smartMissiles[ti].trailData = null;
    }

    loadFlashTick = 90;  /* Show flash for ~3 seconds */
  }
}

/* ================================================================ */
/* recordShieldHit — Record a visual hit event on the planet shield */
/* ================================================================ */
function recordShieldHit(planetIdx, shipPos) {
  if (!planets[planetIdx]) return;
  var events = planets[planetIdx].shieldHitEvents;
  if (!events) return;

  /* Compute direction from planet center to ship in 3D local space.
     Ships orbit at PLANET_HEIGHT, so the hit is on the sphere's equator
     relative to the ship's horizontal direction. We store a normalized
     direction vector in sphere-local coordinates (x=worldX, y=0, z=worldY). */
  var plPos = planets[planetIdx].s;
  var dx = shipPos.x - plPos.x;
  var dy = shipPos.y - plPos.y;
  var d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) d = 1;

  /* Normalized direction on the sphere surface (y=0 = equator) */
  var hitDir = { x: dx / d, y: 0, z: dy / d };

  var hit = {
    pos: hitDir,
    time: 0.01  /* start just after 0 so it's visible */
  };

  events.unshift(hit);
  while (events.length > 5) events.pop();
}

/* ================================================================ */
/* planetDefenses — Planet cannons & shield logic (Level 7+)       */
/* Called every tick from the game loop.                            */
/* ================================================================ */
function planetDefenses() {
  var CANON_RADIUS = 250;
  var CANON_COOLDOWN = 60;  /* 2 Sekunden (30 ticks/s * 2) */
  var SHIELD_RADIUS = 200;
  var SHIELD_DOT_TICKS = 10;   /* alle 10 Ticks = 0.33s */
  var SHIELD_DOT_DAMAGE = 6;   /* 6 Damage pro Treffer = ~18 HP/Sekunde */
  var SHIELD_HP_COST = 1;
  var SHIELD_REGEN_TICKS = 120; /* +1 HP alle 4 Sekunden */

  for (var p = 0; p < maxpl; p++) {
    /* Only planets with active war matter for cannons */
    var plPos = planets[p].s;

    for (var g = 0; g < 3; g++) {
      var k = planets[p].k[g];
      if (k.a === 0) continue;

      /* --- Shield HP initialization (Level 8+) --- */
      if (k.a >= 8) {
        if (k.maxShieldHP === 0) {
          k.maxShieldHP = k.a * 50;
          k.shieldHP = k.maxShieldHP;
        }
        /* Recalculate max if sectors increased — add bonus HP */
        var newMax = k.a * 50;
        if (newMax > k.maxShieldHP) {
          var oldMax = k.maxShieldHP;
          k.maxShieldHP = newMax;
          k.shieldHP = Math.min(k.shieldHP + (newMax - oldMax), newMax);
        }
      }

      /* --- Shield DoT (Level 8+) --- */
      if (k.a >= 8 && k.shieldHP > 0) {
        for (var i = 0; i < maxships; i++) {
          if (!ships[i].ex) continue;
          if (ships[i].gr === g + 1) continue; /* friendly */

          var dist = abstand(plPos, ships[i].s);
          if (dist < SHIELD_RADIUS) {
            if (tickCount % SHIELD_DOT_TICKS === 0) {
              ships[i].panz -= SHIELD_DOT_DAMAGE;
              k.shieldHP -= SHIELD_HP_COST;
              if (k.shieldHP < 0) k.shieldHP = 0;

              /* Record visual hit event for shader */
              recordShieldHit(p, ships[i].s);
            }
          }
        }
      }

      /* --- Shield regeneration --- */
      if (k.a >= 8 && k.shieldHP < k.maxShieldHP) {
        if (tickCount % SHIELD_REGEN_TICKS === 0) {
          k.shieldHP++;
          if (k.shieldHP > k.maxShieldHP) k.shieldHP = k.maxShieldHP;
        }
      }
    }

    /* --- Raketen-Verteidigung (Level 7+) — automatische Planetenverteidigung --- */
    /* Find defending colony with Level 7+ */
    var owner = -1;
    for (var g = 0; g < 3; g++) {
      if (planets[p].k[g].a >= 7) {
        owner = g;
        break;
      }
    }
    if (owner < 0) continue;

    var k = planets[p].k[owner];
    var hasShield = k.a >= 8;
    var maxAmmo = hasShield ? 3 : 2;  /* Level 7: max 2, Level 8: max 3 */

    /* Raketen-Vorrat begrenzen */
    k.rocketAmmo = Math.min(k.rocketAmmo || 0, maxAmmo);

    /* Nachladung: alle 150 Ticks (+5 Sekunden) eine Rakete nachladen */
    if ((k.rocketAmmo || 0) < maxAmmo) {
      if (!k.rocketReloadTimer) k.rocketReloadTimer = 0;
      k.rocketReloadTimer++;
      if (k.rocketReloadTimer >= 150) {
        k.rocketAmmo = (k.rocketAmmo || 0) + 1;
        k.rocketReloadTimer = 0;
      }
    }

    /* Cooldown decrement — ONCE per tick */
    if (k.missileCooldown > 0) {
      k.missileCooldown--;
    }

    /* Scan for enemy ships in range — fire at nearest target */
    var nearestIdx = -1;
    var nearestDist = CANON_RADIUS;
    for (var i = 0; i < maxships; i++) {
      if (!ships[i].ex) continue;
      if (ships[i].gr === owner + 1) continue; /* friendly */
      if (ships[i].panz <= 0) continue;         /* already burning/destroyed */

      var dist = abstand(plPos, ships[i].s);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    /* Fire smart missile at nearest enemy ship (nur wenn Vorrat > 0) */
    if (nearestIdx >= 0 && k.missileCooldown <= 0 && (k.rocketAmmo || 0) > 0) {
      initPlanetMissile(plPos, nearestIdx, owner + 1);
      k.missileCooldown = CANON_COOLDOWN;
      k.activeMissiles++;
      k.rocketAmmo--;  /* Rakete aus Vorrat abziehen */
    }
  }
}

/* ================================================================ */
/* pmenu — Draw planet detail menu panel                            */
/* ================================================================ */
function pmenu(p) {
  var i, j, shipColor;
  var k = p.k[snr - 1];  /* player's colony on this planet */
  var si2, x, y, barLen;
  var menuX, menuY;
  var mmX, mmY;
  var mmPanelW, mmPanelH;
  var effW, effH;
  var pX, pW;
  var mmPx, mmPy;
  var mm_effH, mm_y;
  var mm_by_scale, mm_div;

  var MENU_W = 500;
  var MENU_H = 340;

  /* Compute menu position: centered in game area */
  menuX = Math.floor((GameAreaWidth - MENU_W) / 2);
  menuY = Math.floor((GameAreaHeight - MENU_H) / 2);
  if (menuX < 0) menuX = 0;
  if (menuY < 0) menuY = 0;

  /* Right-side minimap position */
  pX = GameAreaWidth + 5;
  pW = curW - pX;
  if (pW < 40) pW = 40;

  mmX = pX;
  mmPanelW = pW;

  mmPanelH = 102;
  if (mmPanelH > curH) mmPanelH = curH;
  mmY = 0;

  /* ===== TOP ROW: Level + Planet name ===== */
  DrawText(menuX + 50, menuY + 20, 'Level', 7);
  DrawText(menuX + 100, menuY + 20, String(k.a), 7);

  /* Planet name centered-top */
  DrawText(menuX + 240, menuY + 20, p.name, 15);

  /* ===== Bauen: production options ===== */
  DrawText(menuX + 50, menuY + 70, t('build_label'), 7);

  /* --- Left column buttons --- */

  /* 1. "nächstes Level" */
  if (p.a < 8) {
    DrawRect(menuX + 115, menuY + 65, 120, 15, 7);
    DrawText(menuX + 120, menuY + 72, t('next_level'), 14);
  }

  /* 2. "Soldaten" */
  if (k.a * 200 > k.inf) {
    DrawRect(menuX + 115, menuY + 85, 120, 15, 7);
    DrawText(menuX + 120, menuY + 92, t('soldiers'), 14);
  }

  /* 3. "Jäger" */
  if (k.a > 1 && factionStats[snr - 1].an < factionStats[snr - 1].max) {
    DrawRect(menuX + 115, menuY + 105, 120, 15, 7);
    DrawText(menuX + 120, menuY + 112, t('fighter'), 14);
  }

  /* 4. "Transporter" */
  if (k.inf >= 100 && k.a > 2 && factionStats[snr - 1].an < factionStats[snr - 1].max) {
    DrawRect(menuX + 115, menuY + 125, 120, 15, 7);
    DrawText(menuX + 120, menuY + 132, t('transporter'), 14);
  }

  /* --- Right column buttons --- */

  /* 5. "Adv. Jäger" */
  if (k.a > 3 && factionStats[snr - 1].an < factionStats[snr - 1].max) {
    DrawRect(menuX + 265, menuY + 65, 120, 15, 7);
    DrawText(menuX + 270, menuY + 72, t('adv_fighter'), 14);
  }

  /* 6. "Forts" */
  if (k.a > 4 && k.a > k.def) {
    DrawRect(menuX + 265, menuY + 85, 120, 15, 7);
    DrawText(menuX + 270, menuY + 92, t('forts'), 14);
  }

  /* 7. "Bomber" */
  if (k.a > 5 && factionStats[snr - 1].an < factionStats[snr - 1].max) {
    DrawRect(menuX + 265, menuY + 105, 120, 15, 7);
    DrawText(menuX + 270, menuY + 112, t('bomber'), 14);
  }

  /* "Nichts" — cancel production */
  DrawRect(menuX + 265, menuY + 125, 120, 15, 7);
  DrawText(menuX + 270, menuY + 132, t('nothing'), 14);

  /* ===== Auftrag: current order ===== */
  DrawText(menuX + 50, menuY + 155, t('order_label'), 7);

  switch (k.auf) {
    case 0: DrawText(menuX + 120, menuY + 155, t('nothing'), 8); break;
    case 1: DrawText(menuX + 120, menuY + 155, t('short_next_level'), 14); break;
    case 2: DrawText(menuX + 120, menuY + 155, t('soldiers'), 14); break;
    case 3: DrawText(menuX + 120, menuY + 155, t('fighter'), 14); break;
    case 4: DrawText(menuX + 120, menuY + 155, t('transporter'), 14); break;
    case 5: DrawText(menuX + 120, menuY + 155, t('adv_fighter'), 14); break;
    case 6: DrawText(menuX + 120, menuY + 155, t('forts'), 14); break;
    case 7: DrawText(menuX + 120, menuY + 155, t('bomber'), 14); break;
  }

  /* ===== Anzahl: quantity control ===== */
  DrawText(menuX + 50, menuY + 170, t('quantity_label'), 7);
  DrawText(menuX + 120, menuY + 170, String(k.m), 7);

  /* +1 button */
  DrawRect(menuX + 190, menuY + 162, 24, 14, 7);
  DrawText(menuX + 197, menuY + 167, '+', 14);

  /* -1 button */
  DrawRect(menuX + 190, menuY + 178, 24, 14, 7);
  DrawText(menuX + 197, menuY + 183, '-', 14);

  /* +10 button */
  DrawRect(menuX + 218, menuY + 162, 24, 14, 7);
  DrawText(menuX + 225, menuY + 167, '10', 14);

  /* -10 button */
  DrawRect(menuX + 218, menuY + 178, 24, 14, 7);
  DrawText(menuX + 225, menuY + 183, '10', 14);

  /* ===== Info: planet intelligence ===== */
  DrawText(menuX + 50, menuY + 205, t('info_label'), 7);

  DrawText(menuX + 120, menuY + 205, t('soldiers_label'), 7);
  DrawText(menuX + 190, menuY + 205, String(k.inf), 7);

  DrawText(menuX + 120, menuY + 225, t('forts_label'), 7);
  DrawText(menuX + 190, menuY + 225, String(k.def), 7);

  DrawText(menuX + 120, menuY + 245, t('behavior_label'), 7);

  if (k.war === 1)
    DrawText(menuX + 220, menuY + 247, t('attack_mode'), 12);
  else
    DrawText(menuX + 220, menuY + 247, t('defense_mode'), 10);

  DrawRect(menuX + 215, menuY + 240, 120, 15, 7);

  /* Planet war status */
  DrawText(menuX + 120, menuY + 265, t('planet_label'), 7);
  if (p.war)
    DrawText(menuX + 220, menuY + 265, t('war_status'), 12);
  else
    DrawText(menuX + 220, menuY + 265, t('peace_status'), 10);

  /* ===== alle Armeen: all factions' troops ===== */
  DrawText(menuX + 120, menuY + 285, t('all_armies_label'), 7);

  DrawText(menuX + 230, menuY + 285, String(p.k[0].inf), 11);
  DrawText(menuX + 230, menuY + 305, String(p.k[1].inf), 10);
  DrawText(menuX + 230, menuY + 325, String(p.k[2].inf), 15);

  /* ===== Schild / Raketen: planetary defenses ===== */
  DrawText(menuX + 270, menuY + 205, t('shield_label'), 7);
  if (k.a < 8)
    DrawText(menuX + 350, menuY + 205, t('inactive'), 8);
  else if (k.shieldHP > 0)
    DrawText(menuX + 350, menuY + 205, String(k.shieldHP) + '/' + String(k.maxShieldHP), 10);
  else
    DrawText(menuX + 350, menuY + 205, t('destroyed'), 4);

  DrawText(menuX + 270, menuY + 225, t('rockets_label'), 7);
  if (k.a < 7)
    DrawText(menuX + 350, menuY + 225, t('inactive'), 8);
  else {
    var maxAmmo = k.a >= 8 ? 3 : 2;
    var currentAmmo = k.rocketAmmo || 0;
    DrawText(menuX + 350, menuY + 225, String(currentAmmo) + '/' + String(maxAmmo), 10);
  }

  /* ===== Production progress bar ===== */
  if (k.auf > 0) {
    if (k.max > 0)
      barLen = Math.trunc(k.x / k.max * 200);
    else
      barLen = 0;

    if (barLen > 0)
      DrawLine(menuX + 100, menuY + 200, menuX + 100 + barLen, menuY + 200, 14);
  }

  /* ===== zurueck button: exit planet view ===== */
  DrawRect(menuX + 385, menuY + 300, 110, 30, 7);
  DrawText(menuX + 390, menuY + 312, t('back'), 7);

  /* ===== Keyboard hints ===== */
  DrawText(5, GameAreaHeight - 10, t('key_hints'), 8);

}

/* ================================================================ */
/* --- Functions from ai.pas (moved here as they are core logic) --- */
/* ================================================================ */

/* ================================================================ */
/* searchgf — Find goal faction: evaluate local combat balance      */
/* Returns: friendly_strength * mut - enemy_strength                */
/* Sets feind (boolean) and fn (target ship index).                 */
/* ================================================================ */
function searchgf(p, gr, feindRef, fnRef) {
  var t, a, b, c;

  b = 0;
  c = 0;
  fnRef.val = 0;

  for (t = 0; t < maxships; t++) {
    if (ships[t].ex && abstand(p, ships[t].s) < 400) {
      /* Determine weight by ship type — revised for new balance */
      if (ships[t].typ === 1 || ships[t].typ === 4 || ships[t].typ === 7) a = 2;    /* Jäger: lighter but faster */
      else if (ships[t].typ === 2 || ships[t].typ === 5 || ships[t].typ === 8) a = 3; /* Adv Jäger: moderate */
      else if (ships[t].typ === 3 || ships[t].typ === 6 || ships[t].typ === 9) a = 4; /* Bomber: heavy hitter */
      else if (ships[t].typ >= 10 && ships[t].typ <= 12) a = 1;
      else if (ships[t].typ === 13) a = 10;
      else a = 1;

      if (ships[t].gr === gr) {
        b += a;
      } else {
        c += a;
        if (fnRef.val === 0 && abstand(p, ships[t].s) < 250 && Math.floor(Math.random() * 100) < 50)
          fnRef.val = t + 1;  /* 1-based index */
      }
    }
  }

  feindRef.val = c > 0;
  return b * mut - c;
}

/* ================================================================ */
/* aufladen — Shield recharge & death processing                    */
/* ================================================================ */
function aufladen(s) {
  /* Shield recharge every 10 ticks */
  if (tickCount % 10 === 0 && s.shield < s.sx)
    s.shield++;

  /* Store heading when damaged */
  if (s.panz > -1000 && s.panz < 1)
    sv(s.h, s.v.x, s.v.y);

  /* Dying animation every 20 ticks — replaced by dying spray in 3D */
  if (s.panz < 1 && tickCount % 20 === 0) {
    s.panz -= 1000;
  }

  /* Activate dying spray when ship starts dying (only once) */
  if (s.panz < 1 && s.panz >= -1000 && !s.sprayActive) {
    s.sprayActive = true;
    /* Create THREE.Points mesh for this ship's spray */
    if (effectsGroup && s.sprayPoints === null) {
      var maxSparks = 64;
      var geom = new THREE.BufferGeometry();
      var pos = new Float32Array(maxSparks * 3);
      var col = new Float32Array(maxSparks * 3);
      var alive = new Float32Array(maxSparks);
      var alpha = new Float32Array(maxSparks);
      var vel = [];
      var life = new Float32Array(maxSparks);
      for (var si = 0; si < maxSparks; si++) {
        pos[si * 3] = 0; pos[si * 3 + 1] = 0; pos[si * 3 + 2] = 0;
        col[si * 3] = 1; col[si * 3 + 1] = 0.67; col[si * 3 + 2] = 0;
        vel.push({ x: 0, y: 0, z: 0 });
        life[si] = 0;
        alive[si] = 0;
        alpha[si] = 0;
      }
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geom.setAttribute('alive', new THREE.BufferAttribute(alive, 1));
      geom.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
      var pts = new THREE.Points(geom, particleShaderMaterial);
      s.sprayPoints = pts;
      s.sprayPositions = pos;
      s.sprayColors = col;
      s.sprayVelocities = vel;
      s.sprayLifetimes = life;
      s.sprayAlive = alive;
      s.sprayAlpha = alpha;
      s._sprayMaxSparks = maxSparks;
      effectsGroup.add(pts);
    }
  }

  /* Deactivate spray when ship is repaired or fully gone */
  if (s.panz >= 1 && s.sprayActive) {
    s.sprayActive = false;
    /* Remove the spray particle mesh from the 3D scene so it doesn't stay frozen */
    if (s.sprayPoints && typeof effectsGroup !== 'undefined') {
      effectsGroup.remove(s.sprayPoints);
      if (s.sprayPoints.geometry) s.sprayPoints.geometry.dispose();
      s.sprayPoints = null;
    }
  }
  if (s.panz < -5000) {
    /* Don't set sprayActive = false here — let the renderer finish the spray animation */
  }

  /* Ship destroyed */
  if (s.panz < -5000) {
    s.ex = false;
    factionStats[s.gr - 1].an--;
    if (s.typ === 1 || s.typ === 4 || s.typ === 7) factionStats[s.gr - 1].j--;
    else if (s.typ === 2 || s.typ === 5 || s.typ === 8) factionStats[s.gr - 1].aj--;
    else if (s.typ === 3 || s.typ === 6 || s.typ === 9) factionStats[s.gr - 1].b--;
    else if (s.typ >= 10 && s.typ <= 12) factionStats[s.gr - 1].t--;

    /* Trigger final 3D explosion with ship's momentum */
    if (typeof createFinalExplosion === 'function' && effectsGroup) {
      var p3d = gameTo3D(s.s.x, s.s.y);
      /* Dead ship drifts using heading (sh.h), not velocity (sh.v) */
      var shipVel = { x: s.h.x, y: s.h.y };
      var finalExp = createFinalExplosion({ x: p3d.x, y: WORLD_HEIGHT, z: p3d.z }, 0xffaa00, shipVel);
      effectsGroup.add(finalExp);
      finalExplosions.push(finalExp);
    }
  }
}

/* ================================================================ */
/* fliegezu — Steer ship velocity toward target position            */
/* ================================================================ */
function fliegezu(goal, pos, vel) {
  /* If velocity is (near) zero, point it directly toward the goal */
  var vLen = lang(vel);
  if (vLen < 1) {
    var dx = goal.x - pos.x;
    var dy = goal.y - pos.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0) {
      vel.x = (dx / d) * 10;
      vel.y = (dy / d) * 10;
    } else {
      vel.x = 10;
      vel.y = 0;
    }
    return 0;
  }
  var tmpGoal = { x: goal.x, y: goal.y };
  var g = entf(pos, vel, tmpGoal) / 50;
  if (g < -0.5) g = -0.5;
  if (g > 0.5) g = 0.5;
  drehen(vel, g);
  return g;
}

/* ================================================================ */
/* attack — Transporter landing on planet, sector capture           */
/* ================================================================ */
function attack(s, p) {
  var i5, g, found;

  g = 0;

  /* Capture unoccupied sector */
  if (p.a < 8 && p.k[s.gr - 1].a === 0) {
    p.a++;
    p.k[s.gr - 1].a++;
    found = false;
    for (i5 = 0; i5 < 8 && !found; i5++) {
      if (p.f[i5] === 8) {
        if (s.gr === 1) p.f[i5] = 11;
        else if (s.gr === 2) p.f[i5] = 10;
        else p.f[i5] = 15;
        found = true;
      }
    }
  }

  /* All sectors occupied — steal from weakest faction */
  if (p.a === 8 && p.k[s.gr - 1].a === 0) {
    p.k[s.gr - 1].a++;

    for (i5 = 0; i5 < 3; i5++)
      if (i5 + 1 !== s.gr && p.k[i5].a > g)
        g = i5 + 1;

    p.k[g - 1].a--;

    if (g === 1) g = 11;
    else if (g === 2) g = 10;
    else g = 15;

    found = false;
    for (i5 = 0; i5 < 8 && !found; i5++) {
      if (p.f[i5] === g) {
        if (s.gr === 1) p.f[i5] = 11;
        else if (s.gr === 2) p.f[i5] = 10;
        else p.f[i5] = 15;
        found = true;
      }
    }
  }

  /* Add troops and remove transporter */
  p.k[s.gr - 1].inf += 100;
  factionStats[s.gr - 1].t--;
  s.ex = false;
}

/* ================================================================ */
/* beweg — Main ship movement/AI per frame                          */
/* ================================================================ */
function beweg(sh) {
  var g, g1;
  var o = createVector();
  var a, t;

  a = -30000;

  /* If velocity is zero, restore from heading so the ship can start moving */
  var vLen = lang(sh.v);
  if (vLen < 1) {
    sh.v.x = sh.h.x;
    sh.v.y = sh.h.y;
  }

  orth(sh.v, o);

  /* Boundary bouncing */
  if (sh.s.x > seite) sh.v.x = Math.abs(sh.v.x) * -1;
  if (sh.s.x < 0) sh.v.x = Math.abs(sh.v.x);
  if (sh.s.y > seite) sh.v.y = Math.abs(sh.v.y) * -1;
  if (sh.s.y < 0) sh.v.y = Math.abs(sh.v.y);

  if (sh.panz > 0) {
    /* Move ship */
    sh.s.x = sh.s.x + sh.v.x * 0.002 * sh.ge;
    sh.s.y = sh.s.y + sh.v.y * 0.002 * sh.ge;

    /* Flee from overwhelming force */
    if (sh.gf < 0) {
      for (t = 0; t < maxships; t++)
        if (ships[t].gf > sh.gf && ships[t].ex && ships[t].gr === sh.gr)
          if (ships[t].gf > a) {
            a = ships[t].gf;
            sh.z.x = ships[t].s.x + Math.floor(Math.random() * 100) - 50;
            sh.z.y = ships[t].s.y + Math.floor(Math.random() * 100) - 50;
            sh.pl = false;
            sh.k = 0;
          }

      for (t = 0; t < maxpl; t++)
        if (planets[t].k[sh.gr - 1].gf > sh.gf)
          if (planets[t].k[sh.gr - 1].gf > a) {
            a = planets[t].k[sh.gr - 1].gf;
            sh.z.x = planets[t].s.x + Math.floor(Math.random() * 100) - 50;
            sh.z.y = planets[t].s.y + Math.floor(Math.random() * 100) - 50;
            sh.pl = false;
            sh.k = 0;
          }
    }

    /* Combat ships (typ 1-9) */
    if (sh.typ < 10) {
      /* Recharge energy when active */
      if (sh.ge < 100 && sh.f) sh.ge++;

      /* Combat and chase when fighting and gf>0 */
      if (sh.f && sh.gf > 0) {
        /* Chase enemy target if assigned and alive */
        if (sh.fn > 0 && ships[sh.fn - 1].ex) {
          var enemyShip = ships[sh.fn - 1];
          fliegezu(enemyShip.s, sh.s, sh.v);

          var ePos1 = { x: enemyShip.s.x, y: enemyShip.s.y };
          g = entf(sh.s, sh.v, ePos1) / 50;
          var ePos2 = { x: enemyShip.s.x, y: enemyShip.s.y };
          g1 = entf(sh.s, o, ePos2);
          if (g < -0.5) g = -0.5;
          if (g > 0.5) g = 0.5;

          /* Fire weapons — type-specific fire rate & hit chance */
          var fireRate = BOMBER_FIRE_RATE;  /* default */
          var hitChance = BOMBER_HIT_CHANCE;
          if (sh.typ === 1 || sh.typ === 4 || sh.typ === 7) {
            fireRate = JAGER_FIRE_RATE;
            hitChance = JAGER_HIT_CHANCE;
          } else if (sh.typ === 2 || sh.typ === 5 || sh.typ === 8) {
            fireRate = ADVJAGER_FIRE_RATE;
            hitChance = ADVJAGER_HIT_CHANCE;
          }

          if (tickCount % fireRate === 0 && Math.abs(g * 50) < Math.floor(Math.random() * 6) &&
              g1 < 0 && abstand(sh.s, enemyShip.s) < 150) {
            /* Apply hit chance */
            var finalHitChance = hitChance;
            /* Speed evasion: faster targets are harder to hit */
            var speedDiff = enemyShip.pm - sh.pm;
            if (speedDiff > 0) {
              finalHitChance -= Math.floor(speedDiff / 10) * SPEED_EVASION_PENALTY;
            }
            if (finalHitChance < 20) finalHitChance = 20;  /* minimum 20% */
            if (Math.floor(Math.random() * 100) < finalHitChance) {
              /* Smart missiles / rockets */
              if (sh.typ % 3 === 0) {
                if (sh.typ < 7 && tickCount % 30 === 0)
                  initsmart(sh.s, sh.v, sh.gr);
                if (sh.typ > 7 && tickCount % 15 === 0)
                  initraks(sh.s, sh.v, sh.gr);
              }
              /* Always fire ammo */
              initammo(sh.s, sh.v, sh.typ);
            }
          }
        }
      }

      /* If no enemy target: fly to goal, but avoid enemy shields */
      if (sh.fn === 0) {
        /* Check if inside enemy shield radius — if so, drift outward */
        var inEnemyShield = false;
        for (var p = 0; p < maxpl && !inEnemyShield; p++) {
          var dist = abstand(planets[p].s, sh.s);
          if (dist < 150) {
            for (var g = 0; g < 3 && !inEnemyShield; g++) {
              var k = planets[p].k[g];
              if (k.a >= 8 && k.shieldHP > 0 && g + 1 !== sh.gr) {
                inEnemyShield = true;
                /* Steer away: set goal ~200 units outward from planet */
                var dx = sh.s.x - planets[p].s.x;
                var dy = sh.s.y - planets[p].s.y;
                var len = Math.sqrt(dx * dx + dy * dy) || 1;
                sh.z.x = planets[p].s.x + (dx / len) * 200;
                sh.z.y = planets[p].s.y + (dy / len) * 200;
              }
            }
          }
        }
        fliegezu(sh.z, sh.s, sh.v);
      }
    }

    /* Transporters (typ 10-12) */
    if (sh.typ > 9) {
      /* Recharge energy when active */
      if (sh.ge < 100 && sh.f) sh.ge++;

      if (sh.k > 0) {
        /* Flying to planet: boost energy, fly there, land/close */
        if (sh.ge < 99) sh.ge += 2;
        fliegezu(planets[sh.k - 1].s, sh.s, sh.v);

        if (abstand(planets[sh.k - 1].s, sh.s) < 25)
          attack(sh, planets[sh.k - 1]);
      } else if (sh.fn === 0) {
        /* Default: fly to goal */
        fliegezu(sh.z, sh.s, sh.v);
      }
    }

    /* Energy ramp-up/down based on distance to goal */
    if (sh.pl && sh.k > 0)
      g1 = abstand(planets[sh.k - 1].s, sh.s);
    else if (sh.k === 0)
      g1 = abstand(sh.z, sh.s);

    if (g1 > 100 && sh.ge < 100) sh.ge++;
    if (g1 < 100 && !sh.f && sh.ge > 0) sh.ge--;

    /* Wobble on hit */
    if (Math.abs(sh.m) > 0.5)
      drehen(sh.v, sh.m / 2);
    sh.m = sh.m * 0.7;
  } else {
    /* Dead ship drifts using saved heading vector */
    drehen(sh.v, sh.m / 2);
    sh.s.x = sh.s.x + sh.h.x * 0.004 * sh.ge;
    sh.s.y = sh.s.y + sh.h.y * 0.004 * sh.ge;
  }
}

/* ================================================================ */
/* rahmenbild — Draw ship status frame/health bar                   */
/* ================================================================ */
function rahmenbild(x, y, p, s, pm, sm) {
  var z = zoomScale;
  var ox5 = Math.round(5 * z);
  var ox10 = Math.round(10 * z);
  var oy5 = Math.round(5 * z);
  var oy10 = Math.round(10 * z);
  var pw, sw;

  /* Draw box outline (gray, color 7) */
  SetDrawColor(7);

  /* Top-left corner */
  DrawLine(x - ox5, y - oy10, x - ox10, y - oy10, 7);
  DrawLine(x - ox10, y - oy10, x - ox10, y - oy5, 7);

  /* Bottom-left corner */
  DrawLine(x - ox10, y + oy5, x - ox10, y + oy10, 7);
  DrawLine(x - ox10, y + oy10, x - ox5, y + oy10, 7);

  /* Bottom-right corner */
  DrawLine(x + ox5, y + oy10, x + ox10, y + oy10, 7);
  DrawLine(x + ox10, y + oy10, x + ox10, y + oy5, 7);

  /* Top-right corner */
  DrawLine(x + ox10, y - oy5, x + ox10, y - oy10, 7);
  DrawLine(x + ox10, y - oy10, x + ox5, y - oy10, 7);

  /* Draw armor and shield bars only when armor > 1 */
  if (p > 1) {
    pw = Math.trunc(Math.round(20 * z) * p / pm);
    sw = Math.trunc(Math.round(20 * z) * s / sm);

    /* Armor bar (color 4 = red) */
    SetDrawColor(4);
    DrawLine(x - ox10, y - oy10, x - ox10 + pw, y - oy10, 4);

    /* Shield bar (color 11 = bright yellow) */
    SetDrawColor(11);
    DrawLine(x - ox10, y + oy10, x - ox10 + sw, y + oy10, 11);
  }
}

/* ================================================================ */
/* zielsuchen — Find nearest enemy ship within range                */
/* Returns target ship index via kRef.val (1-based, 0 = none).      */
/* ================================================================ */
function zielsuchen(x, gr, kRef) {
  var i2, e1, e2;

  e2 = 301;
  kRef.val = 0;

  for (i2 = 0; i2 < maxships; i2++)
    if (ships[i2].ex && gr !== ships[i2].gr) {
      e1 = abstand(x, ships[i2].s);
      if (e1 < e2 && e1 > 120) {
        kRef.val = i2 + 1;  /* 1-based */
        e2 = e1;
      }
    }
}

/* ================================================================ */
/* checkWinLose — Check if current player has won or lost the game */
/* Sets global flags: gameWon / gameLost                           */
/* ================================================================ */
function checkWinLose() {
  var i, j;
  var playerIdx = snr - 1;

  /* If already decided, do nothing */
  if (gameWon || gameLost) return;

  /* Count sectors per faction across all planets */
  var playerSectors = 0;
  var enemySectors = 0;
  var anyOccupiedSectors = false;

  for (i = 0; i < maxpl; i++) {
    for (j = 0; j < 3; j++) {
      if (planets[i].k[j].a > 0) {
        anyOccupiedSectors = true;
        if (j === playerIdx)
          playerSectors += planets[i].k[j].a;
        else
          enemySectors += planets[i].k[j].a;
      }
    }
  }

  /* WIN: all occupied sectors belong to player AND no enemy ships exist */
  if (anyOccupiedSectors && playerSectors > 0 && enemySectors === 0) {
    var enemyShips = 0;
    for (i = 0; i < maxships; i++) {
      if (ships[i].ex && ships[i].gr !== snr) {
        enemyShips++;
      }
    }
    if (enemyShips === 0) {
      gameWon = true;
      return;
    }
  }

  /* LOSE: player has no sectors and no ships */
  if (playerSectors === 0) {
    var playerShips = 0;
    for (i = 0; i < maxships; i++) {
      if (ships[i].ex && ships[i].gr === snr) {
        playerShips++;
      }
    }

    if (playerShips === 0) {
      gameLost = true;
    }
  }
}
