// Diagnostic only: real controller win/return route, unchanged timing and rendering.
// Substitute PARITY_OPTIONS. No transient game state or clocks are injected.
async () => {
  const options = PARITY_OPTIONS, api = window.__PARABOX__, canvas = document.querySelector('canvas');
  if (!api || !canvas) throw Error('Game not ready');
  const expected = options.expectedViewport;
  if (innerWidth !== expected.width || innerHeight !== expected.height || canvas.width !== expected.width * expected.dpr
    || canvas.height !== expected.height * expected.dpr) throw Error('Viewport mismatch');
  const next = () => new Promise(resolve => requestAnimationFrame(resolve));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const sample = timestamp => {
    const w = api.world(), p = w.findPlayerBlock();
    return {timestamp, levelName: w.levelName, moveCount: w.moveCount, mode: api.getState().mode,
      player: {id:p.id, x:p.x, y:p.y, outer:p.outerLevel?.id, anim:p.anim, t:p.animT, length:p.animLength},
      camera: {phase:w.newCamT, x:w.newX, y:w.newY, xs:w.newXS, ys:w.newYS},
      counting:w.hubCounting, unlocking:w.hubUnlocking, celebration:{...w.hubCelebration},
      celebrationLevel:w.hubCelebrationLevel?.hubAreaName ?? null, celebrationNumLevels:w.hubCelebrationNumLevels,
      walls:w.blocks.filter(b=>b.hubCaptionState).map(b=>({id:b.id, area:b.outerLevel.hubAreaName, x:b.x,y:b.y,
        routeOpen:b.hubShortcutOpen, ...b.hubCaptionState})),
      portals:w.floors.filter(f=>f.sceneName && f.outerLevel.hubAreaName==='Area_Intro').map(f=>({scene:f.sceneName,
        won:f.won,unlocked:f.unlocked,hard:f.hard,...f.hubCelebration})),
      edgeParticles:w.levels.filter(l=>l.hubAreaName==='Area_Intro').flatMap(l=>l.particles.filter(p=>p.celebration).map(p=>({...p}))),
    };
  };
  api.loadLevel('hub'); await sleep(100); // Establish first-load animation history naturally.
  const initialHub = sample(performance.now());
  // Empty saves are deliberately not persisted; a real Hub move records RecentArea.
  const areaStep = api.impulse(1, 0);
  if (!areaStep.moved || api.world().levelName !== 'hub') throw Error('Hub area setup step rejected');
  while (api.world().anyBlockMoving || api.world().cameraMoving) await next();
  const areaSetup = sample(performance.now());
  api.loadLevel('third_puzzle');
  const setup = 'RUUURDDDLDRRDRRULLLLULLDDRUUULUR'.slice(0, -1);
  const vectors = {L:[-1,0],R:[1,0],U:[0,1],D:[0,-1]};
  const setupTimings = [];
  for (const letter of setup) {
    const began = performance.now(), v=vectors[letter]; api.impulse(v[0],v[1]);
    const deadline = performance.now()+10000;
    while (api.world().anyBlockMoving || api.world().cameraMoving) {
      if (performance.now()>deadline) throw Error('Setup did not settle'); await next();
    }
    setupTimings.push({letter,began,ended:performance.now(),state:sample(performance.now())});
  }
  if (api.getState().moveCount!==31 || api.world().winning) throw Error('Pre-win route mismatch');
  const frames=[], images=[], events=[]; let active=true, hubStarted=null, lastImage=-Infinity;
  const record = timestamp => {
    if (!active) return; const frame=sample(timestamp);
    if(frame.levelName==='hub' && hubStarted===null) hubStarted=performance.now();
    frame.hubElapsed=hubStarted===null?null:performance.now()-hubStarted; frames.push(frame);
    if(timestamp-lastImage>=options.captureEveryMs || frames.length===1) {
      images.push({name:'sample-'+String(frames.length-1).padStart(4,'0'),timestamp,frameIndex:frames.length-1,dataUrl:canvas.toDataURL('image/png')}); lastImage=timestamp;
    }
    requestAnimationFrame(record);
  };
  requestAnimationFrame(record);
  const key=(type,key)=>{window.dispatchEvent(new KeyboardEvent(type,{key,code:key,bubbles:true}));events.push({type,key,timestamp:performance.now(),state:sample(performance.now())});};
  key('keydown','ArrowRight'); await sleep(40); key('keyup','ArrowRight');
  const deadline=performance.now()+20000;
  while(hubStarted===null) {if(performance.now()>deadline)throw Error('Win failed to return Hub');await next();}
  if(options.pauseAtHubMs!==undefined) {
    while(performance.now()-hubStarted<options.pauseAtHubMs)await next();
    key('keydown','Escape');await sleep(30);key('keyup','Escape');
    await sleep(options.pauseDurationMs);
    key('keydown','Escape');await sleep(30);key('keyup','Escape');
  }
  while(performance.now()-hubStarted<options.durationMs)await next();
  active=false;
  const report={options,recordedAt:new Date().toISOString(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvasWidth:canvas.width,canvasHeight:canvas.height},
    initialHub,areaSetup,setupTimings,events,frames,images,starting:frames[0],ending:sample(performance.now()),provenance:options.provenance};
  window.__HUB_LIFECYCLE_REPORT__=report;
  const response=await fetch(options.sinkUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
  const saved=await response.json();if(!response.ok)throw Error(JSON.stringify(saved));return {saved,starting:report.starting,ending:report.ending};
}
