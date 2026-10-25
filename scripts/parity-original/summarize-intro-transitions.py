"""Validate actual native control, scene and save boundaries; append evidence only."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
SUFFIX = '-native-v1-20261025'
CASES = {
    'intro-second-win-held': ['third_puzzle'],
    'intro-third-win-held': ['hub'],
    'hub-intro-three-won-start': [],
    **{'hub-' + case + '-portal-leave': [level, 'hub'] for case, level in [('first', 'first_puzzle'), ('second', 'second_puzzle'), ('third', 'third_puzzle'), ('enter', 'enter')]},
    'hub-enter-cancel-reenter': ['enter'],
    'hub-enter-direction-change': ['enter'],
    'intro-third-win-restart-undo': ['hub'],
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def compact(sample):
    return {key: sample[key] for key in ['phase', 'frame', 'elapsedMs', 'levelName', 'requestedControl', 'controls', 'queued', 'queueDX', 'queueDY', 'winning', 'winCount', 'transitioning', 'waitForMoveDirChange', 'player', 'history']}


manifest_path = EVIDENCE / 'manifest.json'
manifest = read(manifest_path)
index = {'schemaVersion': 1, 'scope': 'Native isolated progression/portal/menu/restart control evidence. No interactive-frame-pacing or final visual approval.', 'captures': {}}
for short_name, expected in CASES.items():
    name = short_name + SUFFIX
    directory = EVIDENCE / name
    capture = read(directory / 'capture.json')
    samples = read(directory / 'phases.json')['samples']
    probe = read(directory / 'probe.json')
    start, end = read(directory / 'start-state.json'), read(directory / 'end-state.json')
    audit = read(directory / 'isolation.json')
    assert audit['unchanged'] and audit['beforeHash'] == audit['afterHash'] and audit['previousInMemorySaveRestored'], name
    assert capture['screenWidth'] == 800 and capture['screenHeight'] == 600
    frames = capture['frames']
    assert frames and all(a['elapsedMs'] <= b['elapsedMs'] for a, b in zip(frames, frames[1:]))
    for frame in frames:
        assert frame.get('imageCaptured', True) and frame['file']
        with Image.open(directory / frame['file']) as image:
            assert image.size == (800, 600), (name, frame['file'])
    deliveries = [sample for sample in samples if sample['phase'] == 'controls-delivered']
    requests = [sample['phase'].split(':', 1)[1] for sample in samples if sample['phase'].startswith('request:')]
    delivered = {}
    for control in set(requests):
        if control == 'NONE':
            matches = [sample for sample in deliveries if sample['requestedControl'] == control and not any(sample['controls'].values()) and not any(sample.get('menuControls', {}).get(key, False) for key in ['escape', 'confirm', 'cancel'])]
        elif control in ['ESCAPE', 'CONFIRM', 'CANCEL']:
            matches = [sample for sample in deliveries if sample['requestedControl'] == control and sample['menuControls'][control.lower()]]
        else:
            matches = [sample for sample in deliveries if sample['requestedControl'] == control and sample['controls'][control.lower()]]
        assert matches, (name, 'undelivered', control)
        delivered[control] = {'count': len(matches), 'firstFrame': matches[0]['frame'], 'firstMs': matches[0]['elapsedMs'], 'lastMs': matches[-1]['elapsedMs']}
    loads = [sample for sample in samples if sample['phase'].startswith('level-after:')]
    assert [sample['levelName'] for sample in loads] == expected, (name, expected, [sample['levelName'] for sample in loads])
    turns = [sample for sample in samples if sample['phase'] == 'history-before:TurnCompleted']
    result = {'originalLevel': capture['level'], 'startMoveCount': start['moveCount'], 'endLevel': end['levelName'], 'endMoveCount': end['moveCount'], 'frames': len(frames), 'pngs': len(frames), 'nativeLoads': [compact(sample) for sample in loads], 'actualDelivered': delivered, 'acceptedTurns': [compact(sample) for sample in turns], 'saveIsolation': audit, 'observerBuild': read(directory / 'observer-build.json')}
    if short_name.endswith('-portal-leave'):
        start_hub, end_hub = read(directory / 'hub-start-state.json'), read(directory / 'hub-end-state.json')
        assert start_hub['player'] == end_hub['player'], (name, 'portal return position')
        destination = probe['destination']
        portal = next(portal for portal in start_hub['portals'] if portal['scene'] == destination)
        assert portal['unlocked']
        assert start_hub['player']['x'] == portal['x'] and start_hub['player']['y'] == portal['y'] + 1
        updates = [sample for sample in samples if sample['phase'] == 'update-after']
        escape = next(sample for sample in updates if sample['menuControls']['escapePressed'])
        confirm = next(sample for sample in updates if sample['menuControls']['confirmPressed'])
        assert escape['worldState'] == 'Paused' and escape['menuSelect'] == 0
        assert confirm['worldState'] == 'Playing' and confirm['menuSelect'] == 1
        result['portal'] = portal
        result['hubReturnPlayer'] = end_hub['player']
        result['actualMenu'] = {'escape': compact(escape), 'leaveConfirm': compact(confirm)}
    if short_name in ['intro-second-win-held', 'intro-third-win-held']:
        assert len(turns) == 2 and turns[0]['levelName'] == capture['level'] and turns[1]['levelName'] == expected[0]
        assert any(sample['winning'] for sample in samples)
        result['successorFirstAcceptedAfterLoadMs'] = turns[1]['elapsedMs'] - loads[0]['elapsedMs']
    if short_name == 'hub-enter-cancel-reenter':
        cancelled = next(sample for sample in samples if sample['phase'] == 'update-after' and sample['requestedControl'] == 'UNDO')
        assert not cancelled['transitioning'] and cancelled['levelName'] == 'hub' and cancelled['player']['anim'] == 'SQUISH_IN_PLACE'
        later_down = [sample for sample in samples if sample['phase'] == 'request:DOWN'][-1]
        assert loads[0]['elapsedMs'] > later_down['elapsedMs']
        result['cancelledJump'] = compact(cancelled)
    if short_name == 'hub-enter-direction-change':
        during = [sample for sample in samples if sample['phase'] == 'update-after' and sample['transitioning'] and sample['controls']['right']]
        assert during and not any(sample['queued'] for sample in during)
        assert len(turns) == 1 and turns[0]['levelName'] == 'enter' and turns[0]['controls']['right']
        assert turns[0]['elapsedMs'] > loads[0]['elapsedMs']
        result['directionChangeDuringJump'] = {'observedUpdates': len(during), 'queuedMove': False, 'first': compact(during[0]), 'firstAcceptedAfterLoadMs': turns[0]['elapsedMs'] - loads[0]['elapsedMs']}
    if short_name == 'intro-third-win-restart-undo':
        restart = next(sample for sample in samples if sample['phase'] == 'history-before:RestartLevel')
        undo = next(sample for sample in samples if sample['phase'] == 'history-before:Undo')
        assert restart['winning'] and not undo['winning'] and undo['moveCount'] == 0
        assert any(sample['winning'] and sample['elapsedMs'] > undo['elapsedMs'] for sample in samples)
        result['restartWhileWinning'] = compact(restart)
        result['undoRestart'] = compact(undo)
    hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'hashes.json'}
    write(directory / 'hashes.json', {'algorithm': 'SHA256', 'files': hashes})
    result['hashes'] = hashes
    index['captures'][name] = result
    if not any(entry.get('id') == name for entry in manifest['entries']):
        manifest['entries'].append({'id': name, 'level': capture['level'], 'setup': probe.get('setup', []), 'timedCommands': probe['timedCommands'], 'mode': 'IsolatedMotion', 'width': 800, 'height': 600, 'status': 'valid', 'directory': str(directory.relative_to(ROOT)).replace('\\', '/'), 'note': 'Natural delivered control/scene boundary evidence with persisted-save isolation; see intro-transition-native-index.json for actual timings, menu and queue limits.'})
write(EVIDENCE / 'intro-transition-native-index.json', index)
write(manifest_path, manifest)
print(json.dumps({'captures': len(index['captures']), 'pngs': sum(capture['pngs'] for capture in index['captures'].values()), 'naturalLoads': sum(len(capture['nativeLoads']) for capture in index['captures'].values()), 'saveAuditsPassed': len(index['captures'])}))
