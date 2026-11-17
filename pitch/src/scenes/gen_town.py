#!/usr/bin/env python3
"""The rolling town on slides 3 and 6: python3 pitch/src/scenes/gen_town.py → scenes/town.svg

Three parallax strips along the bottom 260 px (far hills, rooftops with a warm rim and lit windows, near hedge, trees,
poles and wires). town.svg is a hidden sprite, inlined once into slide 3 (<img data-inline>): one tile per strip
(#tw-far, #tw-roof, #tw-rim, #tw-win, #tw-near), drawn in no colour of its own (fill inherits, strokes are currentColor)
and periodic in x with tile width T, plus the brush blur #tw-b. Each slide's .scene-town holds five inline <svg>
strips that <use> a tile at x = −T, 0, T, 2T under the blur and colour it from the slide's --tw-* variables (base.css),
so the town matches each sky. Plain vector paths, no CSS masks: the Ghostscript-compressed PDF keeps them intact.
Motion lives in base.css (one linear drift per strip on the deck's global clock); the tile widths there and in the
slides' markup must match T_* below. Deterministic seeds.
"""
import math
import random
from pathlib import Path

HERE = Path(__file__).parent
H = 260                       # band height in CSS px (the bottom 260 px of the 1080 slide)
T_FAR, T_MID, T_NEAR = 2880, 3360, 2560   # tile widths (different, so repeats never line up)




def pnoise(T, seed, terms):
    """Periodic 1-D noise: integer harmonics of the tile width, so f(0) == f(T)."""
    r = random.Random(seed)
    ph = [(k, a, r.uniform(0, 6.283)) for k, a in terms]
    return lambda x: sum(a * math.sin(6.283185 * k * x / T + p) for k, a, p in ph)


def tile(T, body):
    """One tile's shapes. They are periodic in x (edge noise from integer harmonics of T), so copies at multiples of
    T join seamlessly; the slide's strip draws them at −T, 0, T and 2T under one light blur (#tw-b), so the brush
    edges stay soft with no seam."""
    return body


def ridge(T, base, seed, terms, step=8, op=1.0):
    f = pnoise(T, seed, terms)
    pts = " ".join(f"{x} {base + f(x):.1f}" for x in range(0, T + 1, step))
    return f"<path fill-opacity='{op}' d='M0 {H + 2} L{pts} L{T} {H + 2}Z'/>"


# ---------- far: two soft ridges, the back one hazier ----------
def far():
    rough = [(23, .9), (41, .6), (67, .35)]
    back = ridge(T_FAR, 128, 11, [(2, 13), (3, 9), (5, 6), (9, 3), (14, 1.6)] + rough, op=.5)
    front = ridge(T_FAR, 160, 12, [(2, 10), (4, 7), (7, 4), (11, 2.2)] + rough, op=1)
    # a few distant tree clumps on the front ridge
    r = random.Random(13)
    f = pnoise(T_FAR, 12, [(2, 10), (4, 7), (7, 4), (11, 2.2)] + rough)
    clumps = ""
    for _ in range(9):
        x = r.uniform(0, T_FAR)
        for k in range(r.randint(3, 6)):
            cx = x + k * r.uniform(6, 10)
            rr = r.uniform(4, 8)
            clumps += f"<circle cx='{cx:.0f}' cy='{160 + f(cx) - rr * .55:.1f}' r='{rr:.1f}'/>"
    return tile(T_FAR, back + front + clumps)


# ---------- mid: two rows of rooftops, a warm rim on the roof edges, a few lit windows ----------
def buildings(seed, x0, x1, ymin, ymax, tall=0.0):
    r = random.Random(seed)
    x, out = x0, []
    while x < x1:
        w = r.choice([52, 60, 68, 76, 88, 96, 112, 128])
        top = r.uniform(ymin, ymax)
        if r.random() < tall:
            top -= r.uniform(22, 36); w = r.choice([96, 112, 128])
        k = r.random()
        kind = "gable" if k < .38 else "hip" if k < .52 else "chim" if k < .66 else "step" if k < .76 else "flat"
        out.append((x, w, top, kind, r.random()))
        x += w + (r.choice([0, 0, 0, 6, 14]) if r.random() < .35 else 0)
    return out


def roof_outline(b, jit):
    """Top outline of one building, left to right, as a point list (and the rim segments)."""
    x, w, top, kind, u = b
    j = lambda xx: jit(xx)
    if kind == "gable":
        pk = top - w * .3
        pts = [(x, top + j(x)), (x + w / 2, pk), (x + w, top + j(x + w))]
    elif kind == "hip":
        pts = [(x, top + j(x)), (x + w * .28, top - w * .16), (x + w * .72, top - w * .16), (x + w, top + j(x + w))]
    elif kind == "chim":
        cx = x + w * (.25 + .5 * u)
        pts = [(x, top), (cx, top), (cx, top - 15), (cx + 9, top - 15), (cx + 9, top), (x + w, top)]
    elif kind == "step":
        pts = [(x, top), (x + w * .55, top), (x + w * .55, top + 14), (x + w, top + 14)]
    else:
        pts = [(x, top), (x + w, top)]
        if u < .3:  # a tiny rooftop box
            bx = x + w * .3
            pts = [(x, top), (bx, top), (bx, top - 9), (bx + 18, top - 9), (bx + 18, top), (x + w, top)]
    return pts


