"""Validate native GUI sampling evidence without applying an empirical offset."""
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
TEXTS = ['Move', 'Undo', 'U', 'Move ', 'Note: You can undo a reset']
ORIGINS = [-1, -.75, -.5, -.25, 0, .25, .5, .75, 1]
FONT_SOURCE = Path('F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Font/Jost-SemiBold.ttf')


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def snap(value):
    return math.ceil(value - .5)


manifest_path = EVIDENCE / 'manifest.json'
manifest = read(manifest_path)
captures, rows = [], []
atlas_hashes, sources, builds = set(), set(), set()
raster_groups = defaultdict(list)
raw_vertex_count = raw_quad_count = 0
for size in [12, 16, 20]:
    for width in [361, 362, 363]:
        for text_index, text in enumerate(TEXTS):
            name = f'native-gui-font-sampling-s{size}-w{width}-t{text_index}-v13-20261025'
            directory = EVIDENCE / name
            data = read(directory / 'gui-font-pack.json')
            analysis = read(directory / 'mask-alignment-analysis.json')
            build = read(directory / 'observer-build.json')
            assert data['requestId'] == name and data['probeKind'] == 'pixel-center-sampling-matrix'
            assert (data['screenWidth'], data['screenHeight']) == (800, 600)
            assert data['samplingMatrixWidth'] == width and data['nativeGuiMeshVerticesExposed'] is False
            assert data['charactersPerSize'] == 95 and len(data['metrics']) == 3
            assert all(len(metrics['glyphs']) == 95 and all(glyph['found'] for glyph in metrics['glyphs']) for metrics in data['metrics'])
            assert len(data['samples']) == len(analysis['samples']) == 9
            assert [sample['rect'][0] for sample in data['samples']] == ORIGINS
            assert build['requestedFontSize'] == size and build['requestedWidth'] == width
            assert build['requestedTextIndex'] == text_index and build['requestedText'] == text
            assert build['buildWarnings'] == build['buildErrors'] == 0
            builds.add((build['sourceSha256'], build['dllSha256']))
            sources.add(json.dumps(data['fontSource'], sort_keys=True))
            glyphs = {glyph['character']: glyph for metrics in data['metrics'] if metrics['fontSize'] == size for glyph in metrics['glyphs']}
            screen = Image.open(directory / 'screen.png').convert('RGB')
            assert screen.size == (800, 600)
            for sample, measured in zip(data['samples'], analysis['samples']):
                x, y, w, h = sample['rect']
                assert sample['fontSize'] == measured['size'] == size
                assert sample['text'] == measured['text'] == text
                assert sample['fontAtlasTextureId'] == data['fontAtlasTextureId']
                assert sample['fontStyle'] == 'Normal' and sample['alignment'] == 'MiddleCenter'
                assert [w, h] == [width, 82] and sample['calcHeight'] <= h
                assert measured['whiteMaskDiff'] == 0 and measured['secondBestDiff'] > 0
                assert measured['baseline'] == measured['genericSnapPrediction']['baseline']
                prefix = [0]
                for character in text:
                    prefix.append(prefix[-1] + glyphs[character]['advance'])
                advance = prefix[-1]
                assert advance == sample['calcSize'][0]
                assert sample['cursors'][0][0] == x + w / 2 - math.ceil(advance / 2)
                assert all(cursor[0] - sample['cursors'][0][0] == prefix[index] for index, cursor in zip(sample['cursorIndices'], sample['cursors']))
                comparators = []
                assert len(sample['textGenerators']) == 4
                for generated in sample['textGenerators']:
                    assert generated['populated'] and len(generated['lines']) == 1
                    assert generated['preferredWidth'] == advance
                    positions = [character['cursorPos']['x'] for character in generated['characters']]
                    assert [position - positions[0] for position in positions] == prefix
                    if generated['anchor'] == 'MiddleCenter':
                        assert positions[0] == math.ceil(w / 2) - math.ceil(advance / 2)
                    vertices = generated['rawVertices']
                    assert len(vertices) == len(generated['vertices']) == 4 * len(text.replace(' ', ''))
                    raw_vertex_count += len(vertices)
                    for raw, plain in zip(vertices, generated['vertices']):
                        assert [raw['position'][axis] for axis in ['x', 'y', 'z']] == plain
                        assert raw['color'] == dict(r=255, g=255, b=255, a=255)
                    for quad_index, character in enumerate(text.replace(' ', '')):
                        quad = vertices[quad_index * 4:quad_index * 4 + 4]
                        for vertex, corner in zip(quad, ['uvTopLeft', 'uvTopRight', 'uvBottomRight', 'uvBottomLeft']):
                            assert {axis: vertex['uv0'][axis] for axis in ['x', 'y']} == glyphs[character][corner]
                        raw_quad_count += 1
                    endpoint = lambda vertex: dict(position=[vertex['position'][axis] for axis in ['x', 'y', 'z']], uv0=[vertex['uv0'][axis] for axis in ['x', 'y']])
                    comparators.append(dict(anchor=generated['anchor'], extentsKind=generated['extentsKind'], firstCursor=generated['characters'][0]['cursorPos'], firstQuadEndpoints=[endpoint(vertices[index]) for index in [0, 2]], lastQuadEndpoints=[endpoint(vertices[index]) for index in [-4, -2]], rawVerticesSha256=digest(json.dumps(vertices, sort_keys=True, separators=(',', ':')).encode())))
                # Every nonblack RGB pixel is retained, including low-alpha antialiasing.
                # Integer alignment comes from the independent white-mask search.
                pixels = [(xx - measured['penX'], yy - measured['baseline'], *screen.getpixel((xx, yy)))
                          for yy in range(max(0, math.floor(y)), min(screen.height, math.ceil(y + h)))
                          for xx in range(max(0, math.floor(x)), min(screen.width, math.ceil(x + w)))
                          if any(screen.getpixel((xx, yy)))]
                raster_hash = digest(json.dumps(pixels, separators=(',', ':')).encode())
                raster_groups[(size, text)].append(raster_hash)
                difference = measured['penX'] - measured['genericSnapPrediction']['penX']
                assert difference == (-1 if advance % 2 else 0)
                assert measured['penX'] - snap(x) == analysis['samples'][4]['penX']
                rows.append(dict(capture=name, size=size, text=text, rect=sample['rect'], advanceWidth=advance, advanceParity=advance % 2, widthParity=width % 2, actualPenX=measured['penX'], actualBaseline=measured['baseline'], genericPenX=measured['genericSnapPrediction']['penX'], genericDifference=difference, nativeGuiCursorX=sample['cursors'][0][0], simpleFinalCursorSnapX=snap(sample['cursors'][0][0]), simpleFinalCursorSnapMatches=measured['penX'] == snap(sample['cursors'][0][0]), normalizedFullRgbSha256=raster_hash, nonblackPixelCount=len(pixels), whiteMaskDiff=0, secondBestMaskDiff=measured['secondBestDiff'], textGeneratorComparators=comparators))
            hashes = {path.name: digest(path.read_bytes()) for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'hashes.json'}
            write(directory / 'hashes.json', dict(algorithm='SHA256', files=hashes))
            atlas_hashes.add(hashes['font-atlas.png'])
            entry = dict(id=name, kind='explicit-gui-pixel-center-sampling-overlay', status='valid-diagnostic', directory=directory.relative_to(ROOT).as_posix(), width=800, height=600, fontSize=size, guiRectWidth=width, text=text, exactMaskSamples=9, rawTextGeneratorComparators=36, nativeGuiMeshVerticesExposed=False, observerBuild=build, hashes=hashes)
            captures.append(entry)
            if not any(old['id'] == name for old in manifest.setdefault('fontReadbacks', [])):
                manifest['fontReadbacks'].append(entry)

