/* ai.js — AI logic for non-player factions
   Ported from fpc_port/src/ai.pas

   Dependencies (all globals loaded via <script> tags before this file):
     - constants.js  (maxships, maxpl, seite, pge, mut, soldaten, nlevel, ...)
     - globals.js    (tickCount, ...)
     - entities.js   (ships, planets, factionStats)
     - vec.js        (sv, abstand, orth, drehen, entf, ...)
     - planeten.js   (searchgf, aufladen, fliegezu, attack, beweg, zielsuchen)

   Pascal arrays are 1-indexed; JS arrays are 0-indexed.
   Pascal faction IDs are 1-based (1, 2, 3).
   Planet references (ship.k, planet indices) are 1-based in the game logic.
*/

/* ================================================================ */
/* pki — Production AI: decide what each faction builds on planets  */
/* Revised: balanced ship production, adaptive to fleet composition */
/* ================================================================ */
function pki(g) {
  var t, a, ge;

  ge = false;

  for (t = 0; t < maxpl; t++) {
    var k = planets[t].k[g - 1];

    /* ---- Sector strategy: assess local situation on this planet ---- */
    /* Count sectors held by each faction and total infantry */
    var mySectors = k.a;
    var totalInf = 0;
    var enemyInf = 0;
    var myInf = k.inf;
    for (var sg = 0; sg < 3; sg++) {
      totalInf += planets[t].k[sg].inf;
      if (sg + 1 !== g) enemyInf += planets[t].k[sg].inf;
    }

    /* If there are enemies on this planet, factor in sector warfare */
    if (enemyInf > 0 && mySectors > 0) {
      /* Undermanned: fewer soldiers than sectors * 200 (max capacity per sector) */
      var idealInf = mySectors * 200;

      /* If we have fewer soldiers than ideal, bias toward recruiting */
      if (myInf < idealInf * 0.7 && k.a * 200 > k.inf && Math.floor(Math.random() * 100) < 25) {
        a = 2;  /* force soldier production */
      }

      /* If we're outnumbered and in defense mode, switch to attack */
      if (myInf < enemyInf && k.war === 0 && Math.floor(Math.random() * 100) < 15) {
        k.war = 1;  /* aggressive stance */
      }

      /* If we dominate (more than 2x enemy inf), stay aggressive */
      if (myInf > enemyInf * 2 && Math.floor(Math.random() * 100) < 10) {
        k.war = 1;
        /* Bias toward soldier production to maintain pressure */
        if (k.a * 200 > k.inf && Math.floor(Math.random() * 100) < 20) {
          a = 2;
        }
      }
    }

    /* Set war stance based on infantry count (baseline) */
    if (k.inf > 250)
      k.war = 1;
    else
      k.war = 0;

    /* Only decide if no current production or finished */
    if (k.x === 0 || k.auf === 0) {
      var fs = factionStats[g - 1];
      var planetLevel = k.a;

      /* ---- Hybrid approach: original random base + adaptive weights ----
         Start with original random selection (1..planetLevel), then apply
         adaptive overrides to steer toward needed ship types. This keeps the
         original "always produce something" behavior while preferring useful ships. */

      /* Original random roll — ensures the AI always has something to consider */
      a = Math.floor(Math.random() * planetLevel) + 1;

      /* Original cascading overrides: 3→5→7 based on planet level */
      if (a === 3 && planetLevel > 3) a = 5;
      if (a === 5 && planetLevel > 5) a = 7;

      /* Original budget cap for bombers */
      if (a === 7 && fs.b > 65) a = 0;

      /* Original war check for transporter */
      if (a === 4 && planets[t].war) a = 0;

      /* ---- Adaptive steering: balance fleet composition ---- */
      var totalShips = fs.j + fs.aj + fs.b;

      if (totalShips > 0 && fs.an < fs.max) {
        var ratioJ = fs.j / totalShips;
        var ratioAJ = fs.aj / totalShips;
        var ratioB = fs.b / totalShips;

        /* If almost no bombers but planet can build them: force bomber production occasionally */
        if (fs.b === 0 && planetLevel >= 5 && a !== 7 && Math.random() < 0.3)
          a = 7;

        /* If no fighters at all: force fighter production */
        if (fs.j === 0 && fs.aj === 0 && a !== 3 && a !== 5 && Math.random() < 0.4)
          a = (planetLevel >= 3) ? 5 : 3;

        /* Too many bombers (>45% of fleet): steer bomber rolls toward fighters */
        if (ratioB > 0.45 && a === 7 && Math.random() < 0.6) {
          a = planetLevel >= 3 ? 5 : 3;
        }

        /* Too few fighters (<15% of fleet): occasionally convert non-fighter rolls to fighter */
        if (ratioJ < 0.15 && a !== 3 && a !== 5 && Math.random() < 0.3)
          a = 3;

        /* If no transporters at all and there are uncolonized planets: build one */
        if (fs.t === 0 && !planets[t].war && k.inf >= 100 && a !== 4) {
          var hasFreePlanet = false;
          for (var up = 0; up < maxpl && !hasFreePlanet; up++) {
            if (planets[up].k[g - 1].a === 0) hasFreePlanet = true;
          }
          if (hasFreePlanet && Math.random() < 0.35)
            a = 4;
        }

        /* If transporter count is very low relative to fleet: bias toward transporter */
        if (fs.t < 2 && totalShips >= 5 && !planets[t].war && k.inf >= 100 && a !== 4) {
          var needsColonize = false;
          for (var up2 = 0; up2 < maxpl && !needsColonize; up2++) {
            if (planets[up2].k[g - 1].a === 0) needsColonize = true;
          }
          if (needsColonize && Math.random() < 0.2)
            a = 4;
        }
      }

      switch (a) {
        case 1:
          if (planets[t].a < 8) {
            k.auf = 1;
            k.x = 0;
            k.max = 2 * nlevel - Math.floor(nlevel * k.f / 100);
            ge = true;
            k.m = 1;
          }
          break;

        case 2:
          if (k.a * 200 > k.inf) {
            k.auf = 2;
            k.x = 0;
            k.max = soldaten;
            ge = true;
            k.m = 1;
          }
          break;

        case 3:
          if (fs.an < fs.max) {
            k.m = 1;
            k.auf = 3;
            k.max = jager;
            ge = true;
          }
          break;

        case 4:
          if (k.inf >= 100 && fs.an < fs.max) {
            k.auf = 4;
            k.x = 0;
            k.max = transporter;
            ge = true;
            k.m = 1;
          }
          break;

        case 5:
          if (fs.an < fs.max) {
            k.auf = 5;
            k.x = 0;
            k.max = advjager;
            ge = true;
            k.m = 1;
          }
          break;

        case 6:
          if (k.a > k.def) {
            k.auf = 6;
            k.x = 0;
            k.max = forts;
            ge = true;
            k.m = 1;
          }
          break;

        case 7:
          if (fs.an < fs.max) {
            k.auf = 7;
            k.x = 0;
            k.max = bomber;
            ge = true;
            k.m = 1;
          }
          break;
      }

      if (!ge) {
        k.auf = 0;
        k.x = 0;
      }
    }
  }
}

