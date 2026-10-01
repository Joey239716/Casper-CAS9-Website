// A soft violet light behind the subject, so the beads read against something.
// Owner: main session. One additive sprite; the choreography places it.
import * as THREE from 'three';

function glowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function create() {
  const material = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0x8a6cf0,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = -500;
  const group = new THREE.Group();
  group.add(sprite);
  const params = { opacity: 0, size: 46 };
  return {
    group,
    params,
    anchors: {},
    update() {
      material.opacity = params.opacity;
      sprite.scale.set(params.size, params.size * 1.25, 1);
      group.visible = params.opacity > 0.001;
    },
    dispose() {
      material.map.dispose();
      material.dispose();
    },
  };
}
