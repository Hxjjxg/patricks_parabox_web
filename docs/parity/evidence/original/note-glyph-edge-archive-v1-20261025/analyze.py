import hashlib
import json
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[4]
BASE = ROOT / 'docs/parity/evidence/original'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def rgba(path):
    return Image.open(path).convert('RGBA')

def native_n(folder):
    directory = BASE / folder
    metadata = directory / ('gui-font-pack.json' if (directory / 'gui-font-pack.json').exists() else 'font-metrics.json')
    record = json.loads(metadata.read_text(encoding='utf-8-sig'))
    glyph = next(g for size in record['metrics'] if size['fontSize'] == 20 for g in size['glyphs'] if g['character'] == 'N')
    atlas = rgba(directory / 'font-atlas.png')
    def uv(key):
        value = glyph[key]
        return value if isinstance(value, list) else [value['x'], value['y']]
    tl, tr, bl = uv('uvTopLeft'), uv('uvTopRight'), uv('uvBottomLeft')
    alpha = []
    for y in range(18):
        for x in range(16):
            u = tl[0] + (tr[0]-tl[0]) * (x+.5)/16 + (bl[0]-tl[0]) * (y+.5)/18
            v = tl[1] + (tr[1]-tl[1]) * (x+.5)/16 + (bl[1]-tl[1]) * (y+.5)/18
            alpha.append(atlas.getpixel((int(u*atlas.width), int((1-v)*atlas.height)))[3])
    return record, glyph, alpha, metadata

tutorial_path = BASE / 'intro-third-tutorial-native-derived.json'
tutorial = json.loads(tutorial_path.read_text(encoding='utf-8-sig'))
capture = tutorial['captures'][2]
reference = BASE / capture['id'] / capture['settledFrame']['file']
screen = rgba(reference)
packed_metadata = ROOT / 'src/assets/data/native-font-metrics.json'
packed_data = json.loads(packed_metadata.read_text(encoding='utf-8-sig'))
glyph = packed_data['sizes']['20']['glyphs']['N']
packed = ROOT / 'src/assets/fonts/native-jost-atlas.png'
atlas = rgba(packed)
sx, sy, width, height = glyph['frame']
alpha = [atlas.getpixel((sx+x, sy+y))[3] for y in range(height) for x in range(width)]
assert (width, height) == (16, 18)
assert all(alpha[y*width] == 0 for y in range(height))

# Boundary samples lie outside all glyph ink, rather than estimating alpha.
color = screen.getpixel((110, 582))[:3]
assert color == (78, 78, 78)
left = right = 110
while screen.getpixel((left-1, 582))[:3] == color: left -= 1
while screen.getpixel((right+1, 582))[:3] == color: right += 1
top = bottom = 582
while screen.getpixel((110, top-1))[:3] == color: top -= 1
while screen.getpixel((110, bottom+1))[:3] == color: bottom += 1
background_rect = [left, top, right+1, bottom+1]
assert background_rect == [107, 571, 128, 591]
assert all(screen.getpixel(p)[:3] == (0, 0, 0) for p in [(106,582),(128,582),(110,570),(110,591)])

rows = []
differences = []
pen_x, glyph_top = 114, 584
for y in range(height):
    row = []
    for x in range(width):
        px, py = pen_x+x, glyph_top+y
        background = 78 if left <= px <= right and top <= py <= bottom else 0
        a = alpha[y*width+x]
        expected = (255*a + background*(255-a) + 127)//255
        actual = screen.getpixel((px,py))[:3]
        row.append({'alpha':a, 'background':background, 'expected':expected, 'actual':list(actual)})
        if actual != (expected,expected,expected): differences.append([px,py,expected,list(actual)])
    rows.append({'y':glyph_top+y, 'pixels':row})
assert not differences, differences