assert len(rows) == 405 and len(captures) == 45
assert len(atlas_hashes) == len(sources) == len(builds) == 1
assert all(len(values) == 27 and len(set(values)) == 1 for values in raster_groups.values())
parities = []
for width_parity in [0, 1]:
    for advance_parity in [0, 1]:
        selected = [row for row in rows if row['widthParity'] == width_parity and row['advanceParity'] == advance_parity]
        parities.append(dict(widthParity=width_parity, advanceParity=advance_parity, samples=len(selected), genericDifferences=dict(Counter(row['genericDifference'] for row in selected))))
source_artifact = dict(path=FONT_SOURCE.as_posix(), provenance='AssetRipper-exported font artifact; runtime asset name agrees, runtime private font bytes are not read back', sizeBytes=FONT_SOURCE.stat().st_size, sha256=digest(FONT_SOURCE.read_bytes()))
results = dict(captures=45, exactUniqueMasks=405, verticalMatches=405, oddAdvanceCases=162, oddAdvanceOneLeftObserved=162, evenAdvanceCases=243, evenAdvanceGenericMatches=243, nativeGuiCursorFormulaMatches=405, centeredGeneratorCursorFormulaMatches=405, simpleFinalGuiCursorSnapMatches=sum(row['simpleFinalCursorSnapMatches'] for row in rows), simpleFinalGuiCursorSnapMismatches=sum(not row['simpleFinalCursorSnapMatches'] for row in rows), rawTextGeneratorComparators=1620, rawVerticesChecked=raw_vertex_count, rawQuadsUvMatchedToCurrentAtlas=raw_quad_count, normalizedFullRgbInvariantGroups=15, samplesPerInvariantGroup=27, byteIdenticalAtlases=45, parities=parities)
index = dict(schemaVersion=1, captures=captures, samples=rows, results=results, fontSource=read(EVIDENCE / captures[0]['id'] / 'gui-font-pack.json')['fontSource'], exportedFontArtifact=source_artifact, observables={'nativeGuiCursorX': 'x + width/2 - ceil(advance/2), 405/405 in this matrix', 'centeredTextGeneratorFirstCursorX': 'ceil(width/2) - ceil(advance/2), 405/405 across both explicit extents; not the private GUI mesh', 'originQuantizer': 'ceil(x - 0.5): pen increments after x=-0.5 and x=+0.5, independently of width/text in the sampled range', 'actualGuiRaster': 'Each size/text has byte-identical normalized full RGB pixels across all27 width/origin cases, including antialiasing. No continuous quarter-origin change in glyph sampling is observed.'}, interpretation={'H1': 'Odd-advance association survives361/362/363 widths and all nine origins. It remains an empirical association rather than a source-derived correction.', 'H2': 'Width parity alone does not remove the odd-advance mismatch. GUI cursor retains half-width while centered TextGenerator cursor rounds width upward; neither may be called the actual GUI mesh.', 'H3': 'A single final ceil(cursorX-0.5) rule fails174/405. Full RGB invariance demonstrates integer-translated raster output in this matrix, not continuous fraction-dependent bilinear variation. Private GUI mesh positions remain unavailable, so no universal pixel-center mechanism is proved.'}, limits=['No production renderer change or conditional one-pixel offset is applied.', 'All overlays use one native800x600 resolution, MiddleCenter alignment, integer widths/heights, ASCII Jost font, and the sampled origins only.', 'TextGenerator raw UIVertex endpoints/UV0 are explicit comparator data, not raw GUI.Label mesh data.', 'A shader filtering label and sampled raster invariance do not identify the unexposed native GUI geometry rounding implementation.', 'Explicit overlays do not constitute natural gameplay visual approval.'])
write(EVIDENCE / 'font-sampling-native-index.json', index)
write(manifest_path, manifest)
print(json.dumps(results))
