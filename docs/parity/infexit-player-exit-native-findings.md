# Infinite exit: player leaves the boundary

Native capture: [`infexit-player-exit-native-20261102`](evidence/original/infexit-player-exit-native-20261102/), produced by the already installed AgentObserver on the authorized debug copy `F:\Patricks.Parabox_inject_debug`. No observer source or plugin was modified. The frozen source SHA256 was `78f656710c7f39193887a0d1c70d4103a3953656e7ba3d6ff4ea5aa64fb9bc45`; installed DLL SHA256 was `e0e22b2b9be36a02c49cf1f0cd8aa10f3ca67c05edd6344bf810ca1a6e3f9360`.

## Reproduction and state

Observer command:

```text
request: infexit-player-exit-native-20261102
ISOLATED_MOTION:infexit_ref_first:800:600
DOWN LEFT LEFT DOWN RIGHT RIGHT RIGHT RIGHT UP RIGHT | RIGHT:40 NONE:1000
```

The first nine directions are settled setup moves `DLLDRRRRUR`, yielding `moveCount=10`, root player `(6,2)`, ordinary self-reference at `(6,1)`, and tier-zero reference at `(1,4)`. The final Right is delivered through the observer's Harmony hook on the real `Controls.Update`, not by directly calling movement methods. Original phase metadata records accepted `Slide` and `Exit` for player block20, `infExitNum=0`, `fromLevel=0`, `toLevel=0`; the endpoint is count11 with the player at root `(2,4)` and both references unchanged. The player's action is `ENTER_EXIT`, length `0.5s`; its camera transition is also `0.5s`.

The requested 40ms hold was actually delivered in the first eligible update at +44.85655ms relative to the capture timeline. That same update changes count10→11. The first saved image is at timeline 0 while the scheduled event is being installed and the control is not yet delivered; `frame-0001.png` at +44.85655ms is the first captured post-acceptance frame (`animT=0.0448563`). `frame-0004.png` .118501s, `frame-0010.png` .252683s, `frame-0016.png` .379565s and `frame-0021.png` .487998s bracket the .5s action phases. It then records BUMP_HALT through the requested one-second NONE tail; final image `frame-0048.png` is +1037.4436ms, BUMP_HALT t=.237056315. The exact per-frame timestamps, deltas, coordinates, draw transforms, camera fields and action metadata are in `capture.json`; update/controls/history boundary samples are in `phases.json`.

The run captures 49/49 PNG frames at 800×600, target60, vSync0, moveDelay70, skipping disabled and instant zoom disabled. As with existing observer captures, screenshot readback/PNG/file-write overhead is included in frame deltas; these are not pure native CPU timings or physical keyboard delivery times.

## Isolation and limitations

Observer `isolation.json` says persisted save hash unchanged and prior in-memory save restored; one attempted save was suppressed. Independently, I saved the exact pre-run bytes for the system save and both BepInEx command/result files. After the game process exited, the save file had changed; I restored those bytes and verified the original SHA256 `40e7f4ce65bc9819119c0a83f967a77bfa1d20fe78651307329b23a8e271304a`. The prior command and result SHA256s were also restored exactly. The game process is closed. Steam installation files were not accessed.

**Visual acceptance remains unverified.** The captured images are markedly darker than the existing valid native push-branch captures; sampled mean RGB for `frame-0012.png` is approximately `(13.78,7.87,4.54)` versus `(236,139,72)` for the prior push `frame-0006.png`. This indicates an environment/focus/render-state mismatch and makes the PNGs unsuitable for visual parity approval, even though their dimensions and animation metadata are present. The capture begins with a 1782ms update delta and phase metadata reports a Pause menu state during capture. I attempted to inspect/focus the visible game with the Computer Use interface, but the native pipe was unavailable on both initial attempt and a reset/retry (`failed to connect native pipe`). I stopped without claiming a visual result or using alternate UI automation.

All raw files copied into the repository evidence directory match their source-copy SHA256; the folder contains 56 files (49 PNG frames plus capture/state/phase/isolation and auxiliary metadata). Key manifests: `capture.json` `089ee3a85b6b04a7de381525979f3f5fb03c1f979c8a9db035c223d0e722a6f8`; `phases.json` `582b2fdc88eb6d9fcb4065048f3f4e48d7ce3cf8d3a2e5f38c3f10eb2f2bacde`; `start-state.json` `1899e35edbdf2ac78c073dd2b8ac54b139aeede1ed385e4a034ac20c0aeb510f`; `end-state.json` `936747ea940411b15d2d04d5651b3bac31e5f7930b4b195d45de967b43fca4c7`; `isolation.json` `813db21e0afcd4ec8d6433aa3a9d90fe89542d784de1c1dd95db7bebd8516734`.

This closes the missing **native logical route/state** evidence for the player-exit branch. It does not approve its appearance, natural physical-input timing, or native-vs-Web phase matching. Obtain a visible/focused rerun before using these PNGs for visual comparison.
