// The title weave. Owner: main session.
// The stage canvas sits behind the page text, so on its own the helix can only
// pass behind the title. This draws the helix a second time on a transparent
// canvas above the text, clipped to the half nearer the camera than the helix
// axis: the near strands cross in front of the letters, the far ones behind.
import * as THREE from 'three';
import { createContext } from './context.js';

// The page's copy scrim (main.css, .scrim) darkens the stage canvas but not this
// one, so the same darkening is multiplied in here. Stops are the scrim's alpha;
// uFlip is the scrim's live scaleX (1 copy left, -1 mirrored for copy right).
const SCRIM = /* glsl */ `
  uniform float uFlip;
  varying vec2 vUv;
  float scrim(float x) {
    if (x < 0.22) return mix(0.9, 0.74, x / 0.22);
    if (x < 0.40) return mix(0.74, 0.40, (x - 0.22) / 0.18);
    if (x < 0.58) return mix(0.40, 0.0, (x - 0.40) / 0.18);
    return 0.0;
  }
  void main() {
    float u = 0.5 + (vUv.x - 0.5) / (abs(uFlip) < 1e-3 ? 1e-3 : uFlip);
    float a = u < 0.0 || u > 1.0 ? 0.0 : scrim(u);
    gl_FragColor = vec4(vec3(1.0 - a), 1.0);
  }
`;

export async function createWeave({ helixModule, quality, after, keyLight, clipTo, scrim }) {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:3;pointer-events:none;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  wrap.appendChild(canvas);
  after.after(wrap);

  const ctx = createContext({ canvas, quality, overlay: true });
  const { renderer, scene } = ctx;
  const plane = new THREE.Plane();
  renderer.clippingPlanes = [plane];
  renderer.autoClear = false;

  const helix = await helixModule.create(ctx);
  scene.add(helix.group);

  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: SCRIM,
      uniforms: { uFlip: { value: 1 } },
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    })
  );
  shade.frustumCulled = false;
  const shadeScene = new THREE.Scene();
  shadeScene.add(shade);
  const noClip = [];

  const forward = new THREE.Vector3();
  let shown = true;

  return {
    resize: () => ctx.resize(),
    // source: the stage's helix, already posed this frame. axisPoint: a point on
    // the helix axis that the cut plane passes through.
    render(camera, source, axisPoint, time, on) {
      on = on && source.group.visible;
      if (on !== shown) {
        wrap.style.display = on ? '' : 'none';
        shown = on;
      }
      if (!on) return;
      Object.assign(helix.params, source.params);
      helix.group.position.copy(source.group.position);
      helix.group.quaternion.copy(source.group.quaternion);
      helix.group.scale.copy(source.group.scale);
      helix.update(time);
      // Keep only what lies between the camera and the axis.
      camera.getWorldDirection(forward).negate();
      plane.setFromNormalAndCoplanarPoint(forward, axisPoint);
      ctx.keyLight.position.copy(keyLight.position);
      // Only over the title itself; everywhere else the stage canvas already shows it.
      if (clipTo) {
        const r = clipTo.getBoundingClientRect();
        wrap.style.clipPath = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`;
      }
      if (scrim) {
        const m = getComputedStyle(scrim).transform;
        shade.material.uniforms.uFlip.value = m && m !== 'none' ? Number(m.slice(7).split(',')[0]) : 1;
      }
      renderer.clear();
      renderer.clippingPlanes = [plane];
      renderer.render(scene, camera);
      renderer.clippingPlanes = noClip;
      renderer.render(shadeScene, camera);
    },
  };
}
