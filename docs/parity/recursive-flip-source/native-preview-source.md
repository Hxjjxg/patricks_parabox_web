# Native infinite-exit preview source proof

Source root: AssetRipper export `Assets/Scripts/Assembly-CSharp`. These are
source observations, independently checked against an actual native capture.

| Source | Native rule carried into the TypeScript core |
| --- | --- |
| `World.cs:748-749` | Detached dummy block is initialized without a player flag or a sublevel. |
| `Movement.cs:302-304` | Dummy bypasses ordinary solid-wall handling; real inner push is disabled during previews. |
| `Movement.cs:361-392` | Failed exit sets `InfExitDetected`; an in-bounds arrival after detection records the current exit chain and cancels the probe. |
| `Movement.cs:522,549,589,617,666` | Preview exploration does not overwrite `justEnteredArray` or `justInfEntered`. |
| `Movement.cs:994-1000` | A missing infinite-exit representation after detection records a preview instead of creating an infinity zone. |
| `Movement.cs:1055,1141` | Shed and actual move resolution are suppressed for preview exploration. |
| `Movement.cs:1381-1426` | Probe every cardinal edge in nested dx/dy order: left, down, up, right; use the first player's outer level. |
| `Movement.cs:1429-1450` | Direction comes from the first attempted move; collect ordered dummy Exit moves' `fromLevelBlock` references; ignore empty chains. |
| `LoadLevel.cs:151` | Refresh once block lists and initial infinity zones exist. |
| `UndoManager.cs:272,436` | Refresh after undo and redo/committed movement update current player/block/button state. |

Runtime proof:
`../evidence/original/flip-recursive-preview-topology-20261025/`.
Native viewport800×600, `1by1_playerr_flip2`, settled RIGHT RIGHT, then
DOWN40ms/NONE620ms. Native frame42 has no previews. First update after DOWN,
frame43 at27.928ms, has four ordered chains `[101]`, one per cardinal
direction. Player51 is now inside self1×1 level1, while exit representation101
is in root9×9 level0 at(1,1). The same chains remain at capture end.

`tests/fixtures/original-inf-exit-previews.json` directly extracts this native
list and full end-state, plus strict native infinite-exit crossing and fourth
DOWN clone-entry endpoints. No expected state was synthesized from the Web
implementation. Source capture paths are embedded in each fixture entry.

The TypeScript probe restores the caller's accepted movement scratch and block
temporary fields, and suppresses animation/history registration while probing.
The resulting arrays contain the live original Block objects, so a renderer
can follow representations without changing canonical `Level.getExitBlock`.
