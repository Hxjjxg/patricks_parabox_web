"""Index native history-repeat captures without changing their raw evidence."""
import json
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
CAPTURES = {
    'first-history-hold-acceleration-20261025': ('UP DOWN UP DOWN UP DOWN UP DOWN', 'UNDO:3000 REDO:3000 NONE:80 UNDO:40 NONE:80 REDO:40 NONE:300'),
    'first-history-switch-cooldown-20261025': ('UP DOWN UP DOWN UP DOWN', 'UNDO:40 REDO:300 UNDO:300 NONE:80 REDO:40 NONE:300'),
    'first-history-simultaneous-20261025': ('UP DOWN UP DOWN UP DOWN', 'UNDO+REDO:500 REDO:350 NONE:80 UNDO+RIGHT:300 NONE:300'),
    'first-history-restart-interrupt-20261025': ('UP DOWN UP DOWN UP DOWN', 'UNDO:40 UNDO+RESTART:250 NONE:300 REDO+RESTART:300 NONE:300'),
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def f32(value):
    return struct.unpack('f', struct.pack('f', value))[0]


def compact(sample):
    return {key: sample[key] for key in ['frame', 'elapsedMs', 'scaledTime', 'deltaTime', 'updateCount', 'requestedControl', 'controls', 'levelName', 'moveCount', 'queued', 'queueIndex', 'queueDX', 'queueDY', 'anyBlockMoving', 'moveDelayCounter', 'waitForMoveDirChange', 'dirs', 'dxLast', 'dyLast', 'undoNextTime', 'undoSpacing', 'undoDirection', 'history', 'player', 'playerDrawFlags']}


replay = {'schemaVersion': 1, 'note': 'Replay actual delivered masks and deltaTime, not nominal command durations. Native scheduling uses absolute float32 scaledTime. Every update has its native after-state.', 'captures': {}}
summary = {'schemaVersion': 1, 'source': 'Assembly-CSharp UndoInput.Update, World.UpdateInner, LoadLevel parser and Draw.DrawFace', 'captures': {}}
for name, (setup, timeline) in CAPTURES.items():
    directory = EVIDENCE / name
    samples = read(directory / 'phases.json')['samples']
    frames = read(directory / 'capture.json')['frames']
    image_by_frame = {sample['frame']: sample['file'] for sample in frames}
    after_by_frame = {sample['frame']: sample for sample in samples if sample['phase'] == 'update-after'}
    updates = []
    attempts = []
    pair = None
    checked = 0
    for index, sample in enumerate(samples):
        phase = sample['phase']
        if phase == 'controls-delivered':
            pair = sample
            row = {key: sample[key] for key in ['frame', 'elapsedMs', 'scaledTime', 'deltaTime', 'updateCount', 'requestedControl', 'controls']}
            row['after'] = compact(after_by_frame[sample['frame']])
            updates.append(row)
        if phase.startswith('history-before:'):
            after = samples[index + 1]
            assert after['phase'] == phase.replace('before', 'after'), (name, index)
            attempts.append({'method': phase.split(':')[1], 'frameImage': image_by_frame.get(sample['frame']), 'before': compact(sample), 'after': compact(after)})
        if phase != 'update-after':
            continue
        assert pair and pair['frame'] == sample['frame']
        controls = pair['controls']
        now, next_time = f32(pair['scaledTime']), f32(pair['undoNextTime'])
        spacing, direction = f32(pair['undoSpacing']), pair['undoDirection']
        method = 'Undo' if controls['undo'] and now > next_time else 'Redo' if controls['redo'] and now > next_time else None
        if method:
            is_undo = method == 'Undo'
            if direction != is_undo:
                spacing = f32(.15)
            direction = is_undo
            spacing = max(f32(.04), f32(spacing - f32(.005)))
            next_time = f32(now + spacing)
        if not controls['undo'] and not controls['redo']:
            spacing, next_time = f32(.15), now
        assert f32(sample['undoSpacing']) == spacing, (name, 'spacing', sample['frame'])
        assert f32(sample['undoNextTime']) == next_time, (name, 'next', sample['frame'])
        assert sample['undoDirection'] == direction, (name, 'direction', sample['frame'])
        checked += 1
    assert len(updates) == len(after_by_frame) == checked
    replay['captures'][name] = {'setup': setup.split(), 'timedCommands': timeline.split(), 'start': compact(samples[0]), 'updates': updates}
    history = [a for a in attempts if a['method'] in ['Undo', 'Redo']]
    empty = [a for a in history if a['before']['history']['pastCount' if a['method'] == 'Undo' else 'futureCount'] == 0]
    summary['captures'][name] = {'updates': len(updates), 'validatedUndoInputUpdates': checked, 'historyAttempts': len(history), 'emptyHistoryAttempts': len(empty), 'minimumSpacing': min(a['undoSpacing'] for a in samples), 'attempts': attempts}

fresh_name = 'first-win-player-drawflags-20261025'
fresh_directory = EVIDENCE / fresh_name
fresh = read(fresh_directory / 'phases.json')['samples']
fresh_frames = read(fresh_directory / 'capture.json')['frames']
loaded = next(row for row in fresh if row['phase'] == 'level-after:second_puzzle')
loaded_frame = next(row for row in fresh_frames if row['frame'] == loaded['frame'])
assert loaded['playerDrawFlags'] == {'isPlayer': True, 'drawIsPlayer': True, 'possessable': True}
summary['automaticLoad'] = {'capture': fresh_name, 'nativeLoad': compact(loaded), 'firstSecondLevelFrame': loaded_frame, 'saveIsolation': read(fresh_directory / 'isolation.json')}
assert summary['automaticLoad']['saveIsolation']['unchanged']
assert summary['automaticLoad']['saveIsolation']['previousInMemorySaveRestored']
write(EVIDENCE / 'history-repeat-replay.json', replay)
write(EVIDENCE / 'history-repeat-summary.json', summary)
print(json.dumps({'captures': {name: {key: value for key, value in data.items() if key != 'attempts'} for name, data in summary['captures'].items()}, 'totalUpdates': sum(len(capture['updates']) for capture in replay['captures'].values()), 'automaticLoadFrame': loaded['frame'], 'automaticLoadImage': loaded_frame['file']}, indent=2))
