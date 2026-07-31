import { getLevelSource, levelNames } from "./core/levelRepository";
import { parseLevel } from "./core/levelParser";
import {
  DirectionalInput,
  type DirectionCommand,
} from "./core/directionalInput";
import { TouchSwipeInput } from "./core/touchInput";
import { MovementEngine, type ImpulseResult } from "./core/movement";
import {
  DrawStyle,
  FloorType,
  type Floor,
  type Level,
  type WorldModel,
} from "./core/model";
import { escapeActionForFloor, isDemoEndFloor } from "./core/demoEnd";
import {
  InspectionModel,
  type InspectionSnapshot,
} from "./core/inspection";
import {
  ProgressionModel,
  puzzleMetadata,
} from "./core/progression";
import {
  formatPlaytime,
  ProgressSlotStore,
  type ProgressSlotSummary,
} from "./core/progressSlots";
import {
  SessionMenu,
  sessionLinkUrls,
  type SessionMenuAction,
  type SessionMenuSnapshot,
} from "./core/sessionMenu";
import {
  actionFloorEffect,
  SpecialModes,
  type SpecialModeName,
} from "./core/specialModes";
import type { GameRenderer } from "./render/GameRenderer";

const officialPuzzleNames = new Set(puzzleMetadata.keys());
const touchDirectionKey = "__touch__";

export type RuntimeMode =
  | SpecialModeName
  | "fast-travel"
  | "credits"
  | "paused"
  | "title";

export interface DebugApi {
  getState(): {
    levelName: string;
    moveCount: number;
    winning: boolean;
    mode: RuntimeMode;
    cameraFlipH: boolean;
    playtimeSeconds: number;
    infoText: string | null;
    demoEnd: {
      active: boolean;
      progress: number;
    };
    inspection: InspectionSnapshot;
    activeSaveSlot: number;
    saveSlots: ProgressSlotSummary[];
    session: SessionMenuSnapshot;
    player: {
      id: number;
      x: number;
      y: number;
      outerLevel: number;
    };
    playerBlocks: Array<{
      id: number;
      order: number;
      x: number;
      y: number;
      outerLevel: number;
    }>;
  };
  impulse(dx: number, dy: number): ImpulseResult;
  loadLevel(name: string): void;
  reload(): void;
  restart(): boolean;
  undo(): boolean;
  redo(): boolean;
  readonly levelNames: string[];
}

interface FastTravelSession {
  readonly originFloor: Floor;
  readonly originLevel: Level;
  readonly originX: number;
  readonly originY: number;
  selectedIndex: number;
}

export class GameController {
  private readonly renderer: GameRenderer;
  private readonly progressSlots: ProgressSlotStore;
  private progression: ProgressionModel;
  private world!: WorldModel;
  private movement!: MovementEngine;
  private inspection!: InspectionModel;
  private currentLevelName = "first_puzzle";
  private readonly devPanel: HTMLElement;
  private readonly stateOutput: HTMLElement;
  private readonly levelSelect: HTMLSelectElement;
  private winTransitionTimer: number | null = null;
  private fastTravelSession: FastTravelSession | null = null;
  private creditsActive = false;
  private creditsFromPause = false;
  private readonly specialModes = new SpecialModes();
  private readonly sessionMenu = new SessionMenu();
  private readonly directionalInput = new DirectionalInput(70);
  private readonly touchInput = new TouchSwipeInput();
  private readonly heldKeys = new Set<string>();
  private previousFrameTime: number | null = null;
  private playtimeSinceSave = 0;
  private smileActive = false;

  constructor(renderer: GameRenderer) {
    this.renderer = renderer;
    this.progressSlots = new ProgressSlotStore(window.localStorage);
    this.progression = new ProgressionModel(
      this.progressSlots.activeSnapshot() ?? undefined,
    );
    this.devPanel = this.createDevPanel();
    this.stateOutput = this.devPanel.querySelector("[data-state]") as HTMLElement;
    this.levelSelect = this.devPanel.querySelector("select") as HTMLSelectElement;
  }

