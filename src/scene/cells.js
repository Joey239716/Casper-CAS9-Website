// Red blood cell field. Owner: agent 03-cells. See agents/briefs/03-cells.md.
//
// Units: micrometres. The stream runs along local +Z, from the source at the far
// end (z = Z_FAR) towards and past the viewer (z = Z_NEAR). The camera is meant
// to sit on the local Z axis (x = y = 0, z between 0 and 26) looking towards -Z:
// cells that would hit it part around the axis as they arrive.
//
// Everything is a pure function of (params, time): each cell has a fixed home
// slot; `flow` and `replace` only shift the slot's stream coordinate, which
// wraps around the volume. Idle motion from `time` is bounded (sway, surge,
// oscillating tumble) or constant-rate, so no parameter multiplies the clock.
import * as THREE from 'three';
import { buildRoundCell, buildSickleCell } from './cells.shapes.js';

// ---- Volume ---------------------------------------------------------------
const Z_FAR = -96; // source end, deep in the fog
const Z_NEAR = 34; // behind the recommended camera
const L = Z_NEAR - Z_FAR; // 130, the wrap length
const HALF_W = 43; // half extents of the stream cross-section at the near end
const HALF_H = 27.5;
const MIN_DIST = 8.7; // centre-to-centre spacing, so tumbling discs never touch
const SWAY = 0.38; // idle sway amplitude
const BEND_X = 8; // lateral offset of the centreline at the far end
const BEND_Y = 5;
const TAPER = 0.3; // the far end is this much wider than the near end
// Cells part around the viewer's axis: within PART_NEAR of the camera plane the
// lateral radius rho becomes sqrt(rho^2 + PART_R^2), an area-preserving push, so
// nothing comes closer to the Z axis than PART_R. Far away the push is zero and
// the middle of the frame is as full as the rest.
const PART_R = 7.4;
const PART_Z0 = -32; // push starts here...
const PART_Z1 = -6; // ...and is complete from here to the near end
const LOD_DIST = 48; // red cells nearer than this use the fine mesh

