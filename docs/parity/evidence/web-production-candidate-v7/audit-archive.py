"""Verify every retained archive file byte, without mutating artifacts."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = root / 'archive-sha256.json'
expected = json.loads(manifest.read_text(encoding='utf-8'))['files']
actual = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted(root.rglob('*')) if p.is_file() and p != manifest}
assert actual == expected, sorted(k for k in actual.keys() | expected.keys() if actual.get(k) != expected.get(k))
print(json.dumps({'verifiedArchiveFiles': len(actual), 'failures': []}))
