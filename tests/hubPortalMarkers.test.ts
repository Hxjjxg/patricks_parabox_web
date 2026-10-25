import { describe, expect, it } from "vitest";
import { FloorType, WorldModel } from "../src/core/model";
import { advanceHubPortalFlashTime, clipHubPortalRect, hubPortalClampRect, hubPortalMarkerColor,
  hubPortalMarkerPhase, hubPortalMarkerRect, hubPortalShadowAlpha, hubPortalShadowColor,
  hubPortalShadowGuiAlpha, hubPortalShadowRect } from "../src/render/hubPortalRendering";

function portal() {
  const world = new WorldModel("hub");
  const level = world.createLevel(11, 11); level.hubAreaName = "Area_Intro";
  const floor = world.createFloor(6, 6, level, FloorType.LevelPortal); floor.unlocked = true;
  return floor;
}
const geometry = {centerX: 100, centerY: 80, width: 40, height: 20};

describe("native Hub global marker clock", () => {
  it.each([[0, 0], [.25, .125], [.5, .5], [.75, .875], [1, 1], [1.5, .5], [2, 0], [3, 1], [4, 0]])(
    "applies the source QuadOscillate atclock%s", (clock, expected) => {
      expect(hubPortalMarkerPhase(clock!)).toBe(expected);
    },
  );
  it("accumulates float32 frame deltas instead of resetting or wrapping the shared clock", () => {
    let clock = 0;
    for (let frame = 0; frame < 10; frame++) clock = advanceHubPortalFlashTime(clock, .1);
    expect(clock).toBe(1.0000001192092896);
    expect(advanceHubPortalFlashTime(2, .5)).toBe(2.5);
  });
});

describe("native Hub portal marker geometry", () => {
  it.each([
    [0, {x: 78, y: 66, width: 10, height: 10}],
    [.5, {x: 76, y: 64, width: 13, height: 14}],
    [1, {x: 74, y: 63, width: 17, height: 16}],
  ] as const)("retains float geometry then separately truncates endpoints atclock%s", (clock, expected) => {
    expect(hubPortalMarkerRect(portal(), geometry, clock)).toEqual(expected);
    expect(hubPortalMarkerColor).toBe(0xffffff);
  });
  it("uses width for the square side and width/height separately for its corner center", () => {
    expect(hubPortalMarkerRect(portal(), {...geometry, height: 40}, 0)).toEqual({x: 78, y: 58, width: 10, height: 10});
  });
  it("uses the native inherited clamp while allowing the marker outside its own portal cell", () => {
    expect(hubPortalMarkerRect(portal(), geometry, 0)).toMatchObject({x: 78, y: 66});
    expect(hubPortalMarkerRect(portal(), geometry, 0, {clamp: {x: 80, y: 68, width: 5, height: 5}})).toEqual({x: 80, y: 68, width: 5, height: 5});
    expect(hubPortalMarkerRect(portal(), geometry, 0, {clamp: {x: 0, y: 0, width: 10, height: 10}})).toBeNull();
  });
  it("gates locked, won, screenshot and unlocking-visual portals exactly as source", () => {
    const floor = portal();
    expect(hubPortalMarkerRect({...floor, unlocked: false}, geometry, 0)).toBeNull();
    expect(hubPortalMarkerRect({...floor, won: true}, geometry, 0)).toBeNull();
    expect(hubPortalMarkerRect(floor, geometry, 0, {screenshottingBlocks: true})).toBeNull();
    expect(hubPortalMarkerRect({...floor, hard: 2}, geometry, 0, {unlocking: true})).toBeNull();
    expect(hubPortalMarkerRect({...floor, hard: 1}, geometry, 0, {unlocking: true})).not.toBeNull();
    expect(hubPortalMarkerRect({...floor, hard: 2}, geometry, 0)).not.toBeNull();
  });
});

