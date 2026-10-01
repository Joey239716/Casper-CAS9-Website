// Pinned clinical labels. Owner: agent 05-page.
//
// Each annotation is a small text block under a hairline rule, joined to its
// 3D anchor by a hairline leader, in the manner of a figure label in a journal.
//
//   const annotations = createAnnotations({ root, defs });
//   annotations.set(id, { x, y, alpha });   // anchor in CSS px from the viewport's top-left
//   annotations.hideAll();
//
// defs: [{ id, anchor, text, scene, term?, refs? }]. `term` is the leading part
// of `text` to set in a heavier weight; `refs` are keys into `references`.
//
// Runs every frame, so it writes only `transform`, `opacity` and `visibility`,
// and only when the value changed.
import { refNumber } from '../content/scenes.js';

const PHONE = '(max-width: 900px)'; // same breakpoint as the phone layout in main.css

export function createAnnotations({ root, defs }) {
  const items = new Map();
  const phone = window.matchMedia(PHONE);
  const view = { w: window.innerWidth, h: window.innerHeight };

  for (const def of defs) {
    const el = document.createElement('div');
    el.className = 'anno';
    el.dataset.annotation = def.id;
    // Not `data-scene`: that attribute identifies the <section> elements (CONTRACT section 8).
    el.dataset.annotationScene = def.scene ?? '';

    const dot = document.createElement('span');
    dot.className = 'anno__dot';
    const lead = document.createElement('span');
    lead.className = 'anno__lead';
    const label = document.createElement('p');
    label.className = 'anno__label';

    const term = def.term && def.text.startsWith(def.term) ? def.term : '';
    if (term) {
      const b = document.createElement('b');
      b.textContent = term;
      label.append(b);
    }
    label.append(document.createTextNode(def.text.slice(term.length)));
    const nums = (def.refs ?? []).map(refNumber).filter(Boolean);
    if (nums.length) {
      const sup = document.createElement('sup');
      sup.textContent = nums.join(', ');
      label.append(sup);
    }

    el.append(lead, dot, label);
    root.append(el);
    items.set(def.id, {
      el,
      dot,
      lead,
      label,
      w: 0,
      h: 0,
      alpha: 0,
      rect: null, // label rect while visible, for collision checks
      css: { dot: '', lead: '', label: '', opacity: '', visible: false },
    });
  }

  function measure() {
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    for (const it of items.values()) {
      it.w = it.label.offsetWidth;
      it.h = it.label.offsetHeight;
    }
  }
  measure();
  window.addEventListener('resize', measure);
  document.fonts?.ready.then(measure);

  const write = (it, key, node, value) => {
    if (it.css[key] !== value) {
      it.css[key] = value;
      node.style.transform = value;
    }
  };

  const overlaps = (a, b, pad) =>
    a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;

  function place(id, it, x, y) {
    const { w, h } = it;
    const isPhone = phone.matches;
    const edge = isPhone ? 12 : 28;

    // The region labels may occupy: clear of the copy column and of the screen edges.
    const safe = isPhone
      ? { left: 44, right: view.w - edge, top: 56, bottom: view.h * 0.52 }
      : document.documentElement.classList.contains('copy-right')
        ? { left: edge, right: Math.max(w + edge, view.w * 0.58), top: edge, bottom: view.h - edge }
        : { left: Math.min(view.w * 0.42, view.w - w - edge), right: view.w - edge, top: edge, bottom: view.h - edge };

    const dx = isPhone ? 22 : 84; // horizontal run of the leader
    const dy = isPhone ? 30 : 52; // vertical rise of the leader

    // Preferred: up and to the right of the anchor. Flip left if it would leave the screen.
    let side = x + dx + w <= safe.right ? 1 : -1;
    let left = side === 1 ? x + dx : x - dx - w;
    if (left < safe.left) {
      left = safe.left;
      side = x < left ? 1 : x > left + w ? -1 : side;
    }
    left = Math.min(Math.max(left, safe.left), Math.max(safe.left, safe.right - w));

    // Above the anchor unless there is no room.
    let top = y - dy;
    if (top < safe.top) top = y + dy;
    top = Math.min(Math.max(top, safe.top), Math.max(safe.top, safe.bottom - h));

    // Keep clear of labels already on screen.
    let rect = { left, top, right: left + w, bottom: top + h };
    for (let pass = 0; pass < 3; pass += 1) {
      let moved = false;
      for (const [otherId, other] of items) {
        if (otherId === id || !other.rect || other.alpha <= 0.01) continue;
        if (overlaps(rect, other.rect, 10)) {
          const below = other.rect.bottom + 14;
          const above = other.rect.top - 14 - h;
          top = below + h <= safe.bottom ? below : Math.max(safe.top, above);
          rect = { left, top, right: left + w, bottom: top + h };
          moved = true;
        }
      }
      if (!moved) break;
    }
    it.rect = rect;

    // The leader runs from the anchor to the nearer end of the label's rule.
    const endX = Math.abs(x - left) <= Math.abs(x - (left + w)) ? left : left + w;
    const endY = top;
    const lx = endX - x;
    const ly = endY - y;
    const len = Math.hypot(lx, ly);
    const angle = Math.atan2(ly, lx);

    write(it, 'dot', it.dot, `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`);
    write(
      it,
      'lead',
      it.lead,
      `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${angle.toFixed(4)}rad) scaleX(${len.toFixed(1)})`,
    );
    write(it, 'label', it.label, `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`);
  }

  function show(it, alpha) {
    const a = Math.min(1, Math.max(0, alpha));
    it.alpha = a;
    const visible = a > 0.01;
    if (visible !== it.css.visible) {
      it.css.visible = visible;
      it.el.style.visibility = visible ? 'visible' : 'hidden';
    }
    const opacity = visible ? a.toFixed(3) : '0';
    if (opacity !== it.css.opacity) {
      it.css.opacity = opacity;
      it.el.style.opacity = opacity;
    }
    if (!visible) it.rect = null;
  }

  return {
    /** x, y: anchor position in CSS pixels from the viewport's top-left. alpha: 0..1. */
    set(id, { x, y, alpha = 1 } = {}) {
      const it = items.get(id);
      if (!it) return;
      const onScreen = Number.isFinite(x) && Number.isFinite(y) && x > -40 && x < view.w + 40 && y > -40 && y < view.h + 40;
      if (!onScreen || alpha <= 0.01) {
        show(it, 0);
        return;
      }
      if (!it.w) measure();
      it.alpha = alpha;
      place(id, it, x, y);
      show(it, alpha);
    },
    hideAll() {
      for (const it of items.values()) show(it, 0);
    },
  };
}
