"""Validate one actual-GUI alignment discriminator without inventing offsets."""
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
NAME = 'native-gui-font-alignment-pairs-v14-20261025'
DIRECTORY = EVIDENCE / NAME


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def snap(value):
    return math.ceil(value - .5)


data = read(DIRECTORY / 'gui-font-pack.json')
analysis = read(DIRECTORY / 'mask-alignment-analysis.json')
build = read(DIRECTORY / 'observer-build.json')
screen = Image.open(DIRECTORY / 'screen.png').convert('RGB')
atlas = Image.open(DIRECTORY / 'font-atlas.png').convert('RGBA')
assert data['probeKind'] == 'actual-gui-alignment-pairs'
assert data['requestId'] == NAME and data['nativeGuiMeshVerticesExposed'] is False
assert screen.size == (800, 600) and (data['screenWidth'], data['screenHeight']) == screen.size
assert len(data['samples']) == len(analysis['samples']) == 16
assert build['pairs'] == 8 and build['labels'] == 16
assert build['buildWarnings'] == build['buildErrors'] == 0
assert data['charactersPerSize'] == 95
assert all(len(metrics['glyphs']) == 95 and all(glyph['found'] for glyph in metrics['glyphs']) for metrics in data['metrics'])
glyphs = {glyph['character']: glyph for metrics in data['metrics'] if metrics['fontSize'] == 16 for glyph in metrics['glyphs']}
atlas_alpha = {}
for character, glyph in glyphs.items():
    min_x, min_y, max_x, max_y = glyph['bounds']
    width, height = max_x - min_x, max_y - min_y
    tl, tr, bl = [glyph[key] for key in ['uvTopLeft', 'uvTopRight', 'uvBottomLeft']]
    pixels = {}
    for y in range(height):
        for x in range(width):
            u = tl['x'] + (tr['x'] - tl['x']) * (x + .5) / width + (bl['x'] - tl['x']) * (y + .5) / height
            v = tl['y'] + (tr['y'] - tl['y']) * (x + .5) / width + (bl['y'] - tl['y']) * (y + .5) / height
            alpha = atlas.getpixel((math.floor(u * atlas.width), math.floor((1 - v) * atlas.height)))[3]
            if alpha:
                pixels[(min_x + x, -max_y + y)] = alpha
    atlas_alpha[character] = pixels

samples, pair_groups, raster_groups = [], defaultdict(list), defaultdict(list)
uv_quads = raw_vertices = total_nonblack = 0
for sample, measured in zip(data['samples'], analysis['samples']):
    assert sample['fontSize'] == measured['size'] == 16
    assert sample['text'] == measured['text'] and sample['text'] in ['Move', 'U']
    assert sample['pairRole'] == sample['alignment']
    assert sample['fontStyle'] == 'Normal' and sample['padding'] == [0, 0, 3, 3]
    assert sample['contentOffset'] == [0, 0] and sample['rect'][3] == 82
    assert sample['fontAtlasTextureId'] == data['fontAtlasTextureId']
    assert measured['whiteMaskDiff'] == 0 and measured['secondBestDiff'] > 0
    prefix = [0]
    for character in sample['text']:
        prefix.append(prefix[-1] + glyphs[character]['advance'])
    advance = prefix[-1]
    assert advance == sample['calcSize'][0]
    assert all(cursor[0] - sample['cursors'][0][0] == prefix[index] for index, cursor in zip(sample['cursorIndices'], sample['cursors']))
    assert len(sample['textGenerators']) == 4
    for generated in sample['textGenerators']:
        assert generated['populated'] and generated['preferredWidth'] == advance
        positions = [character['cursorPos']['x'] for character in generated['characters']]
        assert [position - positions[0] for position in positions] == prefix
        vertices = generated['rawVertices']
        assert len(vertices) == len(generated['vertices']) == 4 * len(sample['text'])
        raw_vertices += len(vertices)
        for raw, plain in zip(vertices, generated['vertices']):
            assert [raw['position'][axis] for axis in ['x', 'y', 'z']] == plain
        for quad_index, character in enumerate(sample['text']):
            for raw, corner in zip(vertices[4 * quad_index:4 * quad_index + 4], ['uvTopLeft', 'uvTopRight', 'uvBottomRight', 'uvBottomLeft']):
                assert {axis: raw['uv0'][axis] for axis in ['x', 'y']} == glyphs[character][corner]
            uv_quads += 1
    rx, ry, rw, rh = sample['analysisRegion']
    assert [rw, rh] == [400, 64]
    native_pixels = {(x - measured['penX'], y - measured['baseline']): screen.getpixel((x, y))
                     for y in range(ry, ry + rh) for x in range(rx, rx + rw) if any(screen.getpixel((x, y)))}
    total_nonblack += len(native_pixels)
    raster_hash = digest(json.dumps([(x, y, *rgb) for (x, y), rgb in sorted(native_pixels.items())], separators=(',', ':')).encode())
    raster_groups[sample['text']].append(raster_hash)
    # Reconstruct complete grayscale, not only alpha>=240 masks.
    expected_alpha, pen = {}, 0
    for character in sample['text']:
        for (x, y), alpha in atlas_alpha[character].items():
            point = (pen + x, y)
            prior = expected_alpha.get(point, 0)
            expected_alpha[point] = round(alpha + prior * (255 - alpha) / 255)
        pen += glyphs[character]['advance']
    expected_rgb = {point: (alpha, alpha, alpha) for point, alpha in expected_alpha.items() if alpha}
    alpha_differences = sum(native_pixels.get(point, (0, 0, 0)) != expected_rgb.get(point, (0, 0, 0)) for point in native_pixels.keys() | expected_rgb.keys())
    assert alpha_differences == 0, (sample['index'], sample['text'], alpha_differences)
    result = dict(index=sample['index'], pairIndex=sample['pairIndex'], role=sample['pairRole'], text=sample['text'], rect=sample['rect'], analysisRegion=sample['analysisRegion'], pairOrigin=sample['pairOrigin'], sourceCenterCursor=sample['sourceCenterCursor'], actualCursor=sample['cursors'][0], advanceWidth=advance, actualPenX=measured['penX'], actualBaseline=measured['baseline'], whiteMaskDiff=0, secondBestMaskDiff=measured['secondBestDiff'], normalizedFullRgbSha256=raster_hash, nonblackPixels=len(native_pixels), completeAtlasAlphaRgbDifferences=0, finalCursorSnapPrediction=snap(sample['cursors'][0][0]), finalCursorSnapMatches=measured['penX'] == snap(sample['cursors'][0][0]))
    samples.append(result)
    pair_groups[sample['pairIndex']].append(result)

