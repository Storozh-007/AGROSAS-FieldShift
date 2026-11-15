// Smooth 60 fps capture: Chrome screencast frames -> constant-rate H.264 clip.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, symlinkSync, rmSync } from 'fs';
import { join } from 'path';
export const { chromium } = createRequire(new URL('../frontend/package.json', import.meta.url))('@playwright/test');
export const W = 1920, H = 1080, FPS = 60;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const launch = () => chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });

// Records `sec` seconds of `page` while `motion` runs; writes a 60 fps mp4 (optionally cropped to a rect).
export async function capture(page, out, sec, motion, crop) {
  const cdp = await page.context().newCDPSession(page); const frames = [];
  cdp.on('Page.screencastFrame', (f) => { frames.push({ ts: f.metadata.timestamp, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  while (!frames.length) await sleep(5);
  const t0 = frames[0].ts; const m = motion ? motion().catch((e) => console.log('motion', e.message)) : null;
  await sleep(sec * 1000 + 150); await m; await cdp.send('Page.stopScreencast'); await cdp.detach().catch(() => {});
  const dir = out + '.frames'; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
  frames.forEach((f, i) => writeFileSync(join(dir, `f${i}.jpg`), Buffer.from(f.data, 'base64')));
  const n = Math.round(sec * FPS); let j = 0;
  for (let k = 0; k < n; k++) { const t = t0 + k / FPS; while (j + 1 < frames.length && frames[j + 1].ts <= t) j++; symlinkSync(join(dir, `f${j}.jpg`), join(dir, String(k).padStart(6, '0') + '.jpg')); }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, '%06d.jpg'), '-vf', (crop ? [`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`] : [`scale=${W}:${H}`]).join(','), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', out]);
  rmSync(dir, { recursive: true, force: true });
  return { frames: frames.length, fps: frames.length / sec };
}

// Smooth helpers driven at ~60 Hz.
export async function glide(p, from, to, ms, press = false) {
  const n = Math.max(2, Math.round(ms / 16)); await p.mouse.move(from[0], from[1]); if (press) await p.mouse.down();
  for (let i = 1; i <= n; i++) { const e = 0.5 - Math.cos(Math.PI * i / n) / 2; await p.mouse.move(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e); await sleep(16); }
  if (press) await p.mouse.up();
}
export async function scrollBy(p, px, ms) { await p.evaluate(({ px, ms }) => new Promise((r) => { const y0 = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms), e = 0.5 - Math.cos(Math.PI * k) / 2; scrollTo(0, y0 + px * e); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), { px, ms }); }
// Camera push-in on an element (compositor zoom of the page).
export async function camera(p, sel, z, ms) { await p.evaluate(({ sel, z, ms }) => { const e = document.querySelector(sel); if (!e) return; const r = e.getBoundingClientRect(); document.body.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2 + scrollY}px`; document.body.animate([{ transform: 'scale(1)' }, { transform: `scale(${z})` }], { duration: ms, easing: 'cubic-bezier(.33,0,.2,1)', fill: 'forwards' }); }, { sel, z, ms }); }
export async function slide(p, sel, from, to, ms) { await p.evaluate(({ sel, from, to, ms }) => new Promise((res) => { const r = document.querySelector(sel); if (!r) return res(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const t0 = performance.now(); let last = null; const f = (t) => { const k = Math.min(1, (t - t0) / ms), e = 0.5 - Math.cos(Math.PI * k) / 2; const v = Math.round(from + (to - from) * e); if (v !== last) { last = v; set.call(r, String(v)); r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); } k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), { sel, from, to, ms }); }
