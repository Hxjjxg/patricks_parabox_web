# Native Hub portal rendering: previews, links, markers, and fractions

Date: 2026-10-25. Read-only source/asset inspection and existing image analysis; no native capture, production edit, or browser action. The machine-readable extract is [hub-portal-rendering-native-derived.json](evidence/original/hub-portal-rendering-native-derived.json). Native source root: F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp. Resource root: adjacent Assets/Resources.

## Observed gap and comparison limits

The existing Web image docs/parity/evidence/web-hub-arrival-after-dev/third-win-held/motion-0003-jumpOut-0.5.png draws nine empty blue rounded portal outlines. The native counterpart docs/parity/evidence/original/intro-third-win-held-native-v1-20261025/frame-0096.png has rectangular puzzle-image previews, lit/dark link paths, white corner markers, and a fraction on the shortcut wall above the green destination block. These are independent missing Hub rendering layers, not player arrival-animation geometry.

The native frame is 1155063 at 1891.05225 ms, JUMP_OUT T=0.241956323/0.5 (q≈0.483913); the Web filename denotes q=0.5. This pair establishes the static Hub-layer omission. It is not a same-time pixel-equality approval; animated player/marker phase and background particles may differ.

## Puzzle previews are cached PNG textures, not live miniature worlds

Draw.DrawPortal (Draw.cs:3618-3675) reads Hub.puzzleData[floor.SceneName].thumbnail. A missing cache entry is loaded with Resources.Load("level_thumbnails/" + sceneName, typeof(Texture2D)); the result is cached back into that PuzzleData object. At most 30 thumbnail load attempts occur per DrawBlocks call; numPortalTexLoaded resets at Draw.cs:1536. If no texture is available, FullWhiteTex is used. Hub.PuzzleData.thumbnail is declared at Hub.cs:23.

Floor.ThumbnailTex/LoadedThumbnailTex also exist, but are not the cache used by this portal path. No level parser, recursive miniature world, or RenderTexture is created for a portal preview at draw time.

AssetRipper has already exported all 368 puzzle previews under:

    F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Resources/level_thumbnails/<scene>.png

All 368 PNGs are 128×128 RGBA, total 1,339,204 bytes; every puzzle_data scene has a matching PNG. Each has a .png.meta and a .asset Sprite metadata companion. The inspected Intro import metadata specifies bilinear filtering, clamp wrapping, sRGB, and no mipmaps. The imagery, small walls, player colors, and apparent square border are baked into these images. A generic extra rounded blue border is not part of DrawPortal's normal body rendering.

The developer screenshot pipeline explains the origin: Screenshot.ScreenshotCoroutine waits for the end of a frame and calls TakeScreenshot(border:false, scale:true, "Assets/Resources/level_thumbnails/" + currentLevel + ".png") (Screenshot.cs:37-44). TakeScreenshot crops the focused board without its outer border, offsets its read y by 2, and Point-scales to 128×128 before PNG encoding (Screenshot.cs:89-118,127-130). The shipped exported PNGs are therefore the faithful available inputs; regenerating previews by loading mini-worlds would introduce a different rendering path.

## Intro asset and resource map

The detached Area_Intro block is the special-effect-6 11×11 block at hub.txt:1422. Its portal data is:

| Scene | Local position | Reference | Thumbnail |
| --- | --- | --- | --- |
| first_puzzle | (6,6) | a1 | first_puzzle.png |
| second_puzzle | (5,6) | a2 | second_puzzle.png |
| third_puzzle | (4,6) | a3 | third_puzzle.png |
| enter | (2,4) | a4 | enter.png |
| elbow_finish_idiom | (3,4) | a5 | elbow_finish_idiom.png |
| round_corners | (4,4) | a6 | round_corners.png |
| separate | (5,4) | a7 | separate.png |
| enter_two_sides | (6,4) | a8 | enter_two_sides.png |
| lock_door | (7,4) | a9 | lock_door.png |

All nine are ordinary core puzzles (hard=0, eyesJump=0). The hub source also places the shortcut-count wall at (5,2), unlockerScene=lock_door, and an Area_Enter reference block at (5,1). Source-data coordinates, rather than native/Web array indices, identify these objects.

