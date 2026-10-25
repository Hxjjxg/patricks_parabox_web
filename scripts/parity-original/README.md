# Original runtime parity capture

This is the existing AgentObserver with additive CAPTURE and MOTION commands.
The original HOLD and structural-conformance commands are retained. Only the
debug copy under F:/Patricks.Parabox_inject_debug is used.

Build with dotnet build -c Release in this directory; copy the resulting DLL
to the debug game BepInEx/plugins/AgentObserver directory while the game is
closed. Existing DLLs may remain mapped by dnSpy; preserve and rename the old
DLL rather than overwriting a mapped file.

Launch the debug executable visibly, windowed, at 800 by 600. The user
requested an interactive original-game comparison; a hidden launch returned
black framebuffer images because Unity suppressed repainting. CUA access to
this game was rejected, so captures use Unity ScreenCapture from the observer
rather than a Windows screenshot or a replacement UI helper.

Wait for the startup fade before collecting a baseline. Then run, for example:

    ./scripts/parity-original/capture.ps1 -Id third-static-repeat -Level third_puzzle
    ./scripts/parity-original/capture.ps1 -Id third-odd-size -Level third_puzzle:1001:733
    ./scripts/parity-original/capture.ps1 -Id first-tap -Level first_puzzle -Mode Motion -Commands "| RIGHT:120 NONE:180"

Static commands capture three successive settled frames and the full original
structural state. Motion commands accept optional setup moves before a pipe,
then timed controls DIRECTION:milliseconds / NONE / UNDO / REDO / RESTART:

    -Commands "RIGHT UP UP UP LEFT UP RIGHT RIGHT RIGHT | RIGHT:150 NONE:250"

Setup moves alone stop their animations to create a reproducible start state.
The corrected observer then waits at least0.8 real seconds and until
Draw.newCamT reaches1. Early v1 captures with cross-level setup used only15
frames and may have a partly settled camera; manifest.json marks them as
diagnostic and points to corrected v2 captures.
After the pipe, controls are supplied after Controls.Update through Harmony;
the original World, Movement, UndoInput, and Draw execute naturally. Active
animations are never stopped during capture. Each frame-end image has actual
unscaled timestamp, frame delta, control event start, player animation phase,
offset/scale, move count, outer-level index, and camera fields in capture.json.
start-state.json and end-state.json preserve full original terminal structures.

Motion capture temporarily requests targetFrameRate=60 and vSyncCount=0 so an
unfocused game does not run thousands of simulation frames per second. Both
settings restore afterward. PNG encoding may lengthen individual frames;
compare by measured timestamps and action phases, never unrelated frame index.
This instrumented cadence does not prove native interactive frame pacing.

New motion captures also write phases.json. Read-only Harmony hooks record
actual delivered Controls values, PlayerMovementLogic before/after, queued
impulse before/after, World.UpdateInner before/after, and GoToLevel before/after.
Each sample includes the native frame/delta, queue/count, movement animation,
win timer, direction stack, blocked-until-direction-change flag, and repeat
counter. A request:DIRECTION sample marks the coroutine request; it is not
proof that Controls.Update has delivered it yet. Use controls-delivered or
movement-before to align input, then update-after to align rendered phases.
This logging observes the original rules and is enabled only during captures.
History traces include top-first past/future MoveCount arrays, restart flags,
TurnCompleted/Undo/Redo/RestartLevel boundaries, original UndoInput cooldown
and spacing, scaled time, native update count, and direction repeat fields.

Use plus-separated masks for true simultaneous controls, for example
UP:20 UP+RIGHT:40 UP:160 NONE:500. The original Movement direction stack
chooses priority; the observer only supplies the delivered boolean mask.
Nominal event durations are coroutine requests, not exact delivery times.
input-boundary-replay.json records every actual controls-delivered update
with its native deltaTime for equivalent Web replay.

