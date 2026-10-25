"""Validate native source-gated pointer branches; preserve rejected diagnostics."""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
CASES = {
    'inspection-enter-pointer-native-v1-20261025': 'diagnostic-missing-hook-raw-mouse-not-injected',
    'inspection-third-gold-pointer-native-v1-20261025': 'diagnostic-missing-hook-raw-mouse-not-injected',
    'inspection-enter-pointer-hook-diagnostic-v1-20261025': 'diagnostic-raw-mouse-coordinate-mismatch',
    'inspection-enter-pointer-native-v2-20261025': 'diagnostic-wrong-cell-plain-wall',
    'inspection-third-gold-pointer-native-v2-20261025': 'valid-filled-child-rejection',
    'inspection-enter-pointer-native-v3-20261025': 'valid-nonfilled-child-push-pop',
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


manifest_path = EVIDENCE / 'manifest.json'
manifest = read(manifest_path)
index = {'schemaVersion': 1, 'scope': 'Effective Controls plus temporary Unity InputSystem Mouse coordinate injection through unchanged native ComputeMousePosition/InspectUpdate. Not a physical OS mouse or focus replay; no final visual or interactive-frame-pacing approval.', 'captures': {}}
for name, status in CASES.items():
    directory = EVIDENCE / name
    capture = read(directory / 'capture.json')
    trace = read(directory / 'inspection.json')
    samples = trace['samples']
    phases = read(directory / 'phases.json')['samples']
    start, end = read(directory / 'start-state.json'), read(directory / 'end-state.json')
    assert start['moveCount'] == end['moveCount'] == 0 and start['blocks'] == end['blocks'], name
    for frame in capture['frames']:
        png = (directory / frame['file']).read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (800, 600)
    item = {'status': status, 'level': capture['level'], 'pngs': len(capture['frames']), 'inspectionSamples': len(samples), 'startEndBlockStateUnchanged': True, 'observerBuild': read(directory / 'observer-build.json')}
    if samples:
        before = {sample['frame']: sample for sample in samples if sample['phase'] == 'before'}
        after = {sample['frame']: sample for sample in samples if sample['phase'] == 'after'}
        assert before.keys() == after.keys()
        left = next(sample for sample in before.values() if sample['mouse']['leftPressed'])
        item['left'] = {'before': left, 'after': after[left['frame']]}
        right = next((sample for sample in before.values() if sample['mouse']['rightPressed']), None)
        if right:
            item['right'] = {'before': right, 'after': after[right['frame']]}
        if trace.get('deviceCreation'):
            assert trace['deviceRelease']['temporaryDeviceRemoved'] and trace['deviceRelease']['previousDeviceRestored']
            for sample in samples:
                assert sample['rawMouse']['temporaryCaptureDevice']
                assert sample['rawMouse']['x'] == sample['mouse']['x'] and sample['rawMouse']['nativeBottomY'] == sample['mouse']['nativeBottomY']
            item['deviceAudit'] = {'creation': trace['deviceCreation'], 'release': trace['deviceRelease']}
        if status.startswith('valid'):
            gates = left['gates']
            assert gates['drawStyle'] == 'NORMAL' and gates['cameraMode'] == 'Synced'
            assert not any(gates[key] for key in ['cameraMoving', 'anyBlockMoving', 'inHub', 'winning', 'mobile', 'inspectMouseIdle'])
            assert left['inBounds'] and left['candidate']['hasSubLevel'] and not left['candidate']['moving']
            assert left['applicationFocused']
        if status == 'valid-filled-child-rejection':
            assert [left['cellX'], left['cellY'], left['candidate']['block']] == [4, 6, 56]
            assert left['candidate']['filledWithWalls']
            assert left['inspectBlock'] == after[left['frame']]['inspectBlock'] == -1
            assert not after[left['frame']]['gates']['cameraMoving']
        if status == 'valid-nonfilled-child-push-pop':
            assert [left['cellX'], left['cellY'], left['candidate']['block']] == [3, 5, 81]
            assert not left['candidate']['filledWithWalls']
            assert after[left['frame']]['inspectBlock'] == 81 and after[left['frame']]['gates']['cameraMoving']
            assert after[left['frame']]['cameraAnimLength'] == .5
            assert right['inspectBlock'] == 81 and after[right['frame']]['inspectBlock'] == 0
            assert after[right['frame']]['cameraAnimLength'] == .5 and after[right['frame']]['gates']['cameraMoving']
            assert phases[-1]['inspectBlock'] == 0 and not phases[-1]['cameraMoving']
            item['cameraPhaseSelections'] = {}
            for label, edge in [('push', left), ('pop', right)]:
                frames = [frame for frame in capture['frames'] if edge['elapsedMs'] <= frame['elapsedMs'] <= edge['elapsedMs'] + 550 and frame['cameraAnimLength'] > 0]
                item['cameraPhaseSelections'][label] = {str(t): min(frames, key=lambda frame: abs(frame['cameraAnimT'] / frame['cameraAnimLength'] - t)) for t in [.25, .5, .75, 1]}
        if status == 'diagnostic-wrong-cell-plain-wall':
            assert [left['cellX'], left['cellY']] == [3, 6] and not left['candidate']['hasSubLevel']
        if status == 'diagnostic-raw-mouse-coordinate-mismatch':
            assert [left['mouse']['x'], left['mouse']['topY']] == [340, 210] and not left['inBounds']
    else:
        assert status.startswith('diagnostic-missing-hook')
    hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'hashes.json'}
    write(directory / 'hashes.json', {'algorithm': 'SHA256', 'files': hashes})
    item['hashes'] = hashes
    index['captures'][name] = item
    if not any(entry.get('id') == name for entry in manifest['entries']):
        manifest['entries'].append({'id': name, 'level': capture['level'], 'mode': 'Motion', 'width': 800, 'height': 600, 'status': status, 'directory': str(directory.relative_to(ROOT)).replace('\\', '/'), 'note': index['scope']})
forced = next(entry for entry in manifest['entries'] if entry.get('id') == 'inspection-third-push-pop-20261025')
forced.update({'evidenceKind': 'internal-camera-method-entrypoint-only', 'physicalPointerCoverage': False, 'sourceGateCoverage': False, 'note': 'INSPECT_56 directly invokes World.PushInspect and bypasses InspectUpdate FilledWithWalls gate. Third gold56 is filled and native actual left-pointer branch rejects it. Raw camera artifacts retained; do not use as a pointer acceptance fixture. See inspection-pointer-native-index.json.'})
source = Path('F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp/World.cs')
index['source'] = {'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'methods': ['InspectUpdate', 'ComputeMousePosition', 'PushInspect', 'PopInspect', 'DoInspectZoomIn', 'DoInspectZoomOut']}
write(EVIDENCE / 'inspection-pointer-native-index.json', index)
write(manifest_path, manifest)
print(json.dumps({'captures': len(CASES), 'validPointerBranches': 2, 'pngs': sum(item['pngs'] for item in index['captures'].values()), 'validBranchPngs': sum(item['pngs'] for item in index['captures'].values() if item['status'].startswith('valid')), 'diagnosticCaptures': 4, 'actualInspectionSamples': sum(item['inspectionSamples'] for item in index['captures'].values())}))