## Preview tint and compositing

DrawPortal draws the texture at exactly the portal's one-cell rectangle; PortalSize returns 1 (Draw.cs:3689-3692). A celebration can temporarily enlarge it by up to 1.5× (3620-3633). Ordinary hard=0 portals have no separate underlay. Hard/visual portals draw a category-colored FullWhiteTex underlay and inset the thumbnail to 0.8× (3648-3660).

The raw Draw constants are wonPortalColor=(0.5,0.5,0.5,0.5) and lockedPortalColor=(0.08,0.08,0.08,0.5) (Draw.cs:318-320). The first is used for both won and normally unlocked portals. The locked tint is used when !Won and (!Unlocked or visual-category global unlocking), except screenshot/break-transition overrides (3661).

These raw RGBA values must not be copied directly into Pixi tint/opacity. Draw.HSVToRGBGUI explicitly halves RGBA (1516-1523), the scene's serialized Mat is null (Scenes/init.unity:238), and DrawTexture uses Graphics.DrawTexture with that material (1427-1474). This pipeline's half-color convention makes raw (0.5,0.5,0.5,0.5) an approximately full-color opaque preview, and raw (0.08,0.08,0.08,0.5) an approximately 0.16 RGB multiplier with opaque alpha. Existing native pixels support that interpretation: second_puzzle's exported edge RGB(214,215,214) appears (34,34,34), while unlocked first/enter edges retain approximately their exported brightness. Export/native differences of 1–2 channel values remain; these samples establish the factor, not exact byte equality for every texel.

When paused outside Break, an unlocked portal larger than 10 pixels receives its referenceName as white centered text with a black shadow offset by +0.06 of its width/height; font size is int(height*0.55) (3664-3673). This text is not normally present in the playing capture.

## White flags are pulsing square corner markers

DrawPortalMarker (Draw.cs:3677-3685) draws a white FullWhiteTex square if Unlocked && !Won && !ScreenshottingBlocks, except hard=2 while World.unlocking. There is no flag sprite asset in this path.

For t=Util.QuadOscillate(portalFlashT*0.5), square side s=lerp(width*0.25,width*0.42,t). Its center is (portalCenterX-width*0.42, portalCenterY-height*0.42); SetDrawRect receives that center minus s/2. The square uses s for both dimensions, including a rectangular cell. portalFlashT advances in Draw.Update (Draw.cs:1007); the resulting oscillator has a 2-second period. It continues as a draw-state clock rather than a per-portal random phase. Util.QuadOscillate is the piecewise QuadInOut oscillation in Util.cs:35-42.

The paired native image has these markers at first_puzzle and enter. A won portal receives no marker. Markers are queued separately in qPortalMarker and drawn after moving blocks, before possessable/face queues (Draw.cs:2548-2565), so they must not be flattened beneath every moving object.

## Connections come from UnlockLines, not a line between every neighbor

LoadLevel's Hub processing builds each Floor.UnlockLines from puzzle_lines and shortcut walls (LoadLevel.cs:1401-1512). Non-immediate puzzle links produce lines; immediate links do not. A link's dx/dy is destination minus source; lit is destination.Unlocked; thick means destination hard==0. A linked unlockable wall adds a thick line toward a neighboring block with a SubLevel, with lit equal to that wall's open state. Root and end-game paths have additional source-defined branches in the same method.

The Intro chain is first→second→third→enter→elbow_finish_idiom→round_corners→separate→enter_two_sides→lock_door. Only third→enter is non-immediate. Therefore its visible puzzle-connection line runs from (4,6) to (2,4), shape HorizFirstL: horizontally to (2,6), then vertically to (2,4). The shortcut wall linked to lock_door adds a path from (7,4) to the reference block (5,1), shape VertFirstS: via (7,3), then (5,3), then (5,1). The latter remains dark until its wall opens. Immediate chain neighbors do not get independent synthetic connector lines.

