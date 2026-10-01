// Builds <main> from src/content/scenes.js. Owner: agent 05-page.
// Loaded by index.html as a module script placed BEFORE src/main.js, so the
// sections and readout elements exist by the time main.js queries the DOM.
import { scenes, practice, references, closingNote, approvals, refNumber } from './scenes.js';

const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
};

/** Citation numbers as links into the reference list: <sup><a>1</a>, <a>4</a></sup>. */
function cite(keys = []) {
  const nums = keys.map((k) => [k, refNumber(k)]).filter(([, n]) => n);
  if (!nums.length) return null;
  const sup = h('sup', { class: 'cite' });
  nums.forEach(([key, n], i) => {
    if (i) sup.append(', ');
    sup.append(h('a', { href: `#ref-${key}`, 'aria-label': `Reference ${n}` }, n));
  });
  return sup;
}

/** One block per sentence, so a two-sentence line breaks where the thought does. */
function lineSpans(line, accent) {
  const sentences = line.match(/[^.?!]+[.?!]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [line];
  return sentences.map((s) => {
    // One word may be picked out in the helix's colours (scene.accent).
    const at = accent ? s.indexOf(accent) : -1;
    if (at < 0) return h('span', { class: 'line__sentence' }, s);
    return h(
      'span',
      { class: 'line__sentence' },
      s.slice(0, at),
      h('span', { class: 'line__accent' }, accent),
      s.slice(at + accent.length),
    );
  });
}

function note(a) {
  const rest = a.term && a.text.startsWith(a.term) ? a.text.slice(a.term.length) : a.text;
  return h('p', { class: 'note' }, a.term ? h('b', { class: 'note__term' }, a.term) : null, rest, cite(a.refs));
}

function readout(kind) {
  if (kind === 'scale') {
    return h(
      'p',
      { class: 'readout readout--scale' },
      h('span', { class: 'readout__bar', 'aria-hidden': 'true' }),
      h('span', { class: 'readout__value', 'data-readout': 'scale' }, '6 µm'),
      h('span', { class: 'readout__unit' }, 'approximate scale of the view'),
    );
  }
  return h(
    'p',
    { class: 'readout readout--count' },
    h('span', { class: 'readout__value', 'data-readout': 'count' }, '0'),
    h('span', { class: 'readout__unit' }, 'base pairs'),
  );
}

// Story scenes alternate sides, starting on the right after the title.
const RIGHT = new Set(['problem', 'library', 'search', 'cut', 'payoff']);

function pinnedScene(s) {
  const isTitle = s.id === 'title';
  const heading = h(isTitle ? 'h1' : 'h2', { class: isTitle ? 'line line--title' : 'line', id: `line-${s.id}` }, lineSpans(s.line, s.accent));
  const copy = h(
    'div',
    { class: 'scene__copy' },
    heading,
    s.copy ? h('p', { class: isTitle ? 'copy copy--lede' : 'copy' }, s.copy) : null,
    isTitle ? h('p', { class: 'fine' }, 'An educational explainer with clinical notes for healthcare professionals. Sources are listed at the end.') : null,
    s.readout ? readout(s.readout) : null,
    s.annotations.length ? h('div', { class: 'notes' }, s.annotations.map(note)) : null,
  );
  return h(
    'section',
    {
      class: `scene scene--pinned scene--${s.id}${RIGHT.has(s.id) ? ' scene--right' : ''}`,
      'data-side': RIGHT.has(s.id) ? 'right' : 'left',
      id: `scene-${s.id}`,
      'data-scene': s.id,
      'aria-labelledby': `line-${s.id}`,
      style: `--len:${s.length ?? 100}`,
    },
    copy,
  );
}

function dl(items) {
  return h(
    'dl',
    { class: 'terms' },
    items.map((it) => h('div', { class: 'terms__item' }, h('dt', {}, it.term), h('dd', {}, it.text))),
  );
}

function practiceScene(s) {
  const { steps, evidence, asks } = practice;

  const stepList = h(
    'ol',
    { class: 'steps' },
    steps.items.map((it, i) =>
      h(
        'li',
        { class: 'steps__item' },
        h('span', { class: 'steps__n', 'aria-hidden': 'true' }, i + 1),
        h('h4', { class: 'steps__title' }, it.title),
        h('p', {}, it.text),
      ),
    ),
  );

  const table = h(
    'table',
    { class: 'evidence' },
    h('caption', { class: 'sr-only' }, 'Primary and key secondary outcomes of the pivotal trials, from the US prescribing information'),
    h('thead', {}, h('tr', {}, evidence.columns.map((c, i) => h('th', { scope: 'col', class: i === 2 ? 'num' : null }, c)))),
    h(
      'tbody',
      {},
      evidence.rows.map((r, i) => {
        const repeat = i > 0 && evidence.rows[i - 1].group === r.group;
        return h(
          'tr',
          { class: repeat ? 'evidence__cont' : null },
          h('th', { scope: 'row' }, repeat ? h('span', { class: 'sr-only' }, r.group) : r.group),
          h('td', {}, r.outcome),
          h('td', { class: 'num' }, h('span', { class: 'evidence__n' }, r.result), ' ', h('span', { class: 'evidence__pct' }, r.pct)),
        );
      }),
    ),
  );

  return h(
    'section',
    { class: 'scene scene--content scene--practice', id: `scene-${s.id}`, 'data-scene': s.id, 'aria-labelledby': `line-${s.id}` },
    h(
      'div',
      { class: 'content' },
      h('header', { class: 'content__head' }, h('h2', { class: 'line', id: `line-${s.id}` }, lineSpans(s.line)), h('p', { class: 'copy copy--wide' }, s.copy, cite(['label']))),

      h('section', { class: 'block' }, h('h3', { class: 'block__title' }, steps.heading), stepList),

      h(
        'section',
        { class: 'block block--evidence' },
        h('h3', { class: 'block__title' }, evidence.heading),
        h(
          'div',
          { class: 'block__body' },
          h('p', { class: 'copy copy--wide' }, evidence.indication, cite(['label'])),
          h('p', { class: 'copy copy--wide copy--quiet' }, approvals, cite(['fda2023', 'fda2024', 'fda2026'])),
          table,
          h('ul', { class: 'footnotes' }, evidence.notes.map((n, i) => h('li', {}, n, i === evidence.notes.length - 1 ? cite(['label', 'frangoul2024', 'locatelli2024']) : null))),
        ),
      ),

      h(
        'section',
        { class: 'block block--asks' },
        h('h3', { class: 'block__title' }, asks.heading, cite(asks.refs)),
        h('div', { class: 'block__body block__body--split' }, h('div', {}, dl(asks.burden)), h('div', {}, h('h4', { class: 'terms__heading' }, asks.warningsHeading), dl(asks.warnings))),
      ),
    ),
  );
}

/** What a reference link shows: the DOI in full, otherwise just the site. */
function linkText(url) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  return host === 'doi.org' ? `doi.org${u.pathname}` : host;
}

function referencesScene(s) {
  return h(
    'section',
    { class: 'scene scene--content scene--references', id: `scene-${s.id}`, 'data-scene': s.id, 'aria-labelledby': `line-${s.id}` },
    h(
      'div',
      { class: 'content content--refs' },
      h('h2', { class: 'line', id: `line-${s.id}` }, s.line),
      h(
        'ol',
        { class: 'refs' },
        references.map((r) =>
          h(
            'li',
            { id: `ref-${r.key}`, class: r.pending ? 'refs__item refs__item--pending' : 'refs__item' },
            h('span', { html: r.html }),
            ' ',
            h('a', { href: r.url, rel: 'noopener' }, linkText(r.url)),
          ),
        ),
      ),
      h('p', { class: 'closing' }, closingNote),
    ),
  );
}

const main = document.getElementById('main');
if (main) {
  main.replaceChildren(
    ...scenes.map((s) => {
      if (s.id === 'practice') return practiceScene(s);
      if (s.id === 'references') return referencesScene(s);
      return pinnedScene(s);
    }),
  );
}
