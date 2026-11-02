// Diagnostic only. Evaluate this async function in DevTools on the running game.
// Before invoking, set window.__PARITY_CORE_INPUT_OPTIONS__ = {
//   revision: '<full git SHA of the running checkout>', runId: '<unique suffix>',
//   // Optional: levels, caseIds, sink, expectedViewport, sourceHashes.
// };
// The function uses the normal controller, natural rAF, and DOM keyboard events.
// It does not replace clocks, call impulse/history APIs, or install game hooks.
async () => {
  const options = { levels: ['first_puzzle', 'second_puzzle', 'third_puzzle'],
    sink: 'http://127.0.0.1:4181', imageBudget: 48,
    ...window.__PARITY_CORE_INPUT_OPTIONS__ };
  const api = window.__PARABOX__;
  const canvas = document.querySelector('canvas');
  if (!api || !canvas) throw new Error('Web game/canvas is not ready');
  if (window.__parityFrameDriver) throw new Error('Controlled frame driver is installed: use a fresh natural-rAF tab');
  if (!/^[a-f0-9]{40}$/i.test(options.revision ?? '')) {
    throw new Error('Set __PARITY_CORE_INPUT_OPTIONS__.revision to the full running checkout git SHA');
  }
  if (window.__PARITY_CORE_INPUT_RUNNING__) throw new Error('A natural core input capture is already running');
  const runId = options.runId ?? new Date().toISOString().replace(/[^0-9]/g, '');
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error('runId must be a sink-safe unique suffix');
  const viewport = () => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
    canvasWidth: canvas.width, canvasHeight: canvas.height, visibility: document.visibilityState });
  if (document.visibilityState !== 'visible') throw new Error('Natural-rAF evidence requires a visible foreground page');
  if (options.expectedViewport) {
    const e = options.expectedViewport, actual = viewport();
    if (actual.width !== e.width || actual.height !== e.height || actual.dpr !== e.dpr ||
      actual.canvasWidth !== Math.round(e.width * e.dpr) || actual.canvasHeight !== Math.round(e.height * e.dpr)) {
      throw new Error('Viewport/backing dimensions differ from expectedViewport: ' + JSON.stringify(actual));
    }
  }
  const sink = options.sink.replace(/\/$/, '');
  const health = await fetch(sink + '/health').then(r => r.json());
  if (!health.ready) throw new Error('Capture sink is not ready');
  const keys = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' };
  const vectors = { L: [-1, 0], R: [1, 0], U: [0, 1], D: [0, -1] };
  const allKeys = [...Object.values(keys), 'z', 'x', 'r'];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const source = { revision: options.revision, revisionVerification: 'Caller declaration; compare source hashes against checkout independently',
    suppliedSourceHashes: options.sourceHashes ?? null, servedSourceHashes: {}, script: 'scripts/parity-core-input-natural.js' };
  // These are hashes of served responses, not a claim that fetched modules prove
  // the identity of every module already executing in this tab.
  for (const path of ['/src/GameController.ts', '/src/core/directionalInput.ts', '/src/core/historyInput.ts',
    '/src/core/inputQueue.ts', '/src/core/animation.ts', '/src/core/movement.ts', '/src/render/GameRenderer.ts']) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      if (response.headers.get('content-type')?.includes('text/html')) throw new Error('Server returned HTML fallback, not source');
      const body = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', body);
      source.servedSourceHashes[path] = { sha256: [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join(''),
        bytes: body.byteLength, contentType: response.headers.get('content-type'), url: response.url };
    } catch (error) { source.servedSourceHashes[path] = { error: String(error) }; }
  }
  let current = null, frameRequest = null, recorderError = null;
  const held = new Set();
  const summaries = [];
  const sample = timestamp => {
    const world = api.world(), p = world.findPlayerBlock(), state = api.getState();
    const block = b => ({ id: b.id, outer: world.levels.indexOf(b.outerLevel), outerId: b.outerLevel?.id ?? null,
      sub: world.levels.indexOf(b.subLevel), x: b.x, y: b.y, isPlayer: b.isPlayer, playerOrder: b.playerOrder,
      flipH: b.flipH, movedSinceRestart: b.movedSinceRestart, moving: b.moving, anim: b.anim,
      t: b.animT, length: b.animLength, ox: b.drawXOffset, oy: b.drawYOffset, sx: b.drawXScale, sy: b.drawYScale,
      smallBumpHalt: b.smallBumpHalt, drawNudgeHoriz: b.drawNudgeHoriz, drawIsPlayer: b.drawIsPlayer,
      faceT: b.faceAnimT, miscT: b.miscAnimT, lookT: b.lookAnimT });
    return { timestamp, sampledAt: performance.now(), action: current?.action ?? 'outside-case',
      levelName: world.levelName, moveCount: world.moveCount, winning: world.winning, mode: state.mode,
      transition: { active: world.transitioning ?? false, counter: world.transitionCounter ?? 0,
        length: world.transitionLength ?? 0, scene: world.transitionSceneName ?? null },
      debugState: state, session: state.session, settings: state.settings, inspection: state.inspection,
      moving: world.anyBlockMoving, wentToInfZone: world.wentToInfZone, cameraFlipH: world.cameraFlipH,
      worldFlags: { drawStyle: world.drawStyle, cameraMovedThisTurn: world.cameraMovedThisTurn,
        playerChanged: world.playerChanged, winning: world.winning, transitioning: world.transitioning },
      camera: { t: world.cameraAnimT, length: world.cameraAnimLength, phase: world.newCamT, moving: world.cameraMoving,
        x: world.newX, y: world.newY, xs: world.newXS, ys: world.newYS },
      pauseCamera: world.pauseCamera?.snapshot() ?? null,
      player: block(p), blocks: world.blocks.map(block), heldKeys: [...held],
      viewport: viewport() };
  };
  const structuralKey = frame => JSON.stringify([frame.levelName, frame.moveCount, frame.winning, frame.mode,
    frame.transition.active, frame.player.id, frame.player.outer, frame.player.x, frame.player.y,
    frame.player.anim, frame.moving, frame.blocks.map(b => [b.id, b.x, b.y, b.outer, b.isPlayer, b.flipH])]);
  const captureImage = (reason, frame) => {
    if (current.images.length >= options.imageBudget && reason !== 'case-end' && reason !== 'case-start') {
      current.droppedImages++; return;
    }
    const began = performance.now();
    const dataUrl = canvas.toDataURL('image/png');
    current.images.push({ name: 'frame-' + String(current.frames.length - 1).padStart(5, '0'),
      reason, timestamp: frame.timestamp, sampledAt: frame.sampledAt, frameIndex: current.frames.length - 1,
      motionId: frame.motionId, playerPhase: frame.playerPhase, dataUrl, readbackMs: performance.now() - began });
  };
  const record = timestamp => {
    frameRequest = null;
    if (!current) return;
    try {
      const frame = sample(timestamp);
      frame.frameIndex = current.frames.length;
      frame.rafDeltaMs = current.lastRaf === null ? null : timestamp - current.lastRaf;
      current.lastRaf = timestamp;
      const physical = [frame.player.id, frame.player.outer, frame.player.x, frame.player.y, frame.player.anim, frame.player.length].join(':');
      if (physical !== current.motionKey || frame.player.t < current.previousAnimT) current.motionId++;
      current.motionKey = physical;
      current.previousAnimT = frame.player.t;
      frame.motionId = current.motionId;
      const phase = frame.player.length > 0 ? frame.player.t / frame.player.length : 1;
      frame.playerPhase = phase;
      const stateKey = structuralKey(frame);
      let reason = stateKey !== current.lastStateKey ? 'state-change' : null;
      current.lastStateKey = stateKey;
      if (frame.action !== current.lastCapturedAction) reason ??= 'action';
      for (const target of [0.25, 0.5, 0.75, 1]) {
        const key = current.motionId + ':' + target;
        if (phase >= target && !current.capturedPhases.has(key)) {
          current.capturedPhases.add(key);
          reason ??= 'first-observed-motion-phase-' + target;
        }
      }
      if (timestamp - current.lastImageAt >= 400) reason ??= 'periodic';
      if (current.forceImage) { reason = current.forceImage; current.forceImage = null; }
      current.frames.push(frame);
      if (reason) {
        captureImage(reason, frame);
        current.lastImageAt = timestamp;
        current.lastCapturedAction = frame.action;
      }
      frame.recordingCostMs = performance.now() - frame.sampledAt;
    } catch (error) { recorderError = error; return; }
    frameRequest = requestAnimationFrame(record);
  };
  const keyEvent = (type, key, scheduledAt = null) => {
    const stateBeforeDispatch = current ? sample(performance.now()) : null;
    if (type === 'keydown') held.add(key); else held.delete(key);
    const timestamp = performance.now();
    const event = new KeyboardEvent(type, { key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key,
      bubbles: true, cancelable: true, repeat: false });
    window.dispatchEvent(event);
    if (current) current.events.push({ type, key, timestamp, scheduledAt, action: current.action, stateBeforeDispatch,
      dispatchLatenessMs: scheduledAt === null ? null : timestamp - scheduledAt,
      trusted: event.isTrusted, state: sample(performance.now()) });
  };
  const releaseControls = () => { for (const key of allKeys) keyEvent('keyup', key); };
  const waitFor = async (predicate, label, timeoutMs = 5000) => {
    const deadline = performance.now() + timeoutMs;
    while (!predicate()) {
      if (recorderError) throw recorderError;
      if (performance.now() > deadline) throw new Error('Timed out waiting for ' + label);
      await nextFrame();
    }
  };
  const settled = () => !api.world().blocks.some(b => b.moving) && !api.world().cameraMoving && api.world().newCamT >= 1;
  const settle = async () => { await nextFrame(); await waitFor(settled, 'settled movement/camera'); await nextFrame(); };
  const tap = async (key, duration = 40) => {
    keyEvent('keydown', key); await sleep(duration); keyEvent('keyup', key);
  };
  const actions = async sequence => {
    const start = performance.now();
    for (let index = 0; index < sequence.length; index++) {
      const event = sequence[index], target = start + event.at;
      await sleep(target - performance.now());
      current.action = event.label ?? ('event-' + index + '-' + event.key + '-' + event.type);
      keyEvent(event.type, event.key, target);
    }
  };
  const strokes = entries => entries.flatMap(([at, key, duration = 40]) => [
    { at, key, type: 'keydown' }, { at: at + duration, key, type: 'keyup' }]).sort((a, b) => a.at - b.at);
  const walk = async path => {
    for (const direction of path) {
      current.action = 'setup-walk-' + direction;
      await tap(keys[direction]); await settle();
    }
  };
  // A conservative same-level BFS only crosses empty, non-action floor. A
  // terminal block can still be pushable; the actual keyboard probe below is
  // what establishes a truly blocked candidate, never its appearance alone.
  const wallCandidates = () => {
    const p = api.world().findPlayerBlock(), level = p.outerLevel;
    if (!level) return [];
    const queue = [{ x: p.x, y: p.y, path: '' }], seen = new Set([p.x + ',' + p.y]), found = [];
    for (let i = 0; i < queue.length && i < 512; i++) {
      const tile = queue[i];
      for (const [direction, [dx, dy]] of Object.entries(vectors)) {
        const x = tile.x + dx, y = tile.y + dy;
        if (!level.inBounds(x, y)) continue;
        const b = level.getBlock(x, y), floor = level.getFloor(x, y);
        if (b && b !== p && !b.subLevel && !b.isPlayer) {
          found.push({ path: tile.path, direction, levelId: level.id, x: tile.x, y: tile.y, wall: { id: b.id, x, y, sub: null } });
        } else if ((!b || b === p) && (!floor || ['Button', 'PlayerButton', 'Info'].includes(floor.type))) {
          const key = x + ',' + y;
          if (!seen.has(key)) { seen.add(key); queue.push({ x, y, path: tile.path + direction }); }
        }
      }
    }
    return found;
  };
  const samePosition = (a, b) => a.id === b.id && a.outerId === b.outerId && a.x === b.x && a.y === b.y;
  const loadFresh = async level => {
    releaseControls();
    current.action = 'diagnostic-load-reset';
    current.events.push({ type: 'debug-loadLevel', level, timestamp: performance.now(), purpose: 'Case isolation only; all tested inputs are DOM events' });
    api.loadLevel(level);
    await settle();
    if (api.world().levelName !== level || api.getState().mode !== 'playing') {
      throw new Error('Requested level is not playing after reset: ' + JSON.stringify(api.getState()));
    }
  };
  const historySetup = async () => {
    // Use an immediately empty same-level step and its inverse, leaving two
    // history entries while returning to the initial logical position.
    const p = api.world().findPlayerBlock(), level = p.outerLevel;
    const direction = Object.keys(vectors).find(d => {
      const [dx, dy] = vectors[d], x = p.x + dx, y = p.y + dy;
      const floor = level?.getFloor(x, y);
      return level?.inBounds(x, y) && !level.getBlock(x, y) && (!floor || ['Button', 'PlayerButton', 'Info'].includes(floor.type));
    });
    if (!direction) { current.notes.push('No conservative empty neighbor found for history setup'); return false; }
    const inverse = { L: 'R', R: 'L', U: 'D', D: 'U' };
    await walk(direction + inverse[direction]);
    current.historySetup = { path: direction + inverse[direction], moveCount: api.world().moveCount };
    return api.world().moveCount >= 2;
  };
  const movementActive = () => api.world().anyBlockMoving || api.world().blocks.some(b => b.moving);
  const observeMovement = async label => {
    const deadline = performance.now() + 700;
    while (!movementActive()) {
      if (recorderError) throw recorderError;
      if (performance.now() > deadline) {
        current.status = 'unverified';
        current.notes.push('Movement predicate was not observed for ' + label + '; requested moving input was not dispatched');
        return false;
      }
      await nextFrame();
    }
    return true;
  };
  const movingHistoryTarget = async (key, action) => {
    current.action = action;
    current.requiredHistoryDispatches = [{ key, action, context: 'moving' }];
    if (!movementActive()) {
      current.status = 'unverified'; current.notes.push('Movement ended before target history dispatch ' + key); return;
    }
    const before = sample(performance.now());
    await tap(key);
    await nextFrame();
    const after = sample(performance.now());
    const expectedCountChange = key === 'x' ? after.moveCount > before.moveCount :
      key === 'z' ? after.moveCount < before.moveCount : after.moveCount === 0 && before.moveCount > 0;
    current.targetHistoryAttempt = { key, action, before, after, expectedCountChange,
      interpretation: 'Dispatch must be moving; moveCount change establishes a controller response, not native parity.' };
    if (!expectedCountChange) {
      current.status = 'unverified'; current.notes.push('Target history key did not produce its expected moveCount change');
    }
    await sleep(400);
  };
  const beginEmptySlide = async label => {
    const direction = current.historySetup?.path[0];
    if (!direction) { current.status = 'unverified'; current.notes.push('No verified history setup direction for slide'); return false; }
    current.action = label;
    keyEvent('keydown', keys[direction]);
    const observed = await observeMovement(label);
    keyEvent('keyup', keys[direction]);
    return observed;
  };
  const cases = [
    ...Object.keys(keys).map(d => ({ id: 'tap-' + d.toLowerCase(), category: 'cardinal-taps', run: async () => {
      current.action = 'tap-' + d; await tap(keys[d]); await sleep(450);
    } })),
    { id: 'held', category: 'held-direction', run: async () => {
      current.action = 'held-right'; await tap(keys.R, 1100); await sleep(350);
    } },
    { id: 'rapid', category: 'rapid-and-queue', run: async () => {
      await actions(strokes([[0, keys.R], [40, keys.U], [80, keys.L], [120, keys.D]])); await sleep(650);
    } },
    { id: 'alternating', category: 'rapid-and-queue', run: async () => {
      await actions(strokes([[0, keys.R], [40, keys.L], [80, keys.R], [120, keys.L], [320, keys.R]])); await sleep(550);
    } },
    { id: 'start-queue', category: 'rapid-and-queue', run: async () => {
      await actions(strokes([[0, keys.R], [40, keys.U]])); await sleep(600);
    } },
    { id: 'landing-queue', category: 'rapid-and-queue', run: async () => {
      current.action = 'landing-primary'; await tap(keys.R, 20);
      await waitFor(() => api.world().findPlayerBlock().moving, 'first move before landing');
      await waitFor(() => { const p = api.world().findPlayerBlock(); return p.animLength > 0 && p.animT / p.animLength >= 0.70; }, 'observed >=70% animation phase');
      current.landingDispatch = sample(performance.now());
      current.action = 'landing-queued-up'; await tap(keys.U, 40); await sleep(650);
      current.notes.push('Landing input is triggered by the first observed natural frame at >=70% phase; exact actual phase is retained');
    } },
    { id: 'blocked-release-repress-change', category: 'blocked-release-repress-change', run: async level => {
      const candidates = wallCandidates();
      let verified = null;
      for (const candidate of candidates.slice(0, 8)) {
        await loadFresh(level); await walk(candidate.path);
        const before = sample(performance.now());
        if (before.player.outerId !== candidate.levelId || before.player.x !== candidate.x || before.player.y !== candidate.y) continue;
        current.action = 'wall-probe-' + candidate.direction;
        const frameStart = current.frames.length;
        await tap(keys[candidate.direction], 90); await settle();
        const after = sample(performance.now());
        const probeFrames = current.frames.slice(frameStart);
        const bumpObserved = probeFrames.some(f => /bump/i.test(f.player.anim) || Math.abs(f.player.ox) > 0 || Math.abs(f.player.oy) > 0);
        current.wallProbes.push({ candidate, before: before.player, after: after.player,
          beforeMoveCount: before.moveCount, afterMoveCount: after.moveCount, bumpObserved });
        if (samePosition(before.player, after.player) && before.moveCount === after.moveCount && bumpObserved) { verified = candidate; break; }
      }
      if (!verified) { current.status = 'unverified'; current.notes.push('No terminal neighbor passed keyboard blocked-position + unchanged moveCount + bump verification'); return; }
      current.verifiedWall = verified;
      const blockedKey = keys[verified.direction];
      current.action = 'blocked-hold'; await tap(blockedKey, 750); await sleep(120);
      current.action = 'blocked-release-repress'; await tap(blockedKey); await sleep(170);
      const inverse = { L: 'R', R: 'L', U: 'D', D: 'U' }[verified.direction];
      current.action = 'blocked-direction-change-' + inverse; await tap(keys[inverse]); await sleep(450);
    } },
    { id: 'idle-history', category: 'idle-history', run: async () => {
      if (!await historySetup()) { current.status = 'unverified'; return; }
      current.requiredHistoryDispatches = ['z', 'x', 'r'].map(key => ({ key, context: 'idle' }));
      for (const key of ['z', 'x', 'r', 'z']) {
        await settle(); current.action = 'idle-history-' + key; await tap(key);
      }
      await sleep(400);
    } },
    { id: 'held-history', category: 'idle-history', run: async () => {
      if (!await historySetup()) { current.status = 'unverified'; return; }
      await actions(strokes([[0, 'z', 1800], [1900, 'x', 1800]])); await sleep(400);
    } },
    { id: 'moving-history', category: 'moving-history', run: async () => {
      if (!await historySetup()) { current.status = 'unverified'; return; }
      if (await beginEmptySlide('moving-undo-slide-start')) await movingHistoryTarget('z', 'moving-undo-target');
    } },
    { id: 'moving-redo', category: 'moving-history', run: async () => {
      if (!await historySetup()) { current.status = 'unverified'; return; }
      current.action = 'moving-redo-establish-future'; await tap('z'); await settle();
      current.action = 'moving-redo-start-undo-squish'; keyEvent('keydown', 'z');
      const observed = await observeMovement('second undo squish before moving redo');
      keyEvent('keyup', 'z');
      // Give normal HistoryInput one no-history frame to clear its cooldown.
      // Redo is then pressed during the still-observed undo animation.
      await nextFrame();
      if (observed) await movingHistoryTarget('x', 'moving-redo-target');
    } },
    { id: 'moving-restart', category: 'moving-history', run: async () => {
      if (!await historySetup()) { current.status = 'unverified'; return; }
      if (await beginEmptySlide('moving-restart-slide-start')) await movingHistoryTarget('r', 'moving-restart-target');
    } },
    { id: 'win-transition', category: 'win-transition', run: async () => {
      current.status = 'unverified'; current.action = 'win-transition-unverified';
      current.notes.push('No proven winning route is installed in this harness. Baseline only; no claim of win/transition coverage.'); await nextFrame();
    } },
    { id: 'natural-variable-frames', category: 'variable-long-frames', run: async () => {
      current.action = 'natural-frame-sampling-held-right'; await tap(keys.R, 1200); await sleep(350);
      current.notes.push('No clock override or intentional load; natural frame variability is measured, not guaranteed to include a long frame. PNG readback/sampling costs are retained.');
    } },
    { id: 'intentional-main-thread-stall', category: 'variable-long-frames', timingKind: 'intentional-main-thread-stall', run: async () => {
      current.action = 'stall-move-start'; keyEvent('keydown', keys.R); await nextFrame();
      const before = performance.now();
      current.action = 'intentional-main-thread-stall';
      // Explicit diagnostic load, NOT a natural frame pacing result.
      while (performance.now() - before < 180) { /* intentional busy interval */ }
      current.stall = { began: before, ended: performance.now(), requestedMs: 180, kind: 'intentional-main-thread-stall' };
      await nextFrame(); keyEvent('keyup', keys.R); await sleep(550);
    } },
  ];
  const selected = options.caseIds ? cases.filter(c => options.caseIds.includes(c.id)) : cases;
  if (options.caseIds?.some(id => !cases.some(c => c.id === id))) throw new Error('Unknown caseIds');
  const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] : null;
  window.__PARITY_CORE_INPUT_RUNNING__ = true;
  window.__PARITY_CORE_INPUT_RESULTS__ = { runId, source, sinkHealth: health, summaries };
  const visibilityEvents = [];
  const onVisibility = () => visibilityEvents.push({ timestamp: performance.now(), state: document.visibilityState });
  document.addEventListener('visibilitychange', onVisibility);
  try {
    releaseControls();
    for (const level of options.levels) {
      for (const definition of selected) {
        current = { schema: 'parabox-natural-core-input-v1', runId, caseId: definition.id, category: definition.category,
          level, source, status: 'captured', timingKind: definition.timingKind ?? 'natural-raf',
          recordedAt: new Date().toISOString(), viewport: viewport(), frames: [], events: [], images: [], notes: [], wallProbes: [],
          action: 'case-reset', lastRaf: null, lastImageAt: -Infinity, motionKey: null, motionId: 0,
          previousAnimT: Infinity, lastStateKey: null, lastCapturedAction: null, capturedPhases: new Set(), droppedImages: 0 };
        recorderError = null;
        // The application already has its next rAF registered. This recorder
        // joins after it and re-registers after it on subsequent frames, so
        // state/readback follow the normal controller update and render.
        frameRequest = requestAnimationFrame(record);
        try {
          await loadFresh(level);
          current.action = 'case-start'; current.forceImage = 'case-start';
          await nextFrame(); current.starting = sample(performance.now());
          await definition.run(level);
          releaseControls(); await settle();
          if (recorderError) throw recorderError;
          current.action = 'case-end'; current.forceImage = 'case-end';
          await nextFrame(); current.ending = sample(performance.now());
        } catch (error) {
          current.status = 'error'; current.error = { message: String(error), stack: error?.stack ?? null };
          releaseControls();
          try { current.ending = sample(performance.now()); } catch (_) { /* preserve partial report */ }
        } finally {
          if (frameRequest !== null) cancelAnimationFrame(frameRequest);
          frameRequest = null;
        }
        const deltas = current.frames.map(f => f.rafDeltaMs).filter(Number.isFinite).sort((a, b) => a - b);
        current.timing = { frameCount: current.frames.length, minRafMs: deltas[0] ?? null,
          medianRafMs: quantile(deltas, .5), p95RafMs: quantile(deltas, .95), maxRafMs: deltas.at(-1) ?? null,
          above25Ms: deltas.filter(v => v > 25).length, above50Ms: deltas.filter(v => v > 50).length,
          maxRecordingCostMs: Math.max(0, ...current.frames.map(f => f.recordingCostMs ?? 0)),
          maxReadbackMs: Math.max(0, ...current.images.map(i => i.readbackMs)),
          scope: 'Includes case reset/setup; frame.action identifies the timed scenario.' };
        current.visibilityEvents = [...visibilityEvents];
        const eventSummary = event => ({ timestamp: event.timestamp, key: event.key, action: event.action, moveCount: event.state.moveCount,
          worldMoving: event.state.moving, playerMoving: event.state.player.moving,
          animation: event.state.player.anim, phase: event.state.player.length > 0 ? event.state.player.t / event.state.player.length : 1,
          mode: event.state.mode, levelName: event.state.levelName });
        const historyEvents = current.events.filter(e => e.type === 'keydown' && ['z', 'x', 'r'].includes(e.key));
        current.coverage = { syntheticKeydownCount: current.events.filter(e => e.type === 'keydown').length,
          historyDispatches: historyEvents.map(eventSummary),
          historyByKey: Object.fromEntries(['z', 'x', 'r'].map(key => [key, {
            idle: historyEvents.some(e => e.key === key && !e.state.moving && !e.state.player.moving),
            moving: historyEvents.some(e => e.key === key && (e.state.moving || e.state.player.moving)),
            dispatches: historyEvents.filter(e => e.key === key).map(eventSummary),
          }])),
          idleHistoryDispatchObserved: historyEvents.some(e => !e.state.moving && !e.state.player.moving),
          movingHistoryDispatchObserved: historyEvents.some(e => e.state.moving || e.state.player.moving),
          winObserved: current.frames.some(f => f.winning), transitionObserved: current.frames.some(f => f.transition.active),
          blockedWallVerified: !!current.verifiedWall,
          motionPhases: [...new Set(current.images.filter(i => i.reason.startsWith('first-observed-motion-phase-')).map(i => i.reason))] };
        current.coverage.requiredHistoryDispatches = (current.requiredHistoryDispatches ?? []).map(required => ({ ...required,
          observed: historyEvents.some(e => e.key === required.key && (!required.action || e.action === required.action) &&
            (required.context === 'moving' ? (e.state.moving || e.state.player.moving) : (!e.state.moving && !e.state.player.moving))) }));
        if (current.coverage.requiredHistoryDispatches.some(required => !required.observed) && current.status === 'captured') {
          current.status = 'unverified'; current.notes.push('A required history key/context pair was not observed; see coverage.requiredHistoryDispatches');
        }
        if (definition.id === 'idle-history' && historyEvents.some(e => e.state.moving || e.state.player.moving) && current.status === 'captured') {
          current.status = 'unverified'; current.notes.push('An intended idle history keydown occurred during movement; inspect dispatch snapshots');
        }
        if (current.frames.some(f => f.viewport.visibility !== 'visible')) {
          current.notes.push('Page was hidden for one or more recorded frames; timing is not foreground-only');
          if (current.status === 'captured') current.status = 'captured-with-visibility-limitation';
        }
        current.limitations = [
          'Synthetic untrusted DOM keyboard events exercise the controller; physical OS key delivery is not tested.',
          'Natural rAF timestamps and actual dispatch times are retained; timer scheduling has no exact 40ms guarantee.',
          'Snapshots are the first observed rendered frames past phase thresholds, not interpolated phase renders.',
          'Sampling and Canvas PNG readback add measured main-thread overhead.',
          'Debug loadLevel is used only for case isolation and wall-probe resets.',
          'No native-game comparison is performed by this capture script.',
          'Revision is caller-declared; served module hashes are recorded separately and do not prove runtime cache identity.',
        ];
        delete current.lastRaf; delete current.lastImageAt; delete current.motionKey; delete current.previousAnimT;
        delete current.lastStateKey; delete current.lastCapturedAction; delete current.capturedPhases;
        const name = [level, 'natural-core', definition.id, runId].join('-');
        window.__PARITY_CORE_INPUT_LAST_REPORT__ = current;
        const response = await fetch(sink + '/capture/' + name, { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
        const result = await response.json();
        if (!response.ok) throw new Error('Capture POST failed (' + response.status + '): ' + JSON.stringify(result));
        summaries.push({ level, caseId: definition.id, category: definition.category, status: current.status,
          timingKind: current.timingKind, timing: current.timing, wall: current.verifiedWall ?? null,
          error: current.error ?? null, sink: result });
        current = null;
      }
    }
    return window.__PARITY_CORE_INPUT_RESULTS__;
  } finally {
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    releaseControls(); current = null;
    document.removeEventListener('visibilitychange', onVisibility);
    window.__PARITY_CORE_INPUT_RUNNING__ = false;
  }
}
