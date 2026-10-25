import { describe, expect, it } from "vitest";
import { Container } from "pixi.js";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { MovementEngine } from "../src/core/movement";
import { updateWorldAnimations } from "../src/core/animation";
import { GameRenderer } from "../src/render/GameRenderer";

function actualRrdWorld() {
  const world = parseLevel(getLevelSource("1by1_playerr_flip2"), "1by1_playerr_flip2");
  const engine = new MovementEngine(world);
  const context = { deltaTime: 1, quickAnim: false, handleActionFloor: () => false, random: () => 0.5 };
  for (const [dx,dy] of [[1,0],[1,0],[0,-1]]) {
    expect(engine.applyDirectionalInput(dx!,dy!).moved).toBe(true);
    updateWorldAnimations(world,context); updateWorldAnimations(world,context);
  }
  world.cameraMoving = false; world.newCamT = 1;
  // Actual native flip-recursive-preview-topology-20261025: four previews,
  // each via preplaced infinity reference101, bridge from level1 to root0.
  expect(world.infExitPreviews.map(preview=>preview.exitBlocks.map(block=>block.id))).toEqual([[101],[101],[101],[101]]);
  return world;
}

describe("actual RRD recursive flip renderer topology", () => {
  it("submits all four native root-board preview contexts outside the one-cell player world", () => {
    const world = actualRrdWorld();
    expect(world.findPlayerBlock().outerLevel!.id).toBe(1);
    expect(world.getDefaultFocusBlock().id).toBe(51);
    const submitted: Array<{level:number;block:number;depth:number}> = [];
    const graphics = { rect: () => graphics, fill: () => graphics };
    const receiver = Object.assign(Object.create(GameRenderer.prototype), {
      app:{screen:{width:800,height:600},renderer:{resolution:1}}, world, scene:new Container(),
      sceneLayers:[], maskPasses:[], maskPassCount:0, shadowTextureCount:0, elapsed:0,
      inspectionBlock:null,inspectionFlipH:false,uiState:null,
      nextSceneLayer:()=>graphics, drawVoid:()=>{}, drawControls:()=>{}, drawModeOverlay:()=>{},
      winText:{text:"",alpha:0,position:{set:()=>{}}},
      drawLevel:(_graphics:unknown,level:{id:number},block:{id:number},_rect:unknown,depth:number)=>{
        submitted.push({level:level.id,block:block.id,depth}); return graphics;
      },
    });
    receiver.draw();
    expect(submitted.filter(ticket=>ticket.level===0)).toHaveLength(4);
    expect(submitted.filter(ticket=>ticket.level===0).every(ticket=>ticket.block===0)).toBe(true);
    expect(submitted.at(-1)?.level).toBe(1);
    // Native root starts3levels outward from focus; depth counts down.
    expect(submitted.at(-1)?.depth).toBe(-3);
  });
});
