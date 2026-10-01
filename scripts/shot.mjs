// Headless screenshots of the model lab (or the site). Owner: main session.
//
//   npm run shot -- <name> "<query>" [<name> "<query>" ...] [--size=1440x900] [--page]
//
//   npm run shot -- helix/unzip-05 "model=helix&unzip=0.5&time=2"
//     -> agents/shots/helix/unzip-05.png
//
// --page shoots index.html instead of lab.html (query e.g. "progress=0.42").
// Needs the dev server (npm run dev) on http://localhost:5173, or set LAB_URL.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const rest = args.filter((a) => !a.startsWith('--'));
if (rest.length < 2 || rest.length % 2) {
  console.error('usage: npm run shot -- <name> "<query>" [<name> "<query>" ...] [--size=WxH] [--page]');
  process.exit(1);
}

const size = (flags.find((f) => f.startsWith('--size=')) ?? '--size=1440x900').slice(7).split('x').map(Number);
const html = flags.find((f) => f.startsWith('--html='))?.slice(7);
const page = html ?? (flags.includes('--page') ? 'index.html' : 'lab.html');
const base = process.env.LAB_URL ?? 'http://localhost:5173';
const root = resolve(import.meta.dirname, '..');

try {
  await fetch(base);
} catch {
  console.error(`No dev server at ${base}. Start it with: npm run dev`);
  process.exit(1);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({
  viewport: { width: size[0], height: size[1] },
  deviceScaleFactor: 1,
});

let failed = false;
for (let i = 0; i < rest.length; i += 2) {
  const name = rest[i];
  let q = rest[i + 1];
  if (page === 'lab.html' && !/(^|&)time=/.test(q)) q += '&time=0';
  if (page === 'lab.html' && !/(^|&)hud=/.test(q)) q += '&hud=0';
  const tab = await context.newPage();
  const errors = [];
  tab.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  tab.on('pageerror', (err) => errors.push(String(err)));

  await tab.goto(`${base}/${page}?${q}`);
  const out = resolve(root, 'agents/shots', `${name}.png`);
  await mkdir(dirname(out), { recursive: true });
  try {
    await tab.waitForFunction(() => window.__labReady === true || window.__pageReady === true, null, {
      timeout: 20000,
    });
    // Let frame timing settle so __labStats is filled in.
    await tab.waitForFunction(() => window.__labStats || window.__pageReady, null, { timeout: 15000 }).catch(() => {});
    await tab.screenshot({ path: out });
    const stats = await tab.evaluate(() => window.__labStats ?? window.__pageStats ?? null);
    console.log(`${out}${stats ? `  ${JSON.stringify(stats)}` : ''}`);
  } catch (err) {
    failed = true;
    console.error(`FAILED ${name}: ${err.message.split('\n')[0]}`);
  }
  for (const e of errors) console.error(`  console error: ${e}`);
  if (errors.length) failed = true;
  await tab.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
