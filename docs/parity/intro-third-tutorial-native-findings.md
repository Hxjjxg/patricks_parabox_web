# Native Intro third-puzzle tutorial captions and Note

Date: 2026-10-25. New actual native references at800x600,1001x733 and1280x720. Each starts with an isolated Hub save with first_puzzle/second_puzzle won, performs setup LEFT DOWN DOWN, then delivers DOWN40ms and NONE1600ms through normal Controls.Update and the actual Area_Intro third portal. This is not a direct third_puzzle load. Every run confirms natural level-after:third_puzzle, settled end state, exact PNG dimensions and unchanged persisted save. Native ends settled in third_puzzle800x600. Existing observer V14 and capture helpers are unchanged.

Derived geometry, source hashes and complete per-file hashes: [intro-third-tutorial-native-derived.json](evidence/original/intro-third-tutorial-native-derived.json). Original per-frame PNGs/telemetry remain in all three capture directories.

## Visible reference

| Native screen | Settled PNG | Source font size | Note line1 / line2 | Thresholded line ink bounds |
| --- | --- | ---: | --- | --- |
| 800?600 | [frame-0095.png](evidence/original/intro-third-tutorial-800x600-native-v1-20261025/frame-0095.png) | 12 | Note: You can / undo a reset | [[38, 468, 116, 476], [43, 484, 111, 493]] |
| 1001?733 | [frame-0065.png](evidence/original/intro-third-tutorial-1001x733-native-v1-20261025/frame-0065.png) | 16 | Note: You can / undo a reset | [[48, 568, 150, 579], [54, 590, 144, 602]] |
| 1280?720 | [frame-0054.png](evidence/original/intro-third-tutorial-1280x720-native-v1-20261025/frame-0054.png) | 20 | Note: You can / undo a reset | [[115, 586, 243, 600], [123, 613, 235, 629]] |

The four captions read Undo, Redo, Reset puzzle and Menu. English localization Resources/localization.txt:167 is Note: You can undo a reset. All three raw screenshots show the same two-line wrap. Ink bounds use a fixed RGB predicate inside the Note region; they are not cursors/baselines and do not fit production text geometry.

## Source-derived geometry

The native Hub Level.Update stores World.NexusAreaCameFrom from its actual hubAreaName (Level.cs:126-140). Draw.cs:5169-5203 selects this tutorial when the puzzle comes from Area_Intro and is neither first_puzzle nor custom_level. Only second_puzzle has staged ControlsFadeT visibility; third_puzzle displays the controls fully.

DrawControlsText (Draw.cs:5131-5154) uses screen-space placement at width/height<1.51, and focus-relative placement otherwise. The first row is centerY-2*spacing; five rows advance by spacing. Font size truncates GetFocusFractPause()*min(width,height)*.075*.64 (Draw.cs:5446-5449). GetFocusFractPause interpolates .6 to.335 as aspect goes16:9 to1:1 (Draw.cs:2591-2602).

DrawControl (Draw.cs:5211-5310) first sets a short-edge-sized centered rectangle. Icon captions move that GUI rect's y by iconSide*.25 and draw a leading newline plus displayName with MiddleCenter; the icon uses a separate rectangle. For empty-action Note, width is shortEdge*.15 in screen-space mode or*.22 otherwise, height is2*width and the rectangle centers on its row. SetDrawRect truncates endpoints toward zero (Draw.cs:1308-1310); negative origins and odd extents matter. The fixture evaluates source float operations at float32 and includes all five expected rectangles.

| Screen | Layout | Expected centerX | Row spacing | Expected Note GUI rectangle (x,y,w,h) |
| --- | --- | ---: | ---: | --- |
| [800, 600] | screen-space | 77.000000 | 90.000000 | [32, 390, 90, 180] |
| [1001, 733] | screen-space | 99.985001 | 109.950005 | [45, 475, 109, 220] |
| [1280, 720] | focus-relative | 179.487976 | 123.984009 | [100, 449, 158, 317] |

These are source-derived expectations under settled normal focus, not measured GUI internals. DrawText uses shared Label GUIStyle, MainFont/Jost-SemiBold, Normal font style and MiddleCenter (Draw.cs:1477-1493). Existing native-main-font-viewport-1001x733-v5-20261025/font-metrics.json records Main GUIStyle wordWrap=true, richText=true, Clip, padding[0,0,3,3]. This prior style is not fresh Note-specific telemetry.

## Limits

V14 ControlGeometryPatch records only Move/MoveNR; FontTextPatch retains only Move. No fresh Undo/Redo/Restart/Menu/Note GUI rect, cursor or baseline is available. No observer instrumentation, wrapped cursor sequence, inferred general Unity break algorithm, fit offset or Web similarity score is introduced. The raw image references support independent visual comparison at exactly these DPR1 viewport sizes. Other locales, fonts, aspects, mobile/gamepad and second-puzzle fading remain outside scope.
