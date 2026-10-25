"""Index source-gated native paths that existed at starting f8e7539."""
import hashlib
import json
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
CASES = {
    'style-grid-clone-static-20261025': ('grid_clone', '', '', 'Static', 'GRID'),
    'style-tui-color-static-20261025': ('text_1', '', '', 'Static', 'TUI_COLOR'),
    'style-quick-anim-static-20261025': ('oldstyle_lock_two_doors', '', '', 'Static', 'QUICK_ANIM'),
    'style-grid-clone-right-motion-20261025': ('grid_clone', '', 'RIGHT:40 NONE:400', 'Motion', 'GRID'),
    'style-tui-up-motion-20261025': ('text_1', '', 'UP:40 NONE:400', 'Motion', 'TUI_COLOR'),
    'style-quick-right-motion-20261025': ('oldstyle_lock_two_doors', '', 'RIGHT:40 NONE:500', 'Motion', 'QUICK_ANIM'),
    'clone-fourth-down-entry-20261025': ('clone_first_2', 'DOWN DOWN DOWN', 'DOWN:40 NONE:650', 'Motion', 'NORMAL'),
    'inspection-third-push-pop-20261025': ('third_puzzle', '', 'NONE:80 INSPECT_56:600 INSPECT_OUT:600 NONE:100', 'Motion', 'NORMAL'),
    'infexit-proven-crossing-20261025': ('infexit_ref_first', 'DOWN LEFT LEFT DOWN RIGHT RIGHT RIGHT RIGHT', 'RIGHT:40 NONE:500', 'Motion', 'NORMAL'),
    'static-focus-block-static-v2-20261025': ('static_focus_block', '', '', 'Static', 'NORMAL'),
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


index = {'schemaVersion': 1, 'startingWebRevision': 'f8e7539', 'note': 'Actual native outputs and source gates. Original-entrypoint inspection requests invoke World.PushInspect/PopInspect; they do not claim a mouse UI replay. Pending Web parity is not an approval.', 'sourceRoot': 'F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp', 'captures': {}}
manifest = read(EVIDENCE / 'manifest.json')
checked_images = 0
for name, (level, setup, timeline, mode, style) in CASES.items():
    directory = EVIDENCE / name
    capture = read(directory / 'capture.json')
    assert (capture['screenWidth'], capture['screenHeight']) == (800, 600)
    for frame in capture['frames']:
        data = (directory / pathlib.Path(frame['file']).name).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (800, 600)
        checked_images += 1
    item = {'level': level, 'drawStyle': style, 'setup': setup.split(), 'timedCommands': timeline.split(), 'mode': mode, 'frames': len(capture['frames']), 'width': 800, 'height': 600}
    if mode == 'Motion':
        samples = read(directory / 'phases.json')['samples']
        assert all(sample['drawStyle'] == style for sample in samples)
        image_by_frame = {frame['frame']: frame['file'] for frame in capture['frames']}
        important = [sample for sample in samples if sample['phase'] == 'history-before:TurnCompleted' or sample['phase'].startswith('request:INSPECT')]
        item['acceptedPhases'] = [dict(sample, frameImage=image_by_frame.get(sample['frame'])) for sample in important]
        item['phaseSelection'] = {}
        for target in [.25, .5, .75, 1]:
            candidates = [frame for frame in capture['frames'] if frame['cameraAnimLength'] > 0 and frame['cameraAnimT'] > 0]
            if candidates:
                frame = min(candidates, key=lambda frame: abs(frame['cameraAnimT'] / frame['cameraAnimLength'] - target))
                item['phaseSelection'][str(target)] = frame
    else:
        colors = read(directory / 'colors.json')
        item['focusGeometry'] = colors['focusGeometry']
        item['focusBlockIndex'] = colors['focusBlockIndex']
    index['captures'][name] = item
    if name == 'inspection-third-push-pop-20261025':
        item.update({'evidenceKind': 'internal-camera-method-entrypoint-only', 'physicalPointerCoverage': False, 'sourceGateCoverage': False, 'caveat': 'Direct PushInspect(56) bypasses InspectUpdate. Third gold56 is FilledWithWalls and actual native pointer rejects it; use inspection-pointer-native-index.json for valid/blocked pointer branches.'})
    if not any(entry['id'] == name for entry in manifest['entries']):
        manifest['entries'].append({'id': name, 'level': level, 'setup': setup.split(), 'timedCommands': timeline.split(), 'mode': mode, 'drawStyle': style, 'width': 800, 'height': 600, 'status': 'valid', 'requestCommands': setup + (' | ' + timeline if mode == 'Motion' else ''), 'directory': 'docs/parity/evidence/original/' + name, 'note': 'Source-gated hard path output; see hardpath-native-index.json for exact accepted phases and limits.'})

clone = index['captures']['clone-fourth-down-entry-20261025']['acceptedPhases']
assert any(phase['cloneEntry'] for phase in clone)
exits = index['captures']['infexit-proven-crossing-20261025']['acceptedPhases']
assert any(move['type'] == 'Exit' and move['infExitNum'] >= 0 for phase in exits for move in phase['attemptMoves'])
inspection = index['captures']['inspection-third-push-pop-20261025']['acceptedPhases']
assert [phase['inspectBlock'] for phase in inspection] == [56, 0]
assert all(phase['cameraAnimLength'] == .5 for phase in inspection)
forced = next(entry for entry in manifest['entries'] if entry['id'] == 'inspection-third-push-pop-20261025')
forced.update({'evidenceKind': 'internal-camera-method-entrypoint-only', 'physicalPointerCoverage': False, 'sourceGateCoverage': False, 'note': 'Direct INSPECT_56 bypasses InspectUpdate FilledWithWalls gate. Third gold56 is filled and actual pointer rejects it. Raw camera artifacts retained; not a pointer acceptance fixture. See inspection-pointer-native-index.json.'})
index['styleInventory'] = {
    'GRID': ['grid_clone', 'shed_multi_simultaneous'],
    'TUI_COLOR': ['text_1', 'text_3', 'text_clone_v2', 'text_eat_v2', 'text_flip', 'text_poswall'],
    'QUICK_ANIM': ['oldstyle_lock_two_doors', 'oldstyle_squash_4_sides_v2', 'oldstyle_transfer_then_save'],
    'TUI': {'nativeEnumValue': 1, 'implementedStartingWebEnum': False, 'officialLevelOrKeyboardSelector': False, 'note': 'No missing implemented branch: baseline Web enum has Normal/TuiColor/Grid/QuickAnim only; tui parser means native TUI_COLOR2.'},
}
index['sourceGates'] = {
    'styleParser': 'LoadLevel.cs391–403: draw_style tui→TUI_COLOR, grid→GRID, oldstyle→QUICK_ANIM.',
    'gridOrTui': 'Draw.cs1299: Playing or Paused, !EndZoom, !ScreenshottingBlocks.',
    'clone': 'Draw.cs2952: representation differs from SubLevel.GetExitBlock. Camera cloneFade requires justEnteredArray noncanonical entry, AnyBlockMoving, CameraMovedThisTurn, !InstantZoom and Playing (1698–1723,2042–2145).',
    'inspection': 'World.cs312–389: NORMAL, !cameraMoving, !AnyBlockMoving, !InHub, !Winning, !SpecificBlock. Inspectable child has SubLevel, !FilledWithWalls, !Moving. Left click/positive wheel pushes; outside click/right click/negative wheel pops.',
    'inspectionCamera': 'World.PushInspect/PopInspect403–428 retain flip parity and call DoInspectZoomIn/Out452 onward. Length=Projection.GetEnterLength=.5; camera easing runs natively.',
    'staticFocus': 'Draw.cs833 SpecificBlock;1694 selects SpecialEffect1;1741 uses .6f. SpecificBlock does not increment newCamT1127–1134; observer v2 waits cameraMoving instead.',
    'infinityExit': 'Movement.cs176 achievement predicate is Exit && infExitNum>=0. AttemptToExit982 uses existing GetInfExitBlock(index) or creates zone. Existing infexit_ref_first has an index0 reference, so WentToInfZone need not become true.',
    'acceptedScratchTiming': 'Use history-before:TurnCompleted for accepted Movement.moves. TurnCompleted recomputes/reuses scratch moves; later impulse-after is not a preserved accepted-move list.',
}
index['matrixWalkAnalysis'] = {'level': 'infexit_ref_first', 'route': 'U R D L R R U U L D R U L L D D R U R D L U', 'method': 'Current pure engine with existing original-state parity fixtures; not an additional native input replay.', 'strictInfiniteExitEvents': [], 'replacementProvenNativeRoute': 'DOWN LEFT LEFT DOWN RIGHT RIGHT RIGHT RIGHT RIGHT'}
gpu_name = 'gpu-infinity-effects-20261025'
gpu_dir = EVIDENCE / gpu_name
gpu = read(gpu_dir / 'capture.json')
hashes = {texture['file']: hashlib.sha256((gpu_dir / texture['file']).read_bytes()).hexdigest() for texture in gpu['textures']}
write(gpu_dir / 'hashes.json', hashes)
if not any(entry['id'] == gpu_name for entry in manifest['gpuReadbacks']):
    manifest['gpuReadbacks'].append({'id': gpu_name, 'selection': 'EFFECTS', 'textures': 2, 'status': 'valid', 'purpose': 'Exact original InfParticleTex and InfParticleOutlineTex GPU decoded fields for infinity/epsilon glyphs; neutral texels, Bilinear/Clamp512x512.', 'directory': 'docs/parity/evidence/original/' + gpu_name})
index['validatedCaptureImages'] = checked_images
write(EVIDENCE / 'hardpath-native-index.json', index)
write(EVIDENCE / 'manifest.json', manifest)
print(json.dumps({'captures': len(CASES), 'imagesChecked': checked_images, 'cloneEntryProven': True, 'infiniteExitProven': True, 'inspectionLength': .5, 'gpuTextures': len(hashes)}))
