// Builds the Cas9 glass model from a published crystal structure. Owner: agent 02-cas9.
//
//   node scripts/build-cas9.mjs            (downloads 5F9R once into scripts/.cache/)
//
// Source: PDB 5F9R. Jiang F, Taylor DW, Chen JS, Kornfeld JE, Zhou K, Thompson AJ,
// Nogales E, Doudna JA. Structures of a CRISPR-Cas9 R-loop complex primed for DNA
// cleavage. Science 2016;351(6275):867-871. doi:10.1126/science.aad8282
//
// What it does:
//   1. Parses chain B (S. pyogenes Cas9, residues 3-1364), chain A (sgRNA, 116 nt),
//      chain C (target DNA strand).
//   2. Fits the axis of the 20-bp guide RNA : target DNA heteroduplex and moves the
//      whole structure so that axis is +Y through the origin, in nanometres.
//   3. Splats the protein atoms as Gaussians into two density fields, one per lobe
//      (REC = residues 56-718, NUC = 1-55 + 719-1368, UniProt Q99ZW2), partitions the
//      total density between them with a soft seam, carves the DNA channel, and
//      extracts each lobe's surface with surface nets. Vertices are then projected
//      onto the exact analytic isosurface and normals are the analytic field gradient,
//      so the surface shades as one continuous piece of glass.
//   4. Extracts the sgRNA backbone (phosphorus atoms) as the path of the red thread.
//   5. Writes public/models/cas9.json (+ cas9.hi.bin, cas9.lo.bin).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cacheDir = resolve(import.meta.dirname, '.cache');
const outDir = resolve(root, 'public/models');

// ---------------------------------------------------------------- settings
const PDB_ID = '5F9R';
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : Number.isNaN(Number(v)) ? v : Number(v)];
  })
);
const S = {
  sigma: 0.7, // nm. Gaussian radius of each atom: the "blur".
  isoFrac: 0.22, // iso level as a fraction of the bulk interior density
  channelClear: 1.95, // nm. Nothing survives inside this radius of the axis
  channelSoft: 0.2, // nm. Softness of the channel wall (rounds the rim)
  channelK: 3, // strength of the channel subtraction, in bulk densities
  seamK: 0.3, // each lobe's field has this much of the other lobe's density subtracted
  voxelHi: 0.13, // nm
  voxelLo: 0.21, // nm
  minPiece: 0.04, // drop disconnected pieces smaller than this fraction of a lobe
  spacerRadius: 1.45, // nm. The spacer is moved out to this radius (see guidePath)
  spacerEnd: 22, // last nt taken from the channel end of the sgRNA
  scaffoldStart: 68, // first nt of the scaffold part that is kept
  scaffoldEnd: 116,
  spacerSmooth: 0.7, // low-pass along the chain, in nucleotides
  scaffoldSmooth: 4.5,
  ...args,
};
const REC = [[56, 718]]; // recognition lobe, UniProt Q99ZW2 "Recognition lobe"
const isRec = (seq) => REC.some(([a, b]) => seq >= a && seq <= b);

// ---------------------------------------------------------------- vectors
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const mean = (pts) => mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const round = (v, d = 4) => Number(v.toFixed(d));
const r3 = (p) => p.map((v) => round(v));

// ---------------------------------------------------------------- 1. parse
async function loadPdb() {
  await mkdir(cacheDir, { recursive: true });
  const file = resolve(cacheDir, `${PDB_ID}.pdb`);
  if (!existsSync(file)) {
    const url = `https://files.rcsb.org/download/${PDB_ID}.pdb`;
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    await writeFile(file, await res.text());
  }
  const atoms = [];
  for (const l of (await readFile(file, 'utf8')).split('\n')) {
    const rec = l.slice(0, 6);
    if (rec !== 'ATOM  ' && rec !== 'HETATM') continue;
    const alt = l[16];
    if (alt !== ' ' && alt !== 'A') continue;
    const el = l.slice(76, 78).trim();
    if (el === 'H') continue;
    atoms.push({
      het: rec === 'HETATM',
      name: l.slice(12, 16).trim(),
      res: l.slice(17, 20).trim(),
      chain: l[21],
      seq: Number(l.slice(22, 26)),
      p: [Number(l.slice(30, 38)) / 10, Number(l.slice(38, 46)) / 10, Number(l.slice(46, 54)) / 10], // Å -> nm
    });
  }
  return atoms;
}

