/** Native observed Mono arithmetic keeps the float constant in a double product. */
export function nativeFocusRect(
  width: number, height: number, xScale: number, yScale: number,
  xOffset: number, yOffset: number, fraction = 0.82,
): { x: number; y: number; width: number; height: number } {
  const base = Math.min(width, height) * Math.fround(fraction);
  const boardWidth = base * xScale;
  const boardHeight = base * yScale;
  return {
    x: Math.trunc(width / 2) + xOffset * boardWidth - boardWidth / 2,
    y: Math.trunc(height / 2) + yOffset * boardHeight - boardHeight / 2,
    width: boardWidth, height: boardHeight,
  };
}

/** Chromium emulation can report1.0000000298 for a one-pixel device scale. */
export function pixelResolution(value: number): number {
  const integer = Math.round(value);
  return Math.abs(value - integer) < 1e-6 ? integer : value;
}

/** QUICK uses .105 focus and applies player squash after locating its center. */
export function quickAnimFocusRect(width:number,height:number,xScale:number,yScale:number,
 xOffset:number,yOffset:number,drawXScale:number,drawYScale:number):ReturnType<typeof nativeFocusRect>{
 const rect=nativeFocusRect(width,height,xScale,yScale,xOffset,yOffset,.105);
 const w=rect.width*drawXScale,h=rect.height*drawYScale;
 return {x:rect.x+rect.width/2-w/2,y:rect.y+rect.height/2-h/2,width:w,height:h};
}
