import {
  enterSpeedName,
  enterSpeedNames,
  formatMoveDelay,
  nextEnterSpeedIndex,
  nextMoveDelay,
} from "./settings";
import { localizeEnglish } from "./localization";

export type SessionMenuMode =
  | "none"
  | "title"
  | "paused"
  | "settings"
  | "movement"
  | "display"
  | "controls"
  | "keyboard-controls"
  | "gamepad-controls"
  | "bonus"
  | "language"
  | "extras"
  | "tips"
  | "links"
  | "custom-levels"
  | "save-slots"
  | "erase-choose"
  | "erase-confirm"
  | "erase-confirm-final";

export type SessionLink =
  | "game-website"
  | "dev-website"
  | "dev-mailing-list"
  | "composer-website"
  | "buy-soundtrack"
  | "itch-forum"
  | "steam-forum"
  | "custom-levels";

export interface SessionMenuSettings {
  readonly musicVolume: number;
  readonly soundVolume: number;
  readonly grid: boolean;
  readonly leftHanded: boolean;
  readonly enterSpeedIndex: number;
  readonly moveDelay: number;
  readonly allowSkippingAnimation: boolean;
  readonly instantZoom: boolean;
  readonly disableParticles: boolean;
  readonly fullscreen: boolean;
  readonly vsync: boolean;
  readonly language: string;
}

export interface SessionMenuBonusSettings {
  readonly randomOrientation: boolean;
  readonly randomMusic: boolean;
  readonly unlockAllPuzzles: boolean;
}

export type SessionMenuAction =
  | { readonly type: "none" }
  | { readonly type: "resume" }
  | { readonly type: "leave-puzzle" }
  | { readonly type: "return-title" }
  | { readonly type: "show-credits" }
  | { readonly type: "open-link"; readonly link: SessionLink }
  | { readonly type: "switch-slot"; readonly slot: number }
  | { readonly type: "erase-slot"; readonly slot: number }
  | { readonly type: "settings-changed"; readonly settings: SessionMenuSettings }
  | { readonly type: "bonus-changed"; readonly settings: SessionMenuBonusSettings };

export interface SessionSaveSlot {
  readonly label: string;
  readonly empty: boolean;
}

export interface SessionMenuSnapshot {
  readonly mode: SessionMenuMode;
  readonly title: string;
  readonly options: readonly string[];
  /** Values shown to the right of each option, mirroring the original menu. */
  readonly values: readonly (string | null)[];
  readonly selectedIndex: number;
  readonly recurseDepth: number;
  readonly subtitle: string;
  readonly settings: SessionMenuSettings;
  readonly bonus: SessionMenuBonusSettings;
  readonly tip: {
    readonly index: number;
    readonly total: number;
    readonly text: string;
    readonly canMoveLeft: boolean;
    readonly canMoveRight: boolean;
  } | null;
}

