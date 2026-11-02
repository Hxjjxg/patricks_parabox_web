import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? "docs/parity/evidence/core-gameplay-final-20261102";
const revision = "4acd2a039727168141299990c5bb046c6068bafa";
const entries = await readdir(root, { withFileTypes: true });
const directories = entries.filter(entry => entry.isDirectory()
  && /-natural-core-.+-backing1-20261102-[abc]$/.test(entry.name));
const errors = [];
const cases = [];
let manifestFiles = 0;
let pngCount = 0;

for (const entry of directories) {
  const directory = join(root, entry.name);
  const trace = JSON.parse(await readFile(join(directory, "trace.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(directory, "sha256.json"), "utf8"));
  if (trace.source.revision !== revision) errors.push(`${entry.name}: source revision`);
  if (trace.viewport.width !== 800 || trace.viewport.height !== 600
      || trace.viewport.canvasWidth !== 800 || trace.viewport.canvasHeight !== 600) {
    errors.push(`${entry.name}: viewport/backing`);
  }

  for (const [name, expected] of Object.entries(manifest)) {
    const bytes = await readFile(join(directory, name));
    const actual = createHash("sha256").update(bytes).digest("hex");
    manifestFiles++;
    if (actual !== expected) errors.push(`${entry.name}/${name}: SHA256`);
    if (!name.endsWith(".png")) continue;
    pngCount++;
    if (bytes.readUInt32BE(16) !== 800 || bytes.readUInt32BE(20) !== 600) {
      errors.push(`${entry.name}/${name}: PNG dimensions`);
    }
  }

  cases.push({ level: trace.level, caseId: trace.caseId, status: trace.status,
    frames: trace.frames.length, pngs: trace.images.length,
    maxRafMs: trace.timing.maxRafMs,
    requiredHistoryMisses: (trace.coverage.requiredHistoryDispatches ?? [])
      .filter(item => !item.observed).length });
}

const summary = {
  revision,
  directories: directories.length,
  manifestFiles,
  pngCount,
  casesByLevel: Object.fromEntries(["first_puzzle", "second_puzzle", "third_puzzle"].map(level => {
    const rows = cases.filter(item => item.level === level);
    return [level, { cases: rows.length, captured: rows.filter(item => item.status === "captured").length,
      unverified: rows.filter(item => item.status === "unverified").map(item => item.caseId),
      frames: rows.reduce((sum, item) => sum + item.frames, 0),
      pngs: rows.reduce((sum, item) => sum + item.pngs, 0),
      historyDispatchMisses: rows.reduce((sum, item) => sum + item.requiredHistoryMisses, 0) }];
  })),
  errors,
};
console.log(JSON.stringify(summary, null, 2));
if (directories.length !== 54 || errors.length) process.exitCode = 1;