The capture runner does not launch/close the game, change a browser tab, or
change reference fixtures. Coordinate exclusive original-game ownership before
issuing requests. Reuse a unique Id: the observer ignores its last request Id.

For a win/transition probe use -Mode IsolatedMotion. It installs a temporary
empty in-memory SaveData, suppresses SaveFile.Save with a Harmony prefix, and
restores the prior in-memory save in a finally block. isolation.json records
the persisted save hash before/after and suppressed-save count. The external
result is only published after that audit completes. Existing ordinary
capture behavior is retained.

The full reproduction manifest is docs/parity/evidence/original/manifest.json;
it labels failed hidden-window captures and superseded v1 camera starts. Raw
prior frame metadata is retained unchanged.

GPU_WALL:12 and GPU_WALL:ALL are observer request-line commands for neutral
original wall texture readback. They do not load or move a level. They read
the original Draw WallTiles and WallTilesFlip arrays and use Graphics.Blit
to a Linear ARGB32 render target, then ReadPixels into linear RGBA32 with
GL.sRGBWrite=false. This copies the original hardware-decoded texels without
wall tint or Web normalization. capture.json includes color space, graphics
API, source texture format, graphicsFormat, dimensions, sampler, wrap mode,
and mip count. The full96-file evidence set includes per-file hashes and
differences from the starting AssetRipper/Web PNGs.
GPU_WALL:EXTRAS reads WallBig/WallBigFlip plus the configured KeyboardControls
and MouseZoom; keyboard identities are actual key names Z/X/R/Escape.
GPU_WALL:RENDER reads the specifically listed eye/button/gradient and movement
icon fields. Metadata preserves original field and texture identity; hashes.json
records PNG SHA256 values. Earlier partial EXTRAS capture is explicitly labeled.

New static captures also collect one frame of read-only colors.json. Hooks
observe original DrawBlock/DrawBlockBorder ticket doubles and DrawTexture
entry raw Color, texture identity and SetDrawRect pixel rectangle. No tint is
changed. focusGeometry records native Draw.block*Last values. Managed
Internal_DrawTextureArguments.color is Color; explicitColor32Candidate is a
separate CPU conversion for comparison, not proof of native vertex format.

Motion phases additionally expose `undoDirection` (the original private
UndoInput previous-direction bool) and `playerDrawFlags` (`isPlayer`,
`drawIsPlayer`, `possessable`). These are read-only; they do not reset native
state. `summarize-history.py` builds history-repeat-replay.json and
history-repeat-summary.json from the four held-history captures and the
fresh automatic-load capture. It validates every delivered/completed update
pair against the source float32 scheduler and verifies the fresh-load save
isolation audit.

`GPU_WALL:EFFECTS` reads only InfParticleTex and InfParticleOutlineTex.
Timed `INSPECT_<nativeBlockIndex>:<milliseconds>` and `INSPECT_OUT:<milliseconds>`
invoke the original public World.PushInspect/PopInspect entrypoint once at
the request boundary, then record natural native camera animation. They are
method-entrypoint probes, not mouse-event replay. Phase metadata includes
drawStyle, inspection state, native camera times and accepted movement
scratch records. For actual accepted movement proof use
history-before:TurnCompleted: original TurnCompleted reuses Movement.moves.
cloneEntry is true when an Enter targets a noncanonical representation.

SpecificBlock camera does not advance newCamT, so its capture settling gate
uses cameraMoving rather than newCamT>=1. Other modes keep the earlier gate.
`summarize-hardpaths.py` generates hardpath-native-index.json, validates ten
style/clone/inspection/infinite-exit/fixed-focus outputs and appends their
manifest entries without changing prior references.

Motion phase metadata also includes the native `Draw.infExitPreviews`: each
direction and ordered `exitBlocks` identity chain is read-only. RRD recursive
flip proof and source locations are in `docs/parity/recursive-flip-source`.

