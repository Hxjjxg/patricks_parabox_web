import { describe, expect, it } from "vitest";
import { SessionMenu } from "../src/core/sessionMenu";

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
      "Extras",
      "Save slot",
    ]);
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
    menu.moveSelection(1);
    menu.moveSelection(1);
    expect(menu.confirm()).toEqual({ type: "none" });
    expect(menu.snapshot()).toMatchObject({
      mode: "extras",
      title: "Extras",
      options: ["Tips", "Credits", "Back"],
      selectedIndex: 0,
    });

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
      selectedIndex: 0,
    });
    expect(menu.cancel()).toBe(true);
    expect(menu.snapshot()).toMatchObject({
      mode: "paused",
      selectedIndex: 2,
    });
  });

  it("opens pause credits without discarding the Extras menu state", () => {
    const menu = new SessionMenu();
    menu.openPause(true);
    menu.moveSelection(1);
    menu.moveSelection(1);
    menu.confirm();
    menu.moveSelection(1);

    expect(menu.confirm()).toEqual({ type: "show-credits" });
    expect(menu.snapshot()).toMatchObject({
      mode: "extras",
      selectedIndex: 1,
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
