import { FloorType } from "./model";

export type ActionFloorEffect =
  | "none"
  | "break"
  | "show"
  | "gallery"
  | "fast-travel"
  | "toggle-smile";

export function actionFloorEffect(type: FloorType | null): ActionFloorEffect {
  switch (type) {
    case FloorType.BreakFloor:
      return "break";
    case FloorType.Show:
      return "show";
    case FloorType.GalleryFloor:
      return "gallery";
    case FloorType.FastTravel:
      return "fast-travel";
    case FloorType.Smile:
      return "toggle-smile";
    default:
      return "none";
  }
}

export interface GalleryImage {
  readonly textureIndex: number;
  readonly descriptionKey: string;
  readonly description: string;
}

export const galleryImages: readonly GalleryImage[] = [
  {
    textureIndex: -1,
    descriptionKey: "Gallery_About",
    description: "Here are a few images from the game's development.",
  },
  {
    textureIndex: 5,
    descriptionKey: "Gallery_Mockup",
    description:
      "The initial sketch of the game idea; it would be a stealth puzzle game where you sneak inside of walls and blocks.",
  },
  {
    textureIndex: 4,
    descriptionKey: "Gallery_MultipleLayers",
    description:
      "A randomly generated test level; at this point, you could transfer between boxes, but not enter or exit them.",
  },
  {
    textureIndex: 11,
    descriptionKey: "Gallery_Ref",
    description:
      "A test level of a box containing itself, which was an idea adapted from the game Sokosoko by juner.",
  },
  {
    textureIndex: 6,
    descriptionKey: "Gallery_NotebookMath",
    description: "Notes on the math for enter and exit animations.",
  },
  {
    textureIndex: 3,
    descriptionKey: "Gallery_Graph",
    description:
      "One of many edge case testing levels, and also a visualization of the structure of boxes.",
  },
  {
    textureIndex: 8,
    descriptionKey: "Gallery_Rotate",
    description:
      "A sketch for recursive boxes rotated by 90 degrees. I decided not to implement them due to programming complexity.",
  },
  {
    textureIndex: 10,
    descriptionKey: "Gallery_Stream",
    description: "A screenshot from a development livestream.",
  },
  {
    textureIndex: 2,
    descriptionKey: "Gallery_Clamp",
    description:
      "A bug where drawing was not correctly clamped when a box entered itself, causing lag.",
  },
  {
    textureIndex: 1,
    descriptionKey: "Gallery_Bug",
    description: "Another amusing visual bug.",
  },
  {
    textureIndex: 9,
    descriptionKey: "Gallery_Editor",
    description: "What a puzzle looks like in the editor.",
  },
  {
    textureIndex: 0,
    descriptionKey: "Gallery_Blocks",
    description: "A generated image of every box in the game!",
  },
  {
    textureIndex: 12,
    descriptionKey: "Gallery_AreaPuzzles",
    description:
      "The puzzles in this area use graphics from early in development.",
  },
];

export const breakMusicOptions = [
  "Area_Intro",
  "Area_Enter",
  "Area_Empty",
  "Area_Eat",
  "Area_Reference",
  "Area_Swap",
  "Area_Center",
  "Area_Clone",
  "Area_Transfer",
  "Area_Open",
  "Area_Flip",
  "Area_Cycle",
  "Area_Player",
  "Area_Possess",
  "Area_Wall",
  "Area_InfiniteExit",
  "Area_InfiniteEnter",
  "Area_MultiInfinite",
  "Area_Appendix",
  "Area_Reception",
  "Menu_Credits",
  "Menu_Paused",
  "Buy soundtrack",
] as const;

export type SpecialModeName = "playing" | "gallery" | "show" | "break";
export type ShowPhase =
  | "file-in"
  | "ocean"
  | "title"
  | "pulse"
  | "pulse-reverse"
  | "shuffle"
  | "file-out";

interface DirectionState {
  readonly dx: number;
  readonly dy: number;
}

export interface SpecialModeSnapshot {
  readonly mode: SpecialModeName;
  readonly transition: number;
  readonly leaving: boolean;
  readonly paused: boolean;
  readonly menu:
    | {
        readonly title: string;
        readonly options: readonly string[];
        readonly selectedIndex: number;
      }
    | null;
  readonly gallery:
    | {
        readonly index: number;
        readonly image: GalleryImage;
      }
    | null;
  readonly show:
    | {
        readonly phase: ShowPhase;
        readonly phaseIndex: number;
        readonly elapsed: number;
        readonly duration: number;
      }
    | null;
  readonly break:
    | {
        readonly x: number;
        readonly y: number;
        readonly xSpeed: number;
        readonly ySpeed: number;
        readonly musicIndex: number;
      }
    | null;
}

