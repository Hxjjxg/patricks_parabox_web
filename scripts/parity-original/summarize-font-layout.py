"""Additive registry and provenance for native font layout experiments."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/parity/evidence/original"

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

SPECS = [
    ("native-main-font-viewport-1001x733-v5-20261025", "valid", "actual-native-viewport"),
    ("native-main-font-viewport-1280x720-v5-20261025", "valid", "actual-native-viewport"),
    ("native-main-font-face-v6-20261025", "valid", "native-font-metrics"),
    ("native-gui-font-pack-v7-20261025", "valid-diagnostic", "explicit-gui-overlay"),
    ("native-gui-font-pack-odd-v8-20261025", "valid-diagnostic", "explicit-gui-overlay"),
    ("native-gui-font-pack-falsify-v9-20261025", "valid-diagnostic", "explicit-gui-overlay"),
]
manifest = read(EVIDENCE / "manifest.json")
entries = []
samples = []
for name, status, kind in SPECS:
    directory = EVIDENCE / name
    hashes = {path.name: hash_file(path) for path in sorted(directory.iterdir()) if path.is_file() and path.name != "hashes.json"}
    write(directory / "hashes.json", hashes)
    entry = dict(id=name, status=status, kind=kind, directory="docs/parity/evidence/original/" + name, hashes=hashes)
    if kind == "actual-native-viewport":
        metrics = read(directory / "font-metrics.json")
        entry.update(width=metrics["screenWidth"], height=metrics["screenHeight"], actualFontSize=metrics["lastMoveDraw"]["fontSize"], captionRect=metrics["actualMoveRect"], controls=metrics["controls"])
    if kind == "explicit-gui-overlay":
        analysis = read(directory / "mask-alignment-analysis.json")
        assert len(analysis["samples"]) == 12
        assert all(sample["whiteMaskDiff"] == 0 for sample in analysis["samples"])
        samples.extend(analysis["samples"])
        entry.update(width=800, height=600, exactMaskSamples=12, note="Explicit native DrawText diagnostic overlay, not a gameplay screenshot.")
    entries.append(entry)
    if not any(existing["id"] == name for existing in manifest.setdefault("fontReadbacks", [])):
        manifest["fontReadbacks"].append(entry)

assert len(samples) == 36
failed = [sample for sample in samples if not sample["genericSnapPrediction"]["matches"]]
assert len(failed) == 6 and all(sample["text"] == "Undo" for sample in failed)
assert all(sample["genericSnapPrediction"]["baseline"] == sample["baseline"] for sample in samples)
index = dict(schemaVersion=1, captures=entries, exactDiagnosticMaskSamples=36,
             verticalPredictionMatches=36, unchangedGenericHorizontalFalsifiedBy=failed,
             limits=["Diagnostic overlays are not natural game references.",
                     "Vertical staged snap is experimentally supported, not Unity native C++ source-confirmed.",
                     "Horizontal advance-width formula is falsified for single-line Undo; no fitted correction is asserted.",
                     "The1001 viewport's four extra threshold-white pixels are explained exactly by alpha over its recorded gray60 void particle."])
write(EVIDENCE / "font-layout-native-index.json", index)
write(EVIDENCE / "manifest.json", manifest)
print(json.dumps(dict(captures=len(entries), exactMasks=36, baselinePredictionsCorrect=36, horizontalFalsifications=len(failed))))