// ---------------------------------------------------------------- 2. frame
// Line that minimises the spread of radial distances of the backbone P atoms
// (a cylinder fit), started from the principal axis.
function fitAxis(pts) {
  const c = mean(pts);
  // principal axis by power iteration
  let d = [1, 0.3, 0.2];
  for (let it = 0; it < 200; it++) {
    const n = [0, 0, 0];
    for (const p of pts) {
      const v = sub(p, c);
      const s = dot(v, d);
      n[0] += v[0] * s;
      n[1] += v[1] * s;
      n[2] += v[2] * s;
    }
    d = norm(n);
  }
  const cost = (c0, d0) => {
    const dd = norm(d0);
    const rs = pts.map((p) => {
      const v = sub(p, c0);
      return len(sub(v, mul(dd, dot(v, dd))));
    });
    const m = rs.reduce((a, b) => a + b, 0) / rs.length;
    return rs.reduce((a, r) => a + (r - m) ** 2, 0) / rs.length;
  };
  // coordinate descent on (centre offset perpendicular to d, direction)
  let best = cost(c, d);
  let cc = c;
  let step = 0.2;
  for (let it = 0; it < 400 && step > 1e-5; it++) {
    let improved = false;
    for (let k = 0; k < 6; k++) {
      for (const sgn of [1, -1]) {
        const e = [0, 0, 0];
        e[k % 3] = sgn * step;
        const c2 = k < 3 ? add(cc, e) : cc;
        const d2 = k < 3 ? d : norm(add(d, mul(e, 0.3)));
        const v = cost(c2, d2);
        if (v < best) {
          best = v;
          cc = c2;
          d = d2;
          improved = true;
        }
      }
    }
    if (!improved) step *= 0.5;
  }
  // put the centre at the projection of the P centroid
  cc = add(cc, mul(d, dot(sub(c, cc), d)));
  const radius = pts.map((p) => {
    const v = sub(p, cc);
    return len(sub(v, mul(d, dot(v, d))));
  });
  return { centre: cc, dir: d, rms: Math.sqrt(best), radius: radius.reduce((a, b) => a + b, 0) / radius.length };
}

function buildFrame(atoms) {
  const P = (chain, a, b) => atoms.filter((t) => t.chain === chain && t.name === 'P' && t.seq >= a && t.seq <= b);
  const guideP = P('A', 2, 20); // spacer, nt 1 is the 5' GTP
  const targetP = P('C', 11, 30); // the 20 nt of target strand paired with the spacer
  const fit = fitAxis([...guideP, ...targetP].map((a) => a.p));

  // +Y runs from the PAM-proximal end of the heteroduplex (guide nt 20) to the
  // PAM-distal end (guide nt 1, the free 5' end of the spacer). PAM is at -Y.
  const p20 = guideP.find((a) => a.seq === 20).p;
  const p2 = guideP.find((a) => a.seq === 2).p;
  let y = fit.dir;
  if (dot(sub(p2, p20), y) < 0) y = mul(y, -1);

  // X points from the REC lobe's centre to the NUC lobe's centre (perpendicular to Y).
  const prot = atoms.filter((a) => a.chain === 'B' && !a.het);
  const cRec = mean(prot.filter((a) => isRec(a.seq)).map((a) => a.p));
  const cNuc = mean(prot.filter((a) => !isRec(a.seq)).map((a) => a.p));
  let x = sub(cNuc, cRec);
  x = norm(sub(x, mul(y, dot(x, y))));
  const z = cross(x, y);
  const o = fit.centre;
  const tf = (p) => {
    const v = sub(p, o);
    return [dot(v, x), dot(v, y), dot(v, z)];
  };
  return { fit, tf };
}

