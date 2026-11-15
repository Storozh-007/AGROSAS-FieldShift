// Records a narrated product tour: node demo/record.mjs en|uk  (run from frontend/ so @playwright/test resolves)
import { createRequire } from 'module';
const { chromium } = createRequire(new URL('../frontend/package.json', import.meta.url))('@playwright/test');
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, readdirSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SCENES, FIELD } from './scenes.mjs';

const LANG = process.argv[2] === 'uk' ? 'uk' : 'en';
const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = new URL('.', import.meta.url).pathname;
const WORK = join(OUT, `.work-${LANG}`);
const VOICE = LANG === 'uk' ? 'Lesya' : 'Samantha';
rmSync(WORK, { recursive: true, force: true }); mkdirSync(WORK, { recursive: true });

// 1. Voice-over per scene; scene length follows the narration.
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
for (const s of SCENES) { const f = join(WORK, `${s.id}.aiff`); execFileSync('say', ['-v', VOICE, '-r', LANG === 'uk' ? '172' : '178', '-o', f, s[LANG]]); s.audio = f; s.sec = dur(f); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
// Warm caches (passport, zones, snapshot) so the recording never waits on first-time calculations.
{ const p = await browser.newPage(); for (const path of ['/api/backend/fields/' + FIELD + '/site', '/api/backend/fields/' + FIELD + '/zones', '/api/backend/fields/' + FIELD + '/monitoring/snapshot', '/api/backend/fields/' + FIELD + '/weather-detail']) { try { await p.request.get(BASE + path, { timeout: 120000 }); } catch {} } await p.close(); }

const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, recordVideo: { dir: WORK, size: { width: 1600, height: 900 } } });
await ctx.addInitScript((lang) => { localStorage.setItem('fieldshift-language', lang); sessionStorage.removeItem('agrosas-assistant-v1'); }, LANG);
const page = await ctx.newPage(); const t0 = Date.now();

async function caption(s, i) {
  await page.evaluate(({ title, text, i, n }) => {
    let el = document.getElementById('demo-cap');
    if (!el) { el = document.createElement('div'); el.id = 'demo-cap'; el.className = 'notranslate'; el.setAttribute('translate', 'no'); document.body.appendChild(el);
      const st = document.createElement('style'); st.textContent = `#demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;width:min(1180px,92vw);background:linear-gradient(135deg,#06131ff2,#0b2a1ef2);border:1px solid #b6ff4766;border-radius:18px;padding:18px 26px;color:#eaf6ee;font:500 21px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 18px 50px #000b;backdrop-filter:blur(10px);animation:cap .5s ease}#demo-cap b{display:block;font:700 13px ui-monospace,monospace;letter-spacing:2px;text-transform:uppercase;color:#b6ff47;margin-bottom:6px}#demo-cap i{float:right;font:600 12px ui-monospace,monospace;color:#7fa3b0;font-style:normal}@keyframes cap{from{opacity:0;transform:translate(-50%,16px)}}.lang-switch,.as-fab{opacity:.0!important}`; document.head.appendChild(st); }
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    el.innerHTML = `<i>${i + 1} / ${n}</i><b>${title}</b>${text}`;
  }, { title: s.title[LANG], text: s[LANG], i, n: SCENES.length });
}
const go = async (path) => { await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await sleep(2500); };
const click = async (sel) => { try { await page.locator(sel).first().click({ timeout: 8000 }); } catch {} };
const scrollTo = async (sel) => { try { await page.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 15000 }); } catch {} };
const smooth = async (px, steps = 12) => { for (let k = 0; k < steps; k++) { await page.mouse.wheel(0, px / steps); await sleep(90); } };
const tab = async (n) => { await click(`.operations-tabs button:nth-child(${n})`); await sleep(1500); };
const ask = async (q) => { await click('.as-input textarea'); await page.locator('.as-input textarea').fill(q); await page.keyboard.press('Enter'); };

