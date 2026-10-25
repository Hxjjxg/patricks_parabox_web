# Actual Canvas history replay

Controller: `21af3e2`, with then-pending renderer modules. These four cases run the real controller and Pixi renderer with the diagnostic external native-delta frame clock. They do not measure natural browser delivery or frame pacing.

The source fixture is `tests/fixtures/original-history-repeat.json`, derived from raw `original/history-repeat-replay.json`; every trace records its source SHA256. Setup uses real settled animations. Its completed BUMP_HALT metadata differs from the original setup's stopped NORMAL pose; both settled positions agree.

Independent reviewer recomputed all 581 endpoints and held masks from raw native data: exact level/count/moving/player coordinates/outer/animation, maximum phase/transform residual8.536e-8 against the existing1e-6 threshold. All36 count-change transitions agree. All171 available mapped actual PNG pairs have identical largest-magenta-body bounds. Five critical squish/restart image pairs were directly inspected.

Native final updates38228/44492/44748/45009 have no source PNG. Only45009 was selected for a corresponding Web image; it remains visually unverified. Faces, blink/global-clock state and particles were not synchronized and remain separate rendering leads. No internal history-stack equality is claimed because the Web trace does not expose it.

Independent analysis and paired crops: `../review/analyze-history-clock-replay.py`, `history-clock-replay-independent-check.json`, and `history-clock-*-critical.png`.