// ---------------------------------------------------------------- 3. density
class Field {
  constructor(atoms, sigma) {
    this.sigma = sigma;
    this.k = 1 / (2 * sigma * sigma);
    this.cut = 3.5 * sigma;
    this.cut2 = this.cut * this.cut;
    this.shift = Math.exp(-this.cut2 * this.k);
    this.n = atoms.length;
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.z = new Float32Array(this.n);
    this.lobe = new Uint8Array(this.n); // 0 REC, 1 NUC
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    atoms.forEach((a, i) => {
      this.x[i] = a.p[0];
      this.y[i] = a.p[1];
      this.z[i] = a.p[2];
      this.lobe[i] = isRec(a.seq) ? 0 : 1;
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], a.p[k]);
        hi[k] = Math.max(hi[k], a.p[k]);
      }
    });
    this.lo = lo.map((v) => v - 0.01);
    this.hi = hi.map((v) => v + 0.01);
    lo.splice(0, 3, ...this.lo);
    hi.splice(0, 3, ...this.hi);
    // cell list
    const cs = (this.cs = this.cut);
    this.cn = [0, 1, 2].map((k) => Math.floor((hi[k] - lo[k]) / cs) + 1);
    const cells = (this.cells = Array.from({ length: this.cn[0] * this.cn[1] * this.cn[2] }, () => []));
    for (let i = 0; i < this.n; i++) cells[this.cellIndex(this.x[i], this.y[i], this.z[i])].push(i);
    // bulk interior density of a protein: ~53 heavy atoms per nm^3
    this.bulk = (this.n / 191) * Math.pow(2 * Math.PI * sigma * sigma, 1.5);
    this.out = [0, 0];
    this.g0 = [0, 0, 0];
    this.g1 = [0, 0, 0];
  }
  cellIndex(x, y, z) {
    const i = Math.floor((x - this.lo[0]) / this.cs);
    const j = Math.floor((y - this.lo[1]) / this.cs);
    const k = Math.floor((z - this.lo[2]) / this.cs);
    return (i * this.cn[1] + j) * this.cn[2] + k;
  }
  // Exact densities of both lobes at a point -> this.out
  eval(px, py, pz) {
    let d0 = 0;
    let d1 = 0;
    const { cs, cn, lo, cells, x, y, z, lobe, k, cut2, shift } = this;
    const ci = Math.floor((px - lo[0]) / cs);
    const cj = Math.floor((py - lo[1]) / cs);
    const ck = Math.floor((pz - lo[2]) / cs);
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (i < 0 || i >= cn[0]) continue;
      for (let j = cj - 1; j <= cj + 1; j++) {
        if (j < 0 || j >= cn[1]) continue;
        for (let kk = ck - 1; kk <= ck + 1; kk++) {
          if (kk < 0 || kk >= cn[2]) continue;
          const cell = cells[(i * cn[1] + j) * cn[2] + kk];
          for (let q = 0; q < cell.length; q++) {
            const a = cell[q];
            const dx = x[a] - px;
            const dy = y[a] - py;
            const dz = z[a] - pz;
            const r2 = dx * dx + dy * dy + dz * dz;
            if (r2 >= cut2) continue;
            const g = Math.exp(-r2 * k) - shift;
            if (lobe[a]) d1 += g;
            else d0 += g;
          }
        }
      }
    }
    this.out[0] = d0;
    this.out[1] = d1;
  }
  // Densities and their gradients -> this.out (d0, d1) and this.g0, this.g1
  evalGrad(px, py, pz) {
    let d0 = 0, d1 = 0, ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
    const { cs, cn, lo, cells, x, y, z, lobe, k, cut2, shift } = this;
    const ci = Math.floor((px - lo[0]) / cs);
    const cj = Math.floor((py - lo[1]) / cs);
    const ck = Math.floor((pz - lo[2]) / cs);
    const k2 = 2 * k;
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (i < 0 || i >= cn[0]) continue;
      for (let j = cj - 1; j <= cj + 1; j++) {
        if (j < 0 || j >= cn[1]) continue;
        for (let kk = ck - 1; kk <= ck + 1; kk++) {
          if (kk < 0 || kk >= cn[2]) continue;
          const cell = cells[(i * cn[1] + j) * cn[2] + kk];
          for (let q = 0; q < cell.length; q++) {
            const a = cell[q];
            const dx = x[a] - px;
            const dy = y[a] - py;
            const dz = z[a] - pz;
            const r2 = dx * dx + dy * dy + dz * dz;
            if (r2 >= cut2) continue;
            const e = Math.exp(-r2 * k);
            const ge = e * k2; // d/dp of exp(-k |a-p|^2) = 2k (a-p) e
            if (lobe[a]) { d1 += e - shift; bx += dx * ge; by += dy * ge; bz += dz * ge; }
            else { d0 += e - shift; ax += dx * ge; ay += dy * ge; az += dz * ge; }
          }
        }
      }
    }
    this.out[0] = d0; this.out[1] = d1;
    this.g0[0] = ax; this.g0[1] = ay; this.g0[2] = az;
    this.g1[0] = bx; this.g1[1] = by; this.g1[2] = bz;
  }
}

// The sculpted scalar field for one lobe. Positive inside the glass. Everything is a
// sum of smooth terms, so the isosurface has no creases anywhere:
//   own density - seamK * other lobe's density - channel term - iso
// The channel term is a soft-edged solid cylinder about the Y axis, strong enough that
// even bulk protein density cannot survive inside channelClear.
const logistic = (t) => 1 / (1 + Math.exp(-1.702 * t));
let CH = null; // { R, s, amp }, set once the bulk density is known
function setChannel(bulk, iso) {
  // inside the wall: channelK*bulk*L(t) > bulk - iso  <=>  t > t0
  const need = (bulk - iso) / (S.channelK * bulk);
  const t0 = Math.log(need / (1 - need)) / 1.702;
  CH = { R: S.channelClear - t0 * S.channelSoft, s: S.channelSoft, amp: S.channelK * bulk };
}
function shape(dA, dB, x, z, iso) {
  const rho = Math.hypot(x, z);
  return dA - S.seamK * dB - CH.amp * logistic((CH.R - rho) / CH.s) - iso;
}
function shapeGrad(field, lobe, x, y, z, iso, out) {
  field.evalGrad(x, y, z);
  const dA = field.out[lobe], dB = field.out[1 - lobe];
  const gA = lobe === 0 ? field.g0 : field.g1;
  const gB = lobe === 0 ? field.g1 : field.g0;
  const rho = Math.hypot(x, z) || 1e-9;
  const L = logistic((CH.R - rho) / CH.s);
  const dL = (CH.amp * 1.702 * L * (1 - L)) / CH.s; // -d(channel term)/d(rho)
  out[0] = gA[0] - S.seamK * gB[0] + dL * (x / rho);
  out[1] = gA[1] - S.seamK * gB[1];
  out[2] = gA[2] - S.seamK * gB[2] + dL * (z / rho);
  return dA - S.seamK * dB - CH.amp * L - iso;
}

