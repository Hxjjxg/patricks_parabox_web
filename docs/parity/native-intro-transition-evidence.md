# Native intro progression and Hub boundaries

These ten isolated original-runtime captures retain 1,109 native 800x600
frame-end PNGs, all phase records, complete start/end block state, SHA256
files, observer source/DLL hashes and persisted-save audits. Run

    python scripts/parity-original/summarize-intro-transitions.py

to validate evidence and append entries without replacing older captures.
The compact index is evidence/original/intro-transition-native-index.json.

## Observed routes and boundaries

- intro-second-win-held: full pure-model-derived solver route
  ULLUUURRDDDRDLLULDRDRRL has23inputs; settled setup excludes its final LEFT
  (22accepted,count22,not-winning). The final held LEFT wins naturally, loads third at
  1605.52979ms, then accepts a held LEFT turn 21.91162ms after the load.
- intro-third-win-held: full solver route RUUURDDDLDRRDRRULLLLULLDDRUUULUR
  has32inputs; settled setup excludes its final RIGHT(count31,not-winning).
  The final held RIGHT wins naturally, loads **Hub**, not enter, at1610.5957ms. The initial
  helper's enter expectation failed; only expectation/provenance corrected.
  Raw native screenshots and runtime traces remain unchanged.
- Original World.GoToNextLevel(bool) follows only an immediate puzzle line on
  a first win. puzzle_lines.txt has first→second1, second→third1, and
  third→enter **0**. The latter unlocks an actual Hub portal.
- Four independent hub-{first,second,third,enter}-portal-leave captures
  initialize only necessary prior wins. Delivered DOWN starts the native
  portal jump and stays held through scene load. Escape opens the original
  pause menu, DOWN selects item1, and CONFIRM executes **Leave puzzle**.
  Each returns to the exact adjacent Hub coordinate: first(6,7),
  second(5,7), third(4,7), enter(2,5).
- hub-intro-three-won-start separately records Area_Intro player(5,9),
  enter(2,4) unlocked. This preflight is not a separate portal interaction.
- hub-enter-cancel-reenter: UNDO cancels the first jump at158.14209ms,
  leaving player(2,5) with SQUISH_IN_PLACE and no transition. A later DOWN
  re-enters; the only enter scene load occurs at1354.52271ms.
- hub-enter-direction-change: RIGHT arrives during the DOWN jump. Native
  multiPlayerQueued remains false during that jump. Scene load520.980835ms;
  RIGHT first accepted in enter563.2324ms. This proves a held control after
  load, **not a stored queued turn crossing the load**.
- intro-third-win-restart-undo: final RIGHT wins; RESTART runs while winning
  at202.758789ms. At577.3773ms UNDO sees moveCount0 and not-winning, restores
  the solved position, and the resumed countdown returns to Hub2074.55444ms.

## Observer and save isolation

The observer supplies booleans after actual Controls.Update. It now supplies
directional pressed edges and Escape/Confirm/Cancel edge/held fields for the
original World/PauseMenu code. It records delivered values, World state,
menu/select, transition scene/counter and existing history/queue phases.
No direct GoToHub or menu-selection method runs during the timed timeline.

IsolatedMotion with an optional SAVE line temporarily installs exactly the
listed in-memory wins, resets Hub session placement, suppresses native Save
calls, and restores prior SaveData. All ten audits confirm identical persisted
save SHA256 before/after and restored prior in-memory save.

The two automatic-win captures use the preceding committed observer build;
Hub/menu/boundary captures use the new source/DLL pair. Each individual
observer-build.json is authoritative. Build:0 warnings,0 errors.

Setup inputs use the existing settled setup mechanism. Final win, portal,
cancellation, menu and history timelines run naturally. Coroutine durations
are requests: use actual delivered update boundaries/measured frame deltas
for Web replay. Screenshot encoding affects cadence; these captures do not
approve natural interactive frame pacing, unmeasured queued mechanics or
final visual parity.
