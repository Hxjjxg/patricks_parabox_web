"""Validate actual recursive-family captures without inferring strict credit."""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
SOURCE = Path('F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp')
CASES = {
    'infenter-first-walk-native-v1-20261025': ('infenter_first_2-walk.json', 22, 22),
    'infenter-zone-focused-native-v1-20261025': ('infenter_zone_v2-focused.json', 41, 29),
    'flip-first-focused-native-v1-20261025': ('flip_first-focused.json', 5, 5),
    'flip-recursive-long-native-v1-20261025': ('1by1_playerr_flip2-long-route.json', 31, 19),
}

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def validate_images(directory, capture):
    images = [frame['file'] for frame in capture['frames'] if frame['file']]
    assert set(images) == {path.name for path in directory.glob('frame-*.png')}
    for image in images:
        data = (directory / image).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (800, 600)
    return len(images)

def add_hashes(directory):
    hashes = {path.name: digest(path) for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'hashes.json'}
    write(directory / 'hashes.json', hashes)
    return hashes

manifest = read(EVIDENCE / 'manifest.json')
index = dict(schemaVersion=1, sourceHashes={name: digest(SOURCE / name) for name in ['Draw.cs', 'Projection.cs', 'Movement.cs', 'UndoManager.cs', 'World.cs', 'Block.cs']},
             acceptedScratchBoundary='history-before:TurnCompleted; later preview recomputation reuses Movement.moves',
             limits=['Sampled PNGs and all frame/phase metadata are actual instrumented native outputs; no interactive pacing approval.',
                     'Native block indices in accepted scratch are raw World.blocks indices and need not equal pruned snapshot indices.',
                     'Level names do not establish strict infinite entry/exit or generated-zone credit.',
                     'No Web visual approval follows from native route recording.'], captures={})
total_images = 0
for name, (fixture_name, input_count, accepted_count) in CASES.items():
    directory = EVIDENCE / name
    capture = read(directory / 'capture.json')
    route = read(directory / 'route.json')
    phases = read(directory / 'phases.json')['samples']
    endpoint = read(directory / 'end-state.json')
    expected = read(ROOT / 'tests/fixtures/original' / fixture_name)
    assert len(route['route']) == input_count
    assert capture['screenshotStride'] == 8
    assert (capture['screenWidth'], capture['screenHeight']) == (800, 600)
    for frame in capture['frames']:
        assert frame['imageCaptured'] == (frame['file'] is not None)
    requests = [(i, row) for i, row in enumerate(phases) if row['phase'].startswith('request:')]
    assert [row['phase'][8:] for _, row in requests] == [event.split(':')[0] for event in route['timedCommands']]
    for n, (i, request) in enumerate(requests):
        end = requests[n + 1][0] if n + 1 < len(requests) else len(phases)
        assert any(row['phase'] == 'controls-delivered' for row in phases[i + 1:end]), (name, n)
    accepted = []
    for i, row in enumerate(phases):
        if row['phase'] != 'history-before:TurnCompleted':
            continue
        request_ordinal = max(n for n, (j, _) in enumerate(requests) if j < i)
        accepted.append(dict(frame=row['frame'], elapsedMs=row['elapsedMs'], routeInput=request_ordinal // 2 + 1,
                             control=row['requestedControl'], moveCount=row['moveCount'], player=row['player'],
                             cloneEntry=row['cloneEntry'], attemptMoves=row['attemptMoves']))
    assert len(accepted) == accepted_count
    keys = ['levelName', 'moveCount', 'winning', 'buttonsSatisfied', 'finishesSatisfied', 'wentToInfZone', 'pastCount', 'futureCount', 'blocks']
    assert {key: endpoint[key] for key in keys} == {key: expected[key] for key in keys}, name
    images = validate_images(directory, capture)
    assert {frame['eventIndex'] for frame in capture['frames'] if frame['file']} == set(range(input_count * 2))
    total_images += images
    strict_enter = [dict(phase, strictMoves=[move for move in phase['attemptMoves'] if move['type'] == 'Enter' and move['infEnterNum'] >= 0]) for phase in accepted if any(move['type'] == 'Enter' and move['infEnterNum'] >= 0 for move in phase['attemptMoves'])]
    strict_exit = [dict(phase, strictMoves=[move for move in phase['attemptMoves'] if move['type'] == 'Exit' and move['infExitNum'] >= 0]) for phase in accepted if any(move['type'] == 'Exit' and move['infExitNum'] >= 0 for move in phase['attemptMoves'])]
    item = dict(level=route['level'], inputCount=input_count, acceptedTurns=len(accepted), frameStates=len(capture['frames']), pngs=images,
                route=route['route'], endpointFixture='tests/fixtures/original/' + fixture_name, endpointMatchesFixture=True,
                endpointPlayers=[block for block in endpoint['blocks'] if block['isPlayer']], strictInfiniteEnter=strict_enter, strictInfiniteExit=strict_exit,
                generatedZoneEntered=endpoint['wentToInfZone'], cloneEntryTurns=sum(phase['cloneEntry'] for phase in accepted), acceptedPhases=accepted, hashes=add_hashes(directory))
    index['captures'][name] = item
    if not any(entry['id'] == name for entry in manifest['entries']):
        manifest['entries'].append(dict(id=name, level=route['level'], mode='SparseMotion', width=800, height=600, status='valid', setup=[],
            timedCommands=route['timedCommands'], directory='docs/parity/evidence/original/' + name,
            note='Complete established native route; every phase/frame state retained, PNGs explicitly sampled. Strict mechanic limits and endpoint proof in recursive-family-native-index.json.'))

