// The genetic text: a far layer of drifting A, T, C, G set in the display face.
// Owner: main session (taken over from 04-atmosphere, see D-001).
// One instanced draw call of camera-facing quads; all motion is in the shader.
import * as THREE from 'three';

export const meta = {
  name: 'letters',
  params: {
    opacity: { value: 1, doc: '0..1. Overall opacity of the layer.' },
    drift: { value: 0, doc: 'Any number. Slides the letters along the helix axis; 1 = one full wrap.' },
  },
  views: {
    hero: { pos: [0, 0, 60], look: [0, 0, 0], fov: 35 },
    withHelix: { pos: [8, 6, 22], look: [0, 0, 0], fov: 35 },
  },
};

const GLYPHS = ['A', 'T', 'C', 'G'];
// Each letter in its base's colour, matching the helix rungs.
const GLYPH_COLORS = [0xf5cf6a, 0x7fa6f0, 0xf38f7c, 0x86d6a2];
const CELL = 256;
const SPAN = 240; // length of the volume along Y, nm
const R_MIN = 13; // nothing closer to the axis than this: that space is the helix's
const R_MAX = 72;

async function buildAtlas() {
  try {
    await document.fonts.load('400 96px "Bodoni Moda"');
  } catch {
    // Falls back to the serif stack below.
  }
  const canvas = document.createElement('canvas');
  canvas.width = CELL * 4;
  canvas.height = CELL * 2;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '400 184px "Bodoni Moda", Didot, "Bodoni 72", serif';
  // Row 0 sharp, row 1 soft (out of focus), so far letters can look defocused.
  for (let row = 0; row < 2; row++) {
    g.filter = row === 0 ? 'none' : 'blur(5px)';
    GLYPHS.forEach((ch, i) => g.fillText(ch, CELL * (i + 0.5), CELL * (row + 0.5) + 8));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

// Small deterministic random generator, so the layout is the same every load.
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function create(ctx) {
  const group = new THREE.Group();
  const count = ctx.quality === 'low' ? 260 : 620;
  const rand = mulberry(7);

  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('uv', base.getAttribute('uv'));
  geometry.instanceCount = count;

  const offset = new Float32Array(count * 3);
  const look = new Float32Array(count * 4); // size, glyph, soft, brightness
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    // Bias towards the far radii so the layer thins out near the helix.
    const radius = R_MIN + (R_MAX - R_MIN) * Math.sqrt(rand());
    offset.set([Math.cos(angle) * radius, (rand() - 0.5) * SPAN, Math.sin(angle) * radius], i * 3);
    const near = 1 - (radius - R_MIN) / (R_MAX - R_MIN);
    const big = rand() < 0.08;
    look.set(
      [
        big ? 3.2 + rand() * 2.2 : 0.9 + rand() * 1.5,
        Math.floor(rand() * 4),
        // Sharp only for some of the nearer letters.
        rand() < 0.25 + near * 0.35 ? 0 : 1,
        (0.2 + rand() * 0.45),
      ],
      i * 4
    );
    c.set(GLYPH_COLORS[look[i * 4 + 1]]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
  geometry.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 4));
  geometry.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uAtlas: { value: await buildAtlas() },
      uOpacity: { value: 1 },
      uDrift: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(ctx.tokens.frost) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOffset;
      attribute vec4 aLook;
      attribute vec3 aCol;
      varying vec3 vCol;
      uniform float uDrift;
      uniform float uTime;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        vec3 p = aOffset;
        // Slide along the axis and wrap, so the layer streams past seamlessly.
        float speed = 0.6 + fract(aLook.w * 7.31) * 0.8;
        p.y = mod(p.y + uDrift * ${SPAN.toFixed(1)} * speed + uTime * 0.25 * speed + ${(SPAN / 2).toFixed(1)}, ${SPAN.toFixed(1)}) - ${(SPAN / 2).toFixed(1)};
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        mv.xy += position.xy * aLook.x;
        gl_Position = projectionMatrix * mv;
        vUv = (uv + vec2(aLook.y, 1.0 - aLook.z)) * vec2(0.25, 0.5);
        vCol = aCol;
        float dist = -mv.z;
        // Fade out with distance, where they wrap, and when very close to the camera.
        float wrap = 1.0 - smoothstep(${(SPAN * 0.38).toFixed(1)}, ${(SPAN * 0.5).toFixed(1)}, abs(p.y));
        vAlpha = aLook.w * wrap * smoothstep(16.0, 30.0, dist) * (1.0 - smoothstep(55.0, 130.0, dist));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vCol;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float a = texture2D(uAtlas, vUv).r * vAlpha * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(mix(uColor, vCol, 0.75), a);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  group.add(mesh);

  const params = { opacity: 1, drift: 0 };
  return {
    group,
    params,
    anchors: {},
    update(time) {
      material.uniforms.uOpacity.value = params.opacity * 0.55;
      material.uniforms.uDrift.value = params.drift;
      material.uniforms.uTime.value = time;
    },
    dispose() {
      geometry.dispose();
      base.dispose();
      material.uniforms.uAtlas.value.dispose();
      material.dispose();
    },
  };
}
