// Frozen stand-in helix used by src/main.js during Phase 1 so the page keeps
// rendering while the real models are being built. Owner: main session.
import * as THREE from 'three';

export const meta = {
  name: 'helix',
  params: {
    spin: { value: 0, doc: 'Rotation about the helix axis, in turns.' },
  },
  views: {
    hero: { pos: [9, 2, 26], look: [0, 0, 0], fov: 35 },
    close: { pos: [3, 1, 9], look: [0, 0, 0], fov: 35 },
  },
};

const BP = 60;
const RISE = 0.34;
const RADIUS = 1.0;
const PER_TURN = 10.5;
const GROOVE = THREE.MathUtils.degToRad(140); // angular offset between strands

class Strand extends THREE.Curve {
  constructor(phase) {
    super();
    this.phase = phase;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const i = t * BP;
    const a = (i / PER_TURN) * Math.PI * 2 + this.phase;
    return target.set(Math.cos(a) * RADIUS, (i - BP / 2) * RISE, Math.sin(a) * RADIUS);
  }
}

export function create(ctx) {
  const group = new THREE.Group();
  const spinner = new THREE.Group();
  group.add(spinner);

  for (const phase of [0, GROOVE]) {
    spinner.add(
      new THREE.Mesh(new THREE.TubeGeometry(new Strand(phase), BP * 8, 0.17, 20), ctx.materials.glass)
    );
  }

  const rungGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 10);
  const rungs = new THREE.InstancedMesh(rungGeo, ctx.materials.frost, BP);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const s0 = new Strand(0);
  const s1 = new Strand(GROOVE);
  for (let i = 0; i < BP; i++) {
    s0.getPoint((i + 0.5) / BP, a);
    s1.getPoint((i + 0.5) / BP, b);
    const dir = b.clone().sub(a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
    rungs.setMatrixAt(i, m);
  }
  spinner.add(rungs);

  const params = { spin: 0 };
  return {
    group,
    params,
    anchors: { centre: new THREE.Vector3() },
    update(time) {
      spinner.rotation.y = params.spin * Math.PI * 2 + time * 0.05;
    },
    dispose() {
      rungGeo.dispose();
    },
  };
}