const rootMenuOptions = {
  show: ["Resume", "Leave show"] as const,
  break: ["Resume", "Leave break", "Break Music"] as const,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function unityLerp(from: number, to: number, amount: number): number {
  return from + (to - from) * clamp(amount, 0, 1);
}

/**
 * Pure state for the three post-game action-floor modes.
 *
 * Rendering and browser input stay outside this class. The constants and
 * transitions mirror Gallery.cs, Break.cs, and Draw.ShowUpdate.
 */
export class SpecialModes {
  private readonly random: () => number;
  private mode: SpecialModeName = "playing";
  private transition = 0;
  private leaving = false;
  private paused = false;
  private menuKind: "root" | "music" = "root";
  private menuSelection = 0;
  private galleryIndex = 0;
  private galleryT = 0;
  private showPhase: ShowPhase = "file-in";
  private showPhaseIndex = 1;
  private showElapsed = 0;
  private showDuration = 16;
  private lastFileInWasFast = false;
  private breakX = 0;
  private breakY = 0;
  private breakXSpeed = 0;
  private breakYSpeed = 0;
  private breakMusicIndex = breakMusicOptions.indexOf("Area_Reception");
  private openedBreakMusicMenu = false;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  get active(): boolean {
    return this.mode !== "playing";
  }

  get currentMode(): SpecialModeName {
    return this.mode;
  }

  reset(): void {
    this.mode = "playing";
    this.transition = 0;
    this.leaving = false;
    this.paused = false;
    this.menuKind = "root";
    this.menuSelection = 0;
  }

  start(mode: Exclude<SpecialModeName, "playing">): boolean {
    if (this.active) return false;
    this.mode = mode;
    this.transition = 0;
    this.leaving = false;
    this.paused = false;
    this.menuKind = "root";
    this.menuSelection = 0;

    if (mode === "gallery") {
      // Gallery.Start leaves the static image index intact between visits.
    } else if (mode === "show") {
      this.showPhase = "file-in";
      this.showPhaseIndex = 1;
      this.showElapsed = 0;
      this.showDuration = 16;
      this.lastFileInWasFast = false;
    } else {
      this.breakX = 0;
      this.breakY = 0;
      this.breakXSpeed = 0;
      this.breakYSpeed = 0;
      this.breakMusicIndex = breakMusicOptions.indexOf("Area_Reception");
      this.openedBreakMusicMenu = false;
    }
    return true;
  }

  tick(
    elapsedSeconds: number,
    direction: DirectionState = { dx: 0, dy: 0 },
    accelerateShow = false,
  ): void {
    if (!this.active) return;
    const dt = Math.max(0, elapsedSeconds);

    if (this.mode === "gallery") {
      if (this.leaving) {
        this.galleryT -= dt * 0.35;
        if (this.galleryT < 0) this.reset();
      } else {
        this.galleryT = Math.min(1, this.galleryT + dt * 0.35);
      }
      return;
    }

    if (this.leaving) {
      this.transition -= dt * (this.mode === "break" ? 0.33 : 0.35);
      if (this.transition < 0) {
        this.reset();
        return;
      }
    } else if (!this.paused || this.mode === "show") {
      this.transition = Math.min(
        1,
        this.transition + dt * (this.mode === "break" ? 0.33 : 0.35),
      );
    }

    if (this.mode === "show") {
      if (this.transition === 1 || this.leaving) {
        this.advanceShow(
          dt * (accelerateShow && !this.paused ? 4 : 1),
        );
      }
      return;
    }

    const inputEnabled =
      !this.paused && !this.leaving && this.transition >= 0.5;
    this.advanceBreak(
      dt,
      inputEnabled ? clamp(direction.dx, -1, 1) : 0,
      inputEnabled ? clamp(direction.dy, -1, 1) : 0,
    );
  }

  moveVertical(delta: -1 | 1): boolean {
    if (!this.active || this.leaving) return false;
    if (this.paused) {
      const options = this.currentMenuOptions();
      const next = clamp(
        this.menuSelection + delta,
        0,
        options.length - 1,
      );
      if (next === this.menuSelection) return false;
      this.menuSelection = next;
      return true;
    }
    if (this.mode !== "gallery" || this.galleryT < 0.5) return false;
    const next = clamp(
      this.galleryIndex + delta,
      0,
      galleryImages.length - 1,
    );
    if (next === this.galleryIndex) return false;
    this.galleryIndex = next;
    return true;
  }

  requestUndoOrCancel(): boolean {
    if (!this.active || this.leaving) return false;
    if (this.paused) {
      return this.escape();
    }
    if (this.mode === "gallery" || this.transition < 0.5) {
      this.leaving = true;
      return true;
    }
    return false;
  }

  escape(): boolean {
    if (!this.active || this.leaving) return false;
    if (this.paused) {
      if (this.menuKind === "music") {
        this.menuKind = "root";
        this.menuSelection = 2;
      } else {
        this.paused = false;
        this.menuSelection = 0;
      }
      return true;
    }
    if (this.mode === "gallery") {
      this.leaving = true;
      return true;
    }
    if (
      (this.mode === "show" && this.transition < 0.5) ||
      (this.mode === "break" && this.transition !== 1)
    ) {
      return false;
    }
    this.paused = true;
    this.menuKind = "root";
    this.menuSelection = 0;
    return true;
  }

  confirm(): boolean {
    if (!this.paused || this.leaving) return false;
    if (this.menuKind === "music") {
      this.breakMusicIndex = this.menuSelection;
      return true;
    }
    if (this.menuSelection === 0) {
      this.paused = false;
      return true;
    }
    if (this.menuSelection === 1) {
      this.paused = false;
      this.leaving = true;
      return true;
    }
    if (this.mode === "break" && this.menuSelection === 2) {
      this.menuKind = "music";
      if (!this.openedBreakMusicMenu) {
        this.openedBreakMusicMenu = true;
        if (this.breakMusicIndex !== 0) this.breakMusicIndex = 0;
      }
      this.menuSelection = this.breakMusicIndex;
      return true;
    }
    return false;
  }

  snapshot(): SpecialModeSnapshot {
    const image = galleryImages[this.galleryIndex] ?? galleryImages[0]!;
    return {
      mode: this.mode,
      transition: this.mode === "gallery" ? this.galleryT : this.transition,
      leaving: this.leaving,
      paused: this.paused,
      menu: this.paused
        ? {
            title: this.menuKind === "music" ? "Break Music" : "Paused",
            options: this.currentMenuOptions(),
            selectedIndex: this.menuSelection,
          }
        : null,
      gallery:
        this.mode === "gallery"
          ? { index: this.galleryIndex, image }
          : null,
      show:
        this.mode === "show"
          ? {
              phase: this.showPhase,
              phaseIndex: this.showPhaseIndex,
              elapsed: this.showElapsed,
              duration: this.showDuration,
            }
          : null,
      break:
        this.mode === "break"
          ? {
              x: this.breakX,
              y: this.breakY,
              xSpeed: this.breakXSpeed,
              ySpeed: this.breakYSpeed,
              musicIndex: this.breakMusicIndex,
            }
          : null,
    };
  }

  private currentMenuOptions(): readonly string[] {
    if (this.menuKind === "music") return breakMusicOptions;
    return this.mode === "break"
      ? rootMenuOptions.break
      : rootMenuOptions.show;
  }

  private advanceShow(dt: number): void {
    this.showElapsed += dt;
    while (this.showElapsed >= this.showDuration) {
      this.showElapsed -= this.showDuration;
      this.showPhaseIndex = (this.showPhaseIndex + 1) % 7;
      switch (this.showPhaseIndex) {
        case 0: {
          this.showPhase = "file-out";
          const fast = this.random() < 0.5;
          this.lastFileInWasFast = fast;
          this.showDuration = fast ? 6 : 16;
          break;
        }
        case 1: {
          this.showPhase = "file-in";
          const fast = !this.lastFileInWasFast;
          this.lastFileInWasFast = fast;
          this.showDuration = fast ? 6 : 16;
          break;
        }
        case 2:
          this.showPhase = "ocean";
          this.showDuration = 11;
          break;
        case 3:
          this.showPhase = "title";
          this.showDuration = 20;
          break;
        case 4:
          this.showPhase = "pulse";
          this.showDuration = 4.5;
          break;
        case 5:
          this.showPhase = "pulse-reverse";
          this.showDuration = 4.5;
          break;
        case 6:
          this.showPhase = "shuffle";
          this.showDuration = 13;
          break;
      }
    }
  }

  private advanceBreak(dt: number, dx: number, dy: number): void {
    const acceleration = 13;
    const maximumSpeed = 9;
    this.breakXSpeed = clamp(
      this.breakXSpeed + dx * acceleration * dt,
      -maximumSpeed,
      maximumSpeed,
    );
    if (dx === 0) {
      this.breakXSpeed = unityLerp(
        this.breakXSpeed,
        0,
        0.3 * dt,
      );
    }
    this.breakYSpeed = clamp(
      this.breakYSpeed + dy * acceleration * dt,
      -maximumSpeed,
      maximumSpeed,
    );
    if (dy === 0) {
      this.breakYSpeed = unityLerp(
        this.breakYSpeed,
        0,
        0.3 * dt,
      );
    }
    this.breakX += this.breakXSpeed * dt;
    this.breakY += this.breakYSpeed * dt;
  }
}
