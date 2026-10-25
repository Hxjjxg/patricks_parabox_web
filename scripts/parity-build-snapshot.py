"""Build a source-stable parity candidate and retain its exact production assets."""
from __future__ import annotations
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def hashes(directory: Path) -> dict[str, str]:
    return {p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(directory.rglob('*')) if p.is_file()}

def source_hashes() -> dict[str, str]:
    paths = [p for name in ('src', 'public') for p in (ROOT / name).rglob('*') if p.is_file()]
    paths += [p for p in ROOT.iterdir() if p.is_file() and
              (p.name in ('index.html', 'package.json', 'package-lock.json') or
               p.name.startswith(('tsconfig', 'vite.config')) and p.suffix in ('.json', '.ts'))]
    return {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}

def head() -> str:
    return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()

def retain_previous(path: Path) -> None:
    manifest = json.loads((path / 'build-manifest.json').read_text(encoding='utf-8-sig'))
    expected = manifest['distSha256']
    archive = path / 'build-dist'
    if archive.exists():
        if hashes(archive) != expected:
            raise RuntimeError('Existing archived build does not match its immutable manifest')
        return
    if hashes(ROOT / 'dist') != expected:
        raise RuntimeError('Current dist differs from previous manifest; refusing to archive mislabeled assets')
    shutil.copytree(ROOT / 'dist', archive)
    if hashes(archive) != expected:
        raise RuntimeError('Previous archive verification failed')

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate', help='New evidence directory name; an existing manifest is never overwritten')
    parser.add_argument('--previous', help='Previous candidate whose current dist must be archived first')
    args = parser.parse_args()
    if any(Path(value).name != value or value in ('.', '..') for value in (args.candidate, args.previous) if value):
        raise ValueError('Candidate names must be single directory names')
    evidence = ROOT / 'docs/parity/evidence'
    target = evidence / args.candidate
    if (target / 'build-manifest.json').exists() or (target / 'build-dist').exists():
        raise RuntimeError('Candidate already has immutable output; use a new candidate name')
    if args.previous:
        retain_previous(evidence / args.previous)
    target.mkdir(parents=True, exist_ok=True)
    before, revision = source_hashes(), head()
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    if not npm:
        raise RuntimeError('npm is unavailable')
    build = subprocess.run([npm, 'run', 'build'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
    (target / 'build.log').write_text(build.stdout + build.stderr, encoding='utf-8')
    if build.returncode:
        raise RuntimeError(f'Build failed with exit{build.returncode}; see build.log')
    after, final_revision = source_hashes(), head()
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    if changed or revision != final_revision:
        raise RuntimeError(f'Source changed during build: {changed}, HEAD {revision} -> {final_revision}')
    shutil.copytree(ROOT / 'dist', target / 'build-dist')
    dist = hashes(ROOT / 'dist')
    if hashes(target / 'build-dist') != dist:
        raise RuntimeError('New immutable archive verification failed')
    manifest = dict(head=revision, headAfter=final_revision,
                    recordedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    sourceStableAcrossBuild=True, changed=changed, sourceSha256=before, distSha256=dist)
    (target / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(dict(candidate=args.candidate, head=revision, sourceFiles=len(before), distFiles=len(dist),
                          sourceStableAcrossBuild=True, archive=str(target / 'build-dist'))))

if __name__ == '__main__':
    main()
