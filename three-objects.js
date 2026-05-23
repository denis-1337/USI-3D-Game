/* three-objects.js — 3D mesh factory functions for ships, planets, effects */

/*
 * Faction colors (same as original game)
 */
var FACTION_COLORS = {
  1: { body: 0xff4444, accent: 0xff8866, glow: 0xff2222 },   // Red
  2: { body: 0x44ff44, accent: 0x88ff66, glow: 0x22ff22 },   // Green
  3: { body: 0xffff44, accent: 0xffff88, glow: 0xffff22 }    // Yellow
};

/*
 * Ship scale factor — 2D game units to 3D model units
 * Ships in 2D are ~20-40 units, we want them to be ~3-8 in 3D
 */
var SHIP_SCALE = 2.0;
var SHIP_HEIGHT = 25;   // extrusion depth for ships
var SCALE3D = 2;       // scale factor for JSON ship models (matches 3D planet scale)

/* Ship 3D models loaded from JSON — cached by ship type (1-12) */
var shipModelCache = {};

/*
 * Load a ship 3D model from JSON file.
 * Returns a THREE.Group.
 */
function loadShipModelJSON(shipType) {
  if (shipModelCache[shipType]) return shipModelCache[shipType];

  // VGA palette (same as in the game)
  var VGA = [
    0x000000, 0x0000AA, 0x00AA00, 0x00AAAA, 0xAA0000, 0xAA00AA,
    0xAA5500, 0xAAAAAA, 0x555555, 0x5555FF, 0x55FF55, 0x55FFFF,
    0xFF5555, 0xFF55FF, 0xFFAA00, 0xFFFFFF
  ];

  // Get model data from embedded SHIP_MODELS (no XHR needed — works with file://)
  var data = SHIP_MODELS[String(shipType)];

  if (!data) {
    // Fallback: simple box
    var geo = new THREE.BoxGeometry(3, 3, 3);
    var mat = new THREE.MeshPhongMaterial({ color: 0x888888 });
    var m = new THREE.Mesh(geo, mat);
    shipModelCache[shipType] = m;
    return shipModelCache[shipType];
  }

  var group = new THREE.Group();
  var verts = data.vertices;
  var faces = data.faces;

  // Group faces by VGA color index
  var facesByColor = {};
  for (var fi = 0; fi < faces.length; fi++) {
    var f = faces[fi];
    var ci = f[3];
    if (!facesByColor[ci]) facesByColor[ci] = [];
    facesByColor[ci].push(f);
  }

  // One mesh per color — hardcoded VGA colors
  for (var colorIdx in facesByColor) {
    var cf = facesByColor[colorIdx];
    var positions = [];
    for (var i = 0; i < cf.length; i++) {
      var face = cf[i];
      for (var v = 0; v < 3; v++) {
        var vert = verts[face[v]];
        positions.push(vert[0], vert[1], vert[2]);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();

    var hexColor = VGA[parseInt(colorIdx)] || 0xffffff;
    var mat = new THREE.MeshPhongMaterial({
      color: hexColor,
      emissive: hexColor,
      emissiveIntensity: 0.15,
      specular: 0x333333,
      shininess: 20,
      flatShading: true,
      side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
  }

  // Center
  group.updateMatrixWorld(true);
  var box = new THREE.Box3().setFromObject(group);
  var center = new THREE.Vector3();
  box.getCenter(center);
  for (var c = 0; c < group.children.length; c++) {
    group.children[c].position.sub(center);
  }

  // Scale up for game world
  group.scale.set(SCALE3D, SCALE3D, SCALE3D);

  shipModelCache[shipType] = group;
  return group;
}

/*
 * Create a 3D ship mesh from 2D vertex data.
 * Uses ExtrudeGeometry to give the 2D polygon volume.
 *
 * params:
 *   verts   - array of {x, y} vertices (from original model data)
 *   polys   - array of {a: [v1,v2,v3], f: color} triangles
 *   maxv    - number of vertices
 *   faction - 1, 2, or 3
 */
function createShipMesh(verts, polys, maxv, faction) {
  var fc = FACTION_COLORS[faction];

  /* Build a Shape from the 2D vertices (1-indexed, skip index 0) */
  var shape = new THREE.Shape();
  if (maxv > 0) {
    var v0 = verts[1];
    shape.moveTo(v0.x * SHIP_SCALE, v0.y * SHIP_SCALE);
    for (var i = 2; i <= maxv; i++) {
      var vi = verts[i];
      shape.lineTo(vi.x * SHIP_SCALE, vi.y * SHIP_SCALE);
    }
  }

  /* Extrude settings */
  var extrudeSettings = {
    depth: SHIP_HEIGHT,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 1
  };

  var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  /* Center the geometry so the ship's pivot is at its center */
  geometry.center();

  /* Create a multi-material mesh: body + accent edges */
  var bodyMaterial = new THREE.MeshPhongMaterial({
    color: fc.body,
    emissive: fc.glow,
    emissiveIntensity: 0.15,
    shininess: 80,
    flatShading: true
  });

  var mesh = new THREE.Mesh(geometry, bodyMaterial);

  /* Add wireframe edges for detail */
  var edgeGeo = new THREE.EdgesGeometry(geometry);
  var edgeMat = new THREE.LineBasicMaterial({
    color: fc.accent,
    transparent: true,
    opacity: 0.4
  });
  var edges = new THREE.LineSegments(edgeGeo, edgeMat);
  mesh.add(edges);

  /* Rotate so the ship lies flat on XZ plane (originally extruded along Y) */
  mesh.rotation.x = -Math.PI / 2;

  return mesh;
}

/*
 * Create a pre-built ship mesh for a specific type and faction.
 * Uses the original 2D vertex data hardcoded here.
 */
function createShipByType(type, faction) {
  /*
   * Ship model definitions — copied from original renderer.js erzeuge()
   * These are the 2D vertex arrays, 1-indexed.
   *
   * Type 1: Jager (fighter)
   * Type 2: Adv Jager (advanced fighter)
   * Type 3: Bomber
   * Type 10-12: Transporter
   */

  var models = {};

  /* --- Faction 1 models --- */
  /* Jager f1 (a1) - arrow shape, 6 verts */
  models['1_1'] = {
    v: [null,
      {x:-10,y:0}, {x:-6,y:-5}, {x:10,y:0},
      {x:-6,y:5}, {x:-10,y:0}, {x:-6,y:0}
    ],
    maxv: 6
  };
  /* Adv Jager f1 (b1) - diamond, 7 verts */
  models['2_1'] = {
    v: [null,
      {x:-12,y:0}, {x:-8,y:-6}, {x:12,y:0},
      {x:-8,y:6}, {x:-12,y:0}, {x:-4,y:-3}, {x:-4,y:3}
    ],
    maxv: 7
  };
  /* Bomber f1 (c1) - complex, 10 verts */
  models['3_1'] = {
    v: [null,
      {x:-15,y:0}, {x:-10,y:-8}, {x:0,y:-12},
      {x:15,y:0}, {x:0,y:12}, {x:-10,y:8},
      {x:-15,y:0}, {x:-5,y:-4}, {x:-5,y:4}, {x:5,y:0}
    ],
    maxv: 10
  };
  /* Transporter f1 (k1m) - 10 verts */
  models['10_1'] = {
    v: [null,
      {x:-15,y:0}, {x:-10,y:-8}, {x:0,y:-10},
      {x:10,y:-8}, {x:15,y:0}, {x:10,y:8},
      {x:0,y:10}, {x:-10,y:8}, {x:-15,y:0}, {x:0,y:0}
    ],
    maxv: 10
  };

  /* --- Faction 2 models --- */
  models['1_2'] = {
    v: [null,
      {x:-8,y:0}, {x:-4,y:-6}, {x:8,y:-8},
      {x:12,y:0}, {x:8,y:8}, {x:-4,y:6},
      {x:-8,y:0}, {x:-2,y:-3}, {x:-2,y:3}, {x:4,y:0}
    ],
    maxv: 10
  };
  models['2_2'] = {
    v: [null,
      {x:-10,y:0}, {x:-6,y:-8}, {x:4,y:-10},
      {x:10,y:0}, {x:4,y:10}, {x:-6,y:8},
      {x:-10,y:0}, {x:-3,y:-4}, {x:-3,y:4}, {x:3,y:0}
    ],
    maxv: 10
  };
  models['3_2'] = {
    v: [null,
      {x:-18,y:0}, {x:-12,y:-10}, {x:-4,y:-14},
      {x:8,y:-12}, {x:14,y:-6}, {x:18,y:0},
      {x:14,y:6}, {x:8,y:12}, {x:-4,y:14},
      {x:-12,y:10}, {x:-18,y:0}, {x:-6,y:-5},
      {x:-6,y:5}, {x:6,y:0}
    ],
    maxv: 14
  };
  models['10_2'] = {
    v: [null,
      {x:-14,y:0}, {x:-8,y:-8}, {x:0,y:-10},
      {x:8,y:-8}, {x:14,y:0}, {x:8,y:8},
      {x:0,y:10}, {x:-8,y:8}, {x:-14,y:0},
      {x:0,y:-3}, {x:0,y:3}
    ],
    maxv: 11
  };

  /* --- Faction 3 models --- */
  models['1_3'] = {
    v: [null,
      {x:-8,y:0}, {x:-4,y:-5}, {x:8,y:0},
      {x:-4,y:5}, {x:-8,y:0}, {x:0,y:-3},
      {x:0,y:3}, {x:4,y:0}
    ],
    maxv: 8
  };
  models['2_3'] = {
    v: [null,
      {x:-10,y:0}, {x:-6,y:-7}, {x:2,y:-10},
      {x:10,y:0}, {x:2,y:10}, {x:-6,y:7},
      {x:-10,y:0}, {x:-2,y:-3}, {x:-2,y:3}, {x:4,y:0}
    ],
    maxv: 10
  };
  models['3_3'] = {
    v: [null,
      {x:-16,y:0}, {x:-10,y:-8}, {x:0,y:-12},
      {x:10,y:-8}, {x:16,y:0}, {x:10,y:8},
      {x:0,y:12}, {x:-10,y:8}, {x:-16,y:0},
      {x:-4,y:-4}, {x:-4,y:4}, {x:6,y:0}
    ],
    maxv: 12
  };
  models['10_3'] = {
    v: [null,
      {x:-14,y:0}, {x:-8,y:-8}, {x:0,y:-10},
      {x:8,y:-8}, {x:14,y:0}, {x:8,y:8},
      {x:0,y:10}, {x:-8,y:8}, {x:-14,y:0},
      {x:0,y:-3}, {x:0,y:3}
    ],
    maxv: 11
  };

  var key = type + '_' + faction;
  var model = models[key];

  if (!model) {
    /* Fallback: simple box */
    var fc = FACTION_COLORS[faction];
    var geo = new THREE.BoxGeometry(3, 3, 3);
    var mat = new THREE.MeshPhongMaterial({ color: fc.body });
    var m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  return createShipMesh(model.v, null, model.maxv, faction);
}

/*
 * Get the visual type from the internal ship type.
 * Maps faction-specific types to visual categories.
 * Type 1,4,7  -> Jager (fighter)
 * Type 2,5,8  -> Adv Jager
 * Type 3,6,9  -> Bomber
 * Type 10,11,12 -> Transporter
 */
function getShipVisualType(type) {
  if (type <= 0) return null;
  if (type <= 3) return type;        // 1=Jager, 2=AdvJager, 3=Bomber for faction 1
  if (type <= 6) return type - 3;    // faction 2
  if (type <= 9) return type - 6;    // faction 3
  return type - 9;                   // 10,11,12 -> transporter variants
}

function getShipCategory(type) {
  var vt = getShipVisualType(type);
  if (vt === 1) return 'fighter';
  if (vt === 2) return 'advfighter';
  if (vt === 3) return 'bomber';
  return 'transporter';
}

function getShipModelKey(type) {
  var cat = getShipCategory(type);
  if (cat === 'fighter') return 1;
  if (cat === 'advfighter') return 2;
  if (cat === 'bomber') return 3;
  return 10;
}

/*
 * Create a 3D planet mesh.
 * Sphere with a custom texture for sector colors.
 */
/*
 * Simple value noise function (Perlin-like) for procedural terrain.
 * Returns 0..1 based on (x, y) position and seed.
 */
function noise2D(x, y, seed) {
  var n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
  return n - Math.floor(n);
}

/*
 * Smooth interpolation for smoother noise.
 */
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/*
 * Smoothed value noise with bilinear interpolation.
 */
function smoothNoise(x, y, seed) {
  var ix = Math.floor(x);
  var iy = Math.floor(y);
  var fx = x - ix;
  var fy = y - iy;

  var a = noise2D(ix, iy, seed);
  var b = noise2D(ix + 1, iy, seed);
  c = noise2D(ix, iy + 1, seed);
  var d = noise2D(ix + 1, iy + 1, seed);

  var ux = smoothstep(fx);
  var uy = smoothstep(fy);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/*
 * Multi-octave noise with larger scale for coarse terrain features.
 */
function fbmNoise(x, y, seed, octaves) {
  var value = 0;
  var amplitude = 0.5;
  var frequency = 1;
  for (var o = 0; o < octaves; o++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency, seed + o * 100);
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

/*
 * Generate a random planet surface texture (procedural, realistic).
 * Returns an object with {colorCanvas, bumpCanvas}.
 * Planet types: ocean world, desert, rocky, ice, forest.
 */
function generatePlanetSurfaceTexture() {
  var w = 256, h = 128;

  /* Color canvas */
  var colorC = document.createElement('canvas');
  colorC.width = w;
  colorC.height = h;
  var colorCtx = colorC.getContext('2d');

  /* Bump map canvas (greyscale — bright = high, dark = low) */
  var bumpC = document.createElement('canvas');
  bumpC.width = w;
  bumpC.height = h;
  var bumpCtx = bumpC.getContext('2d');

  /* Choose planet type */
  var typeRoll = Math.random();
  var planetType;
  if (typeRoll < 0.25) planetType = 'ocean';
  else if (typeRoll < 0.45) planetType = 'desert';
  else if (typeRoll < 0.65) planetType = 'rocky';
  else if (typeRoll < 0.8) planetType = 'ice';
  else planetType = 'forest';

  var seed = Math.random() * 10000;

  /* Color palettes per type — solid, distinct colors */
  var palettes = {
    ocean:  { water: [25, 75, 165],   shallow: [50, 140, 200],  land: [55, 145, 55],   highland: [130, 115, 70],  snow: [245, 245, 252] },
    desert: { water: [170, 130, 85],  shallow: [200, 170, 115], land: [215, 185, 105],  highland: [175, 145, 85],  snow: [230, 220, 210] },
    rocky:  { water: [55, 55, 65],    shallow: [75, 75, 85],    land: [120, 110, 95],   highland: [90, 82, 75],    snow: [185, 185, 190] },
    ice:    { water: [110, 150, 180], shallow: [160, 190, 210], land: [210, 218, 228],  highland: [228, 232, 238], snow: [250, 252, 255] },
    forest: { water: [35, 90, 140],   shallow: [55, 140, 180],  land: [35, 115, 40],    highland: [70, 90, 45],    snow: [235, 240, 245] }
  };

  var pal = palettes[planetType];
  var waterLevel = planetType === 'ocean' ? 0.45 : (planetType === 'desert' ? 0.2 : 0.3);

  var colorData = colorCtx.createImageData(w, h);
  var bumpData = bumpCtx.createImageData(w, h);
  var cd = colorData.data;
  var bd = bumpData.data;

  for (var py = 0; py < h; py++) {
    for (var px = 0; px < w; px++) {
      var nx = px / w;
      var ny = py / h;

      /* Coarse terrain height — low frequency for large features */
      var height = fbmNoise(nx * 3, ny * 3, seed, 3);

      /* Latitude variation (polar caps) */
      var lat = Math.abs(ny - 0.5) * 2; /* 0 = equator, 1 = pole */
      var polarFactor = Math.pow(lat, 3);

      /* Sharpen the height to create distinct regions (less blending) */
      height = height * 2 - 1; /* -1 to 1 */
      height = height * height * Math.sign(height); /* sharpen */
      height = (height + 1) / 2; /* back to 0-1 */
      height = Math.max(0, Math.min(1, height));

      /* Determine color based on height — sharp transitions */
      var r, g, b, bumpVal;

      if (height < waterLevel * 0.65) {
        /* Deep water */
        r = pal.water[0]; g = pal.water[1]; b = pal.water[2];
        bumpVal = 0;
      } else if (height < waterLevel * 0.85) {
        /* Shallow water */
        r = pal.shallow[0]; g = pal.shallow[1]; b = pal.shallow[2];
        bumpVal = 30;
      } else if (height < waterLevel + 0.12) {
        /* Lowland / coast */
        r = pal.land[0]; g = pal.land[1]; b = pal.land[2];
        bumpVal = 100;
      } else if (height < 0.65) {
        /* Highland */
        r = pal.highland[0]; g = pal.highland[1]; b = pal.highland[2];
        bumpVal = 170;
      } else {
        /* Mountain / snow */
        var snowStart = 0.4 - polarFactor * 0.25;
        if (height > snowStart || polarFactor > 0.65) {
          r = pal.snow[0]; g = pal.snow[1]; b = pal.snow[2];
          bumpVal = 255;
        } else {
          r = pal.highland[0]; g = pal.highland[1]; b = pal.highland[2];
          bumpVal = 190;
        }
      }

      /* Subtle micro noise only — much less than before */
      var microNoise = (noise2D(px * 0.5, py * 0.5, seed + 777) - 0.5) * 8;
      r = Math.max(0, Math.min(255, r + microNoise));
      g = Math.max(0, Math.min(255, g + microNoise));
      b = Math.max(0, Math.min(255, b + microNoise));

      var idx = (py * w + px) * 4;
      cd[idx]     = r;
      cd[idx + 1] = g;
      cd[idx + 2] = b;
      cd[idx + 3] = 255;

      bd[idx]     = bumpVal;
      bd[idx + 1] = bumpVal;
      bd[idx + 2] = bumpVal;
      bd[idx + 3] = 255;
    }
  }

  colorCtx.putImageData(colorData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);

  return { colorCanvas: colorC, bumpCanvas: bumpC };
}

function createPlanetMesh(radius, sectorColors) {
  /* Create sphere with more segments for better bump mapping */
  var geometry = new THREE.SphereGeometry(radius, 32, 24);

  /* Generate procedural planet surface */
  var textures = generatePlanetSurfaceTexture();

  var colorTexture = new THREE.CanvasTexture(textures.colorCanvas);
  var bumpTexture = new THREE.CanvasTexture(textures.bumpCanvas);

  var material = new THREE.MeshPhongMaterial({
    map: colorTexture,
    bumpMap: bumpTexture,
    bumpScale: 5,
    shininess: 15,
    flatShading: false
  });

  var mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

/*
 * Create planet atmosphere glow.
 */
function createPlanetAtmosphere(radius, color) {
  var geometry = new THREE.SphereGeometry(radius * 1.15, 24, 16);
  var material = new THREE.MeshPhongMaterial({
    color: color,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide
  });
  return new THREE.Mesh(geometry, material);
}

/*
 * Convert original game color index to hex color string.
 */
function colorToHex(colorIdx) {
  var palette = [
    '#000000', '#880000', '#008800', '#888800',
    '#000088', '#880088', '#008888', '#888888',
    '#888888', '#ff0000', '#00ff00', '#ffff00',
    '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
  ];
  return palette[colorIdx] || '#888888';
}

/*
 * Create an explosion effect (particle system).
 */
function createExplosion(position, color) {
  var particleCount = 16;
  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(particleCount * 3);
  var velocities = [];

  for (var i = 0; i < particleCount; i++) {
    /* Start at origin (0,0,0) — mesh position places the explosion */
    positions[i * 3]     = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    /* 3D sphere distribution — equal spread in all directions */
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    var speed = 1 + Math.random() * 3;
    velocities.push({
      x: speed * Math.sin(phi) * Math.cos(theta),
      y: speed * Math.sin(phi) * Math.sin(theta),
      z: speed * Math.cos(phi)
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  var material = new THREE.PointsMaterial({
    color: color || 0xffff00,
    size: 2,
    transparent: true,
    opacity: 1,
    sizeAttenuation: false
  });

  var points = new THREE.Points(geometry, material);
  points.userData.velocities = velocities;
  points.userData.life = 150;
  points.userData.maxLife = 150;

  return points;
}

/*
 * Create a continuous firework-like spray effect for dying ships.
 * Emits a few sparks per frame in random 3D directions.
 */
function createDyingSpray(position, color) {
  var group = new THREE.Group();

  /* Pool of spark particles — reused each frame */
  var maxSparks = 64;
  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(maxSparks * 3);
  var lifetimes = new Float32Array(maxSparks);  // 0 = inactive
  var velocities = [];

  for (var i = 0; i < maxSparks; i++) {
    positions[i * 3]     = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    lifetimes[i] = 0;
    velocities.push({ x: 0, y: 0, z: 0 });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  var material = new THREE.PointsMaterial({
    color: color || 0xffaa00,
    size: 3,
    transparent: true,
    opacity: 1,
    sizeAttenuation: false
  });

  var points = new THREE.Points(geometry, material);
  points.userData.velocities = velocities;
  points.userData.lifetimes = lifetimes;
  points.userData.maxSparks = maxSparks;
  points.userData.life = 150;  /* Total lifetime in frames */
  points.userData.maxLife = 150;

  group.add(points);
  group.userData.life = 200;  /* Total lifetime — cover full dying period */
  group.userData.maxLife = 200;
  group.userData.isDyingSpray = true;

  return group;
}

/*
 * Create a final explosion effect — larger, more particles, with blast ring.
 * momentum: ship velocity vector (for mass inertia effect)
 */
function createFinalExplosion(position, color, momentum) {
  var group = new THREE.Group();

  /* --- Outer blast ring (expanding torus) --- */
  var ringGeo = new THREE.TorusGeometry(4, 1, 8, 32);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0x8899bb,  /* gray-blue */
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.userData.isBlastRing = true;
  ring.userData.blastSpeed = 0.3;  /* expansion per frame */
  group.add(ring);

  /* --- More particles, wider spread --- */
  var particleCount = 64;
  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(particleCount * 3);
  var velocities = [];

  /* Ship momentum — particles carry the ship's flight direction (strong bias) */
  var mX = momentum ? momentum.x * 3 : 0;
  var mZ = momentum ? momentum.y * 3 : 0;

  for (var i = 0; i < particleCount; i++) {
    /* Particles start at group origin (0,0,0) — group.position handles world placement */
    positions[i * 3]     = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    /* Explosion burst (wide spray) + ship momentum (dominant direction) */
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);
    var speed = 2 + Math.random() * 5;
    velocities.push({
      x: speed * Math.sin(phi) * Math.cos(theta) + mX,
      y: speed * Math.sin(phi) * Math.sin(theta),
      z: speed * Math.cos(phi) + mZ
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  var material = new THREE.PointsMaterial({
    color: color || 0xffff00,
    size: 10,
    transparent: true,
    opacity: 1,
    sizeAttenuation: true
  });

  var points = new THREE.Points(geometry, material);
  points.userData.velocities = velocities;
  points.userData.life = 60;
  points.userData.maxLife = 60;
  group.add(points);

  group.userData.life = 60;
  group.userData.maxLife = 60;
  group.position.set(position.x, position.y, position.z);

  return group;
}

/*
 * Create a projectile mesh (small glowing sphere).
 */
function createProjectileMesh(color) {
  var geometry = new THREE.SphereGeometry(0.5, 6, 4);
  var material = new THREE.MeshPhongMaterial({
    color: color || 0xffffff,
    emissive: color || 0xffffff,
    emissiveIntensity: 0.8
  });
  return new THREE.Mesh(geometry, material);
}

/*
 * Create a rocket mesh — pointed nose, body, engine glow at rear.
 */
function createRocketMesh(color) {
  var group = new THREE.Group();

  /* Nose cone (red) */
  var noseGeo = new THREE.ConeGeometry(0.8, 2.4, 6);
  var noseMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  var nose = new THREE.Mesh(noseGeo, noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 4.2;
  group.add(nose);

  /* Body (red) */
  var bodyGeo = new THREE.CylinderGeometry(0.6, 0.8, 6.0, 6);
  var bodyMat = new THREE.MeshBasicMaterial({ color: 0xcc2200 });
  var body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.6;
  group.add(body);

  /* Engine glow (orange/red) */
  var engineGeo = new THREE.ConeGeometry(0.9, 1.8, 6);
  var engineMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.8
  });
  var engine = new THREE.Mesh(engineGeo, engineMat);
  engine.rotation.x = -Math.PI / 2;
  engine.position.z = -3.6;
  engine.userData.isEngine = true;
  group.add(engine);

  return group;
}

/*
 * Create a smart missile mesh — sleek, blue/purple with afterburner.
 */
function createSmartMissileMesh() {
  var group = new THREE.Group();

  /* Nose cone (bright purple) */
  var noseGeo = new THREE.ConeGeometry(0.8, 2.4, 6);
  var noseMat = new THREE.MeshBasicMaterial({ color: 0xaa44ff });
  var nose = new THREE.Mesh(noseGeo, noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 4.2;
  group.add(nose);

  /* Body (dark purple) */
  var bodyGeo = new THREE.CylinderGeometry(0.6, 0.8, 6.0, 6);
  var bodyMat = new THREE.MeshBasicMaterial({ color: 0x7733cc });
  var body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.6;
  group.add(body);

  /* Engine glow (purple) */
  var engineGeo = new THREE.ConeGeometry(0.9, 1.8, 6);
  var engineMat = new THREE.MeshBasicMaterial({
    color: 0xaa66ff,
    transparent: true,
    opacity: 0.8
  });
  var engine = new THREE.Mesh(engineGeo, engineMat);
  engine.rotation.x = -Math.PI / 2;
  engine.position.z = -3.6;
  engine.userData.isEngine = true;
  group.add(engine);

  return group;
}

/*
 * Create a 3D shield hit effect — expanding ring at impact point.
 */
function createShieldHit(position, dir) {
  var geo = new THREE.SphereGeometry(12, 16, 12);
  var mat = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x, position.y, position.z);
  mesh.userData.isShieldHit = true;
  return mesh;
}
/*
 * Create a planet info group: 3D bars for living conditions + production + name label.
 * Positioned above the planet.
 */
function createPlanetInfoGroup(planetIndex) {
  var group = new THREE.Group();
  group.userData.planetIndex = planetIndex;
  group.userData.nameSprite = null;

  /* === Konstanten === */
  var barHeight = 3;
  var barMaxWidth = 100;
  var gap = 1;
  var barSpacing = barHeight + gap;
  var startY = 77;  /* Top faction bar — lifted above planet */

  /* Faction bars occupy: startY (77) down to startY - 2*barSpacing = 71 */
  /* Sector bar below faction bars with gap */
  var sectorBarY = 62;
  /* Production bar below sector bar */
  var prodBarY = 54;

  /* === Faction bars: Hintergrund + Fill-Meshes (einmalig) === */
  var barColors = [0x00ffff, 0x00ff00, 0xffffff];
  group.userData.bgBars = [];
  group.userData.fillBars = [];

  for (var f = 0; f < 3; f++) {
    /* Hintergrund-Bar */
    var bgGeo = new THREE.BoxGeometry(barMaxWidth, barHeight, barHeight);
    var bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7 });
    var bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, startY - f * barSpacing, 0);
    group.add(bgMesh);
    group.userData.bgBars.push(bgMesh);

    /* Fill-Bar (skaliert zur Laufzeit) */
    var fillGeo = new THREE.BoxGeometry(barMaxWidth, barHeight, barHeight);
    var fillMat = new THREE.MeshBasicMaterial({
      color: barColors[f],
      transparent: true,
      opacity: 0.9
    });
    var fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.set(0, startY - f * barSpacing, 0);
    fillMesh.scale.x = 0; /* unsichtbar, wird in updatePlanetBars3D gesetzt */
    group.add(fillMesh);
    group.userData.fillBars.push(fillMesh);
  }

  /* === Produktions-Bar: gelber Bau-Fortschritt, dicker, unter Sektor-Bar === */
  var prodGeo = new THREE.BoxGeometry(80, 3, 3);
  var prodMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.9
  });
  var prodBar = new THREE.Mesh(prodGeo, prodMat);
  prodBar.position.set(-40, prodBarY, 0);
  prodBar.scale.x = 0;
  prodBar.visible = false;
  group.add(prodBar);
  group.userData.prodBar = prodBar;

  /* === Sektor-Bar: Canvas + Texture + Sprite (einmalig) === */
  var canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 32;
  var ctx = canvas.getContext('2d');
  group.userData.sectorCanvas = canvas;
  group.userData.sectorCtx = ctx;

  var texture = new THREE.CanvasTexture(canvas);
  var spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95
  });
  var sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(100, 20, 1);
  sprite.position.set(0, sectorBarY, 0);
  group.add(sprite);
  group.userData.sectorTexture = texture;
  group.userData.sectorSprite = sprite;

  return group;
}

/*
 * Update 3D living-condition bars for a planet.
 * Nur Eigenschaften aktualisieren — keine neuen Objekte.
 */
function updatePlanetBars3D(planetIndex) {
  var planet = planets[planetIndex];
  if (!planet) return;

  var pm = planetMeshes[planetIndex];
  if (!pm || !pm.infoGroup) return;

  var group = pm.infoGroup;
  var barMaxWidth = 100;

  for (var f = 0; f < 3; f++) {
    var fData = planet.k[f];
    var fillRatio = fData.f / 100;
    var barWidth = fillRatio * barMaxWidth;

    /* Fill-Scale und Position aktualisieren */
    var fillBar = group.userData.fillBars[f];
    fillBar.scale.x = fillRatio;
    fillBar.position.x = -barMaxWidth / 2 + barWidth / 2;

    /* Hintergrund-Farbe bei Kriegszustand */
    var bgBar = group.userData.bgBars[f];
    bgBar.material.color.setHex(planet.war ? 0x440000 : 0x333333);
  }
}

/*
 * Update 3D production progress bar for a planet.
 * Nur Eigenschaften aktualisieren — kein neues Objekt.
 */
function updatePlanetProdBar3D(planetIndex) {
  var planet = planets[planetIndex];
  if (!planet) return;

  var pm = planetMeshes[planetIndex];
  if (!pm || !pm.infoGroup) return;

  var group = pm.infoGroup;
  var prodBar = group.userData.prodBar;
  var barMaxW = 80;

  /* Nur anzeigen, wenn Produktion aktiv */
  if (planet.k[snr - 1].a > 0 && planet.k[snr - 1].auf > 0) {
    var progress = planet.k[snr - 1].x / planet.k[snr - 1].max;
    var barLen = progress * barMaxW;

    prodBar.scale.x = progress;
    prodBar.position.x = -barMaxW / 2 + barLen / 2;
    prodBar.visible = true;
  } else {
    prodBar.visible = false;
  }
}

/*
 * Update sector bar above planet.
 * Nur Canvas neu zeichnen und Texture updaten — kein neues Objekt.
 */
function updatePlanetSectorBar3D(planetIndex) {
  var planet = planets[planetIndex];
  if (!planet) return;

  var pm = planetMeshes[planetIndex];
  if (!pm || !pm.infoGroup) return;

  var group = pm.infoGroup;
  var ctx = group.userData.sectorCtx;
  var canvas = group.userData.sectorCanvas;
  var texture = group.userData.sectorTexture;

  /* Hintergrund */
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* 8 Sektor-Blöcke zeichnen */
  var blockW = 18;
  var blockH = 20;
  var gap = 2;
  var startX = (canvas.width - 8 * (blockW + gap) + gap) / 2;
  var startY = (canvas.height - blockH) / 2;

  for (var s = 0; s < 8; s++) {
    var colorIdx = s < planet.f.length ? planet.f[s] : 8;
    ctx.fillStyle = colorToHex(colorIdx);
    ctx.fillRect(startX + s * (blockW + gap), startY, blockW, blockH);
    /* Rahmen */
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX + s * (blockW + gap), startY, blockW, blockH);
  }

  /* Texture-Update markieren */
  texture.needsUpdate = true;
}

/*
 * Pre-allocate all effect meshes once.
 * Called from initThreeScene() after effectsGroup is created.
 * Meshes are hidden by default and toggled via .visible in updateEffects3D.
 */
function initEffectMeshes() {
  for (var i = 0; i < ammo.length; i++) {
    ammo[i].mesh3d = createProjectileMesh(0xffffff);
    ammo[i].mesh3d.visible = false;
    effectsGroup.add(ammo[i].mesh3d);
  }
  for (var i = 0; i < rockets.length; i++) {
    rockets[i].mesh3d = createRocketMesh(0xffff00);
    rockets[i].mesh3d.visible = false;
    effectsGroup.add(rockets[i].mesh3d);
  }
  for (var i = 0; i < smartMissiles.length; i++) {
    smartMissiles[i].mesh3d = createSmartMissileMesh();
    smartMissiles[i].mesh3d.visible = false;
    effectsGroup.add(smartMissiles[i].mesh3d);
  }
  for (var i = 0; i < explosions.length; i++) {
    explosions[i].mesh3d = createExplosion({ x: 0, y: WORLD_HEIGHT, z: 0 }, 0xffff00);
    explosions[i].mesh3d.visible = false;
    effectsGroup.add(explosions[i].mesh3d);
  }
  for (var i = 0; i < shieldHits.length; i++) {
    shieldHits[i].mesh3d = createShieldHit({ x: 0, y: WORLD_HEIGHT, z: 0 }, { x: 1, y: 0 });
    shieldHits[i].mesh3d.visible = false;
    effectsGroup.add(shieldHits[i].mesh3d);
  }
}

/*
 * Create a 3D name label (sprite) for a planet.
 */
function createPlanetNameSprite(name) {
  var canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  var ctx = canvas.getContext('2d');
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 32);

  var texture = new THREE.CanvasTexture(canvas);
  var material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9
  });
  var sprite = new THREE.Sprite(material);
  sprite.scale.set(80, 20, 1);
  sprite.position.set(0, 84, 0);
  return sprite;
}

/* ================================================================ */
/* 3D Ship Selection Frame — billboarded, always faces camera       */
/* Looks like the original rahmenbild: bracket frame + bars          */
/* ================================================================ */

/* Frame dimensions in 3D world units */
var FRAME_HALF_W = 8 * 1.7;   /* half width — scaled up for ships */
var FRAME_HALF_H = 6 * 1.7;   /* half height — scaled up for ships */
var FRAME_INNER = 3 * 1.7;    /* inner corner offset */
var BAR_THICKNESS = 1.2;      /* thicker bars for visibility */

/* Frame Y position relative to ship — on ship level (visible from side) */
var FRAME_Y_OFFSET = 0;

/* Pool of selection frame groups — one per ship slot */
var selectionFrameMeshes = [];

/* Create a selection frame group for a ship slot */
function createSelectionFrame() {
  var group = new THREE.Group();
  group.visible = false;
  group.position.y = FRAME_Y_OFFSET;
  group.userData.isSelectionFrame = true;

  /* Materials for each part */
  var frameMat = new THREE.MeshBasicMaterial({
    color: 0x888888, /* gray - VGA color 7 */
    transparent: true, opacity: 0.85, depthWrite: false
  });
  var armorMat = new THREE.MeshBasicMaterial({
    color: 0xff0000, /* red - VGA color 4 */
    transparent: true, opacity: 0.9, depthWrite: false
  });
  var shieldMat = new THREE.MeshBasicMaterial({
    color: 0xffff55, /* bright yellow - VGA color 11 */
    transparent: true, opacity: 0.9, depthWrite: false
  });

  /* --- Gray bracket corners (4 L-shapes) --- */
  /* Top-left corner */
  var tlH = makeBar(FRAME_HALF_W - FRAME_INNER, BAR_THICKNESS);
  tlH.position.set(-FRAME_HALF_W / 2 + (FRAME_HALF_W - FRAME_INNER) / 2, FRAME_HALF_H, 0);
  tlH.material = frameMat.clone();
  group.add(tlH);

  var tlV = makeBar(BAR_THICKNESS, FRAME_HALF_H - FRAME_INNER);
  tlV.position.set(-FRAME_HALF_W, (FRAME_HALF_H + FRAME_INNER) / 2, 0);
  tlV.material = frameMat.clone();
  group.add(tlV);

  /* Top-right corner */
  var trH = makeBar(FRAME_HALF_W - FRAME_INNER, BAR_THICKNESS);
  trH.position.set(FRAME_HALF_W / 2 - (FRAME_HALF_W - FRAME_INNER) / 2, FRAME_HALF_H, 0);
  trH.material = frameMat.clone();
  group.add(trH);

  var trV = makeBar(BAR_THICKNESS, FRAME_HALF_H - FRAME_INNER);
  trV.position.set(FRAME_HALF_W, (FRAME_HALF_H + FRAME_INNER) / 2, 0);
  trV.material = frameMat.clone();
  group.add(trV);

  /* Bottom-left corner */
  var blV = makeBar(BAR_THICKNESS, FRAME_HALF_H - FRAME_INNER);
  blV.position.set(-FRAME_HALF_W, -(FRAME_HALF_H + FRAME_INNER) / 2, 0);
  blV.material = frameMat.clone();
  group.add(blV);

  var blH = makeBar(FRAME_HALF_W - FRAME_INNER, BAR_THICKNESS);
  blH.position.set(-FRAME_HALF_W / 2 + (FRAME_HALF_W - FRAME_INNER) / 2, -FRAME_HALF_H, 0);
  blH.material = frameMat.clone();
  group.add(blH);

  /* Bottom-right corner */
  var brV = makeBar(BAR_THICKNESS, FRAME_HALF_H - FRAME_INNER);
  brV.position.set(FRAME_HALF_W, -(FRAME_HALF_H + FRAME_INNER) / 2, 0);
  brV.material = frameMat.clone();
  group.add(brV);

  var brH = makeBar(FRAME_HALF_W - FRAME_INNER, BAR_THICKNESS);
  brH.position.set(FRAME_HALF_W / 2 - (FRAME_HALF_W - FRAME_INNER) / 2, -FRAME_HALF_H, 0);
  brH.material = frameMat.clone();
  group.add(brH);

  /* --- Armor bar (red, top edge, fills from left) --- */
  var armorBar = makeBar(FRAME_HALF_W * 2 - BAR_THICKNESS * 2, BAR_THICKNESS);
  armorBar.position.set(0, FRAME_HALF_H, 0);
  armorBar.material = armorMat.clone();
  group.add(armorBar);
  group.userData.armorBar = armorBar;

  /* --- Shield bar (yellow, bottom edge, fills from left) --- */
  var shieldBar = makeBar(FRAME_HALF_W * 2 - BAR_THICKNESS * 2, BAR_THICKNESS);
  shieldBar.position.set(0, -FRAME_HALF_H, 0);
  shieldBar.material = shieldMat.clone();
  group.add(shieldBar);
  group.userData.shieldBar = shieldBar;

  return group;
}

/* Helper: create a flat bar (plane) with given width and height */
function makeBar(width, height) {
  var geo = new THREE.PlaneGeometry(width, height);
  var mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.8,
    depthWrite: false, side: THREE.DoubleSide
  });
  return new THREE.Mesh(geo, mat);
}

