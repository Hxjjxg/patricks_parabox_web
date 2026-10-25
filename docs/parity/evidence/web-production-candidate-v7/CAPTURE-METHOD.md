# Frozen production candidate v7

Production revision `e04a40c5ee352bef46cb3fb309675a32f953cd67` adds the
evidence-backed wall fragment RGB/alpha bound after HDR tint. The build is
source-stable across all 1005 production files and preserves 142 immutable
output files. Origin4187 serves only this retained build; sink4188 writes actual
Canvas PNGs, rAF/state/input traces and raw hashes without overwriting cases.

All77 prior v6 cases remain in replay-plan.json. Each ordinary case reloads
with an empty isolated save and identical options. The six Note cases pair a
real fresh Hub RDD/physical Down activation with a subsequent third-puzzle
load, preserving the actually established Intro controls. Three natural Hub
cases retain their prior seeds, physical winning input, pause and timing;
only sink/provenance identify the new production build. No effect clocks,
transient flags or fitted image coordinates are injected.

The source matches the successful complete 80-file/1189-test verification,
typecheck and three actual GPU regression cases byte for byte; see
verification-carried-forward.json for historical evidence hashes. These tests
are carried forward by exact source identity, not claimed to have run again.
The new production build ran during snapshot creation.

Known limitations remain: missing exact native Hub18px/paused13px/pop glyphs,
seven unavailable native framebuffer conditions, unresolved one-byte corner
differences, sparse native motion tails and independently timed effects.
The extended native-font deployment was automatically rejected twice with
`blocked by policy` before execution. No retry or bypass is authorized by
this archive. Existing native evidence is retained unchanged.

This archive is an incomplete parity candidate, not whole-matrix approval.
