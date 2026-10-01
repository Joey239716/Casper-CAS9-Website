// The beaded DNA double helix. Owner: agent 01-helix (beaded and recoloured by the coordinator, D-006).
// and agents/status/01-helix.md (the "Interface delivered" section is the manual).
//
// How it works
// ------------
// The whole helix is two draw calls: one instanced mesh of beads for both
// backbones and one instanced mesh for the 1200 beaded half-rungs. Neither mesh stores real positions.
// Every vertex carries its place along the helix (a base-pair coordinate `s`)
// and the vertex shader computes where that is from the params. So the model is
// a pure function of (params, time) by construction, nothing is rebuilt on the
// CPU, and the same GLSL (hxCentre) poses the backbones and the rungs, which is
// why they can never drift apart.
//
// Coordinates: 1 unit = 1 nm. Axis = local +Y. Base pair i (integer, -300..299)
// sits at y = (i + 0.5) * 0.34, so the 20-bp target (i = -10..9) is centred on
// the origin.
import * as THREE from 'three';

// ---------------------------------------------------------------- constants
const RISE = 0.34; // nm per base pair
const PER_TURN = 10.5; // base pairs per turn
const TWIST = (Math.PI * 2) / PER_TURN; // radians per base pair
const HALF = 300; // base pairs each side of the origin (600 total)
const RADIUS = 1.0; // backbone centreline radius (B-DNA is 2 nm across)
const MINOR = THREE.MathUtils.degToRad(132); // angle between the strands across the minor groove
const H0 = MINOR / 2;

// Sites, as base-pair indices.
const TARGET = { from: -10, to: 9 };
const PAM = { from: -13, to: -11 };
const CUT_S = -7; // coordinate of the break: between bp -8 and bp -7
const DECOYS = [150, 115, 85, 55, 28]; // centre bp of each decoy PAM (3 bp wide)
const NEAR = { pam: 28, from: 30, to: 39, lit: 8 }; // near-match site = decoy 4
const EDIT = -40;
const DEL_L = 1; // base pairs lost from the lower end in repair (bp -8)
const DEL_U = 2; // base pairs lost from the upper end in repair (bp -7, -6)
const DIM = { from: -37, to: 22 }; // the ~60 bp "switch" that goes dark

// Bubble shape.
const EDGE = 1.3; // softness of the bubble ends, bp
const UNTWIST = 0.9; // fraction of the twist removed inside a bubble
const R_TARGET = 1.2; // radius of the target strand (strand 0) inside the bubble
const R_OTHER = 1.44; // radius of the displaced strand (strand 1) inside the bubble
const NEAR_AMP = 0.8;

// Backbone beads: clusters of small spheres, like a space-filling model.
const BEADS_PER_BP = 5;
const BEAD_R = 0.15; // bead radius
const BEAD_RING = 0.12; // how far beads sit from the strand's centreline

// Rungs: chains of smaller beads, split at the middle.
const RUNG_W = 0.11; // bead radius across the rung
const RUNG_T = 0.11;

// Sway: the axis drifts in a slow S-curve, nanometres.
const SWAY_AMP = 1.1;
const SWAY_K = (Math.PI * 2) / 150; // one wave per 150 bp

// Pastel palette. Backbone tints, and one colour per base (A-T, C-G pairs).
const BACKBONE = [0xb48be4, 0xe39bd0, 0x9d9df0];
const BASES = { A: 0xf5cf6a, T: 0x7fa6f0, C: 0xf38f7c, G: 0x86d6a2 };
const PAIR = { A: 'T', T: 'A', C: 'G', G: 'C' };
const GOLD = 0xffbf52;
const RUNG_GAP = 0.02; // half the hairline gap at the join
const RUNG_CH = 0.05; // chamfer length at the tip
const RUNG_OPEN = 0.7; // length of a half-rung when its pair is open

// Repair.
const MISMATCH = THREE.MathUtils.degToRad(48); // twist left out of register
const KINK = 0.8; // bp over which each end bends to meet the other

