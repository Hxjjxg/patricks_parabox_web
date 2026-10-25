import type { Graphics } from "pixi.js";
import { AnimType } from "../core/animation";
import type { Block, HsvColor, Level } from "../core/model";
import { originalDrawRect, type WallRect } from "./wallRendering";

/** Native measured GUI transfer: round half-color to bytes, then double. */
export function guiHsvColor({ h, s, v }: HsvColor): number {
  const hue = ((h % 1) + 1) % 1 * 6;
  const index = Math.floor(hue);
  const fraction = hue - index;
  const p = v * (1 - s);
  const q = v * (1 - fraction * s);
  const t = v * (1 - (1 - fraction) * s);
  // Color.HSVToRGB clamps output channels, not its saturation argument.
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][index % 6]!;
  const channels = rgb.map((value) => Math.min(255, Math.round(Math.max(0, Math.min(1, value)) * 255 / 2) * 2));
  return channels[0]! << 16 | channels[1]! << 8 | channels[2]!;
}

function unityRound(value: number): number {
  const floor = Math.floor(value);
  return value - floor === 0.5 ? floor + floor % 2 : Math.round(value);
}

/** ComputeBorderThicknessBlock uses unscaled cells for ordinary moving boxes. */
export function borderThickness(
  block: Block, rect: WallRect, staticRect: WallRect,
  screenWidth: number, screenHeight: number, resolution = 1,
): number {
  const stable = block.moving && block.anim !== AnimType.EnterExit &&
    block.anim !== AnimType.JumpIn && block.anim !== AnimType.JumpOut;
  const size = stable ? staticRect : rect;
  const maximum = Math.min(screenWidth, screenHeight) * resolution * 0.00508;
  const value = Math.max(1, Math.min(Math.min(size.width, size.height) * resolution / 30, maximum));
  return Math.max(1, unityRound(value)) / resolution;
}

/** Full solid sides are continuous; open sides retain only solid edge cells. */
export function borderStrips(level: Level, rect: WallRect, thickness: number, flipH: boolean): WallRect[] {
  const strips: WallRect[] = [];
  const solid = (x: number, y: number, moving = true) => {
    const block = level.getBlock(x, y);
    return Boolean(block && !block.subLevel &&
      (moving || !block.moving || block.anim !== AnimType.EnterExit));
  };
  const sides = [
    Array.from({ length: level.height }, (_, y) => [0, y] as const),
    Array.from({ length: level.height }, (_, y) => [level.width - 1, y] as const),
    Array.from({ length: level.width }, (_, x) => [x, level.height - 1] as const),
    Array.from({ length: level.width }, (_, x) => [x, 0] as const),
  ];
  for (let side = 0; side < 4; side++) {
    const cells = sides[side]!;
    const full = cells.every(([x, y]) => solid(x, y));
    if (full) {
      const right = (side === 1) !== flipH;
      strips.push(side < 2
        ? { x: right ? rect.x + rect.width - thickness : rect.x, y: rect.y, width: thickness, height: rect.height }
        : { x: rect.x, y: side === 2 ? rect.y : rect.y + rect.height - thickness, width: rect.width, height: thickness });
      continue;
    }
    for (const [x, y] of cells) {
      if (!solid(x, y, false)) continue;
      const screenX = flipH ? level.width - x - 1 : x;
      const right = (side === 1) !== flipH;
      strips.push(side < 2
        ? { x: right ? rect.x + rect.width - thickness : rect.x, y: rect.y + (level.height - y - 1) * rect.height / level.height, width: thickness, height: rect.height / level.height }
        : { x: rect.x + screenX * rect.width / level.width, y: side === 2 ? rect.y : rect.y + rect.height - thickness, width: rect.width / level.width, height: thickness });
    }
  }
  return strips;
}

/** DrawBlockBorder's native special full-outline predicate. */
export function isInfinityBorder(block: Block): boolean {
  return block.isSomeInfExitBlock || Boolean(block.outerLevel?.infZone && block.subLevel && !block.subLevel.filledWithWalls && block.specialEffect !== 12);
}

export function drawBlockBorder(
  graphics: Graphics, block: Block, rect: WallRect, staticRect: WallRect, flipH: boolean,
  screenWidth: number, screenHeight: number, resolution = 1, time = 0,
): void {
  if (!block.subLevel) return;
  const thickness = borderThickness(block, rect, staticRect, screenWidth, screenHeight, resolution);
  const infinity = isInfinityBorder(block);
  const phase = Math.fround(time * Math.fround(0.3)) % 1;
  const k = (phase < 0.5 ? phase * 2 : 1 - (phase - 0.5) * 2) * 2;
  // Util decrements k before evaluating BOTH factors in the second branch.
  const oscillation = k < 1 ? 0.5*k*k : -0.5*((k-1)*(k-3)-1);
  const color = block.locked ? 0xff0000 : infinity ? guiHsvColor({h:0.15,s:1,v:0.65+0.35*oscillation})
    : guiHsvColor({ h: block.color.h, s: block.color.s * 1.2, v: block.color.v * 0.18 });
  const strips = infinity ? [
    {x:flipH?rect.x+rect.width-thickness:rect.x,y:rect.y,width:thickness,height:rect.height},
    {x:flipH?rect.x:rect.x+rect.width-thickness,y:rect.y,width:thickness,height:rect.height},
    {x:rect.x,y:rect.y,width:rect.width,height:thickness},
    {x:rect.x,y:rect.y+rect.height-thickness,width:rect.width,height:thickness},
  ] : borderStrips(block.subLevel, rect, thickness, flipH);
  for (const strip of strips) {
    const snapped = originalDrawRect(strip, resolution);
    if (snapped.width > 0 && snapped.height > 0) graphics.rect(snapped.x, snapped.y, snapped.width, snapped.height).fill(color);
  }
}

/** DrawBlock's early open-edge pass, separate from later solid/gold borders. */
export function drawInfZoneFrame(
  graphics: Graphics,block:Block,rect:WallRect,staticRect:WallRect,
  screenWidth:number,screenHeight:number,resolution=1,
):void {
  const level=block.subLevel;
  if(!level?.infZone)return;
  const t=borderThickness(block,rect,staticRect,screenWidth,screenHeight,resolution);
  const solid=(x:number,y:number)=>Boolean(level.getBlock(x,y)&&!level.getBlock(x,y)!.subLevel);
  const sides=[
    Array.from({length:level.height},(_,y)=>solid(0,y)).every(Boolean),
    Array.from({length:level.height},(_,y)=>solid(level.width-1,y)).every(Boolean),
    Array.from({length:level.width},(_,x)=>solid(x,level.height-1)).every(Boolean),
    Array.from({length:level.width},(_,x)=>solid(x,0)).every(Boolean),
  ];
  const strips=[
    {x:rect.x,y:rect.y,width:t,height:rect.height},
    {x:rect.x+rect.width-t,y:rect.y,width:t,height:rect.height},
    {x:rect.x+t,y:rect.y,width:rect.width-t*2,height:t},
    {x:rect.x+t,y:rect.y+rect.height-t,width:rect.width-t*2,height:t},
  ];
  for(let i=0;i<4;i++){
    if(sides[i])continue;
    const r=originalDrawRect(strips[i]!,resolution);
    // Native direct Color.white alpha.2 goes through the GUI shader's x2.
    if(r.width>0&&r.height>0)graphics.rect(r.x,r.y,r.width,r.height).fill({color:0xffffff,alpha:0.4});
  }
}
