# Frozen integrated candidate v6

Production source revision: `ac5afc3af2832c2aaa95d48b1cf6d836d1c1fadc`.
This is an evidence archive, **not completed parity acceptance**. It includes
ordinary-exit/strict-infinite-enter/terminal phantom fixes and integrated native
Hub count, unlocking, celebration, caption and particle mechanisms. Candidate v5
remains historical and has not been relabeled.

## Identity and reproducibility

`build-manifest.json` SHA256 is
`ac4f2070842dd7cfccaaad4fbe67ff364cd0ceb77116819cfb5696f50ec602c7`.
All 1005 production-source hashes and 142 immutable `build-dist` hashes verify.
Each raw capture records that head and manifest hash; the preview was
`http://localhost:4184`. `category-moves.json` records 77 in-root directory moves
without changing trace, PNG or raw hash-list bytes.

Run from the repository root:

```powershell
python docs/parity/evidence/web-production-candidate-v6/audit-captures.py
python docs/parity/evidence/web-production-candidate-v6/note/compare-note.py
```

The audit validates physical backing dimensions, provenance, starting levels,
ordered rAF timestamps, exact raw image inventory, source/build hashes and every
raw capture hash. Derived unscaled phase plates are indexed separately and
receive no raw-capture credit. Note comparison records its own derived plate hash.

## Actual capture inventory

| Group | Cases | rAF records | Raw PNGs |
|---|---:|---:|---:|
| cardinal | 12 | 492 | 192 |
| hub-lifecycle | 3 | 1237 | 207 |
| long-routes | 3 | 3625 | 1124 |
| mechanics | 17 | 1033 | 244 |
| natural-input | 8 | 691 | 274 |
| new-regressions | 3 | 182 | 48 |
| note | 6 | 199 | 15 |
| odd-dpr | 1 | 13 | 2 |
| static | 20 | 245 | 40 |
| transitions | 4 | 569 | 192 |
| **Total** | **77** | **8286** | **2338** |

All **2415 raw capture-file hashes** verify with no failures. These are exercised
Web outputs, not 77 native-versus-Web approvals. Existing 62 v5 matrix contracts
were rerun unchanged using fresh isolated saves. Added cases comprise 3 targeted
phantom regressions, 3 full native-route replays, 3 natural Hub lifecycle routes,
and 6 Note activation/third-level captures. All raw options, setup sequences,
timestamps, input durations, states and viewport metadata remain in `trace.json`.
The old `options.revision` label on replayed contracts is historical; actual
production identity is in trace provenance and the manifest.

## Bounded findings

- `static-comparison.json`: all 20 fresh/repeated cases have correct backing
  dimensions; 2780 wall and 426 floor samples contain zero channels outside the
  established 1/255 tolerance; 2432 join measurements have zero seam suspects;
  72 gold-clip samples are exactly 255; DPR1 border supports match exactly.
  Summary equivalence to v5 is retained. No threshold was widened.
- `static-physical-comparison.json`: only 3 of 10 requested native physical
  conditions are available/matched; those have no physical border differences.
  The other 7 are rejected/unverified. Historical DPR2-versus-native1x CSS
  support diagnostics remain in `static-border-comparison.json` and do not
  replace physical framebuffer comparisons. `odd-axis-comparison.json`
  preserves actual 2002x1398 backing and 12/12 exact border sides.
- `long-routes/comparison.json`: all 94 action-owned attempts / 70 accepted
  counts and all 71/87/123 ordered-block endpoint fields match retained native
  traces. Actual long rAF gaps and nearest-phase image mismatches are retained.
  Sparse native tails and independent effect clocks are not visually approved.
- `hub-lifecycle`: actual natural wins trigger counting, unlocking, physical
  portal growth, celebration, pause and edge particles. Positive 800x540 output
  includes supported exact native 16px 1-over-9. At ordinary 800x600 the required
  18px/paused13px and further count-pop sizes remain absent. These missing
  glyphs are a confirmed unresolved scoped rendering discrepancy.
- `note/comparison.json` and `note/native-final-crops.png`: real Intro activation
  precedes the three final third-puzzle loads. Retained raw native/previous/final
  crops are unscaled. Both line bottom supports match all three viewport sizes.
  Native 20px N has xmin115 versus final116 at threshold150; the independently
  documented gray78 void background composites unchanged alpha115 to RGB158.
  That difference is retained; no offset, altered alpha or fitted tolerance is
  used. General Unity wrapping and arbitrary DPR text remain unverified.

## Verification and acceptance boundary

`verification-test.log`: all 80 files / 1189 tests pass, with no excluded cases.
`verification-typecheck.log` and `build.log`: typecheck and production build pass;
only the existing Vite chunk-size advisory remains. `verification-source.json`
confirms the 1005 source and 142 immutable bundle hashes stayed unchanged across
these checks. No production source changed during evidence finalization.

Independent review is recorded separately in `docs/parity/review.md`; bounded
image rechecks do not grant whole-matrix or universal pixel parity approval.
Final review status is kept current in `docs/parity/matrix.md`. Terminal LLLR
has source/Web evidence but no matched native route images. Required unreviewed
behavior families, exact effect trajectories and sparse phase tails remain open.

Extended native-font diagnostic deployment was automatically rejected twice
with `blocked by policy`, before execution. There was no retry/bypass. Observer
source/DLL/save restoration was byte-exact; all 134 hidden-launch screenshots
were black and rejected. Progress requires supported visible native rendering
and exact missing glyph telemetry/assets. Seven requested high-resolution
framebuffers also remain unavailable: 2002x1466 actually yielded 2002x1400 for
three levels; 2560x1440 yielded 2240x1400 for three; third2560x1800 yielded
2240x1400. No resampling or pass credit is used.

Development browser origin4173 was restored to 800x600 and the exact two saved
storage values after recording; direct read-back confirmed both equal. v6
origin4184 used isolated diagnostic saves. No Steam installation was touched.
The active goal remains incomplete.