export const meta = {
  name: 'helix',
  params: {
    spin: { value: 0, doc: 'Turns. Rotation about the helix axis (positive = right-hand rule about +Y).' },
    idle: { value: 1, doc: '0..1. Scales the slow idle rotation (0.008 turns per second at 1). Set 0 when something is docked.' },
    pamFlash0: { value: 0, doc: '0..1. Decoy PAM 0 (bp 149..151) glows red.' },
    pamFlash1: { value: 0, doc: '0..1. Decoy PAM 1 (bp 114..116) glows red.' },
    pamFlash2: { value: 0, doc: '0..1. Decoy PAM 2 (bp 84..86) glows red.' },
    pamFlash3: { value: 0, doc: '0..1. Decoy PAM 3 (bp 54..56) glows red.' },
    pamFlash4: { value: 0, doc: '0..1. Decoy PAM 4, the near-match site (bp 27..29), glows red.' },
    pamFlash: { value: 0, doc: '0..1. The real PAM (bp -13..-11) glows red.' },
    nearUnzip: { value: 0, doc: '0..1. Small bubble at the near-match site (bp 30..39); 8 rungs light by 0.7, then it stalls.' },
    unzip: { value: 0, doc: '0..1. The 20-bp bubble at the target opens like a zip, starting at the PAM end.' },
    match: { value: 0, doc: '0..1. The 20 target-strand half-rungs light red in order from the PAM end (0.5 = ten lit).' },
    cut: { value: 0, doc: '0..1. Both backbones snap at the cut site. 0..0.25 the snap, then a ripple that dies away.' },
    repair: { value: 0, doc: '0..1. Needs cut > 0. Ends fray (3 bp lost), drift, rejoin out of register with a scar.' },
    dim: { value: 0, doc: '0..1. The 60 bp around the repaired site (bp -37..22) lose their light.' },
    edit: { value: 0, doc: '0..1. One rung (bp -40) turns gold in place: one base by 0.6, its partner by 1.' },
    sway: { value: 1, doc: '0..1. Slow S-curve drift of the axis. Set 0 while Cas9 is docked.' },
  },
  views: {
    hero: { pos: [8, -5, 16], look: [-1.8, 3, 0], fov: 35 },
    close: { pos: [3.4, 1.4, 10.5], look: [0, 0, 0], fov: 35 },
    target: { pos: [8, 2.2, 20.5], look: [0, 0, 0], fov: 35 },
    along: { pos: [3.4, 14, 6], look: [0, -22, 0], fov: 35 },
  },
  // Base-pair indices of every site. Base pair i is centred at axisPosition(i).
  sites: {
    rise: RISE,
    bpPerTurn: PER_TURN,
    length: { from: -HALF, to: HALF - 1 },
    target: { ...TARGET },
    pam: { ...PAM },
    cut: CUT_S - 0.5, // axisPosition(-7.5): the boundary between bp -8 and bp -7
    decoys: DECOYS.map((c) => ({ from: c - 1, to: c + 1, centre: c })),
    nearMatch: { pam: { from: NEAR.pam - 1, to: NEAR.pam + 1 }, bubble: { from: NEAR.from, to: NEAR.to }, lit: NEAR.lit },
    edit: EDIT,
    deleted: [-8, -7, -6],
    dim: { ...DIM },
  },
};

/** Local Y of the centre of base pair `bp` (fractions allowed) in the untouched helix. */
export function axisPosition(bp) {
  return (bp + 0.5) * RISE;
}

/** Sideways offset (x, z) of the axis at base pair s, for amplitude a and time t. Mirrors hxSway. */
export function swayOffset(s, a, t, out = { x: 0, z: 0 }) {
  out.x = a * (Math.sin(s * SWAY_K + t * 0.35) + 0.45 * Math.sin(s * SWAY_K * 2.3 - t * 0.22 + 1.7));
  out.z = a * 0.8 * Math.sin(s * SWAY_K * 0.9 + t * 0.28 + 2.4);
  return out;
}

// ------------------------------------------------------------------- shaders
const f = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

