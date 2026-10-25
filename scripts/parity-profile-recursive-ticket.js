async () => {
  const state=window.__paraboxRenderProfile,renderer=state?.renderer;
  if(!renderer)throw new Error('Install parity-profile-renderer.js first');
  state.restore();
  const p=Object.getPrototypeOf(renderer),original=p.drawLevel,depths={},samples=[],levels={};
  p.drawLevel=function(...args){const level=args[1],rect=args[3],depth=args[4],clip=this.currentTicket?.clip;levels[level.id]=(levels[level.id]||0)+1;if(level.id===4){const row=depths[depth]??={count:0,minWidth:Infinity,maxWidth:0,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,clipped:0};row.count++;row.minWidth=Math.min(row.minWidth,rect.width);row.maxWidth=Math.max(row.maxWidth,rect.width);row.minX=Math.min(row.minX,rect.x);row.maxX=Math.max(row.maxX,rect.x+rect.width);row.minY=Math.min(row.minY,rect.y);row.maxY=Math.max(row.maxY,rect.y+rect.height);if(clip)row.clipped++;if(samples.length<20)samples.push({block:args[2].id,depth,rect:{...rect},staticRect:args[7],clip:clip?{...clip}:null,dimensions:[level.width,level.height]});}return original.apply(this,args);};
  const start=performance.now();try{renderer.draw();}finally{p.drawLevel=original;}
  const world=renderer.world,player=world.findPlayerBlock(),level=world.levels.find(l=>l.id===4);
  return {at:new Date().toISOString(),page:location.href,screen:[innerWidth,innerHeight,devicePixelRatio],ms:performance.now()-start,player:{id:player.id,x:player.x,y:player.y,outer:player.outerLevel?.id},focus:{rect:renderer.inspectionBoard?.rect,block:renderer.inspectionBoard?.viewBlock.id},worldCamera:{newCamT:world.newCamT,newX:world.newX,newY:world.newY,newXS:world.newXS,newYS:world.newYS,usedX:world.usedX,usedY:world.usedY,usedXS:world.usedXS,usedYS:world.usedYS},levels,depths,samples,recursiveLevel:{width:level.width,height:level.height,blocks:level.blockList.map(b=>({id:b.id,x:b.x,y:b.y,sub:b.subLevel?.id,drawXS:b.drawXScale,drawYS:b.drawYScale,drawX:b.drawXOffset,drawY:b.drawYOffset}))}};
}
