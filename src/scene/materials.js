// Shared materials. Owner: main session. Every model takes its materials from
// ctx.materials so glass looks identical everywhere. Clone before changing a
// property per-model (e.g. opacity); never mutate the shared instance.
import * as THREE from 'three';
import { tokens } from './tokens.js';

export function createMaterials(quality = 'high') {
  const high = quality === 'high';

  // Clear structural glass: backbones, Cas9, clear cells.
  const glass = new THREE.MeshPhysicalMaterial({
    color: tokens.glass,
    metalness: 0,
    roughness: 0.06,
    ior: 1.5,
    transmission: high ? 1 : 0,
    thickness: high ? 0.9 : 0,
    dispersion: high ? 4 : 0,
    attenuationColor: new THREE.Color(0x9fb6d6),
    attenuationDistance: 6,
    specularIntensity: 1,
    envMapIntensity: high ? 1.35 : 1.6,
    clearcoat: high ? 0 : 1,
    clearcoatRoughness: 0.1,
  });
  if (!high) {
    // Reflection-only stand-in: dark body, bright reflections.
    glass.color.set(0x1a2433);
    glass.roughness = 0.12;
    glass.metalness = 0.35;
  }

  // Frosted glass: base-pair rungs, chromatin, anything drawn in the thousands.
  // Opaque (no transmission pass), so it is cheap and shows through clear glass.
  const frost = new THREE.MeshStandardMaterial({
    color: tokens.frost,
    metalness: 0,
    roughness: 0.55,
    envMapIntensity: 0.9,
  });

  // Dimmed frost: switched-off or far-away structure.
  const frostDim = frost.clone();
  frostDim.color.set(0x3a4658);
  frostDim.envMapIntensity = 0.4;

  // Arterial: opaque glossy red for red cells in the payoff.
  const arterial = new THREE.MeshPhysicalMaterial({
    color: tokens.arterial,
    metalness: 0,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xff5a6e),
    sheenRoughness: 0.5,
    envMapIntensity: 1.1,
  });

  // Guide: self-lit gold thread (guide RNA, PAM flash, lit rungs). Picked up by bloom.
  const guide = new THREE.MeshStandardMaterial({
    color: tokens.gold,
    // Deeper than the token so tone mapping lands it on gold, not pale yellow.
    emissive: 0xff9a12,
    emissiveIntensity: 1.7,
    metalness: 0,
    roughness: 0.35,
  });

  return { glass, frost, frostDim, arterial, guide };
}
