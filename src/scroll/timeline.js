// The choreography. Owner: main session.
//
// One pure function: given each scene's progress (0..1), it sets every model
// param and the camera's target pose. Nothing here remembers the last frame, so
// the page can be scrubbed backwards or jumped to any point.
import * as THREE from 'three';
import { clamp01, lerp, range, ease, pulse, window01, orbitPose, mixPose, createPose } from './cameraPath.js';

const FAR = 320; // pulling the camera this far back loses the helix in the fog

// Set a param only if the model declares it, so a missing param never throws.
function put(model, name, value) {
  if (model && model.params && name in model.params) model.params[name] = value;
}

const worldPos = new THREE.Vector3();
export function anchorWorld(model, name, out = new THREE.Vector3()) {
  const a = model?.anchors?.[name];
  if (!a) return null;
  if (a.isObject3D) return a.getWorldPosition(out);
  return model.group.localToWorld(out.copy(a));
}

// Read the helix's site layout once. The helix stands on the world Y axis with
// the target site at the origin, so only heights matter.
export function readLayout(stage) {
  const { helix } = stage.models;
  helix.group.updateMatrixWorld(true);
  const y = (name, fallback) => anchorWorld(helix, name, worldPos)?.y ?? fallback;
  const sites = [0, 1, 2, 3, 4].map((k) => y(`site${k}`, 51 - k * 10));
  return {
    sites,
    dir: Math.sign(sites[0]) || 1, // which way along the axis the decoys lie
    target: y('target', 0),
    pam: y('pam', 3.9),
    cut: y('cutSite', 2.4),
    edit: y('editSite', -10.2),
  };
}

// Title: how far (world units) the camera slides along its own right so the
// helix crosses the title, and how much harder it leans.
const TITLE_SHIFT = 4;
const TITLE_ROLL = -8;

const poseA = createPose();
const poseB = createPose();
const centre = new THREE.Vector3();
const cas9Pos = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Where Cas9 is: a height on the axis plus a sideways lift off it.
function cas9At(out, height, lift) {
  const a = THREE.MathUtils.degToRad(20);
  return out.set(Math.cos(a) * lift, height, Math.sin(a) * lift);
}