Floor.ComputeUnlockLineShape (Floor.cs:218-341) chooses Straight for a zero axis, otherwise tries clear horizontal-first/vertical-first L routes, beginning with the larger delta axis. It treats floors, ordinary walls, and relevant unlock-wall positions as blockers; if both L routes are blocked, it selects a one-cell-offset S route. This routing explains the dark path bending around the row and shortcut wall in the native image.

DrawPortalLines (Draw.cs:4176-4254) converts local deltas into pixel endpoints, including y inversion. Thick width is int(cellWidth*0.32); thin width is int(cellWidth*0.12), minimum 1. It splits thickness into sm=width/2 (integer) and sp=width-sm. DrawPortalLine uses rectangular FullWhiteTex segments extending sm/sp around their endpoint bounds (4257-4278). SetDrawRect truncates both endpoints toward zero (1308-1315); it does not independently round an origin and width.

LineColor (Draw.cs:4159-4173), with f=(parentWidth+parentHeight)/(2*screenHeight), starts from v=max(parent.val,0.4)*(-0.4*log_base20(f)+0.8). Active uses hue+offset, saturation*0.85, value*vFactor0.9; inactive uses the parent saturation and value*vFactor0.25. HSVToRGBGUI then applies the native half-color convention. These links use the enclosing board's color, not portal-thumbnail pixels.

The drawing loop calls DrawPortalLines in two passes (Draw.cs:5637-5654). A source oddity is real: its final lit parameter is unused; the method instead compares (unlockLine.lit || ScreenshottingBlocks) against unlockLine.lit. Read-only Mono.Cecil inspection of the actual debug Assembly-CSharp.dll confirms that field comparison and no reference to parameter 9. Ordinary opaque lines are consequently drawn twice without a visible blending difference. This must not be silently reinterpreted as proof of an intended active/inactive pass filter; the fixture preserves the IL excerpt.

## The shortcut eye-like mark is the fraction's denominator

DrawWall renders the annotation whenever block.numRequired!=0 (Draw.cs:3053-3085). It draws text numerator=numSolved, or numSolved-CountingDelta while Counting; denominator=numRequired. There is no separate eye asset in this annotation path. In the paired image the lower glyph is 9, forming 1/9 with the top 1 and separator.

For a rendered wall of size w×h centered at (x,y): fontSize=int(h*0.42); numerator text's centered rectangle is shifted y by -h*0.26; denominator by +h*0.26; each rectangle is 2w×2h. Separator dimensions are w*0.6 by h*0.05 at the wall center. Text color is inactive LineColor for the outer area's exit block, alpha forced to 1, RGB multiplied by 1.25; the separator halves that RGB. Unlocking brightens the text, and CountingScaleT can enlarge the entire wall/text geometry to 1.5× (2995-3001,3061-3068).

The values are gameplay fields, not fixed texture labels. Hub processing counts core portals in the area, counts all won portals, caps solved at required, and sets numRequired/numSolved on the wall (LoadLevel.cs:1214-1247), with explicit Swap/Wall exceptions. Intro has nine core portals, hence denominator 9. Counting is an animated tally: UpdateCounting advances at 1/0.3 per second, decreases CountingDelta on each integer crossing, and pulses CountingScaleT (Block.cs:513-545). A permanently hardcoded final numerator would miss that transition.

## Draw order and implementation boundary

Within DrawInBlock, connection paths precede floor bodies (Draw.cs:5626-5685). Won/locked portal floor tickets are enqueued before unlocked-unsolved ones. DrawOrEnqueueFloor queues each portal body in qStill, queues its marker separately, and draws its offset shadow immediately (6449-6481). DrawPortalShadow uses a square black shadow shifted by twice the border thickness; unlocked-unsolved shadows first snap center to floor(center)+0.25 (3491-3512). All relevant tickets retain parent clamp information. These layers coexist with the normal recursive board/block rendering; preview textures themselves are static.

This investigation maps the source, existing assets, and observed omission. It does not claim a new pixel-perfect Hub render or a new native runtime capture. The effective tint convention is corroborated with existing pixels; animation phase, exact marker square size, and all-puzzle dynamic unlock transitions require their normal renderer validation after implementation.