pairs = []
for pair_index, (center, left) in sorted(pair_groups.items()):
    assert center['role'] == 'MiddleCenter' and left['role'] == 'UpperLeft'
    assert center['text'] == left['text'] and center['rect'][2:] == left['rect'][2:]
    assert left['actualCursor'] == [center['actualCursor'][0] + 400, center['actualCursor'][1]]
    assert left['actualBaseline'] == center['actualBaseline']
    assert left['normalizedFullRgbSha256'] == center['normalizedFullRgbSha256']
    assert left['finalCursorSnapMatches']
    delta = left['actualPenX'] - 400 - center['actualPenX']
    assert delta == (1 if center['text'] == 'U' and center['rect'][2] == 362 else 0)
    pairs.append(dict(pairIndex=pair_index, text=center['text'], width=center['rect'][2], origin=center['pairOrigin'], centerCursor=center['actualCursor'], upperLeftCursor=left['actualCursor'], centerPenX=center['actualPenX'], upperLeftPenX=left['actualPenX'], upperLeftMinusColumnTranslation=left['actualPenX'] - 400, upperLeftMinusCenterPenX=delta, exactMatchingBaseline=center['actualBaseline'], normalizedFullRgbEqual=True))
assert len(pairs) == 8 and len({sample['frame'] for sample in data['samples']}) == 1
assert all(len(values) == 8 and len(set(values)) == 1 for values in raster_groups.values())
assert sum(any(rgb) for rgb in screen.getdata()) == total_nonblack
prior_atlas = EVIDENCE / 'native-gui-font-sampling-s16-w362-t2-v13-20261025/font-atlas.png'
assert digest((DIRECTORY / 'font-atlas.png').read_bytes()) == digest(prior_atlas.read_bytes())
hashes = {path.name: digest(path.read_bytes()) for path in sorted(DIRECTORY.iterdir()) if path.is_file() and path.name != 'hashes.json'}
write(DIRECTORY / 'hashes.json', dict(algorithm='SHA256', files=hashes))
results = dict(actualGuiSamples=16, actualGuiPairs=8, sameNativeFrame=True, exactUniqueMasks=16, matchedNativeCursorPairs=8, matchedBaselinePairs=8, matchedFullRgbPairs=8, completeAtlasAlphaRgbExactSamples=16, upperLeftFinalCursorSnapMatches=8, centeredFinalCursorSnapMatches=sum(sample['finalCursorSnapMatches'] for sample in samples if sample['role'] == 'MiddleCenter'), onePixelPairDifferences=2, normalizedRgbInvariantTextGroups=2, samplesPerRgbGroup=8, rawGeneratorComparators=64, rawVerticesChecked=raw_vertices, currentAtlasQuadUvMatches=uv_quads, nonblackPixelsAccounted=total_nonblack, atlasByteIdenticalToV13=True)
entry = dict(id=NAME, kind='actual-native-gui-alignment-pair-overlay', status='valid-diagnostic', directory=DIRECTORY.relative_to(ROOT).as_posix(), width=800, height=600, fontSize=16, pairs=8, samples=16, observerBuild=build, hashes=hashes)
index = dict(schemaVersion=1, capture=entry, results=results, pairs=pairs, samples=samples, fontSource=data['fontSource'], interpretation={'centering': 'At matched actual native cursors and identical full RGB glyph raster, only even-width U pairs have centered pen one pixel left of actual UpperLeft. This bounded discrepancy is alignment layout rather than generic UpperLeft glyph sampling.', 'origin': 'Actual UpperLeft pen follows ceil(cursorX-0.5) for all8sampled origins; this does not establish a universal draw rule for other glyphs/alignments/rects.', 'mechanism': 'Native GUI drawing/cursor/size implementations remain separate closed InternalCalls. No source-derived universal center rule or odd-specific correction is proved.'}, limits=['Only16pxMove/U, widths361/362, origins0/-0.25, MiddleCenter/UpperLeft and one800x600native frame are sampled.', 'Disjoint analysisRegion tiles isolate actual ink; nominal shifted label rectangles overlap neighboring rows and some extend past screen right, but all nonblack pixels are accounted within the16tiles.', 'The generic centered baseline/prediction fields in the reusable analyzer are not applicable to UpperLeft and are not used as its verification.', 'Raw TextGenerator meshes remain comparators, not private GUI.Label geometry.', 'No production source or font offset changes are applied.'])
write(EVIDENCE / 'font-alignment-pairs-native-index.json', index)
manifest_path = EVIDENCE / 'manifest.json'
manifest = read(manifest_path)
if not any(old['id'] == NAME for old in manifest.setdefault('fontReadbacks', [])):
    manifest['fontReadbacks'].append(entry)
write(manifest_path, manifest)
print(json.dumps(results))