/* ================================================================ */
/* ki — Fleet AI: colonization, reinforcement, defense, conquest   */
/* Revised: smarter ship assignment based on mission type */
/* ================================================================ */
function ki(g) {
  var t, l;

  /* Colonize unexplored planets */
  for (t = 0; t < maxpl; t++) {
    if (planets[t].k[g - 1].gf >= 0 && planets[t].k[g - 1].a === 0 &&
        Math.floor(Math.random() * 100) < 30) {
      for (l = 0; l < maxships; l++)
        if (ships[l].ex && ships[l].gr === g && ships[l].typ > 9 &&
            !ships[l].f && !ships[l].pl && Math.floor(Math.random() * 100) < 20) {
          ships[l].k = t + 1;  /* 1-based planet index */
          ships[l].pl = true;
          /* Send escort ships with transporter — prefer Adv Jäger for escort */
          sendEscort(g, t, l);
        }
    }
  }

  /* Reinforce planets needing troops */
  for (t = 0; t < maxpl; t++) {
    if (planets[t].k[g - 1].gf >= 0 && planets[t].k[g - 1].inf < 200 &&
        Math.floor(Math.random() * 100) < 10 && planets[t].k[g - 1].a > 0 &&
        planets[t].war) {
      for (l = 0; l < maxships; l++)
        if (ships[l].ex && ships[l].gr === g && ships[l].typ > 9 &&
            Math.floor(Math.random() * 100) < 20) {
          ships[l].k = t + 1;  /* 1-based planet index */
          ships[l].pl = true;
          /* Send escort ships with transporter */
          sendEscort(g, t, l);
        }
    }
  }

  /* Defend own planets under threat (enemy ships nearby) */
  for (t = 0; t < maxpl; t++) {
    if (planets[t].k[g - 1].gf < 0 && planets[t].k[g - 1].a > 0) {
      /* Enemy on this planet — park defense ships here */
      for (l = 0; l < maxships; l++)
        if (ships[l].ex && ships[l].gr === g && ships[l].typ < 10 &&
            !ships[l].f && !ships[l].pl &&
            planets[t].k[g - 1].gf + ships[l].gf > 10) {
          var isFighter = (ships[l].typ === 1 || ships[l].typ === 4 || ships[l].typ === 7 ||
                           ships[l].typ === 2 || ships[l].typ === 5 || ships[l].typ === 8);
          if (isFighter || Math.random() < 0.3) {
            ships[l].z.x = planets[t].s.x + Math.floor(Math.random() * 100) - 50;
            ships[l].z.y = planets[t].s.y + Math.floor(Math.random() * 100) - 50;
            ships[l].pl = true;
          }
        }
    }
  }

  /* --- Retreat: only un-park ships that are parked near a DEFENDED ENEMY
     planet (not their own). Ships defending their own planet stay put. --- */
  for (l = 0; l < maxships; l++) {
    if (!ships[l].ex || ships[l].gr !== g || ships[l].typ >= 10) continue;
    if (!ships[l].pl) continue;

    /* Find which planet this ship is parked near */
    var parkedPlanet = -1;
    var parkedDist = 9999;
    for (t = 0; t < maxpl; t++) {
      var dd = abstand(ships[l].s, planets[t].s);
      if (dd < parkedDist) {
        parkedDist = dd;
        parkedPlanet = t;
      }
    }
    if (parkedPlanet < 0 || parkedDist > 200) continue;

    /* If parked at own planet (we own sectors here), don't retreat */
    if (planets[parkedPlanet].k[g - 1].a > 0) continue;

    /* If parked at a planet we don't own, check if it's defended by an enemy */
    var enemyDefends = false;
    for (var gg = 0; gg < 3; gg++) {
      if (gg + 1 === g) continue;
      if (planets[parkedPlanet].k[gg].a >= 7) {
        enemyDefends = true;
        break;
      }
    }
    if (!enemyDefends) continue;

    /* Check if a friendly transporter is also heading here */
    var hasEscortTransporter = false;
    for (var tt = 0; tt < maxships && !hasEscortTransporter; tt++) {
      if (ships[tt].ex && ships[tt].gr === g && ships[tt].typ > 9 && ships[tt].pl) {
        if (abstand(ships[tt].s, planets[parkedPlanet].s) < 300) hasEscortTransporter = true;
      }
    }

    /* Retreat to safe distance */
    ships[l].pl = false;
    var dx = ships[l].s.x - planets[parkedPlanet].s.x;
    var dy = ships[l].s.y - planets[parkedPlanet].s.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) d = 1;
    var safeDist = hasEscortTransporter ? 150 : 350;
    ships[l].z.x = ships[l].s.x + (dx / d) * safeDist;
    ships[l].z.y = ships[l].s.y + (dy / d) * safeDist;
    ships[l].f = true;
  }

  /* Conquer enemy planets */
  for (t = 0; t < maxpl; t++) {
    if (planets[t].k[g - 1].gf < 0 && planets[t].k[g - 1].a === 0) {
      /* Check if planet has defense (Level 7+) from any faction */
      var planetLevel = 0;
      for (var gg = 0; gg < 3; gg++) {
        if (planets[t].k[gg].a > planetLevel) planetLevel = planets[t].k[gg].a;
      }

      /* How many ships to send based on planet defense level */
      var shipsToSend;
      if (planetLevel >= 8) shipsToSend = 5 + Math.floor(Math.random() * 3);  /* 5-7 */
      else if (planetLevel >= 7) shipsToSend = 3 + Math.floor(Math.random() * 2); /* 3-4 */
      else shipsToSend = 1 + Math.floor(Math.random() * 2);  /* 1-2 */

      /* Park position: outside shield/cannon range for defended planets */
      var parkDist;
      if (planetLevel >= 8) parkDist = 250;  /* outside shield (200) + buffer */
      else if (planetLevel >= 7) parkDist = 280;  /* outside cannons (250) + buffer */
      else parkDist = 50;  /* no defense, park close */

      /* Send a balanced fleet: mix of Jäger (interceptors) and Bombers (damage) */
      var sent = 0;
      var sentFighters = 0;
      var sentBombers = 0;

      /* First pass: send fighters (Jäger/Adv Jäger) */
      for (l = 0; l < maxships && sentFighters < Math.ceil(shipsToSend * 0.6); l++)
        if (ships[l].ex && ships[l].gr === g &&
            (ships[l].typ === 1 || ships[l].typ === 4 || ships[l].typ === 7 ||
             ships[l].typ === 2 || ships[l].typ === 5 || ships[l].typ === 8) &&
            !ships[l].f && !ships[l].pl &&
            planets[t].k[g - 1].gf + ships[l].gf > 100 &&
            Math.floor(Math.random() * 100) < 4) {
          ships[l].z.x = planets[t].s.x + Math.floor(Math.random() * parkDist * 2) - parkDist;
          ships[l].z.y = planets[t].s.y + Math.floor(Math.random() * parkDist * 2) - parkDist;
          ships[l].pl = true;
          sentFighters++;
          sent++;
        }

      /* Second pass: send bombers for the rest */
      for (l = 0; l < maxships && sentBombers < shipsToSend - sentFighters; l++)
        if (ships[l].ex && ships[l].gr === g &&
            (ships[l].typ === 3 || ships[l].typ === 6 || ships[l].typ === 9) &&
            !ships[l].f && !ships[l].pl &&
            planets[t].k[g - 1].gf + ships[l].gf > 100 &&
            Math.floor(Math.random() * 100) < 4) {
          ships[l].z.x = planets[t].s.x + Math.floor(Math.random() * parkDist * 2) - parkDist;
          ships[l].z.y = planets[t].s.y + Math.floor(Math.random() * parkDist * 2) - parkDist;
          ships[l].pl = true;
          sentBombers++;
          sent++;
        }
    }
  }

  /* Clear planet-bound flag when close to destination */
  for (l = 0; l < maxships; l++)
    if (ships[l].ex && ships[l].gr === g && ships[l].typ < 10 &&
        abstand(ships[l].z, ships[l].s) < 300)
      if (ships[l].gf > 20 || ships[l].gf < 0)
        ships[l].pl = false;
}

