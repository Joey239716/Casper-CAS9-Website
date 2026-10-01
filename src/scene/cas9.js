// Cas9 and the guide RNA. Owner: agent 02-cas9. See agents/briefs/02-cas9.md.
//
// The glass form is the real S. pyogenes Cas9 surface from PDB 5F9R (Jiang et al.,
// Science 2016), smoothed and split into its two lobes by scripts/build-cas9.mjs.
// The red thread is the single-guide RNA backbone from the same structure, simplified.
//
// Local frame (CONTRACT section 4): 1 unit = 1 nm, the DNA channel is the local +Y
// axis through the origin, the origin is the centre of the 20-bp target, and the
// PAM-proximal end of the target is at -Y.
import * as THREE from 'three';

export const meta = {
  name: 'cas9',
  params: {
    open: { value: 0, doc: '0..1. 1 = the two lobes swung apart on their hinge, empty and waiting. 0 = closed working shape.' },
    guide: { value: 1, doc: '0..1. The red guide RNA drawn along its path, from the scaffold on the outside into the channel. 0 = absent, 1 = fully seated.' },
    grip: { value: 0, doc: '0..1. Slight further tightening around the DNA when the match locks. Subtle.' },
    cutPulse: { value: 0, doc: '0..1. Red flare at the HNH and RuvC sites; peaks at 0.5, gone at 0 and at 1.' },
    presence: { value: 1, doc: '0..1. Overall visibility: 0 = gone (nothing drawn), 1 = fully there. Scale and opacity together.' },
  },
  views: {
    hero: { pos: [9.5, 3.2, 23], look: [0.6, -0.6, -0.4], fov: 35 },
    close: { pos: [4.5, 1.2, 12.5], look: [0.4, -0.3, 0], fov: 35 },
    channel: { pos: [0.6, 25, 2.4], look: [0.6, 0, -0.4], fov: 35 },
    docked: { pos: [11, 4.5, 21], look: [0.4, -0.4, 0], fov: 35 },
  },
  source: {
    pdb: '5F9R',
    citation:
      'Jiang F, Taylor DW, Chen JS, Kornfeld JE, Zhou K, Thompson AJ, Nogales E, Doudna JA. Structures of a CRISPR-Cas9 R-loop complex primed for DNA cleavage. Science. 2016;351(6275):867-871. doi:10.1126/science.aad8282',
  },
};

const BASE = import.meta.env?.BASE_URL ?? '/';
const DEG = Math.PI / 180;

const OPEN_REC = 30 * DEG; // how far each lobe swings at open = 1
const OPEN_NUC = 20 * DEG;
const GRIP = 1.3 * DEG; // extra closing of each lobe at grip = 1
const BREATH = 0.45 * DEG;
const THREAD_RADIUS = 0.06;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- mesh loading
function octDecode(u, v, out, o) {
  let x = u / 32767;
  let y = v / 32767;
  const z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) {
    const ox = x;
    x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1);
    y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1);
  }
  const l = Math.hypot(x, y, z) || 1;
  out[o] = x / l;
  out[o + 1] = y / l;
  out[o + 2] = z / l;
}

