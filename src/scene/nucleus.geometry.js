// Private helpers for nucleus.js. Owner: agent 04-atmosphere.
// Seeded randomness, fibre paths, tube building and the shared GLSL snippets.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Monotone cubic interpolation (Fritsch-Carlson) with a forced end slope.
// Used for the travel curve so scroll never moves the camera backwards.
export function monotone(xs, ys, endSlope = null) {
  const n = xs.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(endSlope ?? d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

// A worm-like chain: a random walk with a persistent heading, softly kept inside
// a box, then pushed out of an exclusion zone by `exclude(point)`.
export function wormPath(rng, { start, steps, step, turn, inside, home, exclude }) {
  const p = start.clone();
  const dir = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
  const pull = new THREE.Vector3();
  const points = [];
  for (let i = 0; i < steps; i++) {
    points.push(p.clone());
    dir.x += (rng() - 0.5) * 2 * turn;
    dir.y += (rng() - 0.5) * 2 * turn;
    dir.z += (rng() - 0.5) * 2 * turn;
    if (!inside(p)) dir.addScaledVector(pull.copy(home(p)).sub(p).normalize(), 0.45);
    dir.normalize();
    p.addScaledVector(dir, step);
  }
  if (exclude) {
    for (const q of points) exclude(q);
    // One relaxation pass takes the kinks out where the exclusion bent the path.
    for (let i = 1; i < points.length - 1; i++) {
      points[i].multiplyScalar(0.5).addScaledVector(points[i - 1], 0.25).addScaledVector(points[i + 1], 0.25);
    }
    for (const q of points) exclude(q);
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  curve.arcLengthDivisions = Math.max(200, steps * 14);
  return curve;
}

// Tube with a per-ring radius. No UVs; indexed; outward normals.
export function buildTube(curve, segs, radial, radiusFn) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = new Float32Array((segs + 1) * radial * 3);
  const nor = new Float32Array((segs + 1) * radial * 3);
  const P = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, P);
    const r = radiusFn(u);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const nx = c * N.x + s * B.x;
      const ny = c * N.y + s * B.y;
      const nz = c * N.z + s * B.z;
      pos[k] = P.x + r * nx;
      pos[k + 1] = P.y + r * ny;
      pos[k + 2] = P.z + r * nz;
      nor[k] = nx;
      nor[k + 1] = ny;
      nor[k + 2] = nz;
      k += 3;
    }
  }
  const idx = [];
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

// Strip a geometry down to non-indexed position + normal so different primitives can be merged.
export function bare(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  return g;
}

// ---- GLSL -----------------------------------------------------------------

// The inside of the nucleus has a faint glow at the vanishing point. Solid
// objects fog towards it, and a backing dome draws the same function, so far
// fibres dissolve into the glow instead of into flat black.
export const GLSL_FOG = /* glsl */ `
  uniform float uFogDensity;
  uniform vec3 uFogColor;
  uniform vec3 uGlowColor;
  uniform float uGlow;
  uniform float uPresence;
  vec3 nucFogColor(vec3 dir) {
    float off = 1.0 - clamp(-dir.z, 0.0, 1.0);
    float core = exp(-off * 26.0) * 0.7 + exp(-off * 5.0) * 0.3;
    return mix(uFogColor, uGlowColor, core * uGlow);
  }
  float nucFogFactor(float dist) {
    float f = dist * uFogDensity;
    return exp(-f * f);
  }
`;