// ---- Replacement choreography ----------------------------------------------
// Stream coordinate of the replacement front for a given `replace`: a distant
// glimmer at 0.25, a wall of red behind the clear cells at 0.5, at the viewer's
// end of the volume by 0.85, and still flowing after that. Monotone cubic.
const FRONT_R = [0, 0.25, 0.5, 0.85, 1];
const FRONT_S = [0, 30, 56, L, L + 48];
const FRONT_M = (() => {
  const n = FRONT_R.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((FRONT_S[i + 1] - FRONT_S[i]) / (FRONT_R[i + 1] - FRONT_R[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push((2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])); // harmonic mean keeps it monotone
  m.push(d[n - 2]);
  return m;
})();
function frontAt(r) {
  let i = 0;
  while (i < FRONT_R.length - 2 && r > FRONT_R[i + 1]) i += 1;
  const h = FRONT_R[i + 1] - FRONT_R[i];
  const t = (r - FRONT_R[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * FRONT_S[i] +
    (t3 - 2 * t2 + t) * h * FRONT_M[i] +
    (-2 * t3 + 3 * t2) * FRONT_S[i + 1] +
    (t3 - t2) * h * FRONT_M[i + 1]
  );
}
const SICKLE_RUSH = 1.3; // sickled cells are flushed this much faster than round clear ones
const GAP = 10; // empty slab between the leading red cells and the last clear ones
const BAND = 8; // soft-gate width

export const meta = {
  name: 'cells',
  params: {
    flow: { value: 0, doc: 'Any number, micrometres. Advances every cell along the stream towards the viewer; wraps every 130.' },
    sickled: { value: 0.45, doc: '0..1. Fraction of the clear glass cells that are sickle-shaped.' },
    replace: { value: 0, doc: '0..1. Red round cells stream in from the far end while the clear cells are flushed past the viewer (sickled gone by ~0.7, all clear by ~0.85, full red by ~0.9). Also carries the stream forward by itself.' },
    calm: { value: 0, doc: '0..1. Tumbling and sway settle; the left third (local -X) thins out for text.' },
    presence: { value: 1, doc: '0..1. Fades the whole field in and out.' },
    specimen: { value: 0, doc: 'Lab only. 1 = one glass round + one glass sickle, 2 = the same pair in red. Hides the field.' },
  },
  views: {
    hero: { pos: [0, 0, 20], look: [2, 1, -40], fov: 35 },
    single: { pos: [0, 2.5, 30], look: [0, 0, 0], fov: 35 },
    far: { pos: [150, 70, 120], look: [4, 0, -30], fov: 35 },
  },
};

// Small deterministic PRNG so the field is identical on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Dart-throwing Poisson-disc placement in (x, y, s), on a hash grid. A pair is
// accepted only if it keeps MIN_DIST with the parting push at 0, half and full,
// so cells stay apart all the way past the camera. `fixed` slots go in first.
function scatter(count, rand, fixed = []) {
  const CELL = MIN_DIST + PART_R;
  const NK = Math.floor(L / CELL); // the stream coordinate wraps, so the grid does too
  const CELL_S = L / NK;
  const grid = new Map();
  const key = (i, j, k) => i * 73856093 + j * 19349663 + (((k % NK) + NK) % NK) * 83492791;
  const pts = [];
  const min2 = MIN_DIST * MIN_DIST;
  const pushes = [0, 0.5, 1];
  const far = (p, x, y, s) => {
    let ds = Math.abs(p.s - s);
    if (ds > L / 2) ds = L - ds; // cells at the two ends are neighbours once the stream wraps
    for (const w of pushes) {
      const ra = Math.hypot(p.x, p.y) || 1e-6;
      const rb = Math.hypot(x, y) || 1e-6;
      const ka = Math.sqrt(ra * ra + PART_R * PART_R * w) / ra;
      const kb = Math.sqrt(rb * rb + PART_R * PART_R * w) / rb;
      const dx = p.x * ka - x * kb;
      const dy = p.y * ka - y * kb;
      if (dx * dx + dy * dy + ds * ds < min2) return false;
    }
    return true;
  };
  const fits = (x, y, s) => {
    const gi = Math.floor(x / CELL);
    const gj = Math.floor(y / CELL);
    const gk = Math.floor(s / CELL_S);
    for (let i = gi - 1; i <= gi + 1; i++)
      for (let j = gj - 1; j <= gj + 1; j++)
        for (let k = gk - 1; k <= gk + 1; k++) {
          const bucket = grid.get(key(i, j, k));
          if (!bucket) continue;
          for (const p of bucket) if (!far(p, x, y, s)) return false;
        }
    return true;
  };
  const add = (p) => {
    pts.push(p);
    const k = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.s / CELL_S));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  };
  fixed.forEach((p) => add({ ...p }));
  let tries = 0;
  while (pts.length < count && tries < 600000) {
    tries += 1;
    const x = (rand() * 2 - 1) * HALF_W;
    const y = (rand() * 2 - 1) * HALF_H;
    const s = rand() * L;
    if (fits(x, y, s)) add({ x, y, s });
  }
  return pts;
}

function makeSlots(count, seed, { hero = null } = {}) {
  const rand = mulberry32(seed);
  const pts = scatter(count, rand, hero ? [hero] : []);
  const X90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const tiltAxis = new THREE.Vector3();
  return pts.map((p, i) => {
    const isHero = hero && i === 0;
    // Base attitude: the cell's face is tilted away from the viewer (+Z) by
    // `tilt`, in a random direction, so most cells show their face (the dimple,
    // the crescent) and tumbling takes them through edge-on only now and then.
    const mkTilt = (lo, hi) => {
      const tilt = lo + (hi - lo) * rand();
      const dir = rand() * Math.PI * 2;
      tiltAxis.set(-Math.sin(dir), Math.cos(dir), 0);
      return new THREE.Quaternion().setFromAxisAngle(tiltAxis, tilt);
    };
    const qRound = mkTilt(0.25, 1.2).multiply(X90); // disc normal (local Y) -> towards +Z, then tilted
    const qSickle = isHero
      ? new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0.3, 0))
      : mkTilt(0.1, 0.95); // crescent plane (local XY) faces +Z, then tilted
    const axisAngle = rand() * Math.PI * 2;
    return {
      x: p.x,
      y: p.y,
      s: p.s,
      qRound,
      qSickle,
      // Tumble axis lies in the cell's own plane so it visibly turns over.
      axisRound: new THREE.Vector3(Math.cos(axisAngle), 0, Math.sin(axisAngle)),
      axisSickle: new THREE.Vector3(Math.cos(axisAngle), Math.sin(axisAngle), 0),
      roll: isHero ? 2.5 : rand() * 6.283, // attitude about the view axis
      rollSpin: (rand() < 0.5 ? -1 : 1) * (0.015 + rand() * 0.03), // rad/s, constant
      rollFlow: (rand() < 0.5 ? -1 : 1) * (0.002 + rand() * 0.006), // rad per micrometre of travel
      flowSpin: (rand() < 0.5 ? -1 : 1) * (0.004 + rand() * 0.007),
      w1: 0.1 + rand() * 0.16,
      w2: 0.17 + rand() * 0.2,
      p1: rand() * 6.283,
      p2: rand() * 6.283,
      sw: [0.16 + rand() * 0.2, 0.14 + rand() * 0.2, 0.12 + rand() * 0.18],
      sp: [rand() * 6.283, rand() * 6.283, rand() * 6.283],
      size: 0.93 + rand() * 0.14,
      // Sickle variation: length, curvature/width, flatness.
      sk: isHero ? [1.05, 1.05, 1] : [0.86 + rand() * 0.3, 0.8 + rand() * 0.45, 0.85 + rand() * 0.35],
      // Shape threshold: sickled when h < params.sickled. Golden-ratio sequence
      // so any value of `sickled` gives an even mix through the volume.
      h: isHero ? 0 : 0.02 + 0.98 * ((i * 0.6180339887) % 1),
      shade: 0.62 + rand() * 0.36,
      calmKeep: rand(),
      hero: isHero,
    };
  });
}

