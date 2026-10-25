"""Repack a same-generation native dynamic font atlas without rerasterization."""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/parity/evidence/original/native-main-font-ascii-v3-20261025'
metrics = json.loads((SOURCE / 'font-metrics.json').read_text(encoding='utf-8'))
original = Image.open(SOURCE / 'font-atlas.png').convert('RGBA')
atlas = Image.new('RGBA', (512, 512), (255, 255, 255, 0))
x = y = row_height = 1
sizes = {}
for size in metrics['metrics']:
    glyphs = {}
    for glyph in size['glyphs']:
        width, height = glyph['glyphWidth'], glyph['glyphHeight']
        if x + width + 1 > atlas.width:
            x = 1
            y += row_height + 2
            row_height = 0
        if y + height + 1 > atlas.height:
            raise ValueError('Native font atlas packing exceeds explicit512x512 extent')
        tl, tr, bl = glyph['uvTopLeft'], glyph['uvTopRight'], glyph['uvBottomLeft']
        image = Image.new('RGBA', (width, height), (255, 255, 255, 0))
        for gy in range(height):
            for gx in range(width):
                u = tl[0] + (tr[0] - tl[0]) * (gx + .5) / width + (bl[0] - tl[0]) * (gy + .5) / height
                v = tl[1] + (tr[1] - tl[1]) * (gx + .5) / width + (bl[1] - tl[1]) * (gy + .5) / height
                alpha = original.getpixel((math.floor(u * original.width), math.floor((1 - v) * original.height)))[3]
                # Unity GUI/Text Shader reads atlas alpha only. Pixi expects
                # white RGB plus that same alpha for a white font texture.
                image.putpixel((gx, gy), (255, 255, 255, alpha))
        atlas.paste(image, (x, y))
        glyphs[glyph['character']] = {'advance': glyph['advance'], 'bounds': glyph['bounds'], 'frame': [x, y, width, height]}
        x += width + 2
        row_height = max(row_height, height)
    sizes[str(size['fontSize'])] = {'lineHeight': size['lineHeight'], 'singleLineHeight': size['calcSize'][1], 'glyphs': glyphs}
texture_path = ROOT / 'src/assets/fonts/native-jost-atlas.png'
atlas.save(texture_path)
data = {'source': SOURCE.relative_to(ROOT).as_posix(), 'sourceAtlasSha256': hashlib.sha256((SOURCE / 'font-atlas.png').read_bytes()).hexdigest(), 'sourceMetricsSha256': hashlib.sha256((SOURCE / 'font-metrics.json').read_bytes()).hexdigest(), 'atlasSha256': hashlib.sha256(texture_path.read_bytes()).hexdigest(), 'padding': metrics['sourceStyle']['padding'], 'sizes': sizes}
(ROOT / 'src/assets/data/native-font-metrics.json').write_text(json.dumps(data, separators=(',', ':')) + chr(10), encoding='utf-8')
print(json.dumps({'glyphs': sum(len(size['glyphs']) for size in sizes.values()), 'atlas': [atlas.width, atlas.height], 'usedHeight': y + row_height, 'sourceAtlasSha256': data['sourceAtlasSha256']}))