// Tileable Perlin height field baked with its gradient, so the envelope shader
// gets smooth bump lighting from two texture reads.
//   R: height 0..1   G,B: d(height)/d(uv), scaled by 1/userData.gradScale   A: a second, independent field
export function noiseTexture(rng, size = 512) {
  const perlin = (grid) => {
    const gx = new Float32Array(grid * grid);
    const gy = new Float32Array(grid * grid);
    for (let i = 0; i < gx.length; i++) {
      const a = rng() * Math.PI * 2;
      gx[i] = Math.cos(a);
      gy[i] = Math.sin(a);
    }
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    return (x, y) => {
      const fx = x * grid;
      const fy = y * grid;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const x0 = ix % grid;
      const x1 = (ix + 1) % grid;
      const y0 = (iy % grid) * grid;
      const y1 = ((iy + 1) % grid) * grid;
      const d = (k, dx, dy) => gx[k] * dx + gy[k] * dy;
      const a = d(y0 + x0, tx, ty);
      const b = d(y0 + x1, tx - 1, ty);
      const c = d(y1 + x0, tx, ty - 1);
      const e = d(y1 + x1, tx - 1, ty - 1);
      const u = fade(tx);
      const v = fade(ty);
      return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
    };
  };
  const field = (grids, weights) => {
    const layers = grids.map(perlin);
    const out = new Float32Array(size * size);
    let min = Infinity;
    let max = -Infinity;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let h = 0;
        for (let i = 0; i < layers.length; i++) h += layers[i](x / size, y / size) * weights[i];
        out[y * size + x] = h;
        if (h < min) min = h;
        if (h > max) max = h;
      }
    }
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / (max - min);
    return out;
  };
  const H = field([4, 8, 16, 32, 64], [1, 0.5, 0.26, 0.13, 0.07]);
  const A = field([6, 12, 24, 48], [1, 0.5, 0.25, 0.12]);
  const gxs = new Float32Array(size * size);
  const gys = new Float32Array(size * size);
  let gmax = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      const xl = y * size + ((x + size - 1) % size);
      const xr = y * size + ((x + 1) % size);
      const yd = ((y + size - 1) % size) * size + x;
      const yu = ((y + 1) % size) * size + x;
      gxs[k] = ((H[xr] - H[xl]) * size) / 2;
      gys[k] = ((H[yu] - H[yd]) * size) / 2;
      gmax = Math.max(gmax, Math.abs(gxs[k]), Math.abs(gys[k]));
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let k = 0; k < size * size; k++) {
    data[k * 4] = Math.round(H[k] * 255);
    data[k * 4 + 1] = Math.round((gxs[k] / gmax) * 127.5 + 127.5);
    data[k * 4 + 2] = Math.round((gys[k] / gmax) * 127.5 + 127.5);
    data[k * 4 + 3] = Math.round(A[k] * 255);
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.userData.gradScale = gmax;
  tex.needsUpdate = true;
  return tex;
}

// Patch a cloned standard material: own fog (towards the glow), a glassy rim
// term, and the presence fade. `shared` holds the uniform objects.
//   objP:   pass the pre-model-matrix position (instance-aware) as vObjP
//   pars:   extra fragment declarations
//   color:  code after <map_fragment> (may change diffuseColor, may discard)
//   bump:   code after <normal_fragment_maps> (may change normal)
//   light:  code just before fog (may change outgoingLight)
let patchId = 0;
export function patchSolid(material, shared, { rim = 0.5, rimPower = 3, objP = false, pars = '', color = '', bump = '', light = '' } = {}) {
  material.fog = false;
  const uRim = { value: rim };
  material.userData.uRim = uRim;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.uniforms.uRim = uRim;
    if (objP) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObjP;')
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vObjP = (instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vObjP = transformed;
          #endif`
        );
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_FOG}\nuniform float uRim;\n${objP ? 'varying vec3 vObjP;' : ''}\n${pars}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${color}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${bump}`)
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          vec3 vdir = normalize(vViewPosition);
          float rimT = pow(1.0 - clamp(abs(dot(normalize(normal), vdir)), 0.0, 1.0), ${rimPower.toFixed(2)});
          outgoingLight += rimT * uRim * vec3(0.42, 0.50, 0.62);
          ${light}
          float ff = nucFogFactor(length(vViewPosition)) * uPresence;
          outgoingLight = mix(nucFogColor(-vdir), outgoingLight, ff);
        }
        #include <opaque_fragment>`
      );
  };
  // Distinct cache key per variant so three does not reuse the wrong program.
  const key = `nuc:${patchId++}`;
  material.customProgramCacheKey = () => key;
  return material;
}

// Icosahedron with smooth (radial) normals even at detail 0: the cheap far bead.
export function smoothIco(detail) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  g.setAttribute('normal', g.getAttribute('position').clone());
  g.deleteAttribute('uv');
  return g;
}

// Soft additive material: alpha falls off towards the silhouette, so tubes and
// beads read as out-of-focus strands. Drawn in the opaque pass (transparent:
// false + additive) with a late renderOrder, so clear glass refracts it.
export function softMaterial({ color, opacity = 1, soft = 1.6, uniforms = {} }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uSoft: { value: soft },
      uFog: { value: 0.012 },
      uNear: { value: new THREE.Vector2(4, 12) },
      ...uniforms,
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 p = position;
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = (instanceMatrix * vec4(p, 1.0)).xyz;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalMatrix * n;
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uSoft;
      uniform float uFog;
      uniform vec2 uNear;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        float dist = length(vV);
        float ndv = abs(dot(n, vV / dist));
        float a = pow(ndv, uSoft);
        float f = dist * uFog;
        a *= exp(-f * f) * smoothstep(uNear.x, uNear.y, dist) * uOpacity;
        // A little form: brighter where the surface faces up-left, like the key light.
        float lit = 0.72 + 0.28 * dot(n, normalize(vec3(-0.5, 0.6, 0.6)));
        gl_FragColor = vec4(uColor * lit * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: false,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}
