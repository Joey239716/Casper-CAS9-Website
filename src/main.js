// Site entry. Owner: main session.
// Builds the stage, turns scroll position into per-scene progress, and each
// frame asks the choreography (scroll/timeline.js) to pose everything.
import * as THREE from 'three';
import Lenis from 'lenis';
import gsap from 'gsap';
import { createContext, detectQuality } from './scene/context.js';
import * as helixModule from './scene/helix.js';
import * as cas9Module from './scene/cas9.js';
import * as cellsModule from './scene/cells.js';
import * as nucleusModule from './scene/nucleus.js';
import * as lettersModule from './scene/letters.js';
import * as haloModule from './scene/halo.js';
import { createWeave } from './scene/weave.js';
import { createPost } from './scene/post.js';
import { scenes, formatScale, formatCount } from './content/scenes.js';
import { createAnnotations } from './scroll/annotations.js';
import { createProgress } from './scroll/progress.js';
import { choreograph, readLayout, anchorWorld, annotationAlpha } from './scroll/timeline.js';
import { clamp01, createPose, copyPose, dampPose, applyPose, attachToCamera } from './scroll/cameraPath.js';

const query = new URLSearchParams(location.search);
const root = document.documentElement;

function hasWebGL() {
  if (query.get('nowebgl') === '1') return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

const reduced = query.get('reduced') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl = hasWebGL();
const quality = detectQuality();
const shotMode = query.has('progress'); // screenshots: no smoothing, no beat tween
root.classList.add(webgl ? 'webgl' : 'no-webgl');
root.classList.toggle('reduced-motion', reduced);
root.classList.toggle('quality-low', quality === 'low');

// ---- Page side ---------------------------------------------------------------
const order = scenes.map((s) => s.id);
const sections = scenes
  .map((s) => ({ id: s.id, el: document.querySelector(`[data-scene="${s.id}"]`), top: 0, height: 1 }))
  .filter((s) => s.el);
const readouts = {
  scale: document.querySelector('[data-readout="scale"]'),
  count: document.querySelector('[data-readout="count"]'),
};
const progressEl = document.querySelector('[data-progress]');
const progress = progressEl ? createProgress(progressEl) : null;
const annotationRoot = document.querySelector('[data-annotations]');
const defs = scenes.flatMap((s) => (s.annotations ?? []).map((a) => ({ ...a, scene: s.id })));
const annotations = annotationRoot ? createAnnotations({ root: annotationRoot, defs }) : null;

function measure() {
  const y = window.scrollY;
  for (const s of sections) {
    const r = s.el.getBoundingClientRect();
    s.top = r.top + y;
    s.height = Math.max(1, r.height);
  }
}

// A scene runs from its top reaching the top of the viewport until the next
// scene's top does, so the scenes tile the scroll with no gaps.
const sp = Object.fromEntries(order.map((id) => [id, 0]));
// In reduced motion each scene is shown as one still, at this point in it.
const stillAt = { title: 0.05, problem: 0.45, spare: 0.3, library: 0.5, reader: 0.75, search: 0.52, match: 0.8, cut: 0.6, repair: 0.85, payoff: 0.8, practice: 0.5, beyond: 0.8, references: 0.3 };

function readProgress() {
  const y = window.scrollY;
  for (const s of sections) {
    let p = clamp01((y - s.top) / s.height);
    if (reduced && p > 0 && p < 1) p = stillAt[s.id] ?? 0.5;
    sp[s.id] = p;
  }
  const max = root.scrollHeight - window.innerHeight;
  return max > 0 ? clamp01(y / max) : 0;
}

function updateReadouts() {
  // 6 micrometres down to 2 nanometres, on a log scale, over the dive.
  if (readouts.scale) readouts.scale.textContent = formatScale(6e-6 * Math.pow(2e-9 / 6e-6, clamp01(sp.spare / 0.86)));
  if (readouts.count) readouts.count.textContent = formatCount(3.055e9 * sp.library);
}

let lenis = null;
if (!reduced && !shotMode) lenis = new Lenis({ lerp: 0.1 });

// ---- No WebGL: the page is an article; just keep the readouts and progress ----
if (!webgl) {
  measure();
  window.addEventListener('resize', measure);
  const tick = (t) => {
    lenis?.raf(t);
    progress?.set(readProgress());
    updateReadouts();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__pageReady = true;
} else {
  start();
}

async function start() {
  const canvas = document.getElementById('stage');
  const ctx = createContext({ canvas, quality });
  const { renderer, scene, camera } = ctx;

  const [helix, cas9, cells, nucleus, letters, halo] = await Promise.all([
    helixModule.create(ctx),
    cas9Module.create(ctx),
    cellsModule.create(ctx),
    nucleusModule.create(ctx),
    lettersModule.create(ctx),
    haloModule.create(ctx),
  ]);
  const models = { helix, cas9, cells, nucleus, letters, halo };
  for (const m of Object.values(models)) scene.add(m.group);
  // The dive is locked to the camera; its distant haze stays in the world.
  const post = createPost(ctx);
  // The near strands of the helix, redrawn above the title text (desktop only).
  const weave = await createWeave({
    helixModule,
    quality,
    after: document.getElementById('main'),
    keyLight: ctx.keyLight,
    clipTo: document.getElementById('line-title'),
    scrim: document.querySelector('.scrim'),
  });

  const stage = {
    models,
    post,
    order,
    pose: createPose(),
    cutBeat: 0,
    narrow: false,
    reduced,
    active: order[0],
    layout: null,
  };
  helix.update(0, 0); // places the anchors
  stage.layout = readLayout(stage);

  const cellsView = cellsModule.meta.views.hero;
  const current = createPose();
  let first = true;

  function resize() {
    ctx.resize();
    const { width, height } = ctx.size;
    stage.narrow = width < 760 || width < height;
    // Compose off-centre: the subject sits right of the copy column on wide
    // screens, and above the copy on narrow ones.
    applyFraming();
    post.setSize?.(width, height);
    weave.resize();
    measure();
  }
  // Framing: the subject sits on the side opposite the text, gliding across
  // when a scene on the other side takes over.
  let frameSide = -1; // -1: subject right of centre (text left). +1: subject left.
  let frameTarget = -1;
  function applyFraming() {
    const { width, height } = ctx.size;
    if (stage.narrow) camera.setViewOffset(width, height, 0, height * 0.14, width, height);
    else camera.setViewOffset(width, height, width * 0.16 * frameSide, 0, width, height);
  }
  const sideOf = Object.fromEntries(sections.map((s) => [s.id, s.el.dataset.side === 'right' ? 1 : -1]));
  let shownId = null;
  function updateSides(dt) {
    // The scene whose text is on screen: the last one whose top has passed the middle of the viewport.
    const mid = window.scrollY + window.innerHeight * 0.5;
    let current = sections[0];
    for (const s of sections) if (s.top <= mid) current = s;
    if (current.id !== shownId) {
      for (const s of sections) s.el.classList.toggle('is-in', s === current);
      shownId = current.id;
      frameTarget = sideOf[current.id] ?? -1;
      root.classList.toggle('copy-right', frameTarget === 1);
    }
    const next = shotMode || reduced ? frameTarget : frameSide + (frameTarget - frameSide) * (1 - Math.exp(-dt * 2.6));
    if (Math.abs(next - frameSide) > 1e-4 || first) {
      frameSide = next;
      applyFraming();
    }
  }
  window.addEventListener('resize', resize);
  new ResizeObserver(measure).observe(document.body);
  resize();

  // Pointer: a small shift of the camera and the key light.
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    });
  }
  const lightHome = ctx.keyLight.position.clone();

  // The cut: one automatic beat when its threshold is crossed, undone on the way back.
  let cutWanted = 0;
  function driveCut() {
    const want = sp.cut > 0.14 || sp.repair > 0 ? 1 : 0;
    if (shotMode || reduced) {
      // ?cutbeat=0.2 freezes the beat at that point, for screenshots.
      stage.cutBeat = query.has('cutbeat') && want ? Number(query.get('cutbeat')) : want;
      return;
    }
    if (want === cutWanted) return;
    cutWanted = want;
    gsap.to(stage, {
      cutBeat: want,
      duration: want ? 1.6 : 0.45,
      ease: want ? 'power2.out' : 'power1.inOut',
      overwrite: true,
    });
  }

  const clock = new THREE.Clock();
  const world = new THREE.Vector3();
  const side = new THREE.Vector3();
  const upv = new THREE.Vector3();
  const frameTimes = [];
  let frames = 0;
  let last = performance.now();

  function frame(now) {
    lenis?.raf(now);
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = reduced ? 0 : clock.elapsedTime;

    const page = readProgress();
    progress?.set(page);
    updateReadouts();
    driveCut();

    updateSides(dt);
    const target = choreograph(stage, sp, time);
    if (first || shotMode || reduced) copyPose(current, target);
    else dampPose(current, target, dt, 6);
    first = false;
    applyPose(camera, current);

    // Pointer parallax: slide the camera sideways, proportional to subject distance.
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 4));
    const reachOut = Math.min(current.pos.distanceTo(current.look), 60);
    side.setFromMatrixColumn(camera.matrixWorld, 0);
    upv.setFromMatrixColumn(camera.matrixWorld, 1);
    camera.position.addScaledVector(side, pointerSmooth.x * reachOut * 0.035);
    camera.position.addScaledVector(upv, -pointerSmooth.y * reachOut * 0.025);
    camera.updateMatrixWorld();
    ctx.keyLight.position.set(lightHome.x + pointerSmooth.x * 6, lightHome.y - pointerSmooth.y * 4, lightHome.z);

    // Camera-locked sets: the cell field and the dive.
    if (cells.group.visible) attachToCamera(cells.group, camera, cellsView);
    // A slight turn of the head with the pointer, so camera-locked fields also shift.
    camera.rotateY(-pointerSmooth.x * 0.02);
    camera.rotateX(-pointerSmooth.y * 0.014);
    camera.updateMatrixWorld();

    for (const m of Object.values(models)) m.update?.(time, dt);
    post.render(dt, time);
    weave.render(camera, helix, current.look, time, stage.active === 'title' && !stage.narrow);

    // Annotations: project each anchor to the screen.
    if (annotations) {
      for (const def of defs) {
        const [owner, name] = def.anchor.split('.');
        const model = models[owner];
        let alpha = model?.group.visible ? annotationAlpha(def, sp, stage) : 0;
        let x = 0;
        let y = 0;
        if (alpha > 0 && anchorWorld(model, name, world)) {
          world.project(camera);
          if (world.z > 1 || Math.abs(world.x) > 1.2 || Math.abs(world.y) > 1.2) alpha = 0;
          x = (world.x * 0.5 + 0.5) * ctx.size.width;
          y = (-world.y * 0.5 + 0.5) * ctx.size.height;
        } else alpha = 0;
        annotations.set(def.id, { x, y, alpha });
      }
    }

    const t = performance.now();
    frameTimes.push(t - last);
    last = t;
    frames += 1;
    if (frames === 110) {
      const sample = frameTimes.slice(60);
      window.__pageStats = {
        frameMs: Number((sample.reduce((a, b) => a + b, 0) / sample.length).toFixed(2)),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        scene: stage.active,
      };
      window.__pageReady = true;
    }
    requestAnimationFrame(frame);
  }

  await document.fonts?.ready;
  measure();
  if (shotMode) {
    const max = root.scrollHeight - window.innerHeight;
    const p = Number(query.get('progress'));
    // "progress=match:0.5" jumps to a point within a named scene.
    const raw = query.get('progress');
    if (raw.includes(':')) {
      const [id, f] = raw.split(':');
      const s = sections.find((x) => x.id === id);
      if (s) window.scrollTo(0, s.top + s.height * clamp01(Number(f)));
    } else window.scrollTo(0, max * clamp01(p));
  }
  window.__stage = stage;
  requestAnimationFrame(frame);
}
