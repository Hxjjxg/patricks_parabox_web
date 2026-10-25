"""Verify all62 existing v5 capture contracts survive unchanged in v6."""
import hashlib
import json
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
evidence = repo / 'docs/parity/evidence'
old = evidence / 'web-production-candidate-v5'
new = evidence / 'web-production-candidate-v6'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
moves = {row['from']: row['to'] for row in read(new / 'category-moves.json')}
prior = read(old / 'capture-index.json')
report = {'method': 'Exact options equality across all62 existing frozen-v5 contracts, allowing only recorded in-root directory moves. Actual provenance and physical backing are separately verified by the v6 frozen audit. This does not grant image-parity credit.',
    'priorProduction': prior['head'], 'production': read(new / 'capture-index.json')['head'],
    'oldIndexSha256': sha(old / 'capture-index.json'),
    'v6IndexSha256': sha(new / 'capture-index.json'),
    'movesSha256': sha(new / 'category-moves.json'),
    'scriptSha256': sha(Path(__file__)), 'count': 0, 'failures': [], 'cases': []}
for item in prior['cases']:
    name = item['case']
    target = name if (new / name / 'trace.json').is_file() else moves.get(name)
    assert target is not None, ('missing documented relocation', name)
    p, q = old / name / 'trace.json', new / target / 'trace.json'
    a, b = read(p), read(q)
    same = a['options'] == b['options']
    keys = sorted(k for k in a['options'].keys() | b['options'].keys() if a['options'].get(k) != b['options'].get(k))
    row = {'priorCase': name, 'v6Case': target, 'optionsEqual': same, 'changedKeys': keys, 'oldTraceSha256': sha(p), 'v6TraceSha256': sha(q)}
    report['cases'].append(row)
    if not same:
        report['failures'].append(row)
report['count'] = len(report['cases'])
assert report['count'] == 62, report['count']
assert not report['failures'], report['failures']
(repo / 'docs/parity/v6-replay-contract-check.json').write_text(json.dumps(report, indent=2) + chr(10), encoding='utf-8')
print(json.dumps({'unchangedContracts': report['count'], 'failures': report['failures']}))
