import { describe, expect, it } from "vitest";
import {
  CustomLevelStore,
  customLevelSceneName,
  customLevelStorageKey,
  parseCustomLevel,
} from "../src/core/customLevels";
import { MovementEngine } from "../src/core/movement";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const solvableCustomLevel = [
  "version 4",
  "#",
  "Block 0 0 0 2 1 0 1 1 1 0 0 0 0 0 0 0",
  "\tBlock 0 0 1 1 1 0 1 1 1 0 1 0 0 0 0 0",
  "\t\tWall 0 0 0 0 0",
  "\tFloor 1 0 PlayerButton",
].join("\n");

describe("persistent custom-level directory", () => {
  it("parses imported files with the original custom_level scene identity", () => {
    const world = parseCustomLevel(solvableCustomLevel);
    expect(world.levelName).toBe(customLevelSceneName);
    expect(world.playerBlocks).toHaveLength(1);
    expect(() => parseCustomLevel("version 3\n#")).toThrow(
      "unsupported level version 3",
    );
  });

  it("persists imports and overwrites a same-name file without changing its id", () => {
    const storage = new MemoryStorage();
    const store = new CustomLevelStore(storage);
    const first = store.importLevel(
      "folder/My.Level.txt",
      solvableCustomLevel,
    );
    expect(first).toMatchObject({
      replaced: false,
      entry: {
        filename: "My.Level.txt",
        displayName: "My.Level",
      },
    });

    const replacementSource = `${solvableCustomLevel}\n`;
    const replacement = store.importLevel(
      "my.level.TXT",
      replacementSource,
    );
    expect(replacement.replaced).toBe(true);
    expect(replacement.entry.id).toBe(first.entry.id);
    expect(store.list()).toHaveLength(1);
    expect(store.find(first.entry.id)?.source).toBe(replacementSource);

    const restored = new CustomLevelStore(storage);
    expect(restored.find(first.entry.id)).toEqual(replacement.entry);
  });

  it("tracks the last loaded file and resolves its newest overwritten source", () => {
    const storage = new MemoryStorage();
    const store = new CustomLevelStore(storage);
    const imported = store.importLevel("reload.txt", solvableCustomLevel);
    expect(store.markLoaded(imported.entry.id)).toBe(true);
    expect(store.markLoaded(imported.entry.id)).toBe(false);

    const updatedSource = `${solvableCustomLevel}\n\n`;
    store.importLevel("RELOAD.TXT", updatedSource);
    const lastLoaded = new CustomLevelStore(storage).lastLoaded();
    expect(lastLoaded).toMatchObject({
      id: imported.entry.id,
      source: updatedSource,
    });
    if (!lastLoaded) throw new Error("Missing last loaded custom level");

    const solved = parseCustomLevel(lastLoaded.source);
    expect(new MovementEngine(solved).applyDirectionalInput(1, 0).won).toBe(
      true,
    );
    expect(solved.moveCount).toBe(1);

    const reloaded = parseCustomLevel(lastLoaded.source);
    expect(reloaded.winning).toBe(false);
    expect(reloaded.moveCount).toBe(0);
    expect(reloaded.findPlayerBlock().x).toBe(0);
  });

  it("recovers from corrupt JSON and drops malformed or duplicate records", () => {
    const corrupt = new MemoryStorage();
    corrupt.setItem(customLevelStorageKey, "{");
    expect(new CustomLevelStore(corrupt).list()).toEqual([]);

    const recoverable = new MemoryStorage();
    recoverable.setItem(
      customLevelStorageKey,
      JSON.stringify({
        version: 99,
        entries: [
          null,
          { id: "", filename: "", source: "" },
          { id: "shared", filename: "one.txt", source: "old" },
          { id: "shared", filename: "two.txt", source: "two" },
          { id: "ignored", filename: "ONE.TXT", source: "new" },
        ],
        lastLoadedId: "missing",
      }),
    );
    const recovered = new CustomLevelStore(recoverable);
    expect(recovered.list()).toHaveLength(2);
    expect(new Set(recovered.list().map((entry) => entry.id)).size).toBe(2);
    expect(
      recovered.list().find((entry) => entry.filename === "ONE.TXT")?.source,
    ).toBe("new");
    expect(recovered.lastLoaded()).toBeNull();
  });
});
