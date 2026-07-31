import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  enterSpeedName,
  formatMoveDelay,
  SettingsModel,
  settingsStorageKey,
} from "../src/core/settings";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("persistent game settings", () => {
  it("starts with the original preference defaults", () => {
    const settings = new SettingsModel(new MemoryStorage());
    expect(settings.snapshot()).toEqual(defaultSettings);
    expect(enterSpeedName(settings.snapshot().enterSpeedIndex)).toBe("1x");
    expect(formatMoveDelay(settings.snapshot().moveDelay)).toBe("70 ms");
  });

  it("persists mutations and normalizes corrupt stored values", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      settingsStorageKey,
      JSON.stringify({
        musicVolume: 500,
        soundVolume: -20,
        grid: true,
        moveDelay: 900,
        enterSpeedIndex: 99,
        language: "",
      }),
    );
    const settings = new SettingsModel(storage);
    expect(settings.snapshot()).toMatchObject({
      musicVolume: 100,
      soundVolume: 0,
      grid: true,
      moveDelay: 501,
      enterSpeedIndex: 3,
      language: "Default",
    });

    expect(settings.adjustVolume("musicVolume", -1)).toBe(true);
    expect(settings.toggle("grid")).toBe(true);
    expect(settings.setLanguage("EN")).toBe(true);
    expect(new SettingsModel(storage).snapshot()).toMatchObject({
      musicVolume: 95,
      grid: false,
      language: "EN",
    });
  });

  it("uses the original enter-speed order and clamps its endpoints", () => {
    const settings = new SettingsModel(new MemoryStorage());
    expect(settings.cycleEnterSpeed(-1)).toBe(true);
    expect(enterSpeedName(settings.snapshot().enterSpeedIndex)).toBe("0.66x");
    expect(settings.cycleEnterSpeed(-1)).toBe(false);

    expect(settings.cycleEnterSpeed(1)).toBe(true);
    expect(settings.cycleEnterSpeed(1)).toBe(true);
    expect(settings.cycleEnterSpeed(1)).toBe(true);
    expect(enterSpeedName(settings.snapshot().enterSpeedIndex)).toBe("2x");
    expect(settings.cycleEnterSpeed(1)).toBe(false);
  });

  it("matches the original repeat-delay step sizes and Off sentinel", () => {
    const settings = new SettingsModel(new MemoryStorage());
    expect(settings.replace({ ...defaultSettings, moveDelay: 190 })).toBe(true);
    settings.cycleMoveDelay(1);
    expect(settings.snapshot().moveDelay).toBe(200);
    settings.cycleMoveDelay(1);
    expect(settings.snapshot().moveDelay).toBe(250);
    settings.replace({ ...defaultSettings, moveDelay: 500 });
    settings.cycleMoveDelay(1);
    expect(settings.snapshot().moveDelay).toBe(501);
    expect(formatMoveDelay(settings.snapshot().moveDelay)).toBe("Off");
    settings.cycleMoveDelay(-1);
    expect(settings.snapshot().moveDelay).toBe(500);
  });

  it("restores every value on reset", () => {
    const storage = new MemoryStorage();
    const settings = new SettingsModel(storage);
    settings.toggle("grid");
    settings.toggle("disableParticles");
    settings.setSoundVolume(15);
    settings.reset();
    expect(settings.snapshot()).toEqual(defaultSettings);
    expect(new SettingsModel(storage).snapshot()).toEqual(defaultSettings);
  });
});
