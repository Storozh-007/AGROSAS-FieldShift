// Looping 60 fps feature clips for the pitch deck: node ../demo/clips.mjs <outdir>  (run from frontend/)
import { execFileSync } from 'child_process';
import { join } from 'path';
import { launch, capture, glide, slide, sleep, W, H } from './cap.mjs';
import { FIELD } from './scenes.mjs';
const OUT = process.argv[2]; const BASE = process.env.BASE || 'http://localhost:8080';
const b = await launch();
async function page() { const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 }); await ctx.addInitScript(() => { localStorage.setItem('fieldshift-language', 'en'); sessionStorage.removeItem('agrosas-assistant-v1'); }); const p = await ctx.newPage(); await p.addInitScript(() => {}); return p; }
const hide = (p) => p.addStyleTag({ content: '.lang-switch,.as-fab{opacity:0!important}' });
const lab = async (p) => { await p.goto(`${BASE}/farm-lab?field=${FIELD}`, { waitUntil: 'domcontentloaded' }); await p.locator('.threat').first().waitFor({ timeout: 90000 }); await hide(p); };
const tab = async (p, n) => { await p.locator(`.operations-tabs button:nth-child(${n})`).first().click(); await sleep(1500); };
const to = async (p, sel, off) => { await p.locator(sel).first().waitFor({ timeout: 90000 }); await p.locator(sel).first().evaluate((e, o) => scrollTo(0, e.getBoundingClientRect().top + scrollY + o), off); };
// 16:9 crop around an element, padded, kept inside the viewport.
async function box(p, sel, pad = 24) { const r = await (typeof sel === 'string' ? p.locator(sel).first() : sel).boundingBox(); let w = r.width + pad * 2, h = r.height + pad * 2; if (w / h > 16 / 9) h = w * 9 / 16; else w = h * 16 / 9; w = Math.min(W, w); h = Math.min(H, w * 9 / 16); let x = r.x + r.width / 2 - w / 2, y = r.y + r.height / 2 - h / 2; x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y)); const ev = (v) => Math.round(v / 2) * 2; return { x: ev(x), y: ev(y), w: ev(w), h: ev(h) }; }
// Encode for the deck: 1280 wide, under 20 MB, still frame for thumbnails and exports.
function finish(raw, name) { const mp4 = join(OUT, name + '.mp4'); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', 'scale=1280:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '60', '-an', '-movflags', '+faststart', mp4]); execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.5', '-i', mp4, '-frames:v', '1', '-q:v', '3', join(OUT, name + '.jpg')]); console.log(name); }

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = (n) => !ONLY || ONLY.includes(n);
if (want('scenarios')) { // Climate scenarios: pick scenarios one after another, results re-rank.
  const p = await page(); await lab(p); await to(p, '.scenario-grid', -120); await sleep(1500); const c = await box(p, '.scenario-grid', 40); const crop = { ...c, y: Math.max(0, c.y - 60) };
  const raw = join(OUT, 'raw-scenarios.mp4'); await capture(p, raw, 8, async () => { for (const n of [4, 5, 6, 0]) { await sleep(400); const btn = p.locator('.scenario-grid button').nth(n); const bb = await btn.boundingBox(); await glide(p, [bb.x - 60, bb.y + bb.height + 40], [bb.x + bb.width / 2, bb.y + bb.height / 2], 600); await btn.click(); await sleep(900); } }, crop); finish(raw, 'clip-scenarios'); await p.context().close(); }
if (want('zones')) { // 3D zones: orbit the terrain there and back so the loop closes.
  const p = await page(); await lab(p); await tab(p, 2); await to(p, '.zones-stage', -60); await sleep(4000); const crop = await box(p, '.zones-stage', 0);
  const cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
  const raw = join(OUT, 'raw-zones.mp4'); await capture(p, raw, 7, async () => { await glide(p, [cx - 200, cy], [cx + 200, cy - 30], 3300, true); await glide(p, [cx + 200, cy - 30], [cx - 200, cy], 3300, true); }, crop); finish(raw, 'clip-zones'); await p.context().close(); }
if (want('evidence')) { // Sentinel-2 before/after swipe, back and forth.
  const p = await page(); await lab(p); await tab(p, 5); await to(p, '.snap-swipe', -60); await sleep(3500); const crop = await box(p, p.locator('.snap-swipe').first().locator('xpath=..'), 10);
  const raw = join(OUT, 'raw-evidence.mp4'); await capture(p, raw, 7, async () => { await sleep(300); await slide(p, '.snap-swipe input', 50, 92, 1500); await slide(p, '.snap-swipe input', 92, 8, 3000); await slide(p, '.snap-swipe input', 8, 50, 1500); }, crop); finish(raw, 'clip-evidence'); await p.context().close(); }
if (want('assistant')) { // Assistant answering with the field's real numbers.
  const p = await page(); await lab(p); await p.addStyleTag({ content: '.as-fab{opacity:1!important}.as-panel{animation:none!important;transform:scale(1.5);transform-origin:center center;right:auto!important;left:50%!important;bottom:auto!important;top:50%!important;translate:-50% -50%;z-index:1001!important;box-shadow:0 0 0 3000px rgba(3,10,22,.7),0 0 60px rgba(111,227,255,.3)!important}' });
  await p.locator('.as-fab').click(); await sleep(600); await p.locator('.as-input textarea').fill('What threatens my field?'); await sleep(300);
  const raw = join(OUT, 'raw-assistant.mp4'); await capture(p, raw, 9, async () => { await sleep(400); await p.keyboard.press('Enter'); }); finish(raw, 'clip-assistant'); await p.context().close(); }
await b.close();
