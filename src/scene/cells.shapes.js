// Private helper of cells.js. Owner: agent 03-cells.
// The two cell shapes, as parametric surfaces with finite-difference normals.
import * as THREE from 'three';

// Builds a closed tube-like surface from fn(u, v, target), u along (0..1, pinched
// to a point at both ends), v around (0..1, wraps).
function parametric(fn, nu, nv, uOf = (u) => u) {
  const cols = nv + 1;
  const position = new Float32Array((nu + 1) * cols * 3);
  const normal = new Float32Array((nu + 1) * cols * 3);
  const p = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const du = new THREE.Vector3();
  const dv = new THREE.Vector3();
  const EU = 1e-4;
  const EV = 1e-4;

  for (let i = 0; i <= nu; i++) {
    const u = uOf(i / nu);
    // Evaluate normals a hair inside the poles, where the surface degenerates.
    const un = Math.min(1 - 4e-3, Math.max(4e-3, u));
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      fn(u, v, p);
      fn(un + EU, v, a);
      fn(un - EU, v, b);
      du.subVectors(a, b);
      fn(un, v + EV, a);
      fn(un, v - EV, b);
      dv.subVectors(a, b);
      a.crossVectors(dv, du).normalize();
      const o = (i * cols + j) * 3;
      position[o] = p.x;
      position[o + 1] = p.y;
      position[o + 2] = p.z;
      normal[o] = a.x;
      normal[o + 1] = a.y;
      normal[o + 2] = a.z;
    }
  }

  const index = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const p0 = i * cols + j;
      const p1 = p0 + 1;
      const p2 = p0 + cols;
      const p3 = p2 + 1;
      if (i > 0) index.push(p0, p1, p2);
      if (i < nu - 1) index.push(p1, p3, p2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// Biconcave disc, Evans & Fung (1972) profile:
//   thickness(r) = sqrt(1 - (r/R0)^2) * (C0 + C1 (r/R0)^2 + C2 (r/R0)^4)
// R0 = 3.91 um, C0 = 0.81, C1 = 7.83, C2 = -4.39. The disc lies in the XZ plane,
// thickness along Y. Diameter 7.82, 0.81 thick at the dimple, ~2.5 at the rim.
export const RBC = { R0: 3.91, C0: 0.81, C1: 7.83, C2: -4.39 };

export function buildRoundCell(around = 44, across = 30) {
  const { R0, C0, C1, C2 } = RBC;
  const geo = parametric(
    (u, v, out) => {
      // u sweeps the profile from the top pole, over the rim, to the bottom pole.
      // r = R0 sin(theta) makes sqrt(1 - (r/R0)^2) = cos(theta): smooth through the rim.
      const theta = u * Math.PI;
      const x = Math.sin(theta);
      const x2 = x * x;
      const h = 0.5 * Math.cos(theta) * (C0 + C1 * x2 + C2 * x2 * x2);
      const r = R0 * x;
      const phi = v * Math.PI * 2;
      return out.set(r * Math.cos(phi), h, r * Math.sin(phi));
    },
    across,
    around
  );
  // Vertex colour = soft ambient occlusion: the dimple sees less of the room.
  // Only materials with vertexColors on (the red cells) read it.
  const pos = geo.attributes.position;
  const ao = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i)) / R0;
    const t = Math.min(1, r / 0.78);
    const a = 0.62 + 0.38 * t * t * (3 - 2 * t);
    ao[i * 3] = ao[i * 3 + 1] = ao[i * 3 + 2] = a;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(ao, 3));
  return geo;
}

// Sickled cell: a flattened crescent (lune) drawn out to two points, with a
// slight twist. Lies in the XY plane, tips towards -Y, flat along Z.
export function buildSickleCell(along = 44, around = 22) {
  const ARC = 2.25; // radians subtended by the spine
  const RS = 5.9; // spine radius -> ~13 um along the arc, ~11 um tip to tip
  const W = 1.7; // half-width at the belly (in the crescent's plane)
  const T = 0.8; // half-thickness at the belly
  const TWIST = 0.36; // radians of roll from centre to tip
  const yMid = (1 + Math.cos(ARC / 2)) / 2;

  const geo = parametric(
    (u, v, out) => {
      const t = u * 2 - 1; // -1..1 along the spine
      const a = t * (ARC / 2) * (1 + 0.1 * t); // slightly more hooked at one end
      const k = Math.max(0, 1 - t * t);
      // Lune taper: straight run-in to a point (exponent ~1), belly shifted off-centre.
      const w = W * Math.pow(k, 0.92) * (1 + 0.22 * t);
      const th = T * Math.pow(k, 0.62) * (1 + 0.1 * t);
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      // Spine, with a gentle out-of-plane S.
      const sx = RS * sa;
      const sy = RS * (ca - yMid);
      const sz = 0.55 * t * Math.abs(t);
      // Cross-section: an ellipse with slightly pinched edges (reads as a rigid blade).
      const phi = v * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const ex = w * c;
      const ez = th * s * (0.72 + 0.28 * s * s);
      const roll = TWIST * t;
      const cr = Math.cos(roll);
      const sr = Math.sin(roll);
      const e1 = ex * cr - ez * sr; // along the in-plane normal (sa, ca, 0)
      const e2 = ex * sr + ez * cr; // along Z
      return out.set(sx + sa * e1, sy + ca * e1, sz + e2);
    },
    along,
    around,
    // Bunch rows towards the tips so the points stay crisp.
    (u) => 0.5 - 0.5 * Math.cos(u * Math.PI) * (0.55 + 0.45 * Math.abs(Math.cos(u * Math.PI)))
  );
  const white = new Float32Array(geo.attributes.position.count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(white, 3));
  return geo;
}
