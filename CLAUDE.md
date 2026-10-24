# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

Web-based 1:1 replication of **Patrick's Parabox** — a recursive puzzle game where boxes contain other boxes. The original game is at `F:\Patricks.Parabox_inject_debug` with BepInEx injected for behavior observation. BepInEx usage guide is in `BepInEx.md`. The dnSpy MCP can decompile `Assembly-CSharp.dll` for reference.

## Commands

```bash
npm run dev          # Start Vite dev server on http://127.0.0.1:4173
npm run build        # TypeScript typecheck + Vite production build
npm run typecheck    # TypeScript typecheck only (no emit)
npm test             # Run all vitest tests (vitest run)
npm run test:watch   # Run vitest in watch mode
```

During development, open `http://127.0.0.1:4173` and pass `?level=<name>` to load a specific level directly.

## Tech Stack

**TypeScript 7.0 + Vite 8 + PixiJS 8.19** — no physics engine, no ECS, no React. Game logic is pure TypeScript; PixiJS handles only rendering.

## Architecture: Two-Layer Separation

```
src/
├── core/          # Pure game logic — NEVER imports from pixi.js or render/
│   ├── model.ts           WorldModel, Level, Block, Floor — the data model
│   ├── movement.ts        MovementEngine + History — movement, undo/redo/restart
│   ├── levelParser.ts     Parses original game's tab-indented .txt level format
│   ├── levelRepository.ts Vite glob imports for all level .txt files
│   ├── progression.ts     Puzzle win tracking, hub portal unlock rules, fast travel
│   ├── progressSlots.ts   4 save slots backed by localStorage
│   ├── inspection.ts      Click-to-zoom into nested boxes (inspection camera)
│   ├── directionalInput.ts Multi-key direction stack with configurable repeat delay
│   ├── specialModes.ts    Post-game "Break", "Show", "Gallery" modes
│   ├── sessionMenu.ts     Pause menu, title screen, save slot selection, erase confirmations
│   └── localization.ts    English localization strings for tips and signs
├── render/        # PixiJS rendering — depends on core/model types
│   ├── GameRenderer.ts    Recursive level rendering, UI overlays, inspection hit-testing
│   └── originalTextures.ts Loads + normalizes wall autotile textures from original game assets
├── GameController.ts      Bridge: wires DOM/keyboard input → core logic → renderer output
├── main.ts                Entry point, creates renderer + controller, exposes `window.__PARABOX__`
└── style.css              Global styles
```

**The boundary is strict:** `core/` files never import from `pixi.js` or `render/`. `GameController.ts` imports from both sides and bridges them. The `MovementEngine` and `History` classes in `movement.ts` together handle all game logic including recursive enter/exit, infinite zones, push/eat/possess attempts, and the full attempt-order cascade.

## Data Model (model.ts)

- **WorldModel** — top-level container: owns all blocks, levels, floors; tracks move count, win state, attempt order, camera flip direction
- **Level** — a 2D grid within a box: holds block and floor arrays, tracks its exit block (the block whose subLevel is this Level), infinite exit/enter blocks
- **Block** — any entity on a grid: has optional subLevel (making it a recursive container), isPlayer/possessable flags, color (HSV), flipH (mirrored), playerOrder
- **Floor** — a tile effect under blocks: Button, PlayerButton, LevelPortal (teleports to another level), Info, FastTravel, Break, Show, Gallery, Smile, DemoEnd

Key detail: `block.subLevel` is the Level *inside* that block. `level.getExitBlock()` returns the block whose `subLevel` IS that level — i.e., the block you see from the outside. This is the fundamental recursive link.

## Movement System (movement.ts)

`MovementEngine.applyDirectionalInput(dx, dy)` processes one cardinal impulse for **every** player block. The engine uses a recursive attempt chain:
1. `attemptToSlide` — move in direction
2. If blocked, cascade through `Attempt` order: Push → Enter → Eat → Possess
3. `attemptToMoveToSpot` recursively resolves collisions, infinite zones, inner-push chains
4. Infinite exit/enter zones are generated on demand (`createInfExitZone`, `createInfEnterZone`)

`History` records turns as `TurnMove[]` + `PlayerSwitch[]`. Undo/redo work by reversing/applying turns — entire turn batches are grouped by move count. Restart records all block positions and replays them backward.

