import { FloorType, type Block, type Floor, type HsvColor, type Level } from "../core/model";
import { puzzleLinks, type PuzzleLink } from "../core/progression";
import { guiHsvColor } from "./borderRendering";

export type HubLineShape = "Straight" | "HorizFirstL" | "VertFirstL" | "HorizFirstS" | "VertFirstS";
export interface HubPoint { readonly x: number; readonly y: number }
export interface HubUnlockWall extends HubPoint {
  readonly level: Level;
  readonly unlockerScene: string;
  readonly originalBlock?: Block;
  /** Explicit native open state takes precedence over removed-wall inference. */
  readonly open?: boolean;
}
export interface HubLineRoute {
  readonly shape: HubLineShape;
  /** Native SinglePortalExit fields are returned, never written into the model. */
  readonly destinationExitDX?: number;
  readonly destinationExitDY?: number;
}
export interface HubConnection extends HubLineRoute {
  readonly floor: Floor;
  readonly target: Floor | null;
  readonly dx: number;
  readonly dy: number;
  readonly lit: boolean;
  readonly thick: boolean;
  readonly lastPortal?: boolean;
  readonly finishToReception?: boolean;
  readonly kind: "puzzle" | "shortcut" | "root" | "lastPortal" | "reception";
}

/** Snapshot before applyToHub removes open walls, as native LoadLevel does. */
export function captureHubUnlockWalls(blocks: readonly Block[]): HubUnlockWall[] {
  return blocks.flatMap(block => block.outerLevel && !block.subLevel && block.unlockerScene
    ? [{x: block.x, y: block.y, level: block.outerLevel, unlockerScene: block.unlockerScene, originalBlock: block}]
    : []);
}

/** Literal Floor.ComputeUnlockLineShape, including its endpoint exclusions. */
export function computeHubUnlockLineShape(
  level: Level, from: HubPoint, dx: number, dy: number,
  unlockWall = false, walls: readonly HubUnlockWall[] = [],
): HubLineRoute {
  const sx = Math.sign(dx), sy = Math.sign(dy);
  if (dx === 0 || dy === 0) return {shape: "Straight", destinationExitDX: sx, destinationExitDY: sy};
  const blocked = (x: number, y: number): boolean => {
    const block = level.getBlock(x, y);
    return level.getFloor(x, y) !== null || Boolean(block && !block.subLevel && block.unlockerScene === null)
      || !unlockWall && walls.some(wall => wall.x === x && wall.y === y);
  };
  const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
  for (let pass = 0; pass <= 1; pass++) {
    let clear = true;
    if (horizontalFirst === (pass === 0)) {
      for (let x = from.x + sx; x !== from.x + dx; x += sx) if (blocked(x, from.y)) clear = false;
      for (let y = from.y; y !== from.y + dy; y += sy) if (blocked(from.x + dx, y)) clear = false;
      if (clear) return {shape: "HorizFirstL", destinationExitDY: sy};
    } else {
      for (let y = from.y + sy; y !== from.y + dy; y += sy) if (blocked(from.x, y)) clear = false;
      for (let x = from.x; x !== from.x + dx; x += sx) if (blocked(x, from.y + dy)) clear = false;
      if (clear) return {shape: "VertFirstL", destinationExitDX: sx};
    }
  }
  return blocked(from.x, from.y + sy)
    ? {shape: "HorizFirstS", destinationExitDX: sx}
    : {shape: "VertFirstS", destinationExitDY: sy};
}

