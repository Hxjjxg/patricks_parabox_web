"""Validate and index native RRD preview/font probes without altering old evidence."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/parity/evidence/original"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


manifest = read(EVIDENCE / "manifest.json")
name = "flip-recursive-preview-topology-20261025"
directory = EVIDENCE / name
capture = read(directory / "capture.json")
phases = read(directory / "phases.json")["samples"]
first = next(phase for phase in phases if phase.get("infExitPreviews"))
last = phases[-1]
expected = [dict(dx=dx, dy=dy, exitBlocks=[101]) for dx, dy in [(-1, 0), (0, -1), (0, 1), (1, 0)]]
assert phases[0]["infExitPreviews"] == []
assert first["infExitPreviews"] == last["infExitPreviews"] == expected
assert len(capture["frames"]) == 36
for frame in capture["frames"]:
    assert (directory / frame["file"]).is_file()
endpoint = read(directory / "end-state.json")
block = next(block for block in endpoint["blocks"] if block["index"] == 101)
assert (block["outer"], block["sub"], block["x"], block["y"], block["flipH"]) == (0, 1, 1, 1, False)
if not any(entry["id"] == name for entry in manifest["entries"]):
    manifest["entries"].append(dict(
        id=name, level="1by1_playerr_flip2", setup=["RIGHT", "RIGHT"],
        timedCommands=["DOWN:40", "NONE:620"], mode="Motion", width=800, height=600,
        status="valid", requestCommands="RIGHT RIGHT | DOWN:40 NONE:620",
        directory="docs/parity/evidence/original/" + name,
        note="Read-only native infExitPreviews telemetry proves four ordered [101] escape chains. Source and purity tests: recursive-flip-source/native-preview-source.md.",
    ))

font_specs = [
    ("native-main-font-metrics-20261025", "valid-partial", "Move-only glyphs; DrawText hook missed the leading newline."),
    ("native-main-font-metrics-v2-20261025", "valid-partial", "Correct actual caption and DrawText hook, but only Move glyphs."),
    ("native-main-font-ascii-v3-20261025", "valid", "Full printable ASCII at12/16/20, final UVs and atlas from one uninterrupted font generation."),
    ("native-main-font-cursor-v4-20261025", "valid", "Same full ASCII and atlas, plus actual GUI cursor0/1/5 positions for actual and centered600px rectangles."),
]
font_exports = []
for font_name, status, note in font_specs:
    font_dir = EVIDENCE / font_name
    metrics = read(font_dir / "font-metrics.json")
    hashes = {filename: hashlib.sha256((font_dir / filename).read_bytes()).hexdigest() for filename in ["font-metrics.json", "font-atlas.png"]}
    if (font_dir / "hashes.json").is_file():
        assert read(font_dir / "hashes.json") == hashes
    else:
        write(font_dir / "hashes.json", hashes)
    counts = [len(metric["glyphs"]) for metric in metrics["metrics"]]
    if "ascii-v3" in font_name or "cursor-v4" in font_name:
        assert counts == [95, 95, 95]
        assert all(glyph["found"] for metric in metrics["metrics"] for glyph in metric["glyphs"])
        assert metrics["actualMoveText"] == "\nMove"
        assert metrics["actualMoveRect"] == [-223, 55.5, 600, 600]
    item = dict(id=font_name, status=status, directory="docs/parity/evidence/original/" + font_name,
                font=metrics["fontAssetName"], glyphCounts=counts, hashes=hashes, note=note)
    if status == "valid-partial":
        item["supersededBy"] = "native-main-font-ascii-v3-20261025"
    font_exports.append(item)
    if not any(entry["id"] == font_name for entry in manifest.setdefault("fontReadbacks", [])):
        manifest["fontReadbacks"].append(item)

v3 = read(EVIDENCE / "native-main-font-ascii-v3-20261025/hashes.json")
v4 = read(EVIDENCE / "native-main-font-cursor-v4-20261025/hashes.json")
assert v3["font-atlas.png"] == v4["font-atlas.png"]
cursor = read(EVIDENCE / "native-main-font-cursor-v4-20261025/font-metrics.json")
assert [item["cursorCentered600Rect"][1] for item in cursor["captionMeasurements"]] == [[-15, -0.5], [-20, 0], [-25, 0]]
index = dict(
    schemaVersion=1, previewCapture=name,
    previewObservations=dict(beforeFrame=phases[0]["frame"], firstFrame=first["frame"],
                             firstPhase=first["phase"], firstElapsedMs=first["elapsedMs"],
                             chains=expected, exitRepresentation=block),
    fontExports=font_exports, nativeCaptionMeasurements=cursor["captionMeasurements"],
    limits=["Cursor positions are native text-line positions, not a direct glyph-baseline API.",
            "Font asset ascent17/lineHeight23 are at its reported fontSize16; style lineHeights differ by requested size.",
            "Earlier partial font exports are preserved and are not complete ASCII references.",
            "Native capture instrumentation does not establish uninstrumented frame pacing."],
)
write(EVIDENCE / "preview-font-native-index.json", index)
write(EVIDENCE / "manifest.json", manifest)
print(json.dumps(dict(previewFrames=36, previewChains=expected, fontExports=len(font_exports),
                      fullAsciiGlyphsPerExport=285, cursorSizes=[12, 16, 20], atlasV3EqualsV4=True)))
