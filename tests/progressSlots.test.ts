import { describe, expect, it } from "vitest";
import {
  formatPlaytime,
  ProgressSlotStore,
} from "../src/core/progressSlots";
import type { ProgressSnapshot } from "../src/core/progression";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function snapshot(
  wonLevels: string[],
  nexusUnlocked = false,
): ProgressSnapshot {
  return {
    version: 3,
    wonLevels,
    attemptedLevels: wonLevels,
    recentArea: "Area_Intro",
    nexusUnlocked,
    playtimeSeconds: 3661,
  };
}

describe("four-slot progress persistence", () => {
  it("starts with four independent empty slots", () => {
    const store = new ProgressSlotStore(new MemoryStorage());
    expect(store.activeSlot).toBe(0);
    expect(store.summaries(364)).toEqual(
      [0, 1, 2, 3].map((slot) => ({
        slot,
        empty: true,
        wonCount: 0,
        nexusUnlocked: false,
        allWon: false,
        playtimeSeconds: 0,
      })),
    );
  });

  it("saves and switches slots without sharing their state", () => {
    const storage = new MemoryStorage();
    const store = new ProgressSlotStore(storage);
    store.saveActive(snapshot(["first_puzzle"]));
    expect(store.switchSlot(1)).toBeNull();
    store.saveActive(snapshot(["second_puzzle"], true));

    expect(store.snapshotAt(0)?.wonLevels).toEqual([
      "first_puzzle",
    ]);
    expect(store.snapshotAt(1)).toMatchObject({
      wonLevels: ["second_puzzle"],
      nexusUnlocked: true,
    });

    const restored = new ProgressSlotStore(storage);
    expect(restored.activeSlot).toBe(1);
    expect(restored.activeSnapshot()?.wonLevels).toEqual([
      "second_puzzle",
    ]);
    expect(restored.activeSnapshot()?.playtimeSeconds).toBe(3661);
  });

  it("formats playtime exactly as the original save-file menu", () => {
    expect(formatPlaytime(0)).toBe("00:00");
    expect(formatPlaytime(3599.99)).toBe("00:59");
    expect(formatPlaytime(3661)).toBe("01:01");
    expect(formatPlaytime(360_000)).toBe("100:00");
  });

  it("does not create a save file for attempted-only progress", () => {
    const store = new ProgressSlotStore(new MemoryStorage());
    store.saveActive({
      version: 3,
      wonLevels: [],
      attemptedLevels: ["first_puzzle"],
      recentArea: "Area_Intro",
      nexusUnlocked: false,
      playtimeSeconds: 15,
    });

    expect(store.activeSnapshot()).toBeNull();
    expect(store.summaries(364)[0]?.empty).toBe(true);
  });

  it("counts only official puzzles when summarizing a save", () => {
    const store = new ProgressSlotStore(new MemoryStorage());
    store.saveActive(snapshot(["first_puzzle", "obsolete_debug_level"]));

    expect(
      store.summaries(
        new Set(["first_puzzle", "second_puzzle"]),
      )[0],
    ).toMatchObject({
      wonCount: 1,
      allWon: false,
    });
  });

  it("migrates the prior single-save key into slot one", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "parabox-web-progress-v1",
      JSON.stringify(snapshot(["third_puzzle"])),
    );

    const store = new ProgressSlotStore(storage);
    expect(store.activeSlot).toBe(0);
    expect(store.activeSnapshot()?.wonLevels).toEqual([
      "third_puzzle",
    ]);
    expect(
      storage.getItem("parabox-web-save-slots-v1"),
    ).not.toBeNull();
  });

  it("loads older snapshots without playtime as zero", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "parabox-web-save-slots-v1",
      JSON.stringify({
        version: 1,
        activeSlot: 0,
        slots: [
          {
            version: 2,
            wonLevels: ["first_puzzle"],
            attemptedLevels: ["first_puzzle"],
            recentArea: "Area_Intro",
            nexusUnlocked: false,
          },
          null,
          null,
          null,
        ],
      }),
    );

    expect(
      new ProgressSlotStore(storage).activeSnapshot()?.playtimeSeconds,
    ).toBe(0);
  });

  it("erases only the requested slot", () => {
    const store = new ProgressSlotStore(new MemoryStorage());
    store.saveActive(snapshot(["first_puzzle"]));
    store.switchSlot(1);
    store.saveActive(snapshot(["second_puzzle"]));

    expect(store.eraseSlot(0)).toBe(true);
    expect(store.eraseSlot(0)).toBe(false);
    expect(store.snapshotAt(0)).toBeNull();
    expect(store.snapshotAt(1)?.wonLevels).toEqual([
      "second_puzzle",
    ]);
  });
});