// Shared by the backbone and rung vertex shaders: where is the centreline of
// strand `st` (0 or 1) at base-pair coordinate `s`, on `side` (-1 below the
// cut, +1 above it)?
const HX_COMMON = /* glsl */ `
uniform vec4 uBub;  // x: upper edge of the target bubble (bp)  y: twist pin  z: upper edge of the near bubble  w: near amplitude
uniform vec4 uCut;  // x: half gap (nm)  y: ripple front (bp from the cut)  z: ripple amplitude  w: fracture faces on
uniform vec4 uRep;  // x: erode  y: close  z: bend-to-meet  w: scar
uniform vec4 uOff;  // xy: sideways offset of the lower end  zw: of the upper end
uniform float uRot; // how far the two halves have turned towards each other in repair (radians)
uniform vec4 uMisc; // x: dim  y: flash  z: shard travel (nm)  w: shard size
uniform vec2 uSway; // x: amplitude (nm)  y: time

const float HX_RISE = ${f(RISE)};
const float HX_TWIST = ${f(TWIST)};
const float HX_SC = ${f(CUT_S)};
const float HX_TA = ${f(TARGET.from - 0.3)};
const float HX_NA = ${f(NEAR.from - 0.3)};
const float HX_EDGE = ${f(EDGE)};

float hxLnCosh(float x) { x = abs(x); return x + log(1.0 + exp(-2.0 * x)) - 0.6931472; }
float hxWin(float s, float a, float b, float e) { return 0.5 * (tanh((s - a) / e) - tanh((s - b) / e)); }
float hxWinInt(float s, float a, float b, float e) {
  return 0.5 * e * (hxLnCosh((s - a) / e) - hxLnCosh((s - b) / e)) + 0.5 * (b - a);
}
float hxOpen(float s) {
  return hxWin(s, HX_TA, uBub.x, HX_EDGE) + uBub.w * hxWin(s, HX_NA, uBub.z, HX_EDGE);
}
float hxEnd(float side) { return HX_SC + (side > 0.0 ? ${f(DEL_U)} : -${f(DEL_L)}) * uRep.x; }

vec3 hxCentre(float s, float st, float side, out float theta) {
  float sg = st * 2.0 - 1.0;
  float w = hxOpen(s);
  float untw = ${f(UNTWIST)} * (hxWinInt(s, HX_TA, uBub.x, HX_EDGE) - uBub.y
             + uBub.w * hxWinInt(s, HX_NA, uBub.z, HX_EDGE));
  float dEnd = abs(s - hxEnd(side));
  float dCut = abs(s - HX_SC);

  // Twist, the strand's angular offset, and the repair's rotation and bend.
  float del = side > 0.0 ? ${f(DEL_U)} : ${f(DEL_L)};
  theta = HX_TWIST * (s - untw) + sg * mix(${f(H0)}, 1.5707963, w)
        - side * 0.5 * (uRot + ${f(MISMATCH)} * uRep.z * exp(-dEnd / ${f(KINK)}));

  float R = mix(${f(RADIUS)}, st < 0.5 ? ${f(R_TARGET)} : ${f(R_OTHER)}, w);

  // Ripple: a wave packet running outward from the cut along the glass.
  float x = dCut - uCut.y;
  float wav = uCut.z * exp(-x * x / 26.0) * sin(x * 0.9);
  R *= 1.0 + 1.1 * wav;
  theta += 2.0 * wav * side;
  vec2 off = wav * 1.3 * vec2(cos(x * 0.33 + side * 1.3), sin(x * 0.33 + side * 1.3));

  // Loose ends: sideways whip and drift, fading away from the break.
  off += exp(-dEnd / 6.0) * (side > 0.0 ? uOff.zw : uOff.xy);

  float y = HX_RISE * s
          + side * (uCut.x * exp(-dCut / 14.0) * (1.0 - uRep.y) - HX_RISE * del * uRep.y)
          + side * wav * 0.5 * sign(x);

  vec2 sw = uSway.x * vec2(
    sin(s * ${f(SWAY_K)} + uSway.y * 0.35) + 0.45 * sin(s * ${f(SWAY_K * 2.3)} - uSway.y * 0.22 + 1.7),
    0.8 * sin(s * ${f(SWAY_K * 0.9)} + uSway.y * 0.28 + 2.4));
  return vec3(R * cos(theta) + off.x + sw.x, y, -R * sin(theta) + off.y + sw.y);
}
`;