// Clear cells. A clone of the shared glass, re-set as a blended shell rather
// than a transmissive solid: reflections are laid over whatever is behind, and
// the body only smokes it slightly. Two reasons (see the status file):
// transmissive cells cannot see each other, so a field of them reads as black
// lacquer, and the shared dispersion costs ~13 ms on this field. Added on top:
// the reflection off the inside of the far wall (split a hair per colour
// channel, which is where the faint fringes come from) and a grazing-angle rim.
function makeGlass(shared) {
  const mat = shared.clone();
  mat.dispersion = 0;
  mat.transmission = 0;
  mat.thickness = 0;
  mat.metalness = 0;
  mat.roughness = 0.06;
  mat.clearcoat = 0;
  mat.color.set(0x000000);
  mat.envMapIntensity = 1.35;
  mat.transparent = true;
  mat.depthWrite = false;
  mat.blending = THREE.CustomBlending;
  mat.blendSrc = THREE.OneFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.blendSrcAlpha = THREE.OneFactor;
  mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <transmission_fragment>',
        /* glsl */ `#include <transmission_fragment>
      float cNV = saturate( dot( normal, geometryViewDir ) );
      float cG = 1.0 - cNV;
      float cFres = cG * cG * cG;
      {
        vec3 cV = geometryViewDir;
        #ifdef USE_ENVMAP
          // Far-wall normal of a thin shell: the near normal mirrored through the view plane.
          vec3 nR = normalize( normal - ( 2.00 - 0.04 ) * cNV * cV );
          vec3 nB = normalize( normal - ( 2.00 + 0.04 ) * cNV * cV );
          vec3 backR = getIBLRadiance( cV, nR, 0.12 );
          vec3 backB = getIBLRadiance( cV, nB, 0.12 );
          vec3 back = vec3( backR.r, 0.5 * ( backR.g + backB.g ), backB.b );
          totalSpecular += back * ( 0.05 + 0.95 * cFres ) * 0.5;
        #endif
        vec3 rimTint = vec3( 0.80, 0.88, 1.0 );
        float cFar = smoothstep( 25.0, 85.0, vViewPosition.z );
        totalSpecular += rimTint * ( ( 0.08 + 0.22 * cFar ) * cG * cG + 0.24 * cFres + 0.5 * pow( cG, 9.0 ) );
        totalSpecular += rimTint * 0.012;
      }`
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `float cBody = mix( 0.22, 0.78, smoothstep( 0.0, 1.0, cG * cG ) );
        gl_FragColor = vec4( outgoingLight * opacity, opacity * cBody );`
      )
      .replace(
        '#include <fog_fragment>',
        /* glsl */ `#ifdef USE_FOG
          float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
          gl_FragColor.rgb *= 1.0 - fogFactor;
          gl_FragColor.a *= 1.0 - 0.6 * fogFactor;
        #endif`
      );
  };
  mat.customProgramCacheKey = () => 'cells-glass-shell';
  return mat;
}

