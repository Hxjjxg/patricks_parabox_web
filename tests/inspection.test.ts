import { describe, expect, it } from "vitest";
import { InspectionModel } from "../src/core/inspection";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { updateCameraAnimation } from "../src/core/animation";

const inspectionLevel = `version 4
#
Block -1 -1 0 5 4 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 3 3 0.1 0.8 1 1 0 0 0 0 1 0 0
\t\tBlock 1 1 2 3 3 0.2 0.8 1 1 0 0 0 0 0 0 0
\tBlock 2 1 3 1 1 0.3 0.8 1 1 1 0 0 0 0 0 0
\tBlock 4 1 4 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
`;

describe("recursive box inspection", () => {
  it("starts the native enter pointer zoom with float camera scale and timed phases", () => {
    const world = parseLevel(getLevelSource("enter"), "enter");
    const inspection = new InspectionModel(world);
    const child = world.blocks.find(block => block.id === 81)!;
    expect(inspection.push(child)).toBe(true);
    expect({ moving: world.cameraMoving, length: world.cameraAnimLength, phase: world.newCamT,
      x: world.newX, y: world.newY, xs: world.newXS, ys: world.newYS })
      .toEqual({ moving: true, length: .5, phase: 0, x: -1, y: -1,
        xs: Math.fround(1 / 9), ys: Math.fround(1 / 9) });
    for (let frame = 1; frame <= 4; frame++) {
      updateCameraAnimation(world, .125);
      expect(world.newCamT).toBe(frame / 4);
    }
    expect(world.cameraMoving).toBe(false);
  });

  it("starts native pop from the settled camera context", () => {
    const world = parseLevel(getLevelSource("enter"), "enter");
    const inspection = new InspectionModel(world);
    inspection.push(world.blocks.find(block => block.id === 81)!);
    updateCameraAnimation(world, .5);
    // Draw at phase1 writes the identity context, independently of retained newX/newXS.
    world.usedX = world.usedY = 0; world.usedXS = world.usedYS = 1;
    expect(inspection.pop()).toBe(true);
    expect({ moving: world.cameraMoving, length: world.cameraAnimLength, phase: world.newCamT,
      x: world.newX, y: world.newY, xs: world.newXS, ys: world.newYS })
      .toEqual({ moving: true, length: .5, phase: 0, x: Math.fround(1 / 9),
        y: Math.fround(1 / 9), xs: 9, ys: 9 });
  });

  it("resets active inspection camera offsets before gameplay resumes", () => {
    const world = parseLevel(inspectionLevel, "inspection-reset");
    const inspection = new InspectionModel(world);
    inspection.push(world.rootBlock!.subLevel!.getBlock(1, 1)!);
    world.cameraMoving = true; world.newX = 4; world.newXS = .2; world.newCamT = .4;
    expect(inspection.reset()).toBe(true);
    expect({moving: world.cameraMoving, x: world.newX, xs: world.newXS, phase: world.newCamT})
      .toEqual({moving: false, x: 0, xs: 1, phase: 1});
  });

  it("rejects a moving child without weakening the filled-box gate", () => {
    const world = parseLevel(inspectionLevel, "inspection-moving");
    const inspection = new InspectionModel(world);
    const child = world.rootBlock!.subLevel!.getBlock(1, 1)!;
    child.moving = true;
    expect(inspection.canPush(child)).toBe(false);
    expect(inspection.push(child)).toBe(false);
    expect(inspection.currentBlock).toBeNull();
  });

  it.each([0, 1, 2, 3])("uses native zoom preference %s and long-frame completion", enterSpeedIndex => {
    const world = parseLevel(inspectionLevel, "inspection-speed");
    world.enterSpeedIndex = enterSpeedIndex;
    const inspection = new InspectionModel(world);
    inspection.push(world.rootBlock!.subLevel!.getBlock(1, 1)!);
    const length = [.5, 1 / 3, .25, .75][enterSpeedIndex]!;
    expect(world.cameraAnimLength).toBe(length);
    updateCameraAnimation(world, length / 2);
    expect(world.newCamT).toBeCloseTo(.5, 12);
    expect(world.cameraMoving).toBe(true);
    updateCameraAnimation(world, 1);
    expect(world.newCamT).toBe(1);
    expect(world.cameraMoving).toBe(false);
  });

  it("composes flipped inspection using the enclosing and departing level zoom factors", () => {
    const world = parseLevel(inspectionLevel, "inspection-zoom");
    const inspection = new InspectionModel(world);
    const rootLevel = world.rootBlock!.subLevel!;
    const child = rootLevel.getBlock(1, 1)!;
    rootLevel.camZoomFactor = 1.3; child.subLevel!.camZoomFactor = .7;
    inspection.push(child);
    expect(inspection.flipH).toBe(true);
    expect(world.newX).toBe(-1); expect(world.newY).toBe(.5);
    expect(world.newXS).toBe(Math.fround(Math.fround(1 / 5) * Math.fround(1.3)));
    expect(world.newYS).toBe(Math.fround(Math.fround(1 / 4) * Math.fround(1.3)));
    // Renderer context at a settled child camera.
    world.usedX = world.usedY = 0; world.usedXS = world.usedYS = 1;
    inspection.pop();
    expect(inspection.flipH).toBe(false);
    expect(world.newX).toBe(Math.fround(1 / 5));
    expect(world.newY).toBe(Math.fround(-.5 / 4));
    expect(world.newXS).toBe(Math.fround(5 * Math.fround(.7)));
    expect(world.newYS).toBe(Math.fround(4 * Math.fround(.7)));
  });

  it("leaves ordinary movement camera state intact when inspection was never active", () => {
    const world = parseLevel(inspectionLevel, "inspection-no-reset");
    const inspection = new InspectionModel(world);
    world.cameraMoving = true; world.newX = 4; world.newXS = .2;
    expect(inspection.reset()).toBe(false);
    expect(world.cameraMoving).toBe(true); expect(world.newX).toBe(4); expect(world.newXS).toBe(.2);
  });

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
