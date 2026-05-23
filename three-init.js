/* three-init.js — Three.js scene, camera, renderer, lights, starfield

 * CAMERA: Orthographic, top-down (looking straight down Y axis).
 * This gives a clean "2D game in 3D" view where ships show their
 * shape and orientation correctly from above.
 */

function initThree() {
  /* --- WebGL Renderer --- */
  var canvas3D = document.getElementById('gameCanvas3D');
  renderer3D = new THREE.WebGLRenderer({
    canvas: canvas3D,
    antialias: true,
    alpha: false
  });
  /* Size to game area only, not the full window */
  var gameAreaW = GameAreaWidth + CLIP_MARGIN;
  renderer3D.setSize(gameAreaW, curH);
  renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer3D.shadowMap.enabled = false;

  /* --- Scene --- */
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020208);
  scene.fog = new THREE.FogExp2(0x020208, 0.00006);

  /* --- Orthographic Camera (top-down) --- */
  /*
   * The game world is 4000x4000. We center it at origin (0,0,0).
   * Camera looks straight down from +Y towards -Y.
   * Frustum size is adjusted by zoomScale.
   */
  /* Perspective camera — tilt angle controlled by slider (0° = top-down) */
  var fov = 50;
  var gameAreaW = GameAreaWidth + CLIP_MARGIN;
  var aspect = gameAreaW / curH;
  camera = new THREE.PerspectiveCamera(fov, aspect, 0.5, 20000);
  camera.position.set(0, 2000, 0);
  camera.lookAt(0, 0, 0);

  /* --- Lights --- */
  var ambient = new THREE.AmbientLight(0x606080, 0.8);
  scene.add(ambient);

  var dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(0, 1000, 500); /* from above and slightly forward */
  scene.add(dirLight);

  var hemiLight = new THREE.HemisphereLight(0x8080a0, 0x303050, 0.5);
  scene.add(hemiLight);

  /* --- Object groups --- */
  shipsGroup = new THREE.Group();
  shipsGroup.name = 'ships';
  scene.add(shipsGroup);

  planetsGroup = new THREE.Group();
  planetsGroup.name = 'planets';
  scene.add(planetsGroup);

  effectsGroup = new THREE.Group();
  effectsGroup.name = 'effects';
  scene.add(effectsGroup);

  /* Shared shader material for all particle systems (trails + sprays)
   * Uses alive attribute to hide inactive particles via gl_PointSize = 0
   * Uses alpha attribute for transparency instead of color fading
   */
  particleShaderMaterial = createParticleShaderMaterial();

  /* Shared shader material for planetary shields */
  shieldShaderMaterial = createShieldShaderMaterial();

  /* --- Starfield --- */
  createStarField();

  /* --- 2D Overlay Canvas --- */
  overlayCanvas = document.getElementById('uiOverlay');
  overlayCtx = overlayCanvas.getContext('2d');

  /* --- Init ship meshes array --- */
  for (var i = 0; i < maxships; i++) {
    shipMeshes[i] = null;
  }

  /* --- Init shield sphere meshes array --- */
  for (var i = 0; i < maxpl; i++) {
    shieldMeshes[i] = null;
  }

  /* --- Pre-allocate effect meshes (ammo, rockets, missiles, explosions, shield hits) --- */
  initEffectMeshes();
}

function updateCameraFromZoom() {
  if (!camera) return;
  /* Adjust FOV to simulate zoom (PerspectiveCamera only) */
  var baseFov = 50;
  camera.fov = baseFov / zoomScale;
  camera.updateProjectionMatrix();
}

function createStarField() {
  var starCount = 2000;
  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(starCount * 3);
  var colors = new Float32Array(starCount * 3);

  for (var i = 0; i < starCount; i++) {
    var i3 = i * 3;
    /* Distribute stars in a large area around the world plane */
    var spread = 4000;
    positions[i3]     = (Math.random() - 0.5) * spread * 3;
    positions[i3 + 1] = -200 - Math.random() * 300; /* below the game plane */
    positions[i3 + 2] = (Math.random() - 0.5) * spread * 3;

    var brightness = 0.3 + Math.random() * 0.7;
    colors[i3]     = brightness * (0.8 + Math.random() * 0.2);
    colors[i3 + 1] = brightness * (0.8 + Math.random() * 0.2);
    colors[i3 + 2] = brightness;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  var starMaterial = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: false /* orthographic: no attenuation */
  });

  starField = new THREE.Points(geometry, starMaterial);
  scene.add(starField);
}

