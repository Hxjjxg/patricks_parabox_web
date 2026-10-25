"""Measure native GUI glyph placement; do not assume a baseline formula."""
import json
import math
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/parity/evidence/original"
NAMES = sys.argv[1:] or ["native-gui-font-pack-v7-20261025", "native-gui-font-pack-odd-v8-20261025", "native-gui-font-pack-falsify-v9-20261025"]
face = json.loads((EVIDENCE / "native-main-font-face-v6-20261025/font-face-metrics.json").read_text(encoding="utf-8"))
native = json.loads((EVIDENCE / "native-main-font-cursor-v4-20261025/font-metrics.json").read_text(encoding="utf-8"))
native_sizes = {size["fontSize"]: size for size in native["metrics"]}
captions = {size["fontSize"]: size for size in native["captionMeasurements"]}
hinted = {}
for measurement in face["measurements"]:
    size = measurement["size"]
    max_y = next(g["bounds"][3] for g in native_sizes[size]["glyphs"] if g["character"] == "M")
    hinted[size] = -measurement["textGenerator"]["vertices"][0][1] + max_y + measurement["textGenerator"]["characters"][1]["cursorPos"]["y"]

for name in NAMES:
    directory = EVIDENCE / name
    data = json.loads((directory / "gui-font-pack.json").read_text(encoding="utf-8"))
    atlas = Image.open(directory / "font-atlas.png").convert("RGBA")
    screen = Image.open(directory / "screen.png").convert("RGB")
    glyphs = {size["fontSize"]: {g["character"]: g for g in size["glyphs"]} for size in data["metrics"]}
    masks = {}
    for size, characters in glyphs.items():
        masks[size] = {}
        for character, glyph in characters.items():
            min_x, min_y, max_x, max_y = glyph["bounds"]
            width, height = max_x - min_x, max_y - min_y
            tl, tr, bl = [tuple(glyph[key][axis] for axis in ("x", "y")) for key in ("uvTopLeft", "uvTopRight", "uvBottomLeft")]
            points = set()
            for y in range(height):
                for x in range(width):
                    u = tl[0] + (tr[0] - tl[0]) * (x + .5) / width + (bl[0] - tl[0]) * (y + .5) / height
                    v = tl[1] + (tr[1] - tl[1]) * (x + .5) / width + (bl[1] - tl[1]) * (y + .5) / height
                    if atlas.getpixel((math.floor(u * atlas.width), math.floor((1 - v) * atlas.height)))[3] >= 240:
                        points.add((x, y))
            masks[size][character] = points
    samples = []
    for sample in data["samples"]:
        size = sample["fontSize"]
        text = sample.get("text", "\nMove")
        cursor_x, cursor_y = sample["cursors"][sample.get("placementCursor", 1)]
        rect_x, rect_y, width, height = sample["rect"]
        actual = {(x, y) for y in range(max(0, math.floor(rect_y)), min(screen.height, math.ceil(rect_y + height))) for x in range(max(0, math.floor(rect_x)), min(screen.width, math.ceil(rect_x + width))) if min(screen.getpixel((x, y))) >= 240}
        candidates = []
        for pen_x in range(math.floor(cursor_x) - 2, math.ceil(cursor_x) + 3):
            for baseline in range(math.floor(cursor_y), math.ceil(cursor_y) + 40):
                expected = set()
                pen = pen_x
                for character in text.split("\n")[-1]:
                    glyph = glyphs[size][character]
                    expected.update((pen + glyph["bounds"][0] + x, baseline - glyph["bounds"][3] + y) for x, y in masks[size][character])
                    pen += glyph["advance"]
                candidates.append((len(expected ^ actual), pen_x, baseline))
        candidates.sort()
        difference, pen_x, baseline = candidates[0]
        assert difference == 0, (name, sample, candidates[:2])
        assert candidates[1][0] > 0, ("ambiguous alignment", name, sample)
        calc_size = sample.get("calcSize", captions[size]["calcSize"])
        line_height = sample.get("lineHeight", native_sizes[size]["lineHeight"])
        advance_width = sum(glyphs[size][character]["advance"] for character in text.split("\n")[-1])
        snap_x = lambda value: math.ceil(value - .5)
        snap_y = lambda value: math.floor(value + .5)
        predicted_x = snap_x(rect_x) + snap_x((width - advance_width) / 2)
        predicted_y = snap_y(rect_y) + snap_y((height - calc_size[1]) / 2 + native["sourceStyle"]["padding"][2] + text.count("\n") * line_height + hinted[size])
        samples.append(dict(size=size, text=text, fractionY=sample["fractionY"], rect=sample["rect"],
                            lineTop=cursor_y, cursorX=cursor_x, baseline=baseline, penX=pen_x,
                            whitePixels=len(actual), whiteMaskDiff=difference, secondBestDiff=candidates[1][0],
                            genericSnapPrediction=dict(penX=predicted_x, baseline=predicted_y, matches=predicted_x == pen_x and predicted_y == baseline)))
    output = dict(method="Exhaustive integer pen/baseline search against same-generation atlas alpha>=240 and native RGB>=240; no baseline formula assumed by the measurement. Proposed generic staged snap rule is checked independently afterward.", samples=samples)
    (directory / "mask-alignment-analysis.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(dict(capture=name, exactSamples=len(samples), measurements=samples)))