shine_name = 'flip-recursive-shine-submitted-v1-20261025'
directory = EVIDENCE / shine_name
capture = read(directory / 'capture.json')
shine = read(directory / 'shine.json')['samples']
images = validate_images(directory, capture)
total_images += images
selected = read(directory / 'shine-phase-selection.json')['phases']
assert len(selected) == 3 and all(any(row['context']['blockIndex'] == 104 and row['context']['cloneFade'] for row in phase['records']) for phase in selected)
assert all(row['context']['focusBlockIndex'] == 104 and row['context']['cameraMovedThisTurn'] for phase in selected for row in phase['records'])
index['shineProbe'] = dict(id=shine_name, pngs=images, phaseSelection=selected,
    counts={kind: sum(row['kind'] == kind for row in shine) for kind in ['shine-call', 'requested-band', 'submitted-band']}, hashes=add_hashes(directory),
    note='Requested rectangles observe native DrawTexture entry. Submitted rectangles observe actual Graphics.DrawTexture arguments after native clamping. Native MiscAnimT is retained; clocks must be aligned before width comparison.')
if not any(entry['id'] == shine_name for entry in manifest['entries']):
    manifest['entries'].append(dict(id=shine_name, level='1by1_playerr_flip2', mode='Motion', width=800, height=600, status='valid', setup=['RIGHT', 'RIGHT'],
        timedCommands=['DOWN:40', 'NONE:760'], directory='docs/parity/evidence/original/' + shine_name,
        note='Read-only MiscAnimT, focus/cloneFade and original Graphics.DrawTexture submitted band geometry. See recursive-family-native-index.json.'))
index['validatedPngs'] = total_images
write(EVIDENCE / 'recursive-family-native-index.json', index)
write(EVIDENCE / 'manifest.json', manifest)
print(json.dumps(dict(captures=len(CASES)+1, pngs=total_images, frames=sum(item['frameStates'] for item in index['captures'].values()) + len(capture['frames']), strictInfiniteEnter=sum(len(item['strictInfiniteEnter']) for item in index['captures'].values()), generatedZoneRoutes=sum(item['generatedZoneEntered'] for item in index['captures'].values()))))