/* Initialize selection frames for all ship slots */
function initSelectionFrames() {
  for (var i = 0; i < maxships; i++) {
    selectionFrameMeshes[i] = createSelectionFrame();
    shipsGroup.add(selectionFrameMeshes[i]);
  }
}

/* Update a selection frame with ship status data */
function updateSelectionFrameData(frame, ship) {
  if (!frame || !frame.userData.armorBar || !frame.userData.shieldBar) return;

  var p = ship.panz;
  var pm = ship.pm;
  var s = ship.shield;
  var sm = ship.sx;

  /* Armor ratio */
  var armorRatio = pm > 0 ? Math.min(1, p / pm) : 0;
  var armorBar = frame.userData.armorBar;
  var fullW = FRAME_HALF_W * 2 - BAR_THICKNESS * 2;
  armorBar.scale.x = armorRatio;
  /* Shift position so it fills from left */
  armorBar.position.x = -fullW / 2 + (fullW * armorRatio) / 2;

  /* Shield ratio */
  var shieldRatio = sm > 0 ? Math.min(1, s / sm) : 0;
  var shieldBar = frame.userData.shieldBar;
  shieldBar.scale.x = shieldRatio;
  shieldBar.position.x = -fullW / 2 + (fullW * shieldRatio) / 2;
}
