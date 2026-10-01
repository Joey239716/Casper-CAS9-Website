// Post-processing. Owner: main session (taken over from 04-atmosphere, see D-001).
// One extra pass after the scene render: bloom that responds to red only,
// a radial colour split for the cut, and a vignette.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Keep only what is strongly red and brighter than a lit surface, so the white
// highlights on the glass stay crisp and the red cells do not glow.
const BRIGHT = /* glsl */ `
  uniform sampler2D tDiffuse;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float red = c.r - c.b * 1.6 - max(0.0, c.g - c.r * 0.8);
    float k = smoothstep(0.7, 1.6, red);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

const BLUR = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uStep;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
    c += (texture2D(tDiffuse, vUv + uStep * 1.3846).rgb + texture2D(tDiffuse, vUv - uStep * 1.3846).rgb) * 0.316216;
    c += (texture2D(tDiffuse, vUv + uStep * 3.2308).rgb + texture2D(tDiffuse, vUv - uStep * 3.2308).rgb) * 0.070270;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const COMPOSITE = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tBloom;
  uniform float uBloom;
  uniform float uSplit;
  uniform float uVignette;
  varying vec2 vUv;
  void main() {
    vec2 d = vUv - 0.5;
    float r2 = dot(d, d);
    vec3 c;
    if (uSplit > 0.001) {
      // Radial dispersion, growing towards the edges, as if the lens was struck.
      vec2 o = d * r2 * uSplit * 0.22 + d * uSplit * 0.012;
      c.r = texture2D(tDiffuse, vUv + o).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - o).b;
    } else {
      c = texture2D(tDiffuse, vUv).rgb;
    }
    c += texture2D(tBloom, vUv).rgb * uBloom;
    c *= 1.0 - uVignette * smoothstep(0.18, 0.75, r2);
    gl_FragColor = vec4(c, 1.0);
  }
`;

class FinishPass extends Pass {
  constructor(params, low) {
    super();
    this.params = params;
    const options = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, options);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, options);
    this.divisor = low ? 4 : 2;
    const make = (fragmentShader, uniforms) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    this.bright = make(BRIGHT, { tDiffuse: { value: null } });
    this.blur = make(BLUR, { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } });
    this.composite = make(COMPOSITE, {
      tDiffuse: { value: null },
      tBloom: { value: this.rtA.texture },
      uBloom: { value: 0 },
      uSplit: { value: 0 },
      uVignette: { value: 0 },
    });
    this.quad = new FullScreenQuad(this.bright);
  }

  setSize(width, height) {
    const w = Math.max(1, Math.floor(width / this.divisor));
    const h = Math.max(1, Math.floor(height / this.divisor));
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
  }

  render(renderer, writeBuffer, readBuffer) {
    const { bloom, split, vignette } = this.params;
    if (bloom > 0.001) {
      this.quad.material = this.bright;
      this.bright.uniforms.tDiffuse.value = readBuffer.texture;
      renderer.setRenderTarget(this.rtA);
      this.quad.render(renderer);

      // Two rounds of separable blur, the second wider, for a soft falloff.
      this.quad.material = this.blur;
      for (const scale of [1.2, 2.6]) {
        this.blur.uniforms.tDiffuse.value = this.rtA.texture;
        this.blur.uniforms.uStep.value.set(scale / this.rtA.width, 0);
        renderer.setRenderTarget(this.rtB);
        this.quad.render(renderer);
        this.blur.uniforms.tDiffuse.value = this.rtB.texture;
        this.blur.uniforms.uStep.value.set(0, scale / this.rtA.height);
        renderer.setRenderTarget(this.rtA);
        this.quad.render(renderer);
      }
    }
    this.quad.material = this.composite;
    this.composite.uniforms.tDiffuse.value = readBuffer.texture;
    this.composite.uniforms.uBloom.value = bloom;
    this.composite.uniforms.uSplit.value = split;
    this.composite.uniforms.uVignette.value = vignette;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.bright.dispose();
    this.blur.dispose();
    this.composite.dispose();
    this.quad.dispose();
  }
}

export function createPost(ctx) {
  const { renderer, scene, camera } = ctx;
  const low = ctx.quality === 'low';
  const params = { bloom: 0.9, split: 0, vignette: 0.35 };

  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: low ? 2 : 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const finish = new FinishPass(params, low);
  composer.addPass(finish);
  composer.addPass(new OutputPass());

  return {
    params,
    render() {
      composer.render();
    },
    setSize(width, height) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
    },
    dispose() {
      finish.dispose();
      composer.dispose();
      target.dispose();
    },
  };
}