Important edge cases in movement:
- **Inner push**: `innerPushEnabled` flag — a non-player block without subLevel can be pushed, and the push force transfers to the exit block of the enclosing level
- **Shed**: `shedEnabled` flag — a block exiting a level can "shed" its own level's exit block if movement is blocked
- **Infinite zone unwinding**: exit/enter loops self-detect and unwind up to 20 attempts
- **Camera flip**: when a player enters/exits a flipped block, camera flips horizontally

## Recursive Rendering (GameRenderer.ts)

`drawLevel()` renders a Level's grid into a rectangle, then recursively calls itself for every block that has a subLevel. Depth is capped at 7 or when pixel size < 11px (terminal rendering fills with a wall texture). Recursive self-reference is detected and drawn as void rings instead.

Wall textures use a 48-texture autotile set (`wall_main_0..47.png`) keyed by 8-neighbor solidity. The `autotileIndex()` function computes the correct texture index from neighbor bitmask.

`inspectionHitAt(clientX, clientY)` maps screen coordinates back to the grid to determine which nested block was clicked, used by the inspection system.

## Level Format

Original game levels are text files in `src/assets/levels/`. They use a tab-indented hierarchical format:
- `#` — ends header, begins body
- `Block x y levelId w h h s v camZoom filledWalls isPlayer possessable playerOrder flipH detachedInInf specialEffect` — creates a block with a subLevel
- `Wall x y isPlayer possessable playerOrder [unlockerScene]` — creates a solid block
- `Floor x y Type [sceneName|infoText]` — places a floor tile
- `Ref x y targetLevelId isExit isInfExit infExitNum isInfEnter infEnterNum infEnterTargetLevelId ...` — creates a cross-reference block pointing to an existing level

Lines are depth-sorted by tab count. `Block` pushes onto the depth stack; wall/floor children refer to the current block's subLevel. References are resolved in a second pass.

## Progression & Hub

The `hub` level is the central world. `ProgressionModel` tracks won/attempted puzzles, portal unlock rules, and area shortcuts. When loading the hub, `applyToHub()` removes cleared walls, configures fast travel, unlocks portals based on incoming links from `puzzle_data.txt` and `puzzle_lines.txt`, and positions the player at their last location.

Save data persists to `localStorage` under key `parabox-web-save-slots-v1`. Legacy saves from `parabox-web-progress-v1` are auto-migrated.

## Tests

Tests live in `tests/` and use vitest with `vitest/globals`. Test fixtures are in `tests/fixtures/original/` — these are JSON snapshots of original game movement sequences used for conformance testing.

```
npm test              # Run all tests
npx vitest --reporter=verbose   # Detailed output
```

## Key Reference Resources

- **Original game**: `F:\Patricks.Parabox_inject_debug` — use BepInEx to inject observers
- **BepInEx log**: `F:\Patricks.Parabox_inject_debug\BepInEx\LogOutput.log`
- **dnSpy MCP**: Decompile `Assembly-CSharp.dll` for exact game logic reference
- **AssetRipper export**: `F:\AssetRipper_win_x64\parabox` — Unity project reconstruction
- **Game backup**: `F:\BaiduNetdiskDownload\compressed`
- **DO NOT modify**: `F:\SteamLibrary\steamapps\common`

## Known Gaps / Incomplete Work

Based on codebase analysis, the following areas appear incomplete or unverified:

1. **Audio** — No audio system exists. The original has music and sound effects tied to areas and actions.
2. **Alternate draw styles** — `DrawStyle.TuiColor`, `DrawStyle.Grid`, and `DrawStyle.QuickAnim` are parsed but rendering may be partial. The `wallsFlip` texture set is loaded but not used in the current render path.
3. **Gallery visual rendering** — Only text overlay descriptions are shown; actual gallery images are referenced by `textureIndex` but the image textures don't appear to be loaded.
4. **Show mode visuals** — The "Show" special mode has phase tracking (file-in, ocean, title, pulse, etc.) but visual rendering beyond overlay text is likely incomplete.
5. **CSS for `#dev-panel`** — The dev panel (backtick key) is created in JS but its styling depends on `style.css`.
6. **Touch/mobile controls** — No mobile input handling exists beyond pointer events for inspection.
7. **Level completeness** — Not all original levels may be present; compare `src/assets/levels/` against the original game's level list.