export function choreograph(stage, sp, time) {
  const { helix, cas9, cells, nucleus, letters, halo } = stage.models;
  const L = stage.layout;
  const pose = stage.pose;
  const narrow = stage.narrow; // phone: subject is centred, so stay a little further out
  const reach = narrow ? 1.45 : 1;
  const ROLL = narrow ? -8 : -20;

  // Which scene is in charge of the camera: the last one that has started.
  const order = stage.order;
  let active = order[0];
  for (const id of order) if (sp[id] > 0) active = id;

  // ---- Helix -------------------------------------------------------------
  const travelled = sp.title * 0.2 + sp.library * 1.3 + sp.reader * 0.25 + sp.search * 0.5;
  put(helix, 'spin', travelled + sp.match * 0.12 + sp.repair * 0.2 + sp.beyond * 0.3 + sp.references * 0.2);

  // Search: five decoy landings, each a short red flash of its landmark.
  const stay = [
    [0.08, 0.16],
    [0.28, 0.37],
    [0.49, 0.58],
    [0.7, 0.79],
    [0.91, 1.0],
  ];
  const hop = [
    [0.16, 0.28],
    [0.37, 0.49],
    [0.58, 0.7],
    [0.79, 0.91],
  ];
  stay.forEach(([a, b], k) => {
    const hold = k === 4 ? window01(sp.search, a, 2, 0.03) * (1 - ease(sp.match, 0.12, 0.18)) : window01(sp.search, a, b, 0.03);
    put(helix, `pamFlash${k}`, hold);
  });

  // Match: the near-miss, then the real thing.
  put(helix, 'nearUnzip', pulse(sp.match, 0.0, 0.18));
  const closed = 1 - ease(sp.repair, 0.06, 0.26); // the bubble zips shut once Cas9 lets go
  put(helix, 'pamFlash', window01(sp.match, 0.28, 0.46, 0.04));
  put(helix, 'unzip', ease(sp.match, 0.32, 0.5) * closed);
  put(helix, 'match', range(sp.match, 0.42, 0.7) * closed);
  

  // Cut: an automatic beat (stage.cutBeat), not scrubbed.
  const beat = stage.cutBeat;
  put(helix, 'cut', beat);
  put(cas9, 'cutPulse', range(beat, 0, 0.4));
  if (stage.post) {
    put(stage.post, 'split', pulse(beat, 0.02, 0.3) * 0.28);
  }

  put(helix, 'repair', ease(sp.repair, 0.22, 0.5));
  put(helix, 'dim', ease(sp.repair, 0.44, 0.64) * (1 - ease(sp.beyond, 0, 0.15)));
  put(helix, 'edit', ease(sp.beyond, 0.28, 0.52));
  // The axis straightens while Cas9 is on it, and drifts again once it has left.
  put(helix, 'sway', 1 - ease(sp.reader, 0.25, 0.7) * (1 - ease(sp.repair, 0.3, 0.9)));
  // No idle rotation while Cas9 is working on the helix.
  put(helix, 'idle', 1 - ease(sp.reader, 0.8, 1) * (1 - ease(sp.payoff, 0, 0.2)));

  // ---- Cas9 --------------------------------------------------------------
  // Reader: it waits beside the helix, takes the guide, closes.
  let height = L.sites[0];
  let lift = 9;
  let open = 1 - ease(sp.reader, 0.36, 0.6);
  put(cas9, 'guide', ease(sp.reader, 0.1, 0.46));

  // Search: on to the helix at the first site, then hop from site to site.
  lift = lerp(lift, 0, ease(sp.search, 0, 0.08));
  open = Math.max(open, pulse(sp.search, 0, 0.08) * 0.5);
  hop.forEach(([a, b], k) => {
    const u = ease(sp.search, a, b);
    height = lerp(height, L.sites[k + 1], u);
    const arc = pulse(sp.search, a, b);
    lift += arc * 4.2;
    open = Math.max(open, arc * 0.55);
  });
  // Match: leave the near-miss for the target.
  {
    const u = ease(sp.match, 0.16, 0.28);
    height = lerp(height, L.target, u);
    const arc = pulse(sp.match, 0.16, 0.28);
    lift += arc * 4.2;
    open = Math.max(open, arc * 0.55);
  }
  put(cas9, 'grip', ease(sp.match, 0.66, 0.74) * (1 - ease(sp.repair, 0, 0.1)));
  // Repair: it lets go and drifts off.
  const leave = ease(sp.repair, 0.02, 0.24);
  lift += leave * 16;
  height += leave * L.dir * 5;
  open = Math.max(open, leave * 0.7);
  put(cas9, 'open', open);
  const cas9Seen = ease(sp.reader, 0.0, 0.12) * (1 - ease(sp.repair, 0.1, 0.24));
  put(cas9, 'presence', cas9Seen);
  if (cas9) {
    cas9At(cas9.group.position, height, lift);
    cas9.group.rotation.set(0, 0, 0);
    cas9.group.rotation.y = leave * 0.9 + (1 - ease(sp.search, 0, 0.08)) * -0.5;
    cas9.group.visible = cas9Seen > 0.001;
    cas9Pos.copy(cas9.group.position);
  }

  // ---- Cells -------------------------------------------------------------
  const opening = ease(sp.title, 0.7, 1) * (1 - ease(sp.problem, 0.78, 1));
  const closing = ease(sp.payoff, 0.16, 0.28) * (1 - ease(sp.practice, 0.8, 1));
  const cellsSeen = Math.max(opening, closing);
  put(cells, 'presence', cellsSeen);
  put(cells, 'sickled', 0.45);
  put(cells, 'replace', range(sp.payoff, 0.26, 0.7));
  put(cells, 'calm', ease(sp.practice, 0, 0.12) * (1 - ease(sp.beyond, 0, 0.1)));
  // The annotated cell is in frame for flow between -25 and +12; hold flow nearly still while 'replace' runs.
  put(cells, 'flow', -25 + sp.problem * 37 + sp.payoff * 8 + sp.practice * 20);
  if (cells) cells.group.visible = cellsSeen > 0.001;

  // ---- Nucleus -----------------------------------------------------------
  // The dive layer rides on the camera by itself. In: during "spare". Out: the
  // same dive run backwards at the start of "payoff". At descent = 1 only the
  // distant chromatin haze around the helix remains.
  const diveIn = ease(sp.spare, 0.0, 0.86);
  const diveOut = ease(sp.payoff, 0.0, 0.24);
  const back = sp.beyond > 0; // the helix returns for "beyond"
  put(nucleus, 'descent', back ? 1 : sp.payoff > 0 ? 1 - diveOut : diveIn);
  const nucleusSeen = back
    ? ease(sp.beyond, 0.04, 0.2)
    : ease(sp.problem, 0.8, 1) * (1 - ease(sp.payoff, 0.2, 0.28));
  put(nucleus, 'presence', nucleusSeen);
  put(nucleus, 'haze', 0.55);
  if (nucleus) nucleus.group.visible = nucleusSeen > 0.001;
  const beyond = ease(sp.beyond, 0.04, 0.2);

  // ---- Letters -----------------------------------------------------------
  // The title opens on the letters too, thinning out as the camera pulls back.
  const titleOn = 1 - ease(sp.title, 0.45, 0.85);
  put(letters, 'opacity', Math.max(ease(sp.spare, 0.85, 1) * (1 - ease(sp.payoff, 0, 0.15)), beyond, titleOn) * 0.9);
  put(letters, 'drift', sp.library * 1.0 + sp.search * 0.4 + sp.reader * 0.15);

  // ---- Helix visibility --------------------------------------------------
  const helixSeen = sp.problem < 0.5 || (sp.spare > 0.72 && sp.payoff < 0.24) || sp.beyond > 0;
  if (helix) helix.group.visible = helixSeen;
  if (letters) letters.group.visible = helixSeen && letters.params.opacity > 0.001;

  // ---- Halo: a soft light behind the helix while the title is up ----------
  if (halo) {
    put(halo, 'opacity', 0.3 * titleOn * (sp.problem > 0 ? 0 : 1));
  }

  // ---- Bloom -------------------------------------------------------------
  if (stage.post) put(stage.post, 'bloom', 0.9);

  // ---- Camera ------------------------------------------------------------
  const far0 = far0Of(L);
  switch (active) {
    case 'title':
    case 'problem': {
      centre.set(0, far0, 0);
      orbitPose(pose, centre, {
        radius: (30 + ease(sp.title, 0.6, 1) * FAR) * reach,
        azimuth: 62,
        height: 5,
        roll: ROLL + TITLE_ROLL * titleOn,
      });
      // Slide sideways so the helix runs through the title, easing back as it pulls away.
      fwd.subVectors(pose.look, pose.pos).normalize();
      right.crossVectors(fwd, UP).normalize();
      const shift = (narrow ? 0 : TITLE_SHIFT) * titleOn;
      pose.pos.addScaledVector(right, shift);
      pose.look.addScaledVector(right, shift);
      break;
    }
    case 'spare': {
      // Arrive at the helix out of the fog as the dive ends.
      centre.set(0, far0, 0);
      orbitPose(pose, centre, {
        radius: lerp(150, 17 * reach, ease(sp.spare, 0.62, 1)),
        azimuth: lerp(40, 62, ease(sp.spare, 0.6, 1)),
        height: L.dir * 10,
        lookHeight: lerp(0, -L.dir * 6, ease(sp.spare, 0.7, 1)),
        roll: ROLL,
      });
      break;
    }
    case 'library': {
      // Travel along the axis towards the first site.
      const t = sp.library;
      centre.set(0, lerp(far0, L.sites[0] + L.dir * 14, smoothTravel(t)), 0);
      orbitPose(pose, centre, {
        radius: lerp(17, 15, t) * reach,
        azimuth: lerp(62, 118, t),
        height: L.dir * 10,
        lookHeight: -L.dir * 6,
        roll: ROLL,
      });
      break;
    }
    case 'reader': {
      const t = sp.reader;
      orbitPose(poseA, centre.set(0, L.sites[0] + L.dir * 14, 0), {
        radius: 15 * reach,
        azimuth: 118,
        height: L.dir * 10,
        lookHeight: -L.dir * 6,
        roll: ROLL,
      });
      orbitPose(poseB, cas9Pos, { radius: 30 * reach, azimuth: 76, height: 3, roll: ROLL });
      mixPose(pose, poseA, poseB, ease(t, 0, 0.3));
      pose.pos.addScaledVector(pose.pos.clone().sub(pose.look).normalize(), -5 * ease(t, 0.3, 1));
      break;
    }
    case 'search': {
      orbitPose(pose, cas9Pos, {
        radius: 27 * reach,
        azimuth: lerp(76, 96, sp.search),
        height: 3 + L.dir * 3,
        roll: ROLL,
      });
      break;
    }
    case 'match':
    case 'cut': {
      const closer = ease(sp.match, 0.26, 0.48);
      orbitPose(pose, cas9Pos, {
        radius: (lerp(27, 24, closer) - range(stage.cutBeat, 0, 1) * 1.2) * reach,
        azimuth: lerp(96, 112, sp.match) + sp.cut * 6,
        height: 3 + L.dir * 3 - closer * 2,
        roll: ROLL,
      });
      break;
    }
    case 'repair': {
      centre.set(0, lerp(L.target, L.cut, 0.5), 0);
      orbitPose(pose, centre, {
        radius: lerp(22.8, 20, ease(sp.repair, 0, 0.6)) * reach,
        azimuth: 118 + sp.repair * 26,
        height: lerp(1 + L.dir * 3, 2, sp.repair),
        roll: ROLL,
      });
      break;
    }
    case 'payoff':
    case 'practice': {
      centre.set(0, lerp(L.target, L.cut, 0.5), 0);
      orbitPose(pose, centre, {
        radius: (20 + ease(sp.payoff, 0, 0.18) * FAR) * reach,
        azimuth: 144,
        height: 2,
        roll: ROLL,
      });
      break;
    }
    default: {
      // beyond, references: back to the glass, at the edited rung.
      centre.set(0, L.edit, 0);
      orbitPose(pose, centre, {
        radius: (lerp(60, 15, ease(sp.beyond, 0, 0.2)) + sp.references * 10) * reach,
        azimuth: 70 + sp.beyond * 30 + sp.references * 20,
        height: 2,
        roll: ROLL,
      });
    }
  }

  // The halo hangs behind the axis, on the line of sight through the look point.
  if (halo) {
    fwd.subVectors(pose.look, pose.pos).normalize();
    right.crossVectors(fwd, UP).normalize();
    const shift = active === 'title' && !narrow ? TITLE_SHIFT * titleOn : 0;
    // On the line from the camera through the axis, so it sits right behind the helix.
    centre.copy(pose.look).addScaledVector(right, -shift);
    fwd.subVectors(centre, pose.pos).normalize();
    halo.group.position.copy(centre).addScaledVector(fwd, 30);
  }

  stage.active = active;
  return pose;
}

// A clean stretch of helix far from the action, where the opening is framed.
function far0Of(L) {
  return L.sites[0] + L.dir * 30;
}

// Ease in and out of the long travel so it does not start or stop abruptly.
function smoothTravel(t) {
  return t * t * (3 - 2 * t);
}

// When each annotation is visible, as [from, to] in its own scene's progress.
// Anything not listed uses the default.
const annotationWindows = {
  default: [0.22, 0.7],
};

export function annotationAlpha(def, sp, stage) {
  const [a, b] = annotationWindows[def.id] ?? annotationWindows.default;
  const p = sp[def.scene] ?? 0;
  let alpha = stage.reduced ? (p > 0 && p < 1 ? 1 : 0) : window01(p, a, b, 0.05);
  if (def.scene === 'cut') alpha = Math.min(1, alpha) * ease(stage.cutBeat, 0.5, 1);
  return clamp01(alpha);
}
