"""Recheck literal native GUI draw stages against immutable V12-V14 evidence.

This is an offline pen-layout diagnostic, not a screenshot acceptance test.
No capture, index, screen or production source is rewritten.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/parity/evidence/original"
INDEXES = {
    "font-sampling-native-index.json": ("8808df3eeecd241a4429f58f461ff6c0f7d1595b5cea20c2721ab7c5cf9bb1ea", 405),
    "font-alignment-pairs-native-index.json": ("53b78fc59c9f17052489667925e195065a5b9807742fadd61dc9d5e125a57445", 16),
    "font-variety-native-index.json": ("65f078cfaf10969638674f387ad4394332d765dceb02578c7ee76fbcd7dc3d3f", 72),
}
PIXEL_BIAS = struct.unpack("<f", struct.pack("<f", .48))[0]


def checked_json(path: Path, expected: str) -> dict:
    raw = path.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != expected:
        raise ValueError(f"Changed evidence {path}: {actual} != {expected}")
    return json.loads(raw.decode("utf-8-sig"))


def snap(value: float) -> int:
    # Reduced untransformed unit-scale horizontal path of 0x1806145f0.
    # The original native operation projects/unprojects float32 GUI matrices.
    return math.floor(value + PIXEL_BIAS)


def stages(sample: dict) -> dict:
    x, _, width, _ = sample["rect"]
    advance = sample["advanceWidth"]
    centered = sample.get("role", "MiddleCenter") == "MiddleCenter"
    factor = .5 if centered else 0
    root_left = snap(x)
    root_width = snap(x + width) - root_left
    text_x = root_left + (root_width - advance) * factor
    text_left = snap(text_x)
    text_width = snap(text_x + advance) - text_left
    render_anchor = snap(text_left + text_width * factor)
    local_origin = -math.floor(advance / 2 + .5) if centered else 0
    return dict(rootLeft=root_left, rootWidth=root_width, alignedTextX=text_x,
                snappedTextLeft=text_left, snappedTextWidth=text_width,
                renderAnchor=render_anchor, localOrigin=local_origin,
                pen=render_anchor + local_origin)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native-binary", type=Path, help="Optionally verify the inspected UnityPlayer.dll identity")
    args = parser.parse_args()
    if args.native_binary:
        actual = hashlib.sha256(args.native_binary.read_bytes()).hexdigest()
        expected = "113d3deebd690e63e8925ffba6b4a1edc0409fe7dd345a6f119e1fb7e5e37cf0"
        if actual != expected:
            raise ValueError(f"Inspected native binary changed: {actual}")
    results, historical, residuals, artifacts = [], None, [], 0
    for name, (sha, count) in INDEXES.items():
        index = checked_json(EVIDENCE / name, sha)
        captures = index.get("captures", [index.get("capture")])
        for capture in captures:
            for artifact, expected in capture["hashes"].items():
                path = ROOT / capture["directory"] / artifact
                actual = hashlib.sha256(path.read_bytes()).hexdigest()
                if actual != expected:
                    raise ValueError(f"Changed source artifact {path}: {actual}")
                artifacts += 1
        samples = index["samples"]
        if len(samples) != count:
            raise ValueError(f"Changed sample count {name}: {len(samples)}")
        failures = []
        for i, sample in enumerate(samples):
            result = stages(sample)
            if result["pen"] != sample["actualPenX"]:
                failures.append(dict(index=i, sample=sample, predicted=result))
            if name == "font-sampling-native-index.json":
                x, _, width, _ = sample["rect"]
                old = math.ceil(x - .5) + math.floor(width / 2) - math.ceil(sample["advanceWidth"] / 2)
                if old != sample["actualPenX"]:
                    residuals.append(dict(index=i, oldPen=old, actualPen=sample["actualPenX"], nativeStagePen=result["pen"]))
        results.append(dict(index=name, samples=count, matches=count - len(failures), failures=failures))
        if name == "font-alignment-pairs-native-index.json":
            historical = [dict(index=i, role=s["role"], rect=s["rect"], actualPen=s["actualPenX"], stages=stages(s))
                          for i, s in enumerate(samples) if s["pairIndex"] in (6, 7)]
    summary = dict(method="literal native draw stages, no parity branch or fitted offset",
                   sourceArtifactsVerified=artifacts, results=results,
                   previousIndependentRule=dict(matches=405 - len(residuals), mismatches=len(residuals), failures=residuals),
                   v14DiscriminatingPairs=historical)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if any(result["failures"] for result in results) or len(residuals) != 54:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
