# Hub caption load integration regressions

2026-10-25. Source-based loader regression scope only. Owned files are
new tests/hubCaptionLoadIntegration.test.ts and this new record. No
existing production/shared file, browser/native UI, screenshot, injection,
staging or commit was changed by this subtask. Main owns the loader,
scheduler, controller, renderer and eventual integrated verification.

## Observations and hypotheses

The initial inspected loader had model caption fields but did not assign
wall caption state, did not start count/celebration lifecycle state and
removed every open wall immediately. The read source supports three
distinct integration risks: missing wall initialization, over-eager wall
removal/history reset, and confusing the ordinary core-count threshold
with all-portal area completion. A static helper test cannot distinguish
these loader policies. The experiments therefore use actual unchanged
parseLevel(hub), ProgressionModel.applyToHub and canonical markWon calls,
without constructing synthetic walls or reading private accumulators.

The recovered authoritative source is
F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp/LoadLevel.cs,
DoHubModifications1080–1303. LoadLevel1080–1087 clears histories only at the
first Hub load and suppresses that load's animations. LoadLevel1097–1153
requires at least one portal and every portal won for celebration; it
records completion history even if initial suppression prevented animation.

LoadLevel1190–1247 initializes counts before removal. All won portals
contribute to uncapped solved count; hard==0 portals supply the required
count, minus one in Swap and Wall. Display solved is capped from above.
LoadLevel1249–1288 retains a newly opening ordinary wall on a later Hub
load, while the route record is already open. An ordinary area's closed
pass removes its history key. The reverse wall pass allows all Center
walls to animate in the same load, suppressing sounds after the first.
LoadLevel1290–1303 counts retained ordinary walls only in RecentArea and
consumes levelsNewlyWon after the pass. CountingTotalDelta is new wins
minus uncapped overflow, not simply the numerator difference.

The retained collision wall must be treated as open by the gateway and
hard==2 portal checks (LoadLevel1323,1344–1354). Session/title history reset
corresponds to native hubLoaded resets at PauseMenu557/793 and World1781;
it must not change serialized progress. These source rules are the test
oracle. No native runtime trace or image comparison was made.

## Bounded regression cases

The new suite has nine tests, using only actual bundled Hub objects:

1. Closed Area_Enter walls receive exact initial counts and native timer
   defaults before removal decisions; route-open is false.
2. A saved already-complete Enter area removes its open wall immediately
   on the first Hub load, starts no opening/celebration and records history
   so a repeated load does not animate it. Removed route records still
   retain their initialized state and open=true.
3. After an empty first Hub, newly winning Enter's core puzzles retains
   the live opening wall with open=true, initializes recent-area counting
   and raises global gates. Every portal unlock flag matches the equivalent
   first-load immediate-removal world. The next Hub load does not replay.
4. A later closed ordinary-area load re-arms that area's opening history;
   winning the removed canonical win and loading Hub opens it again. The
   fixture changes the public saved-win set to exercise the source closed
   branch without depending on any private history representation.
5. Actual multiple Center walls all remain present on first opening;
   reversed source block order selects one unsuppressed sound and suppresses
   the remaining walls' sounds. Generic per-area deduplication would fail.
6. Two new Enter wins plus another canonical win accumulate delta3 on the
   recent Enter wall with solved2. A repeated markWon does not add a win.
   The following Hub load demonstrates one-time accumulator consumption.
7. Actual Swap portals exercise capped-away wins. The bundled core count
   minus one is required1. Completing all its portals produces uncapped
   solved above1, display solved1 and counting delta1 after subtracting
   overflow. No denominator was changed to fit the test.
8. Enter core threshold alone does not celebrate. Winning all remaining
   hard/visual portals starts the actual attached-area clock at-1.25,
   counts every portal and assigns normalized referenceName-1 indices.
   A repeat load does not replay celebration.
9. resetHubAnimations restores first-Hub suppression after title/session
   reset, leaves serialize() unchanged, and a freshly restored serialized
   save also begins with first-Hub suppression.

These load-policy regressions complement main-owned helper tests for
zero/negative counting deltas and timer/update behavior. This suite does
not add an invented route solely to manufacture a negative accumulator.

## Actual experiments and tested context

No failing-before regression run completed before main changed the loader.
The old null-state/immediate-removal behavior above is an inspected-source
observation, not a claimed red test result. Main's integration was already
present for both actual runs of this new file. No shared production
reversion was performed.

First actual run:8 passed,1 failed at a test-fixture assertion that Swap's
required count should exceed1. The actual bundled denominator is1. Only
that assertion was corrected from >1 to >0; expected capped delta stayed1.
Second actual run at local16:36:56: all9 tests pass. Command:

    npx vitest run tests/hubCaptionLoadIntegration.test.ts --reporter=dot

npx tsc --noEmit also passes. Revision was
dbf4191d58dba42c38433764b5fa642c8930da72 with main's uncommitted loader/model
changes, rather than clean HEAD. SHA256 values recorded immediately after
that passing run distinguish the tested working tree:

- src/core/progression.ts:
  682a7644f28a480d9bbeefeee5303e75536599f4bae5ca53907aca53cf9cebbd
- src/core/model.ts:
  2ae3fef52f371653c1f89afc8192bed7b267ce527dfc449ab531895341dfd126
- src/assets/levels/hub.txt:
  15d5e77bf7a6d17af6d4f75316f11f8c5113847ff6b224c9d83c2b0abf07fa9c
- tests/hubCaptionLoadIntegration.test.ts:
  0fc5800713f8e27de447e4d2e3156f465e7f3d5b646ac7f33d8abe0a5089e752
- Native LoadLevel.cs:
  7de74bb1364a9b7178d912b8eb0439178cf89234c305fda87cedfaa182f10f6d

The result supports those bounded loader source contracts. It does not
establish native/Web visual parity, timer scheduling, glyph coverage,
caption pixels or controller title-action wiring. No new screenshot or
visual approval follows from these nine passing source-based tests.
