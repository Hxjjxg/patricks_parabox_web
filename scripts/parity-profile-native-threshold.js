async () => {
 const state=window.__paraboxRenderProfile,r=state?.renderer;if(!r||r.world.levelName!=='infenter_zone_v2')throw new Error('Expected settled infenter_zone_v2 profiler renderer');state.restore();
 const p=Object.getPrototypeOf(r),saved={draw:p.draw,drawLevel:p.drawLevel,renderFrame:p.renderFrame},min=Math.max(1,Math.fround(Math.min(r.app.screen.width,r.app.screen.height)*Math.fround(.009))),draws=[],frames=[];let active=null;
 p.drawLevel=function(...a){if(active)active.total++;if(a[3].width<min&&a[3].height<min){if(active)active.rejected++;return a[0];}return saved.drawLevel.apply(this,a);};
 p.draw=function(...a){const row={start:performance.now(),total:0,rejected:0};active=row;try{return saved.draw.apply(this,a);}finally{row.ms=performance.now()-row.start;row.layers=this.sceneLayerCount;row.masks=this.maskPassCount;draws.push(row);active=null;}};
 p.renderFrame=function(...a){const start=performance.now();try{return saved.renderFrame.apply(this,a);}finally{frames.push(performance.now()-start);}};
 const raf=[],start=performance.now();let previous=start;try{await new Promise(resolve=>{const frame=now=>{raf.push(now-previous);previous=now;if(now-start>=1500)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);});}finally{Object.assign(p,saved);}
 const sorted=raf.slice(1).sort((a,b)=>a-b);return {experiment:'source exact infenter .009f short-edge threshold at drawLevel entry; originals restored',min,elapsed:performance.now()-start,raf:{count:raf.length,median:sorted[Math.floor(sorted.length/2)],max:Math.max(...sorted)},draws:draws.slice(-10),frames:frames.slice(-10),state:window.__PARABOX__.getState()};
}
