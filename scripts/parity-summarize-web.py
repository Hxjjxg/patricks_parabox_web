"""Index actual saved browser captures; never mutate the raw traces or PNGs."""
import argparse
import hashlib
import json
import statistics
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('folder', type=Path)
parser.add_argument('--build-manifest', required=True, type=Path)
args = parser.parse_args()
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
result = {'buildManifest': args.build_manifest.as_posix(),
          'buildManifestSha256': digest(args.build_manifest), 'captures': []}
for path in sorted(args.folder.rglob('trace.json')):
    trace = json.loads(path.read_text(encoding='utf-8-sig'))
    if trace['starting']['levelName'] != trace['options']['level']:
        raise ValueError(f'Wrong level in {path}')
    viewport = trace['viewport']
    expected = trace['options']['expectedViewport']
    # DevTools reports1x as1.0000000298023224 on this browser. Preserve that
    # metadata; verify the requested physical backing dimensions exactly.
    for key in ('width', 'height'):
        if viewport[key] != expected[key]:
            raise ValueError(f'Wrong viewport in {path}: {key}')
    for axis, key in [('Width', 'width'), ('Height', 'height')]:
        if viewport['canvas' + axis] != expected[key] * expected['dpr']:
            raise ValueError(f'Wrong canvas dimensions in {path}')
    stamps = [frame['timestamp'] for frame in trace['frames']]
    deltas = [right - left for left, right in zip(stamps, stamps[1:])]
    files = {image['name'] + '.png' for image in trace['images']}
    if files != {png.name for png in path.parent.glob('*.png')}:
        raise ValueError(f'Missing or unindexed image in {path}')
    result['captures'].append({'directory': path.parent.name, 'options': trace['options'],
        'recordedAt': trace['recordedAt'], 'viewport': viewport, 'frames': len(stamps),
        'frameIntervalsMs': {'min': min(deltas) if deltas else None,
            'median': statistics.median(deltas) if deltas else None,
            'max': max(deltas) if deltas else None, 'above50': sum(x > 50 for x in deltas)},
        'starting': trace['starting'], 'ending': trace['ending'],
        'traceSha256': digest(path), 'pngSha256': {name: digest(path.parent / name) for name in sorted(files)}})
(args.folder / 'capture-index.json').write_text(json.dumps(result, indent=2) + chr(10), encoding='utf-8')
print(json.dumps({'captures': len(result['captures']),
    'images': sum(len(row['pngSha256']) for row in result['captures']),
    'frames': sum(row['frames'] for row in result['captures']),
    'longFrames': {row['directory']: row['frameIntervalsMs'] for row in result['captures'] if row['frameIntervalsMs']['above50']}}))
