"""Index genuine native framebuffers; clamped requests are diagnostics only."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'docs/parity/evidence/original'
CASES = [(w, h, level) for w, h in [(1600, 1200), (2002, 1466), (2560, 1440)] for level in ['first_puzzle', 'second_puzzle', 'third_puzzle']]
CASES += [(2560, 1800, 'third_puzzle')]
CASES += [(2002, 1398, 'first_puzzle')]
BASELINES = dict(first_puzzle='first_puzzle-static-20261025', second_puzzle='second_puzzle-static-20261025', third_puzzle='third-baseline-settled-20261025')


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def clean_state(value):
    return {key: item for key, item in value.items() if key != 'requestId'}


def max_channel(image):
    red, green, blue = image.split()
    return ImageChops.lighter(ImageChops.lighter(red, green), blue)


manifest_path = EVIDENCE / 'manifest.json'
manifest = read(manifest_path)
entries, build_pairs = [], set()
for width, height, level in CASES:
    name = 'native-framebuffer-{}x{}-{}-v15-20261025'.format(width, height, level.replace('_', '-'))
    directory = EVIDENCE / name
    capture = read(directory / 'capture.json')
    request = read(directory / 'resolution-request.json')
    state = read(directory / 'state.json')
    build = read(directory / 'observer-build.json')
    colors = read(directory / 'colors.json')
    assert capture['requestId'] == state['requestId'] == colors['requestId'] == name
    assert capture['level'] == state['levelName'] == level
    assert request['requested'] == [width, height]
    assert request['command'] == f'CAPTURE:{level}:{width}:{height}'
    actual = [capture['screenWidth'], capture['screenHeight']]
    assert actual == request['actualScreen']
    assert build['referenceLogicalViewport'] == [width / 2, height / 2]
    assert build['intendedWebDpr'] == 2 and build['buildWarnings'] == build['buildErrors'] == 0
    assert build['resampled'] is build['nativeDrawLogicChanged'] is build['cuaOrOsBypass'] is False
    assert request['resampled'] is request['drawLogicChanged'] is False
    build_pairs.add((build['sourceSha256'], build['dllSha256']))
    baseline = read(EVIDENCE / BASELINES[level] / 'state.json')
    assert clean_state(state) == clean_state(baseline)
    assert state['moveCount'] == state['pastCount'] == state['futureCount'] == 0
    assert state['winning'] is False and state['trace'] == []
    state_fingerprint = digest(json.dumps(clean_state(state), sort_keys=True, separators=(',', ':')).encode())
    files = sorted(directory.glob('static-*.png'))
    assert len(files) == len(capture['frames']) == 3
    assert [Path(frame['file']).name for frame in capture['frames']] == [file.name for file in files]
    assert all(capture['frames'][i]['frame'] < capture['frames'][i + 1]['frame'] for i in [0, 1])
    first_image, image_records = None, []
    for file, frame in zip(files, capture['frames']):
        raw = file.read_bytes()
        assert raw[:8] == b'\x89PNG\r\n\x1a\n'
        dimensions = list(struct.unpack('>II', raw[16:24]))
        assert dimensions == actual == request['pngDimensions'][file.name]
        image = Image.open(file).convert('RGB')
        assert list(image.size) == dimensions
        nonblack = image.width * image.height - max_channel(image).histogram()[0]
        assert nonblack > image.width * image.height / 20, (name, file.name, 'black or near empty frame')
        if first_image is None:
            first_image = image.copy()
        difference = ImageChops.difference(first_image, image)
        changed = image.width * image.height - max_channel(difference).histogram()[0]
        image_records.append(dict(file=file.name, pngDimensions=dimensions, nativeFrame=frame['frame'], nativeTime=frame['time'], deltaTime=frame['deltaTime'], sha256=digest(raw), nonblackPixels=nonblack, changedPixelsVsFirst=changed, changedBoundingBoxVsFirst=difference.getbbox(), maximumChannelDifferenceVsFirst=max(hi for lo, hi in difference.getextrema())))
    eligible = actual == [width, height]
    assert request['status'] == ('native-size-applied' if eligible else 'unsupported-request-not-applied')
    hashes = {file.name: digest(file.read_bytes()) for file in sorted(directory.iterdir()) if file.is_file() and file.name != 'hashes.json'}
    write(directory / 'hashes.json', dict(algorithm='SHA256', files=hashes))
    entry = dict(id=name, kind='native-physical-framebuffer-reference' if eligible else 'native-windowed-resolution-limit-diagnostic', level=level, setup=[], timedCommands=[], requestCommands='', directory=directory.relative_to(ROOT).as_posix(), requestedWidth=width, requestedHeight=height, width=actual[0], height=actual[1], status='valid' if eligible else 'unsupported-requested-resolution', dpr2ReferenceEligible=eligible, requestedLogicalViewport=[width / 2, height / 2], screenPngAgreement=True, nativeFramebufferNotResampled=True, exactFreshStateMatch=True, freshStateBaseline=BASELINES[level], freshStateSha256=state_fingerprint, focusGeometry=colors['focusGeometry'], images=image_records, observerBuild=build, hashes=hashes)
    if (width, height) == (2002, 1398):
        entry['additionalOddCssAxesDiscriminator'] = True
        entry['notSubstituteForUnsupportedOriginalRequest'] = True
    entries.append(entry)
    if not any(old['id'] == name for old in manifest['entries']):
        manifest['entries'].append(entry)

assert len(entries) == 11 and len(build_pairs) == 1
additional = entries[-1]
entries = entries[:-1]
assert additional['dpr2ReferenceEligible'] and [additional['width'], additional['height']] == [2002, 1398]
assert additional['focusGeometry'][:2] == [1001, 699]
additional_index = dict(schemaVersion=1, purpose='Additional physical native camera discriminator at both odd CSS axes; not a substitute for unsupported original requested surfaces', capture=additional, results=dict(actualScreen=[2002, 1398], exactPngDimensions=3, exactFreshStateMatch=True, cssViewport=[1001, 699], intendedDpr=2, actualNativeFocusCenter=additional['focusGeometry'][:2], cssTruncBeforeDprCandidateCenter=[1000, 698], nativeMinusCandidate=[1, 1], candidateRejectedForThisViewport=True), limits=['This is one fresh first_puzzle scene at actual2002x1398, not proof of all camera/animation paths.', 'Original ten requested cases and seven unsupported requests are retained separately and receive no substitute coverage credit.', 'No camera, native draw logic, resampling, CUA or OS override is changed.'])
write(EVIDENCE / 'physical-framebuffer-odd-css-axes-index.json', additional_index)
eligible = [entry for entry in entries if entry['dpr2ReferenceEligible']]
unsupported = [entry for entry in entries if not entry['dpr2ReferenceEligible']]
assert len(eligible) == 3 and len(unsupported) == 7
assert all([entry['width'], entry['height']] == [1600, 1200] for entry in eligible)
outcomes = []
for requested in [(1600, 1200), (2002, 1466), (2560, 1440), (2560, 1800)]:
    selected = [entry for entry in entries if (entry['requestedWidth'], entry['requestedHeight']) == requested]
    actuals = Counter((entry['width'], entry['height']) for entry in selected)
    outcomes.append(dict(requested=list(requested), sceneCount=len(selected), actualSizes=[dict(size=list(size), scenes=count) for size, count in actuals.items()], requestedReferenceEligible=all(entry['dpr2ReferenceEligible'] for entry in selected)))
results = dict(requestedScenes=10, nativePngs=30, screenAndPngDimensionChecks=30, exactFreshStateMatches=10, nonblackNativeFrames=30, eligibleRequestedScenes=3, eligibleRequestedPngs=9, unsupportedRequestedScenes=7, unsupportedDiagnosticPngs=21, outcomes=outcomes)
index = dict(schemaVersion=1, captureMethod='Existing RunCaptureScenario, native Screen.SetResolution(width,height,false), World.GoToLevel fresh state, >=0.8s and camera settle, three WaitForEndOfFrame ScreenCapture.CaptureScreenshotAsTexture PNGs', results=results, entries=entries, eligibleReferenceIds=[entry['id'] for entry in eligible], unsupportedIds=[entry['id'] for entry in unsupported], limits=['Only1600x1200was supported at the requested dimensions in this host windowed session.', 'Requested2002x1466clamped to2002x1400; requested2560x1440and2560x1800clamped to2240x1400. These are not valid requested DPR2references.', 'No resampling, forced fullscreen, CUA, OS window override or draw-logic modification is used.', 'Fresh state matches exact native1xbaseline snapshots excluding only requestId; animated raster repeat differences are retained per image rather than erased.', 'Native physical framebuffers are comparison evidence; they do not by themselves establish Web renderer parity.'])
write(EVIDENCE / 'physical-framebuffer-native-index.json', index)
write(manifest_path, manifest)
print(json.dumps(results))
print(json.dumps(additional_index['results']))