`FONT_METRICS` as the second request line performs a read-only MainFont
export without loading or moving a level. It requests printable ASCII at
sizes12/16/20 before querying any final UVs, then copies the same generation
font atlas with the neutral GPU path. Glyph advances, min/max bounds, UVs
and flipped packing are retained. `DrawText` is observed for the exact Move
caption, font choice, alignment, fontSize and actual drawRect; its text starts
with a newline. V4 additionally calls GUIStyle.GetCursorPixelPosition for
indices0/1/5 on the actual rectangle and centered600×600 rectangle. Cursor
positions are line positions, not a direct glyph-baseline measurement.

`summarize-preview-font.py` validates all36 actual RRD preview frames, the
native four ordered[101] chains, both complete285-glyph font datasets and
the v3/v4 atlas hash equality. It appends the new entries without deleting
earlier partial font generations, and emits preview-font-native-index.json.

`FONT_METRICS:1001x733` and `FONT_METRICS:1280x720` resize only the authorized
native window, then export matching screen.png, actual control geometry and
font/cursor metadata. `FONT_FACE_METRICS` records native FontEngine face info
and legacy TextGenerator lines/characters/vertices at12/16/20.

`GUI_FONT_PACK`, `GUI_FONT_PACK_ODD`, and `GUI_FONT_PACK_FALSIFY` are explicit
diagnostic overlays: one native DrawText frame over opaque black, preserving
gameplay and restoring style/rect afterward. They are not natural gameplay
baselines. The packs contain source-entrypoint labels with fractional origins,
odd/even dimensions and both newline-Move/single-line Undo.
`analyze-gui-font-pack.py` finds unique glyph mask alignments independently
before checking a proposed layout rule. It retains failed predictions rather
than fitting expected results. See native-font-layout-evidence.md for limits.

`GUI_FONT_PACK_CROSS` holds newline-Move at102x82 with signed fractional X
origins. `GUI_FONT_PACK_TEXT_CROSS` holds geometry fixed across Move,
newline-Move, Undo and newline-Undo, and exports native TextGenerator
preferred widths/characters/lines/vertices for all four forms at12/16/20.
V10's legacy fractionY telemetry is a row ordinal; actual rect.y is integer
and is used by analysis. Both commands are diagnostic overlays only.

New motion captures add shine.json with read-only original DrawFlipShine
ticket/MiscAnimT/focus/cloneFade context. requested-band is the original
DrawTexture entry rectangle; submitted-band is the actual Graphics.DrawTexture
screen rectangle after native clamping. No band, camera or timing math changes.

SPARSE_MOTION (capture.ps1 -Mode SparseMotion) preserves every original
phase and frame state but samples PNGs on each event start/every eighth
frame/final40ms. Unsaved images have file=null and imageCaptured=false.
capture-recursive-family.ps1 reproduces the four existing matrix routes;
summarize-recursive-families.py validates images, delivery, exact endpoints,
source hashes and strict accepted-move predicates without awarding coverage
based on a level name. See native-recursive-family-evidence.md.

TUI_FONT_METRICS loads text_1 in the authorized800x600 debug window, waits
for the original startup fade to finish, and observes actual FixedWidth
DrawText/GUI.Label calls. It exports95 ASCII CharacterInfo glyphs at the
actual computed size56, same-generation Inconsolata-SemiBold atlas,100
native LowerCenter rectangles/cursors/colors, TextGenerator and FontEngine
metrics. analyze-tui-font.py independently measures100 exact glyph masks;
summarize-tui-font.py appends provenance and retains the earlier fadedV1
as diagnostic. No game font, GUI geometry or rendering math is changed.

capture-intro-taps.ps1 -Level first_puzzle (and second_puzzle/third_puzzle)
records four independent fresh GoToLevel cardinal taps. Each40ms request is
followed by400ms release; actual delivered controls and all native frames
are retained. summarize-intro-taps.py validates complete reset snapshots,
actual control delivery, one accepted turn and every800x600 PNG, and adds
intro-fresh-tap-native-index.json without replacing earlier references.
