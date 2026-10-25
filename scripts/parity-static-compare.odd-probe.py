"""Compare the additional actual2002x1398 odd-axis probe without image fitting."""
from __future__ import annotations
import argparse
import importlib.util
import json
import math
from collections import Counter
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('border_diagnostics',Path(__file__).with_name('parity-static-compare.borders.py'))
B=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(B);CMP=B.CMP

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-dir',type=Path,required=True)
    parser.add_argument('--native-dir',type=Path,default=CMP.EVIDENCE/'original/native-framebuffer-2002x1398-first-puzzle-v15-20261025')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--require-exact',action='store_true')
    args=parser.parse_args()
    native_dir=(CMP.PROJECT/args.native_dir).resolve();web_dir=(CMP.PROJECT/args.web_dir).resolve()
    args.output=(CMP.PROJECT/args.output).resolve()
    native_paths=[native_dir/f'static-{i}.png' for i in range(3)]
    web_paths=[web_dir/name for name in ('start.png','end.png')]
    trace_path=web_dir/'trace.json';trace=CMP.read_json(trace_path)
    capture=CMP.read_json(native_dir/'capture.json');state=CMP.read_json(native_dir/'state.json')
    resolution=CMP.read_json(native_dir/'resolution-request.json');colors=CMP.read_json(native_dir/'colors.json')
    native=list(map(CMP.image_array,native_paths));web=list(map(CMP.image_array,web_paths))
    if any(a.shape[:2]!=(1398,2002) for a in native+web):raise ValueError('Actual PNG framebuffer must be2002x1398')
    native_verified=(capture.get('screenWidth')==2002 and capture.get('screenHeight')==1398
        and capture.get('level')=='first_puzzle' and state.get('levelName')=='first_puzzle'
        and state.get('moveCount')==0 and state.get('trace')==[]
        and resolution.get('requested')==[2002,1398] and resolution.get('actualScreen')==[2002,1398]
        and resolution.get('resampled') is False and resolution.get('drawLogicChanged') is False)
    vp=trace.get('viewport',{})
    web_verified=(vp.get('width')==1001 and vp.get('height')==699 and vp.get('canvasWidth')==2002 and vp.get('canvasHeight')==1398
        and all(trace.get(k,{}).get('levelName')=='first_puzzle' and trace[k].get('moveCount')==0 and trace[k].get('moving') is False for k in ('starting','ending')))
    if not native_verified or not web_verified:raise ValueError('Actual fresh-state/physical-size metadata unverified')
    layout=B.layout_for({'level':'first_puzzle','viewport':'2002x1398-physical'})
    nr=[CMP.border_runs(a,layout,1) for a in native];wr=[CMP.border_runs(a,layout,1) for a in web]
    rows=[]
    for obj,color,x,y,sx,sy in layout:
        for side in ('left','right','top','bottom'):
            n,w=nr[0][obj][side],wr[0][obj][side]
            if len(n)!=1 or len(w)!=1:raise ValueError('Expected one exact border run per side')
            horizontal=side in ('left','right');cross=int(y+sy/2 if horizontal else x+sx/2)
            low=math.floor(min(n[0][0],w[0][0]))-2;high=math.ceil(max(n[0][1],w[0][1]))+2
            rows.append({'object':obj,'side':side,'axis':'x' if horizontal else 'y',
                'borderRGB':list(color),'nativePhysicalRunExclusive':n[0],'webPhysicalRunExclusive':w[0],
                'webMinusNativeEndpointsPhysical':[w[0][i]-n[0][i] for i in (0,1)],
                'exactMatch':n==w,
                'nativeRawProfiles':[B.profile(a,1,horizontal,cross,low,high,color) for a in native],
                'webRawProfiles':[B.profile(a,1,horizontal,cross,low,high,color) for a in web]})
    summary={'additionalProbeOnly':True,'cssViewport':[1001,699],'framebuffer':[2002,1398],
        'nativeFreshAndDimensionsVerified':native_verified,'webFreshAndDimensionsVerified':web_verified,
        'nativeBorderRepeatsStable':all(r==nr[0] for r in nr),'webBorderRepeatsStable':all(r==wr[0] for r in wr),
        'borderSides':len(rows),'exactMatchingSides':sum(r['exactMatch'] for r in rows),
        'endpointShiftSignatures':[{'webMinusNativePhysical':list(k),'sides':v} for k,v in sorted(Counter(tuple(r['webMinusNativeEndpointsPhysical']) for r in rows).items())],
        'nativeCapturedFocusGeometry':colors.get('focusGeometry')}
    out={'method':'Additional actual matched2002x1398 framebuffer probe. Raw physical scanline RGB and exact-color endpoints, no resampling/alignment/tolerance. Does not replace any of20 original matrix conditions.',
        'script':CMP.file_record(Path(__file__)),'webCaptureRevision':trace.get('options',{}).get('revision'),
        'nativeInputs':[CMP.file_record(p) for p in native_paths]+[CMP.file_record(native_dir/name) for name in ('capture.json','state.json','resolution-request.json','colors.json')],
        'webInputs':[CMP.file_record(p) for p in web_paths]+[CMP.file_record(trace_path)],
        'levelInput':CMP.file_record(CMP.PROJECT/'src/assets/levels/first_puzzle.txt'),
        'summary':summary,'borders':rows}
    args.output.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,indent=2))
    if args.require_exact and (summary['exactMatchingSides']!=12 or not summary['nativeBorderRepeatsStable'] or not summary['webBorderRepeatsStable']):
        raise SystemExit('Exact repeated twelve-side physical match required; diagnostic retained')

if __name__=='__main__':main()
