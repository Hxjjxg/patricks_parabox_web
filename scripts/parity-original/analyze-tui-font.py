"""Independently measure original Inconsolata LowerCenter glyph placement."""
import json
import math
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / 'docs/parity/evidence/original' / (sys.argv[1] if len(sys.argv) > 1 else 'native-tui-fixed-font-v2-20261025')
data = json.loads((DIRECTORY / 'tui-font-metrics.json').read_text(encoding='utf-8'))
assert data['startupFadeComplete'] and data['postInitializingT'] >= data['initFadeLength']
assert data['fontAssetName'] == 'Inconsolata-SemiBold'
assert [size['fontSize'] for size in data['metrics']] == [56]
atlas = Image.open(DIRECTORY / 'font-atlas.png').convert('RGBA')
screen = Image.open(DIRECTORY / 'screen.png').convert('RGB')
glyphs = {glyph['character']: glyph for glyph in data['metrics'][0]['glyphs']}
assert len(glyphs) == 95 and all(glyph['found'] for glyph in glyphs.values())
generator_m = next(item for item in data['textGeneratorMeasurements'] if item['text'] == 'M')
hinted_ascent = -generator_m['vertices'][0][1] + glyphs['M']['bounds'][3] + generator_m['characters'][0]['cursorPos']['y']
masks = {}
for character in {sample['text'] for sample in data['actualLabels']}:
    glyph = glyphs[character]
    left, bottom, right, top = glyph['bounds']
    width, height = right - left, top - bottom
    tl, tr, bl = [glyph[key] for key in ['uvTopLeft', 'uvTopRight', 'uvBottomLeft']]
    points = set()
    for y in range(height):
        for x in range(width):
            u = tl[0] + (tr[0] - tl[0]) * (x + .5) / width + (bl[0] - tl[0]) * (y + .5) / height
            v = tl[1] + (tr[1] - tl[1]) * (x + .5) / width + (bl[1] - tl[1]) * (y + .5) / height
            if atlas.getpixel((math.floor(u * atlas.width), math.floor((1 - v) * atlas.height)))[3] >= 240:
                points.add((x, y))
    masks[character] = points

measurements = []
for sample in data['actualLabels']:
    assert sample['actualFontName'] == data['fontAssetName']
    assert sample['actualStyleFontSize'] == 56 and sample['actualFontStyle'] == 'Normal'
    assert sample['alignment'] == sample['actualAlignment'] == 'LowerCenter'
    character = sample['text']
    x, y, width, height = sample['rect']
    channel = max(range(3), key=lambda i: sample['color'][i])
    threshold = math.floor(sample['color'][channel] * 240 + .5)
    actual = {(px, py) for py in range(math.floor(y + height / 2), math.ceil(y + height))
              for px in range(math.floor(x), math.ceil(x + width)) if screen.getpixel((px, py))[channel] >= threshold}
    cursor_x, cursor_y = sample['cursor0']
    glyph = glyphs[character]
    candidates = []
    for pen in range(math.floor(cursor_x) - 3, math.ceil(cursor_x) + 4):
        for baseline in range(math.floor(cursor_y) + 30, math.ceil(cursor_y) + 65):
            expected = {(pen + glyph['bounds'][0] + px, baseline - glyph['bounds'][3] + py) for px, py in masks[character]}
            candidates.append((len(expected ^ actual), pen, baseline))
    candidates.sort()
    difference, pen, baseline = candidates[0]
    assert difference == 0 and candidates[1][0] > 0, (sample, candidates[:2])
    predicted_pen = math.ceil(cursor_x - .5)
    predicted_baseline = math.floor(cursor_y + .5) + hinted_ascent
    style_baseline = math.floor(y + height - sample['calcSize'][1] + data['sourceStyle']['padding'][2] + hinted_ascent + .5)
    assert (pen, baseline) == (predicted_pen, predicted_baseline)
    assert baseline == style_baseline
    measurements.append(dict(text=character, rect=sample['rect'], cursor0=sample['cursor0'], thresholdChannel=channel,
        threshold=threshold, maskDiff=difference, penX=pen, baseline=baseline, secondBestDiff=candidates[1][0],
        hintedBaselinePrediction=predicted_baseline, sourceStyleBaselinePrediction=style_baseline, cursorSnapPenPrediction=predicted_pen))

assert len(measurements) == 100
result = dict(method='Exhaustive integer pen/baseline search. Actual pixels threshold the strongest recorded GUI foreground channel at round(channel*240); atlas alpha>=240. Crops isolate the lower half of each two-cell native GUI label rectangle. Candidate rules are checked only after unique zero-difference measurements.',
    hintedAscentDerivation=dict(textGeneratorVertexY=generator_m['vertices'][0][1], characterInfoMMaxY=glyphs['M']['bounds'][3],
                               textGeneratorCursorY=generator_m['characters'][0]['cursorPos']['y'], hintedAscent=hinted_ascent),
    scope='Actual Inconsolata-SemiBold56 TUI labels; not a universal Jost or other-font horizontal rule.', measurements=measurements)
(DIRECTORY / 'lower-center-mask-analysis.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(exactUniqueLabels=len(measurements), hintedAscent=hinted_ascent, baselineMatches=len(measurements), penMatches=len(measurements))))