  start(): void {
    const queryLevel = new URLSearchParams(window.location.search).get("level");
    const explicitLevel =
      queryLevel && levelNames.includes(queryLevel) ? queryLevel : null;
    this.loadLevel(explicitLevel ?? "hub");
    if (!explicitLevel) {
      this.sessionMenu.showTitle();
      this.updateStateOutput();
      this.syncRendererUi();
    }
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: false });
    window.addEventListener("pagehide", this.onPageHide);
    this.renderer.canvas.addEventListener(
      "pointerdown",
      this.onPointerDown,
      { passive: false },
    );
    this.renderer.canvas.addEventListener(
      "pointermove",
      this.onPointerMove,
      { passive: false },
    );
    this.renderer.canvas.addEventListener(
      "pointerup",
      this.onPointerUp,
      { passive: false },
    );
    this.renderer.canvas.addEventListener(
      "pointercancel",
      this.onPointerCancel,
      { passive: false },
    );
    this.renderer.canvas.addEventListener("wheel", this.onWheel, {
      passive: false,
    });
    this.renderer.canvas.addEventListener(
      "contextmenu",
      this.onContextMenu,
    );
    window.requestAnimationFrame(this.onAnimationFrame);
  }

  getDebugApi(): DebugApi {
    return {
      levelNames,
      getState: () => {
        const player = this.world.findPlayerBlock();
        const playerFloor =
          player.outerLevel?.getFloor(player.x, player.y) ?? null;
        return {
          levelName: this.currentLevelName,
          moveCount: this.world.moveCount,
          winning: this.world.winning,
          mode: this.runtimeMode(),
          cameraFlipH: this.world.cameraFlipH,
          playtimeSeconds: this.progression.playtimeSeconds,
          infoText:
            playerFloor?.type === FloorType.Info
              ? playerFloor.info
              : null,
          demoEnd: {
            active: isDemoEndFloor(playerFloor),
            progress: isDemoEndFloor(playerFloor)
              ? playerFloor?.animationT ?? 0
              : 0,
          },
          inspection: this.inspection.snapshot(),
          activeSaveSlot: this.progressSlots.activeSlot,
          saveSlots: this.progressSlots.summaries(officialPuzzleNames),
          session: this.sessionMenu.snapshot(),
          player: {
            id: player.id,
            x: player.x,
            y: player.y,
            outerLevel: player.outerLevel?.id ?? -1,
          },
          playerBlocks: this.world.playerBlocks.map((block) => ({
            id: block.id,
            order: block.playerOrder,
            x: block.x,
            y: block.y,
            outerLevel: block.outerLevel?.id ?? -1,
          })),
        };
      },
      impulse: (dx, dy) => this.impulse(dx, dy),
      loadLevel: (name) => this.loadLevel(name),
      reload: () => this.loadLevel(this.currentLevelName),
      restart: () => this.restart(),
      undo: () => this.undo(),
      redo: () => this.redo(),
    };
  }

  loadLevel(name: string): void {
    this.sessionMenu.reset();
    this.directionalInput.reset();
    this.touchInput.reset();
    this.fastTravelSession = null;
    this.creditsActive = false;
    this.creditsFromPause = false;
    this.specialModes.reset();
    this.heldKeys.clear();
    if (this.winTransitionTimer !== null) {
      window.clearTimeout(this.winTransitionTimer);
      this.winTransitionTimer = null;
    }
    const source = getLevelSource(name);
    this.currentLevelName = name;
    this.world = parseLevel(source, name);
    this.world.smile = this.smileActive;
    if (name === "hub") {
      this.progression.applyToHub(this.world);
    } else {
      this.progression.markAttempted(name);
    }
    this.persistProgression();
    this.movement = new MovementEngine(this.world);
    this.inspection = new InspectionModel(this.world);
    this.renderer.setInspection(null, false);
    this.renderer.setWorld(this.world);
    this.levelSelect.value = name;
    this.updateStateOutput();
    this.syncHubCompletion();
    this.syncRendererUi();
  }

  private impulse(dx: number, dy: number): ImpulseResult {
    if (this.runtimeMode() !== "playing") {
      return {
        moved: false,
        won: false,
        possessed: false,
        turn: null,
        transition: null,
      };
    }
    this.resetInspection();
    const worldDx = this.world.inputFlipH() ? -dx : dx;
    const result = this.movement.applyDirectionalInput(worldDx, dy);
    if (result.transition) {
      this.progression.enterPortal(
        result.transition.floor,
        result.transition.fromX,
        result.transition.fromY,
      );
      this.persistProgression();
      this.loadLevel(result.transition.floor.sceneName);
      return result;
    }
    this.renderer.setWorld(this.world);
    this.updateStateOutput();
    if (result.moved) {
      this.recordCurrentHubArea();
      this.handleActionFloor();
    }
    this.syncHubCompletion();
    this.syncWinTransition();
    this.syncRendererUi();
    return result;
  }

  private undo(): boolean {
    if (this.runtimeMode() !== "playing") return false;
    const inspectionChanged = this.resetInspection();
    const changed = this.movement.undo();
    if (changed || inspectionChanged) {
      this.renderer.setWorld(this.world);
      this.updateStateOutput();
      this.recordCurrentHubArea();
      this.handleActionFloor();
      this.syncHubCompletion();
      this.syncWinTransition();
      this.syncRendererUi();
    }
    return changed;
  }

  private redo(): boolean {
    if (this.runtimeMode() !== "playing") return false;
    const inspectionChanged = this.resetInspection();
    const changed = this.movement.redo();
    if (changed || inspectionChanged) {
      this.renderer.setWorld(this.world);
      this.updateStateOutput();
      this.recordCurrentHubArea();
      this.handleActionFloor();
      this.syncHubCompletion();
      this.syncWinTransition();
      this.syncRendererUi();
    }
    return changed;
  }

  private restart(): boolean {
    if (this.runtimeMode() !== "playing") return false;
    const inspectionChanged = this.resetInspection();
    const changed = this.movement.restart();
    if (changed || inspectionChanged) {
      this.renderer.setWorld(this.world);
      this.updateStateOutput();
      this.recordCurrentHubArea();
      this.syncHubCompletion();
      this.syncWinTransition();
      this.syncRendererUi();
    }
    return changed;
  }

  private syncWinTransition(): void {
    if (this.currentLevelName !== "hub" && this.world.winning) {
      this.scheduleWinTransition();
      return;
    }
    if (this.winTransitionTimer !== null) {
      window.clearTimeout(this.winTransitionTimer);
      this.winTransitionTimer = null;
    }
  }

  private startFastTravel(): boolean {
    if (
      this.currentLevelName !== "hub" ||
      this.fastTravelSession ||
      this.creditsActive ||
      this.specialModes.active
    ) {
      return false;
    }
    const player = this.world.findPlayerBlock();
    const level = player.outerLevel;
    const floor = level?.getFloor(player.x, player.y) ?? null;
    if (!level || floor?.type !== FloorType.FastTravel) return false;
    const selectedIndex = this.world.fastTravelFloors.indexOf(floor);
    if (selectedIndex < 0) return false;

    this.fastTravelSession = {
      originFloor: floor,
      originLevel: level,
      originX: player.x,
      originY: player.y,
      selectedIndex,
    };
    this.directionalInput.reset();
    this.updateStateOutput();
    this.syncRendererUi();
    return true;
  }

  private moveFastTravelSelection(delta: -1 | 1): boolean {
    const session = this.fastTravelSession;
    if (!session || this.world.fastTravelFloors.length === 0) return false;

    let nextIndex = session.selectedIndex + delta;
    if (nextIndex < 0 || nextIndex >= this.world.fastTravelFloors.length) {
      if (!this.progression.nexusUnlocked) return false;
      nextIndex =
        (nextIndex + this.world.fastTravelFloors.length) %
        this.world.fastTravelFloors.length;
    }
    const destination = this.world.fastTravelFloors[nextIndex];
    if (!destination) return false;
    const player = this.world.findPlayerBlock();
    this.movement.relocateWithoutHistory(
      player,
      destination.outerLevel,
      destination.x,
      destination.y,
    );
    session.selectedIndex = nextIndex;
    this.recordCurrentHubArea();
    this.renderer.setWorld(this.world);
    this.updateStateOutput();
    this.syncRendererUi();
    return true;
  }

  private confirmFastTravel(): void {
    const session = this.fastTravelSession;
    if (!session) return;
    const player = this.world.findPlayerBlock();
    this.fastTravelSession = null;
    this.movement.commitRelocation(
      player,
      session.originLevel,
      session.originX,
      session.originY,
    );
    this.renderer.setWorld(this.world);
    this.updateStateOutput();
    this.syncRendererUi();
  }

  private cancelFastTravel(): void {
    if (!this.fastTravelSession) return;
    this.fastTravelSession = null;
    this.movement.undo();
    this.recordCurrentHubArea();
    this.renderer.setWorld(this.world);
    this.updateStateOutput();
    this.syncRendererUi();
  }

  private handleActionFloor(): boolean {
    if (this.currentLevelName !== "hub") return false;
    const player = this.world.findPlayerBlock();
    const floor =
      player.outerLevel?.getFloor(player.x, player.y) ?? null;
    const effect = actionFloorEffect(floor?.type ?? null);

    if (effect === "fast-travel") return this.startFastTravel();
    if (effect === "toggle-smile") {
      this.smileActive = !this.smileActive;
      this.world.smile = this.smileActive;
      this.renderer.setWorld(this.world);
      this.updateStateOutput();
      this.syncRendererUi();
      return false;
    }
    if (
      effect === "break" ||
      effect === "show" ||
      effect === "gallery"
    ) {
      const started = this.specialModes.start(effect);
      if (started) {
        this.directionalInput.reset();
        this.heldKeys.clear();
        this.updateStateOutput();
        this.syncRendererUi();
      }
      return started;
    }
    return false;
  }

  private recordCurrentHubArea(): void {
    if (this.currentLevelName !== "hub") return;
    const areaName =
      this.world.findPlayerBlock().outerLevel?.hubAreaName ?? "";
    if (this.progression.setRecentArea(areaName)) {
      this.persistProgression();
    }
  }

  private syncHubCompletion(): void {
    if (
      this.currentLevelName !== "hub" ||
      this.creditsActive ||
      this.specialModes.active ||
      !this.world.buttonsSatisfied ||
      !this.world.finishesSatisfied
    ) {
      return;
    }
    this.fastTravelSession = null;
    this.creditsFromPause = false;
    this.creditsActive = true;
    this.progression.unlockNexus();
    this.persistProgression();
    this.updateStateOutput();
    this.syncRendererUi();
  }

  private exitCredits(): void {
    if (!this.creditsActive) return;
    if (this.creditsFromPause) {
      this.creditsActive = false;
      this.creditsFromPause = false;
      this.heldKeys.clear();
      this.directionalInput.reset();
      this.updateStateOutput();
      this.syncRendererUi();
      return;
    }
    const player = this.world.findPlayerBlock();
    const areaName = player.outerLevel?.hubAreaName ?? "";
    this.progression.setHubReturnPosition(
      areaName,
      player.x,
      player.y - 1,
    );
    this.persistProgression();
    this.creditsActive = false;
    this.loadLevel("hub");
  }

  private runtimeMode(): RuntimeMode {
    if (this.creditsActive) return "credits";
    if (this.fastTravelSession) return "fast-travel";
    if (this.sessionMenu.currentMode === "title") return "title";
    if (this.sessionMenu.active) return "paused";
    return this.specialModes.currentMode;
  }

  private applySessionMenuAction(action: SessionMenuAction): void {
    if (action.type === "none") return;
    if (action.type === "show-credits") {
      this.creditsFromPause = true;
      this.creditsActive = true;
    } else if (action.type === "open-link") {
      window.open(
        sessionLinkUrls[action.link],
        "_blank",
        "noopener,noreferrer",
      );
    } else if (action.type === "leave-puzzle") {
      this.loadLevel("hub");
    } else if (action.type === "return-title") {
      this.progression.clearRecentPuzzle();
      this.loadLevel("hub");
      this.sessionMenu.showTitle();
    } else if (action.type === "switch-slot") {
      this.persistProgression();
      const snapshot = this.progressSlots.switchSlot(action.slot);
      this.progression = new ProgressionModel(snapshot ?? undefined);
      this.smileActive = false;
      this.loadLevel("hub");
      this.sessionMenu.showTitle();
    } else if (action.type === "erase-slot") {
      const erasedActiveSlot =
        action.slot === this.progressSlots.activeSlot;
      this.progressSlots.eraseSlot(action.slot);
      if (erasedActiveSlot) {
        this.progression = new ProgressionModel();
        this.smileActive = false;
        this.loadLevel("hub");
        this.refreshSessionSaveSlots();
        this.sessionMenu.openPause(true);
        this.sessionMenu.openSaveSlots();
      } else {
        this.refreshSessionSaveSlots();
      }
    }
    this.heldKeys.clear();
    this.directionalInput.reset();
    this.updateStateOutput();
    this.syncRendererUi();
  }

  private scheduleWinTransition(): void {
    if (this.winTransitionTimer !== null) return;
    const wonLevelName = this.currentLevelName;
    this.winTransitionTimer = window.setTimeout(() => {
      this.winTransitionTimer = null;
      if (
        this.currentLevelName !== wonLevelName ||
        !this.world.winning
      ) {
        return;
      }
      const newlyWon = this.progression.markWon(wonLevelName);
      const nextLevel = this.progression.nextLevelAfterWin(
        wonLevelName,
        newlyWon,
      );
      this.persistProgression();
      this.loadLevel(nextLevel);
    }, 1500);
  }

  private persistProgression(): void {
    this.progressSlots.saveActive(this.progression.serialize());
    this.playtimeSinceSave = 0;
  }

  private refreshSessionSaveSlots(): void {
    const slots = this.progressSlots
      .summaries(officialPuzzleNames)
      .map((summary) => {
        let progress: string;
        if (summary.empty) {
          progress = "Empty";
        } else if (summary.allWon) {
          progress = `${summary.wonCount} solved, ${formatPlaytime(summary.playtimeSeconds)}, 100%`;
        } else if (summary.nexusUnlocked) {
          progress = `${summary.wonCount} solved, ${formatPlaytime(summary.playtimeSeconds)}, end`;
        } else {
          progress = `${summary.wonCount} solved, ${formatPlaytime(summary.playtimeSeconds)}`;
        }
        const current =
          summary.slot === this.progressSlots.activeSlot
            ? "  (current)"
            : "";
        return {
          label: `#${summary.slot + 1}: ${progress}${current}`,
          empty: summary.empty,
        };
      });
    this.sessionMenu.configureSaveSlots(
      slots,
      this.progressSlots.activeSlot,
    );
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if (this.creditsActive) {
      if (
        key === "enter" ||
        key === " " ||
        key === "escape" ||
        key === "backspace"
      ) {
        event.preventDefault();
        this.exitCredits();
      }
      return;
    }
    if (this.fastTravelSession) {
      if (key === "arrowup" || key === "w") {
        event.preventDefault();
        this.moveFastTravelSelection(-1);
      } else if (key === "arrowdown" || key === "s") {
        event.preventDefault();
        this.moveFastTravelSelection(1);
      } else if (
        key === "arrowright" ||
        key === "d" ||
        key === "enter" ||
        key === " "
      ) {
        event.preventDefault();
        this.confirmFastTravel();
      } else if (
        key === "escape" ||
        key === "backspace" ||
        key === "z"
      ) {
        event.preventDefault();
        this.cancelFastTravel();
      }
      return;
    }
    if (this.specialModes.active) {
      this.handleSpecialModeKeyDown(event, key);
      return;
    }
    if (this.sessionMenu.active) {
      let handled = false;
      if (
        this.sessionMenu.currentMode === "title" &&
        (key === "enter" || key === " ")
      ) {
        this.applySessionMenuAction(this.sessionMenu.confirm());
        handled = true;
      } else if (this.sessionMenu.currentMode !== "title") {
        if (key === "arrowup" || key === "w") {
          handled = this.sessionMenu.moveSelection(-1);
        } else if (key === "arrowdown" || key === "s") {
          handled = this.sessionMenu.moveSelection(1);
        } else if (key === "arrowleft" || key === "a") {
          handled = this.sessionMenu.moveHorizontal(-1);
        } else if (key === "arrowright" || key === "d") {
          handled = this.sessionMenu.moveHorizontal(1);
        } else if (key === "enter" || key === " ") {
          this.applySessionMenuAction(this.sessionMenu.confirm());
          handled = true;
        } else if (
          key === "escape" ||
          key === "backspace" ||
          key === "z"
        ) {
          handled = this.sessionMenu.cancel();
        }
      }
      if (handled) {
        event.preventDefault();
        this.updateStateOutput();
        this.syncRendererUi();
      }
      return;
    }

    if ((key === "enter" || key === " ") && this.startFastTravel()) {
      event.preventDefault();
      return;
    }

    const directions: Record<string, readonly [number, number]> = {
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
      arrowup: [0, 1],
      w: [0, 1],
      arrowdown: [0, -1],
      s: [0, -1],
    };
    const direction = directions[key];
    if (direction) {
      event.preventDefault();
      if (!event.repeat) {
        const command = this.directionalInput.press(key, {
          dx: direction[0] as -1 | 0 | 1,
          dy: direction[1] as -1 | 0 | 1,
        });
        this.applyDirectionCommand(command);
      }
      return;
    }
    if (key === "z" || (event.ctrlKey && key === "z")) {
      event.preventDefault();
      this.undo();
    } else if (key === "x" || (event.ctrlKey && key === "y")) {
      event.preventDefault();
      this.redo();
    } else if (key === "r") {
      event.preventDefault();
      this.restart();
    } else if (key === "escape") {
      event.preventDefault();
      const player = this.world.findPlayerBlock();
      const playerFloor =
        player.outerLevel?.getFloor(player.x, player.y) ?? null;
      if (escapeActionForFloor(playerFloor) === "undo") {
        this.undo();
        return;
      }
      this.resetInspection();
      this.refreshSessionSaveSlots();
      if (this.sessionMenu.openPause(this.currentLevelName === "hub")) {
        this.directionalInput.reset();
        this.heldKeys.clear();
        this.updateStateOutput();
        this.syncRendererUi();
      }
    } else if (key === "`") {
      event.preventDefault();
      this.devPanel.classList.toggle("is-open");
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    this.heldKeys.delete(key);
    if (this.runtimeMode() === "playing") {
      this.applyDirectionCommand(this.directionalInput.release(key));
    } else {
      this.directionalInput.release(key);
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      if (this.runtimeMode() !== "playing") return;
      const started = this.touchInput.start(
        event.pointerId,
        event.clientX,
        event.clientY,
      );
      if (started) {
        this.renderer.canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
      return;
    }
    if (!this.inspectionEnabled()) return;
    let changed = false;
    if (event.button === 2) {
      changed = this.inspection.pop();
    } else if (event.button === 0) {
      const hit = this.renderer.inspectionHitAt(
        event.clientX,
        event.clientY,
      );
      if (hit.block) {
        changed = this.inspection.push(hit.block);
      } else if (!hit.inside) {
        changed = this.inspection.pop();
      }
    }
    if (!changed) return;
    event.preventDefault();
    this.syncInspection();
    this.updateStateOutput();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || !this.touchInput.active) return;
    const command = this.touchInput.move(
      event.pointerId,
      event.clientX,
      event.clientY,
      this.renderer.canvas.clientWidth || window.innerWidth,
      this.renderer.canvas.clientHeight || window.innerHeight,
    );
    event.preventDefault();
    if (!command) return;
    this.directionalInput.release(touchDirectionKey);
    this.applyDirectionCommand(
      this.directionalInput.press(touchDirectionKey, command),
    );
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    const result = this.touchInput.end(event.pointerId);
    if (!result.accepted) return;
    if (this.renderer.canvas.hasPointerCapture?.(event.pointerId)) {
      this.renderer.canvas.releasePointerCapture(event.pointerId);
    }
    this.applyDirectionCommand(
      this.directionalInput.release(touchDirectionKey),
    );
    event.preventDefault();
    if (result.moved || !this.inspectionEnabled()) return;

    const hit = this.renderer.inspectionHitAt(
      event.clientX,
      event.clientY,
    );
    let changed = false;
    if (hit.block) {
      changed = this.inspection.push(hit.block);
    } else if (!hit.inside) {
      changed = this.inspection.pop();
    }
    if (!changed) return;
    this.syncInspection();
    this.updateStateOutput();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    if (!this.touchInput.cancel(event.pointerId)) return;
    if (this.renderer.canvas.hasPointerCapture?.(event.pointerId)) {
      this.renderer.canvas.releasePointerCapture(event.pointerId);
    }
    this.applyDirectionCommand(
      this.directionalInput.release(touchDirectionKey),
    );
    event.preventDefault();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.inspectionEnabled() || event.deltaY === 0) return;
    let changed = false;
    if (event.deltaY < 0) {
      const hit = this.renderer.inspectionHitAt(
        event.clientX,
        event.clientY,
      );
      if (hit.block) changed = this.inspection.push(hit.block);
    } else {
      changed = this.inspection.pop();
    }
    if (!changed) return;
    event.preventDefault();
    this.syncInspection();
    this.updateStateOutput();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.inspectionEnabled()) event.preventDefault();
  };

  private readonly onPageHide = (): void => {
    this.persistProgression();
  };

  private readonly onAnimationFrame = (timestamp: number): void => {
    const elapsed =
      this.previousFrameTime === null
        ? 0
        : Math.max(0, (timestamp - this.previousFrameTime) / 1000);
    this.previousFrameTime = timestamp;
    this.advancePlaytime(Math.min(elapsed, 1 / 3));

    if (this.runtimeMode() === "playing") {
      this.applyDirectionCommand(this.directionalInput.tick(elapsed));
    }

    this.world.updateFloorAnimations(
      elapsed,
      this.runtimeMode() !== "playing",
    );

    if (this.specialModes.active) {
      const modeBefore = this.specialModes.currentMode;
      const left =
        this.heldKeys.has("arrowleft") || this.heldKeys.has("a");
      const right =
        this.heldKeys.has("arrowright") || this.heldKeys.has("d");
      const up =
        this.heldKeys.has("arrowup") || this.heldKeys.has("w");
      const down =
        this.heldKeys.has("arrowdown") || this.heldKeys.has("s");
      this.specialModes.tick(
        elapsed,
        {
          dx: right ? 1 : left ? -1 : 0,
          dy: down ? 1 : up ? -1 : 0,
        },
        this.heldKeys.has("x"),
      );
      if (modeBefore !== this.specialModes.currentMode) {
        this.heldKeys.clear();
        this.updateStateOutput();
      }
      this.syncRendererUi();
    }

    window.requestAnimationFrame(this.onAnimationFrame);
  };

  private advancePlaytime(elapsed: number): void {
    if (
      elapsed <= 0 ||
      document.visibilityState !== "visible" ||
      !document.hasFocus()
    ) {
      return;
    }
    this.progression.addPlaytime(elapsed);
    this.playtimeSinceSave += elapsed;
    if (this.playtimeSinceSave >= 15) {
      this.persistProgression();
    }
  }

  private inspectionEnabled(): boolean {
    return (
      this.currentLevelName !== "hub" &&
      this.currentLevelName !== "static_focus_block" &&
      this.world.drawStyle === DrawStyle.Normal &&
      this.runtimeMode() === "playing" &&
      !this.world.winning
    );
  }

  private resetInspection(): boolean {
    const changed = this.inspection.reset();
    if (changed) this.syncInspection();
    return changed;
  }

  private syncInspection(): void {
    this.renderer.setInspection(
      this.inspection.currentBlock,
      this.inspection.flipH,
    );
  }

  private applyDirectionCommand(
    command: DirectionCommand | null,
  ): void {
    if (!command || this.runtimeMode() !== "playing") return;
    this.impulse(command.dx, command.dy);
  }

  private handleSpecialModeKeyDown(
    event: KeyboardEvent,
    key: string,
  ): void {
    const snapshot = this.specialModes.snapshot();
    let handled = false;

    if (snapshot.paused) {
      if (key === "arrowup" || key === "w") {
        handled = this.specialModes.moveVertical(-1);
      } else if (key === "arrowdown" || key === "s") {
        handled = this.specialModes.moveVertical(1);
      } else if (key === "enter" || key === " ") {
        handled = this.specialModes.confirm();
      } else if (
        key === "escape" ||
        key === "backspace" ||
        key === "z"
      ) {
        handled = this.specialModes.escape();
      }
    } else if (snapshot.mode === "gallery") {
      if (key === "arrowup" || key === "w") {
        handled = this.specialModes.moveVertical(-1);
      } else if (key === "arrowdown" || key === "s") {
        handled = this.specialModes.moveVertical(1);
      } else if (key === "escape") {
        handled = this.specialModes.escape();
      } else if (key === "backspace" || key === "z") {
        handled = this.specialModes.requestUndoOrCancel();
      }
    } else {
      if (
        key === "arrowleft" ||
        key === "arrowright" ||
        key === "arrowup" ||
        key === "arrowdown" ||
        key === "a" ||
        key === "d" ||
        key === "w" ||
        key === "s" ||
        key === "x"
      ) {
        this.heldKeys.add(key);
        handled = true;
      } else if (key === "escape") {
        handled = this.specialModes.escape();
      } else if (key === "backspace" || key === "z") {
        handled = this.specialModes.requestUndoOrCancel();
      }
    }

    if (handled) {
      event.preventDefault();
      this.updateStateOutput();
      this.syncRendererUi();
    }
  }

  private syncRendererUi(): void {
    const fastTravel = this.fastTravelSession
      ? {
          selectedIndex: this.fastTravelSession.selectedIndex,
          total: this.world.fastTravelFloors.length,
          areaName:
            this.world.fastTravelFloors[
              this.fastTravelSession.selectedIndex
            ]?.outerLevel.hubAreaName ?? "",
        }
      : null;
    this.renderer.setUiState({
      mode: this.runtimeMode(),
      special: this.specialModes.snapshot(),
      fastTravel,
      session: this.sessionMenu.snapshot(),
    });
  }

  private createDevPanel(): HTMLElement {
    const panel = document.createElement("aside");
    panel.id = "dev-panel";
    panel.setAttribute("aria-label", "Development level controls");

    const label = document.createElement("label");
    label.textContent = "Level";
    const select = document.createElement("select");
    for (const name of levelNames) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
    select.addEventListener("change", () => this.loadLevel(select.value));
    label.appendChild(select);

    const state = document.createElement("output");
    state.dataset.state = "";
    panel.append(label, state);
    document.body.appendChild(panel);
    return panel;
  }

  private updateStateOutput(): void {
    const player = this.world.findPlayerBlock();
    this.stateOutput.textContent = [
      this.currentLevelName,
      `moves ${this.world.moveCount}`,
      `player ${player.x},${player.y} @ L${player.outerLevel?.id ?? "-"}`,
      `player blocks ${this.world.playerBlocks.length}`,
      this.world.drawStyle !== DrawStyle.Normal
        ? `draw style ${this.world.drawStyle}`
        : "",
      this.world.cameraFlipH ? "camera flip h" : "",
      this.inspection.currentBlock
        ? `inspect block ${this.inspection.currentBlock.id}`
        : "",
      this.inspection.flipH ? "inspect flip h" : "",
      this.world.winning ? "solved" : "playing",
      this.fastTravelSession
        ? `fast travel ${this.fastTravelSession.selectedIndex + 1}/${this.world.fastTravelFloors.length}`
        : this.creditsActive
          ? "credits"
          : this.specialModes.active
            ? this.specialModes.currentMode
            : this.sessionMenu.active
              ? this.sessionMenu.currentMode
            : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
}