// Both lobes in one geometry. aLobe says which lobe a vertex belongs to (0 REC, 1 NUC);
// the vertex shader swings each lobe about the hinge, so the pair is one draw call.
function decodeLobes(buffer, lobes, bounds) {
  const nv = lobes.reduce((n, l) => n + l.vertices, 0);
  const nt = lobes.reduce((n, l) => n + l.triangles, 0);
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const lobe = new Float32Array(nv);
  const index = new Uint32Array(nt * 3);
  let v0 = 0;
  let i0 = 0;
  for (const info of lobes) {
    const P = new Int16Array(buffer, info.positions, info.vertices * 3);
    const N = new Int16Array(buffer, info.normals, info.vertices * 2);
    const Index = info.indexType === 'uint32' ? Uint32Array : Uint16Array;
    const I = new Index(buffer, info.indices, info.triangles * 3);
    for (let i = 0; i < info.vertices; i++) {
      const o = (v0 + i) * 3;
      for (let k = 0; k < 3; k++) {
        pos[o + k] = bounds.min[k] + ((P[i * 3 + k] + 32768) / 65535) * (bounds.max[k] - bounds.min[k]);
      }
      octDecode(N[i * 2], N[i * 2 + 1], nrm, o);
      lobe[v0 + i] = info.name === 'nuc' ? 1 : 0;
    }
    for (let i = 0; i < I.length; i++) index[i0 + i] = I[i] + v0;
    v0 += info.vertices;
    i0 += I.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aLobe', new THREE.BufferAttribute(lobe, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

// ---------------------------------------------------------------- materials
// Vertex-side hinge shared by the glass and its inner wall.
function addHinge(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      attribute float aLobe;
      uniform vec2 uLobeAngle;
      uniform vec3 uHinge;
      vec3 cas9Swing( vec3 p, float a ) {
        float c = cos( a ), s = sin( a );
        return vec3( p.x * c + p.z * s, p.y, -p.x * s + p.z * c );
      }`
    )
    .replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      float cas9Angle = aLobe < 0.5 ? uLobeAngle.x : uLobeAngle.y;
      objectNormal = cas9Swing( objectNormal, cas9Angle );`
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed = uHinge + cas9Swing( transformed - uHinge, cas9Angle );`
    );
}

// The studio's light panels exist only in the environment map, and three's
// transmission refracts the rendered scene but never the environment. On thin tubes
// that does not matter; on a body several nanometres thick it leaves the inside
// black, so the form reads as obsidian. This adds what a thick piece of glass would
// show: the panels refracted through the body, with a little dispersion.
// Fragment-only, no extra draw calls. See request R-02-1 in agents/status/02-cas9.md.
const BODY = { refract: 0.42, inner: 0.1, spread: 0.035, rough: 0.1, wall: 0.2, wallRough: 0.2 };

function thickGlass(material, hinge) {
  const u = {
    uBodyRefract: { value: BODY.refract },
    uBodyInner: { value: BODY.inner },
    uBodySpread: { value: BODY.spread },
    uBodyRough: { value: BODY.rough },
  };
  material.onBeforeCompile = (shader) => {
    addHinge(shader, hinge);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uBodyRefract, uBodyInner, uBodySpread, uBodyRough;`
      )
      .replace(
        '#include <transmission_fragment>',
        `#include <transmission_fragment>
        #if defined( USE_TRANSMISSION ) && defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
        {
          vec3 inc = -v;
          float facing = saturate( dot( n, v ) );
          float fres = 0.04 + 0.96 * pow( 1.0 - facing, 5.0 );
          float eta = 1.0 / material.ior;
          vec3 rR = refract( inc, n, eta * ( 1.0 + uBodySpread ) );
          vec3 rG = refract( inc, n, eta );
          vec3 rB = refract( inc, n, eta * ( 1.0 - uBodySpread ) );
          vec3 lens = vec3(
            textureCubeUV( envMap, envMapRotation * rR, uBodyRough ).r,
            textureCubeUV( envMap, envMapRotation * rG, uBodyRough ).g,
            textureCubeUV( envMap, envMapRotation * rB, uBodyRough ).b );
          vec3 inner = textureCubeUV( envMap, envMapRotation * reflect( rG, n ), uBodyRough * 2.0 ).rgb;
          totalDiffuse += ( lens * uBodyRefract + inner * uBodyInner ) * ( 1.0 - fres ) * material.transmission * envMapIntensity * diffuse;
        }
        #endif`
      );
  };
  material.customProgramCacheKey = () => 'cas9-thick-glass';
  material.userData.body = u;
  return material;
}

