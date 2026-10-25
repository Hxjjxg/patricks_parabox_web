"""Audit retained native contracts against actual Web long-route captures.

Image pairs are nearest recorded phases, never interpolated parity passes.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import statistics

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'docs/parity/evidence/web-long-routes-after-dev'
FIXTURES = {'infenter_first_2': 'infenter_first_2-walk.json',
            'infenter_zone_v2': 'infenter_zone_v2-focused.json',
            '1by1_playerr_flip2': '1by1_playerr_flip2-long-route.json'}


def read(path: Path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_subset(actual: dict, expected: dict) -> None:
    for key, value in expected.items():
        if isinstance(value, dict):
            assert_subset(actual[key], value)
        else:
            assert actual[key] == value, (key, actual[key], value)


def main() -> None:
    contract_path = ROOT / 'docs/parity/long-route-capture-contract.json'
    contract = read(contract_path)
    result = {'contractSha256': sha(contract_path), 'routes': [],
              'imageComparison': 'Nearest actual phases only; no interpolation, pixel tolerance or image approval.',
              'historyCounts': 'Not exposed by Web debug API; actual capture does not assert past/future counts.'}
    for route in contract['routes']:
        directory = WEB / route['level']
        trace = read(directory / 'trace.json')
        integrity = read(directory / 'sha256.json')
        assert all(sha(directory / name) == digest for name, digest in integrity.items())
        assert trace['options'] == route['captureWebOptions']
        assert_subset(trace['starting'], route['captureWebOptions']['expectedStarting'])
        assert trace['viewport']['canvasWidth'] == 800 and trace['viewport']['canvasHeight'] == 600
        fixture = read(ROOT / 'tests/fixtures/original' / FIXTURES[route['level']])
        assert_subset(fixture, trace['structuralEnding'])
        presses = [event for event in trace['events'] if event['type'] == 'keydown']
        releases = [event for event in trace['events'] if event['type'] == 'keyup']
        assert len(presses) == len(releases) == route['counts']['attemptedInputs']
        attempts, blocked = [], []
        previous_count = 0
        for index, (press, release, requested, native) in enumerate(zip(
                presses, releases, trace['options']['events'], route['perInput'])):
            assert press['key'] == release['key'] == requested['key']
            prefix = str(index).zfill(2) + '-'
            states = [frame for frame in trace['frames'] if frame['action'].startswith(prefix)]
            assert states, ('No actual Web frame for attempt', index + 1)
            count = max(frame['moveCount'] for frame in states)
            assert count == native['moveCountAfter'], (route['level'], index + 1, count, native['moveCountAfter'])
            if count == previous_count:
                blocked.append(index + 1)
            attempts.append({'attempt': index + 1, 'key': press['key'], 'moveCountAfter': count,
                             'accepted': count > previous_count,
                             'pressScheduleResidualMs': press['timestamp'] - presses[0]['timestamp'] - requested['at'],
                             'actualHoldMs': release['timestamp'] - press['timestamp'],
                             'requestedHoldMs': requested['duration']})
            previous_count = count
        assert blocked == route['blockedAttemptIndices']
        native_dir = ROOT / 'docs/parity/evidence/original' / route['id']
        anchors = [route['nativeStartFrame']]
        for selection in route['nativePhaseSelections']:
            anchors.extend(anchor['frame'] for anchor in selection['phaseAnchors'] if anchor.get('frame'))
        anchors.append(route['nativeEndFrame'])
        unique = {anchor['file']: anchor for anchor in anchors}
        pairs = []
        for name, native in unique.items():
            assert sha(native_dir / name) == route['provenance']['selectedPngs'][name]
            candidates = []
            for picture in trace['images']:
                if picture['name'] == 'start':
                    state = trace['starting']
                elif picture['name'] == 'end':
                    state = trace['ending']
                elif 'frameIndex' in picture:
                    state = trace['frames'][picture['frameIndex']]
                else:
                    continue
                player = state['player']
                if (state['moveCount'], player['outer'], player['x'], player['y'], state['cameraFlipH'],
                    player['anim'], player['length']) != (native['moveCount'], native['outerLevel'],
                    native['x'], native['y'], native['cameraFlipH'],
                    {'NORMAL': 'normal', 'BUMP_HALT': 'bumpHalt'}.get(native['anim'], native['anim']), native['animLength']):
                    continue
                candidates.append((abs(player['t'] - native['animT']), picture, state))
            if not candidates:
                pairs.append({'native': name, 'web': None, 'status': 'No saved Web PNG with identical discrete state/kind/length'})
                continue
            _, picture, state = min(candidates, key=lambda value: value[0])
            pairs.append({'native': name, 'web': picture['name'] + '.png',
                          'nativeAnim': native['anim'], 'nativeAnimT': native['animT'],
                          'webAnimT': state['player']['t'], 'animLength': native['animLength'],
                          'nativeCameraPhase': native['newCamT'], 'webCameraPhase': state['camera']['phase'],
                          'webAction': state['action'], 'moveCount': state['moveCount'],
                          'status': 'Nearest saved actual phase; mismatch retained, not pixel approval'})
        pages = []
        for first in range(0, len(pairs), 2):
            rows = pairs[first:first + 2]
            plate = Image.new('RGB', (1600, 650 * len(rows)), (25, 25, 25))
            draw = ImageDraw.Draw(plate)
            for row, pair in enumerate(rows):
                y = row * 650
                draw.text((8, y + 4), route['level'] + ' | native ' + pair['native'], fill='white')
                draw.text((8, y + 23), json.dumps({k: v for k, v in pair.items() if k not in ('native', 'web', 'status')}), fill='white')
                plate.paste(Image.open(native_dir / pair['native']).convert('RGB'), (0, y + 50))
                if pair['web']:
                    plate.paste(Image.open(directory / pair['web']).convert('RGB'), (800, y + 50))
            filename = 'phase-pairs-' + str(first // 2 + 1).zfill(2) + '.png'
            plate.save(directory / filename)
            pages.append(filename)
        deltas = [b['timestamp'] - a['timestamp'] for a, b in zip(trace['frames'], trace['frames'][1:])]
        result['routes'].append({'level': route['level'], 'traceSha256': sha(directory / 'trace.json'),
                                 'verifiedCaptureFiles': len(integrity), 'frames': len(trace['frames']),
                                 'images': len(trace['images']), 'attempts': attempts, 'blockedAttempts': blocked,
                                 'orderedEndpointFieldsAndBlocksExact': True,
                                 'nativeUnsupportedTails': route['unsupportedTails'],
                                 'rafIntervalsMs': {'median': statistics.median(deltas), 'max': max(deltas),
                                                    'over50Count': sum(delta > 50 for delta in deltas)},
                                 'phasePairs': pairs, 'unscaledPairPages': pages})
    (WEB / 'comparison.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps([{key: value for key, value in route.items() if key not in ('attempts', 'phasePairs', 'nativeUnsupportedTails')}
                      for route in result['routes']], indent=2))


if __name__ == '__main__':
    main()