// ---------------------------------------------------------------- 4. surface nets
function surfaceNets(field, lobe, h, iso) {
  const pad = field.cut + h;
  const lo = field.lo.map((v) => v - pad);
  const n = field.hi.map((v, k) => Math.ceil((v + pad - lo[k]) / h) + 1);
  const [nx, ny, nz] = n;
  const dA = new Float32Array(nx * ny * nz);
  const dB = new Float32Array(nx * ny * nz);
  const gi = (i, j, k) => (i * ny + j) * nz + k;

  // splat every atom (separable Gaussian)
  const r = Math.ceil(field.cut / h);
  const ex = new Float64Array(2 * r + 2);
  const ey = new Float64Array(2 * r + 2);
  const ez = new Float64Array(2 * r + 2);
  for (let a = 0; a < field.n; a++) {
    const grid = field.lobe[a] === lobe ? dA : dB;
    const ax = (field.x[a] - lo[0]) / h;
    const ay = (field.y[a] - lo[1]) / h;
    const az = (field.z[a] - lo[2]) / h;
    const i0 = Math.max(0, Math.ceil(ax - r));
    const i1 = Math.min(nx - 1, Math.floor(ax + r));
    const j0 = Math.max(0, Math.ceil(ay - r));
    const j1 = Math.min(ny - 1, Math.floor(ay + r));
    const k0 = Math.max(0, Math.ceil(az - r));
    const k1 = Math.min(nz - 1, Math.floor(az + r));
    for (let i = i0; i <= i1; i++) ex[i - i0] = (i - ax) * h;
    for (let j = j0; j <= j1; j++) ey[j - j0] = (j - ay) * h;
    for (let k = k0; k <= k1; k++) ez[k - k0] = (k - az) * h;
    for (let i = i0; i <= i1; i++) {
      const dx2 = ex[i - i0] ** 2;
      for (let j = j0; j <= j1; j++) {
        const dxy2 = dx2 + ey[j - j0] ** 2;
        if (dxy2 >= field.cut2) continue;
        let g = gi(i, j, k0);
        for (let k = k0; k <= k1; k++, g++) {
          const r2 = dxy2 + ez[k - k0] ** 2;
          if (r2 < field.cut2) grid[g] += Math.exp(-r2 * field.k) - field.shift;
        }
      }
    }
  }

  const F = new Float32Array(nx * ny * nz);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) {
        const g = gi(i, j, k);
        F[g] = shape(dA[g], dB[g], lo[0] + i * h, lo[2] + k * h, iso);
      }

  // one vertex per cell that the surface crosses
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const corner = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const v = new Float32Array(8);
  for (let i = 0; i < nx - 1; i++)
    for (let j = 0; j < ny - 1; j++)
      for (let k = 0; k < nz - 1; k++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          v[c] = F[gi(i + corner[c][0], j + corner[c][1], k + corner[c][2])];
          if (v[c] > 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of edges) {
          if (v[a] > 0 === v[b] > 0) continue;
          const t = v[a] / (v[a] - v[b]);
          sx += corner[a][0] + t * (corner[b][0] - corner[a][0]);
          sy += corner[a][1] + t * (corner[b][1] - corner[a][1]);
          sz += corner[a][2] + t * (corner[b][2] - corner[a][2]);
          cnt++;
        }
        cellVert[gi(i, j, k)] = pos.length / 3;
        pos.push(lo[0] + (i + sx / cnt) * h, lo[1] + (j + sy / cnt) * h, lo[2] + (k + sz / cnt) * h);
      }

  // one quad per grid edge that the surface crosses
  const quads = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) quads.push(a, d, c, b);
    else quads.push(a, b, c, d);
  };
  for (let i = 1; i < nx - 1; i++)
    for (let j = 1; j < ny - 1; j++)
      for (let k = 1; k < nz - 1; k++) {
        const f0 = F[gi(i, j, k)] > 0;
        if (f0 !== F[gi(i + 1, j, k)] > 0)
          quad(cellVert[gi(i, j - 1, k - 1)], cellVert[gi(i, j, k - 1)], cellVert[gi(i, j, k)], cellVert[gi(i, j - 1, k)], !f0);
        if (f0 !== F[gi(i, j + 1, k)] > 0)
          quad(cellVert[gi(i - 1, j, k - 1)], cellVert[gi(i - 1, j, k)], cellVert[gi(i, j, k)], cellVert[gi(i, j, k - 1)], !f0);
        if (f0 !== F[gi(i, j, k + 1)] > 0)
          quad(cellVert[gi(i - 1, j - 1, k)], cellVert[gi(i, j - 1, k)], cellVert[gi(i, j, k)], cellVert[gi(i - 1, j, k)], !f0);
      }
  return { pos: Float64Array.from(pos), quads: Int32Array.from(quads) };
}

