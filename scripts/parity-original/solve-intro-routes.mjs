// Derive capture setups from the existing pure movement model, then verify in native.
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('?raw')) return { url: new URL(specifier, context.parentURL).href, shortCircuit: true };
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(url)) return { url: url.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('?raw')) return { format: 'module', source: 'export default ' + JSON.stringify(readFileSync(new URL(url.slice(0, -4)), 'utf8')), shortCircuit: true };
    if (url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true };
    return nextLoad(url, context);
  },
});

const { parseLevel } = await import('../../src/core/levelParser.ts');
const { MovementEngine } = await import('../../src/core/movement.ts');
const directions = [['R', 1, 0], ['U', 0, 1], ['L', -1, 0], ['D', 0, -1]];
const vector = new Map(directions.map(([name, dx, dy]) => [name, [dx, dy]]));
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['second_puzzle', 'third_puzzle']) {
  const source = readFileSync(new URL('../../src/assets/levels/' + name + '.txt', import.meta.url), 'utf8');
  const queue = [''];
  const visited = new Set();
  let solution = null;
  let endpoint = null;
  for (let head = 0; head < queue.length && head < 100000; head++) {
    const route = queue[head];
    const world = parseLevel(source, name);
    const movement = new MovementEngine(world);
    let moved = true;
    for (const key of route) { const [dx, dy] = vector.get(key); moved = movement.applyDirectionalInput(dx, dy).moved; if (!moved) break; }
    if (!moved) continue;
    const state = world.blocks.map(block => [block.id, block.outerLevel?.id ?? -1, block.x, block.y, block.flipH, block.isPlayer]);
    const key = JSON.stringify(state);
    if (visited.has(key)) continue;
    visited.add(key);
    if (world.winning) { solution = route; endpoint = state; break; }
    for (const [key] of directions) queue.push(route + key);
  }
  console.log(JSON.stringify({ level: name, solution, uniqueStates: visited.size, queued: queue.length, endpoint }));
}
