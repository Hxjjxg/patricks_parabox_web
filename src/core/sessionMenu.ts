import { localizeEnglish } from "./localization";

export type SessionMenuMode =
  | "none"
  | "title"
  | "paused"
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

export type SessionMenuAction =
  | { readonly type: "none" }
  | { readonly type: "resume" }
  | { readonly type: "leave-puzzle" }
  | { readonly type: "return-title" }
  | { readonly type: "show-credits" }
  | { readonly type: "open-link"; readonly link: SessionLink }
  | { readonly type: "switch-slot"; readonly slot: number }
  | { readonly type: "erase-slot"; readonly slot: number };

export interface SessionSaveSlot {
  readonly label: string;
  readonly empty: boolean;
}

export interface SessionMenuSnapshot {
  readonly mode: SessionMenuMode;
  readonly title: string;
  readonly options: readonly string[];
  readonly selectedIndex: number;
  readonly recurseDepth: number;
  readonly subtitle: string;
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
  "Extras",
  "Save slot",
] as const;
const hubPauseOptions = [
  "Resume",
  "Return to title",
  "Extras",
  "Save slot",
] as const;
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

/**
 * Pure state for the title gate, pause menu, four save slots, and the
 * original's two-stage erase confirmation. Browser input, persistence, and
 * rendering deliberately stay outside.
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

  configureSaveSlots(
    slots: readonly SessionSaveSlot[],
    activeSlot: number,
  ): void {
    this.saveSlots = slots.slice(0, 4);
    this.activeSlot = Math.max(
      0,
      Math.min(this.saveSlots.length - 1, Math.trunc(activeSlot)),
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
    if (
      this.mode !== "tips" ||
      this.selectedIndex !== 0
    ) {
      return false;
    }
    const nextIndex = Math.max(
      0,
      Math.min(tipKeys.length - 1, this.tipIndex + delta),
    );
    this.tipIndex = nextIndex;
    return true;
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
      if (this.selectedIndex === 0) {
        this.reset();
        return { type: "resume" };
      }
      if (this.selectedIndex === 1) {
        const type = this.pauseWasInHub
          ? "return-title"
          : "leave-puzzle";
        this.reset();
        return { type };
      }
      if (this.selectedIndex === 2) {
        this.showExtras();
      } else {
        this.showSaveSlots();
      }
      return noAction;
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
      if (this.selectedIndex === 1) {
        this.showExtras("Tips");
      }
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
      selectedIndex: this.selectedIndex,
      recurseDepth: this.recurseDepth,
      subtitle:
        this.mode === "tips"
          ? localizeEnglish("Tip_TheseAreTipsMenu")
          : "",
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

  private showExtras(selectedOption?: string): void {
    this.mode = "extras";
    this.options = extrasOptions;
    this.selectedIndex = selectedOption
      ? Math.max(0, this.options.findIndex((option) => option === selectedOption))
      : 0;
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

  private titleForMode(): string {
    if (this.mode === "title") return "Patrick's Parabox";
    if (this.mode === "paused") return "Menu";
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
