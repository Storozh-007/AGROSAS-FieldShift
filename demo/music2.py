# Upbeat 128 BPM teaser track: python3 demo/music2.py out.wav HELLO STINGER MAIN OUTRO  (seconds)
# Soft bed under the team's hello, a building stinger, an uplifting drop (I-V-vi-IV), a final hit.
import sys, wave, numpy as np
out_path = sys.argv[1]; HELLO, STING, MAIN, OUTRO = map(float, sys.argv[2:6])
SR = 48000; T = HELLO + STING + MAIN + OUTRO; N = int(SR * T); t = np.arange(N) / SR
BPM = 128; B = 60 / BPM; BAR = 4 * B; rng = np.random.default_rng(3)
mix = np.zeros((N, 2))
def at(s): return int(round(s * SR))
def put(sig, start, pan=0.0, gain=1.0):
    s = at(start); e = min(N, s + len(sig));
    if e <= s: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[s:e, 0] += sig[:e - s] * l * gain * 1.414; mix[s:e, 1] += sig[:e - s] * r * gain * 1.414
def env(n, a=.005, d=.2):
    x = np.arange(n) / SR; return np.minimum(1, x / a) * np.exp(-x / d)
def kick():
    x = np.arange(int(.4 * SR)) / SR; f = 48 + 140 * np.exp(-x * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 9) + .15 * np.exp(-x * 300) * rng.standard_normal(len(x))
def hpnoise(n): w = rng.standard_normal(n); return w - np.convolve(w, np.ones(4) / 4, 'same')
def hat(open_=False): n = int((.22 if open_ else .05) * SR); return hpnoise(n) * env(n, .001, .07 if open_ else .015) * .35
def clap():
    n = int(.3 * SR); x = np.arange(n) / SR; w = rng.standard_normal(n)
    bursts = sum(np.exp(-((x - d) * 400) ** 2) for d in (0, .01, .02)) + np.exp(-x * 18) * .6
    return (w - np.convolve(w, np.ones(8) / 8, 'same')) * bursts * .5
def saw(f, n, det=(-.08, 0, .08)):
    x = np.arange(n) / SR; return sum(2 * ((f * (1 + d / 100) * x + i * .3) % 1) - 1 for i, d in enumerate(det)) / len(det)
def lp(sig, k):
    k = max(1, int(k)); return np.convolve(sig, np.ones(k) / k, 'same')
def impact(g=1.):
    n = int(2.2 * SR); x = np.arange(n) / SR; f = 40 + 90 * np.exp(-x * 7)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 2.2) + lp(rng.standard_normal(n), 12) * np.exp(-x * 4) * .6) * g
def crash():
    n = int(1.6 * SR); return hpnoise(n) * env(n, .002, .5) * .28
def riser(d):
    n = int(d * SR); x = np.arange(n) / SR; k = x / d
    return (lp(rng.standard_normal(n), 12 - 10 * k[0]) * .25 + np.sin(2 * np.pi * np.cumsum(200 + 1800 * k ** 2) / SR) * .06) * k ** 2
# I-V-vi-IV in D major
chords = [[146.8, 185.0, 220.0], [110.0, 138.6, 164.8], [123.5, 146.8, 185.0], [98.0, 123.5, 146.8]]
roots = [73.4, 55.0, 61.7, 49.0]
def chord_at(s): return int(max(0, s - HELLO - STING) // BAR) % 4

# 1) Bed under the hello: warm pad + soft plucks, quiet so voices stay clear.
for b in range(int(np.ceil(HELLO / BAR))):
    s = b * BAR; n = int(min(BAR, HELLO - s) * SR); c = chords[b % 4]
    pad = sum(lp(saw(f, n), 30) for f in c) / 3 * np.minimum(1, np.arange(n) / SR / .4)
    put(pad, s, 0, .08)
    for k in range(8):
        f = c[k % 3] * 2; m = int(B / 2 * SR); put(np.sin(2 * np.pi * f * np.arange(m) / SR) * env(m, .002, .18), s + k * B / 2, (-.4, .4)[k % 2], .05)
put(riser(1.6), HELLO - 1.6, 0, .5)

# 2) Stinger: four slams with a snare build.
S0 = HELLO
for k in range(4):
    put(impact(.55), S0 + k * STING / 4)
    put(kick(), S0 + k * STING / 4, 0, .9)
steps = 16
for k in range(steps):
    put(clap(), S0 + STING * k / steps, 0, .15 + .5 * k / steps)
put(riser(STING), S0, 0, .7)

# 3) Main groove.
M0 = HELLO + STING; nb = int(round(MAIN / B))
for k in range(nb):
    s = M0 + k * B
    put(kick(), s, 0, .95)
    put(hat(True), s + B / 2, .25, .8)
    put(hat(), s + B / 4, -.3, .5); put(hat(), s + 3 * B / 4, .3, .5)
    if k % 2 == 1: put(clap(), s, 0, .8)
for k in range(int(round(MAIN / (B / 2)))):
    s = M0 + k * B / 2; r = roots[chord_at(s)] * (2 if k % 2 else 1); n = int(B / 2 * SR)
    bass = (np.sin(2 * np.pi * r * np.arange(n) / SR) * .8 + lp(saw(r, n, (0,)), 6) * .35) * env(n, .003, .16)
    put(bass, s, 0, .55)
for k in range(int(round(MAIN / (B / 4)))):
    s = M0 + k * B / 4; c = chords[chord_at(s)]; f = c[[0, 1, 2, 1][k % 4]] * 4; n = int(B / 4 * SR)
    put(lp(saw(f, n), 3) * env(n, .002, .09), s, (-.5, .5)[k % 2], .09)
for b in range(int(round(MAIN / BAR))):
    s = M0 + b * BAR; n = int(BAR * SR); c = chords[b % 4]
    pad = sum(lp(saw(f * 2, n), 18) for f in c) / 3
    side = np.ones(n); x = np.arange(n) / SR
    for q in range(4): i0 = int(q * B * SR); m = min(n - i0, int(.25 * SR)); side[i0:i0 + m] = .3 + .7 * (1 - np.exp(-x[:m] * 14))
    put(pad * side, s, 0, .12)
    if b % 2 == 0: put(crash(), s, 0, .9)
put(impact(1.0), M0)
# lead hook on bars 2 and 4 of each phrase
hook = [4, 0, 2, 4, 5, 4, 2, 0]; scale = [293.7, 329.6, 370.0, 392.0, 440.0, 493.9, 554.4]
for b in range(int(round(MAIN / BAR))):
    if b % 2 == 0: continue
    for i, d in enumerate(hook):
        s = M0 + b * BAR + i * B / 2; n = int(B / 2 * SR); f = scale[d] * 2
        put(lp(saw(f, n), 2) * env(n, .004, .14), s, .15, .07)

# 4) Outro: hit, held chord, fade.
O0 = M0 + MAIN; put(impact(1.1), O0); put(crash(), O0, 0, 1.2)
n = int(OUTRO * SR); x = np.arange(n) / SR
put(sum(lp(saw(f * 2, n), 10) for f in chords[0]) / 3 * np.exp(-x * .7), O0, 0, .25)
fade = np.ones(N); f0 = at(T - .8); fade[f0:] = np.linspace(1, 0, N - f0); mix *= fade[:, None]
mix = np.tanh(mix * 1.2); mix /= np.max(np.abs(mix)) / .9
with wave.open(out_path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('music', round(T, 2), 's')