/** Read-only LoadLevel connection construction; immediate links emit no line. */
export function buildHubConnections(
  floors: readonly Floor[], walls: readonly HubUnlockWall[],
  options: {readonly links?: readonly PuzzleLink[]; readonly nexusUnlocked?: boolean} = {},
): HubConnection[] {
  const links = options.links ?? puzzleLinks;
  const portals = floors.filter(floor => floor.type === FloorType.LevelPortal);
  const byName = new Map(portals.map(floor => [floor.sceneName, floor]));
  const result: HubConnection[] = [];
  for (const floor of portals) {
    const relevantWalls = walls.filter(wall => wall.unlockerScene === floor.sceneName);
    const outgoing = links.filter(link => link.from === floor.sceneName && !link.immediate);
    // Native m=0 draws hard destinations first, m=1 core destinations second.
    for (const hard of [true, false]) for (const link of outgoing) {
      const target = byName.get(link.to);
      if (!target) throw new Error(`Missing Hub connection destination ${link.to}`);
      if ((target.hard !== 0) !== hard) continue;
      const dx = target.x - floor.x, dy = target.y - floor.y;
      result.push({floor, target, dx, dy, lit: target.unlocked, thick: !hard, kind: "puzzle",
        ...computeHubUnlockLineShape(floor.outerLevel, floor, dx, dy, false, relevantWalls)});
    }
    for (const wall of relevantWalls) {
      let destination: HubPoint | null = null;
      // Original nested n/num7 loop order: left, down, up, right.
      for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [1, 0]] as const) {
        const x = wall.x + dx, y = wall.y + dy;
        if (floor.outerLevel.inBounds(x, y) && floor.outerLevel.getBlock(x, y)?.subLevel) {
          destination = {x, y};
          break;
        }
      }
      if (destination) {
        const dx = destination.x - floor.x, dy = destination.y - floor.y;
        const open = wall.open ?? (wall.originalBlock !== undefined && wall.level.getBlock(wall.x, wall.y) !== wall.originalBlock);
        result.push({floor, target: null, dx, dy, lit: open, thick: true, kind: "shortcut",
          ...computeHubUnlockLineShape(floor.outerLevel, floor, dx, dy, true, relevantWalls)});
      }
    }
    const rootExcluded = ["Area_Challenge", "Area_Gallery", "Area_Priority", "Area_Extrude", "Area_Push"];
    if (!links.some(link => link.to === floor.sceneName) && floor.hard === 0 && floor.sceneName !== "first_puzzle"
      && !rootExcluded.includes(floor.outerLevel.hubAreaName)) {
      const dx = 0, dy = floor.outerLevel.height - floor.y;
      result.push({floor, target: null, dx, dy, lit: floor.unlocked, thick: true, kind: "root",
        ...computeHubUnlockLineShape(floor.outerLevel, floor, dx, dy, false, relevantWalls)});
    }
    if (floor.sceneName === "iii") {
      result.push({floor, target: null, dx: 3, dy: -2, shape: "VertFirstL", lastPortal: true,
        lit: floor.won, thick: true, kind: "lastPortal"});
      if (options.nexusUnlocked) result.push({floor, target: null, dx: 4, dy: -1, shape: "HorizFirstL",
        finishToReception: true, lit: true, thick: true, kind: "reception"});
    }
  }
  return result;
}

/** Continuous local waypoints, useful for source-coordinate diagnostics. */
export function hubConnectionWaypoints(line: Pick<HubConnection, "floor" | "dx" | "dy" | "shape">): HubPoint[] {
  const a = {x: line.floor.x, y: line.floor.y};
  const b = {x: a.x + line.dx, y: a.y + line.dy};
  switch (line.shape) {
    case "Straight": return [a, b];
    case "HorizFirstL": return [a, {x: b.x, y: a.y}, b];
    case "VertFirstL": return [a, {x: a.x, y: b.y}, b];
    case "HorizFirstS": return [a, {x: a.x + Math.sign(line.dx), y: a.y}, {x: a.x + Math.sign(line.dx), y: b.y}, b];
    case "VertFirstS": return [a, {x: a.x, y: a.y + Math.sign(line.dy)}, {x: b.x, y: a.y + Math.sign(line.dy)}, b];
  }
}

export interface HubLineDrawGeometry {readonly x: number; readonly y: number; readonly cellWidth: number; readonly cellHeight: number}
export interface HubLineRect {readonly x: number; readonly y: number; readonly width: number; readonly height: number}

