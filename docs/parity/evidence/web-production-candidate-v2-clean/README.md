# Frozen production candidate v2 — clean starts

Each scene begins with a new document at its exact valid `?level=` URL,
creating a fresh controller. Actual framebuffer PNGs and natural-rAF traces
are saved per scene; viewport/backing dimensions are checked800×600@DPR1.
DevTools reports devicePixelRatio1.0000000298023224; both physical backing
ratios are exactly1 and the original floating value is retained in every trace.
The immutable bundle is the one pinned in
`../web-production-candidate-v2/build-manifest.json`: both source and all51
dist hashes were stable across that build. Later source commits do not
retroactively change these images.

This candidate includes preview discovery, renderer ancestral previews,
shine, infinity glyph/border, snapped backing geometry and native eye masks.
It predates native goal rendering and HSVToRGBGUI backing fixes, and final
caption-atlas integration. Those require a later integrated capture.

The original v2 batch is retained as diagnostic: an invalid `infinity` level
fell back to Hub, then its setup entered the Intro portal. That set transient
FromIntro state, so subsequent direct loads legitimately retained an extra
tutorial absent from the native direct-load references. This clean batch
eliminates that setup mismatch by reconstructing the controller each time.

Flip contains only5 actual recorded frames: its renderer stalls hundreds of
milliseconds and the trace ends before complete landing. This is an open
performance/visual defect, not a passing timing sample. Infinity, carry, eat,
possess, cycle, clone, strict infexit and three alternate draw styles are
separate evidence cases; sampled outputs do not establish universal parity.

The infexit setup has residual BUMP_HALT at t=.1 on its starting image, so
its start is not approved as identical to the native settled setup. The
capture harness now waits for every moving block and camera to settle,
including BUMP_HALT excluded from AnyBlockMoving, before each measured action.
This harness change affects setup only; production clocks/curves are untouched.
