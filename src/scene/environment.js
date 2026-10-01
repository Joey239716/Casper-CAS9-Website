// Lighting environment. Owner: main session.
// A dark studio with a few bright panels, baked to an environment map. Glass on
// a dark field is drawn almost entirely by its reflections, so the panel layout
// is what gives the models their edges.
import * as THREE from 'three';
import { tokens } from './tokens.js';

function panel(w, h, intensity, tint = 0xffffff) {
  const color = new THREE.Color(tint).multiplyScalar(intensity);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  );
}

export function createEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(40, 40, 40),
      new THREE.MeshBasicMaterial({ color: 0x020305, side: THREE.BackSide })
    )
  );

  // Key: large soft panel, camera-left and slightly above.
  const key = panel(9, 14, 9, 0xf2f6ff);
  key.position.set(-11, 4, 5);
  key.lookAt(0, 0, 0);
  studio.add(key);

  // Rim: narrow strip behind-right, gives the bright edge line.
  const rim = panel(1.2, 18, 26, 0xdfe9ff);
  rim.position.set(9, 2, -8);
  rim.lookAt(0, 0, 0);
  studio.add(rim);

  // Second thin strip, low left, so curved glass shows two edge lines.
  const strip = panel(0.8, 12, 14, 0xffffff);
  strip.position.set(-6, -7, -9);
  strip.lookAt(0, 0, 0);
  studio.add(strip);

  // Top fill: faint, cool.
  const top = panel(12, 12, 1.4, 0xb9c8e6);
  top.position.set(0, 14, 0);
  top.lookAt(0, 0, 0);
  studio.add(top);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(studio, 0.03).texture;
  pmrem.dispose();
  studio.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return envMap;
}

// Backdrop: a large inward-facing sphere with a darkfield-to-deep-field gradient.
// It is real geometry so clear glass has something to refract.
export function createBackdrop(radius = 900) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uLow: { value: new THREE.Color(tokens.darkfield) },
      uHigh: { value: new THREE.Color(tokens.deepField) },
      uNavy: { value: new THREE.Color(tokens.navy) },
      uLift: { value: 0.9 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLow;
      uniform vec3 uHigh;
      uniform vec3 uNavy;
      uniform float uLift;
      varying vec3 vDir;
      void main() {
        // Brightest in a soft band behind the subject, falling to darkfield.
        float band = 1.0 - smoothstep(0.0, 0.9, abs(vDir.y - 0.08));
        float side = smoothstep(-1.0, 1.0, -vDir.x) * 0.5 + 0.5;
        vec3 tint = mix(uNavy, uHigh, smoothstep(-0.6, 0.6, vDir.x));
        vec3 col = mix(uLow, tint, band * side * uLift);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  mesh.name = 'backdrop';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}
