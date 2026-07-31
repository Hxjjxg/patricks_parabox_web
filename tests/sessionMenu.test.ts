import { describe, expect, it } from "vitest";
import {
  sessionLinkUrls,
  SessionMenu,
} from "../src/core/sessionMenu";

const slots = [
  { label: "Slot 1 — 2/364", empty: false },
  { label: "Slot 2 — Empty", empty: true },
  { label: "Slot 3 — 20/364", empty: false },
  { label: "Slot 4 — Empty", empty: true },
] as const;

function openSaveMenu(menu: SessionMenu, inHub = false): void {
  menu.configureSaveSlots(slots, 0);
  if (menu.currentMode === "none") menu.openPause(inHub);
  while (
    menu.snapshot().options[menu.snapshot().selectedIndex] !== "Save slot"
  ) {
    menu.moveSelection(1);
  }
  expect(menu.confirm()).toEqual({ type: "none" });
  expect(menu.currentMode).toBe("save-slots");
}

function selectOption(menu: SessionMenu, option: string): void {
  let guard = 0;
  while (
    menu.snapshot().options[menu.snapshot().selectedIndex] !== option
  ) {
    menu.moveSelection(1);
    guard++;
    if (guard > 32) throw new Error(`Could not select ${option}`);
  }
}

describe("title, pause, and save-file flow", () => {
  it("gates startup behind the title until the player confirms", () => {
    const menu = new SessionMenu();
    menu.showTitle();

    expect(menu.snapshot()).toMatchObject({
      mode: "title",
      title: "Patrick's Parabox",
      options: [],
    });
    expect(menu.confirm()).toEqual({ type: "resume" });
    expect(menu.currentMode).toBe("none");
  });

  it("resumes or leaves a puzzle from its pause menu", () => {
    const menu = new SessionMenu();
    expect(menu.openPause(false)).toBe(true);
    expect(menu.snapshot().options).toEqual([
      "Resume",
      "Leave puzzle",
      "Settings",
      "Extras",
      "Save slot",
    ]);
    expect(menu.moveSelection(1)).toBe(true);
    expect(menu.confirm()).toEqual({ type: "leave-puzzle" });
    expect(menu.currentMode).toBe("none");
  });

  it("returns from the Hub to the title and wraps selection", () => {
    const menu = new SessionMenu();
    menu.openPause(true);
    expect(menu.snapshot().options).toEqual([
      "Resume",
      "Return to title",
      "Settings",
      "Extras",
      "Save slot",
    ]);
    menu.moveSelection(-1);
    expect(menu.snapshot().selectedIndex).toBe(4);
    menu.moveSelection(-1);
    expect(menu.snapshot().selectedIndex).toBe(3);
    menu.moveSelection(-1);
    expect(menu.snapshot().selectedIndex).toBe(2);
    menu.moveSelection(-1);
    expect(menu.snapshot().selectedIndex).toBe(1);
    expect(menu.confirm()).toEqual({ type: "return-title" });
  });

  it("opens the original Extras -> Tips flow and clamps tip navigation", () => {
    const menu = new SessionMenu();
    menu.openPause(false);
    selectOption(menu, "Extras");
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "extras",
      title: "Extras",
      options: [
        "Custom levels",
        "Tips",
        "Credits",
        "Links",
        "Recurse",
        "Back",
      ],
      selectedIndex: 0,
    });

    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "tips",
      title: "Tips",
      options: ["Tip", "Back"],
      selectedIndex: 0,
      subtitle:
        "These are some general\npuzzle-solving tips that I\nfind useful.",
      tip: {
        index: 0,
        total: 5,
        canMoveLeft: false,
        canMoveRight: true,
      },
    });
    expect(menu.snapshot().tip?.text).toContain("Undo, Redo, and Reset");

    expect(menu.moveHorizontal(-1)).toBe(true);
    expect(menu.snapshot().tip?.index).toBe(0);
    expect(menu.moveHorizontal(1)).toBe(true);
    expect(menu.snapshot().tip?.index).toBe(1);
    expect(menu.snapshot().tip?.text).toContain("work backwards");
    for (let index = 0; index < 10; index++) menu.moveHorizontal(1);
    expect(menu.snapshot().tip).toMatchObject({
      index: 4,
      canMoveLeft: true,
      canMoveRight: false,
    });

    menu.moveSelection(1);
    expect(menu.moveHorizontal(-1)).toBe(false);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "extras",
      selectedIndex: 1,
    });
    expect(menu.cancel()).toBe(true);
    expect(menu.snapshot()).toMatchObject({
      mode: "paused",
      selectedIndex: 3,
    });
  });

  it("opens pause credits without discarding the Extras menu state", () => {
    const menu = new SessionMenu();
    menu.openPause(true);
    selectOption(menu, "Extras");
    menu.confirm();
    selectOption(menu, "Credits");

    expect(menu.confirm()).toEqual({ type: "show-credits" });
    expect(menu.snapshot()).toMatchObject({
      mode: "extras",
      selectedIndex: 2,
    });
  });

  it("matches the original Links branch and keeps the menu open after opening a URL", () => {
    const menu = new SessionMenu();
    menu.openPause(false);
    selectOption(menu, "Extras");
    menu.confirm();
    selectOption(menu, "Links");
    expect(menu.confirm()).toEqual({ type: "none" });

    expect(menu.snapshot()).toMatchObject({
      mode: "links",
      options: [
        "Game website",
        "Dev website",
        "Dev mailing list",
        "Composer website",
        "Buy soundtrack",
        "itch.io forum",
        "Steam forum",
        "Back",
      ],
    });
    expect(menu.confirm()).toEqual({
      type: "open-link",
      link: "game-website",
    });
    expect(sessionLinkUrls["game-website"]).toBe(
      "https://www.patricksparabox.com",
    );

    for (let index = 0; index < 7; index++) menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "extras",
      selectedIndex: 3,
    });
  });

  it("offers import and the instructions webpage for an empty custom-level directory", () => {
    const menu = new SessionMenu();
    menu.openPause(false);
    selectOption(menu, "Extras");
    menu.confirm();

    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "custom-levels",
      options: ["Import level", "Instructions webpage", "Back"],
      subtitle: expect.stringContaining("No custom levels found"),
    });
    expect(menu.confirm()).toEqual({ type: "import-custom-level" });
    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({
      type: "open-link",
      link: "custom-levels",
    });
  });

  it("lists imported custom levels and emits their stable ids", () => {
    const menu = new SessionMenu();
    menu.configureCustomLevels([
      { id: "custom-a", label: "A level" },
      { id: "custom-b", label: "B level" },
    ]);
    menu.openPause(true);
    selectOption(menu, "Extras");
    menu.confirm();
    selectOption(menu, "Custom levels");
    menu.confirm();

    expect(menu.snapshot()).toMatchObject({
      mode: "custom-levels",
      options: ["Import level", "A level", "B level", "Back"],
      subtitle: "/",
    });
    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({
      type: "load-custom-level",
      id: "custom-a",
    });
    menu.configureCustomLevels(
      [
        { id: "custom-a", label: "A level" },
        { id: "custom-b", label: "B level" },
      ],
      "custom-b",
    );
    expect(menu.snapshot().selectedIndex).toBe(2);
    expect(menu.confirm()).toEqual({
      type: "load-custom-level",
      id: "custom-b",
    });
  });

  it("adds a recursive pause layer and returns to Extras on Back or Escape", () => {
    const menu = new SessionMenu();
    menu.openPause(false);
    selectOption(menu, "Extras");
    menu.confirm();
    selectOption(menu, "Recurse");

    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "paused",
      recurseDepth: 1,
      options: [
        "Resume",
        "Leave puzzle",
        "Settings",
        "Extras",
        "Save slot",
        "Back",
      ],
    });

    selectOption(menu, "Back");
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "extras",
      selectedIndex: 4,
      recurseDepth: 0,
    });

    expect(menu.cancel()).toBe(true);
    expect(menu.cancel()).toBe(true);
    expect(menu.snapshot().mode).toBe("none");
  });

  it("matches the original Settings hierarchy and exposes live values", () => {
    const menu = new SessionMenu();
    menu.configureSettings(
      {
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
      },
      {
        randomOrientation: false,
        randomMusic: false,
        unlockAllPuzzles: false,
      },
    );
    menu.openPause(false);
    selectOption(menu, "Settings");
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "settings",
      options: [
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
      ],
    });
    expect(menu.snapshot().values.slice(0, 3)).toEqual([
      "85%",
      "85%",
      "Off",
    ]);

    expect(menu.moveHorizontal(-1)).toBe(true);
    expect(menu.snapshot().settings.musicVolume).toBe(80);
    selectOption(menu, "Grid");
    expect(menu.confirm()).toMatchObject({
      type: "settings-changed",
      settings: { musicVolume: 80, grid: true },
    });
    expect(menu.snapshot().values[2]).toBe("On");

    selectOption(menu, "Movement");
    menu.confirm();
    expect(menu.snapshot()).toMatchObject({
      mode: "movement",
      values: ["1x", "Off", "70 ms", "Off", null],
    });
    expect(menu.moveHorizontal(-1)).toBe(true);
    expect(menu.snapshot().values[0]).toBe("0.66x");
    selectOption(menu, "Move Delay");
    expect(menu.moveHorizontal(1)).toBe(true);
    expect(menu.snapshot().values[2]).toBe("80 ms");
    expect(menu.cancel()).toBe(true);
    expect(menu.snapshot()).toMatchObject({
      mode: "settings",
      selectedIndex: 3,
    });
  });

  it("keeps bonus flags slot-scoped and returns from nested settings menus", () => {
    const menu = new SessionMenu();
    menu.openPause(true);
    selectOption(menu, "Settings");
    menu.confirm();
    selectOption(menu, "Unlock all puzzles");
    expect(menu.confirm()).toMatchObject({
      type: "bonus-changed",
      settings: { unlockAllPuzzles: true },
    });

    selectOption(menu, "Bonus");
    menu.confirm();
    expect(menu.snapshot()).toMatchObject({
      mode: "bonus",
      options: ["Random orientation", "Random music", "Back"],
      values: ["Off", "Off", null],
    });
    expect(menu.confirm()).toMatchObject({
      type: "bonus-changed",
      settings: {
        unlockAllPuzzles: true,
        randomOrientation: true,
      },
    });
    expect(menu.cancel()).toBe(true);
    selectOption(menu, "Language");
    menu.confirm();
    selectOption(menu, "English");
    expect(menu.confirm()).toMatchObject({
      type: "settings-changed",
      settings: { language: "EN" },
    });
    expect(menu.snapshot()).toMatchObject({
      mode: "settings",
      selectedIndex: 8,
    });
  });

  it("switches to a different slot but returns to pause for the active slot", () => {
    const menu = new SessionMenu();
    openSaveMenu(menu);

    expect(menu.snapshot().options).toEqual([
      ...slots.map((slot) => slot.label),
      "Delete a save file",
      "Back",
    ]);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.currentMode).toBe("paused");

    openSaveMenu(menu);
    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "switch-slot", slot: 1 });
    expect(menu.currentMode).toBe("none");
  });

  it("requires two confirmations before erasing a non-empty slot", () => {
    const menu = new SessionMenu();
    openSaveMenu(menu);
    for (let index = 0; index < 4; index++) menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.currentMode).toBe("erase-choose");

    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.currentMode).toBe("erase-choose");

    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.currentMode).toBe("erase-confirm");

    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.currentMode).toBe("erase-confirm-final");

    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "erase-slot", slot: 2 });
    expect(menu.currentMode).toBe("save-slots");
  });

  it("backs out one menu layer at a time", () => {
    const menu = new SessionMenu();
    expect(menu.cancel()).toBe(false);
    openSaveMenu(menu);

    expect(menu.cancel()).toBe(true);
    expect(menu.currentMode).toBe("paused");
    expect(menu.cancel()).toBe(true);
    expect(menu.currentMode).toBe("none");
  });
});