// ---------------------------------------------------------------- 5. mesh clean-up
function dropSmallPieces(mesh) {
  const nv = mesh.pos.length / 3;
  const parent = Int32Array.from({ length: nv }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const q = mesh.quads;
  for (let i = 0; i < q.length; i += 4) for (let e = 1; e < 4; e++) parent[find(q[i])] = find(q[i + e]);
  const count = new Map();
  for (let i = 0; i < nv; i++) count.set(find(i), (count.get(find(i)) ?? 0) + 1);
  const keep = new Set([...count].filter(([, c]) => c >= S.minPiece * nv).map(([r]) => r));
  const remap = new Int32Array(nv).fill(-1);
  const pos = [];
  for (let i = 0; i < nv; i++) {
    if (!keep.has(find(i))) continue;
    remap[i] = pos.length / 3;
    pos.push(mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]);
  }
  const quads = [];
  for (let i = 0; i < q.length; i += 4) {
    if (remap[q[i]] < 0) continue;
    quads.push(remap[q[i]], remap[q[i + 1]], remap[q[i + 2]], remap[q[i + 3]]);
  }
  const pieces = [...count.values()].sort((a, b) => b - a);
  return { pos: Float64Array.from(pos), quads: Int32Array.from(quads), pieces, kept: keep.size };
}

// Project every vertex onto the exact isosurface of the analytic field (Newton steps
// along the gradient), relax tangentially so triangles are even, and take the
// analytic gradient as the normal.
function refine(mesh, field, lobe, iso, h) {
  const nv = mesh.pos.length / 3;
  const p = mesh.pos;
  const nrm = new Float64Array(nv * 3);
  const g = [0, 0, 0];
  const project = (iters) => {
    let worst = 0;
    for (let i = 0; i < nv; i++) {
      let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      let val = shapeGrad(field, lobe, x, y, z, iso, g);
      for (let it = 0; it < iters; it++) {
        const g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
        if (g2 < 1e-9) break;
        let s = -val / g2;
        const move = Math.abs(s) * Math.sqrt(g2);
        if (move > 0.5 * h) s *= (0.5 * h) / move;
        x += g[0] * s;
        y += g[1] * s;
        z += g[2] * s;
        val = shapeGrad(field, lobe, x, y, z, iso, g);
      }
      worst = Math.max(worst, Math.abs(val) / iso);
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      const l = Math.hypot(g[0], g[1], g[2]) || 1;
      // field is positive inside, so the outward normal is minus the gradient
      nrm[i * 3] = -g[0] / l; nrm[i * 3 + 1] = -g[1] / l; nrm[i * 3 + 2] = -g[2] / l;
    }
    return worst;
  };
  // neighbours
  const nb = Array.from({ length: nv }, () => new Set());
  const q = mesh.quads;
  for (let i = 0; i < q.length; i += 4)
    for (let e2 = 0; e2 < 4; e2++) {
      const a = q[i + e2], b = q[i + ((e2 + 1) % 4)];
      nb[a].add(b);
      nb[b].add(a);
    }
  project(3);
  for (let pass = 0; pass < 4; pass++) {
    const next = new Float64Array(p.length);
    for (let i = 0; i < nv; i++) {
      let cx = 0, cy = 0, cz = 0;
      for (const j of nb[i]) { cx += p[j * 3]; cy += p[j * 3 + 1]; cz += p[j * 3 + 2]; }
      const m = nb[i].size || 1;
      let dx = cx / m - p[i * 3], dy = cy / m - p[i * 3 + 1], dz = cz / m - p[i * 3 + 2];
      const dn = dx * nrm[i * 3] + dy * nrm[i * 3 + 1] + dz * nrm[i * 3 + 2];
      dx -= dn * nrm[i * 3]; dy -= dn * nrm[i * 3 + 1]; dz -= dn * nrm[i * 3 + 2];
      next[i * 3] = p[i * 3] + 0.6 * dx; next[i * 3 + 1] = p[i * 3 + 1] + 0.6 * dy; next[i * 3 + 2] = p[i * 3 + 2] + 0.6 * dz;
    }
    p.set(next);
    project(2);
  }
  const worst = project(2);

  // triangulate each quad along its shorter diagonal
  const tris = [];
  const d2 = (a, b) => (p[a * 3] - p[b * 3]) ** 2 + (p[a * 3 + 1] - p[b * 3 + 1]) ** 2 + (p[a * 3 + 2] - p[b * 3 + 2]) ** 2;
  for (let i = 0; i < q.length; i += 4) {
    const [a, b, c, d] = [q[i], q[i + 1], q[i + 2], q[i + 3]];
    if (d2(a, c) <= d2(b, d)) tris.push(a, b, c, a, c, d);
    else tris.push(a, b, d, b, c, d);
  }
  // make the winding agree with the analytic normals (checked on the whole mesh)
  let agree = 0;
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
    const u = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
    const w = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
    const fn = cross(u, w);
    agree += Math.sign(fn[0] * nrm[a * 3] + fn[1] * nrm[a * 3 + 1] + fn[2] * nrm[a * 3 + 2]);
  }
  if (agree < 0) for (let i = 0; i < tris.length; i += 3) [tris[i + 1], tris[i + 2]] = [tris[i + 2], tris[i + 1]];
  return { pos: p, nrm, tris: Uint32Array.from(tris), worst, agree: Math.abs(agree) / (tris.length / 3) };
}

