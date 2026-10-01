// Shared render context. Owner: main session. Used by both the site (main.js)
// and the model lab (lab.js) so models are always seen under the real lighting.
import * as THREE from 'three';
import { tokens } from './tokens.js';
import { createMaterials } from './materials.js';
import { createEnvironment, createBackdrop } from './environment.js';

export function detectQuality() {
  const q = new URLSearchParams(location.search).get('quality');
  if (q === 'high' || q === 'low') return q;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return small || coarse ? 'low' : 'high';
}

// overlay: a transparent context with the same lighting and no backdrop, for
// drawing a model a second time above the page text.
export function createContext({ canvas, quality = detectQuality(), overlay = false }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: overlay,
    powerPreference: 'high-performance',
  });
  if (overlay) renderer.setClearColor(0x000000, 0);
  // Clear glass is costly per pixel, so stop short of full retina resolution.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.5 : 1.25));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Glass refracts a half-resolution copy of the scene; the difference is not visible, the cost is.
  renderer.transmissionResolutionScale = 0.5;

  const scene = new THREE.Scene();
  if (!overlay) scene.background = new THREE.Color(tokens.darkfield);
  scene.environment = createEnvironment(renderer);
  scene.fog = new THREE.FogExp2(tokens.darkfield, 0.012);
  if (!overlay) scene.add(createBackdrop());

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
  camera.position.set(0, 0, 30);

  // One real light for crisp highlights on opaque frost; the pointer nudges it.
  const keyLight = new THREE.DirectionalLight(0xf2f6ff, 1.6);
  keyLight.position.set(-8, 6, 10);
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0x9fb6d6, 0x04060b, 0.35));

  const materials = createMaterials(quality);

  const ctx = {
    renderer,
    scene,
    camera,
    keyLight,
    materials,
    tokens,
    quality,
    size: { width: 1, height: 1 },
    resize() {
      const parent = canvas.parentElement ?? document.body;
      const width = parent.clientWidth || window.innerWidth;
      const height = parent.clientHeight || window.innerHeight;
      ctx.size.width = width;
      ctx.size.height = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
  };
  ctx.resize();
  return ctx;
}