const BEAD_PARS = /* glsl */ `
attribute vec4 aBead; // x: base-pair coordinate  y: strand  z: side  w: radius
attribute vec4 aOff;  // xy: offset in the strand's cross-section  z: tint seed  w: scatter seed
varying vec4 vHx;     // x: dim  y: scar  z: glint  w: tint seed
${HX_COMMON}
void hxBead(out vec3 pos, out vec3 nrm) {
  float s = aBead.x;
  float st = aBead.y;
  float side = aBead.z;
  float sEnd = hxEnd(side);
  float th, thb;
  vec3 c = hxCentre(s, st, side, th);
  vec3 T = normalize(hxCentre(s + 0.06, st, side, thb) - hxCentre(s - 0.06, st, side, thb));
  vec3 N0 = vec3(cos(th), 0.0, -sin(th));
  vec3 N = normalize(N0 - T * dot(N0, T));
  vec3 B = cross(T, N);

  // Beads past the frayed end are gone; those next to it shrink a little.
  float past = side * (s - sEnd);
  float keep = smoothstep(-0.05, 0.25, past);
  float dEnd = abs(s - sEnd);
  float scar = uRep.w * exp(-dEnd * dEnd / 0.55);
  float taper = smoothstep(0.0, 8.0, ${f(HALF)} - abs(s));
  float r = aBead.w * keep * taper * (1.0 + 0.35 * scar);

  // At the break, the nearest beads are thrown outward and settle back.
  float h = aOff.w;
  vec3 dir = normalize(vec3(cos(h * 43.9), side * (0.2 + 0.8 * fract(h * 13.7)), sin(h * 43.9)));
  vec3 fly = dir * uMisc.z * uMisc.w * exp(-dEnd / 0.9) * (0.4 + 0.9 * fract(h * 71.3));

  pos = c + N * aOff.x + B * aOff.y + fly + position * r;
  nrm = normal;

  float dCut = abs(s - HX_SC);
  float x = dCut - uCut.y;
  vHx.x = uMisc.x * hxWin(s, ${f(DIM.from)}, ${f(DIM.to + 1)}, 3.0);
  vHx.y = scar;
  vHx.z = uCut.z * 0.35 * exp(-x * x / 10.0) + uMisc.y * exp(-dEnd * dEnd / 1.2);
  vHx.w = aOff.z;
}
`;

const RUNG_PARS = /* glsl */ `
attribute vec4 aInst;  // x: base-pair index  y: strand  z: side
attribute vec4 aState; // x: red glow  y: dim  z: scale  w: unpaired (the join stays open)
attribute float aTip;
attribute vec3 aCol;   // the base's colour
varying vec4 vHx;      // x: dim  y: glow
varying vec3 vCol;
${HX_COMMON}
void hxRung(out vec3 pos, out vec3 nrm) {
  float s = aInst.x + 0.5;
  float side = aInst.z;
  float thA, thB;
  vec3 A = hxCentre(s, 0.0, side, thA);
  vec3 Bc = hxCentre(s, 1.0, side, thB);
  vec3 own = aInst.y < 0.5 ? A : Bc;
  vec3 d = 0.5 * (A + Bc) - own;
  float L0 = length(d);
  vec3 dir = d / L0;
  float open = smoothstep(0.03, 0.55, hxOpen(s));
  float L = mix(L0 - ${f(RUNG_GAP)}, ${f(RUNG_OPEN)}, open) * mix(0.35, 1.0, aState.z) * (1.0 - 0.2 * aState.w);
  vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), dir));
  vec3 e2 = cross(dir, e1);
  float along = position.y * (L - ${f(RUNG_CH)}) + aTip * ${f(RUNG_CH)};
  pos = own + dir * along + (e1 * position.x * ${f(RUNG_W)} + e2 * position.z * ${f(RUNG_T)}) * aState.z;
  vec2 nr = normalize(vec2(normal.x / ${f(RUNG_W)}, normal.z / ${f(RUNG_T)}) + 1e-5) * length(normal.xz);
  nrm = normalize(e1 * nr.x + e2 * nr.y + dir * normal.y);
  vHx = vec4(aState.y, aState.x, 0.0, 0.0);
  vCol = aCol;
}
`;

