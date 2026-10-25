"""Validate missing fresh-direction native references for the first three levels."""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
LEVELS = {'first': ('first_puzzle', 27, 2, 2), 'second': ('second_puzzle', 56, 4, 2), 'third': ('third_puzzle', 54, 2, 4)}
DIRECTIONS = {'right': (1, 0), 'up': (0, 1), 'left': (-1, 0), 'down': (0, -1)}

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

manifest = read(EVIDENCE / 'manifest.json')
index = dict(schemaVersion=1, captures={}, limits=['Requested40ms is a coroutine request, not an exact delivered boundary.',
    'All original frame-end PNGs and native control/update/history phases are retained.',
    'PNG encoding perturbs frame pacing; these captures do not approve uninstrumented native/Web cadence.',
    'Native first-right and third-up prior references lacked phases.json; these fill their explicit delivered-control and isolated-endpoint gap.'])
total = 0
for short, (level, player_index, start_x, start_y) in LEVELS.items():
    baseline = None
    for direction, (dx, dy) in DIRECTIONS.items():
        name = f'intro-{short}-{direction}-native-v1-20261025'
        directory = EVIDENCE / name
        capture = read(directory / 'capture.json')
        phases = read(directory / 'phases.json')['samples']
        start, end = [read(directory / filename) for filename in ['start-state.json', 'end-state.json']]
        probe = read(directory / 'probe.json')
        assert probe['freshLoad'] and not probe['setup']
        assert probe['timedCommands'] == [direction.upper() + ':40', 'NONE:400']
        assert (capture['screenWidth'], capture['screenHeight']) == (800, 600)
        assert start['levelName'] == end['levelName'] == level
        assert start['moveCount'] == start['pastCount'] == start['futureCount'] == 0
        assert end['moveCount'] == end['pastCount'] == 1 and end['futureCount'] == 0
        players = [block for block in start['blocks'] if block['isPlayer']]
        assert len(players) == 1
        assert (players[0]['index'], players[0]['outer'], players[0]['x'], players[0]['y'], players[0]['flipH']) == (player_index, 0, start_x, start_y, False)
        if baseline is None:
            baseline = start['blocks']
        assert start['blocks'] == baseline
        end_players = [block for block in end['blocks'] if block['isPlayer']]
        assert (end_players[0]['x'], end_players[0]['y'], end_players[0]['flipH']) == (start_x + dx, start_y + dy, False)
        delivered = [row for row in phases if row['phase'] == 'controls-delivered' and row['controls'][direction]]
        assert delivered and all(not any(row['controls'][other] for other in DIRECTIONS if other != direction) for row in delivered)
        accepted = [row for row in phases if row['phase'] == 'history-before:TurnCompleted']
        assert len(accepted) == 1
        images = [frame['file'] for frame in capture['frames']]
        assert set(images) == {path.name for path in directory.glob('frame-*.png')}
        for image in images:
            data = (directory / image).read_bytes()
            assert data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', data[16:24]) == (800, 600)
        total += len(images)
        selections = {}
        candidates = [frame for frame in capture['frames'] if frame['anim'] == 'NORMAL' and frame['animLength'] > 0 and frame['animT'] > 0]
        for target in [.25, .5, .75, 1]:
            if candidates:
                frame = min(candidates, key=lambda frame: abs(frame['animT'] / frame['animLength'] - target))
                selections[str(target)] = dict(frame, observedPhase=frame['animT'] / frame['animLength'])
        hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'hashes.json'}
        write(directory / 'hashes.json', hashes)
        index['captures'][name] = dict(level=level, direction=direction.upper(), frames=len(images), pngs=len(images),
            startPlayer=players[0], endPlayer=end_players[0], acceptedTurns=1,
            actualDeliveredUpdates=[{key: row[key] for key in ['frame', 'elapsedMs', 'deltaMs', 'deltaTime', 'controls', 'queued', 'moveCount']} for row in delivered],
            acceptedPhase=accepted[0], actualPhaseSelection=selections, finalFrame=capture['frames'][-1], hashes=hashes)
        if not any(entry['id'] == name for entry in manifest['entries']):
            manifest['entries'].append(dict(id=name, level=level, setup=[], timedCommands=probe['timedCommands'],
                mode='Motion', width=800, height=600, status='valid', directory='docs/parity/evidence/original/' + name,
                note='Independent fresh-load cardinal tap with actual delivered controls, all native phases/PNGs and isolated endpoint. Requested duration is not exact delivery timing.'))
index['validatedPngs'] = total
write(EVIDENCE / 'intro-fresh-tap-native-index.json', index)
write(EVIDENCE / 'manifest.json', manifest)
print(json.dumps(dict(independentFreshCases=len(index['captures']), originalLevels=3, directionsEach=4, pngs=total, acceptedTurns=12)))
