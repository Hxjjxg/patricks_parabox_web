import {describe, expect, it} from "vitest";
import data from "../src/assets/data/puzzle_data.txt?raw";
import {puzzleMetadata} from "../src/core/progression";

describe("native Hub reference metadata parsing", () => {
  it("removes exactly the old-letter prefix from all364 shipped references", () => {
    const rows = data.replaceAll("\r", "").trim().split("\n");
    expect(rows).toHaveLength(364);
    for (const row of rows) {
      const fields = row.trim().split(/\s+/), metadata = puzzleMetadata.get(fields[0]!)!;
      expect(metadata.referenceName, fields[0]).toBe(fields[6]!.slice(1));
      expect(metadata.referenceNameWithOldLetter, fields[0]).toBe(fields[6]);
      expect(metadata.referenceName).toMatch(/^\d+$/);
    }
  });
  it("uses native Intro digits1,2,3 rather than old-letter labels", () => {
    expect(["first_puzzle", "second_puzzle", "third_puzzle"].map(name => puzzleMetadata.get(name)!.referenceName))
      .toEqual(["1", "2", "3"]);
  });
});
