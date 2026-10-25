import { createServer } from "vite";
import { readFileSync } from "node:fs";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { parseLevel } = await server.ssrLoadModule("/src/core/levelParser.ts");
  const { MovementEngine } = await server.ssrLoadModule("/src/core/movement.ts");
  const { stopAllAnimations } = await server.ssrLoadModule("/src/core/animation.ts");
  const dirs = [["UP", 0, 1], ["RIGHT", 1, 0], ["DOWN", 0, -1], ["LEFT", -1, 0]];
  for (const name of process.argv.slice(2)) {
    const target = process.env.PARITY_TARGET ?? "infinity";
    const source = readFileSync(new URL(`../../src/assets/levels/${name}.txt`, import.meta.url), "utf8");
    const queue = [[]];
    const seen = new Set();
    let found = null;
    let visited = 0;
    while (queue.length && visited < 15000) {
      const route = queue.shift();
      const world = parseLevel(source, name);
      const movement = new MovementEngine(world);
      for (const index of route) {
        const [, dx, dy] = dirs[index];
        movement.applyDirectionalInput(dx, dy);
        stopAllAnimations(world);
      }
      visited++;
      const reached = target === "flip" ? world.cameraFlipH : target === "level" ? world.findPlayerBlock().outerLevel !== world.levels[0] : world.wentToInfZone;
      if (reached) { found = route.map(index => dirs[index][0]); break; }
      const key = world.blocks.map(block => `${world.levels.indexOf(block.outerLevel)},${block.x},${block.y},${block.flipH},${block.isPlayer}`).join(";");
      if (seen.has(key)) continue;
      seen.add(key);
      if (route.length < 24 && world.levels.length < 30 && !world.winning) {
        for (let index = 0; index < dirs.length; index++) queue.push([...route, index]);
      }
    }
    console.log(JSON.stringify({ name, target, visited, unique: seen.size, route: found, remaining: queue.length }));
  }
} finally {
  await server.close();
}