def mid():
    jit = pnoise(T_MID, 21, [(57, .7), (91, .5)])
    back = buildings(22, 0, T_MID, 150, 186, tall=.1)
    front = buildings(23, 0, T_MID, 176, 212, tall=.08)
    body, rim, win = "", "", ""
    for row, op in ((back, .55), (front, 1)):
        for b in row:
            x, w = b[0], b[1]
            pts = roof_outline(b, jit)
            d = f"M{x:.0f} {H + 2} " + " ".join(f"L{px:.1f} {py:.1f}" for px, py in pts) + f" L{x + w:.0f} {H + 2}Z"
            body += f"<path fill-opacity='{op}' d='{d}'/>"
    # rim light: the upper edge of the front row, strongest on slopes that face the afterglow (right)
    r = random.Random(24)
    for b in front + back:
        if b[3] not in ("gable", "hip") or r.random() < .25:
            continue
        pts = roof_outline(b, jit)
        seg = " ".join(f"{px:.1f} {py + 1.4:.1f}" for px, py in pts[1:])   # the slope that faces the afterglow
        o = (.6 if b in front else .3) * r.uniform(.6, 1)
        rim += f"<polyline points='{seg}' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' stroke-opacity='{o:.2f}'/>"
    # lit windows: small square panes, about one front building in four, a soft glow around each
    r = random.Random(25)
    for b in front:
        x, w, top, kind, u = b
        if r.random() > .16:
            continue
        n = 2 if (w > 100 and r.random() < .35) else 1
        for i in range(n):
            wx = x + w * (.22 + .5 * i) + r.uniform(0, w * .12)
            wy = top + r.uniform(14, 26)
            if wy > H - 22:
                continue
            win += (f"<ellipse cx='{wx + 3.5:.0f}' cy='{wy + 4.5:.0f}' rx='13' ry='11' fill-opacity='.10'/>"
                    f"<rect x='{wx:.0f}' y='{wy:.0f}' width='7' height='9' rx='1' fill-opacity='.9'/>")
    return tile(T_MID, body), tile(T_MID, rim), tile(T_MID, win)


# ---------- near: a low hedge, a few round trees, utility poles and sagging wires ----------
def near():
    r = random.Random(31)
    hedge = ridge(T_NEAR, 240, 32, [(3, 3), (7, 2.5), (19, 2.2), (37, 1.6), (61, 1.0), (97, .7)], step=6)
    trees = ""
    for tx in (300, 1130, 2010):
        tx += r.uniform(-60, 60)
        s = r.uniform(.85, 1.15)
        trees += f"<path d='M{tx - 3:.0f} 262 L{tx - 2:.0f} {200 - 10 * s:.0f} L{tx + 2:.0f} {200 - 10 * s:.0f} L{tx + 3:.0f} 262Z'/>"
        # a full, loose crown: overlapping blobs, then leaf clumps that overlap its edge (never float free)
        cy0 = 170 - 10 * s
        for _ in range(9):
            ang = r.uniform(0, 6.283); d = r.uniform(0, 16) * s
            trees += f"<circle cx='{tx + math.cos(ang) * d * 1.4:.0f}' cy='{cy0 + math.sin(ang) * d:.0f}' r='{r.uniform(20, 27) * s:.0f}'/>"
        for _ in range(18):
            ang = r.uniform(0, 6.283)
            d = r.uniform(24, 32) * s
            trees += f"<circle cx='{tx + math.cos(ang) * d * 1.35:.0f}' cy='{cy0 + math.sin(ang) * d * .95:.0f}' r='{r.uniform(8, 12) * s:.1f}'/>"
    poles, wires = "", ""
    P = [500, 1780]           # two poles per tile, 1280 apart: a wire span never looks repeated within a screen
    span = T_NEAR / 2
    for px in P:
        top = 104
        poles += (f"<rect x='{px - 2.5}' y='{top}' width='5' height='{H - top}' rx='1.5'/>"
                  f"<rect x='{px - 19}' y='{top + 9}' width='38' height='3' rx='1'/>"
                  f"<rect x='{px - 12}' y='{top + 22}' width='24' height='2.5' rx='1'/>")
        # wires to the next pole (it lands on the copy in the next tile for the last one)
        for dx, dy, sag in ((-17, 9, 26), (17, 9, 30), (0, 22, 34)):
            x0, x1, y0 = px + dx, px + span + dx, top + dy
            wires += f"<path d='M{x0} {y0} Q{(x0 + x1) / 2} {y0 + sag * 2} {x1} {y0}' fill='none' stroke='currentColor' stroke-width='1.3' stroke-opacity='.85'/>"
    return tile(T_NEAR, hedge + trees + poles + wires)


FAR = far()
MID, RIM, WIN = mid()
NEAR = near()
sprite = ("<svg xmlns='http://www.w3.org/2000/svg' width='0' height='0' style='position:absolute;overflow:hidden'><defs>"
          "<filter id='tw-b' filterUnits='userSpaceOnUse' x='-3400' y='-20' width='14000' height='300'>"
          "<feGaussianBlur stdDeviation='0.8'/></filter>"
          + "".join(f"<g id='tw-{k}'>{v}</g>" for k, v in dict(far=FAR, roof=MID, rim=RIM, win=WIN, near=NEAR).items())
          + "</defs></svg>")
(HERE / "town.svg").write_text(" ".join(sprite.split()) + "\n")
print("town.svg", (HERE / "town.svg").stat().st_size, "bytes; tiles", dict(far=T_FAR, mid=T_MID, near=T_NEAR))
