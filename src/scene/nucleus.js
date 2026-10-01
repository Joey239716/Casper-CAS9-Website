// Nucleus: the scroll-driven descent through a nuclear pore and past chromatin,
// plus the static chromatin haze around the helix. Owner: agent 04-atmosphere.
//
// Two layers in one group:
//   * The DESCENT layer is camera-relative. It rides on ctx.camera (param
//     `follow`, default 1) and moves a long static "track" of scenery past the
//     lens as `descent` goes 0 -> 1. By descent = 1 every piece of it is behind
//     the camera, so nothing is ever left stuck to the lens.
//   * The HAZE layer is fixed in the group's own space: soft chromatin strands
//     in a shell around the local Y axis (the helix axis). Put the group exactly
//     where the helix group is.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  mulberry32,
  smoothstep,
  monotone,
  wormPath,
  buildTube,
  bare,
  patchSolid,
  softMaterial,
  GLSL_FOG,
  noiseTexture,
  smoothIco,
} from './nucleus.geometry.js';

export const meta = {
  name: 'nucleus',
  params: {
    descent: { value: 0, doc: '0..1. The dive: 0 outside the envelope, 0.35 inside the pore, 0.4-0.8 chromatin, 1 arrived (descent layer gone).' },
    haze: { value: 1, doc: '0..1. Opacity of the static chromatin haze around the local Y axis. Only shows once descent > 0.7; full at descent = 1.' },
    presence: { value: 1, doc: '0..1. Master fade for both layers. 0 hides the module and costs nothing.' },
    follow: { value: 1, doc: '0 or 1. 1: the descent layer rides on ctx.camera. 0: it sits at the group origin looking down local -Z.' },
  },
  // The descent layer follows the camera, so any camera works for it. These
  // views put the camera 28 units from the group origin (the clearing, where
  // the helix goes) looking down -Z, which is where the dive ends.
  views: {
    hero: { pos: [0, 0, 28], look: [0, 0, 0], fov: 35, params: { descent: 0.15 } },
    inside: { pos: [0, 0, 28], look: [0, 0, 0], fov: 35, params: { descent: 0.55 } },
    arrive: { pos: [0, 0, 28], look: [0, 0, 0], fov: 35, params: { descent: 1 } },
    haze: { pos: [10, -15, 24], look: [0, 5, 0], fov: 35, params: { descent: 1, haze: 1 } },
  },
};

// ---- Staging (descent units are arbitrary; the real zoom is ~1000x) --------
const WALL_W = 150; // distance from the start to the envelope
const ENV_R = 210; // envelope radius
const CAP = 0.9; // half-angle of the envelope cap that is built (rad)
const PORE_R = 7; // pore opening radius
const PORE_SPACING = 36;
const S_END = 880; // total travel
const FAR = 290; // draw distance of the descent layer
const LOD_NEAR = 130; // beads nearer than this use the round geometry
const ROLL = 0.55; // total camera roll over the dive (rad)

// Scroll -> distance travelled. Slow approach, through the pore at 0.35, fast
// through the chromatin, settling to a stop at 1.
const travel = monotone([0, 0.2, 0.3, 0.35, 0.4, 0.8, 0.9, 1], [0, 85, 128, 150, 180, 670, 775, S_END], 0);

// Radius kept clear around the camera path, by distance along the track.
function corridor(w) {
  const a = 13 + (8 - 13) * smoothstep(420, 500, w);
  return a + 18 * Math.pow(smoothstep(700, S_END, w), 1.3);
}

