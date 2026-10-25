// Diagnostic only. Substitute the original capture function, sink URL and metadata.
// The capture function/options are unchanged; only report persistence differs.
async () => {
  const report = await (PARITY_CAPTURE_FUNCTION)();
  const world = window.__PARABOX__.world();
  world.computeBlockLists();
  world.updateButtonsPressed();
  report.structuralEnding = {
    levelName: world.levelName, moveCount: world.moveCount, winning: world.winning,
    buttonsSatisfied: world.buttonsSatisfied, finishesSatisfied: world.finishesSatisfied,
    wentToInfZone: world.wentToInfZone,
    blocks: world.blocks.map((block, index) => ({
      index, outer: block.outerLevel ? world.levels.indexOf(block.outerLevel) : -1,
      sub: block.subLevel ? world.levels.indexOf(block.subLevel) : -1,
      x: block.x, y: block.y, isPlayer: block.isPlayer, playerOrder: block.playerOrder,
      flipH: block.flipH, movedSinceRestart: block.movedSinceRestart,
    })),
  };
  report.provenance = PARITY_RUN_METADATA;
  // Retain the raw report if transport fails; no browser input needs repeating.
  window.__PARITY_CAPTURE_REPORT__ = report;
  const response = await fetch(PARITY_SINK_URL, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(report),
  });
  const saved = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(saved));
  return {saved, starting: report.starting, ending: report.ending};
}
