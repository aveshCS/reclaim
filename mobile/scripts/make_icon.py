"""
RECLAIM app icon: Pip (the app's guide) on warm orange.
One geometry source, two outputs:
  - Android adaptive-icon vector drawables (foreground, monochrome) for API 26+
  - Legacy PNG launcher icons (API 24-25), the Play Store 512x512 PNG and a preview.
Shapes are Pip's own SVG paths (viewBox 200x220), placed in the 108x108 adaptive canvas
inside the 66 dp safe circle.
"""
import math
import os
import sys

from PIL import Image, ImageDraw

RES = sys.argv[1]  # .../app/src/main/res
STORE = sys.argv[2]  # where to put the 512 px store icon
PREVIEW = sys.argv[3]  # preview PNG path

INK = "#1F1A17"
BUTTER = "#FFD66B"
LEAF = "#3F8F5B"
BLUSH = "#F5A99A"
ORANGE = "#F26A3D"
WHITE = "#FFFFFF"

# Pip -> 108 canvas: scale and offset (keeps everything within the 33-unit safe radius).
S = 0.31
TX = 54 - 100 * S
TY = 54 - 109.5 * S

stem_top = 31
SHAPES = [
    # (kind, data, fill, fill_alpha, stroke, stroke_width)
    ("path", [("M", 100, 66), ("Q", 95, 48.5, 100, stem_top)], None, 1, INK, 4),
    ("path", [("M", 100, 31), ("C", 86, 15, 68, 23, 64, 37), ("C", 80, 43, 94, 39, 100, 31), ("Z",)], LEAF, 1, INK, 3.5),
    ("path", [("M", 100, 31), ("C", 114, 15, 132, 23, 136, 37), ("C", 120, 43, 106, 39, 100, 31), ("Z",)], LEAF, 1, INK, 3.5),
    ("path", [("M", 100, 62), ("C", 150, 62, 178, 98, 178, 140), ("C", 178, 182, 146, 204, 100, 204),
              ("C", 54, 204, 22, 182, 22, 140), ("C", 22, 98, 50, 62, 100, 62), ("Z",)], BUTTER, 1, INK, 4.5),
    ("ellipse", (100, 172, 44, 24), WHITE, 0.35, None, 0),
    ("ellipse", (60, 148, 11, 6.5), BLUSH, 0.8, None, 0),
    ("ellipse", (140, 148, 11, 6.5), BLUSH, 0.8, None, 0),
    ("ellipse", (76, 128, 7.5, 10), INK, 1, None, 0),
    ("ellipse", (124, 128, 7.5, 10), INK, 1, None, 0),
    ("ellipse", (78.5, 123, 3, 3), WHITE, 1, None, 0),
    ("ellipse", (126.5, 123, 3, 3), WHITE, 1, None, 0),
    ("path", [("M", 88, 151), ("Q", 100, 163, 112, 151)], None, 1, INK, 4.5),
]


# ---------------------------------------------------------------- vector drawables
def fmt(v):
    return ("%.2f" % v).rstrip("0").rstrip(".")


def path_data(kind, data):
    if kind == "ellipse":
        cx, cy, rx, ry = data
        return (f"M{fmt(cx - rx)},{fmt(cy)} A{fmt(rx)},{fmt(ry)} 0 1,0 {fmt(cx + rx)},{fmt(cy)} "
                f"A{fmt(rx)},{fmt(ry)} 0 1,0 {fmt(cx - rx)},{fmt(cy)} Z")
    out = []
    for cmd in data:
        out.append(cmd[0] + ",".join(fmt(v) for v in cmd[1:]))
    return " ".join(out)


def vector(paths_xml):
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- Generated: RECLAIM icon, Pip on orange. -->\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="108dp" android:height="108dp"\n'
        '    android:viewportWidth="108" android:viewportHeight="108">\n'
        f'  <group android:translateX="{fmt(TX)}" android:translateY="{fmt(TY)}"\n'
        f'      android:scaleX="{S}" android:scaleY="{S}">\n'
        f'{paths_xml}'
        '  </group>\n'
        '</vector>\n'
    )


def foreground_xml():
    rows = []
    for kind, data, fill, alpha, stroke, sw in SHAPES:
        attrs = [f'android:pathData="{path_data(kind, data)}"']
        if fill:
            attrs.append(f'android:fillColor="{fill}"')
            if alpha < 1:
                attrs.append(f'android:fillAlpha="{alpha}"')
        if stroke:
            attrs += [f'android:strokeColor="{stroke}"', f'android:strokeWidth="{sw}"',
                      'android:strokeLineCap="round"', 'android:strokeLineJoin="round"']
        rows.append("    <path " + "\n        ".join(attrs) + " />\n")
    return vector("".join(rows))


def monochrome_xml():
    # One colour (the system tints it). Body with the eyes cut out, plus leaves and stem.
    body = path_data("path", SHAPES[3][1])
    eyes = path_data("ellipse", (76, 128, 7.5, 10)) + " " + path_data("ellipse", (124, 128, 7.5, 10))
    rows = [
        f'    <path android:pathData="{path_data("path", SHAPES[1][1])}" android:fillColor="#000000" />\n',
        f'    <path android:pathData="{path_data("path", SHAPES[2][1])}" android:fillColor="#000000" />\n',
        f'    <path android:pathData="{path_data("path", SHAPES[0][1])}" android:strokeColor="#000000"\n'
        '        android:strokeWidth="5" android:strokeLineCap="round" />\n',
        f'    <path android:pathData="{body} {eyes}" android:fillColor="#000000"\n'
        '        android:fillType="evenOdd" />\n',
    ]
    return vector("".join(rows))