// The far inner wall of the lobes. Seen from inside, a glass-to-air surface is a
// near-perfect mirror beyond the critical angle, so thick glass shows bright
// reflections of the lights on its far side. Drawn as an additive back-face shell in
// the opaque pass: it occludes nothing, and the front surface then refracts it.
function innerWall(envMapIntensity, hinge) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: BODY.wallRough,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    envMapIntensity,
  });
  const u = { uWall: { value: 1 } };
  m.onBeforeCompile = (shader) => {
    addHinge(shader, hinge);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWall;')
      .replace(
        '#include <opaque_fragment>',
        `{
          // internal Fresnel, with total internal reflection past about 42 degrees
          float c = saturate( dot( normal, normalize( vViewPosition ) ) );
          float s = sqrt( 1.0 - c * c );
          float tir = smoothstep( 0.5, 0.75, s );
          outgoingLight *= uWall * ( 0.04 + 0.96 * tir );
        }
        #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => 'cas9-inner-wall';
  m.userData.u = u;
  return m;
}

// A tube whose radius is set in the vertex shader, so it can be drawn progressively
// with a tapered leading tip and thinned to nothing, in one draw call.
function makeThread(points, segments, radial, baseMaterial) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  curve.arcLengthDivisions = 1200;
  const geo = new THREE.TubeGeometry(curve, segments, THREAD_RADIUS, radial, false);
  const uv = geo.getAttribute('uv');
  const along = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) along[i] = uv.getX(i);
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.deleteAttribute('uv');

  const length = curve.getLength();
  const uniforms = {
    uReveal: { value: 1 },
    uThin: { value: 1 },
    uTaper: { value: 0.9 / length }, // the leading tip tapers over 0.9 nm
    uCap: { value: THREAD_RADIUS / length },
    uRadius: { value: THREAD_RADIUS },
  };
  const material = baseMaterial.clone();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aAlong;
        uniform float uReveal, uThin, uTaper, uCap, uRadius;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // Leading tip: a round-nosed taper that ends exactly at uReveal.
          float head = clamp( ( uReveal - aAlong ) / uTaper, 0.0, 1.0 );
          head = sqrt( 1.0 - ( 1.0 - head ) * ( 1.0 - head ) );
          // Fixed end: a hemispherical cap.
          float tail = clamp( aAlong / uCap, 0.0, 1.0 );
          tail = sqrt( 1.0 - ( 1.0 - tail ) * ( 1.0 - tail ) );
          transformed -= normal * uRadius * ( 1.0 - head * tail * uThin );
        }`
      );
  };
  material.customProgramCacheKey = () => 'cas9-thread';
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh, curve, uniforms, material, geo, length };
}

function haloTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = Math.pow(Math.max(0, 1 - r), 2.2);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  const tex = new THREE.DataTexture(data, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- model
export async function create(ctx) {
  const high = ctx.quality === 'high';
  const data = await (await fetch(`${BASE}models/cas9.json`)).json();
  const lod = data.files[high ? 'hi' : 'lo'];
  const buffer = await (await fetch(`${BASE}models/${lod.file}`)).arrayBuffer();

  const group = new THREE.Group();
  const root = new THREE.Group(); // presence scale
  group.add(root);
  const disposables = [];
  const own = (x) => {
    disposables.push(x);
    return x;
  };

  // ---- glass lobes --------------------------------------------------------
  const hinge = new THREE.Vector3(...data.hinge.point);
  const hingeUniforms = { uLobeAngle: { value: new THREE.Vector2() }, uHinge: { value: hinge } };
  // Two variants of the shared glass: solid, and one that can fade (presence < 1).
  const glass = own(thickGlass(ctx.materials.glass.clone(), hingeUniforms));
  const glassFade = own(thickGlass(ctx.materials.glass.clone(), hingeUniforms));
  glassFade.transparent = true;
  const wall = high ? own(innerWall(BODY.wall, hingeUniforms)) : null;

  const lobeGeo = own(decodeLobes(buffer, lod.lobes, data.bounds));
  const lobes = new THREE.Mesh(lobeGeo, glass);
  lobes.frustumCulled = false; // the shader moves the lobes
  root.add(lobes);
  if (wall) {
    const wallMesh = new THREE.Mesh(lobeGeo, wall);
    wallMesh.frustumCulled = false;
    root.add(wallMesh);
  }

  // Pivots follow the same swing as the shader, for anchors and flares.
  const pivots = {};
  for (const name of ['rec', 'nuc']) {
    pivots[name] = new THREE.Group();
    pivots[name].position.copy(hinge);
    root.add(pivots[name]);
  }
  // Sign of the rotation about +Y that carries REC away from NUC.
  const recC = new THREE.Vector3(...data.lobeCentres.rec).sub(hinge);
  const nucC = new THREE.Vector3(...data.lobeCentres.nuc).sub(hinge);
  const away = new THREE.Vector3(recC.z, 0, -recC.x).dot(nucC.clone().sub(recC)) < 0 ? 1 : -1;

  // ---- guide RNA thread ---------------------------------------------------
  // Path runs from the 3' end of the scaffold (u = 0) to the 5' tip of the spacer (u = 1).
  const pathPoints = data.guide.map((p) => new THREE.Vector3(...p)).reverse();
  const thread = makeThread(pathPoints, high ? 1100 : 500, high ? 10 : 6, ctx.materials.guide);
  root.add(thread.mesh);
  own(thread.geo);
  own(thread.material);
  const guideEmissive = ctx.materials.guide.emissiveIntensity;

  // ---- nuclease flares ----------------------------------------------------
  const flareMat = own(ctx.materials.guide.clone());
  const flareGeo = own(new THREE.IcosahedronGeometry(1, 3));
  const haloTex = own(haloTexture());
  const haloMat = own(
    new THREE.SpriteMaterial({
      map: haloTex,
      color: ctx.tokens.gold,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      fog: false,
    })
  );
  const flares = ['hnh', 'ruvc'].map((name) => {
    const holder = new THREE.Object3D();
    holder.position.fromArray(data.sites[name]).sub(hinge);
    const core = new THREE.Mesh(flareGeo, flareMat);
    const halo = new THREE.Sprite(haloMat);
    halo.renderOrder = 10;
    holder.add(core, halo);
    pivots.nuc.add(holder); // both nuclease domains belong to the NUC lobe
    return { holder, core, halo };
  });

  // ---- anchors ------------------------------------------------------------
  const at = (parent, p, relativeToHinge = false) => {
    const o = new THREE.Object3D();
    o.position.fromArray(p);
    if (relativeToHinge) o.position.sub(hinge);
    parent.add(o);
    return o;
  };
  const anchors = {
    centre: at(root, [0, 0, 0]),
    hnh: flares[0].holder,
    ruvc: flares[1].holder,
    guideTip: at(root, data.guide[0]),
    recLobe: at(pivots.rec, data.lobeCentres.rec, true),
    nucLobe: at(pivots.nuc, data.lobeCentres.nuc, true),
  };

  const params = { open: 0, guide: 1, grip: 0, cutPulse: 0, presence: 1 };
  const tip = new THREE.Vector3();
  const clamp01 = (x) => Math.min(1, Math.max(0, x));

  function update(time) {
    const presence = clamp01(params.presence);
    group.visible = presence > 0.001;
    if (!group.visible) return;

    // presence: arrive by growing slightly and clearing from nothing
    const appear = smooth(0, 1, presence);
    root.scale.setScalar(0.86 + 0.14 * appear);
    const fading = presence < 0.999;
    lobes.material = fading ? glassFade : glass;
    if (fading) glassFade.opacity = smooth(0, 0.85, presence);
    if (wall) wall.userData.u.uWall.value = appear * appear;

    // lobes: hinge, grip, and a slow breath that only ever opens from the closed pose
    const open = smooth(0, 1, clamp01(params.open));
    const grip = smooth(0, 1, clamp01(params.grip));
    const breath = (0.5 + 0.5 * Math.sin(time * 0.8)) * BREATH * (1 - 0.7 * grip);
    const rec = away * (open * OPEN_REC - grip * GRIP + breath);
    const nuc = -away * (open * OPEN_NUC - grip * GRIP + breath * 0.7);
    hingeUniforms.uLobeAngle.value.set(rec, nuc);
    pivots.rec.rotation.y = rec;
    pivots.nuc.rotation.y = nuc;

    // thread
    const g = clamp01(params.guide);
    thread.mesh.visible = g > 0.0005;
    thread.uniforms.uReveal.value = g;
    thread.uniforms.uThin.value = smooth(0.15, 0.9, presence);
    thread.material.emissiveIntensity = guideEmissive * (0.25 + 0.75 * appear);
    thread.curve.getPointAt(g, tip);
    anchors.guideTip.position.copy(tip);

    // nuclease flare: a bell that is zero at both ends
    const bell = Math.pow(Math.sin(Math.PI * clamp01(params.cutPulse)), 1.6);
    const on = bell > 0.002;
    flareMat.emissiveIntensity = guideEmissive * (1 + 5 * bell);
    for (const f of flares) {
      f.core.visible = f.halo.visible = on;
      f.core.scale.setScalar(0.1 + 0.22 * bell);
      f.halo.scale.setScalar(0.6 + 3.4 * bell);
    }
    haloMat.opacity = 0.85 * bell * appear;
  }

  update(0);

  return {
    group,
    params,
    anchors,
    update,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