archives = []
for folder in ['native-main-font-ascii-v3-20261025', 'native-gui-font-variety-size20-integer-v12-20261025', 'native-gui-font-variety-size20-fraction-v12-20261025']:
    record, original_glyph, original_alpha, metadata = native_n(folder)
    assert original_alpha == alpha
    entry = {'id':folder, 'metadataSha256':digest(metadata), 'atlasSha256':digest(BASE/folder/'font-atlas.png'), 'n20AlphaSha256':hashlib.sha256(bytes(original_alpha)).hexdigest(), 'alphaPixelsCompared':len(alpha), 'alphaDifferences':0, 'characterInfo':original_glyph}
    if 'samples' in record:
        image = rgba(BASE/folder/'screen.png')
        errors = [[x,y] for y in range(18) for x in range(16) if image.getpixel((475+x,517+y))[:3] != (alpha[y*16+x],)*3]
        assert not errors, errors
        entry.update({'controlledBlackScreenSha256':digest(BASE/folder/'screen.png'), 'controlledBlackNRect':[475,517,16,18], 'controlledBlackPixelsCompared':288, 'controlledBlackPixelDifferences':0})
    archives.append(entry)

temporal = []
for number in [25,33,40,49,54]:
    path = reference.parent / f'frame-{number:04}.png'
    image = rgba(path)
    b = image.getpixel((114,586))[:3]
    actual = image.getpixel((115,586))[:3]
    assert b[0] == b[1] == b[2]
    expected = (115*255 + b[0]*140 + 127)//255
    assert actual == (expected,)*3
    temporal.append({'path':path.relative_to(ROOT).as_posix(),'sha256':digest(path),'backgroundWitness':[114,586],'backgroundRGB':list(b),'glyphCoordinate':[115,586],'alpha':115,'expected':expected,'actualRGB':list(actual)})

source = Path('F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp/Draw.cs')
lines = source.read_text(encoding='utf-8-sig').splitlines()
spans = [(1202,1226),(1477,1493),(2473,2476),(5493,5510),(5528,5547)]
source_excerpt = '\n\n'.join('\n'.join(f'{i+1}: {lines[i]}' for i in range(a-1,b)) for a,b in spans)
(OUT/'source-excerpts.txt').write_text(source_excerpt+'\n',encoding='utf-8')
result = {
    'schemaVersion':1, 'date':'2026-10-25', 'scope':'Read-only archived native Note N20 edge; no new native input, probe, restart or source changes',
    'reference':{'path':reference.relative_to(ROOT).as_posix(), 'sha256':digest(reference), 'screen':[1280,720], 'frame':capture['settledFrame']['frame']},
    'packedAtlas':{'path':packed.relative_to(ROOT).as_posix(), 'sha256':digest(packed), 'metadataSha256':digest(packed_metadata), 'n20AlphaSha256':hashlib.sha256(bytes(alpha)).hexdigest()},
    'background':{'method':'Exact gray78 horizontal run on glyph-free row582 and vertical run at glyph-free column110, with immediate outside pixels black; not estimated from target glyph alpha', 'rectExclusive':background_rect, 'rgb':[78,78,78], 'horizontalWitness':{'y':582,'xRangeInclusive':[left,right]}, 'verticalWitness':{'x':110,'yRangeInclusive':[top,bottom]}},
    'glyph':{'character':'N', 'fontSize':20, 'rect':[pen_x,glyph_top,width,height], 'pixelsCompared':width*height, 'exactPixels':width*height-len(differences), 'differences':differences, 'rows':rows},
    'example':{'coordinate':[115,586], 'alpha':115, 'background':78, 'expected':158, 'actual':[158,158,158], 'formula':'round(255*115/255 + 78*(1-115/255))'},
    'archives':archives, 'temporalSamples':temporal, 'source':{'path':source.as_posix(),'sha256':digest(source),'spans':spans},
    'conclusion':'Original atlas N20 exactly composites over actual rectangular background. Black-background threshold comparison was invalid at the overlapping gray void square.',
    'limits':['Exact old-frame void particle object/state was not logged. Void attribution follows visible moving gray rectangle and source draw order, not private object telemetry.','No general shader/filter/subpixel parity claim follows from this localized result.']
}
(OUT/'analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
screen.crop((80,540,280,660)).save(OUT/'native-note-context-crop.png')
screen.crop((110,580,135,605)).resize((500,500),Image.Resampling.NEAREST).save(OUT/'native-N20-nearest20x.png')
print(json.dumps({'nativeGlyphPixels':width*height,'exactPixels':width*height-len(differences),'backgroundRect':background_rect,'sameAtlasArchives':len(archives),'controlledBlackChecks':576}))
