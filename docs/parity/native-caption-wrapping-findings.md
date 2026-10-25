# Bounded native ASCII caption wrapping

2026-10-25. This module adds only src/render/nativeCaptionWrapping.ts, tests/nativeCaptionWrapping.test.ts and this document. It does not edit GameRenderer, controller, original game files, observer hooks or DEBUG. Main owns integration and the combined commit. No browser or native input was issued.

## Observation and hypotheses

The existing helper is nativeFontRendering.ts; there is no separate nativeJostFont file. It already exposes original same-generation CharacterInfo.advance values, the packed native atlas, native GUI baselines and multiline MiddleCenter anchor placement. nativeCaptionQuads deliberately returns null when an unwrapped caption exceeds the rectangle width. GameRenderer currently routes only icon captions through that helper, so the empty-action Note has no native-atlas wrap path.

Three actual native third-puzzle captures in cf30955 show the English Note as two lines, Note: You can / undo a reset. The strongest hypothesis is ordinary space wrapping in the source's narrow Note rectangle. Alternative hypotheses are a localization newline or a special baseline/position offset. The localization value is one line, rejecting the former. Unchanged multiline baselines predict the six observed ink bottom rows, so no extra offset is supported. An apparent20px edge difference was subsequently resolved as actual background compositing; see native-note-glyph-edge-findings.md.

The original C# submits unwrapped displayName to GUI.Label. Unity's complete internal word-breaking implementation is not recovered here. A simple single-space greedy policy using measured advances is a bounded implementation corroborated by the actual three Notes; it is not asserted as an exact universal Unity wrapping algorithm. The equal-width tie policy and arbitrary prose punctuation behavior are implementation boundaries, not newly measured native cases.

## Source and archived evidence

Source root: F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp. Draw.cs:5270-5284 defines the empty-action Note rectangle: short edge times0.15 in screen-space controls, otherwise0.22; y center minus that width; height twice width. All arithmetic is float before SetDrawRect's double endpoint truncation at1308-1310. UseScreenSpaceControls at5452-5454 uses a float aspect comparison against1.51f. DrawText at1477-1493 selects MainFont/Jost-SemiBold, Normal style, MiddleCenter and GUI.Label.

The prior viewport Main GUIStyle archive records wordWrap=true, richText=true, Clip, padding[0,0,3,3], contentOffset[0,0]. It is prior Move telemetry, not a fresh Note cursor measurement. Existing cursor-v4 and viewport-v5 captionMeasurements contain only leading-newline Move cursor sequences. Font-face-v6 records TextGenerator newline order and line cursor steps17/23/29 at font12/16/20. No archived per-word wrapped Note cursor sequence was found; the available API would permit a future explicitly authorized native probe, but none was run here.

| Actual viewport | Font | Note rect x,y,w,h | First line advance | With next word undo | Second line advance | Existing baselines |
| --- | ---: | --- | ---: | ---: | ---: | --- |
|800x600|12|32,390,90,180|80|112|70|476,493|
|1001x733|16|45,475,109,220|104|146|91|579,602|
|1280x720|20|100,449,158,317|130|182|113|600,629|

At each viewport the measured first line fits, its next whole word does not, and the remaining second line fits. Breaks are derived from width and advances, not a hardcoded phrase or viewport lookup. Tests also change available width and text to exercise the policy independently.

Newlines are inserted before calling existing nativeCaptionQuads. That helper keeps the source-established top-to-bottom line order: total block height is singleLineHeight+(lineCount-1)*lineHeight; center the block, add GUI padding, then apply the existing GUI origin/baseline snapping stages. No extra newline, padding, line-spacing or baseline constant is added by wrapping.

## Experiment and retained falsification

The candidate was tested using unchanged original glyph alpha, positions and the same150 threshold used by the native ink measurements. At12/16px both line bounds match all actual native threshold bounds exactly. At20px the second line matches; first-line predicted raw-atlas bounds are[116,586,243,600], while actual native bounds are[115,586,243,600]. Subsequent archive investigation in commit204e834 shows a gray78 void square partially underneath N: unchanged alpha115 composited over78 gives the actual RGB158. All288 pixels in the N20 rectangle match exactly when the directly measured rectangular background is included. The earlier black-background inference from crop corners was incorrect at the glyph. Tests retain both raw-alpha and actual-image bounds and assert the measured source-over result without a tolerance. No text offset, tint, fitted wrap width or new font data is introduced.

## API and integration

- nativeAsciiWordWrap(text,fontSize,availableWidth) returns text with explicit newlines or null. Supported input is plain captured printable ASCII separated by single ordinary spaces, with explicit newline/empty-line preservation, captured font sizes12/16/20 and positive integer physical width. It uses greedy whole-word fitting by CharacterInfo.advance.
- Rich text, unsupported glyphs/sizes, leading/trailing or repeated spaces, tabs/CR, fractional wrap widths and overlong tokens return null. Overlong-word splitting, Unicode breaking, rich-text wrapping, transformed GUI semantics and complete Unity whitespace rules remain unsupported.
- nativeNoteCaptionRect(xCenter,yCenter,screenWidth,screenHeight) returns the physical integer source Note GUI rectangle. Pass the actual source-equivalent tutorial row center and physical framebuffer dimensions. It performs float32 operations followed by endpoint truncation, including negative origins and odd extents. It does not infer the tutorial row center or replace the existing layout helper.
- nativeWrappedCaptionQuads(text,fontSize,rect) wraps then delegates to nativeCaptionQuads; a null result preserves the existing caller fallback. Rect values must be physical integers. At a different Web resolution convert physical rect/quad coordinates consistently in the integrating renderer; this module does not claim arbitrary-DPR validation.

Eight focused Vitest tests cover three actual sizes, varying widths/text, explicit newlines, unsupported inputs, source Note rectangles, native baseline order, exact raw-atlas ink bounds and measured20px background compositing. TypeScript checking passes. Actual Canvas capture and independent visual review remain with main; this is not universal native text or pixel parity approval.

## Integrated renderer and actual Canvas evidence

Main integrated the empty-action Note path into GameRenderer.drawControls while retaining the established icon-caption path. The source-equivalent physical tutorial geometry and framebuffer dimensions feed nativeNoteCaptionRect; returned physical glyph coordinates and sizes are divided by the renderer resolution consistently. Unsupported font sizes or glyphs retain the existing Pixi Text fallback. No phrase-specific line break, replacement font size or fitted offset is used.

The production callsite regression fails before integration:49 expected glyph sprites versus24 actual icon-only sprites. It passes after integration and verifies exact local glyph coordinates and pool reuse; an unsupported600x401 physical viewport explicitly retains the fallback. An initial test mistakenly added the nominal77 origin instead of the actual controlTutorial origin77.00000000000001; the corrected assertion uses the actual origin, with no tolerance or production coordinate change.

Actual real Intro portal activation is retained in evidence/web-native-note-after-dev/intro-activation (52rAF/2PNG). Fresh third-puzzle captures retain16/17/17rAF and3PNG at800x600,1001x733,1280x720 respectively. comparison.json records exact original/pre-fix/new image hashes and source hashes. note-native-before-after-crops.png contains unscaled native, old fallback and new glyph crops at all three sizes. Main directly inspected the plate and full new Canvas outputs. Independent review was requested separately and is still pending; these are three unit-resolution cases, not arbitrary-DPR or whole-scene approval.

Integrated workspace verification:68 test files/1061 tests pass, npm run typecheck and npm run build pass (existing Vite chunk-size advisory only). This includes other released but uncommitted pure helper tests and is not final immutable integrated approval.
