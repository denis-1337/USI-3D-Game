/* entities.js — data structures and entity arrays, ported from render.pas and planeten.pas */

/* ===== Factory functions ===== */

// createVector — TVector
function createVector(x, y) {
  return { x: x || 0, y: y || 0 };
}

// createPoly — TPoly (triangle polygon)
function createPoly(a1, a2, a3, f) {
  return { a: [a1 || 0, a2 || 0, a3 || 0], f: f || 0 };
}

// createObject — TObject_ (3D model, renamed from TObject to avoid JS conflict)
function createObject() {
  // 14 vertices
  var v = [];
  for (var i = 0; i < 14; i++) v.push(createVector());
  // 8 polygons
  var p = [];
  for (var i = 0; i < 8; i++) p.push(createPoly());
  return { v: v, p: p, maxv: 0, maxp: 0 };
}

// createShip — TShip
function createShip() {
  return {
    ex: false,       // exists
    s: createVector(),  // position
    v: createVector(),  // velocity
    z: createVector(),  // heading / target direction
    k: 0,            // target planet index (0=none)
    m: 0,            // momentum
    typ: 0,          // ship type
    gr: 0,           // faction ID (1,2,3)
    ge: 0,           // energy
    nr: 0,           // planet ID
    fn: 0,           // flag / state
    r: false,        // selected
    panz: 0,         // armor
    shield: 0,       // shield points
    sx: 0,           // screen x (cached)
    pm: 0,           // power mode
    h: createVector(),  // heading vector
    gf: 0,           // goal faction
    pl: false,       // planet-bound
    f: false,        // active
    /* Per-ship dying spray — reusable particle pool */
    sprayActive: false,
    sprayPoints: null,
    sprayPositions: null,   // Float32Array
    sprayColors: null,      // Float32Array
    sprayVelocities: null,  // Array of {x,y,z}
    sprayLifetimes: null,   // Float32Array
    sprayAlive: null,       // Float32Array — 1.0 active, 0.0 inactive
    sprayAlpha: null        // Float32Array — per-particle alpha
  };
}

// createColony — TKolonie
function createColony() {
  return {
    a: 0,            // anzahl besetzter sektoren
    inf: 0,          // einheiten/infantry
    def: 0,          // verteidiger/forts
    auf: 0,          // derzeitiger auftrag (0=none, 1=level up, 2=soldiers, 3=jager, 4=transporter, 5=adv jager, 6=forts, 7=bomber)
    x: 0,            // stand der ausfuehrung
    max: 0,          // nach wieviel es fertig ist
    m: 0,            // menge
    war: 0,          // 0 = verschanzen/defend, 1 = angriff/attack
    f: 50,           // Faktor fuer Lebensbedingungen (default 50)
    f2: false,
    gf: 0,
    fn: 0,
    /* Planet defense (Level 7+: rockets, Level 8+: shield) */
    shieldHP: 0,         // Aktuelle Schild-HP
    maxShieldHP: 0,      // Maximale Schild-HP (k.a * 25)
    missileCooldown: 0,  // Cooldown-Zaehler fuer Abfangraketen
    activeMissiles: 0,   // Anzahl aktuell aktiver Abfangraketen
    rocketAmmo: 0        // Raketen-Vorrat (Level 7: max 2, Level 8: max 3)
  };
}

// createPlanet — TPlanet
function createPlanet() {
  var k = [];
  for (var i = 0; i < 3; i++) k.push(createColony());
  var f = [];
  for (var i = 0; i < 8; i++) f.push(8);  // neutral color
  return {
    s: createVector(),  // position
    name: '',
    f: f,               // sector colors (8 sectors)
    a: 0,               // anzahl besetzter sektoren
    e: false,           // false = noch nicht betreten worden
    war: false,         // false = frieden
    k: k                // colonies for 3 factions
  };
}

// createAmmo — TAmmoItem
function createAmmo() {
  return {
    s: createVector(),  // source
    x: createVector(),  // target
    gr: 0,              // group/faction
    e: 0,               // energy / life
    ex: false           // active
  };
}

