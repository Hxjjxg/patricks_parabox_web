"""Repack same-generation original FixedWidth glyph alpha; never rerasterize."""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/parity/evidence/original/native-tui-fixed-font-v2-20261025'
metrics_path = SOURCE / 'tui-font-metrics.json'
metrics = json.loads(metrics_path.read_text(encoding='utf-8-sig'))
original = Image.open(SOURCE / 'font-atlas.png').convert('RGBA')
atlas = Image.new('RGBA', (512, 512), (255, 255, 255, 0))
x = y = row_height = 1
glyphs = {}
for glyph in metrics['metrics'][0]['glyphs']:
    left, bottom, right, top = glyph['bounds']
    width, height = right - left, top - bottom
    if x + width + 1 > atlas.width:
        x = 1
        y += row_height + 2
        row_height = 0
    if y + height + 1 > atlas.height:
        raise ValueError('FixedWidth atlas exceeds explicit512x512 extent')
    tl, tr, bl = glyph['uvTopLeft'], glyph['uvTopRight'], glyph['uvBottomLeft']
    image = Image.new('RGBA', (width, height), (255, 255, 255, 0))
    for gy in range(height):
        for gx in range(width):
            u = tl[0] + (tr[0] - tl[0]) * (gx + .5) / width + (bl[0] - tl[0]) * (gy + .5) / height
            v = tl[1] + (tr[1] - tl[1]) * (gx + .5) / width + (bl[1] - tl[1]) * (gy + .5) / height
            alpha = original.getpixel((math.floor(u * original.width), math.floor((1 - v) * original.height)))[3]
            image.putpixel((gx, gy), (255, 255, 255, alpha))
    atlas.paste(image, (x, y))
    glyphs[glyph['character']] = {'advance': glyph['advance'], 'bounds': glyph['bounds'], 'frame': [x, y, width, height]}
    x += width + 2
    row_height = max(row_height, height)
texture_path = ROOT / 'src/assets/fonts/native-inconsolata-atlas.png'
atlas.save(texture_path)
measure = next(row for row in metrics['textGeneratorMeasurements'] if row['text'] == 'M')
ascent = glyphs['M']['bounds'][3] - measure['vertices'][0][1]
data = {'fontSize': 56, 'hintedAscent': ascent, 'singleLineHeight': metrics['actualLabels'][0]['calcSize'][1], 'padding': metrics['sourceStyle']['padding'], 'glyphs': glyphs, 'source': SOURCE.relative_to(ROOT).as_posix(), 'sourceMetricsSha256': hashlib.sha256(metrics_path.read_bytes()).hexdigest(), 'sourceAtlasSha256': hashlib.sha256((SOURCE / 'font-atlas.png').read_bytes()).hexdigest(), 'atlasSha256': hashlib.sha256(texture_path.read_bytes()).hexdigest()}
(ROOT / 'src/assets/data/native-tui-font-metrics.json').write_text(json.dumps(data, separators=(',', ':')) + chr(10), encoding='utf-8')
print(json.dumps({'glyphs': len(glyphs), 'hintedAscent': ascent, 'usedHeight': y + row_height, 'atlasSha256': data['atlasSha256']}))
