"""Additive original Inconsolata font registry with explicit startup-fade limits."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
SOURCE = Path('F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp/Draw.cs')

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

manifest = read(EVIDENCE / 'manifest.json')
entries = []
for version in [1, 2, 3]:
    name = f'native-tui-fixed-font-v{version}-20261025' if version < 3 else 'native-tui-fixed-font-geometry-v3-20261025'
    directory = EVIDENCE / name
    data = read(directory / 'tui-font-metrics.json')
    assert data['drawStyle'] == 'TUI_COLOR' and data['levelName'] == 'text_1'
    assert data['fontAssetName'] == 'Inconsolata-SemiBold' and data['fontNames'] == ['Inconsolata']
    assert [size['fontSize'] for size in data['metrics']] == [56]
    glyphs = data['metrics'][0]['glyphs']
    assert len(glyphs) == 95 and all(glyph['found'] for glyph in glyphs)
    assert len(data['actualLabels']) == 100
    assert all(sample['fontSize'] == 56 and sample['actualFontStyle'] == 'Normal' and sample['actualAlignment'] == 'LowerCenter' for sample in data['actualLabels'])
    assert Image.open(directory / 'screen.png').size == (800, 600)
    assert Image.open(directory / 'font-atlas.png').size == (data['texture']['width'], data['texture']['height'])
    hashes = {path.name: digest(path) for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'hashes.json'}
    write(directory / 'hashes.json', hashes)
    entry = dict(id=name, status='valid' if version >= 2 else 'diagnostic-startup-fade',
        directory='docs/parity/evidence/original/' + name, font=data['fontAssetName'], fontSizes=[56], glyphCount=95,
        actualLabels=100, width=800, height=600, sourceStyle=data['sourceStyle'], texture=data['texture'], hashes=hashes)
    if version == 1:
        entry.update(supersededBy='native-tui-fixed-font-v2-20261025', note='Glyph metrics, atlas and GUI geometry are valid; gameplay screenshot colors are attenuated by initial startup fade. Preserve raw capture; do not use as a full-color gameplay reference.')
    else:
        assert data['startupFadeComplete'] and data['postInitializingT'] >= data['initFadeLength']
        analysis = read(directory / 'lower-center-mask-analysis.json')
        assert len(analysis['measurements']) == 100
        assert all(sample['maskDiff'] == 0 and sample['secondBestDiff'] > 0 for sample in analysis['measurements'])
        entry.update(startupFadeComplete=True, exactUniqueMaskSamples=100, hintedAscentDerivation=analysis['hintedAscentDerivation'],
            note='Actual natural text_1 TUI_COLOR screenshot after explicit native startup-fade completion; same-generation ASCII atlas and100 independently exact LowerCenter glyph masks. No diagnostic overlay.')
        if version == 3:
            original = read(EVIDENCE / 'native-tui-fixed-font-v2-20261025/tui-font-metrics.json')
            fields = ['text', 'fontSize', 'actualFontName', 'actualFontStyle', 'actualAlignment', 'color', 'rect', 'calcSize', 'lineHeight', 'cursor0', 'cursorEnd']
            assert all(all(before[key] == after[key] for key in fields) for before, after in zip(original['actualLabels'], data['actualLabels']))
            assert all(sample.get('nativeLevelArguments') and sample.get('setDrawRectArguments') for sample in data['actualLabels'])
            entry.update(unchangedFromUnpatchedV2Labels=100, exactOriginalGeometryArguments=True,
                nativeLevelArguments=list({json.dumps(sample['nativeLevelArguments'], sort_keys=True): sample['nativeLevelArguments'] for sample in data['actualLabels']}.values()))
    entries.append(entry)
    if not any(existing['id'] == name for existing in manifest.setdefault('fontReadbacks', [])):
        manifest['fontReadbacks'].append(entry)

index = dict(schemaVersion=1, nativeDrawSourceSha256=digest(SOURCE), captures=entries,
    observedFont='Inconsolata-SemiBold / Inconsolata / FontStyle.Normal / size56 / GUI LowerCenter',
    geometry='DrawTUI floors availableWidth/columnCount before division by float32 cellYToX. text_1 at800x600 selects56, not57. TUIDrawLevel uses a two-cell-high GUI rectangle shifted up one cell.',
    provenActualLabelRules=dict(penX='ceil(cursor0.x-.5)', baseline='cursor0.y + native hinted ascent48',
        styleBaseline='rect.y+rect.height-nativeCalcSizeHeight65+paddingTop3+nativeHintedAscent48; equivalently rect.bottom-14 for these actual labels'),
    scope='100 actual Inconsolata-SemiBold56 labels. This is not a universal horizontal rule for Jost or untested fonts.',
    atlasByteIdenticalAcrossVersions=len({entry['hashes']['font-atlas.png'] for entry in entries}) == 1)
write(EVIDENCE / 'tui-font-native-index.json', index)
write(EVIDENCE / 'manifest.json', manifest)
print(json.dumps(dict(fontCaptures=3, glyphsPerCapture=95, actualLabelsPerCapture=100, exactUniqueMasks=200,
    startupFadeGuarded=True, atlasByteIdentical=index['atlasByteIdenticalAcrossVersions'])))