/*
 * Convert 2D game coordinates to 3D world coordinates.
 * Centers the world at origin (0,0,0).
 * Game X -> 3D X, Game Y -> 3D Z (so top-down matches screen orientation).
 */
var _g3d = { x: 0, z: 0 };
function gameTo3D(gx, gy) {
  _g3d.x = gx - seite / 2;
  _g3d.z = gy - seite / 2;
  return _g3d;
}

/*
 * Convert 3D world coordinates to 2D game coordinates.
 */
function worldToGame(wx, wz) {
  return {
    x: wx + seite / 2,
    y: wz + seite / 2
  };
}

/*
 * Create the shared shader material for all particle systems.
 * Uses alive attribute to hide inactive particles via gl_PointSize = 0.
 * Uses alpha attribute for per-particle transparency.
 * Soft circular points with edge fade for a nicer visual look.
 */
function createParticleShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: [
      'attribute float alive;',
      'attribute vec3 color;',
      'attribute float alpha;',
      'varying vec3 vColor;',
      'varying float vAlpha;',
      'void main() {',
      '  vColor = color;',
      '  vAlpha = alpha;',
      '  float pointSize = alive > 0.5 ? 3.0 : 0.0;',
      '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = pointSize;',
      '  gl_Position = projectionMatrix * mvPosition;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'precision mediump float;',
      'varying vec3 vColor;',
      'varying float vAlpha;',
      'void main() {',
      '  if (vAlpha < 0.01) discard;',
      '  vec2 coord = gl_PointCoord - vec2(0.5);',
      '  float dist = length(coord);',
      '  if (dist > 0.5) discard;',
      '  float edgeFade = 1.0 - smoothstep(0.3, 0.5, dist);',
      '  float finalAlpha = vAlpha * edgeFade;',
      '  gl_FragColor = vec4(vColor, finalAlpha);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  });
}

/*
 * Create the shared shader material for planetary shields.
 * Features:
 * - Hexagon/honeycomb pattern
 * - Slow rotation
 * - Gentle pulsing opacity (0.15-0.25)
 * - Hit flash at impact points
 * - Expanding wave rings from impacts
 * - Color shift: blue (full HP) → red (low HP)
 */
function createShieldShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uShieldHP: { value: 1.0 },
      /* Up to 5 hit events: each has a position (vec3 in sphere local space) and a time (float, 0-1 normalized age) */
      uHitCount: { value: 0 },
      uHitPos0: { value: new THREE.Vector3(0, 0, 0) },
      uHitTime0: { value: 0 },
      uHitPos1: { value: new THREE.Vector3(0, 0, 0) },
      uHitTime1: { value: 0 },
      uHitPos2: { value: new THREE.Vector3(0, 0, 0) },
      uHitTime2: { value: 0 },
      uHitPos3: { value: new THREE.Vector3(0, 0, 0) },
      uHitTime3: { value: 0 },
      uHitPos4: { value: new THREE.Vector3(0, 0, 0) },
      uHitTime4: { value: 0 }
    },
    vertexShader: [
      'varying vec3 vLocalPos;',
      'varying vec3 vNormal;',
      'varying vec2 vUv;',
      'void main() {',
      '  vLocalPos = position;',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'precision mediump float;',
      'uniform float uTime;',
      'uniform float uShieldHP;',
      'uniform int uHitCount;',
      'uniform vec3 uHitPos0;',
      'uniform float uHitTime0;',
      'uniform vec3 uHitPos1;',
      'uniform float uHitTime1;',
      'uniform vec3 uHitPos2;',
      'uniform float uHitTime2;',
      'uniform vec3 uHitPos3;',
      'uniform float uHitTime3;',
      'uniform vec3 uHitPos4;',
      'uniform float uHitTime4;',
      'varying vec3 vLocalPos;',
      'varying vec3 vNormal;',
      'varying vec2 vUv;',

      /* Hex grid pattern */
      'float hexDist(vec2 p) {',
      '  p = abs(p);',
      '  return max(dot(p, vec2(0.866025, 0.5)), p.y);',
      '}',

      'void main() {',
      '  /* --- Base shield color: blue (full HP) -> red (low HP) --- */',
      '  vec3 blueColor = vec3(0.27, 0.53, 1.0);',
      '  vec3 redColor  = vec3(1.0, 0.27, 0.15);',
      '  vec3 shieldColor = mix(redColor, blueColor, uShieldHP);',

      '  /* --- Hexagon pattern on sphere surface --- */',
      '  /* Rotate UV for slow pattern rotation */',
      '  float angle = uTime * 0.08;',
      '  float c = cos(angle);',
      '  float s = sin(angle);',
      '  vec2 uvRot = vUv - 0.5;',
      '  uvRot = vec2(c * uvRot.x - s * uvRot.y, s * uvRot.x + c * uvRot.y) + 0.5;',

      '  /* Hex grid */',
      '  vec2 hexUV = uvRot * 14.0;',
      '  vec2 hexF = fract(hexUV) - 0.5;',
      '  float hexD = hexDist(hexF);',
      '  float hexLine = smoothstep(0.42, 0.48, hexD);',
      '  float hexPattern = 1.0 - hexLine;',

      '  /* --- Fade UV seam at the south pole (v=1.0) so it is hidden from view --- */',
      '  /* Camera looks from above, so south pole is at the bottom, out of sight */',
      '  float southPoleFade = smoothstep(0.7, 1.0, vUv.y);',
      '  float seamMask = 1.0 - southPoleFade;',

      '  /* --- Pulsing opacity --- */',
      '  float pulse = 0.20 + 0.02 * sin(uTime * 0.8);',

      '  /* --- Hit effects (3D distance on sphere surface) --- */',
      '  float hitFlash = 0.0;',
      '  float hitWaves = 0.0;',
      '  vec3 normLocal = normalize(vLocalPos);',

      '  /* Process each hit using 3D dot product for angular distance */',
      '  if (uHitCount > 0) {',
      '    float hTime = uHitTime0;',
      '    if (hTime > 0.0) {',
      '      vec3 hDir = normalize(uHitPos0);',
      '      float dotP = clamp(dot(normLocal, hDir), -1.0, 1.0);',
      '      float angDist = acos(dotP);',

      '      /* Flash: bright burst that fades quickly */',
      '      float flash = exp(-hTime * 6.0);',
      '      float flashIntensity = flash * exp(-angDist * 4.0);',
      '      hitFlash += flashIntensity * 0.8;',

      '      /* Expanding wave rings */',
      '      float waveSpeed = 1.5;',
      '      float waveRadius = hTime * waveSpeed;',
      '      float waveWidth = 0.08 + hTime * 0.12;',
      '      float ring1 = smoothstep(waveWidth, 0.0, abs(angDist - waveRadius));',
      '      float ring2 = smoothstep(waveWidth * 1.3, 0.0, abs(angDist - waveRadius * 1.8));',
      '      float waveFade = exp(-hTime * 2.5);',
      '      hitWaves += (ring1 + ring2 * 0.6) * waveFade * 0.7;',
      '    }',

      '    if (uHitCount > 1) {',
      '      float hTime = uHitTime1;',
      '      if (hTime > 0.0) {',
      '        vec3 hDir = normalize(uHitPos1);',
      '        float dotP = clamp(dot(normLocal, hDir), -1.0, 1.0);',
      '        float angDist = acos(dotP);',
      '        float flash = exp(-hTime * 6.0);',
      '        float flashIntensity = flash * exp(-angDist * 4.0);',
      '        hitFlash += flashIntensity * 0.8;',
      '        float waveSpeed = 1.5;',
      '        float waveRadius = hTime * waveSpeed;',
      '        float waveWidth = 0.08 + hTime * 0.12;',
      '        float ring1 = smoothstep(waveWidth, 0.0, abs(angDist - waveRadius));',
      '        float ring2 = smoothstep(waveWidth * 1.3, 0.0, abs(angDist - waveRadius * 1.8));',
      '        float waveFade = exp(-hTime * 2.5);',
      '        hitWaves += (ring1 + ring2 * 0.6) * waveFade * 0.7;',
      '      }',
      '    }',

      '    if (uHitCount > 2) {',
      '      float hTime = uHitTime2;',
      '      if (hTime > 0.0) {',
      '        vec3 hDir = normalize(uHitPos2);',
      '        float dotP = clamp(dot(normLocal, hDir), -1.0, 1.0);',
      '        float angDist = acos(dotP);',
      '        float flash = exp(-hTime * 6.0);',
      '        float flashIntensity = flash * exp(-angDist * 4.0);',
      '        hitFlash += flashIntensity * 0.8;',
      '        float waveSpeed = 1.5;',
      '        float waveRadius = hTime * waveSpeed;',
      '        float waveWidth = 0.08 + hTime * 0.12;',
      '        float ring1 = smoothstep(waveWidth, 0.0, abs(angDist - waveRadius));',
      '        float ring2 = smoothstep(waveWidth * 1.3, 0.0, abs(angDist - waveRadius * 1.8));',
      '        float waveFade = exp(-hTime * 2.5);',
      '        hitWaves += (ring1 + ring2 * 0.6) * waveFade * 0.7;',
      '      }',
      '    }',

      '    if (uHitCount > 3) {',
      '      float hTime = uHitTime3;',
      '      if (hTime > 0.0) {',
      '        vec3 hDir = normalize(uHitPos3);',
      '        float dotP = clamp(dot(normLocal, hDir), -1.0, 1.0);',
      '        float angDist = acos(dotP);',
      '        float flash = exp(-hTime * 6.0);',
      '        float flashIntensity = flash * exp(-angDist * 4.0);',
      '        hitFlash += flashIntensity * 0.8;',
      '        float waveSpeed = 1.5;',
      '        float waveRadius = hTime * waveSpeed;',
      '        float waveWidth = 0.08 + hTime * 0.12;',
      '        float ring1 = smoothstep(waveWidth, 0.0, abs(angDist - waveRadius));',
      '        float ring2 = smoothstep(waveWidth * 1.3, 0.0, abs(angDist - waveRadius * 1.8));',
      '        float waveFade = exp(-hTime * 2.5);',
      '        hitWaves += (ring1 + ring2 * 0.6) * waveFade * 0.7;',
      '      }',
      '    }',

      '    if (uHitCount > 4) {',
      '      float hTime = uHitTime4;',
      '      if (hTime > 0.0) {',
      '        vec3 hDir = normalize(uHitPos4);',
      '        float dotP = clamp(dot(normLocal, hDir), -1.0, 1.0);',
      '        float angDist = acos(dotP);',
      '        float flash = exp(-hTime * 6.0);',
      '        float flashIntensity = flash * exp(-angDist * 4.0);',
      '        hitFlash += flashIntensity * 0.8;',
      '        float waveSpeed = 1.5;',
      '        float waveRadius = hTime * waveSpeed;',
      '        float waveWidth = 0.08 + hTime * 0.12;',
      '        float ring1 = smoothstep(waveWidth, 0.0, abs(angDist - waveRadius));',
      '        float ring2 = smoothstep(waveWidth * 1.3, 0.0, abs(angDist - waveRadius * 1.8));',
      '        float waveFade = exp(-hTime * 2.5);',
      '        hitWaves += (ring1 + ring2 * 0.6) * waveFade * 0.7;',
      '      }',
      '    }',
      '  }',

      '  /* --- Combine --- */',
      '  float patternAlpha = hexPattern * pulse * seamMask;',
      '  float finalAlpha = patternAlpha + hitFlash + hitWaves;',

      '  /* Boost alpha on hit */',
      '  float hitBoost = hitFlash + hitWaves;',
      '  finalAlpha = max(finalAlpha, pulse * seamMask + hitBoost * 0.5);',

      '  /* Brighten color on hit */',
      '  vec3 finalColor = shieldColor + vec3(hitFlash) + vec3(hitWaves * 0.5);',

      '  if (finalAlpha < 0.01) discard;',
      '  gl_FragColor = vec4(finalColor, finalAlpha);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}
