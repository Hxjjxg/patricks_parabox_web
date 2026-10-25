"""Index raw GUI/TextGenerator comparators without fitting a text offset."""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
TEXTS = ['Move', 'Undo', 'Redo', 'Menu', 'M', 'U', 'MM', 'UU', 'Move ', 'Undo ', 'Reset puzzle', 'Note: You can undo a reset']


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


manifest_path = EVIDENCE / 'manifest.json'
manifest = read(manifest_path)
captures, rows, atlas_hashes = [], [], []
for size in [12, 16, 20]:
    for origin in ['integer', 'fraction']:
        name = f'native-gui-font-variety-size{size}-{origin}-v12-20261025'
        directory = EVIDENCE / name
        data = read(directory / 'gui-font-pack.json')
        analysis = read(directory / 'mask-alignment-analysis.json')
        assert data['screenWidth'] == 800 and data['screenHeight'] == 600
        assert [sample['text'] for sample in data['samples']] == TEXTS
        assert len(analysis['samples']) == 12 and data['charactersPerSize'] == 95
        assert all(len(metrics['glyphs']) == 95 and all(glyph['found'] for glyph in metrics['glyphs']) for metrics in data['metrics'])
        glyphs = {glyph['character']: glyph for metrics in data['metrics'] if metrics['fontSize'] == size for glyph in metrics['glyphs']}
        for sample, measured in zip(data['samples'], analysis['samples']):
            assert sample['fontSize'] == measured['size'] == size and sample['text'] == measured['text']
            assert sample['fontAtlasTextureId'] == data['fontAtlasTextureId']
            assert sample['fontStyle'] == 'Normal' and sample['alignment'] == 'MiddleCenter'
            assert sample['rect'][2:] == [362, 82] and sample['calcHeight'] <= 82
            assert measured['whiteMaskDiff'] == 0 and measured['secondBestDiff'] > 0
            assert measured['baseline'] == measured['genericSnapPrediction']['baseline']
            expected_prefix = [0]
            for character in sample['text']:
                expected_prefix.append(expected_prefix[-1] + glyphs[character]['advance'])
            advance = expected_prefix[-1]
            generators = sample['textGenerators']
            assert len(generators) == 4
            for generated in generators:
                assert generated['populated'] and len(generated['lines']) == 1
                assert generated['preferredWidth'] == advance == sample['calcSize'][0]
                actual_prefix = [character['cursorPos']['x'] for character in generated['characters']]
                assert len(actual_prefix) == len(expected_prefix)
                assert [position - actual_prefix[0] for position in actual_prefix] == expected_prefix
            full_ul = next(g for g in generators if g['anchor'] == 'UpperLeft' and g['extentsKind'] == 'full-GUI-rect')
            full_mc = next(g for g in generators if g['anchor'] == 'MiddleCenter' and g['extentsKind'] == 'full-GUI-rect')
            difference = measured['penX'] - measured['genericSnapPrediction']['penX']
            assert difference == (-1 if advance % 2 else 0)
            rows.append({'capture': name, 'size': size, 'origin': origin, 'text': sample['text'], 'rect': sample['rect'], 'advanceWidth': advance, 'advanceParity': 'odd' if advance % 2 else 'even', 'nativeGuiCalcWidth': sample['calcSize'][0], 'textGeneratorPreferredWidth': full_ul['preferredWidth'], 'allFourGeneratorsPrefixAdvancesMatchAtlas': True, 'nativeGuiCursorX': sample['cursors'][0][0], 'middleCenterFullRectFirstCursorX': full_mc['characters'][0]['cursorPos']['x'], 'upperLeftFirstQuadX': full_ul['vertices'][0][0], 'middleCenterFirstQuadX': full_mc['vertices'][0][0], 'actualPenX': measured['penX'], 'genericPenX': measured['genericSnapPrediction']['penX'], 'observedDifference': difference, 'baseline': measured['baseline'], 'verticalPredictionMatches': True, 'whiteMaskDiff': measured['whiteMaskDiff'], 'secondBestMaskDiff': measured['secondBestDiff']})
        screen = (directory / 'screen.png').read_bytes()
        assert screen[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', screen[16:24]) == (800, 600)
        hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'hashes.json'}
        write(directory / 'hashes.json', {'algorithm': 'SHA256', 'files': hashes})
        atlas_hashes.append(hashes['font-atlas.png'])
        entry = {'id': name, 'kind': 'explicit-gui-varied-string-overlay', 'status': 'valid-diagnostic', 'directory': str(directory.relative_to(ROOT)).replace('\\', '/'), 'width': 800, 'height': 600, 'fontSize': size, 'origin': origin, 'exactMaskSamples': 12, 'currentGenerationAsciiGlyphs': 285, 'observerBuild': read(directory / 'observer-build.json'), 'hashes': hashes}
        captures.append(entry)
        if not any(entry['id'] == name for entry in manifest.setdefault('fontReadbacks', [])):
            manifest['fontReadbacks'].append(entry)
assert len(rows) == 72 and len(set(atlas_hashes)) == 1
odd = [row for row in rows if row['advanceParity'] == 'odd']
assert len(odd) == 26 and all(row['observedDifference'] == -1 for row in odd)
index = {'schemaVersion': 1, 'captures': captures, 'samples': rows, 'results': {'exactUniqueMasks': 72, 'verticalMatches': 72, 'allFourGeneratorPrefixMatches': 72, 'guiAdvancePreferredWidthMatches': 72, 'oddWidthCases': 26, 'oddWidthOneLeftObserved': 26, 'evenWidthCases': 46, 'evenWidthGenericMatches': 46, 'byteIdenticalAtlases': 6}, 'interpretation': {'H1': 'All odd total advances associate with one-left measured pen at fixed even362width, all even advances match; invariant across the two tested origins.', 'H2': 'First glyph or visible ink alone is insufficient: at16px Move40 matches but Move-plus-space47 fails while glyph prefix/ink stays identical.', 'H3': 'No within-string shaping discrepancy: all atlas integer prefixes match all four generators and exact GUI masks. GUI raster placement still differs from GUI cursor/TextGenerator generic start on odd cases.'}, 'limits': ['No conditional one-pixel correction is applied or proposed as source-derived behavior.', 'Fixed even362width/MiddleCenter/two origins do not prove a universal snapping rule across widths, anchors, signs or scripts.', 'TextGenerator full-rect and rect-minus-padding extents are explicit comparators, not an assumed private GUI implementation.', 'Explicit diagnostic overlays are not natural gameplay or final visual approval.']}
write(EVIDENCE / 'font-variety-native-index.json', index)
write(manifest_path, manifest)
print(json.dumps(index['results']))