/** DrawPortalLines/DrawPortalLine float endpoints and SetDrawRect truncation. */
export function hubConnectionRectangles(
  line: Pick<HubConnection, "dx" | "dy" | "shape" | "thick" | "lit" | "lastPortal" | "finishToReception">,
  geometry: HubLineDrawGeometry, screenshottingBlocks = false, _litPass?: boolean,
): HubLineRect[] {
  // Source/managed IL compares this flag with the line field; final lit argument is unused.
  if ((line.lit || screenshottingBlocks) !== line.lit) return [];
  const f = Math.fround;
  const {cellWidth: width, cellHeight: height} = geometry;
  const x = geometry.x + (line.finishToReception ? f(f(width) * f(3)) : 0);
  const y = geometry.y + (line.finishToReception ? f(f(width) * f(2)) : 0);
  let x1 = f(x), y1 = f(y), x2 = f(x + line.dx * width);
  const y2 = f(y - line.dy * height);
  if (line.lastPortal) x2 = f(x2 - f(f(width) * f(.57)));
  if (line.finishToReception) x1 = f(x1 + f(f(width) * f(.57)));
  const thickness = Math.max(1, Math.trunc(width * f(line.thick ? .32 : .12)));
  const sm = Math.trunc(thickness / 2), sp = thickness - sm;
  const truncate = (value: number) => Math.trunc(value) || 0;
  const segment = (ax: number, ay: number, bx: number, by: number): HubLineRect => {
    const left = truncate(f(Math.min(ax, bx) - sm)), top = truncate(f(Math.min(ay, by) - sm));
    return {x: left, y: top, width: truncate(f(Math.max(ax, bx) + sp)) - left,
      height: truncate(f(Math.max(ay, by) + sp)) - top};
  };
  switch (line.shape) {
    case "Straight": return [segment(x1, y1, x2, y2)];
    case "HorizFirstL": return [segment(x1, y1, x2, y1), segment(x2, y1, x2, y2)];
    case "VertFirstL": return [segment(x1, y1, x1, y2), segment(x1, y2, x2, y2)];
    case "HorizFirstS": {
      const mid = f(x + Math.sign(line.dx) * width);
      return [segment(x1, y1, mid, y1), segment(mid, y2, x2, y2), ...(line.dy ? [segment(mid, y1, mid, y2)] : [])];
    }
    case "VertFirstS": {
      const mid = f(y - Math.sign(line.dy) * height);
      return [segment(x1, y1, x1, mid), segment(x2, mid, x2, y2), ...(line.dx ? [segment(x1, mid, x2, mid)] : [])];
    }
  }
}

/** Native LineColor HSV plus the already-measured GUI half-color transfer. */
export function hubConnectionLineColor(
  color: HsvColor, active: boolean, parentWidth: number, parentHeight: number, screenHeight: number, hueOffset = 0,
): number {
  const f = Math.fround;
  const fraction = f((parentWidth + parentHeight) / 2 / screenHeight);
  const logarithm = f(Math.log(fraction) / Math.log(20));
  let value = f(Math.max(f(color.v), f(.4)) * f(f(f(-.4) * logarithm) + f(.8)));
  value = f(value * f(active ? .9 : .25));
  return guiHsvColor({h: f(f(color.h) + f(hueOffset)) % 1, s: active ? f(f(color.s) * f(.85)) : f(color.s), v: value});
}

export interface HubPortalGeometry {
  readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number;
}
export const hubPortalMarkerColor = 0xffffff;
export const hubPortalShadowColor = 0x000000;
export const hubPortalShadowGuiAlpha = Math.fround(.15);
/** Effective opacity under the existing native Graphics.DrawTexture GUI transfer. */
export const hubPortalShadowAlpha = hubPortalShadowGuiAlpha * 2;

function portalDrawRect(x: number, y: number, width: number, height: number): HubLineRect {
  const left = Math.trunc(x) || 0, top = Math.trunc(y) || 0;
  return {x: left, y: top, width: (Math.trunc(x + width) || 0) - left, height: (Math.trunc(y + height) || 0) - top};
}

/** EnableClamp's float32/floor endpoint conversion, not SetDrawRect truncation. */
export function hubPortalClampRect(rect: HubLineRect): HubLineRect {
  const x = Math.floor(Math.fround(rect.x)), y = Math.floor(Math.fround(rect.y));
  return {x, y, width: Math.floor(Math.fround(rect.x + rect.width)) - x,
    height: Math.floor(Math.fround(rect.y + rect.height)) - y};
}

/** DrawTexture intersects with the inherited clamp; a portal cell is not its clip. */
export function clipHubPortalRect(rect: HubLineRect, clamp?: HubLineRect): HubLineRect | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (!clamp) return rect;
  const x = Math.max(rect.x, clamp.x), y = Math.max(rect.y, clamp.y);
  const right = Math.min(rect.x + rect.width, clamp.x + clamp.width);
  const bottom = Math.min(rect.y + rect.height, clamp.y + clamp.height);
  return right > x && bottom > y ? {x, y, width: right - x, height: bottom - y} : null;
}

