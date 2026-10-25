/** Draw.DrawBlocks initializes physical-pixel cutoffs before ProcessTicket. */
export interface NativeDrawPolicy {
 readonly minDrawSize:number;
 readonly minParticleSize:number;
 readonly maxDepthMovingBlocks:number;
 readonly suppressIiiEffects:boolean;
}
export function nativeDrawPolicy(levelName:string,width:number,height:number,resolution=1):NativeDrawPolicy{
 const f=Math.fround,short=f(Math.min(width,height)*resolution);
 let size=f(short*f(.0005)),particles=size,maxDepth=-1;
 if(levelName==='3by3_fun_clone_heist'){size=f(short*f(.013));particles=f(short*f(.01));maxDepth=2;}
 if(levelName==='infenter_zone_v2')size=f(short*f(.009));
 if(levelName==='iii'){size=f(short*f(.003));particles=size;}
 return {minDrawSize:Math.max(size,1)/resolution,minParticleSize:particles/resolution,
  maxDepthMovingBlocks:maxDepth,suppressIiiEffects:levelName==='iii'};
}
/** Native accepts a thin rectangle whenever either dimension reaches cutoff. */
export function meetsNativeDrawSize(width:number,height:number,minimum:number):boolean{
 return width>=minimum||height>=minimum;
}