// ---------------------------------------------------------------- 6. packing
// positions: int16 normalised to the model bounds. normals: octahedral, 2 x int16.
function octEncode(x, y, z) {
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  let u = x / s;
  let v = y / s;
  if (z < 0) {
    const ou = u;
    u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1);
    v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1);
  }
  return [Math.round(u * 32767), Math.round(v * 32767)];
}

function pack(lobes, bounds) {
  const chunks = [];
  const info = [];
  let offset = 0;
  const push = (typed) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const padded = Math.ceil(bytes.length / 4) * 4;
    const buf = Buffer.alloc(padded);
    bytes.copy(buf);
    chunks.push(buf);
    const at = offset;
    offset += padded;
    return at;
  };
  for (const m of lobes) {
    const nv = m.pos.length / 3;
    const P = new Int16Array(nv * 3);
    const N = new Int16Array(nv * 2);
    for (let i = 0; i < nv; i++) {
      for (let k = 0; k < 3; k++) {
        const t = (m.pos[i * 3 + k] - bounds.min[k]) / (bounds.max[k] - bounds.min[k]);
        P[i * 3 + k] = Math.round(t * 65535) - 32768;
      }
      const [u, v] = octEncode(m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2]);
      N[i * 2] = u;
      N[i * 2 + 1] = v;
    }
    const wide = nv > 65535;
    const I = wide ? m.tris : Uint16Array.from(m.tris);
    info.push({
      name: m.name,
      vertices: nv,
      triangles: m.tris.length / 3,
      positions: push(P),
      normals: push(N),
      indices: push(I),
      indexType: wide ? 'uint32' : 'uint16',
    });
  }
  return { buffer: Buffer.concat(chunks), info };
}

// ---------------------------------------------------------------- 7. guide path
// The thread is a simplified sgRNA backbone, built from the real phosphate positions:
//   - nt 1-22: the 20-nt spacer and the first two nt of the repeat, as they sit in the
//     heteroduplex, but moved radially out to spacerRadius so the thread lies along the
//     channel wall and the site's glass DNA can pass inside it.
//   - nt 23-67 are left out. This is the repeat:anti-repeat duplex and tetraloop, which
//     in the crystal stacks on the end of the heteroduplex, exactly where the site's
//     straight DNA runs (in the crystal the DNA bends away there). nt 22 and nt 68 are
//     neighbours in space, so the thread carries on round the channel between them.
//   - nt 68-116: stem loop 1, the linker and stem loops 2 and 3, low-pass filtered along
//     the chain so each hairpin becomes one soft curve, and kept outside the DNA's path.
function guidePath(atoms) {
  const rna = atoms.filter((a) => a.chain === 'A');
  const P = new Map();
  // nt 1 is the 5' GTP (HETATM); its C4' stands in for the missing 5' phosphate
  const first = rna.find((a) => a.seq === 1 && a.res === 'GTP' && a.name === "C4'");
  if (first) P.set(1, first.p);
  for (const a of rna) if (!a.het && a.name === 'P') P.set(a.seq, a.p);

  const cyl = (p) => ({ rho: Math.hypot(p[0], p[2]), az: Math.atan2(p[2], p[0]), y: p[1] });
  const pts = [];
  // channel part, in cylindrical coordinates with the azimuth unwrapped
  let prevAz = null;
  const pushCyl = (c, seq) => {
    let az = c.az;
    if (prevAz !== null) while (az - prevAz > Math.PI) az -= 2 * Math.PI;
    if (prevAz !== null) while (az - prevAz < -Math.PI) az += 2 * Math.PI;
    prevAz = az;
    pts.push({ seq, cyl: { rho: c.rho, az, y: c.y } });
  };
  for (let n = 1; n <= S.spacerEnd; n++) pushCyl(cyl(P.get(n)), n);
  // bridge round the channel to where the scaffold resumes
  const from = pts[pts.length - 1].cyl;
  const toP = cyl(P.get(S.scaffoldStart));
  const sense = Math.sign(pts[pts.length - 1].cyl.az - pts[pts.length - 4].cyl.az); // keep winding the same way
  let toAz = toP.az;
  while ((toAz - from.az) * sense < 0.3) toAz += sense * 2 * Math.PI;
  const steps = Math.max(1, Math.round(Math.abs(toAz - from.az) / 0.55));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    pts.push({ seq: 0, cyl: { rho: from.rho + (toP.rho - from.rho) * t, az: from.az + (toAz - from.az) * t, y: from.y + (toP.y - from.y) * t } });
  }
  for (const q of pts) {
    const rho = S.spacerRadius;
    q.p = [rho * Math.cos(q.cyl.az), q.cyl.y, rho * Math.sin(q.cyl.az)];
  }
  const nChannel = pts.length;
  for (let n = S.scaffoldStart; n <= S.scaffoldEnd; n++) if (P.has(n)) pts.push({ seq: n, p: P.get(n) });

  // low-pass along the chain: light in the channel, heavy on the scaffold
  const sigmaAt = (i) => {
    const t = smoothstep(nChannel - 3, nChannel + 5, i);
    return S.spacerSmooth + (S.scaffoldSmooth - S.spacerSmooth) * t;
  };
  const sm = pts.map((_, i) => {
    const sg = sigmaAt(i);
    const acc = [0, 0, 0];
    let w = 0;
    const reach = Math.ceil(3 * sg);
    for (let j = i - reach; j <= i + reach; j++) {
      // reflect at the ends so the path keeps its end points
      const jj = j < 0 ? -j : j >= pts.length ? 2 * (pts.length - 1) - j : j;
      if (jj < 0 || jj >= pts.length) continue;
      const g = Math.exp((-(j - i) * (j - i)) / (2 * sg * sg));
      const q = j < 0 || j >= pts.length ? sub(mul(pts[i < pts.length / 2 ? 0 : pts.length - 1].p, 2), pts[jj].p) : pts[jj].p;
      acc[0] += q[0] * g; acc[1] += q[1] * g; acc[2] += q[2] * g;
      w += g;
    }
    return mul(acc, 1 / w);
  });
  // keep everything out of the DNA's path: soft radial floor at spacerRadius
  const out = sm.map((p) => {
    const rho = Math.hypot(p[0], p[2]) || 1e-6;
    const k = 0.25;
    const r2 = 0.5 * (rho + S.spacerRadius + Math.sqrt((rho - S.spacerRadius) ** 2 + k * k));
    return [(p[0] / rho) * r2, p[1], (p[2] / rho) * r2];
  });
  return { points: out, channelPoints: nChannel };
}

