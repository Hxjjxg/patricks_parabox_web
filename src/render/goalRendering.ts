import type { HsvColor } from "../core/model";
import { guiHsvColor } from "./borderRendering";
import { originalDrawRect, type WallRect } from "./wallRendering";

const f = Math.fround;
function unityRound(value: number): number {
  const low = Math.floor(value);
  return value - low === 0.5 ? low + low % 2 : Math.round(value);
}

/** DrawButton receives physical-pixel float centers and dimensions. */
function nativeCell(rect: WallRect, resolution: number) {
  const width = f(rect.width * resolution), height = f(rect.height * resolution);
  const cx = f((rect.x + rect.width / 2) * resolution);
  const cy = f((rect.y + rect.height / 2) * resolution);
  return {width, height, cx, cy};
}
function snapped(rect: WallRect, resolution: number): WallRect {
  const r = originalDrawRect(rect, 1);
  return {x:r.x/resolution,y:r.y/resolution,width:r.width/resolution,height:r.height/resolution};
}

export function goalCellRect(rect: WallRect, resolution = 1): WallRect {
  const {width,height,cx,cy}=nativeCell(rect,resolution);
  return snapped({x:f(cx-f(width/2)),y:f(cy-f(height/2)),width,height},resolution);
}

/** Four disjoint FullWhite strips from native Draw.DrawButton. */
export function goalStrips(rect: WallRect, resolution = 1): WallRect[] {
  const {width,height,cx,cy}=nativeCell(rect,resolution);
  const ix=f(f(0.0664)*width), iy=f(f(0.0664)*height);
  const thickness=(size:number) => {
    const n=f(f(0.0725)*size);
    return unityRound(n<=1 && n>0.2 ? 1 : n);
  };
  const tx=thickness(width),ty=thickness(height);
  const left=f(f(cx-f(width/2))+ix),top=f(f(cy-f(height/2))+iy);
  const right=f(f(f(cx+f(width/2))-ix)-tx),bottom=f(f(f(cy+f(height/2))-iy)-ty);
  const innerWidth=f(width-f(ix*2)),innerHeight=f(height-f(iy*2));
  return [
    {x:left,y:top,width:innerWidth,height:ty},
    {x:left,y:bottom,width:innerWidth,height:ty},
    {x:left,y:f(top+ty),width:tx,height:f(innerHeight-f(ty*2))},
    {x:right,y:f(top+ty),width:tx,height:f(innerHeight-f(ty*2))},
  ].map(r=>snapped(r,resolution));
}

function quadOscillate(value:number):number {
  const phase=f(value-Math.floor(value));
  const triangle=phase<0.5 ? f(phase*2) : f(1-f(f(phase-0.5)*2));
  const k=f(triangle*2);
  return k<1 ? f(f(0.5*k)*k) : f(-0.5*f(f(f(k-1)*f(k-3))-1));
}

export function goalTint(
  exitColor:HsvColor,active:boolean,animationT:number,
  hubInactivePlayer=false,fractionOfScreen=1,delayFinishGlow=false,
):{color:number;alpha:number} {
  if(hubInactivePlayer){
    const scale=-0.4*Math.log(fractionOfScreen)/Math.log(20)+0.8;
    return {color:guiHsvColor({h:exitColor.h,s:exitColor.s,v:Math.max(exitColor.v,0.4)*scale*0.25}),alpha:1};
  }
  const alpha=active&&!delayFinishGlow
    ? f(f(0.2)+f(f(f(0.6)-f(0.2))*quadOscillate(f(f(animationT)+f(0.5)))))
    : f(0.6);
  return {color:guiHsvColor({h:exitColor.h,s:f(f(exitColor.s)*f(0.75)),v:1}),alpha};
}