function patchVertex(shader, pars, call) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${pars}`)
    .replace('#include <beginnormal_vertex>', `vec3 hxP; vec3 hxN; ${call}(hxP, hxN);\nvec3 objectNormal = hxN;`)
    .replace('#include <begin_vertex>', 'vec3 transformed = hxP;');
}

// --------------------------------------------------------------- geometries
function rand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildBeads(perBp, widthSeg, heightSeg) {
  const sphere = new THREE.SphereGeometry(1, widthSeg, heightSeg);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = sphere.index;
  geo.setAttribute('position', sphere.getAttribute('position'));
  geo.setAttribute('normal', sphere.getAttribute('normal'));

  const count = HALF * 2 * 2 * perBp;
  const bead = new Float32Array(count * 4);
  const off = new Float32Array(count * 4);
  let k = 0;
  for (let strand = 0; strand < 2; strand++) {
    for (let i = -HALF; i < HALF; i++) {
      for (let j = 0; j < perBp; j++) {
        const s = i + (j + 0.5) / perBp;
        const seed = rand(strand * 7919 + i * 31 + j * 7);
        const a = j * 2.4 + i * 1.3 + strand * 0.8 + seed * 0.9;
        const ring = BEAD_RING * (0.7 + 0.6 * rand(seed * 11));
        bead.set([s, strand, s < CUT_S ? -1 : 1, BEAD_R * (0.82 + 0.36 * rand(seed * 3))], k * 4);
        off.set([Math.cos(a) * ring * 1.15, Math.sin(a) * ring, rand(seed * 5), seed], k * 4);
        k++;
      }
    }
  }
  geo.setAttribute('aBead', new THREE.InstancedBufferAttribute(bead, 4));
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HALF * RISE + 6);
  return { geo, dispose: () => (geo.dispose(), sphere.dispose()) };
}

// One half-rung: x,z on the unit circle, y from 0 (in the backbone) to 1 (the
// join), plus a short chamfered tip. Scaled into a slat by the shader.
// One half-rung: a chain of beads. x,z are in units of the bead radius
// (scaled by RUNG_W/RUNG_T in the shader), y runs 0 (in the backbone) to 1 (the join).
function buildRungTemplate(radial) {
  const pos = [];
  const nor = [];
  const tip = [];
  const idx = [];
  const sphere = new THREE.SphereGeometry(1, radial, Math.max(4, radial - 2));
  const sp = sphere.getAttribute('position');
  const sn = sphere.getAttribute('normal');
  const si = sphere.index.array;
  const ys = [0.14, 0.38, 0.62, 0.86];
  ys.forEach((y, b) => {
    const base = pos.length / 3;
    const jx = (rand(b * 3.7) - 0.5) * 0.5;
    const jz = (rand(b * 9.1) - 0.5) * 0.5;
    const ry = 0.14;
    for (let v = 0; v < sp.count; v++) {
      pos.push(sp.getX(v) + jx, y + sp.getY(v) * ry, sp.getZ(v) + jz);
      nor.push(sn.getX(v), sn.getY(v), sn.getZ(v));
      tip.push(0);
    }
    for (const i of si) idx.push(base + i);
  });
  sphere.dispose();
  return { pos, nor, tip, idx };
}

function buildRungs(radial) {
  const t = buildRungTemplate(radial);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
  geo.setAttribute('aTip', new THREE.Float32BufferAttribute(t.tip, 1));
  geo.setIndex(t.idx);

  const count = HALF * 2 * 2;
  const inst = new Float32Array(count * 4);
  const state = new Float32Array(count * 4);
  const col = new Float32Array(count * 3);
  const letters = 'ATCG';
  const c = new THREE.Color();
  let k = 0;
  for (let i = -HALF; i < HALF; i++) {
    const own = letters[Math.floor(rand(i * 17.3 + 4.1) * 4)];
    for (let strand = 0; strand < 2; strand++) {
      c.set(BASES[strand === 0 ? own : PAIR[own]]);
      col.set([c.r, c.g, c.b], k * 3);
      inst[k * 4] = i;
      inst[k * 4 + 1] = strand;
      inst[k * 4 + 2] = i + 0.5 < CUT_S ? -1 : 1;
      state[k * 4 + 2] = 1;
      k++;
    }
  }
  geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
  geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3));
  const stateAttr = new THREE.InstancedBufferAttribute(state, 4);
  stateAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aState', stateAttr);
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HALF * RISE + 4);
  return { geo, state, stateAttr };
}

// ------------------------------------------------------------------- helpers
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lnCosh = (x) => {
  x = Math.abs(x);
  return x + Math.log(1 + Math.exp(-2 * x)) - Math.LN2;
};
const winInt = (s, a, b, e) => 0.5 * e * (lnCosh((s - a) / e) - lnCosh((s - b) / e)) + 0.5 * (b - a);

// ---------------------------------------------------------------------- create
export function create(ctx) {
  const high = ctx.quality !== 'low';
  const group = new THREE.Group();
  group.name = 'helix';
  const spinner = new THREE.Group();
  group.add(spinner);

  const uniforms = {
    uBub: { value: new THREE.Vector4(TARGET.from - 0.3, 0, NEAR.from - 0.3, NEAR_AMP) },
    uCut: { value: new THREE.Vector4() },
    uRep: { value: new THREE.Vector4() },
    uOff: { value: new THREE.Vector4() },
    uMisc: { value: new THREE.Vector4() },
    uRot: { value: 0 },
    uGlint: { value: new THREE.Color(ctx.tokens.glass) },
    uRed: { value: new THREE.Color(GOLD) },
    uSway: { value: new THREE.Vector2() },
    uRedGlow: { value: ctx.materials.guide.emissiveIntensity },
    uDimColor: { value: new THREE.Color(0x4a4560) },
  };

  // Backbones: soft, satin beads in lilac and pink, with a faint inner glow at
  // the rim so they read as translucent without the cost of real transmission.
  const beadMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.22,
    sheen: 1,
    sheenColor: new THREE.Color(0xf4c8ee),
    sheenRoughness: 0.45,
    envMapIntensity: 1.15,
  });
  const tints = BACKBONE.map((h) => new THREE.Color(h));
  beadMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      uTintA: { value: tints[0] },
      uTintB: { value: tints[1] },
      uTintC: { value: tints[2] },
    });
    patchVertex(shader, BEAD_PARS, 'hxBead');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec4 vHx;\nuniform vec3 uGlint;\nuniform vec3 uDimColor;\nuniform vec3 uTintA;\nuniform vec3 uTintB;\nuniform vec3 uTintC;'
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 tint = vHx.w < 0.5 ? mix(uTintA, uTintB, vHx.w * 2.0) : mix(uTintB, uTintC, vHx.w * 2.0 - 1.0);
        diffuseColor.rgb = mix(tint, uDimColor * 0.9, vHx.x * 0.85);`
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, vHx.y);')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5);
        totalEmissiveRadiance += diffuseColor.rgb * (0.08 + 0.45 * rim) * (1.0 - vHx.x * 0.8);
        totalEmissiveRadiance += uGlint * vHx.z;`
      );
  };
  beadMat.customProgramCacheKey = () => 'helix-beads';

  const beads = buildBeads(high ? BEADS_PER_BP : 3, high ? 10 : 8, high ? 7 : 6);
  const backbone = new THREE.Mesh(beads.geo, beadMat);
  backbone.frustumCulled = false;
  backbone.name = 'helix-backbone';
  spinner.add(backbone);

  // Rungs: satin beads in the base colours, with gold glow and dimming.
  const frost = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.7,
  });
  frost.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchVertex(shader, RUNG_PARS, 'hxRung');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vHx;\nvarying vec3 vCol;\nuniform vec3 uRed;\nuniform vec3 uDimColor;\nuniform float uRedGlow;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb = mix(vCol, uDimColor, vHx.x * 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, uRed, vHx.y);`
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.35, vHx.y);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uRed * uRedGlow * vHx.y + diffuseColor.rgb * 0.38 * (1.0 - vHx.x);')
      .replace('#include <transmission_fragment>', 'totalSpecular *= mix(1.0, 0.45, vHx.x * (1.0 - vHx.y));\n#include <transmission_fragment>');
  };
  frost.customProgramCacheKey = () => 'helix-frost';

  const rungs = buildRungs(high ? 9 : 6);
  const rungMesh = new THREE.Mesh(rungs.geo, frost);
  rungMesh.frustumCulled = false;
  rungMesh.name = 'helix-rungs';
  spinner.add(rungMesh);

  // Anchors: all on the axis, so spin never moves them.
  const anchors = {};
  const anchorDefs = {
    target: [0, 1],
    pam: [axisPosition(-12) / RISE, -1],
    cutSite: [CUT_S, 0],
    site0: [DECOYS[0] + 0.5, 1],
    site1: [DECOYS[1] + 0.5, 1],
    site2: [DECOYS[2] + 0.5, 1],
    site3: [DECOYS[3] + 0.5, 1],
    site4: [DECOYS[4] + 0.5, 1],
    editSite: [EDIT + 0.5, -1],
    top: [HALF, 1],
    bottom: [-HALF, -1],
  };
  for (const name of Object.keys(anchorDefs)) {
    anchors[name] = new THREE.Object3D();
    anchors[name].name = `helix-anchor-${name}`;
    spinner.add(anchors[name]);
  }

  const params = {};
  for (const [key, def] of Object.entries(meta.params)) params[key] = def.value;

  const rungIndex = (bp, strand) => ((bp + HALF) * 2 + strand) * 4;
  const sw = { x: 0, z: 0 };
  const state = rungs.state;

  function update(time = 0) {
    const p = params;
    const unzip = clamp01(p.unzip);
    const near = clamp01(p.nearUnzip);
    const match = clamp01(p.match);
    const cut = clamp01(p.cut);
    const repair = clamp01(p.repair) * smooth(0, 0.25, cut);
    const dim = clamp01(p.dim);
    const edit = clamp01(p.edit);

    spinner.rotation.y = (p.spin + time * 0.008 * p.idle) * Math.PI * 2;

    // Bubbles.
    const ta = TARGET.from - 0.3;
    const tb = ta + 20.6 * unzip;
    const nearGrow = smooth(0, 0.7, near);
    const nb = NEAR.from - 0.3 + 9.8 * nearGrow;
    uniforms.uBub.value.set(tb, winInt(0, ta, tb, EDGE), nb, NEAR_AMP);

    // Cut: snap (0..0.25), then the ripple.
    const snap = clamp01(cut / 0.25);
    const gap = 0.3 * (1 - Math.exp(-7 * snap) * Math.cos(11 * snap)) * smooth(0, 0.02, cut);
    const q = clamp01((cut - 0.05) / 0.95);
    const front = 2 + 30 * (1 - (1 - q) ** 1.2);
    const waveAmp = 0.23 * smooth(0.02, 0.1, cut) * (1 - q) ** 1.2;
    const shardTravel = 1.7 * (1 - Math.exp(-cut * 6));
    const shardSize = smooth(0, 0.03, cut) * (1 - smooth(0.3, 0.8, cut));
    const whip = 0.3 * Math.exp(-cut * 13) * Math.sin(cut * 46);
    const flash = smooth(0, 0.025, cut) * Math.exp(-cut * 11) * 1.6;

    // Repair: fray, drift, close, bend to meet, scar.
    const erode = smooth(0, 0.4, repair);
    const drift = Math.sin(Math.PI * clamp01(repair / 0.8)) ** 2 * 0.32;
    const close = smooth(0.3, 0.85, repair);
    const bend = smooth(0.5, 0.85, repair);
    const scar = smooth(0.84, 1, repair);
    const capOn = cut > 0 ? 1 - smooth(0.85, 0.9, repair) : 0;

    uniforms.uCut.value.set(gap, front, waveAmp, capOn);
    uniforms.uRep.value.set(erode, close, bend, scar);
    // Twist between the two frayed ends as they are now (it depends on the
    // bubbles), less the part deliberately left out of register.
    const untw = (s) => UNTWIST * (winInt(s, ta, tb, EDGE) + NEAR_AMP * winInt(s, NEAR.from - 0.3, nb, EDGE));
    const sL = CUT_S - DEL_L * erode;
    const sU = CUT_S + DEL_U * erode;
    const between = TWIST * (sU - sL - (untw(sU) - untw(sL)));
    uniforms.uRot.value = Math.max(0, between - MISMATCH) * close;
    // Loose ends tremble very slightly while the break is open (idle only).
    const loose = (cut > 0 ? smooth(0.2, 0.5, cut) : 0) * (1 - close) * 0.035;
    uniforms.uOff.value.set(
      0.8 * whip + 0.75 * drift + loose * Math.sin(time * 0.9),
      0.6 * whip + 0.66 * drift + loose * Math.cos(time * 0.7),
      -0.7 * whip - 0.7 * drift + loose * Math.sin(time * 0.8 + 2),
      0.7 * whip - 0.71 * drift + loose * Math.cos(time * 1.1 + 1)
    );
    uniforms.uMisc.value.set(dim, flash, shardTravel, shardSize);
    const swayAmp = SWAY_AMP * clamp01(p.sway);
    uniforms.uSway.value.set(swayAmp, time);

    // Per-rung state: red glow, dim, scale.
    for (let i = 0; i < state.length; i += 4) {
      state[i] = 0;
      state[i + 1] = 0;
      state[i + 2] = 1;
      state[i + 3] = 0;
    }
    if (dim > 0) {
      for (let bp = DIM.from - 8; bp <= DIM.to + 8; bp++) {
        const w = dim * smooth(DIM.from - 6, DIM.from, bp) * (1 - smooth(DIM.to, DIM.to + 6, bp));
        state[rungIndex(bp, 0) + 1] = w;
        state[rungIndex(bp, 1) + 1] = w;
      }
    }
    const flashSite = (centre, v) => {
      if (v <= 0) return;
      for (let bp = centre - 1; bp <= centre + 1; bp++) {
        state[rungIndex(bp, 0)] = Math.max(state[rungIndex(bp, 0)], v);
        state[rungIndex(bp, 1)] = Math.max(state[rungIndex(bp, 1)], v);
      }
    };
    for (let k = 0; k < 5; k++) flashSite(DECOYS[k], clamp01(p[`pamFlash${k}`]));
    flashSite(-12, clamp01(p.pamFlash));
    for (let k = 0; k < 20; k++) {
      const g = smooth(0, 1, match * 20 - k);
      const j = rungIndex(TARGET.from + k, 0);
      state[j] = Math.max(state[j], g);
    }
    if (near > 0) {
      const stall = smooth(0.7, 0.9, near);
      for (let k = 0; k < NEAR.lit; k++) {
        const flicker = 1 - stall * (0.38 + 0.14 * Math.sin(time * 7 + k * 1.7));
        const g = smooth(0, 1, nearGrow * (NEAR.lit + 0.01) - k) * flicker;
        const j = rungIndex(NEAR.from + k, 0);
        state[j] = Math.max(state[j], g);
      }
    }
    if (edit > 0) {
      state[rungIndex(EDIT, 0)] = smooth(0, 0.6, edit);
      state[rungIndex(EDIT, 1)] = smooth(0.4, 1, edit);
    }
    if (erode > 0) {
      const fade = (bp, t) => {
        const sc = 1 - smooth(0, 1, t);
        state[rungIndex(bp, 0) + 2] = sc;
        state[rungIndex(bp, 1) + 2] = sc;
      };
      fade(-8, erode * 1.6);
      fade(-7, erode * 2.2);
      fade(-6, erode * 2.2 - 1.0);
    }
    if (scar > 0) {
      // The pairs either side of the scar never quite re-form.
      for (const bp of [-9, -5]) {
        for (let strand = 0; strand < 2; strand++) {
          const j = rungIndex(bp, strand);
          state[j + 1] = Math.max(state[j + 1], 0.85 * scar);
          state[j + 3] = scar;
        }
      }
    }
    rungs.stateAttr.needsUpdate = true;

    // Anchors follow the axial motion of their side of the break.
    for (const [name, [s, side]] of Object.entries(anchorDefs)) {
      const del = side > 0 ? DEL_U : DEL_L;
      const dy = side * (gap * Math.exp(-Math.abs(s - CUT_S) / 14) * (1 - close) - RISE * del * close);
      swayOffset(s, swayAmp, time, sw);
      anchors[name].position.set(sw.x, RISE * s + dy, sw.z);
    }
  }

  update(0);

  return {
    group,
    params,
    anchors,
    axisPosition,
    update,
    dispose() {
      beads.dispose();
      rungs.geo.dispose();
      beadMat.dispose();
      frost.dispose();
    },
  };
}