// Red cells: the shared arterial red, with a deeper body where the surface
// faces the viewer, a little light carried through the thin rim, a tighter
// highlight, and fog that falls to deep wine before it falls to the darkfield,
// so distance reads as depth of colour rather than as grey.
function makeRed(shared) {
  const mat = shared.clone();
  mat.roughness = 0.45;
  mat.clearcoat = 0.6;
  mat.clearcoatRoughness = 0.07;
  mat.sheen = 0;
  mat.envMapIntensity = 0.5;
  mat.vertexColors = true; // the round mesh carries a soft occlusion term for the dimple
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <transmission_fragment>',
        /* glsl */ `#include <transmission_fragment>
        {
          float cNV = saturate( dot( normal, geometryViewDir ) );
          float cG = 1.0 - cNV;
          totalDiffuse *= mix( vec3( 0.66, 0.44, 0.44 ), vec3( 1.0 ), smoothstep( 0.0, 0.85, cG ) );
          totalDiffuse += diffuseColor.rgb * vec3( 1.0, 0.14, 0.10 ) * ( 0.34 * cG * cG );
        }`
      )
      .replace(
        '#include <fog_fragment>',
        /* glsl */ `#ifdef USE_FOG
          float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
          vec3 wine = vec3( 0.20, 0.010, 0.035 );
          vec3 fogTarget = mix( wine, fogColor, smoothstep( 0.80, 1.0, fogFactor ) );
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTarget, fogFactor * ( 0.55 + 0.45 * fogFactor ) );
        #endif`
      );
  };
  mat.customProgramCacheKey = () => 'cells-red-2';
  return mat;
}

