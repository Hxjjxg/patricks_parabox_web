"""Audit frozen v7 raw evidence without changing traces, images or hash lists."""
import hashlib
import json
import statistics
from pathlib import Path

root = Path(__file__).resolve().parent
repo = root.parents[3]
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = read(root / 'build-manifest.json')
manifest_sha = sha(root / 'build-manifest.json')
result = {
    'candidate': 'v7', 'head': manifest['head'],
    'status': 'immutable integrated verification candidate; known missing exact Hub fonts and unavailable native framebuffer conditions; NOT complete acceptance',
    'buildManifestSha256': manifest_sha, 'groups': {},
    'caseCount': 0, 'frames': 0, 'images': 0, 'hashedCaptureFiles': 0,
    'hashFailures': [], 'distHashFailures': [], 'sourceHashFailures': [],
    'provenanceFailures': [], 'guardFailures': [],
    'sourceFilesVerified': 0, 'distFilesVerified': 0, 'cases': [],
    'supplementalImages': [],
}
for label, base, hashes in [
    ('source', repo, manifest['sourceSha256']),
    ('dist', root / 'build-dist', manifest['distSha256']),
]:
    for name, expected in hashes.items():
        p = base / name
        if not p.is_file() or sha(p) != expected:
            result[label + 'HashFailures'].append(name)
        else:
            result[label + 'FilesVerified'] += 1
for trace_path in sorted(root.rglob('trace.json')):
    folder = trace_path.parent
    case = folder.relative_to(root).as_posix()
    trace = read(trace_path)
    hashes = read(folder / 'sha256.json')
    raw_images = {i['name'] + '.png' for i in trace['images']}
    if set(hashes) != raw_images | {'trace.json'}:
        result['guardFailures'].append([case, 'raw hash inventory differs from trace image inventory'])
    for name, expected in hashes.items():
        p = (folder / name).resolve()
        if not p.is_relative_to(folder) or not p.is_file() or sha(p) != expected:
            result['hashFailures'].append([case, name])
        else:
            result['hashedCaptureFiles'] += 1
    for p in sorted(folder.glob('*.png')):
        if p.name not in raw_images:
            result['supplementalImages'].append({'path': p.relative_to(root).as_posix(), 'sha256': sha(p), 'scope': 'derived unscaled inspection plate; excluded from raw capture counts'})
    provenance = trace['provenance']
    for key, expected in [('head', manifest['head']), ('manifestSha256', manifest_sha), ('candidate', 'web-production-candidate-v7')]:
        if provenance.get(key) != expected:
            result['provenanceFailures'].append([case, key, provenance.get(key)])
    viewport = trace['viewport']
    expected_viewport = trace['options']['expectedViewport']
    for dim in ['width', 'height']:
        if viewport[dim] != expected_viewport[dim] or viewport['canvas' + dim.title()] != expected_viewport[dim] * expected_viewport['dpr']:
            result['guardFailures'].append([case, 'viewport ' + dim])
    if trace['options'].get('level') and trace['starting']['levelName'] != trace['options']['level']:
        result['guardFailures'].append([case, 'starting level'])
    stamps = [frame['timestamp'] for frame in trace['frames']]
    deltas = [b - a for a, b in zip(stamps, stamps[1:])]
    if any(delta <= 0 for delta in deltas):
        result['guardFailures'].append([case, 'nonincreasing rAF timestamps'])
    category = case.split('/')[0]
    row = {'case': case, 'category': category,
        'level': trace['options'].get('level', trace['starting']['levelName'] + ' then ' + trace['ending']['levelName']),
        'frames': len(stamps), 'images': len(raw_images),
        'startingMoveCount': trace['starting']['moveCount'],
        'endingMoveCount': trace['ending']['moveCount'],
        'viewport': viewport, 'traceSha256': sha(trace_path),
        'frameIntervalsMs': {'min': min(deltas) if deltas else None, 'median': statistics.median(deltas) if deltas else None, 'max': max(deltas) if deltas else None, 'above50': sum(d > 50 for d in deltas)}}
    result['cases'].append(row)
    group = result['groups'].setdefault(category, {'cases': 0, 'frames': 0, 'images': 0})
    group['cases'] += 1
    group['frames'] += row['frames']
    group['images'] += row['images']
    result['caseCount'] += 1
    result['frames'] += row['frames']
    result['images'] += row['images']
assert result['caseCount'] == 77, result['caseCount']
assert result['sourceFilesVerified'] == 1005
assert result['distFilesVerified'] == 142
for key in ['hashFailures', 'distHashFailures', 'sourceHashFailures', 'provenanceFailures', 'guardFailures']:
    assert not result[key], (key, result[key])
(root / 'capture-index.json').write_text(json.dumps(result, indent=2) + chr(10), encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k not in ['cases', 'supplementalImages']}, indent=2))
print('Supplemental uncounted derived images:', len(result['supplementalImages']))