describe("native Hub portal shadows and clipping", () => {
  it("retains source black/0.15 GUI alpha with the existing GUI transfer", () => {
    expect(hubPortalShadowColor).toBe(0x000000);
    expect(hubPortalShadowGuiAlpha).toBe(Math.fround(.15));
    expect(hubPortalShadowAlpha).toBeCloseTo(.3, 7);
  });
  it("snaps only unlocked-unsolved centers to floor+quarter before the fixed shadow shift", () => {
    const floor = portal(); const rect = {centerX: 100.8, centerY: 80.7, width: 31, height: 29};
    expect(hubPortalShadowRect(floor, rect, 800, 600)).toEqual({x: 86, y: 67, width: 31, height: 29});
    expect(hubPortalShadowRect({...floor, won: true}, rect, 800, 600)).toEqual({x: 87, y: 68, width: 31, height: 29});
    expect(hubPortalShadowRect({...floor, unlocked: false}, rect, 800, 600)).toEqual({x: 87, y: 68, width: 31, height: 29});
    expect(hubPortalShadowRect(floor, rect, 800, 600, {flipH: true})).toEqual({x: 82, y: 67, width: 31, height: 29});
  });
  it("computes shadow offset from static cell dimensions and native ties-to-even border rounding", () => {
    const floor = {...portal(), won: true};
    expect(hubPortalShadowRect(floor, {centerX: 100, centerY: 100, width: 60, height: 60}, 800, 600)).toMatchObject({x: 74, y: 74});
    expect(hubPortalShadowRect(floor, {centerX: 100, centerY: 100, width: 60, height: 60}, 800, 600, {staticWidth: 30, staticHeight: 30})).toMatchObject({x: 72, y: 72});
    expect(hubPortalShadowRect(floor, {centerX: 100, centerY: 100, width: 75, height: 75}, 2000, 2000)).toMatchObject({x: 66, y: 66});
    expect(hubPortalShadowRect(floor, {centerX: 100, centerY: 100, width: 105, height: 105}, 2000, 2000)).toMatchObject({x: 55, y: 55});
  });
  it("preserves source screenshot/dev/hub border cap priorities", () => {
    const floor = {...portal(), won: true}; const rect = {centerX: 1000, centerY: 1000, width: 900, height: 900};
    expect(hubPortalShadowRect(floor, rect, 800, 600)).toMatchObject({x: 556});
    expect(hubPortalShadowRect(floor, rect, 800, 600, {hubBorderThicknessHack: true})).toMatchObject({x: 562});
    expect(hubPortalShadowRect(floor, rect, 800, 600, {screenshottingBlocks: true})).toMatchObject({x: 580});
    expect(hubPortalShadowRect(floor, rect, 800, 600, {devAchShrink: true, hubBorderThicknessHack: true})).toMatchObject({x: 580});
  });
  it.each(["Area_Priority", "Area_Extrude", "Area_Push"])("suppresses source performance-hack shadows in%s only when enabled", area => {
    const floor = portal(); floor.outerLevel.hubAreaName = area;
    expect(hubPortalShadowRect(floor, geometry, 800, 600, {receptionPerformanceHack: true})).toBeNull();
    expect(hubPortalShadowRect(floor, geometry, 800, 600)).not.toBeNull();
  });
  it("floors clamp endpoints after float conversion and rejects empty edge intersections", () => {
    expect(hubPortalClampRect({x: -1.2, y: -2.2, width: 10.1, height: 10.1})).toEqual({x: -2, y: -3, width: 10, height: 10});
    expect(hubPortalClampRect({x: 1.99999999, y: 0, width: 10, height: 10})).toMatchObject({x: 2});
    expect(clipHubPortalRect({x: 10, y: 0, width: 1, height: 1}, {x: 0, y: 0, width: 10, height: 10})).toBeNull();
    expect(hubPortalShadowRect(portal(), {centerX: 0, centerY: 0, width: 40, height: 40}, 800, 600, {clamp: {x: 0, y: 0, width: 10, height: 10}})).toEqual({x: 0, y: 0, width: 10, height: 10});
  });
});
