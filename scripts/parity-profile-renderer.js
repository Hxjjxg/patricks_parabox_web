async () => {
  window.__paraboxRenderProfile?.restore?.();
  const resources = performance.getEntriesByType("resource")
    .filter(entry => new URL(entry.name).pathname === "/src/render/GameRenderer.ts")
    .sort((a,b) => Number(new URL(b.name).searchParams.get("t") || 0) - Number(new URL(a.name).searchParams.get("t") || 0));
  const moduleUrl = resources[0]?.name || "/src/render/GameRenderer.ts";
  const { GameRenderer } = await import(moduleUrl);
  const p = GameRenderer.prototype;
  const state = { draws: [], frames: [], active: null, originals: {}, renderer: null };
  const hooks = ["draw", "renderFrame", "drawLevel", "drawWall", "drawFace", "drawInfEffect", "drawFlipShine", "maskedScene"];
  for (const key of hooks) state.originals[key] = p[key];
  state.restore = () => { for (const key of hooks) p[key] = state.originals[key]; state.active = null; return { draws: state.draws.length, frames: state.frames.length }; };
  for (const key of hooks.filter(k => k !== "draw" && k !== "renderFrame")) p[key] = function (...args) {
    const row = state.active;
    if (row) {
      row.counts[key] = (row.counts[key] || 0) + 1;
      if (key === "drawLevel") { const id=args[1].id; row.levels[id]=(row.levels[id]||0)+1; }
      if (key === "drawFlipShine" && !row.shines[args[1].id]) {
        const b=args[1]; row.shines[b.id]={misc:b.miscAnimT,flip:b.flipH,fade:b.fadeFlipH,anim:b.anim,t:b.animT,length:b.animLength,ticketFlip:args[3],depth:args[4]};
      }
    }
    return state.originals[key].apply(this,args);
  };
  p.draw = function (...args) {
    if (state.draws.length >= 300) return state.originals.draw.apply(this,args);
    state.renderer=this;
    const w=this.world,b=w?.findPlayerBlock();
    const row={at:performance.now(),counts:{},levels:{},shines:{},level:w?.levelName,player:b?{id:b.id,t:b.animT,length:b.animLength,anim:b.anim,misc:b.miscAnimT}:null,camera:w?{t:w.cameraAnimT,length:w.cameraAnimLength,phase:w.newCamT,flip:w.cameraFlipH}:null,previews:w?.infExitPreviews.map(v=>v.exitBlocks.map(b=>b.id))};
    state.active=row;
    try { return state.originals.draw.apply(this,args); }
    finally { row.ms=performance.now()-row.at;row.layers=this.sceneLayerCount;row.masks=this.maskPassCount;row.shadows=this.shadowTextureCount;state.draws.push(row);state.active=null; }
  };
  p.renderFrame = function (...args) {
    const start=performance.now(),drawStart=state.draws.length;
    try { return state.originals.renderFrame.apply(this,args); }
    finally { if(state.frames.length<300)state.frames.push({at:start,ms:performance.now()-start,draws:state.draws.length-drawStart}); }
  };
  window.__paraboxRenderProfile=state;
  return {installed:true,moduleUrl,methods:hooks,read:"window.__paraboxRenderProfile draws/frames",restore:"window.__paraboxRenderProfile.restore()"};
}
