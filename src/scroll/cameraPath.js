// Camera and easing helpers for the choreography. Owner: main session.
import * as THREE from 'three';

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// 0 before a, 1 after b, linear between.
export const range = (t, a, b) => clamp01((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const ease = (t, a, b) => smooth(range(t, a, b));
// Rises to 1 at the middle of [a, b] and falls back to 0.
export const pulse = (t, a, b) => Math.sin(Math.PI * range(t, a, b)) ** 2;
// 1 inside [a, b] with soft edges of width e.
export const window01 = (t, a, b, e = 0.05) => Math.min(ease(t, a - e, a + e), 1 - ease(t, b - e, b + e));

export function createPose() {
  return { pos: new THREE.Vector3(0, 0, 30), look: new THREE.Vector3(), roll: 0, fov: 35 };
}

export function copyPose(to, from) {
  to.pos.copy(from.pos);
  to.look.copy(from.look);
  to.roll = from.roll;
  to.fov = from.fov;
  return to;
}

export function mixPose(out, a, b, t) {
  out.pos.lerpVectors(a.pos, b.pos, t);
  out.look.lerpVectors(a.look, b.look, t);
  out.roll = lerp(a.roll, b.roll, t);
  out.fov = lerp(a.fov, b.fov, t);
  return out;
}

// A pose described around a vertical axis through `centre`: height along the
// axis, distance from it, and the angle around it. This is how every helix
// shot is framed.
export function orbitPose(out, centre, { radius, azimuth, height = 0, lookHeight = 0, roll = 0, fov = 35 }) {
  const a = THREE.MathUtils.degToRad(azimuth);
  out.pos.set(centre.x + Math.cos(a) * radius, centre.y + height, centre.z + Math.sin(a) * radius);
  out.look.set(centre.x, centre.y + lookHeight, centre.z);
  out.roll = roll;
  out.fov = fov;
  return out;
}

const forward = new THREE.Vector3();
const rollQ = new THREE.Quaternion();

export function applyPose(camera, pose) {
  camera.position.copy(pose.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(pose.look);
  if (pose.roll) {
    camera.getWorldDirection(forward);
    rollQ.setFromAxisAngle(forward, THREE.MathUtils.degToRad(pose.roll));
    camera.quaternion.premultiply(rollQ);
  }
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}

// Frame-rate independent approach of `current` towards `target`.
export function dampPose(current, target, dt, rate = 7) {
  const k = 1 - Math.exp(-dt * rate);
  return mixPose(current, current, target, k);
}

// Place `group` so that the camera sees it exactly as a lab view would:
// the camera sits at view.pos looking at view.look in the group's own space.
const viewMatrix = new THREE.Matrix4();
const eye = new THREE.Vector3();
const target = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

export function attachToCamera(group, camera, view) {
  eye.fromArray(view.pos);
  target.fromArray(view.look);
  // Matrix4.lookAt builds a rotation whose -Z points from eye to target.
  viewMatrix.lookAt(eye, target, up).setPosition(eye);
  viewMatrix.invert();
  camera.updateMatrixWorld();
  group.matrix.multiplyMatrices(camera.matrixWorld, viewMatrix);
  group.matrix.decompose(group.position, group.quaternion, group.scale);
}