// createRocket — TRakete
function createRocket() {
  return {
    ex: false,
    s: createVector(),  // position
    v: createVector(),  // velocity
    k: 0,               // target
    e: 0,               // energy/life
    gr: 0               // faction
  };
}

// createExplosion2D — single entry of TAllExplo (2D game logic)
function createExplosion2D() {
  var ed = [];
  for (var i = 0; i < 32; i++) ed.push(createVector());
  return {
    ed: ed,             // explosion particles (32 vectors)
    e: 0,               // frame / life
    ex: false,          // active
    s: createVector()   // position
  };
}

// createShieldHit2D — single entry of TSDData (2D game logic)
function createShieldHit2D() {
  return {
    ex: false,
    v: createVector(),  // position
    k: 0,               // color / type
    e: 0                // frame / life (shortint)
  };
}

// createThrusterTrail — single entry of TAntriebe (array of 5 TAntriebDat, each 5 vectors)
function createThrusterTrail() {
  var trails = [];
  for (var i = 0; i < 5; i++) trails.push(createVector());
  return trails;
}

// createFactionStats — TSpielerStats
function createFactionStats() {
  return {
    an: 0,    // momentane Schiffanzahl
    max: 0,   // maximal moegliche Anzahl
    j: 0,     // jager count
    aj: 0,    // advjager count
    b: 0,     // bomber count
    t: 0      // transporter count
  };
}

/* ===== Global entity arrays ===== */

// Ships — TGanzViel = array[1..255] of TShip
var ships = [];
for (var _i = 0; _i < 255; _i++) ships.push(createShip());

// Planets — TAlleP = array[1..10] of TPlanet
var planets = [];
for (var _i = 0; _i < 10; _i++) planets.push(createPlanet());

// Faction stats — TSpieler = array[1..3] of TSpielerStats
var factionStats = [];
for (var _i = 0; _i < 3; _i++) factionStats.push(createFactionStats());

// Ammo — TAmmo = array[1..200] of TAmmoItem
var ammo = [];
for (var _i = 0; _i < 200; _i++) ammo.push(createAmmo());

// Rockets — TRaketen = array[1..50] of TRakete
var rockets = [];
for (var _i = 0; _i < 50; _i++) rockets.push(createRocket());

// Smart missiles — TSmarties = array[1..50] of TRakete
var smartMissiles = [];
for (var _i = 0; _i < 50; _i++) smartMissiles.push(createRocket());

// Explosions — TAllExplo = array[1..20]
var explosions = [];
for (var _i = 0; _i < 20; _i++) explosions.push(createExplosion2D());

// Shield hits — TSDData = array[1..20]
var shieldHits = [];
for (var _i = 0; _i < 20; _i++) shieldHits.push(createShieldHit2D());

// Thruster trails — TAntriebe = array[1..50] of TAntriebDat
var thrusters = [];
for (var _i = 0; _i < 50; _i++) thrusters.push(createThrusterTrail());

/* ===== 3D Model objects ===== */

// Ship models (a1/b1/c1 = faction 1, a2/b2/c2 = faction 2, a3/b3/c3 = faction 3)
var a1 = createObject();
var b1 = createObject();
var c1 = createObject();
var a2 = createObject();
var b2 = createObject();
var c2 = createObject();
var a3 = createObject();
var b3 = createObject();
var c3 = createObject();

// Planet model
var pla = createObject();

// Transporter model (k1/k2/k3)
var k1m = createObject();
var k2m = createObject();
var k3m = createObject();

/* ===== Explosion/shield vector data (render.pas: ex: TShieldData, s: TExploData) ===== */

// ex: TShieldData = array[1..14] of TVector  (shield effect vectors)
var shieldVecData = [];
for (var _i = 0; _i < 14; _i++) shieldVecData.push(createVector());

// explosionData: TExploData = array[1..32] of TVector
var explosionData = [];
for (var _i = 0; _i < 32; _i++) explosionData.push(createVector());

/* ===== Double-buffer toggle (kept for compat) ===== */
var page = false;
