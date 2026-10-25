import { createServer } from "vite";
import { readFileSync } from "node:fs";

const [name, ...commands] = process.argv.slice(2);
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { parseLevel } = await server.ssrLoadModule("/src/core/levelParser.ts");
  const { MovementEngine } = await server.ssrLoadModule("/src/core/movement.ts");
  const { stopAllAnimations } = await server.ssrLoadModule("/src/core/animation.ts");
  const world = parseLevel(readFileSync(new URL(`../../src/assets/levels/${name}.txt`, import.meta.url), "utf8"), name);
  const movement = new MovementEngine(world);
  const dirs = {UP:[0,1],RIGHT:[1,0],DOWN:[0,-1],LEFT:[-1,0]};
  for (const command of commands) {
    const from = world.findPlayerBlock();
    const before = {level: world.levels.indexOf(from.outerLevel), x:from.x,y:from.y,flip:world.cameraFlipH};
    movement.applyDirectionalInput(...dirs[command]);
    const player = world.findPlayerBlock();
    console.log(JSON.stringify({command,before,after:{level:world.levels.indexOf(player.outerLevel),x:player.x,y:player.y,flip:world.cameraFlipH},anim:player.animType,length:player.animLength,camera:[world.newX,world.newY,world.newXS,world.newYS],infinity:world.wentToInfZone}));
    stopAllAnimations(world);
  }
} finally { await server.close(); }
