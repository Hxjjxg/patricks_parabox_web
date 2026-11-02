// Diagnostic only. Evaluate this async function in a fresh isolated page.
// It uses a proven first_puzzle route and holds Up through the automatic win load.
async () => {
  const api = window.__PARABOX__, canvas = document.querySelector('canvas');
  if (!api || !canvas) throw new Error('Web game/canvas is not ready');
  if (window.__PARITY_WIN_TRANSITION_RUNNING__) throw new Error('Transition capture already running');
  const options = { sink:'http://127.0.0.1:4181', runId:'20261102-first-win-held',
    revision:'82593337f4fbb5b68f52f9004ee7f0b4bd49c52b', ...window.__PARITY_WIN_TRANSITION_OPTIONS__ };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const keys = { U:'ArrowUp', R:'ArrowRight', D:'ArrowDown', L:'ArrowLeft' };
  const held = new Set(), frames = [], images = [], events = [];
  const viewport = () => ({ width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
    canvasWidth:canvas.width,canvasHeight:canvas.height,visibility:document.visibilityState });
  const sample = timestamp => {
    const world = api.world(), player = world.findPlayerBlock(), state = api.getState();
    return { timestamp, levelName:world.levelName, moveCount:world.moveCount, winning:world.winning,
      transitioning:world.transitioning ?? false, transitionCounter:world.transitionCounter ?? 0,
      transitionLength:world.transitionLength ?? 0, transitionSceneName:world.transitionSceneName ?? null,
      mode:state.mode, heldKeys:[...held], moving:world.anyBlockMoving,
      camera:{t:world.cameraAnimT,phase:world.newCamT,moving:world.cameraMoving,x:world.newX,y:world.newY,xs:world.newXS,ys:world.newYS},
      player:{id:player.id,x:player.x,y:player.y,outer:world.levels.indexOf(player.outerLevel),
        anim:player.anim,t:player.animT,length:player.animLength,moving:player.moving}, viewport:viewport() };
  };
  const event = (type,key) => {
    const e = new KeyboardEvent(type,{key,code:key,bubbles:true,cancelable:true,repeat:false});
    if (type==='keydown') held.add(key); else held.delete(key);
    window.dispatchEvent(e); events.push({type,key,timestamp:performance.now(),trusted:e.isTrusted,state:sample(performance.now())});
  };
  const release = () => { for (const key of [...held]) event('keyup',key); };
  let active = false, raf = null, lastLevel = null, lastState = null, lastImage = 0;
  const capture = (reason, frame) => {
    images.push({name:'frame-'+String(frames.length-1).padStart(5,'0'),reason,
      frameIndex:frames.length-1,timestamp:frame.timestamp,dataUrl:canvas.toDataURL('image/png')});
    lastImage=frame.timestamp;
  };
  const record = timestamp => {
    raf=null; if (!active) return;
    const frame=sample(timestamp); frame.frameIndex=frames.length;
    frame.rafDeltaMs=frames.length?timestamp-frames.at(-1).timestamp:null;
    const stateKey=JSON.stringify([frame.levelName,frame.moveCount,frame.winning,frame.transitioning,
      frame.player.id,frame.player.x,frame.player.y,frame.player.outer,frame.player.anim,frame.moving]);
    let reason=stateKey!==lastState?'state-change':null; lastState=stateKey;
    if (frame.levelName!==lastLevel) { reason='level-transition'; lastLevel=frame.levelName; }
    if (timestamp-lastImage>=200) reason??='periodic';
    frames.push(frame); if (reason) capture(reason,frame);
    raf=requestAnimationFrame(record);
  };
  const save=async report=>{
    window.__PARITY_WIN_TRANSITION_REPORT__=report;
    const r=await fetch(options.sink+'/capture/'+options.runId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
    const body=await r.json(); if(!r.ok)throw new Error(JSON.stringify(body)); return body;
  };
  window.__PARITY_WIN_TRANSITION_RUNNING__=true;
  try {
    release();
    if (document.visibilityState!=='visible') throw new Error('Page must remain visible');
    api.loadLevel('first_puzzle');
    while (api.world().blocks.some(b=>b.moving)||api.world().cameraMoving||api.world().newCamT<1) await nextFrame();
    active=true; raf=requestAnimationFrame(record);
    const start=sample(performance.now()); capture('fresh-start',start);
    const setup='UURRRDDULLLLU';
    for (const d of setup) {
      event('keydown',keys[d]); await sleep(40); event('keyup',keys[d]);
      while (api.world().blocks.some(b=>b.moving)||api.world().cameraMoving||api.world().newCamT<1) await nextFrame();
      await nextFrame();
    }
    const beforeHold=sample(performance.now());
    event('keydown',keys.U);
    await sleep(2300);
    const heldEnd=sample(performance.now());
    event('keyup',keys.U);
    await sleep(800); await nextFrame();
    const ending=sample(performance.now());
    active=false; if(raf!==null)cancelAnimationFrame(raf); raf=null;
    capture('capture-end',ending);
    const deltas=frames.map(f=>f.rafDeltaMs).filter(Number.isFinite).sort((a,b)=>a-b);
    const report={schema:'parabox-natural-win-transition-v1',options,recordedAt:new Date().toISOString(),
      viewport:viewport(),inputMethod:'Synthetic untrusted DOM keyboard events; normal controller and natural rAF',
      setup,beforeHold,events,frames,images,heldEnd,ending,
      result:{won:frames.some(f=>f.winning),transitioned:frames.some(f=>f.levelName==='second_puzzle'),
        heldAtTransition:frames.some(f=>f.levelName==='second_puzzle'&&f.heldKeys.includes(keys.U)),
        postTransitionAccepted:frames.some(f=>f.levelName==='second_puzzle'&&f.moveCount>0),
        firstLevelEnding:frames.filter(f=>f.levelName==='first_puzzle').at(-1)??null,
        secondLevelStart:frames.find(f=>f.levelName==='second_puzzle')??null},
      timing:{count:deltas.length,median:deltas[Math.floor(deltas.length*.5)]??null,
        p95:deltas[Math.floor(deltas.length*.95)]??null,max:deltas.at(-1)??null,
        limitation:'Canvas PNG readback, setup, DOM scheduling and transition render are included; not a performance pass'},
      limitation:'No original capture or physical keyboard delivery; does not establish native transition parity.'};
    return {saved:await save(report),result:report.result,timing:report.timing,viewport:report.viewport};
  } finally {
    release(); active=false; if(raf!==null)cancelAnimationFrame(raf); raf=null;
    window.__PARITY_WIN_TRANSITION_RUNNING__=false;
  }
}