/** Draw.Update owns one accumulating float clock; it is not reset per portal. */
export function advanceHubPortalFlashTime(previous: number, deltaSeconds: number): number {
  return Math.fround(Math.fround(previous) + Math.fround(deltaSeconds));
}

/** Util.QuadOscillate(portalFlashT*.5f), with the native float operation order. */
export function hubPortalMarkerPhase(portalFlashT: number): number {
  const f = Math.fround;
  let k = f(f(portalFlashT) * f(.5));
  k = f(k - Math.floor(k));
  let value = k < .5 ? f(k * 2) : f(1 - f(f(k - .5) * 2));
  value = f(value * 2);
  if (value < 1) return f(f(.5 * value) * value);
  value = f(value - 1);
  return f(-.5 * f(f(value * f(value - 2)) - 1));
}

/** DrawPortalMarker's global-phase square and source visibility gates. */
export function hubPortalMarkerRect(
  floor: Pick<Floor, "unlocked" | "won" | "hard">, geometry: HubPortalGeometry, portalFlashT: number,
  options: {readonly screenshottingBlocks?: boolean; readonly unlocking?: boolean; readonly clamp?: HubLineRect} = {},
): HubLineRect | null {
  if (!floor.unlocked || floor.won || options.screenshottingBlocks || floor.hard === 2 && options.unlocking) return null;
  const f = Math.fround;
  const x = f(geometry.centerX), y = f(geometry.centerY), width = f(geometry.width), height = f(geometry.height);
  const start = f(width * f(.25)), end = f(width * f(.42));
  const side = f(start + f(f(end - start) * hubPortalMarkerPhase(portalFlashT)));
  const left = f(f(x - f(width * f(.42))) - f(side / 2));
  const top = f(f(y - f(height * f(.42))) - f(side / 2));
  // SetDrawRect receives promoted floats, then adds its double endpoints.
  return clipHubPortalRect(portalDrawRect(left, top, side, side), options.clamp);
}

function unityRoundNonnegative(value: number): number {
  const lower = Math.floor(value);
  return value - lower === .5 ? lower + lower % 2 : Math.round(value);
}

/** DrawPortalShadow, including static-cell border width and optional native draw flags. */
export function hubPortalShadowRect(
  floor: Pick<Floor, "unlocked" | "won" | "outerLevel">, geometry: HubPortalGeometry,
  screenWidth: number, screenHeight: number, options: {
    readonly flipH?: boolean; readonly staticWidth?: number; readonly staticHeight?: number;
    readonly receptionPerformanceHack?: boolean; readonly devAchShrink?: boolean;
    readonly screenshottingBlocks?: boolean; readonly hubBorderThicknessHack?: boolean; readonly clamp?: HubLineRect;
  } = {},
): HubLineRect | null {
  if (options.receptionPerformanceHack && ["Area_Priority", "Area_Extrude", "Area_Push"].includes(floor.outerLevel.hubAreaName)) return null;
  const f = Math.fround;
  const staticWidth = f(options.staticWidth ?? geometry.width), staticHeight = f(options.staticHeight ?? geometry.height);
  const border = f(Math.min(staticWidth, staticHeight) / f(30));
  let cap = f(f(Math.min(screenWidth, screenHeight)) * f(.00508));
  if (options.devAchShrink || options.screenshottingBlocks) cap = f(cap * 5);
  else if (options.hubBorderThicknessHack) cap = f(cap * 2);
  const thickness = Math.max(1, unityRoundNonnegative(Math.min(Math.max(border, 1), cap)));
  const shift = f(thickness * 2);
  let x = geometry.centerX, y = geometry.centerY;
  if (floor.unlocked && !floor.won) {
    x = f(Math.floor(f(x)) + f(.25));
    y = f(Math.floor(f(y)) + f(.25));
  }
  return clipHubPortalRect(portalDrawRect(x - geometry.width / 2 + (options.flipH ? -shift : shift),
    y - geometry.height / 2 + shift, geometry.width, geometry.height), options.clamp);
}