/* ================================================================ */
/* sendEscort — Send combat ships to escort a transporter         */
/* Scales escort count based on target planet level                */
/* Escorts park close to planet to draw shield/cannon fire          */
/* ================================================================ */
function sendEscort(factionGr, targetPlanetIdx, transporterIdx) {
  var targetPlanet = planets[targetPlanetIdx];
  var highestLevel = 0;

  /* Find the highest colony level on target planet (any faction) */
  for (var gg = 0; gg < 3; gg++) {
    if (targetPlanet.k[gg].a > highestLevel) {
      highestLevel = targetPlanet.k[gg].a;
    }
  }

  /* More escort for higher level planets */
  var escortCount;
  if (highestLevel >= 8) escortCount = 4 + Math.floor(Math.random() * 3);  /* 4-6 */
  else if (highestLevel >= 7) escortCount = 3 + Math.floor(Math.random() * 2); /* 3-4 */
  else if (highestLevel >= 5) escortCount = 2 + Math.floor(Math.random() * 2); /* 2-3 */
  else escortCount = 1 + Math.floor(Math.random() * 2);  /* 1-2 */

  /* Escorts park close to the planet to draw fire (shield/cannons target them) */
  var escortParkDist = 50;

  /* First pass: prefer fighters for escort (better at defending) */
  var sent = 0;
  for (var e = 0; e < maxships && sent < escortCount; e++) {
    if (ships[e].ex && ships[e].gr === factionGr &&
        (ships[e].typ === 1 || ships[e].typ === 4 || ships[e].typ === 7 ||
         ships[e].typ === 2 || ships[e].typ === 5 || ships[e].typ === 8) &&
        !ships[e].f && !ships[e].pl && e !== transporterIdx) {
      ships[e].z.x = targetPlanet.s.x + Math.floor(Math.random() * escortParkDist * 2) - escortParkDist;
      ships[e].z.y = targetPlanet.s.y + Math.floor(Math.random() * escortParkDist * 2) - escortParkDist;
      ships[e].pl = true;
      sent++;
    }
  }

  /* Second pass: fill remaining with bombers if needed */
  for (var e = 0; e < maxships && sent < escortCount; e++) {
    if (ships[e].ex && ships[e].gr === factionGr &&
        (ships[e].typ === 3 || ships[e].typ === 6 || ships[e].typ === 9) &&
        !ships[e].f && !ships[e].pl && e !== transporterIdx) {
      ships[e].z.x = targetPlanet.s.x + Math.floor(Math.random() * escortParkDist * 2) - escortParkDist;
      ships[e].z.y = targetPlanet.s.y + Math.floor(Math.random() * escortParkDist * 2) - escortParkDist;
      ships[e].pl = true;
      sent++;
    }
  }
}