// ---------------------------------------------------------------- main
const t0 = performance.now();
const raw = await loadPdb();
const { fit, tf } = buildFrame(raw);
const atoms = raw.map((a) => ({ ...a, p: tf(a.p) }));
const protein = atoms.filter((a) => a.chain === 'B' && !a.het);
console.log(`heteroduplex axis: P radius ${fit.radius.toFixed(3)} nm, rms ${fit.rms.toFixed(3)} nm`);
console.log(`protein atoms: ${protein.length} (REC ${protein.filter((a) => isRec(a.seq)).length})`);

const field = new Field(protein, S.sigma);
const iso = S.isoFrac * field.bulk;
setChannel(field.bulk, iso);

const centroid = (sel) => mean(protein.filter(sel).map((a) => a.p));
const sideChain = (seq) => (a) => a.seq === seq && !['N', 'C', 'O', 'CA'].includes(a.name);
const sites = {
  // His840: the HNH general base (UniProt Q99ZW2 active site 840)
  hnh: centroid(sideChain(840)),
  // Asp10, Glu762, His983, Asp986: the RuvC catalytic centre (Asp10 is UniProt active site 10)
  ruvc: mean([10, 762, 983, 986].map((s) => centroid(sideChain(s)))),
  recLobe: centroid((a) => isRec(a.seq)),
  nucLobe: centroid((a) => !isRec(a.seq)),
};
// scissile phosphates, for reference: target strand between 3rd and 4th nt from the PAM
for (const [k, p] of Object.entries(sites))
  console.log(`${k.padEnd(8)} ${r3(p).join(', ')}   r=${Math.hypot(p[0], p[2]).toFixed(2)}`);

if (args.guideOnly) {
  const file = resolve(outDir, 'cas9.json');
  const prev = JSON.parse(await readFile(file, 'utf8'));
  const gp = guidePath(atoms);
  prev.guide = gp.points.map(r3);
  prev.guideChannelPoints = gp.channelPoints;
  await writeFile(file, JSON.stringify(prev));
  console.log(`guide only: ${gp.points.length} points (${gp.channelPoints} in the channel)`);
  process.exit(0);
}

const built = {};
for (const [lod, h] of [['hi', S.voxelHi], ['lo', S.voxelLo]]) {
  const lobes = [];
  for (const [lobe, name] of [[0, 'rec'], [1, 'nuc']]) {
    let mesh = surfaceNets(field, lobe, h, iso);
    mesh = dropSmallPieces(mesh);
    const done = refine(mesh, field, lobe, iso, h);
    console.log(
      `${lod} ${name}: ${done.pos.length / 3} verts, ${done.tris.length / 3} tris, pieces ${mesh.pieces.slice(0, 6).join('/')} (kept ${mesh.kept}), ` +
        `residual ${done.worst.toExponential(1)}, winding agreement ${(done.agree * 100).toFixed(1)}%`
    );
    lobes.push({ name, ...done });
  }
  built[lod] = lobes;
}