const ACTIONS = {
  intro: async () => { await go('/dashboard'); await sleep(4000); },
  globe: async (ms) => { await scrollTo('[data-testid=farm-earth]'); await page.mouse.move(800, 450); await sleep(ms * .5); await page.mouse.move(980, 380, { steps: 20 }); },
  solar: async (ms) => { await click('.farm-earth-tools button:first-child'); await sleep(ms - 600); await page.keyboard.press('Escape'); },
  rotation: async (ms) => { await go(`/farm-lab?field=${FIELD}`); await page.locator('.threat').first().waitFor({ timeout: 90000 }).catch(() => {}); await scrollTo('.threat'); await sleep(ms * .4); await smooth(500); },
  scenarios: async (ms) => { await scrollTo('.scenario-grid'); await sleep(ms * .35); await scrollTo('.strategy-tabs'); await sleep(ms * .3); await smooth(600); },
  zones: async () => { await page.evaluate(() => scrollTo(0, 0)); await tab(2); await page.locator('.zone-table, .zones-head').first().waitFor({ timeout: 60000 }).catch(() => {}); await sleep(1500); return async () => { await smooth(450); await sleep(1500); await smooth(450); }; },
  plan: async () => { await page.evaluate(() => scrollTo(0, 0)); await tab(3); await page.locator('.ab-task').first().waitFor({ timeout: 60000 }).catch(() => {}); await scrollTo('.ab-timeline'); return async (ms) => { await sleep(ms * .45); await smooth(500); }; },
  farm: async () => { await page.evaluate(() => scrollTo(0, 0)); await tab(4); await page.locator('.lab-scene canvas').first().waitFor({ timeout: 60000 }).catch(() => {}); await sleep(1500); return async (ms) => { await sleep(ms * .3); await scrollTo('.sky'); await sleep(ms * .3); await scrollTo('.energy24'); }; },
  evidence: async () => { await page.evaluate(() => scrollTo(0, 0)); await tab(5); await page.locator('.snap-card').first().waitFor({ timeout: 90000 }).catch(() => {}); await scrollTo('.snap-cards'); await sleep(1200);
    const swipe = async (from, to, step) => { for (let v = from; step > 0 ? v <= to : v >= to; v += step) { await page.evaluate((x) => { const r = document.querySelector('.snap-swipe input'); if (!r) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, String(x)); r.dispatchEvent(new Event('input', { bubbles: true })); }, v); await sleep(70); } };
    return async (ms) => { await sleep(ms * .3); await scrollTo('.snap-swipe'); await swipe(50, 95, 3); await swipe(95, 10, -3); await swipe(10, 50, 3); }; },
  climate: async (ms) => { await go('/climate'); await page.locator('.stripes').waitFor({ timeout: 90000 }).catch(() => {}); await scrollTo('.ctm'); await sleep(ms * .4); await smooth(500); },
  missions: async (ms) => { await go('/missions?mission=smap'); await sleep(ms * .45); await scrollTo('.mstats'); },
  news: async (ms) => { await go('/network'); await click('button:has-text("Events"), button:has-text("Події"), button:has-text("News"), button:has-text("Новини")'); await scrollTo('.nf'); await sleep(ms * .4); await smooth(500); },
  assistant: async () => { await go(`/farm-lab?field=${FIELD}`); await page.locator('.threat').first().waitFor({ timeout: 90000 }).catch(() => {}); await page.addStyleTag({ content: '.as-fab{opacity:1!important}' }); await click('.as-fab'); await sleep(800); await ask(LANG === 'uk' ? 'Що загрожує моєму полю?' : 'What threatens my field?'); },
  create: async () => { await page.locator('.as-next').waitFor({ timeout: 90000 }).catch(() => {}); await sleep(1500); await ask(LANG === 'uk' ? 'Створи поле 40 га біля Вінниці, сіяли пшеницю і соняшник' : 'Create a 40 ha field near Vinnytsia'); await page.locator('.fdc').waitFor({ timeout: 30000 }).catch(() => {}); await sleep(1500); await scrollTo('.fdc'); },
  outro: async () => { await go('/dashboard'); },
};

const timeline = [];
for (let i = 0; i < SCENES.length; i++) {
  const s = SCENES[i]; const ms = s.sec * 1000;
  const act = ACTIONS[s.id]; const start = Date.now();
  // Navigation-type actions run first, then the caption and voice start together.
  const navigates = !['globe', 'solar', 'scenarios'].includes(s.id);
  let post = null; if (navigates) { post = await act(ms).catch(() => null); }
  await caption(s, i); timeline.push({ id: s.id, at: (Date.now() - t0) / 1000, audio: s.audio, sec: s.sec });
  const t = Date.now(); if (!navigates) await act(ms).catch(() => {}); else if (typeof post === 'function') await post(ms).catch(() => {});
  const left = ms + 900 - (Date.now() - t); if (left > 0) await sleep(left);
  console.log(`${LANG} ${s.id} ${((Date.now() - start) / 1000).toFixed(1)}s`);
}
await sleep(1500); const total = (Date.now() - t0) / 1000;
await page.close(); await ctx.close(); await browser.close();

// 2. Mix voice-over onto the video at the scene start times and encode MP4.
const webm = readdirSync(WORK).find((f) => f.endsWith('.webm')); renameSync(join(WORK, webm), join(WORK, 'screen.webm'));
const inputs = ['-i', join(WORK, 'screen.webm')]; const parts = [];
timeline.forEach((x, k) => { inputs.push('-i', x.audio); const d = Math.round(x.at * 1000) + 250; parts.push(`[${k + 1}:a]aresample=48000,adelay=${d}|${d}[a${k}]`); });
const filter = parts.join(';') + ';' + timeline.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${timeline.length}:normalize=0,volume=1.6[aout]`;
const outFile = join(OUT, `AGROSAS-OS-demo-${LANG}.mp4`);
execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-t', String(total), '-movflags', '+faststart', outFile], { stdio: 'inherit' });
writeFileSync(join(WORK, 'timeline.json'), JSON.stringify(timeline, null, 1));
console.log('DONE', outFile, total.toFixed(0) + 's');
