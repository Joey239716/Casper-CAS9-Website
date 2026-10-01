// Hemoglobin: one tetramer close up, with a loose crowd of others behind it.
// Owner: main session (D-009).
//
// Four globin chains, each a soft lobe holding one heme (a flat red disc with
// an iron atom at its centre). Two lobes are alpha chains. The other two are
// beta chains (adult, HbA) that turn into gamma chains (fetal, HbF) as `fetal`
// goes 0 -> 1. The shapes are a stylisation, not a structure.
//
// Coordinates: 1 unit = 1 nm; the tetramer is about 6.5 nm across, centred on
// the origin. The site keeps the group in front of the camera (views.hero).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const meta = {
  name: 'hemoglobin',
  params: {
    presence: { value: 1, doc: '0..1. Master fade. 0 hides the module.' },
    fetal: { value: 0, doc: '0..1. The two beta chains (violet) become gamma chains (teal), one after the other.' },
    spin: { value: 0, doc: 'Turns. Extra rotation on top of the slow idle turn.' },
  },
  views: {
    hero: { pos: [0, 0, 20], look: [0, 0, 0], fov: 35 },
    close: { pos: [3, 2, 13], look: [0, 0, 0], fov: 35 },
  },
};

const ALPHA = 0x4a82f5; // alpha chains: blue
const BETA = 0x9a5eea; // beta chains (adult): violet
const GAMMA = 0x18c99a; // gamma chains (fetal): teal
const HEME = 0xff4a55;
const IRON = 0xffc670;

// Chain centres: the corners of a tetrahedron, two alpha and two beta.
const CORNERS = [
  [1, 1, 1],
  [-1, -1, 1],
  [-1, 1, -1],
  [1, -1, -1],
].map((c) => new THREE.Vector3(...c).normalize().multiplyScalar(1.95));

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A globin chain as one lumpy, rounded lobe: a sphere pushed in and out by a
// few slow waves, so each one is a little different.
function lobeGeometry(seed, detail) {
  const rand = mulberry(seed);
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const geo = mergeVertices(ico);
  ico.dispose();
  const waves = Array.from({ length: 5 }, () => ({
    dir: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
    freq: 0.7 + rand() * 0.9,
    phase: rand() * 6.283,
    amp: 0.035 + rand() * 0.04,
  }));
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let r = 1;
    for (const w of waves) r += w.amp * Math.sin(v.dot(w.dir) * w.freq * 3 + w.phase);
    v.multiplyScalar(r);
    pos.setXYZ(i, v.x * 1.7, v.y * 1.42, v.z * 1.36);
  }
  geo.computeVertexNormals();
  return geo;
}

function satin(color) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    sheen: 0.5,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5),
    sheenRoughness: 0.5,
    envMapIntensity: 0.8,
    transparent: true,
  });
  mat.emissive.set(color);
  mat.emissiveIntensity = 0.2;
  return mat;
}

function glowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  r.addColorStop(0.65, 'rgba(255,255,255,0.12)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function create(ctx) {
  const low = ctx.quality === 'low';
  const disposables = [];
  const own = (x) => {
    disposables.push(x);
    return x;
  };

  const group = new THREE.Group();
  group.name = 'hemoglobin';
  const spinner = new THREE.Group(); // the tetramer turns; the crowd does not
  group.add(spinner);

  const colors = { alpha: new THREE.Color(ALPHA), beta: new THREE.Color(BETA), gamma: new THREE.Color(GAMMA) };
  const hemeMat = own(new THREE.MeshPhysicalMaterial({ color: HEME, roughness: 0.3, clearcoat: 1, transparent: true }));
  hemeMat.emissive.set(HEME);
  hemeMat.emissiveIntensity = 0.55;
  const ironMat = own(new THREE.MeshPhysicalMaterial({ color: IRON, roughness: 0.25, metalness: 0.6, transparent: true }));
  ironMat.emissive.set(IRON);
  ironMat.emissiveIntensity = 0.5;
  const hemeGeo = own(new THREE.CylinderGeometry(0.7, 0.7, 0.16, low ? 24 : 48));
  const hemeRim = own(new THREE.TorusGeometry(0.7, 0.08, 10, low ? 24 : 48));
  const ironGeo = own(new THREE.SphereGeometry(0.17, 20, 14));

  // ---- The tetramer ---------------------------------------------------------
  const rand = mulberry(11);
  const out = new THREE.Vector3();
  const lobes = CORNERS.map((centre, i) => {
    const kind = i < 2 ? 'alpha' : 'beta';
    const mat = own(satin(colors[kind]));
    const lobe = new THREE.Group();
    lobe.position.copy(centre);
    // Long axis roughly across the radius, each lobe turned a little differently.
    lobe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out.copy(centre).normalize());
    lobe.rotateZ(rand() * Math.PI * 2);
    const mesh = new THREE.Mesh(own(lobeGeometry(31 + i * 17, low ? 4 : 6)), mat);
    lobe.add(mesh);

    // The heme: a disc set edge-on into the outer face, half of it showing.
    const heme = new THREE.Group();
    heme.position.set(0.45, 0.2, 1.18);
    heme.rotation.set(0.35, 0, Math.PI / 2 + 0.3);
    heme.add(new THREE.Mesh(hemeGeo, hemeMat));
    const rim = new THREE.Mesh(hemeRim, hemeMat);
    rim.rotation.x = Math.PI / 2;
    heme.add(rim);
    heme.add(new THREE.Mesh(ironGeo, ironMat));
    lobe.add(heme);

    spinner.add(lobe);
    return { kind, lobe, mat, heme };
  });

  // ---- The crowd: a red cell is packed with these ---------------------------
  // Far, simple copies (four plain spheres each) for depth. Their beta spheres
  // share one material, so they change colour with the hero.
  const crowd = new THREE.Group();
  group.add(crowd);
  const crowdCount = low ? 26 : 60;
  const ball = own(new THREE.IcosahedronGeometry(1, 3));
  const crowdAlpha = own(satin(colors.alpha));
  const crowdBeta = own(satin(colors.beta));
  const meshA = new THREE.InstancedMesh(ball, crowdAlpha, crowdCount * 2);
  const meshB = new THREE.InstancedMesh(ball, crowdBeta, crowdCount * 2);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    const e = new THREE.Euler();
    for (let i = 0; i < crowdCount; i++) {
      // Spread behind the hero, and never across the middle of the view.
      const z = -30 - rand() * 80;
      const spread = 8 + -z * 0.6;
      // Mostly to the right: the scene's text is on the left of the view.
      let x = (rand() * 1.15 - 0.12) * spread;
      const y = (rand() - 0.5) * 1.3 * spread;
      if (Math.abs(x) < 10 && Math.abs(y) < 9) x += Math.sign(x || 1) * 13;
      c.set(x, y, z);
      q.setFromEuler(e.set(rand() * 6.283, rand() * 6.283, rand() * 6.283));
      CORNERS.forEach((corner, k) => {
        p.copy(corner).multiplyScalar(0.92).applyQuaternion(q).add(c);
        m.compose(p, q, s.set(1.6, 1.4, 1.35));
        (k < 2 ? meshA : meshB).setMatrixAt(i * 2 + (k % 2), m);
      });
    }
  }
  meshA.frustumCulled = false;
  meshB.frustumCulled = false;
  crowd.add(meshA, meshB);

  // ---- A soft light behind the hero -----------------------------------------
  const glowMat = own(
    new THREE.SpriteMaterial({
      map: own(glowTexture()),
      color: 0x6a52f0,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: false,
    })
  );
  const glow = new THREE.Sprite(glowMat);
  glow.position.set(0, 0, -9);
  glow.scale.set(34, 34, 1);
  glow.renderOrder = -500;
  group.add(glow);

  // ---- Anchors ---------------------------------------------------------------
  const anchors = { fetal: new THREE.Object3D(), heme: new THREE.Object3D() };
  // The label hangs beside the tetramer, not on it, so it never covers the lobes.
  anchors.fetal.position.set(2.7, -2.9, 0);
  group.add(anchors.fetal);
  lobes[0].heme.add(anchors.heme);

  const params = {};
  for (const [key, def] of Object.entries(meta.params)) params[key] = def.value;
  const tint = new THREE.Color();
  const glowA = new THREE.Color(0x6a52f0);
  const glowB = new THREE.Color(0x2fb7a6);
  const fading = [hemeMat, ironMat, crowdAlpha, crowdBeta, ...lobes.map((l) => l.mat)];

  function update(time = 0) {
    const presence = clamp01(params.presence);
    group.visible = presence > 0.001;
    if (!group.visible) return;
    const fetal = clamp01(params.fetal);

    spinner.rotation.set(0.25 + Math.sin(time * 0.21) * 0.08, (params.spin + time * 0.018) * Math.PI * 2, 0.12);
    spinner.scale.setScalar(0.86 + 0.14 * presence);
    crowd.rotation.z = time * 0.006;

    // Beta to gamma, one lobe after the other, each with a small swell as it turns.
    let k = 0;
    for (const l of lobes) {
      if (l.kind !== 'beta') continue;
      const t = smooth(k * 0.35, 0.65 + k * 0.35, fetal);
      tint.copy(colors.beta).lerp(colors.gamma, t);
      l.mat.color.copy(tint);
      l.mat.emissive.copy(tint);
      l.lobe.scale.setScalar(1 + 0.09 * Math.sin(Math.PI * t));
      k++;
    }
    tint.copy(colors.beta).lerp(colors.gamma, smooth(0.2, 0.9, fetal));
    crowdBeta.color.copy(tint);
    crowdBeta.emissive.copy(tint);

    for (const m of fading) m.opacity = presence;
    glowMat.color.copy(glowA).lerp(glowB, fetal * 0.6);
    glowMat.opacity = 0.42 * presence;
  }

  update(0);

  return {
    group,
    params,
    anchors,
    update,
    dispose() {
      for (const d of disposables) d.dispose();
      meshA.dispose();
      meshB.dispose();
    },
  };
}
