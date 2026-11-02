"""Audit retained current recursive reports; select native brackets, never fit images."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
base = root / 'docs/parity/evidence/core-gameplay-final-20261102'
native = root / 'docs/parity/evidence/original'
references = {
    'enter': 'enter-camera-entry-v2-20261025',
    'exit': 'enter-camera-exit-v2-20261025',
    'carry': 'carry-nesting-entry-20261025',
    'cycle': 'cycle-camera-entry-20261025',
    'infexit': 'infexit-proven-crossing-20261025',
    'infinity': 'infenter-zone-dddu-motion-v2-20261025',
    'strict-enter': 'strict-enter-DDD-native-20261101',
    'clone': 'clone-fourth-down-entry-20261025',
    'possess': 'possess-focused-motion-20261025',
    'flip-first': 'flip-first-focused-native-v1-20261025',
    'flip': 'flip-short-crossing-20261025',
    'terminal': 'terminal-LLLR-native-20261101',
}
load = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
def web_identity(f):
    p = f['player']
    return [f['levelName'], f['moveCount'], p['outerId'], p['x'], p['y'], f['cameraFlipH']]
def native_identity(f):
    return [f['levelName'], f['moveCount'], f['outerLevel'], f['x'], f['y'], f['cameraFlipH']]
rows = []
for folder in sorted(base.glob('recursive-*')):
    if not folder.is_dir():
        continue
    d = load(folder / 'trace.json')
    hashes = load(folder / 'sha256.json')
    for name, expected in hashes.items():
        assert hashlib.sha256((folder/name).read_bytes()).hexdigest() == expected, folder/name
    for name, expected in d['source']['sha256'].items():
        assert hashlib.sha256((root/name).read_bytes()).hexdigest() == expected, name
    name = folder.name.removeprefix('recursive-')
    deltas = [b['timestamp']-a['timestamp'] for a,b in zip(d['frames'], d['frames'][1:])]
    row = {'name': name, 'trace': str((folder/'trace.json').relative_to(root)),
           'frames': len(d['frames']), 'images': len(d['images']),
           'start': web_identity(d['starting']), 'end': web_identity(d['ending']),
           'maxRecordedFrameMs': max(deltas),
           'timingCaveat': 'Canvas PNG readback occurs during this run; not performance evidence',
           'nextAction': 'unverified: no forward next action in this contract',
           'phasePairs': []}
    if name not in references:
        row['result'] = 'unverified: no native capture for this route'
        rows.append(row)
        continue
    nf = native/references[name]/'capture.json'
    nd = load(nf)
    nframes = nd['frames']
    row['native'] = str(nf.relative_to(root))
    # Some native archives include the entire setup, rather than just the final
    # crossing. Compare its observed pre-action state, not its fresh-load frame.
    pre_action = [n for n in nframes if n['moveCount'] == d['starting']['moveCount']]
    row['nativePreActionFrames'] = len(pre_action)
    row['startLogicalIdentityMatch'] = any(row['start'] == native_identity(n) for n in pre_action)
    row['endLogicalIdentityMatch'] = row['end'] == native_identity(nframes[-1])
    for image in d['images']:
        if not image['name'].startswith('motion-0001-') or 'frameIndex' not in image:
            continue
        wf = d['frames'][image['frameIndex']]
        candidates = [n for n in nframes if n.get('file') and (nf.parent/n['file']).is_file()
                      and native_identity(n) == web_identity(wf)
                      and n['anim'].replace('_','').lower() == wf['player']['anim'].lower()
                      and abs(n['animLength']-wf['player']['length']) < 1e-6]
        before = [n for n in candidates if n['animT'] <= wf['player']['t']]
        after = [n for n in candidates if n['animT'] >= wf['player']['t']]
        bracket = [max(before,key=lambda n:n['animT']) if before else None,
                   min(after,key=lambda n:n['animT']) if after else None]
        row['phasePairs'].append({'web': str((folder/(image['name']+'.png')).relative_to(root)),
            't': wf['player']['t'], 'length': wf['player']['length'],
            'identity': web_identity(wf), 'bracket': [None if n is None else {
                'png': str((nf.parent/n['file']).relative_to(root)), 't': n['animT'],
                'cameraTarget': [n[k] for k in ['newX','newY','newXS','newYS']],
                'cameraTargetMaxDifference': max(abs(n[k]-wf['camera'][w]) for k,w in
                    [('newX','x'),('newY','y'),('newXS','xs'),('newYS','ys')])} for n in bracket]})
    row['result'] = 'unverified visually; logical start/end match' if row['startLogicalIdentityMatch'] and row['endLogicalIdentityMatch'] else 'unverified: inspect logical mismatch'
    rows.append(row)
report = {'note': 'Actual state and phase selection only. Does not approve visual or input timing parity. No images are interpolated or shifted.',
          'cases': rows, 'totalFrames': sum(r['frames'] for r in rows),
          'totalImages': sum(r['images'] for r in rows)}
(base/'recursive-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'frames':report['totalFrames'],'images':report['totalImages'],
                  'cases':[{k:r[k] for k in ['name','result','maxRecordedFrameMs']} for r in rows]},indent=2))
