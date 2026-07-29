const rawLevels = import.meta.glob<string>("../assets/levels/*.txt", {
  eager: true,
  import: "default",
  query: "?raw",
});

const levels = new Map<string, string>();
for (const [path, source] of Object.entries(rawLevels)) {
  const filename = path.split("/").at(-1);
  if (!filename) continue;
  levels.set(filename.replace(/\.txt$/i, ""), source);
}

export const levelNames = [...levels.keys()].sort((a, b) => a.localeCompare(b));

export function getLevelSource(levelName: string): string {
  const source = levels.get(levelName);
  if (!source) throw new Error(`Unknown level "${levelName}"`);
  return source;
}