const noAction = { type: "none" } as const;
const puzzlePauseOptions = [
  "Resume",
  "Leave puzzle",
  "Settings",
  "Extras",
  "Save slot",
] as const;
const hubPauseOptions = [
  "Resume",
  "Return to title",
  "Settings",
  "Extras",
  "Save slot",
] as const;
const settingsOptions = [
  "Music Volume",
  "Sound Volume",
  "Grid",
  "Movement",
  "Left-handed",
  "Display",
  "Controls",
  "Bonus",
  "Language",
  "Unlock all puzzles",
  "Back",
] as const;
const movementOptions = [
  "Enter Speed",
  "Allow skipping animation",
  "Move Delay",
  "Instant zoom",
  "Back",
] as const;
const displayOptions = [
  "Resolution",
  "Fullscreen",
  "Vsync",
  "Disable particles",
  "Back",
] as const;
const controlsOptions = [
  "Keyboard controls",
  "Gamepad controls",
  "Back",
] as const;
const controlBindingOptions = [
  "Up",
  "Down",
  "Left",
  "Right",
  "Undo",
  "Redo",
  "Restart",
  "Zoom In",
  "Reset controls",
  "Back",
] as const;
const bonusOptions = ["Random orientation", "Random music", "Back"] as const;
const languageOptions = ["Default", "English", "Back"] as const;
const extrasOptions = [
  "Custom levels",
  "Tips",
  "Credits",
  "Links",
  "Recurse",
  "Back",
] as const;
const tipsOptions = ["Tip", "Back"] as const;
const linksOptions = [
  "Game website",
  "Dev website",
  "Dev mailing list",
  "Composer website",
  "Buy soundtrack",
  "itch.io forum",
  "Steam forum",
  "Back",
] as const;
const customLevelsOptions = ["Custom levels website", "Back"] as const;
const linkByIndex: readonly SessionLink[] = [
  "game-website",
  "dev-website",
  "dev-mailing-list",
  "composer-website",
  "buy-soundtrack",
  "itch-forum",
  "steam-forum",
];
export const sessionLinkUrls: Readonly<Record<SessionLink, string>> = {
  "game-website": "https://www.patricksparabox.com",
  "dev-website": "https://cwpat.me/about",
  "dev-mailing-list":
    "https://www.patricksparabox.com#mc_embed_signup_scroll",
  "composer-website": "https://www.ghoulnoise.com/",
  "buy-soundtrack":
    "https://ghoulnoise.bandcamp.com/album/patricks-parabox-original-soundtrack",
  "itch-forum": "https://patricktraynor.itch.io/patricks-parabox/community",
  "steam-forum": "https://steamcommunity.com/app/1260520/discussions/",
  "custom-levels": "https://www.patricksparabox.com/custom-levels",
};
const tipKeys = [
  "Tip_Undo",
  "Tip_WorkBackwards",
  "Tip_NarrowOptions",
  "Tip_TryAnotherPuzzle",
  "Tip_Challenging",
] as const;
const confirmationOptions = ["No", "Yes"] as const;

type MutableSettings = {
  -readonly [Key in keyof SessionMenuSettings]: SessionMenuSettings[Key];
};

type MutableBonus = {
  -readonly [Key in keyof SessionMenuBonusSettings]: SessionMenuBonusSettings[Key];
};

const defaultMenuSettings: MutableSettings = {
  musicVolume: 85,
  soundVolume: 85,
  grid: false,
  leftHanded: false,
  enterSpeedIndex: 0,
  moveDelay: 70,
  allowSkippingAnimation: false,
  instantZoom: false,
  disableParticles: false,
  fullscreen: true,
  vsync: true,
  language: "Default",
};

