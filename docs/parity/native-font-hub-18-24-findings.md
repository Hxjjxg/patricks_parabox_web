# Native Hub font coverage: unavailable extended sizes

Date: 2026-10-25. This investigation did **not** obtain native glyph metrics or alpha atlases for font sizes13/18/24/25/32/41. They remain unverified. No font atlas, shared renderer, production code, or installed observer DLL was changed.

## Source contract

Recovered source: `F:/AssetRipper_win_x64/parabox/ExportedProject/Assets/Scripts/Assembly-CSharp/Draw.cs`. These are source facts, not measurements from the failed captures:

- Draw1477–1495: `DrawText` assigns MainFont, Normal style, alignment and integer font size, then calls `GUI.Label`. No DrawTexture color-transfer rule is inferred for GUI text.
- Draw3053–3085: numerator and denominator are separate MiddleCenter labels, with numerator `numSolved - (Counting ? CountingDelta : 0)`. The separator is a separately drawn rectangle; there is no slash glyph. Font size is integer truncation of double `h * 0.41999998688697815`.
- The ordinary800×600 Intro cell height previously derived by the rendering investigation is approximately44.727, yielding fraction font18. This attempt did not freshly log the native `DrawText` argument.
- Draw3664–3673: a paused unlocked portal uses `Hub.puzzleData[floor.SceneName].referenceName`, black shadow then white foreground, MiddleCenter, integer truncation of float `height * 0.55f`, with shadow offset0.06 of the cell dimensions. `indexDisplayName` is not the source field.
- Applying the reference formula to the ordinary cell would suggest24, but the paused camera changes physical cell height. The rendering investigation's settled800×600 paused estimates are reference13 and fraction10. This attempt supplies no independent pixel or native argument verification of those estimates.
- Intro reference labels are a1…a9; ordinary count glyph coverage needs digits0…9, with minus useful for edge states. Font25/32/41 remain open alongside18 and the actual paused size.

The supported12/16/20 data and the separately committed Note glyph-background findings remain valid; this investigation neither expands nor invalidates those earlier datasets. Scaling a supported glyph is not a substitute for native size coverage.

## Diagnostic preparation and deployment boundary

Owned preparation archive: `evidence/original/native-font-hub-18-24-observer-v1-20261025/`.

`Plugin.cs` is a diagnostic **copy**, extended to request12,13,14,15,16,17,18,19,20,21,22,23,24,25,32,41 and add logging-only Hub text observations. The isolated build completed with0 warnings and0 errors. `AgentObserver.diagnostic-never-deployed.dll` is retained solely as a prepared, **never deployed or loaded** artifact. The tracked observer source and original installed DLL stayed byte-exact.

Automatic approval review rejected two proposed deployment commands before execution: a combined process-stop/DLL-copy/relaunch command, then a narrower DLL deployment with save safeguard and stale-request cleanup. Both returned only `blocked by policy`. The parent explicitly prohibited further deployment attempts. No deployment retry or alternative patching path followed that instruction. `review-and-scope.json` records this boundary.

Read-only inspection falsified the proposed use of the installed generic font commands: Plugin656 and668 reject every size except12/16/20; the metrics and face-metrics loops also hardcode12/16/20. Consequently the original observer cannot produce the requested extended dataset with its existing commands. No unsupported font command was sent.

## Rejected black visual evidence

The original executable was relaunched as PID29452 using `-WindowStyle Hidden`. The installed original observer then completed:

| Archive | Telemetry scope | PNG count | Visual status |
| --- | --- | ---: | --- |
| `native-font-hub-18-24-context-v1-20261025` | Isolated Intro Hub ordinary → Pause → Resume,800×600 |129| **REJECTED_ALL_BLACK** |
| `native-font-hub-18-24-restored-v1-20261025` | Isolated settled `third_puzzle` audit,800×600 |5| **REJECTED_ALL_BLACK** |

All134 PNGs have RGB zero at every pixel, identical PNG SHA-256 `f975c86861e7ac0b664955189f8f529e994e474681ed1f0de18c1016d021c457`. These files cannot validate GUI, glyphs, sizes, metrics, colors, or rendering. The earlier optimistic `probe.json` scope has been corrected explicitly; both archives contain `visual-evidence-status.json`. The hidden launch is the observed context, not a proven rendering-failure mechanism.

Phase/world telemetry and save-isolation records remain usable independently. The context anchors are frame262998 Playing, frame263068 Paused, frame263116 Playing, but each corresponding PNG is rejected. Both isolation audits report the original on-disk save unchanged and previous in-memory save restored. A successful capture command does not establish a successful visual capture.

The documented CUA `listWindows()` and `listApps()` inventory contained no Patrick game window or selectable game app. PID29452 remained responding with an empty `MainWindowTitle`; the available documented native controls could not select/show it. No browser was controlled and no further visual capture was attempted after that limitation. Visible rendering is **not** claimed restored.

## Restoration audit

The original process32672 was closed gracefully. Its normal close wrote a changed save hash `afed57901105d7baf469e7e6733b72466b9694277e375f0e2146589bda4be981`; the private pre-close backup was then restored byte-exact and removed. The original executable was normally relaunched as PID29452. Final audit verifies:

| File | SHA-256 |
| --- | --- |
| tracked `scripts/parity-original/Plugin.cs` | `78f656710c7f39193887a0d1c70d4103a3953656e7ba3d6ff4ea5aa64fb9bc45` |
| original installed `AgentObserver.dll` | `e0e22b2b9be36a02c49cf1f0cd8aa10f3ca67c05edd6344bf810ca1a6e3f9360` |
| original `save1.txt` | `40e7f4ce65bc9819119c0a83f967a77bfa1d20fe78651307329b23a8e271304a` |

No private raw save backup is retained in the owned evidence. The original observer source/DLL backups are intentional archive artifacts. `final-audit.json`, `restoration.json`, and each archive's `hashes.json` record the final state. The original completed command file remains in the running process's command location; remove or replace it before any later process relaunch to avoid unintended replay.

Reproduce the pixel/hash audit from the repository root:

```powershell
python docs/parity/evidence/original/native-font-hub-18-24-observer-v1-20261025/finalize-audit.py
```

Completion boundary: diagnostic preparation and rejection/restoration audit are complete. Extended native font coverage and a verified visible native recapture remain unresolved.
