// ~35 s teaser at 60 fps: team hello -> stinger -> 11 product shots on the beat -> end card.
// node ../demo/teaser.mjs en|uk <hello.mov> <background.jpg>   (run from frontend/)
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { launch, capture, glide, camera, scrollBy, slide, sleep, W, H } from './cap.mjs';
import { FIELD } from './scenes.mjs';

const LANG = process.argv[2] === 'uk' ? 'uk' : 'en'; const HELLO = process.argv[3]; const BG = process.argv[4];
const BASE = process.env.BASE || 'http://localhost:8080'; const OUT = new URL('.', import.meta.url).pathname;
const WORK = join(OUT, `.work-teaser-${LANG}`); rmSync(WORK, { recursive: true, force: true }); mkdirSync(WORK, { recursive: true });
const BAR = 4 * 60 / 128, STING = 2 * BAR, OUTRO = 2 * BAR; const L = (en, uk) => (LANG === 'uk' ? uk : en);
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const HELLO_SEC = dur(HELLO);
const bg = 'data:image/jpeg;base64,' + readFileSync(BG).toString('base64');
const FONT = `font-family:-apple-system,'SF Pro Display',system-ui,sans-serif`;
const card = (inner, css) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#030a16;${FONT}}
.bg{position:absolute;inset:0;background:url(${bg}) center/cover;animation:kb 5s linear both}@keyframes kb{from{transform:scale(1.04)}to{transform:scale(1.16)}}
.veil{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(3,10,22,.3),rgba(3,10,22,.85))}
.flash{position:absolute;inset:0;background:#fff;animation:out .4s both}@keyframes out{to{opacity:0}}
${css}</style></head><body><div class="bg"></div><div class="veil"></div>${inner}<div class="flash"></div></body></html>`;
const words = [L('Satellites.', 'Супутники.'), L('Climate.', 'Клімат.'), L('Soil.', 'Ґрунт.'), L('Decisions.', 'Рішення.')];
const q = STING / 4;
const STINGER = card(words.map((w, i) => `<div class="w${i === 3 ? ' last' : ''}" style="animation-delay:${(i * q).toFixed(3)}s">${w}</div>`).join(''), `
.w{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#f2fbf4;font-size:190px;font-weight:800;letter-spacing:-6px;text-shadow:0 0 70px rgba(111,227,255,.55);opacity:0;animation:slam ${q.toFixed(3)}s cubic-bezier(.2,.9,.2,1) both}
.w.last{color:#b6ff47;text-shadow:0 0 80px rgba(182,255,71,.6);animation-name:slamlast}
@keyframes slam{0%{opacity:0;transform:scale(1.7);filter:blur(16px)}18%{opacity:1;transform:scale(1);filter:blur(0)}85%{opacity:1;transform:scale(.95)}100%{opacity:0;transform:scale(.9)}}
@keyframes slamlast{0%{opacity:0;transform:scale(1.7);filter:blur(16px)}18%{opacity:1;transform:scale(1);filter:blur(0)}100%{opacity:1;transform:scale(1.08)}}`);
const ENDCARD = card(`<div class="box"><div class="eb">TEAM ASTROLOGY · NASA SPACE APPS 2026 · FIELD SHIFT</div><div class="logo">AGROSAS <span>OS</span></div><div class="tag">${L('From space to soil.', 'Від космосу до ґрунту.')}</div><div class="sub">${L('Open NASA data → decisions for a real field', 'Відкриті дані NASA → рішення для реального поля')}</div></div>`, `
.box{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center}
.eb{color:#6fe3ff;font-size:28px;font-weight:700;letter-spacing:7px;animation:up .8s .45s both}
.logo{color:#f2fbf4;font-size:200px;font-weight:800;letter-spacing:-6px;line-height:1;text-shadow:0 0 80px rgba(111,227,255,.45);animation:zoom 1s cubic-bezier(.2,.9,.2,1) both}.logo span{color:#b6ff47}
.tag{color:#b6ff47;font-size:76px;font-weight:700;text-shadow:0 0 50px rgba(182,255,71,.45);animation:up .8s .3s both}
.sub{color:#cfe6ea;font-size:34px;animation:up .8s .6s both}
@keyframes zoom{from{opacity:0;transform:scale(1.5);filter:blur(16px)}}@keyframes up{from{opacity:0;transform:translateY(40px)}}`);
const LOWER = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;width:${W}px;height:${H}px;${FONT}}
.lt{position:absolute;left:72px;bottom:80px;display:flex;flex-direction:column;gap:12px}
.lt b{align-self:flex-start;background:#b6ff47;color:#06131f;font-size:26px;font-weight:800;letter-spacing:6px;padding:10px 18px;border-radius:8px}
.lt h1{margin:0;color:#fff;font-size:64px;font-weight:800;letter-spacing:-1px;text-shadow:0 4px 30px rgba(0,0,0,.8)}
.lt p{margin:0;color:#dff3f6;font-size:30px;font-weight:600;text-shadow:0 2px 16px rgba(0,0,0,.9)}</style></head><body><div class="lt"><b>TEAM ASTROLOGY</b><h1>${L('Hello from Dnipro!', 'Привіт із Дніпра!')}</h1><p>Oleksandr Yaroslavskyi · Ivan Shvets · Danylo Storozhenko</p></div></body></html>`;

async function overlay(page, label, head, n) {
  await page.evaluate(({ label, head, n, FONT }) => {
    const st = document.createElement('style'); st.textContent = `.lang-switch,.as-fab{opacity:0!important}
#tz{position:fixed;left:72px;bottom:72px;z-index:2147483647;${FONT};pointer-events:none}
#tz b{display:inline-block;background:#b6ff47;color:#06131f;font-size:22px;font-weight:800;letter-spacing:5px;padding:8px 16px;border-radius:8px;animation:tzl .4s cubic-bezier(.2,.9,.2,1) both}
#tz h1{margin:16px 0 0;color:#fff;font-size:80px;font-weight:800;letter-spacing:-2px;line-height:1.02;text-shadow:0 6px 40px rgba(0,0,0,.85),0 0 2px #000;animation:tzh .5s .06s cubic-bezier(.2,.9,.2,1) both}
#tzv{position:fixed;inset:0;z-index:2147483646;pointer-events:none;background:linear-gradient(0deg,rgba(3,10,22,.88) 0%,rgba(3,10,22,0) 40%)}
#tzn{position:fixed;right:72px;top:56px;z-index:2147483647;${FONT};color:#6fe3ff;font-size:24px;font-weight:700;letter-spacing:4px;text-shadow:0 2px 12px #000}
#tzbar{position:fixed;left:0;top:0;height:6px;z-index:2147483647;background:linear-gradient(90deg,#6fe3ff,#b6ff47);animation:tzb 1.875s linear both;transform-origin:left}
@keyframes tzb{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes tzl{from{opacity:0;transform:translateX(-60px)}}@keyframes tzh{from{opacity:0;transform:translateY(50px);filter:blur(8px)}}`;
    document.head.appendChild(st);
    for (const [id, html] of [['tzv', ''], ['tz', `<b>${label}</b><h1>${head}</h1>`], ['tzn', n], ['tzbar', '']]) { const d = document.createElement('div'); d.id = id; d.className = 'notranslate'; d.setAttribute('translate', 'no'); d.innerHTML = html; document.documentElement.appendChild(d); }
  }, { label, head, n, FONT });
}

const browser = await launch();
async function page() { const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 }); await ctx.addInitScript((lang) => { localStorage.setItem('fieldshift-language', lang); sessionStorage.removeItem('agrosas-assistant-v1'); }, LANG); return ctx.newPage(); }
const go = (p, path) => p.goto(BASE + path, { waitUntil: 'domcontentloaded' });
const to = async (p, sel, off) => { await p.locator(sel).first().waitFor({ timeout: 90000 }); await p.locator(sel).first().evaluate((e, o) => scrollTo(0, e.getBoundingClientRect().top + scrollY + o), off); };
const tab = async (p, n) => { await p.locator(`.operations-tabs button:nth-child(${n})`).first().click(); await sleep(1500); };
const lab = async (p) => { await go(p, `/farm-lab?field=${FIELD}`); await p.locator('.threat').first().waitFor({ timeout: 90000 }); };
const chat = async (p, q) => { await p.addStyleTag({ content: '.as-fab{opacity:1!important}.as-panel{animation:none!important;transform:scale(1.55);transform-origin:right bottom;right:60px!important;bottom:28px!important;z-index:1001!important;box-shadow:0 0 0 2000px rgba(3,10,22,.55),0 0 60px rgba(111,227,255,.25)!important}' }); await p.locator('.as-fab').click(); await sleep(500); await p.locator('.as-input textarea').fill(q); await p.keyboard.press('Enter'); };
const ms = BAR * 1000;
const SHOTS = [
  ['globe', L('LIVE ORBITS', 'ЖИВІ ОРБІТИ'), L('Real satellites. Right now.', 'Справжні супутники. Зараз.'), async (p) => { await go(p, '/dashboard'); await to(p, '[data-testid=farm-earth]', -40); await sleep(6000); }, async (p) => { camera(p, '[data-testid=farm-earth] canvas', 1.2, ms); await glide(p, [1180, 520], [760, 580], ms - 100, true); }],
  ['solar', L('SOLAR SYSTEM', 'СОНЯЧНА СИСТЕМА'), L('Today’s real sky.', 'Справжнє небо сьогодні.'), async (p) => { await go(p, '/dashboard'); await to(p, '[data-testid=farm-earth]', -40); await sleep(2500); await p.locator('.farm-earth-tools button').first().click(); await sleep(5500); }, async (p) => { await glide(p, [700, 500], [1150, 470], ms - 100, true); }],
  ['threats', L('FIELD PASSPORT', 'ПАСПОРТ ПОЛЯ'), L('Know what threatens your field.', 'Знайте, що загрожує полю.'), async (p) => { await lab(p); await to(p, '.threat', -280); await sleep(1200); }, async (p) => { camera(p, '.threat-grid', 1.32, ms); await scrollBy(p, 90, ms); }],
  ['scenarios', L('CLIMATE SCENARIOS', 'КЛІМАТИЧНІ СЦЕНАРІЇ'), L('Stress-test it to 2050.', 'Перевірте план до 2050.'), async (p) => { await lab(p); await to(p, '.scenario-grid', -240); await sleep(1000); }, async (p) => { camera(p, '.scenario-grid', 1.26, ms); await sleep(250); await p.locator('.scenario-grid button').nth(5).click(); await sleep(700); await p.locator('.scenario-grid button').nth(6).click(); }],
  ['zones', L('3D FIELD ZONES', '3D-ЗОНИ ПОЛЯ'), L('Real terrain. Real risk.', 'Справжній рельєф. Справжній ризик.'), async (p) => { await lab(p); await tab(p, 2); await to(p, '.zones-stage', -150); await sleep(3500); }, async (p) => { await glide(p, [820, 470], [1180, 430], ms - 100, true); }],
  ['evidence', 'SENTINEL-2', L('See exactly what changed.', 'Видно, що саме змінилося.'), async (p) => { await lab(p); await tab(p, 5); await to(p, '.snap-swipe', -160); await sleep(3000); }, async (p) => { await slide(p, '.snap-swipe input', 12, 92, ms - 150); }],
  ['plan', L('ACTION PLAN', 'ПЛАН ДІЙ'), L('72 hours. Step by step.', '72 години. Крок за кроком.'), async (p) => { await lab(p); await tab(p, 3); await to(p, '.ab-timeline', -200); await sleep(1500); }, async (p) => { camera(p, '.ab-task', 1.32, ms); await scrollBy(p, 120, ms); }],
  ['climate', L('TIME MACHINE', 'МАШИНА ЧАСУ'), L('30 years above your field.', '30 років над вашим полем.'), async (p) => { await go(p, '/climate'); await to(p, '.stripes-card', -240); await sleep(1500); }, async (p) => { const [a, b] = await p.evaluate(() => { const r = document.querySelector('.ctm-year input[type=range]'); return r ? [Number(r.min), Number(r.max)] : [0, 0]; }); camera(p, '.ctm-year', 1.18, ms); await slide(p, '.ctm-year input[type=range]', a, b, ms - 150); }],
  ['fleet', L('THE FLEET', 'ФЛОТ'), L('7 565 Starlinks. 12 science satellites.', '7 565 Starlink. 12 наукових супутників.'), async (p) => { await go(p, '/missions?mission=smap'); await to(p, '.mstats', -60); await p.locator('.mstats-kpis b').first().waitFor({ timeout: 60000 }); await sleep(2500); }, async (p) => { camera(p, '.mstats-kpis', 1.32, ms); }],
  ['assistant', L('AI AGRONOMIST', 'АГРОНОМ-АСИСТЕНТ'), L('Ask. Get real numbers.', 'Запитайте — отримайте цифри.'), async (p) => { await lab(p); await chat(p, L('What threatens my field?', 'Що загрожує моєму полю?')); await sleep(3200); }, async (p) => { await sleep(ms); }],
  ['create', L('FIELD BY CHAT', 'ПОЛЕ ЧЕРЕЗ ЧАТ'), L('One sentence → a mapped field.', 'Одне речення → поле на карті.'), async (p) => { await lab(p); await chat(p, L('Create a 40 ha field near Vinnytsia', 'Створи поле 40 га біля Вінниці')); await p.locator('.fdc').waitFor({ timeout: 60000 }); await sleep(1500); await p.locator('.fdc').evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(800); }, async (p) => { const r = await p.locator('.fdc').boundingBox(); if (r) await glide(p, [r.x + r.width * .3, r.y + r.height * .4], [r.x + r.width * .7, r.y + r.height * .5], ms - 100); }],
];

const clips = [];
// Hello clip: unmirror the selfie, 60 fps, lower third.
{ const p = await page(); await p.setContent(LOWER); await p.screenshot({ path: join(WORK, 'lower.png'), omitBackground: true }); await p.context().close();
  const out = join(WORK, 'hello.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', HELLO, '-loop', '1', '-t', String(HELLO_SEC), '-i', join(WORK, 'lower.png'), '-filter_complex',
    `[0:v]hflip,scale=${W}:${H},fps=60,setsar=1,eq=saturation=1.08:contrast=1.04[v];[1:v]format=rgba,fade=t=in:st=0.5:d=0.5:alpha=1,fade=t=out:st=${(HELLO_SEC - 1.2).toFixed(2)}:d=0.5:alpha=1[lt];[v][lt]overlay=0:0:shortest=1,fade=t=in:st=0:d=0.35[vo]`,
    '-map', '[vo]', '-map', '0:a:0', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', out]);
  clips.push(out); console.log('hello', HELLO_SEC.toFixed(2)); }
async function cardClip(id, html, sec) { const p = await page(); await p.setContent(html); const out = join(WORK, id + '.mp4'); const r = await capture(p, out, sec, null); await p.context().close(); console.log(id, r.fps.toFixed(0) + 'fps'); return out; }
clips.push(await cardClip('stinger', STINGER, STING));
for (let i = 0; i < SHOTS.length; i++) {
  const [id, label, head, prep, motion] = SHOTS[i]; const p = await page();
  try { await prep(p); } catch (e) { console.log(id, 'prepare', e.message); }
  await overlay(p, label, head, `${String(i + 1).padStart(2, '0')} / ${SHOTS.length}`);
  const out = join(WORK, id + '.mp4'); const r = await capture(p, out, BAR, () => motion(p)); await p.context().close(); clips.push(out); console.log(id, r.fps.toFixed(0) + 'fps');
}
clips.push(await cardClip('outro', ENDCARD, OUTRO));
await browser.close();

// Soundtrack sized to the cut, then mix with the team's own voices.
const MAIN = SHOTS.length * BAR; const music = join(WORK, 'music.wav');
execFileSync('python3', [join(OUT, 'music2.py'), music, HELLO_SEC.toFixed(3), String(STING), String(MAIN), String(OUTRO)], { stdio: 'inherit' });
const inputs = clips.flatMap((c) => ['-i', c]); inputs.push('-i', music);
const v = clips.map((_, k) => `[${k}:v]settb=AVTB,fps=60,setpts=PTS-STARTPTS[v${k}]`).join(';') + ';' + clips.map((_, k) => `[v${k}]`).join('') + `concat=n=${clips.length}:v=1:a=0[v]`;
const a = `[0:a]aresample=48000,volume=1.25,apad[voice];[${clips.length}:a]aresample=48000[mus];[voice][mus]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95[a]`;
const total = HELLO_SEC + STING + MAIN + OUTRO;
for (const [suffix, vargs] of [['', ['-crf', '17', '-preset', 'slow']], ['-slides', ['-b:v', '4000k', '-maxrate', '4500k', '-bufsize', '9000k', '-preset', 'slow']]]) {
  const outFile = join(OUT, `AGROSAS-OS-teaser-${LANG}${suffix}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', v + ';' + a, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', ...vargs, '-pix_fmt', 'yuv420p', '-r', '60', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), '-movflags', '+faststart', outFile], { stdio: 'inherit' });
  console.log('DONE', outFile);
}