const defaultBonus: MutableBonus = {
  randomOrientation: false,
  randomMusic: false,
  unlockAllPuzzles: false,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

function copySettings(settings: SessionMenuSettings): MutableSettings {
  return {
    ...defaultMenuSettings,
    ...settings,
    musicVolume: clamp(settings.musicVolume, 0, 100),
    soundVolume: clamp(settings.soundVolume, 0, 100),
    enterSpeedIndex: clamp(settings.enterSpeedIndex, 0, enterSpeedNames.length - 1),
    moveDelay: clamp(settings.moveDelay, 0, 501),
  };
}

function copyBonus(settings: SessionMenuBonusSettings): MutableBonus {
  return {
    ...defaultBonus,
    ...settings,
  };
}

/**
 * Pure state for the title gate, pause/settings menus, four save slots, and
 * the original's two-stage erase confirmation. Persistence and side effects
 * stay in GameController; this class only emits declarative actions.
 */
export class SessionMenu {
  private mode: SessionMenuMode = "none";
  private options: readonly string[] = [];
  private selectedIndex = 0;
  private pauseWasInHub = false;
  private saveSlots: readonly SessionSaveSlot[] = [];
  private activeSlot = 0;
  private eraseCandidate: number | null = null;
  private tipIndex = 0;
  private recurseDepth = 0;
  private settings: MutableSettings = { ...defaultMenuSettings };
  private bonus: MutableBonus = { ...defaultBonus };

  get active(): boolean {
    return this.mode !== "none";
  }

  get currentMode(): SessionMenuMode {
    return this.mode;
  }

  reset(): void {
    this.mode = "none";
    this.options = [];
    this.selectedIndex = 0;
    this.pauseWasInHub = false;
    this.eraseCandidate = null;
    this.tipIndex = 0;
    this.recurseDepth = 0;
  }

  configureSettings(
    settings: SessionMenuSettings,
    bonus: SessionMenuBonusSettings = defaultBonus,
  ): void {
    this.settings = copySettings(settings);
    this.bonus = copyBonus(bonus);
  }

  settingsState(): SessionMenuSettings {
    return { ...this.settings };
  }

  bonusState(): SessionMenuBonusSettings {
    return { ...this.bonus };
  }

  configureSaveSlots(
    slots: readonly SessionSaveSlot[],
    activeSlot: number,
  ): void {
    this.saveSlots = slots.slice(0, 4);
    this.activeSlot = Math.max(
      0,
      Math.min(Math.max(0, this.saveSlots.length - 1), Math.trunc(activeSlot)),
    );
    if (this.mode === "save-slots") this.showSaveSlots();
    if (this.mode === "erase-choose") this.showEraseChoice();
  }

  showTitle(): void {
    this.mode = "title";
    this.options = [];
    this.selectedIndex = 0;
    this.pauseWasInHub = true;
    this.eraseCandidate = null;
    this.recurseDepth = 0;
  }

  dismissTitle(): boolean {
    if (this.mode !== "title") return false;
    this.reset();
    return true;
  }

  openPause(inHub: boolean): boolean {
    if (this.active) return false;
    this.pauseWasInHub = inHub;
    this.showPause();
    return true;
  }

  openSaveSlots(): boolean {
    if (this.mode !== "paused") return false;
    this.showSaveSlots();
    return true;
  }

  openSettings(): boolean {
    if (this.mode !== "paused") return false;
    this.showSettings();
    return true;
  }

  moveSelection(delta: -1 | 1): boolean {
    if (
      this.mode === "none" ||
      this.mode === "title" ||
      this.options.length === 0
    ) {
      return false;
    }
    this.selectedIndex =
      (this.selectedIndex + delta + this.options.length) %
      this.options.length;
    return true;
  }

  moveHorizontal(delta: -1 | 1): boolean {
    if (this.mode === "tips" && this.selectedIndex === 0) {
      const nextIndex = Math.max(
        0,
        Math.min(tipKeys.length - 1, this.tipIndex + delta),
      );
      this.tipIndex = nextIndex;
      return true;
    }

    const option = this.options[this.selectedIndex];
    if (!option) return false;
    if (this.mode === "settings") {
      if (option === "Music Volume") {
        this.settings.musicVolume = clamp(
          this.settings.musicVolume + delta * 5,
          0,
          100,
        );
        return true;
      }
      if (option === "Sound Volume") {
        this.settings.soundVolume = clamp(
          this.settings.soundVolume + delta * 5,
          0,
          100,
        );
        return true;
      }
    }
    if (this.mode === "movement") {
      if (option === "Enter Speed") {
        this.settings.enterSpeedIndex = nextEnterSpeedIndex(
          this.settings.enterSpeedIndex,
          delta,
        );
        return true;
      }
      if (option === "Move Delay") {
        this.settings.moveDelay = nextMoveDelay(
          this.settings.moveDelay,
          delta,
        );
        return true;
      }
    }
    return false;
  }

  cancel(): boolean {
    if (this.mode === "paused") {
      if (this.recurseDepth > 0) {
        this.recurseDepth--;
        this.showExtras("Recurse");
        return true;
      }
      this.reset();
      return true;
    }
    if (this.mode === "settings") {
      this.showPause("Settings");
      return true;
    }
    if (this.mode === "movement") {
      this.showSettings("Movement");
      return true;
    }
    if (this.mode === "display") {
      this.showSettings("Display");
      return true;
    }
    if (this.mode === "controls") {
      this.showSettings("Controls");
      return true;
    }
    if (this.mode === "keyboard-controls" || this.mode === "gamepad-controls") {
      this.showControls();
      return true;
    }
    if (this.mode === "bonus") {
      this.showSettings("Bonus");
      return true;
    }
    if (this.mode === "language") {
      this.showSettings("Language");
      return true;
    }
    if (this.mode === "extras") {
      this.showPause("Extras");
      return true;
    }
    if (this.mode === "tips") {
      this.showExtras("Tips");
      return true;
    }
    if (this.mode === "links") {
      this.showExtras("Links");
      return true;
    }
    if (this.mode === "custom-levels") {
      this.showExtras("Custom levels");
      return true;
    }
    if (this.mode === "save-slots") {
      this.showPause("Save slot");
      return true;
    }
    if (
      this.mode === "erase-choose" ||
      this.mode === "erase-confirm" ||
      this.mode === "erase-confirm-final"
    ) {
      this.showSaveSlots();
      return true;
    }
    return false;
  }

  confirm(): SessionMenuAction {
    if (this.mode === "title") {
      this.reset();
      return { type: "resume" };
    }

    if (this.mode === "paused") {
      if (
        this.recurseDepth > 0 &&
        this.options[this.selectedIndex] === "Back"
      ) {
        this.recurseDepth--;
        this.showExtras("Recurse");
        return noAction;
      }
      const option = this.options[this.selectedIndex];
      if (option === "Resume") {
        this.reset();
        return { type: "resume" };
      }
      if (option === "Leave puzzle" || option === "Return to title") {
        const type = this.pauseWasInHub
          ? "return-title"
          : "leave-puzzle";
        this.reset();
        return { type };
      }
      if (option === "Settings") {
        this.showSettings();
      } else if (option === "Extras") {
        this.showExtras();
      } else if (option === "Save slot") {
        this.showSaveSlots();
      }
      return noAction;
    }

    if (this.mode === "settings") {
      const option = this.options[this.selectedIndex];
      if (option === "Back") {
        this.showPause("Settings");
        return noAction;
      }
      if (option === "Movement") {
        this.showMovement();
        return noAction;
      }
      if (option === "Display") {
        this.showDisplay();
        return noAction;
      }
      if (option === "Controls") {
        this.showControls();
        return noAction;
      }
      if (option === "Bonus") {
        this.showBonus();
        return noAction;
      }
      if (option === "Language") {
        this.showLanguage();
        return noAction;
      }
      if (option === "Grid") {
        this.settings.grid = !this.settings.grid;
        return this.settingsAction();
      }
      if (option === "Left-handed") {
        this.settings.leftHanded = !this.settings.leftHanded;
        return this.settingsAction();
      }
      if (option === "Unlock all puzzles") {
        this.bonus.unlockAllPuzzles = !this.bonus.unlockAllPuzzles;
        return this.bonusAction();
      }
      return noAction;
    }

    if (this.mode === "movement") {
      const option = this.options[this.selectedIndex];
      if (option === "Back") {
        this.showSettings("Movement");
        return noAction;
      }
      if (option === "Allow skipping animation") {
        this.settings.allowSkippingAnimation = !this.settings.allowSkippingAnimation;
        return this.settingsAction();
      }
      if (option === "Instant zoom") {
        this.settings.instantZoom = !this.settings.instantZoom;
        return this.settingsAction();
      }
      return noAction;
    }

    if (this.mode === "display") {
      const option = this.options[this.selectedIndex];
      if (option === "Back") {
        this.showSettings("Display");
        return noAction;
      }
      if (option === "Fullscreen") {
        this.settings.fullscreen = !this.settings.fullscreen;
        return this.settingsAction();
      }
      if (option === "Vsync") {
        this.settings.vsync = !this.settings.vsync;
        return this.settingsAction();
      }
      if (option === "Disable particles") {
        this.settings.disableParticles = !this.settings.disableParticles;
        return this.settingsAction();
      }
      return noAction;
    }

    if (this.mode === "controls") {
      const option = this.options[this.selectedIndex];
      if (option === "Keyboard controls") {
        this.showKeyboardControls();
      } else if (option === "Gamepad controls") {
        this.showGamepadControls();
      } else {
        this.showSettings("Controls");
      }
      return noAction;
    }

    if (this.mode === "keyboard-controls" || this.mode === "gamepad-controls") {
      if (this.options[this.selectedIndex] === "Back") this.showControls();
      return noAction;
    }

    if (this.mode === "bonus") {
      const option = this.options[this.selectedIndex];
      if (option === "Back") {
        this.showSettings("Bonus");
      } else if (option === "Random orientation") {
        this.bonus.randomOrientation = !this.bonus.randomOrientation;
        return this.bonusAction();
      } else if (option === "Random music") {
        this.bonus.randomMusic = !this.bonus.randomMusic;
        return this.bonusAction();
      }
      return noAction;
    }

    if (this.mode === "language") {
      const option = this.options[this.selectedIndex];
      if (!option || option === "Back") {
        this.showSettings("Language");
        return noAction;
      }
      const language = option === "English" ? "EN" : option;
      this.settings.language = language;
      this.showSettings("Language");
      return this.settingsAction();
    }

    if (this.mode === "extras") {
      if (this.selectedIndex === 0) {
        this.showCustomLevels();
        return noAction;
      }
      if (this.selectedIndex === 1) {
        this.showTips();
        return noAction;
      }
      if (this.selectedIndex === 2) {
        return { type: "show-credits" };
      }
      if (this.selectedIndex === 3) {
        this.showLinks();
        return noAction;
      }
      if (this.selectedIndex === 4) {
        this.recurseDepth++;
        this.showPause();
        return noAction;
      }
      this.showPause("Extras");
      return noAction;
    }

    if (this.mode === "tips") {
      if (this.selectedIndex === 1) this.showExtras("Tips");
      return noAction;
    }

    if (this.mode === "links") {
      const link = linkByIndex[this.selectedIndex];
      if (link) return { type: "open-link", link };
      this.showExtras("Links");
      return noAction;
    }

    if (this.mode === "custom-levels") {
      if (this.selectedIndex === 0) {
        return { type: "open-link", link: "custom-levels" };
      }
      this.showExtras("Custom levels");
      return noAction;
    }

    if (this.mode === "save-slots") {
      if (this.selectedIndex < this.saveSlots.length) {
        const slot = this.selectedIndex;
        if (slot === this.activeSlot) {
          this.showPause("Save slot");
          return noAction;
        }
        this.reset();
        return { type: "switch-slot", slot };
      }
      if (this.selectedIndex === this.saveSlots.length) {
        this.showEraseChoice();
        return noAction;
      }
      this.showPause("Save slot");
      return noAction;
    }

    if (this.mode === "erase-choose") {
      if (this.selectedIndex >= this.saveSlots.length) {
        this.showSaveSlots();
        return noAction;
      }
      if (this.saveSlots[this.selectedIndex]?.empty) return noAction;
      this.eraseCandidate = this.selectedIndex;
      this.showEraseConfirmation(false);
      return noAction;
    }

    if (this.mode === "erase-confirm") {
      if (this.selectedIndex === 0) {
        this.showSaveSlots();
      } else {
        this.showEraseConfirmation(true);
      }
      return noAction;
    }

    if (this.mode === "erase-confirm-final") {
      if (this.selectedIndex === 0) {
        this.showSaveSlots();
        return noAction;
      }
      const slot = this.eraseCandidate;
      this.showSaveSlots();
      return slot === null ? noAction : { type: "erase-slot", slot };
    }

    return noAction;
  }

  snapshot(): SessionMenuSnapshot {
    return {
      mode: this.mode,
      title: this.titleForMode(),
      options: this.options,
      values: this.options.map((option) => this.valueForOption(option)),
      selectedIndex: this.selectedIndex,
      recurseDepth: this.recurseDepth,
      subtitle:
        this.mode === "tips"
          ? localizeEnglish("Tip_TheseAreTipsMenu")
          : "",
      settings: { ...this.settings },
      bonus: { ...this.bonus },
      tip:
        this.mode === "tips"
          ? {
              index: this.tipIndex,
              total: tipKeys.length,
              text: localizeEnglish(
                tipKeys[this.tipIndex] ?? tipKeys[0],
              ),
              canMoveLeft: this.tipIndex > 0,
              canMoveRight: this.tipIndex < tipKeys.length - 1,
            }
          : null,
    };
  }

  private settingsAction(): SessionMenuAction {
    return { type: "settings-changed", settings: this.settingsState() };
  }

  private bonusAction(): SessionMenuAction {
    return { type: "bonus-changed", settings: this.bonusState() };
  }

  private showPause(selectedOption?: string): void {
    this.mode = "paused";
    const baseOptions = this.pauseWasInHub
      ? hubPauseOptions
      : puzzlePauseOptions;
    this.options =
      this.recurseDepth > 0
        ? [...baseOptions, "Back"]
        : baseOptions;
    this.selectedIndex = selectedOption
      ? Math.max(0, this.options.findIndex((option) => option === selectedOption))
      : 0;
    this.eraseCandidate = null;
  }

  private showSettings(selectedOption?: string): void {
    this.mode = "settings";
    this.options = settingsOptions;
    this.selectedIndex = this.indexForOption(selectedOption);
    this.eraseCandidate = null;
  }

  private showMovement(): void {
    this.mode = "movement";
    this.options = movementOptions;
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showDisplay(): void {
    this.mode = "display";
    this.options = displayOptions;
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showControls(): void {
    this.mode = "controls";
    this.options = controlsOptions;
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showKeyboardControls(): void {
    this.mode = "keyboard-controls";
    this.options = controlBindingOptions;
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showGamepadControls(): void {
    this.mode = "gamepad-controls";
    this.options = controlBindingOptions;
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showBonus(): void {
    this.mode = "bonus";
    this.options = bonusOptions;
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showLanguage(): void {
    this.mode = "language";
    this.options = languageOptions;
    const selectedLanguage = this.settings.language === "EN" ? "English" : "Default";
    this.selectedIndex = this.options.indexOf(selectedLanguage);
    if (this.selectedIndex < 0) this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showExtras(selectedOption?: string): void {
    this.mode = "extras";
    this.options = extrasOptions;
    this.selectedIndex = this.indexForOption(selectedOption);
    this.eraseCandidate = null;
  }

  private showTips(): void {
    this.mode = "tips";
    this.options = tipsOptions;
    this.selectedIndex = 0;
    this.tipIndex = 0;
    this.eraseCandidate = null;
  }

  private showLinks(): void {
    this.mode = "links";
    this.options = linksOptions;
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showCustomLevels(): void {
    this.mode = "custom-levels";
    this.options = customLevelsOptions;
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showSaveSlots(): void {
    this.mode = "save-slots";
    this.options = [
      ...this.saveSlots.map((slot) => slot.label),
      "Delete a save file",
      "Back",
    ];
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showEraseChoice(): void {
    this.mode = "erase-choose";
    this.options = [
      ...this.saveSlots.map((slot) => slot.label),
      "Back",
    ];
    this.selectedIndex = 0;
    this.eraseCandidate = null;
  }

  private showEraseConfirmation(final: boolean): void {
    this.mode = final ? "erase-confirm-final" : "erase-confirm";
    this.options = confirmationOptions;
    this.selectedIndex = 0;
  }

  private indexForOption(option: string | undefined): number {
    if (!option) return 0;
    const index = this.options.indexOf(option);
    return index < 0 ? 0 : index;
  }

  private valueForOption(option: string): string | null {
    switch (option) {
      case "Music Volume":
        return `${this.settings.musicVolume}%`;
      case "Sound Volume":
        return `${this.settings.soundVolume}%`;
      case "Grid":
        return this.settings.grid ? "On" : "Off";
      case "Left-handed":
        return this.settings.leftHanded ? "On" : "Off";
      case "Enter Speed":
        return enterSpeedName(this.settings.enterSpeedIndex);
      case "Move Delay":
        return formatMoveDelay(this.settings.moveDelay);
      case "Allow skipping animation":
        return this.settings.allowSkippingAnimation ? "On" : "Off";
      case "Instant zoom":
        return this.settings.instantZoom ? "On" : "Off";
      case "Resolution":
        return "Auto";
      case "Fullscreen":
        return this.settings.fullscreen ? "On" : "Off";
      case "Vsync":
        return this.settings.vsync ? "On" : "Off";
      case "Disable particles":
        return this.settings.disableParticles ? "Off" : "On";
      case "Random orientation":
        return this.bonus.randomOrientation ? "On" : "Off";
      case "Random music":
        return this.bonus.randomMusic ? "On" : "Off";
      case "Unlock all puzzles":
        return this.bonus.unlockAllPuzzles ? "On" : "Off";
      case "Language":
        return this.settings.language === "EN" ? "English" : "Default";
      default:
        return null;
    }
  }

  private titleForMode(): string {
    if (this.mode === "title") return "Patrick's Parabox";
    if (this.mode === "paused") return "Menu";
    if (this.mode === "settings") return "Settings";
    if (this.mode === "movement") return "Movement";
    if (this.mode === "display") return "Display";
    if (this.mode === "controls") return "Controls";
    if (this.mode === "keyboard-controls") return "Keyboard controls";
    if (this.mode === "gamepad-controls") return "Gamepad controls";
    if (this.mode === "bonus") return "Bonus";
    if (this.mode === "language") return "Language";
    if (this.mode === "extras") return "Extras";
    if (this.mode === "tips") return "Tips";
    if (this.mode === "links") return "Links";
    if (this.mode === "custom-levels") return "Custom levels";
    if (this.mode === "save-slots") return "Save files";
    if (this.mode === "erase-choose") return "Delete a save file";
    if (this.mode === "erase-confirm") return "Delete this file?";
    if (this.mode === "erase-confirm-final") return "Are you sure?";
    return "";
  }
}
