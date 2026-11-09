"""
RECLAIM sounds, generated in code (no recordings, so no licences to worry about).

Short effects (played with SoundPool):
  sfx_pop        - a soft bubble pop (tapping Pip)
  sfx_chime      - a warm three-note chime (wins: focus done, workout done, intro)
  sfx_ding       - one soft bell (the mindful pause appears)
  sfx_breath_in  - a slow rising swell (breathe in)
  sfx_breath_out - a slow falling swell (breathe out)
Focus soundscapes (seamless loops, played by the media service):
  scape_brown - brown noise
  scape_rain  - soft rain: filtered noise with gentle drops
  scape_pad   - a slow, soft chord pad

Usage: python make_sounds.py <android res/raw dir> [--all]
Only sfx_pop ships today; --all also writes the others (kept for later exploration).
Standard library only (wave, math, random).
"""
import math
import os
import random
import struct
import sys
import wave

RATE = 22050
OUT = sys.argv[1]
random.seed(7)  # same sounds every run


def write(name, samples, peak=0.9):
    m = max(1e-9, max(abs(s) for s in samples))
    k = peak / m
    data = b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32767)) for s in samples)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)
    print(f"{name}: {len(samples) / RATE:.1f}s")


def env(i, n, attack, release):
    """Linear attack, exponential-ish release, in samples."""
    if i < attack:
        return i / attack
    left = n - i
    if left < release:
        return (left / release) ** 2
    return 1.0


def tone(freq, secs, attack=0.005, release=0.3, harmonics=((1, 1.0),), decay=0.0):
    n = int(secs * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        v = sum(a * math.sin(2 * math.pi * freq * h * t) for h, a in harmonics)
        v *= env(i, n, int(attack * RATE), int(release * RATE))
        if decay:
            v *= math.exp(-decay * t)
        out.append(v)
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] if i < len(t) else 0 for t in tracks) for i in range(n)]


def delay(track, secs):
    return [0.0] * int(secs * RATE) + track


# ---------------------------------------------------------------- effects
def pop():
    n = int(0.12 * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        f = 900 * math.exp(-t * 18) + 280  # pitch drops: a bubble
        out.append(math.sin(2 * math.pi * f * t) * math.exp(-t * 30))
    return out


BELL = ((1, 1.0), (2.01, 0.35), (3.02, 0.12))


def chime():
    c5, e5, g5 = 523.25, 659.25, 783.99
    return mix(
        tone(c5, 1.6, release=0.2, harmonics=BELL, decay=2.6),
        delay(tone(e5, 1.5, release=0.2, harmonics=BELL, decay=2.6), 0.11),
        delay(tone(g5, 1.4, release=0.2, harmonics=BELL, decay=2.4), 0.22),
    )


def ding():
    return tone(880.0, 1.2, release=0.25, harmonics=BELL, decay=3.0)


def swell(f0, f1, secs):
    n = int(secs * RATE)
    out = []
    phase = 0.0
    for i in range(n):
        x = i / n
        f = f0 + (f1 - f0) * x
        phase += 2 * math.pi * f / RATE
        shape = math.sin(math.pi * x) ** 1.5  # rises and falls smoothly
        out.append((math.sin(phase) + 0.3 * math.sin(2 * phase)) * shape)
    return out


# ---------------------------------------------------------------- loops
def crossfade_loop(samples, fade_secs=1.5):
    """Make the end flow into the start: fade the tail over the head."""
    f = int(fade_secs * RATE)
    body = samples[: len(samples) - f]
    tail = samples[len(samples) - f :]
    for i in range(f):
        a = i / f
        body[i] = body[i] * a + tail[i] * (1 - a)
    return body


def brown(secs):
    out, v = [], 0.0
    for _ in range(int((secs + 1.5) * RATE)):
        v += random.uniform(-1, 1) * 0.02
        v *= 0.998  # keep it centred
        out.append(v)
    return crossfade_loop(out)


def rain(secs):
    n = int((secs + 1.5) * RATE)
    out = []
    lp = 0.0
    hp_prev_in = hp_prev_out = 0.0
    drops = []
    for i in range(n):
        w = random.uniform(-1, 1)
        lp += 0.35 * (w - lp)  # soften the hiss
        hp = 0.97 * (hp_prev_out + lp - hp_prev_in)  # remove rumble
        hp_prev_in, hp_prev_out = lp, hp
        if random.random() < 0.0009:  # a drop now and then
            drops.append([i, random.uniform(2500, 5000), random.uniform(0.15, 0.4)])
        d = 0.0
        for dr in drops:
            age = (i - dr[0]) / RATE
            d += dr[2] * math.sin(2 * math.pi * dr[1] * age) * math.exp(-age * 120)
        drops = [dr for dr in drops if (i - dr[0]) < RATE * 0.06]
        out.append(hp * 0.6 + d)
    return crossfade_loop(out)


def pad(secs):
    # Cmaj9 -> Am7 -> Fmaj7 -> G6 (low, soft, slow)
    chords = [
        [130.81, 196.00, 246.94, 293.66],
        [110.00, 164.81, 196.00, 261.63],
        [87.31, 174.61, 220.00, 261.63],
        [98.00, 146.83, 196.00, 246.94],
    ]
    each = secs / len(chords)
    n_each = int(each * RATE)
    out = []
    for c in chords:
        for i in range(n_each):
            t = i / RATE
            x = i / n_each
            shape = math.sin(math.pi * x) ** 0.8  # swell in and out
            v = 0.0
            for k, f in enumerate(c):
                wob = 1 + 0.002 * math.sin(2 * math.pi * 0.2 * t + k)  # gentle chorus
                v += math.sin(2 * math.pi * f * wob * t) + 0.25 * math.sin(4 * math.pi * f * t)
            out.append(v * shape)
    return out  # starts and ends at silence, so it loops cleanly


def main():
    os.makedirs(OUT, exist_ok=True)
    write("sfx_pop", pop(), 0.6)
    if "--all" not in sys.argv:
        return
    write("sfx_chime", chime(), 0.7)
    write("sfx_ding", ding(), 0.6)
    write("sfx_breath_in", swell(196, 262, 4.0), 0.45)
    write("sfx_breath_out", swell(262, 196, 4.0), 0.45)
    write("scape_brown", brown(20), 0.7)
    write("scape_rain", rain(20), 0.7)
    write("scape_pad", pad(32), 0.6)


main()