# ---------------------------------------------------------------- raster
def flatten(data, steps=48):
    pts = []
    cur = (0, 0)
    start = (0, 0)
    for cmd in data:
        c = cmd[0]
        if c == "M":
            cur = start = (cmd[1], cmd[2])
            pts.append(cur)
        elif c == "L":
            cur = (cmd[1], cmd[2])
            pts.append(cur)
        elif c == "Q":
            x0, y0 = cur
            x1, y1, x2, y2 = cmd[1:]
            for i in range(1, steps + 1):
                t = i / steps
                pts.append(((1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t * t * x2,
                            (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2))
            cur = (x2, y2)
        elif c == "C":
            x0, y0 = cur
            x1, y1, x2, y2, x3, y3 = cmd[1:]
            for i in range(1, steps + 1):
                t = i / steps
                mt = 1 - t
                pts.append((mt ** 3 * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t ** 3 * x3,
                            mt ** 3 * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t ** 3 * y3))
            cur = (x3, y3)
        elif c == "Z":
            pts.append(start)
    return pts


def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(round(a * 255)))


def render(px, shape="square"):
    """Icon at px x px. shape: square (Play store, full bleed), rounded, circle."""
    ss = 4
    big = px * ss
    # Show the central 72 of the 108 canvas (what an adaptive mask shows).
    crop0, crop = 18, 72
    k = big / crop

    def P(x, y):  # Pip coords -> pixels
        return ((TX + x * S - crop0) * k, (TY + y * S - crop0) * k)

    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    bg = Image.new("RGBA", (big, big), hex_rgba(ORANGE))
    mask = Image.new("L", (big, big), 0)
    md = ImageDraw.Draw(mask)
    if shape == "circle":
        md.ellipse((0, 0, big - 1, big - 1), fill=255)
    elif shape == "rounded":
        md.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.22), fill=255)
    else:
        md.rectangle((0, 0, big, big), fill=255)
    img.paste(bg, (0, 0), mask)

    for kind, data, fill, alpha, stroke, sw in SHAPES:
        layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        w = max(1, int(round(sw * S * k)))
        if kind == "ellipse":
            cx, cy, rx, ry = data
            x0, y0 = P(cx - rx, cy - ry)
            x1, y1 = P(cx + rx, cy + ry)
            d.ellipse((x0, y0, x1, y1), fill=hex_rgba(fill, alpha) if fill else None)
        else:
            pts = [P(x, y) for x, y in flatten(data)]
            if fill:
                d.polygon(pts, fill=hex_rgba(fill, alpha))
            if stroke:
                d.line(pts, fill=hex_rgba(stroke), width=w, joint="curve")
                r = w / 2
                for x, y in (pts[0], pts[-1]):  # round caps
                    d.ellipse((x - r, y - r, x + r, y + r), fill=hex_rgba(stroke))
        img = Image.alpha_composite(img, layer)

    # Keep the drawing inside the chosen shape.
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out.resize((px, px), Image.LANCZOS)


def main():
    os.makedirs(os.path.join(RES, "drawable"), exist_ok=True)
    os.makedirs(os.path.join(RES, "mipmap-anydpi-v26"), exist_ok=True)
    with open(os.path.join(RES, "drawable", "ic_launcher_foreground.xml"), "w", encoding="utf-8") as f:
        f.write(foreground_xml())
    with open(os.path.join(RES, "drawable", "ic_launcher_monochrome.xml"), "w", encoding="utf-8") as f:
        f.write(monochrome_xml())
    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '  <background android:drawable="@color/ic_launcher_background" />\n'
        '  <foreground android:drawable="@drawable/ic_launcher_foreground" />\n'
        '  <monochrome android:drawable="@drawable/ic_launcher_monochrome" />\n'
        '</adaptive-icon>\n'
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(RES, "mipmap-anydpi-v26", name), "w", encoding="utf-8") as f:
            f.write(adaptive)

    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dens, px in sizes.items():
        d = os.path.join(RES, f"mipmap-{dens}")
        os.makedirs(d, exist_ok=True)
        render(px, "rounded").save(os.path.join(d, "ic_launcher.png"))
        render(px, "circle").save(os.path.join(d, "ic_launcher_round.png"))

    os.makedirs(os.path.dirname(STORE), exist_ok=True)
    render(512, "square").convert("RGB").save(STORE)

    # Preview: Play-style rounded square, circle, and small size side by side.
    prev = Image.new("RGBA", (1000, 380), hex_rgba("#FBF4EA"))
    prev.alpha_composite(render(300, "rounded"), (40, 40))
    prev.alpha_composite(render(300, "circle"), (380, 40))
    prev.alpha_composite(render(96, "circle"), (740, 142))
    prev.alpha_composite(render(48, "rounded"), (880, 166))
    prev.convert("RGB").save(PREVIEW)
    print("done")


main()


