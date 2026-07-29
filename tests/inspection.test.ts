import { describe, expect, it } from "vitest";
import { InspectionModel } from "../src/core/inspection";
import { parseLevel } from "../src/core/levelParser";

const inspectionLevel = `version 4
#
Block -1 -1 0 5 4 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 3 3 0.1 0.8 1 1 0 0 0 0 1 0 0
\t\tBlock 1 1 2 3 3 0.2 0.8 1 1 0 0 0 0 0 0 0
\tBlock 2 1 3 1 1 0.3 0.8 1 1 1 0 0 0 0 0 0
\tBlock 4 1 4 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
`;

describe("recursive box inspection", () => {
  it("enters and exits direct child boxes with original flip parity", () => {
    const world = parseLevel(inspectionLevel, "inspection");
    const inspection = new InspectionModel(world);
    const root = world.getDefaultFocusBlock();
    const outer = root.subLevel?.getBlock(1, 1);
    const inner = outer?.subLevel?.getBlock(1, 1);
    if (!outer || !inner) throw new Error("Inspection fixture is incomplete");

    expect(inspection.viewBlock).toBe(root);
    expect(inspection.flipH).toBe(false);
    expect(inspection.push(outer)).toBe(true);
    expect(inspection.viewBlock).toBe(outer);
    expect(inspection.flipH).toBe(true);

    expect(inspection.push(inner)).toBe(true);
    expect(inspection.viewBlock).toBe(inner);
    expect(inspection.flipH).toBe(true);

    expect(inspection.pop()).toBe(true);
    expect(inspection.viewBlock).toBe(outer);
    expect(inspection.flipH).toBe(true);
    expect(inspection.pop()).toBe(true);
    expect(inspection.viewBlock).toBe(root);
    expect(inspection.flipH).toBe(false);
    expect(inspection.pop()).toBe(false);
  });

  it("rejects filled boxes and boxes outside the current direct view", () => {
    const world = parseLevel(inspectionLevel, "inspection-filter");
    const inspection = new InspectionModel(world);
    const root = world.getDefaultFocusBlock();
    const outer = root.subLevel?.getBlock(1, 1);
    const filled = root.subLevel?.getBlock(2, 1);
    const inner = outer?.subLevel?.getBlock(1, 1);
    if (!outer || !filled || !inner) {
      throw new Error("Inspection fixture is incomplete");
    }

    expect(inspection.push(filled)).toBe(false);
    expect(inspection.push(inner)).toBe(false);
    expect(inspection.push(outer)).toBe(true);
    expect(inspection.push(inner)).toBe(true);
    expect(inspection.reset()).toBe(true);
    expect(inspection.currentBlock).toBeNull();
    expect(inspection.viewBlock).toBe(root);
    expect(inspection.flipH).toBe(false);
  });

  it("can zoom out from a marked multi-player focus to its wrapper", () => {
    const source = `version 4
#
Block -1 -1 0 3 3 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 3 3 0.6 0.8 1 1 0 0 0 0 0 0 12
\t\tBlock 1 1 2 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
\t\tBlock 2 1 3 1 1 0.9 1 0.7 1 1 1 0 1 0 0 0
`;
    const world = parseLevel(source, "multi-inspection");
    const inspection = new InspectionModel(world);
    const marked = world.multiplePlayerFocusBlock;
    const root = world.rootBlock;

    expect(inspection.viewBlock).toBe(marked);
    expect(inspection.pop()).toBe(true);
    expect(inspection.viewBlock).toBe(root);
  });
});
