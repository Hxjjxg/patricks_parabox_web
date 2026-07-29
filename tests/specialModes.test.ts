import { describe, expect, it } from "vitest";
import { FloorType } from "../src/core/model";
import {
  actionFloorEffect,
  breakMusicOptions,
  galleryImages,
  SpecialModes,
} from "../src/core/specialModes";

describe("post-game action floors", () => {
  it("maps the original floor types to local single-player mode changes", () => {
    expect(actionFloorEffect(FloorType.BreakFloor)).toBe("break");
    expect(actionFloorEffect(FloorType.Show)).toBe("show");
    expect(actionFloorEffect(FloorType.GalleryFloor)).toBe("gallery");
    expect(actionFloorEffect(FloorType.FastTravel)).toBe("fast-travel");
    expect(actionFloorEffect(FloorType.Smile)).toBe("toggle-smile");
    expect(actionFloorEffect(FloorType.Info)).toBe("none");
  });

  it("keeps the original 13-image gallery order and bounded navigation", () => {
    const modes = new SpecialModes();
    expect(galleryImages.map((image) => image.textureIndex)).toEqual([
      -1, 5, 4, 11, 6, 3, 8, 10, 2, 1, 9, 0, 12,
    ]);

    expect(modes.start("gallery")).toBe(true);
    modes.tick(2);
    expect(modes.moveVertical(-1)).toBe(false);
    for (let index = 1; index < galleryImages.length; index++) {
      expect(modes.moveVertical(1)).toBe(true);
    }
    expect(modes.moveVertical(1)).toBe(false);
    expect(modes.snapshot().gallery?.index).toBe(12);

    expect(modes.escape()).toBe(true);
    modes.tick(3);
    expect(modes.currentMode).toBe("playing");

    expect(modes.start("gallery")).toBe(true);
    expect(modes.snapshot().gallery?.index).toBe(12);
  });

  it("advances the exact show phase sequence and supports redo acceleration", () => {
    const modes = new SpecialModes(() => 0.25);
    modes.start("show");
    modes.tick(3);
    expect(modes.snapshot()).toMatchObject({
      mode: "show",
      transition: 1,
      show: { phase: "file-in", phaseIndex: 1, duration: 16 },
    });

    modes.tick(4, undefined, true);
    expect(modes.snapshot().show).toMatchObject({
      phase: "ocean",
      phaseIndex: 2,
      duration: 11,
    });
    modes.tick(11);
    expect(modes.snapshot().show).toMatchObject({
      phase: "title",
      phaseIndex: 3,
      duration: 20,
    });
    modes.tick(20 + 4.5 + 4.5 + 13);
    expect(modes.snapshot().show).toMatchObject({
      phase: "file-out",
      phaseIndex: 0,
      duration: 6,
    });
  });

  it("uses the original break acceleration, speed cap, pause, and music menu", () => {
    const modes = new SpecialModes();
    modes.start("break");
    modes.tick(4);
    modes.tick(1, { dx: 1, dy: 0 });
    expect(modes.snapshot().break).toMatchObject({
      x: 9,
      y: 0,
      xSpeed: 9,
      ySpeed: 0,
    });

    expect(modes.escape()).toBe(true);
    expect(modes.snapshot().paused).toBe(true);
    expect(modes.moveVertical(1)).toBe(true);
    expect(modes.moveVertical(1)).toBe(true);
    expect(modes.confirm()).toBe(true);
    expect(modes.snapshot().menu?.options).toEqual(breakMusicOptions);
    expect(modes.snapshot().break?.musicIndex).toBe(0);
    expect(modes.moveVertical(1)).toBe(true);
    expect(modes.confirm()).toBe(true);
    expect(modes.snapshot().break?.musicIndex).toBe(1);

    expect(modes.escape()).toBe(true);
    expect(modes.escape()).toBe(true);
    expect(modes.snapshot().paused).toBe(false);
  });
});