export function create(ctx) {
  const low = ctx.quality === 'low';
  const { tokens } = ctx;
  const rng = mulberry32(20261001);
  const disposables = [];
  const own = (x) => {
    disposables.push(x);
    return x;
  };

  const group = new THREE.Group();
  group.name = 'nucleus';
  const rig = new THREE.Group(); // rides on the camera
  const roller = new THREE.Group(); // rolls about the view axis
  const track = new THREE.Group(); // slides towards the camera
  group.add(rig);
  rig.add(roller);
  roller.add(track);

  // ---- Shared uniforms ------------------------------------------------------
  const fogColor = new THREE.Color(tokens.darkfield);
  const glowColor = new THREE.Color(tokens.deepField).multiplyScalar(2.2);
  const inner = {
    uFogDensity: { value: 0.0065 },
    uFogColor: { value: fogColor },
    uGlowColor: { value: glowColor },
    uGlow: { value: 1 },
    uPresence: { value: 1 },
  };
  // The envelope is seen from outside: thinner fog, and it fades to plain dark.
  const outer = {
    uFogDensity: { value: 0.0036 },
    uFogColor: { value: fogColor },
    uGlowColor: { value: glowColor },
    uGlow: { value: 0 },
    uPresence: inner.uPresence,
  };

  // Every solid surface is a clone of the shared frost, darkened and polished
  // towards smoked glass so that edges and highlights draw the forms.
  const solid = (shared, opts, { tone = 1, roughness = 0.5, env = 0.9, side = THREE.FrontSide } = {}) => {
    const m = own(ctx.materials.frost.clone());
    m.color.set(0x9e92cc).multiplyScalar(tone);
    m.roughness = roughness;
    m.envMapIntensity = env;
    m.side = side;
    return patchSolid(m, shared, opts);
  };
  // The envelope is lit as a pool of light around the hero pore, falling to dark
  // at the limb; that is what makes it read as a vast curved wall.
  const POOL = 'outgoingLight *= mix(0.1, 1.0, smoothstep(0.9, 0.998, normalize(vObjP).z));';

  // Chunks are shown only while they are within view distance of the camera.
  const chunks = [];
  const addChunk = (object, wMin, wMax, hi = null, lo = null) => {
    track.add(object);
    chunks.push({ object, wMin, wMax, hi, lo });
  };

  // ==========================================================================
  // 1. The nuclear envelope
  // ==========================================================================
  const wall = new THREE.Group();
  wall.position.set(0, 0, -WALL_W - ENV_R);

  // Pores: a jittered hex scatter over the cap, the hero pore dead centre.
  const pores = [];
  {
    const rows = Math.ceil((CAP * ENV_R) / (PORE_SPACING * 0.866)) + 1;
    for (let j = -rows; j <= rows; j++) {
      for (let i = -rows; i <= rows; i++) {
        let x = (i + (j & 1 ? 0.5 : 0)) * PORE_SPACING;
        let y = j * PORE_SPACING * 0.866;
        const hero = i === 0 && j === 0;
        const ring = Math.hypot(x, y) < PORE_SPACING * 1.2;
        if (!hero) {
          x += (rng() - 0.5) * PORE_SPACING * 0.24;
          y += (rng() - 0.5) * PORE_SPACING * 0.24;
          if (!ring && rng() < 0.07) continue;
        }
        const rho = Math.hypot(x, y);
        const ang = rho / ENV_R;
        if (ang > CAP - 0.05) continue;
        const n = hero
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3((Math.sin(ang) * x) / rho, (Math.sin(ang) * y) / rho, Math.cos(ang));
        pores.push({ n, hi: hero || ring, roll: hero ? 0 : rng() * Math.PI * 2, scale: hero ? 1 : 0.94 + rng() * 0.1 });
      }
    }
  }

  // Pore map: for each texel of a stereographic chart of the cap, the offset to
  // the nearest pore centre (RG, in chart units) and its length (B, which stays
  // continuous where the nearest pore changes). The wall shader cuts the
  // openings from B and lights the dimple around each from the RG direction.
  const T = low ? 512 : 1024;
  const stMax = Math.tan(CAP / 2) * 1.03;
  const REACH = ((3.0 * PORE_R) / ENV_R) * 0.5; // offsets are stored over +-REACH
  const mask = new Uint8Array(T * T * 4).fill(255);
  const best = new Float32Array(T * T).fill(Infinity);
  for (const { n } of pores) {
    const sx = n.x / (1 + n.z);
    const sy = n.y / (1 + n.z);
    const toPx = (c) => (c / (2 * stMax) + 0.5) * T;
    const x0 = Math.max(0, Math.floor(toPx(sx - REACH)));
    const x1 = Math.min(T - 1, Math.ceil(toPx(sx + REACH)));
    const y0 = Math.max(0, Math.floor(toPx(sy - REACH)));
    const y1 = Math.min(T - 1, Math.ceil(toPx(sy + REACH)));
    for (let py = y0; py <= y1; py++) {
      const dv = (((py + 0.5) / T) - 0.5) * 2 * stMax - sy;
      for (let px = x0; px <= x1; px++) {
        const du = (((px + 0.5) / T) - 0.5) * 2 * stMax - sx;
        const d2 = du * du + dv * dv;
        const k = py * T + px;
        if (d2 >= best[k]) continue;
        best[k] = d2;
        mask[k * 4] = Math.min(255, Math.max(0, Math.round((du / REACH) * 127.5 + 127.5)));
        mask[k * 4 + 1] = Math.min(255, Math.max(0, Math.round((dv / REACH) * 127.5 + 127.5)));
        mask[k * 4 + 2] = Math.min(255, Math.round((Math.sqrt(d2) / REACH) * 255));
      }
    }
  }
  const maskTex = own(new THREE.DataTexture(mask, T, T, THREE.RGBAFormat, THREE.UnsignedByteType));
  maskTex.minFilter = THREE.LinearFilter;
  maskTex.magFilter = THREE.LinearFilter;
  maskTex.needsUpdate = true;

  const noiseTex = own(noiseTexture(rng, low ? 256 : 512));
  const wallMat = solid(
    { ...outer, uMask: { value: maskTex }, uNoise: { value: noiseTex }, uStMax: { value: stMax }, uReach: { value: REACH }, uPoreScale: { value: (2 * ENV_R) / PORE_R }, uGrad: { value: noiseTex.userData.gradScale } },
    {
      rim: 0.5,
      rimPower: 2.5,
      objP: true,
      pars: /* glsl */ `
        uniform sampler2D uMask;
        uniform sampler2D uNoise;
        uniform float uStMax;
        uniform float uGrad;
        uniform float uReach;
        uniform float uPoreScale;
        vec3 nucPerturb(vec3 pos, vec3 nrm, vec2 dH) {
          vec3 sx = dFdx(pos);
          vec3 sy = dFdy(pos);
          vec3 r1 = cross(sy, nrm);
          vec3 r2 = cross(nrm, sx);
          float det = dot(sx, r1);
          vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
          return normalize(abs(det) * nrm - grad);
        }
      `,
      color: /* glsl */ `
        vec3 objN = normalize(vObjP);
        vec2 st = objN.xy / (1.0 + objN.z);
        vec4 poreTex = texture2D(uMask, st / (2.0 * uStMax) + 0.5);
        vec2 poreOff = poreTex.rg * 2.0 - 1.0;
        float poreK = uPoreScale / (1.0 + dot(st, st));   // chart units -> pore radii
        float poreD = poreTex.b * uReach * poreK;
        if (poreD < 1.0) discard;
        vec4 nA = texture2D(uNoise, st * 2.1);
        vec4 nB = texture2D(uNoise, st.yx * 14.0 + 0.37);
        float dimT = clamp((poreD - 1.0) / 1.05, 0.0, 1.0);
        float dimple = dimT * dimT * (3.0 - 2.0 * dimT);
        diffuseColor.rgb *= mix(0.6, 1.12, nA.a) * mix(0.82, 1.1, nB.r) * mix(0.3, 1.0, dimple);
      `,
      bump: /* glsl */ `
        // Height gradient per chart unit, in descent units: broad swell, fine
        // frost, and the dip of the membrane into each pore.
        vec2 hGrad = (nA.gb - 0.5) * (2.0 * uGrad * 2.1 * 2.4) + (nB.bg - 0.5) * (2.0 * uGrad * 14.0 * 0.22);
        hGrad += normalize(poreOff + 1e-5) * (6.0 * dimT * (1.0 - dimT) / 1.05) * poreK * 2.5;
        normal = nucPerturb(-vViewPosition, normal, vec2(dot(hGrad, dFdx(st)), dot(hGrad, dFdy(st))));
      `,
      light: POOL,
    },
    { tone: 0.34, roughness: 0.46, env: 1.0 }
  );
  const wallGeo = own(new THREE.SphereGeometry(ENV_R, low ? 64 : 128, low ? 24 : 48, 0, Math.PI * 2, 0, CAP));
  wallGeo.rotateX(Math.PI / 2);
  wall.add(new THREE.Mesh(wallGeo, wallMat));

  // Pore complex: eight-fold rings, a short channel, and (hero detail only) the
  // nuclear basket behind and the cytoplasmic filaments in front. Local +Z is out.
  function poreGeometry(hi) {
    const parts = [];
    const add = (g, m) => {
      const b = bare(g);
      if (m) b.applyMatrix4(m);
      parts.push(b);
    };
    const move = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    add(new THREE.TorusGeometry(7.9, 1.5, hi ? 14 : 6, hi ? 80 : 28), move(0, 0, 0.5));
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) * (Math.PI / 4);
      const lobe = hi ? new THREE.SphereGeometry(2.1, 18, 12) : new THREE.IcosahedronGeometry(2.1, 1);
      add(lobe, move(Math.cos(a) * 8.0, Math.sin(a) * 8.0, 1.1).multiply(new THREE.Matrix4().makeScale(1, 1, 0.8)));
    }
    const filaments = (segs, radial) => {
      // Cytoplasmic filaments, splaying out towards the viewer.
      for (let k = 0; k < 8; k++) {
        const a = (k + 0.5) * (Math.PI / 4);
        const at = (r, z, da) => new THREE.Vector3(Math.cos(a + da) * r, Math.sin(a + da) * r, z);
        const curve = new THREE.CatmullRomCurve3([at(8.2, 2.3, 0), at(9.4, 5.6, 0.1), at(11.2, 8.4, 0.3), at(12.2, 10.2, 0.62)]);
        add(buildTube(curve, segs, radial, (u) => 0.34 * (1 - 0.75 * u)));
      }
    };
    filaments(hi ? 14 : 7, hi ? 8 : 4);
    if (!hi) add(new THREE.TorusGeometry(6.25, 0.8, 5, 24), move(0, 0, -2.6));
    if (hi) {
      add(new THREE.TorusGeometry(6.25, 0.8, 10, 64), move(0, 0, -2.6));
      for (let k = 0; k < 8; k++) {
        const a = k * (Math.PI / 4);
        add(new THREE.SphereGeometry(1.15, 12, 8), move(Math.cos(a) * 6.3, Math.sin(a) * 6.3, -2.6));
      }
      add(new THREE.TorusGeometry(7.4, 1.15, 10, 64), move(0, 0, -5.7));
      // Nuclear basket: eight filaments converging on a distal ring.
      for (let k = 0; k < 8; k++) {
        const a = (k + 0.5) * (Math.PI / 4);
        const c = Math.cos(a);
        const s = Math.sin(a);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(7.3 * c, 7.3 * s, -6.0),
          new THREE.Vector3(6.6 * c, 6.6 * s, -10.0),
          new THREE.Vector3(3.8 * c, 3.8 * s, -15.6),
        ]);
        add(buildTube(curve, 16, 12, (u) => 0.32 - 0.08 * u));
      }
      add(new THREE.TorusGeometry(3.8, 0.42, 10, 48), move(0, 0, -15.7));
    }
    return own(mergeGeometries(parts));
  }

  // Pores are polished smoked glass (clear transmission glass was tried here and
  // cost over 10 ms a frame). Channels, the short tunnel through the double
  // membrane, are a separate double-sided mesh.
  const poreMat = solid(outer, { rim: 0.55, rimPower: 2, objP: true, light: POOL }, { tone: 0.26, roughness: 0.14, env: 1.9 });
  const channelMat = solid(outer, { rim: 0.3, objP: true, light: POOL }, { tone: 0.3, roughness: 0.5, side: THREE.DoubleSide });
  const up = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const mtx = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const poreMesh = (geo, mat, list) => {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => {
      q.setFromUnitVectors(up, p.n).multiply(q2.setFromAxisAngle(up, p.roll));
      mtx.compose(v.copy(p.n).multiplyScalar(ENV_R), q, sc.setScalar(p.scale));
      mesh.setMatrixAt(i, mtx);
    });
    mesh.frustumCulled = false;
    wall.add(mesh);
  };
  poreMesh(poreGeometry(true), poreMat, pores.filter((p) => p.hi));
  poreMesh(poreGeometry(false), poreMat, pores.filter((p) => !p.hi));
  {
    const channel = new THREE.CylinderGeometry(7.0, 7.0, 6.4, low ? 24 : 48, 1, true);
    channel.rotateX(Math.PI / 2).translate(0, 0, -2.6);
    poreMesh(own(channel), channelMat, pores);
  }

  // Ribosomes: small beads studding the outer membrane, for scale.
  {
    const count = low ? 600 : 1300;
    const geo = own(smoothIco(1));
    const mat = solid(outer, { rim: 0.5, objP: true, light: POOL }, { tone: 0.62, roughness: 0.4 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const cosCap = Math.cos(CAP * 0.72);
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 20) {
      const z = 1 - Math.pow(rng(), 1.5) * (1 - cosCap);
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      v.set(Math.cos(a) * r, Math.sin(a) * r, z);
      let ok = true;
      for (const p of pores) {
        if (p.n.distanceToSquared(v) * ENV_R * ENV_R < (PORE_R * 1.75) ** 2) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const s = 0.28 + rng() * 0.26;
      q.setFromUnitVectors(up, v);
      mtx.compose(v.multiplyScalar(ENV_R + s * 0.35), q, sc.set(s, s, s * 0.8));
      mesh.setMatrixAt(placed++, mtx);
    }
    mesh.count = placed;
    mesh.frustumCulled = false;
    wall.add(mesh);
  }
  addChunk(wall, 0, WALL_W + 30);

  const poreAnchor = new THREE.Object3D();
  poreAnchor.position.set(0, 0, -WALL_W);
  track.add(poreAnchor);

  // ==========================================================================
  // 2. Chromatin
  // ==========================================================================
  const envCentre = new THREE.Vector3(0, 0, -WALL_W - ENV_R);
  // Keep a point inside the envelope and out of the camera's corridor.
  const excludeFrom = (minR) => (p) => {
    if (p.z > envCentre.z) {
      v.copy(p).sub(envCentre);
      const max = ENV_R - 16;
      if (v.length() > max) p.copy(envCentre).add(v.setLength(max));
    }
    const r = Math.hypot(p.x, p.y);
    const r0 = Math.max(minR, corridor(-p.z));
    if (r < 1e-3) {
      p.x = r0;
      return;
    }
    const k = Math.sqrt(r * r + r0 * r0) / r;
    p.x *= k;
    p.y *= k;
  };

  const beadHi = own(new THREE.SphereGeometry(1, 12, 8));
  const beadMid = own(smoothIco(1));
  const beadLo = own(smoothIco(0));
  // Nucleosome with its DNA wrap: a flattened core and one fat turn around it.
  const spoolGeo = own(
    mergeGeometries([
      bare(new THREE.SphereGeometry(1, 12, 8).scale(1, 0.6, 1)),
      bare(new THREE.TorusGeometry(1.0, 0.25, 6, 24).rotateX(Math.PI / 2)),
    ])
  );
  const spoolLo = own(smoothIco(1).scale(1.1, 0.62, 1.1));

  const matNear = solid(inner, { rim: 0.4, rimPower: 1.8 }, { tone: 0.32, roughness: 0.2, env: 1.6 });
  const matMid = solid(inner, { rim: 0.35, rimPower: 2 }, { tone: 0.3, roughness: 0.3, env: 1.3 });
  const matFar = solid(inner, { rim: 0.25, rimPower: 2 }, { tone: 0.3, roughness: 0.5, env: 0.8 });

  // Buckets: fibres of one kind in one stretch of track share two draw calls.
  const buckets = new Map();
  const bucket = (key, w, hiGeo, loGeo, material) => {
    const id = `${key}:${Math.floor(w / 110)}`;
    if (!buckets.has(id)) buckets.set(id, { tubes: [], beads: [], hiGeo, loGeo, material, wMin: Infinity, wMax: -Infinity });
    return buckets.get(id);
  };
  const span = (b, curve, pad) => {
    for (const p of curve.points) {
      b.wMin = Math.min(b.wMin, -p.z - pad);
      b.wMax = Math.max(b.wMax, -p.z + pad);
    }
  };

  const Y = new THREE.Vector3(0, 1, 0);
  const P = new THREE.Vector3();
  const radial = new THREE.Vector3();

  // A path through one zone. `r` is the range of distance from the camera path.
  function zonePath({ w0, w1, r0, r1, steps, step, turn }) {
    const a = rng() * Math.PI * 2;
    const r = r0 + (r1 - r0) * Math.sqrt(rng());
    const start = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -(w0 + (w1 - w0) * rng()));
    return wormPath(rng, {
      start,
      steps,
      step,
      turn,
      inside: (p) => -p.z > w0 && -p.z < w1 && Math.hypot(p.x, p.y) < r1 && Math.hypot(p.x, p.y) > r0 * 0.6,
      home: (p) => {
        const pr = Math.hypot(p.x, p.y) || 1;
        const target = (r0 + r1) * 0.5;
        return P.set((p.x / pr) * target, (p.y / pr) * target, -(w0 + w1) / 2);
      },
      exclude: excludeFrom(r0 * 0.8),
    });
  }

  // Compacted fibre: nucleosomes packed in a solenoid around the path.
  function addSolenoid(curve, b, beadR) {
    const n = Math.floor(curve.getLength() * (3.9 / beadR));
    const frames = curve.computeFrenetFrames(n, false);
    for (let k = 0; k < n; k++) {
      const u = k / n;
      curve.getPointAt(u, P);
      const a = k * ((Math.PI * 2) / 6.3);
      radial.copy(frames.normals[k]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[k], Math.sin(a));
      q.setFromUnitVectors(Y, radial);
      const taper = smoothstep(0, 0.03, u) * smoothstep(1, 0.97, u);
      const s = beadR * (0.9 + rng() * 0.2) * taper;
      P.addScaledVector(radial, beadR * 1.45 * (0.92 + rng() * 0.16));
      b.beads.push(new THREE.Matrix4().compose(P, q, sc.set(s, s * 0.62, s)));
    }
    span(b, curve, 6);
  }

  // Open fibre: beads on a string.
  function addString(curve, b, { beadR, spacing, thread, radialSegs, spool }) {
    const L = curve.getLength();
    b.tubes.push(buildTube(curve, Math.ceil(L / (low ? 2.4 : 1.4)), radialSegs, () => thread));
    if (beadR > 0) {
      const n = Math.floor(L / spacing);
      const frames = curve.computeFrenetFrames(n, false);
      for (let k = 1; k < n; k++) {
        const u = (k + (rng() - 0.5) * 0.5) / n;
        curve.getPointAt(u, P);
        const a = k * 2.4;
        radial.copy(frames.normals[k]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[k], Math.sin(a));
        P.addScaledVector(radial, beadR * 0.55);
        // Disc axis: across the fibre, with some wobble.
        v.copy(radial).applyAxisAngle(frames.tangents[k], Math.PI / 2).addScaledVector(frames.tangents[k], (rng() - 0.5) * 0.9).normalize();
        q.setFromUnitVectors(Y, v);
        const s = beadR * (0.9 + rng() * 0.2);
        b.beads.push(new THREE.Matrix4().compose(P, q, spool ? sc.setScalar(s) : sc.set(s, s * 0.62, s)));
      }
    }
    span(b, curve, 4);
  }

  const half = (n) => (low ? Math.ceil(n / 2) : n);

  // Zone A (just inside): thick compacted fibres.
  for (let i = 0; i < half(5); i++) {
    const c = zonePath({ w0: 200, w1: 460, r0: 0, r1: 36, steps: 19, step: 11, turn: 0.3 });
    addSolenoid(c, bucket('A-near', -c.points[9].z, beadHi, beadLo, matNear), 1.2);
  }
  for (let i = 0; i < half(7); i++) {
    const c = zonePath({ w0: 195, w1: 490, r0: 34, r1: 95, steps: 19, step: 12, turn: 0.3 });
    addSolenoid(c, bucket('A-mid', -c.points[9].z, beadMid, beadLo, matMid), 1.3);
  }
  for (let i = 0; i < half(8); i++) {
    const c = zonePath({ w0: 200, w1: 540, r0: 90, r1: 190, steps: 18, step: 16, turn: 0.3 });
    addSolenoid(c, bucket('A-far', -c.points[9].z, beadLo, beadLo, matFar), 2.2);
  }

  // Zone B: the fibres open into beads on a string.
  for (let i = 0; i < half(16); i++) {
    const c = zonePath({ w0: 410, w1: 730, r0: 0, r1: 34, steps: 26, step: 7.5, turn: 0.45 });
    addString(c, bucket('B-near', -c.points[13].z, spoolGeo, spoolLo, matNear), { beadR: 1.1, spacing: 3.8, thread: 0.2, radialSegs: 6, spool: true });
  }
  for (let i = 0; i < half(22); i++) {
    const c = zonePath({ w0: 400, w1: 750, r0: 30, r1: 95, steps: 26, step: 8, turn: 0.45 });
    addString(c, bucket('B-mid', -c.points[13].z, beadMid, beadLo, matMid), { beadR: 1.1, spacing: 3.8, thread: 0.2, radialSegs: 5, spool: false });
  }
  for (let i = 0; i < half(18); i++) {
    const c = zonePath({ w0: 420, w1: 780, r0: 85, r1: 190, steps: 22, step: 13, turn: 0.4 });
    addString(c, bucket('B-far', -c.points[11].z, beadMid, beadLo, matFar), { beadR: 1.3, spacing: 4.8, thread: 0.28, radialSegs: 4, spool: false });
  }

  // Zone C: bare threads, thinning out and parting around the clearing.
  for (let i = 0; i < half(26); i++) {
    const c = zonePath({ w0: 670, w1: 872, r0: 0, r1: 42, steps: 24, step: 7, turn: 0.4 });
    addString(c, bucket('C-near', -c.points[12].z, null, null, matNear), { beadR: 0, thread: 0.2, radialSegs: 6 });
  }
  for (let i = 0; i < half(30); i++) {
    const c = zonePath({ w0: 660, w1: 876, r0: 38, r1: 130, steps: 22, step: 9, turn: 0.4 });
    addString(c, bucket('C-mid', -c.points[11].z, null, null, matMid), { beadR: 0, thread: 0.28, radialSegs: 5 });
  }

  const instanced = (geo, material, matrices) => {
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.frustumCulled = false;
    return mesh;
  };
  for (const b of buckets.values()) {
    const holder = new THREE.Group();
    if (b.tubes.length) {
      const geo = own(mergeGeometries(b.tubes));
      b.tubes.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(geo, b.material);
      mesh.frustumCulled = false;
      holder.add(mesh);
    }
    let hi = null;
    let lo = null;
    if (b.beads.length) {
      hi = instanced(b.hiGeo, b.material, b.beads);
      holder.add(hi);
      if (b.loGeo !== b.hiGeo) {
        lo = instanced(b.loGeo, b.material, b.beads);
        holder.add(lo);
      }
    }
    addChunk(holder, b.wMin, b.wMax, hi, lo);
  }

  // ==========================================================================
  // 3. Dust: fine motes for speed and parallax
  // ==========================================================================
  const dustUniforms = {
    uColor: { value: new THREE.Color(0xb39de6) },
    uPx: { value: 1000 },
    uTime: { value: 0 },
    uFogDensity: inner.uFogDensity,
    uPresence: inner.uPresence,
  };
  {
    const count = low ? 700 : 1800;
    const pos = new Float32Array(count * 3);
    const aux = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const w = 10 + rng() * (S_END - 10);
      const a = rng() * Math.PI * 2;
      const r = Math.max(2.2, corridor(w) * 0.25) + Math.pow(rng(), 1.6) * 90;
      pos.set([Math.cos(a) * r, Math.sin(a) * r, -w], i * 3);
      aux.set([0.1 + Math.pow(rng(), 3) * 0.45, rng()], i * 2);
    }
    const geo = own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 2));
    const mat = own(
      new THREE.ShaderMaterial({
        uniforms: dustUniforms,
        vertexShader: /* glsl */ `
          uniform float uPx;
          uniform float uTime;
          uniform float uFogDensity;
          uniform float uPresence;
          attribute vec2 aAux;
          varying float vA;
          void main() {
            vec3 p = position;
            p.xy += vec2(sin(uTime * 0.21 + aAux.y * 40.0), cos(uTime * 0.17 + aAux.y * 23.0)) * 0.35;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float dist = length(mv.xyz);
            float size = aAux.x * uPx / max(-mv.z, 0.1);
            float f = dist * uFogDensity;
            vA = exp(-f * f) * smoothstep(1.5, 9.0, dist) * uPresence * (0.35 + 0.65 * aAux.y);
            vA *= min(1.0, size / 2.0);          // sub-pixel motes dim instead of flickering
            gl_PointSize = clamp(size, 2.0, 48.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = smoothstep(1.0, 0.0, d);
            gl_FragColor = vec4(uColor * a * a * vA * 0.5, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const dust = new THREE.Points(geo, mat);
    dust.frustumCulled = false;
    dust.renderOrder = 6;
    track.add(dust);
  }

  // ==========================================================================
  // 4. Backing dome: the faint glow at the vanishing point
  // ==========================================================================
  const backingUniforms = { ...inner, uAlpha: { value: 1 } };
  const backing = new THREE.Mesh(
    own(new THREE.SphereGeometry(700, 24, 12)),
    own(
      new THREE.ShaderMaterial({
        uniforms: backingUniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = (modelViewMatrix * vec4(position, 0.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          ${GLSL_FOG}
          uniform float uAlpha;
          varying vec3 vDir;
          void main() {
            gl_FragColor = vec4(nucFogColor(normalize(vDir)), uAlpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      })
    )
  );
  backing.renderOrder = -999;
  backing.frustumCulled = false;
  rig.add(backing);

  // ==========================================================================
  // 5. Haze: soft chromatin strands in a shell around the local Y axis
  // ==========================================================================
  const HAZE_OPACITY = 0.5;
  const hazeMat = own(softMaterial({ color: tokens.frost, opacity: HAZE_OPACITY, soft: 1.5 }));
  hazeMat.uniforms.uNear.value.set(9, 26);
  const haze = new THREE.Group();
  {
    const tubes = [];
    const count = low ? 34 : 68;
    const excludeAxis = (p) => {
      const r = Math.hypot(p.x, p.z);
      const k = r < 1e-3 ? 0 : Math.sqrt(r * r + 17 * 17) / r;
      if (k === 0) p.x = 17;
      else {
        p.x *= k;
        p.z *= k;
      }
    };
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = 10 + 56 * Math.pow(rng(), 0.4);
      const start = new THREE.Vector3(Math.cos(a) * r, (rng() * 2 - 1) * 105, Math.sin(a) * r);
      const c = wormPath(rng, {
        start,
        steps: 22,
        step: 8.5,
        turn: 0.42,
        inside: (p) => Math.abs(p.y) < 108 && Math.hypot(p.x, p.z) < 62,
        home: (p) => P.set(p.x * 0.4, p.y * 0.6, p.z * 0.4),
        exclude: excludeAxis,
      });
      const L = c.getLength();
      const thick = 0.16 + Math.pow(rng(), 2) * 0.5;
      tubes.push(buildTube(c, Math.ceil(L / (low ? 2.6 : 1.5)), 6, (u) => thick * smoothstep(0, 0.06, u) * smoothstep(1, 0.94, u)));
    }
    const geo = own(mergeGeometries(tubes));
    tubes.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geo, hazeMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    haze.add(mesh);
  }
  group.add(haze);

  // ==========================================================================
  const clearing = new THREE.Object3D();
  group.add(clearing);

  const params = { descent: 0, haze: 1, presence: 1, follow: 1 };
  const size = new THREE.Vector2();
  const inv = new THREE.Matrix4();

  function update(time = 0) {
    const d = Math.min(1, Math.max(0, params.descent));
    const presence = Math.min(1, Math.max(0, params.presence));
    const s = travel(d);

    // Descent layer.
    const live = presence > 0.001 && d < 0.9995;
    rig.visible = live;
    if (live) {
      if (params.follow >= 0.5) {
        ctx.camera.updateWorldMatrix(true, false);
        group.updateWorldMatrix(true, false);
        rig.matrix.copy(inv.copy(group.matrixWorld).invert()).multiply(ctx.camera.matrixWorld);
        rig.matrix.decompose(rig.position, rig.quaternion, rig.scale);
      } else {
        rig.position.set(0, 0, 0);
        rig.quaternion.identity();
        rig.scale.set(1, 1, 1);
      }
      roller.rotation.z = ROLL * smoothstep(0.0, 1.0, d) + Math.sin(time * 0.13) * 0.012;
      track.position.z = s;
      const glow = 1 - smoothstep(0.8, 1, d);
      inner.uGlow.value = glow;
      inner.uPresence.value = presence;
      backingUniforms.uAlpha.value = presence * glow;
      backing.visible = backingUniforms.uAlpha.value > 0.002;
      for (const c of chunks) {
        c.object.visible = c.wMax > s - 4 && c.wMin < s + FAR;
        if (c.lo) {
          const near = c.wMin < s + LOD_NEAR;
          c.hi.visible = near;
          c.lo.visible = !near;
        }
      }
      ctx.renderer.getDrawingBufferSize(size);
      dustUniforms.uPx.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov) / 2));
      dustUniforms.uTime.value = time;
    }

    // Haze layer.
    const hz = Math.min(1, Math.max(0, params.haze)) * presence * smoothstep(0.7, 1, d);
    haze.visible = hz > 0.002;
    hazeMat.uniforms.uOpacity.value = HAZE_OPACITY * hz;
    hazeMat.uniforms.uFog.value = ctx.scene.fog?.density ?? 0.012;
  }

  return {
    group,
    params,
    anchors: { pore: poreAnchor, clearing },
    update,
    dispose() {
      for (const x of disposables) x.dispose();
    },
  };
}
