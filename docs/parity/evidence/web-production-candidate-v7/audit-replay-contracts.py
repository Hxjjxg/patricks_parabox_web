"""Verify every v6 contract is retained; only lifecycle transport identity changes."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
prior = root.with_name('web-production-candidate-v6')
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
rows = []
for old in sorted(prior.rglob('trace.json')):
    relative = old.relative_to(prior)
    new = root / relative
    before, after = read(old)['options'], read(new)['options']
    identity_changes = {}
    if relative.parts[0] == 'hub-lifecycle':
        for key in ('sinkUrl', 'provenance'):
            identity_changes[key] = {'before': before[key], 'after': after[key]}
            before = {k: v for k, v in before.items() if k != key}
            after = {k: v for k, v in after.items() if k != key}
    rows.append({'case': relative.parent.as_posix(), 'optionsEqualExceptTransportIdentity': before == after,
        'identityChanges': identity_changes, 'priorTraceSha256': sha(old), 'traceSha256': sha(new)})
assert len(rows) == 77, len(rows)
assert all(row['optionsEqualExceptTransportIdentity'] for row in rows), rows
assert {p.relative_to(root).as_posix() for p in root.rglob('trace.json')} == {p.relative_to(prior).as_posix() for p in prior.rglob('trace.json')}
report = {'method': 'Exact options equality for all 77 prior cases; only the three lifecycle sink URLs and production provenance are excluded from options comparison. Provenance is verified by audit-captures.py. No case omission or tolerance changes.',
    'count': len(rows), 'failures': [], 'cases': rows, 'scriptSha256': sha(Path(__file__))}
(root / 'replay-contract-check.json').write_text(json.dumps(report, indent=2) + chr(10), encoding='utf-8')
print(json.dumps({'unchangedContracts': len(rows), 'failures': []}))
