"""Audit original runtime files and reject hidden-launch black reference frames."""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]

def digest(path):
    return sha256(path.read_bytes()).hexdigest()

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

files = {
    'source': ROOT / 'scripts/parity-original/Plugin.cs',
    'installedDll': Path('F:/Patricks.Parabox_inject_debug/BepInEx/plugins/AgentObserver/AgentObserver.dll'),
    'save': Path("C:/Users/lenov/AppData/LocalLow/Patrick Traynor/Patrick's Parabox/save1.txt"),
}
expected = {
    'source': '78f656710c7f39193887a0d1c70d4103a3953656e7ba3d6ff4ea5aa64fb9bc45',
    'installedDll': 'e0e22b2b9be36a02c49cf1f0cd8aa10f3ca67c05edd6344bf810ca1a6e3f9360',
    'save': '40e7f4ce65bc9819119c0a83f967a77bfa1d20fe78651307329b23a8e271304a',
}
audit = {key: {'path': str(path), 'sha256': digest(path), 'matchesOriginal': digest(path) == expected[key]} for key, path in files.items()}
assert all(item['matchesOriginal'] for item in audit.values()), audit
captures = []
for suffix, expected_count in [('context-v1', 129), ('restored-v1', 5)]:
    directory = HERE.parent / f'native-font-hub-18-24-{suffix}-20261025'
    pngs = sorted(directory.glob('frame-*.png'))
    assert len(pngs) == expected_count
    image_hashes, all_black, dimensions = set(), True, set()
    for path in pngs:
        with Image.open(path) as image:
            dimensions.add(image.size)
            all_black = all_black and image.convert('RGB').getbbox() is None
        image_hashes.add(digest(path))
    assert all_black and len(image_hashes) == 1 and dimensions == {(800, 600)}
    isolation = read(directory / 'isolation.json')
    assert isolation['unchanged'] and isolation['previousInMemorySaveRestored']
    rejection = {
        'visualEvidenceStatus': 'REJECTED_ALL_BLACK',
        'frameCount': len(pngs),
        'allRgbPixelsBlack': all_black,
        'distinctPngSha256': sorted(image_hashes),
        'dimensions': [list(v) for v in sorted(dimensions)],
        'launch': 'Original executable PID29452 launched with -WindowStyle Hidden',
        'reason': 'All PNG RGB pixels are zero; cannot validate GUI, glyphs, colors, metrics, or rendering',
        'telemetryStatus': 'Capture completed; phase/world telemetry and unchanged-save isolation retained independently',
        'sourceOfBlackFrames': 'Hidden launch is the observed context; exact rendering failure mechanism not established',
    }
    write(directory / 'visual-evidence-status.json', rejection)
    if suffix == 'context-v1':
        probe = read(directory / 'probe.json')
        probe['scope'] = 'Telemetry-only ordinary/Pause/Resume capture; all129 PNGs black and REJECTED as visual references'
        probe['visualEvidenceStatus'] = 'REJECTED_ALL_BLACK'
        for anchor in probe['anchors']:
            anchor['visualEvidenceStatus'] = 'REJECTED_ALL_BLACK'
        write(directory / 'probe.json', probe)
    captures.append({'directory': directory.name, **rejection})

restoration = read(HERE / 'restoration.json')
restoration.update({
    'endState': 'third_puzzle800x600 telemetry only; five-frame isolation audit completed but all PNGs black',
    'visualEvidenceStatus': 'REJECTED_ALL_BLACK_FOR_BOTH_CAPTURE_DIRECTORIES',
    'currentOriginalProcessId': 29452,
    'currentProcessResponding': True,
    'visibleWindowRecovered': False,
    'cuaRecovery': 'CUA listWindows/listApps contain no Patrick game window or app; documented controls cannot select hidden process',
    'furtherCaptureAttemptedAfterCuaBlock': False,
    'extendedNativeFontDataCaptured': False,
})
write(HERE / 'restoration.json', restoration)
write(HERE / 'final-audit.json', {
    'date': '2026-10-25',
    'files': audit,
    'captures': captures,
    'nativeWindowInventory': {'requestedApp': "Patrick's Parabox", 'matchingWindowOrAppPresent': False, 'processId': 29452, 'mainWindowTitle': ''},
    'privateSaveBackupPresentInOwnedEvidence': False,
    'diagnosticDllNeverDeployed': True,
    'deploymentRetriedAfterParentProhibition': False,
    'unverifiedNativeSizes': [13, 18, 24, 25, 32, 41],
})
for directory in [HERE] + [HERE.parent / capture['directory'] for capture in captures]:
    hashes = {path.name: digest(path) for path in sorted(directory.iterdir()) if path.is_file() and path.name != 'hashes.json'}
    write(directory / 'hashes.json', {'algorithm': 'SHA-256', 'files': hashes})
print(json.dumps({'originalFilesExact': True, 'rejectedBlackFrameCount': sum(c['frameCount'] for c in captures), 'extendedNativeFontDataCaptured': False}))
