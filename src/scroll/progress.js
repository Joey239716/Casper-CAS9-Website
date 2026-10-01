// The progress strand. Owner: agent 05-page.
//
// A slim vertical double strand at the left edge. As p goes from 0 to 1 it
// unzips from the top: above the fork the two backbones stand apart with their
// bases exposed; below it they are still paired. It replaces scene numbering:
// small ticks beside it mark where each scene begins.
//
// The only arterial red in the HTML layer lives here: once the page has reached
// the `reader` scene (where the guide RNA first appears in the 3D), a red
// thread runs down the opened part of the strand, pairing with one side.
//
//   const progress = createProgress(el);
//   progress.set(p); // 0..1 over the whole page
const NS = 'http://www.w3.org/2000/svg';
const W = 28; // px, matches [data-progress] width in main.css
const CX = 9; // centre line of the strand
const OPEN = 5.5; // half-gap between backbones once unzipped
const SHUT = 2; // half-gap while paired
const FORK = 16; // px over which the strand opens
const PITCH = 5; // px between rungs
const STEP = 2; // px sampling of the backbones

const smooth = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export function createProgress(el) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const make = (cls) => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', cls);
    svg.append(path);
    return path;
  };
  const ticks = make('strand__ticks');
  const rungs = make('strand__rungs');
  const left = make('strand__backbone');
  const right = make('strand__backbone');
  const guide = make('strand__guide');
  el.replaceChildren(svg);

  let height = 0;
  let readerAt = 1; // page progress at which the guide thread may begin
  let lastP = -1;
  let current = 0;

  // Where each scene starts, as a fraction of total scroll.
  function layout() {
    height = el.clientHeight || 0;
    svg.setAttribute('viewBox', `0 0 ${W} ${Math.max(1, height)}`);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const marks = [];
    readerAt = 1;
    if (max > 0) {
      for (const section of document.querySelectorAll('section[data-scene]')) {
        const at = Math.min(1, Math.max(0, (section.getBoundingClientRect().top + window.scrollY) / max));
        marks.push(at);
        if (section.dataset.scene === 'reader') readerAt = at;
      }
    }
    ticks.setAttribute(
      'd',
      marks.map((at) => `M${CX + OPEN + 5} ${(at * height).toFixed(1)}h4`).join(''),
    );
    lastP = -1;
    draw(current);
  }

  // Half-gap between the backbones at height y, when the fork is at yf.
  const half = (y, yf) => SHUT + (OPEN - SHUT) * (1 - smooth((y - (yf - FORK)) / FORK));

  function draw(p) {
    if (!height) return;
    if (Math.abs(p - lastP) < 0.0004) return;
    lastP = p;
    const yf = p * height;

    let l = '';
    let r = '';
    for (let y = 0; y <= height; y += STEP) {
      const g = half(y, yf);
      l += `${y ? 'L' : 'M'}${(CX - g).toFixed(2)} ${y}`;
      r += `${y ? 'L' : 'M'}${(CX + g).toFixed(2)} ${y}`;
    }
    left.setAttribute('d', l);
    right.setAttribute('d', r);

    // Paired rungs below the fork; exposed bases (short stubs) above it.
    let d = '';
    for (let y = PITCH / 2; y < height; y += PITCH) {
      const g = half(y, yf);
      if (g < SHUT + 0.6) d += `M${(CX - g).toFixed(2)} ${y}H${(CX + g).toFixed(2)}`;
      else if (g > OPEN - 0.6) d += `M${(CX - g).toFixed(2)} ${y}h1.8M${(CX + g).toFixed(2)} ${y}h-1.8`;
    }
    rungs.setAttribute('d', d);

    // The guide thread: from where `reader` begins down to just above the fork.
    const from = readerAt * height;
    const to = yf - FORK * 0.9;
    guide.setAttribute('d', p > readerAt && to > from + 1 ? `M${(CX - OPEN + 3.4).toFixed(2)} ${from.toFixed(1)}V${to.toFixed(1)}` : '');
  }

  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('load', layout);
  document.fonts?.ready.then(layout);

  return {
    /** p: 0..1 over the whole page. */
    set(p) {
      current = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
      draw(current);
    },
  };
}
