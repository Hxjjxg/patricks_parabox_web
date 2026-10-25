"""Check actual lifecycle coverage; no native-image parity assertion."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
rows = []
for path in sorted((root / 'hub-lifecycle').glob('*/trace.json')):
    trace = read(path)
    frames = trace['frames']
    initial = sum(bool(p['won']) for p in trace['initialHub']['portals'])
    ending = sum(bool(p['won']) for p in trace['ending']['portals'])
    expected = len(trace['options'].get('seed', {}).get('wonLevels', []))
    coverage = {key: sum(bool(frame[key]) for frame in frames) for key in ('counting', 'unlocking', 'edgeParticles')}
    coverage['celebration'] = sum(bool(frame['celebration']['active']) for frame in frames)
    coverage['paused'] = sum(frame['mode'] == 'paused' for frame in frames)
    assert initial == expected and ending == initial + 1, (path, initial, ending, expected)
    assert coverage['counting'] > 0
    if trace['options'].get('pauseDurationMs'):
        assert coverage['paused'] > 0
    if expected == 8:
        assert all(coverage[key] > 0 for key in ('unlocking', 'celebration', 'edgeParticles'))
    rows.append({'case': path.parent.name, 'traceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'initialWon': initial, 'endingWon': ending, 'recordedRafFramesByPhase': coverage})
assert len(rows) == 3
report = {'scope': 'Actual naturally triggered lifecycle coverage only; final native font/image/effect parity remains incomplete.', 'cases': rows}
(root / 'hub-lifecycle-coverage.json').write_text(json.dumps(report, indent=2) + chr(10), encoding='utf-8')
print(json.dumps(report))