export function create(ctx) {
  const high = ctx.quality === 'high';
  const group = new THREE.Group();
  group.name = 'cells';

  const roundFine = buildRoundCell(high ? 40 : 26, high ? 26 : 16);
  const roundCoarse = high ? buildRoundCell(24, 14) : roundFine;
  const sickleGeo = buildSickleCell(high ? 40 : 26, high ? 20 : 12);

  const glassMat = makeGlass(ctx.materials.glass);
  const redMat = makeRed(ctx.materials.arterial);

  // The prominent sickled cell: right of centre, ~36 um ahead of the hero camera at flow = 0.
  const HERO = { x: 8.6, y: -1.4, s: -16 - Z_FAR };

  const clearSlots = makeSlots(high ? 150 : 76, 7, { hero: HERO });
  const redSlots = makeSlots(high ? 480 : 220, 23);

  const mkMesh = (geo, mat, count, name, order) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.name = name;
    m.frustumCulled = false;
    m.renderOrder = order;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.visible = false;
    group.add(m);
    return m;
  };
  const withShade = (m, n) => {
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    return m;
  };
  const redNear = withShade(mkMesh(roundFine, redMat, redSlots.length, 'cells-red-near', 0), redSlots.length);
  // On low quality one mesh carries every red cell.
  const redFar = high ? withShade(mkMesh(roundCoarse, redMat, redSlots.length, 'cells-red-far', 0), redSlots.length) : null;
  const glassRound = mkMesh(roundFine, glassMat, clearSlots.length, 'cells-glass-round', 1);
  const glassSickle = mkMesh(sickleGeo, glassMat, clearSlots.length, 'cells-glass-sickle', 2);

  // Lab specimens (params.specimen > 0): plain meshes, hidden otherwise.
  const specimen = new THREE.Group();
  specimen.visible = false;
  const specRound = new THREE.Mesh(roundFine, glassMat);
  const specSickle = new THREE.Mesh(sickleGeo, glassMat);
  specRound.position.set(-5.6, 0, 0);
  specSickle.position.set(5.8, 0, 0);
  specimen.add(specRound, specSickle);
  group.add(specimen);

  const params = { flow: 0, sickled: 0.45, replace: 0, calm: 0, presence: 1, specimen: 0 };

  const nearCell = new THREE.Object3D();
  nearCell.name = 'cells-nearCell';
  group.add(nearCell);
  const anchors = {
    source: new THREE.Vector3(BEND_X, BEND_Y, Z_FAR),
    nearCell,
    centre: new THREE.Vector3(2, 1, -30),
  };

  const mat4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const qTmp = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const mod = (a, n) => ((a % n) + n) % n;

  // Shared placement: fills `pos` and `quat`; returns the wrapped stream coordinate.
  function place(c, advance, time, calm, surge, sickle) {
    const travel = c.s + advance;
    const s = mod(travel, L);
    const z = Z_FAR + s;
    // Widen and bend towards the far end.
    const q = Math.min(1, Math.max(0, -z / -Z_FAR));
    const q2 = q * q;
    const widen = 1 + TAPER * q;
    let x = c.x * widen + BEND_X * q2;
    let y = c.y * widen + BEND_Y * q2;
    // Part around the viewer's axis.
    const w = smooth(PART_Z0, PART_Z1, z);
    if (w > 0) {
      const rho2 = x * x + y * y;
      if (rho2 > 1e-6) {
        const k = Math.sqrt((rho2 + PART_R * PART_R * w) / rho2);
        x *= k;
        y *= k;
      } else {
        x = PART_R * Math.sqrt(w);
      }
    }
    const sway = SWAY * (1 - 0.5 * calm);
    pos.set(
      x + sway * Math.sin(time * c.sw[0] + c.sp[0]),
      y + sway * Math.sin(time * c.sw[1] + c.sp[1]),
      z + surge + sway * Math.sin(time * c.sw[2] + c.sp[2])
    );
    const osc = Math.sin(time * c.w1 + c.p1) + 0.5 * Math.sin(time * c.w2 + c.p2);
    const still = c.hero ? 0.2 : 1;
    const amp = (sickle ? 0.32 : 0.6) * (1 - 0.8 * calm) * still;
    // Turn about the view axis (keeps the face towards the viewer)...
    quat.setFromAxisAngle(Z_AXIS, c.roll + (time * c.rollSpin + travel * c.rollFlow) * still);
    // ...then the base tilt, then the tumble about an axis in the cell's own plane.
    quat.multiply(sickle ? c.qSickle : c.qRound);
    qTmp.setFromAxisAngle(sickle ? c.axisSickle : c.axisRound, travel * c.flowSpin * still + amp * osc);
    quat.multiply(qTmp);
    return s;
  }

  // calm: fraction of size kept by a cell in the left part of the field.
  function calmScale(c, calm) {
    if (calm <= 0) return 1;
    const leftness = smooth(-3, -14, c.x); // 0 right of the axis .. 1 well to the left
    const drop = leftness * 0.86;
    if (c.calmKeep >= drop) return 1;
    // Staggered exit so the left side thins progressively as calm rises.
    const t0 = 0.05 + 0.6 * (c.calmKeep / Math.max(drop, 1e-3));
    return 1 - smooth(t0, t0 + 0.3, calm);
  }

  // Scratch buffers: instances are gathered, depth-sorted, then written out.
  const maxN = Math.max(clearSlots.length, redSlots.length);
  const scratch = new Float32Array(maxN * 16);
  const depth = new Float32Array(maxN);
  const shadeBuf = new Float32Array(maxN);
  const order = new Uint16Array(maxN);
  const camLocal = new THREE.Vector3();
  let count = 0;
  const push = (shade) => {
    mat4.compose(pos, quat, scl).toArray(scratch, count * 16);
    depth[count] = pos.distanceToSquared(camLocal);
    shadeBuf[count] = shade;
    order[count] = count;
    count += 1;
  };
  const byFar = (a, b) => depth[b] - depth[a];
  const byNear = (a, b) => depth[a] - depth[b];
  // Writes sorted instances [from, to) of the scratch list into a mesh.
  const write = (mesh, idx, from, to) => {
    const n = to - from;
    const out = mesh.instanceMatrix.array;
    const col = mesh.instanceColor ? mesh.instanceColor.array : null;
    for (let i = 0; i < n; i++) {
      const src = idx[from + i] * 16;
      const dst = i * 16;
      for (let j = 0; j < 16; j++) out[dst + j] = scratch[src + j];
      if (col) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shadeBuf[idx[from + i]];
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (n) {
      mesh.instanceMatrix.needsUpdate = true;
      if (col) mesh.instanceColor.needsUpdate = true;
    }
  };

  let redTransparent = false;
  const hideField = () => {
    glassRound.visible = glassSickle.visible = redNear.visible = false;
    if (redFar) redFar.visible = false;
  };

  function update(time = 0) {
    const presence = Math.min(1, Math.max(0, params.presence));
    const spec = Math.round(params.specimen);

    specimen.visible = spec > 0;
    const fieldOn = spec === 0 && presence > 0.001;

    // The red cells are opaque unless the field is mid-fade.
    const fading = spec === 0 && presence < 0.999;
    if (fading !== redTransparent) {
      redTransparent = fading;
      redMat.transparent = fading;
      redMat.needsUpdate = true;
    }
    glassMat.opacity = redMat.opacity = fading ? presence : 1;

    if (spec > 0) {
      hideField();
      specRound.material = specSickle.material = spec >= 2 ? redMat : glassMat;
      specRound.rotation.set(1.0 + 0.3 * Math.sin(time * 0.5), 0.5 * Math.sin(time * 0.35), 0.25);
      specSickle.rotation.set(-0.3 + 0.25 * Math.sin(time * 0.45), 0.35 + 0.5 * Math.sin(time * 0.3), 2.6);
      return;
    }
    if (!fieldOn) {
      hideField();
      return;
    }

    const r = Math.min(1, Math.max(0, params.replace));
    const calm = Math.min(1, Math.max(0, params.calm));
    const sickled = params.sickled;
    const flow = params.flow;
    // A slow pulse along the stream: the whole field breathes forward and back.
    const surge = (1 - 0.6 * calm) * (2.2 * Math.sin(time * 0.42) + 0.9 * Math.sin(time * 0.17 + 1.3));

    group.updateWorldMatrix(true, false);
    camLocal.setFromMatrixPosition(ctx.camera.matrixWorld);
    group.worldToLocal(camLocal);

    const front = frontAt(r); // stream coordinate where the clear cells begin
    const sFront = front * SICKLE_RUSH;

    // Clear round cells.
    count = 0;
    for (let i = 0; i < clearSlots.length; i++) {
      const c = clearSlots[i];
      // Shape by threshold, with a narrow band so a moving `sickled` never pops.
      const k = smooth(c.h - 0.012, c.h + 0.012, sickled); // 0 round .. 1 sickle
      if (k >= 1) continue;
      const s = place(c, flow + front, time, calm, surge, false);
      const g = smooth(front, front + BAND, s) * (1 - smooth(L - 3, L, s)) * (1 - k) * calmScale(c, calm) * c.size;
      if (g > 0.002) {
        scl.setScalar(g);
        push(1);
      }
    }
    let idx = order.subarray(0, count).sort(byFar);
    write(glassRound, idx, 0, count);

    // Clear sickled cells: same slots, flushed out ahead of the round ones.
    count = 0;
    for (let i = 0; i < clearSlots.length; i++) {
      const c = clearSlots[i];
      const k = smooth(c.h - 0.012, c.h + 0.012, sickled);
      if (k <= 0) continue;
      const s = place(c, flow + sFront, time, calm, surge, true);
      const g = smooth(sFront, sFront + BAND, s) * (1 - smooth(L - 3, L, s)) * k * calmScale(c, calm) * c.size;
      if (c.hero) {
        nearCell.position.copy(pos);
        nearCell.quaternion.copy(quat);
      }
      if (g > 0.002) {
        scl.set(c.sk[0] * g, c.sk[1] * g, c.sk[2] * g);
        push(1);
      }
    }
    idx = order.subarray(0, count).sort(byFar);
    write(glassSickle, idx, 0, count);

    // Red round cells, behind the front. Near first: early depth rejection, and
    // a clean fade (nothing shows through a nearer cell while `presence` < 1).
    count = 0;
    if (r > 0) {
      const edge = front - GAP;
      for (let i = 0; i < redSlots.length; i++) {
        const c = redSlots[i];
        const s = place(c, flow + front, time, calm, surge, false);
        const g =
          (1 - smooth(edge - BAND, edge, s)) * smooth(0, BAND, s) * (1 - smooth(L - 3, L, s)) * calmScale(c, calm) * c.size;
        if (g > 0.002) {
          scl.setScalar(g);
          push(c.shade);
        }
      }
    }
    idx = order.subarray(0, count).sort(byNear);
    if (redFar) {
      let split = 0;
      const lod2 = LOD_DIST * LOD_DIST;
      while (split < count && depth[idx[split]] < lod2) split += 1;
      write(redNear, idx, 0, split);
      write(redFar, idx, split, count);
    } else {
      write(redNear, idx, 0, count);
    }
  }

  update(0);

  return {
    group,
    params,
    anchors,
    update,
    dispose() {
      roundFine.dispose();
      if (roundCoarse !== roundFine) roundCoarse.dispose();
      sickleGeo.dispose();
      glassMat.dispose();
      redMat.dispose();
      glassRound.dispose();
      glassSickle.dispose();
      redNear.dispose();
      redFar?.dispose();
    },
    // Exposed for the lab console only.
    _debug: { clearSlots, redSlots, frontAt },
  };
}
