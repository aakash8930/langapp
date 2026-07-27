#!/usr/bin/env python3
"""
Generate the app's icon and splash assets.

## Why a script and not six PNGs

The same mark has to exist at seven sizes, in light and dark, with a transparent
variant for Android's adaptive icon and an opaque one for iOS. Hand-editing that
set is how they drift — one gets a new colour and the others do not. Here the
palette is declared once, at the top, and every asset is derived.

The glyph is あ: the first character the course teaches, and the one a learner
meets on their first screen. 語 was the obvious alternative and was rejected on
legibility — it has 14 strokes, which at a 48px launcher icon is a smudge.
あ holds its shape all the way down.

Typeface is the project's own Zen Kaku Gothic New, read out of `client/`'s
node_modules rather than a system font, so the mark is set in the same face the
app renders Japanese in.

## Contrast is checked, not eyeballed

Vermilion on the dark ground is the risky pairing — `#BC3E28` is tuned for paper
and only reaches 3.46:1 on `#141310`. The dark variants use a lightened
vermilion, and the script computes and prints every ratio it uses so a change
that breaks one is visible in the output rather than on someone's phone.

Run from the repo root:

    python3 tools/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "client" / "assets"
FONT = (
    ROOT
    / "client"
    / "node_modules"
    / "@expo-google-fonts"
    / "zen-kaku-gothic-new"
    / "700Bold"
    / "ZenKakuGothicNew_700Bold.ttf"
)

GLYPH = "あ"

# Straight from client/theme/colors.ts — see the module docstring on why these
# are not re-picked here.
PAPER = (242, 241, 236)
SUMI = (20, 19, 16)
SHU = (188, 62, 40)
# Lightened vermilion for the ink ground. `SHU` itself is tuned for paper and
# manages only 3.46:1 on `SUMI`, which is a pass for a large graphic and a
# margin too thin to want.
SHU_DARK = (217, 86, 59)
HAIRLINE = (222, 220, 211)
HAIRLINE_DARK = (58, 55, 50)


def luminance(rgb: tuple[int, int, int]) -> float:
    def channel(value: int) -> float:
        srgb = value / 255
        return srgb / 12.92 if srgb <= 0.04045 else ((srgb + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la, lb = luminance(a), luminance(b)
    high, low = max(la, lb), min(la, lb)
    return (high + 0.05) / (low + 0.05)


def draw_glyph(
    image: Image.Image,
    colour: tuple[int, int, int],
    ratio: float,
) -> None:
    """Centre the glyph optically, not on its bounding box.

    `textbbox` measures the inked pixels, so centring on it puts あ's visual
    centre of mass slightly high — the character's weight sits low. Anchoring on
    the box and then nudging by the box's own offset is what makes it sit in the
    cell the way it would in a genkouyoushi square.
    """
    size = image.size[0]
    font = ImageFont.truetype(str(FONT), int(size * ratio))
    draw = ImageDraw.Draw(image)

    box = draw.textbbox((0, 0), GLYPH, font=font)
    width, height = box[2] - box[0], box[3] - box[1]
    x = (size - width) / 2 - box[0]
    y = (size - height) / 2 - box[1]
    draw.text((x, y), GLYPH, font=font, fill=colour)


def draw_cell(image: Image.Image, colour: tuple[int, int, int]) -> None:
    """The genkouyoushi square: a border and the faint quadrant guides.

    The guides are what make it manuscript paper rather than a box — they are
    the marks a learner places a character against. Kept very light: they are
    scaffolding for the glyph, never a competing shape.
    """
    size = image.size[0]
    draw = ImageDraw.Draw(image)
    inset = int(size * 0.085)
    stroke = max(2, int(size * 0.006))

    draw.rectangle(
        [inset, inset, size - inset, size - inset],
        outline=colour,
        width=stroke,
    )

    # Dashed cross. Drawn as segments rather than a line style because PIL has
    # no dash support, and a solid cross would read as a division of the square.
    mid = size // 2
    dash, gap = int(size * 0.028), int(size * 0.028)
    position = inset
    while position < size - inset:
        end = min(position + dash, size - inset)
        draw.line([position, mid, end, mid], fill=colour, width=stroke)
        draw.line([mid, position, mid, end], fill=colour, width=stroke)
        position = end + gap


def splash(path: Path, ink: tuple[int, int, int], guide: tuple[int, int, int]) -> None:
    """Transparent: the plugin paints the background colour behind it."""
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw_cell(image, guide)
    draw_glyph(image, ink, 0.56)
    image.save(path)


def icon(path: Path) -> None:
    """Opaque, and no cell.

    iOS refuses alpha in an app icon, and the launcher already draws a rounded
    container — a border inside that reads as a box within a box. The glyph
    alone at this size is the stronger mark anyway.
    """
    image = Image.new("RGBA", (1024, 1024), (*PAPER, 255))
    draw_glyph(image, SHU, 0.62)
    image.save(path)


def adaptive_foreground(path: Path) -> None:
    """Android crops an adaptive icon hard.

    The outer 1/6 on every side can be masked away by the launcher's shape, and
    is animated during a press — so the glyph is drawn small enough to sit
    entirely inside the 66% safe zone. Sized off the *canvas*, not the safe
    zone, which is the mistake that gets a mark clipped on round-icon launchers.
    """
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw_glyph(image, SHU, 0.42)
    image.save(path)


def adaptive_background(path: Path) -> None:
    image = Image.new("RGBA", (1024, 1024), (*PAPER, 255))
    image.save(path)


def monochrome(path: Path) -> None:
    """Themed icons: Android tints the alpha channel and discards the colour.

    So this is drawn in flat black — anything else is thrown away, and a
    coloured source here would only mislead the next person to open it.
    """
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw_glyph(image, (0, 0, 0), 0.42)
    image.save(path)


def favicon(path: Path) -> None:
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw_glyph(image, SHU, 0.78)
    image.save(path)


def main() -> None:
    if not FONT.exists():
        raise SystemExit(f"Font not found: {FONT}\nRun `npm install` in client/ first.")

    ASSETS.mkdir(parents=True, exist_ok=True)

    print("Contrast (WCAG needs 3:1 for a large graphic):")
    for name, ink, ground in [
        ("shu on paper      ", SHU, PAPER),
        ("shu-dark on sumi  ", SHU_DARK, SUMI),
        ("shu on sumi (why not)", SHU, SUMI),
    ]:
        ratio = contrast(ink, ground)
        print(f"  {name} {ratio:5.2f}:1  {'ok' if ratio >= 3 else 'FAILS'}")

    splash(ASSETS / "splash-icon.png", SHU, HAIRLINE)
    splash(ASSETS / "splash-icon-dark.png", SHU_DARK, HAIRLINE_DARK)
    icon(ASSETS / "icon.png")
    adaptive_foreground(ASSETS / "android-icon-foreground.png")
    adaptive_background(ASSETS / "android-icon-background.png")
    monochrome(ASSETS / "android-icon-monochrome.png")
    favicon(ASSETS / "favicon.png")

    print("\nWritten:")
    for path in sorted(ASSETS.glob("*.png")):
        print(f"  {path.relative_to(ROOT)}  ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