// bounds over both LODs
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (const lobes of Object.values(built))
  for (const m of lobes)
    for (let i = 0; i < m.pos.length; i++) {
      bounds.min[i % 3] = Math.min(bounds.min[i % 3], m.pos[i]);
      bounds.max[i % 3] = Math.max(bounds.max[i % 3], m.pos[i]);
    }
bounds.min = bounds.min.map((v) => round(v - 0.01, 3));
bounds.max = bounds.max.map((v) => round(v + 0.01, 3));

// lobe centres from the mesh (vertex mean), nicer hinge reference than atom centroids
const meshCentre = (m) => {
  const c = [0, 0, 0];
  for (let i = 0; i < m.pos.length; i++) c[i % 3] += m.pos[i];
  return mul(c, 3 / m.pos.length);
};

// seam: where the two lobes meet (density of both is high). Used to place the hinge.
const seam = [];
{
  const h = 0.3;
  for (let x = field.lo[0]; x < field.hi[0]; x += h)
    for (let y = field.lo[1]; y < field.hi[1]; y += h)
      for (let z = field.lo[2]; z < field.hi[2]; z += h) {
        field.eval(x, y, z);
        const [a, b] = field.out;
        if (a + b > iso * 1.2 && Math.abs(a - b) / (a + b) < 0.25 && Math.hypot(x, z) > S.channelClear + 0.5) seam.push([x, y, z]);
      }
}
const seamBins = new Array(12).fill(0);
for (const p of seam) seamBins[Math.floor(((Math.atan2(p[2], p[0]) + Math.PI) / (2 * Math.PI)) * 12) % 12]++;
console.log(`seam samples ${seam.length}; by azimuth (30 deg bins from -180): ${seamBins.join(' ')}`);
console.log(`seam centroid ${r3(mean(seam)).join(', ')}`);

const gp = guidePath(atoms);
console.log(`guide path: ${gp.points.length} points (${gp.channelPoints} in the channel)`);

await mkdir(outDir, { recursive: true });
const files = {};
for (const [lod, lobes] of Object.entries(built)) {
  const { buffer, info } = pack(lobes, bounds);
  await writeFile(resolve(outDir, `cas9.${lod}.bin`), buffer);
  files[lod] = { file: `cas9.${lod}.bin`, bytes: buffer.length, lobes: info };
  console.log(`cas9.${lod}.bin ${(buffer.length / 1024).toFixed(0)} kB`);
}

const json = {
  source: {
    pdb: PDB_ID,
    title: 'Crystal structure of catalytically-active Streptococcus pyogenes CRISPR-Cas9 in complex with single-guided RNA and double-stranded DNA primed for target DNA cleavage',
    citation: 'Jiang F, Taylor DW, Chen JS, Kornfeld JE, Zhou K, Thompson AJ, Nogales E, Doudna JA. Structures of a CRISPR-Cas9 R-loop complex primed for DNA cleavage. Science. 2016;351(6275):867-871. doi:10.1126/science.aad8282',
    protein: 'chain B, residues 3-1364 (all heavy atoms)',
    recLobe: 'chain B residues 56-718',
    nucLobe: 'chain B residues 3-55 and 719-1364',
    guide: `chain A (sgRNA) backbone: C4' of the 5' GTP (nt 1) and P atoms of nt 2-${S.spacerEnd} and ${S.scaffoldStart}-${S.scaffoldEnd}; nt ${S.spacerEnd + 1}-${S.scaffoldStart - 1} (repeat:anti-repeat duplex) omitted; spacer moved out to ${S.spacerRadius} nm from the axis; scaffold low-pass filtered`,
    axis: 'cylinder fit to P atoms of chain A nt 2-20 and chain C nt 11-30 (the guide:target heteroduplex)',
  },
  units: 'nanometres; heteroduplex axis is +Y through the origin; PAM-proximal end at -Y',
  settings: S,
  bounds,
  files,
  lobeCentres: { rec: r3(meshCentre(built.hi[0])), nuc: r3(meshCentre(built.hi[1])) },
  sites: Object.fromEntries(Object.entries(sites).map(([k, p]) => [k, r3(p)])),
  hinge: { point: S.hinge ? String(S.hinge).split(',').map(Number) : [round(mean(seam)[0]), 0, round(mean(seam)[2])], axis: [0, 1, 0] },
  guide: gp.points.map(r3),
  guideChannelPoints: gp.channelPoints,
};
await writeFile(resolve(outDir, 'cas9.json'), JSON.stringify(json));
console.log(`bounds ${bounds.min.join(', ')}  ..  ${bounds.max.join(', ')}`);
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
