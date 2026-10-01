// Model lab. Owner: main session. Shows one or more models alone, under the
// site's real lighting. See agents/CONTRACT.md for the query parameters.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createContext } from './scene/context.js';

const registry = {
  helix: () => import('./scene/helix.js'),
  cas9: () => import('./scene/cas9.js'),
  cells: () => import('./scene/cells.js'),
  nucleus: () => import('./scene/nucleus.js'),
  letters: () => import('./scene/letters.js'),
  hemoglobin: () => import('./scene/hemoglobin.js'),
};

const query = new URLSearchParams(location.search);
const num = (key, fallback) => (query.has(key) ? Number(query.get(key)) : fallback);
const vec = (key) => (query.has(key) ? query.get(key).split(',').map(Number) : null);

const canvas = document.getElementById('stage');
const hud = document.getElementById('hud');
const ctx = createContext({ canvas, quality: query.get('quality') ?? 'high' });
const { renderer, scene, camera } = ctx;

if (query.has('fog')) scene.fog.density = num('fog', 0.012);
if (query.get('hud') === '0') document.body.classList.add('hide-hud');

const names = (query.get('model') ?? 'helix').split(',').filter(Boolean);
const models = {};
let firstMeta = null;

for (const name of names) {
  if (!registry[name]) throw new Error(`lab: unknown model "${name}"`);
  const mod = await registry[name]();
  const model = await mod.create(ctx);
  models[name] = model;
  firstMeta ??= mod.meta;
  scene.add(model.group);

  // Params: "helix.unzip=0.5", or bare "unzip=0.5" for the first model.
  for (const [key, raw] of query) {
    const [owner, param] = key.includes('.') ? key.split('.') : [names[0], key];
    if (owner !== name) continue;
    if (param === 'pos') model.group.position.fromArray(raw.split(',').map(Number));
    else if (param === 'rot')
      model.group.rotation.fromArray(raw.split(',').map((d) => THREE.MathUtils.degToRad(Number(d))));
    else if (param === 'scale') model.group.scale.setScalar(Number(raw));
    else if (model.params && param in model.params) model.params[param] = Number(raw);
  }
}

// Camera: explicit cam/look/fov, else a named view from the first model's meta.
const view = firstMeta?.views?.[query.get('view') ?? 'hero'] ?? { pos: [0, 0, 30], look: [0, 0, 0], fov: 35 };
const pos = vec('cam') ?? view.pos;
const look = vec('look') ?? view.look;
camera.fov = num('fov', view.fov ?? 35);
camera.position.fromArray(pos);
camera.lookAt(...look);
camera.updateProjectionMatrix();

const frozen = query.has('time');
let controls = null;
if (!frozen) {
  controls = new OrbitControls(camera, canvas);
  controls.target.fromArray(look);
  controls.enableDamping = true;
}

// Optional post-processing (src/scene/post.js), on with post=1.
let post = null;
if (query.get('post') === '1') {
  const mod = await import('./scene/post.js');
  post = mod.createPost(ctx);
  for (const [key, raw] of query) {
    if (key.startsWith('post.') && key.slice(5) in post.params) post.params[key.slice(5)] = Number(raw);
  }
}

// Anchor markers, on with anchors=1.
const markers = [];
if (query.get('anchors') === '1') {
  for (const model of Object.values(models)) {
    for (const [name, anchor] of Object.entries(model.anchors ?? {})) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x35f0c0, depthTest: false })
      );
      dot.renderOrder = 999;
      scene.add(dot);
      markers.push({ dot, anchor, name });
    }
  }
}

window.addEventListener('resize', () => {
  ctx.resize();
  post?.setSize(ctx.size.width, ctx.size.height);
});

const clock = new THREE.Clock();
const fixedTime = num('time', 0);
const frameTimes = [];
let frames = 0;
let last = performance.now();
const tmp = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = frozen ? 0 : clock.getDelta();
  const time = frozen ? fixedTime : clock.elapsedTime;
  for (const model of Object.values(models)) model.update?.(time, dt);
  for (const { dot, anchor } of markers) {
    if (anchor.isObject3D) anchor.getWorldPosition(tmp);
    else tmp.copy(anchor);
    dot.position.copy(tmp);
  }
  controls?.update();
  if (post) post.render(dt, time);
  else renderer.render(scene, camera);

  const now = performance.now();
  frameTimes.push(now - last);
  last = now;
  frames += 1;
  if (frames === 70) {
    // Skip the first 10 frames (shader compile), average the next 60.
    const sample = frameTimes.slice(10);
    const ms = sample.reduce((a, b) => a + b, 0) / sample.length;
    const info = renderer.info;
    window.__labStats = {
      frameMs: Number(ms.toFixed(2)),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
    };
    hud.textContent = `${names.join(' + ')}   ${ms.toFixed(1)} ms/frame   ${info.render.calls} calls   ${info.render.triangles} tris`;
  }
  if (frames === 4) window.__labReady = true;
});

window.__lab = { ctx, models };
