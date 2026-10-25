"""Raw border diagnostics for an existing static report; no acceptance tolerance."""
from __future__ import annotations
import argparse
from collections import Counter
import importlib.util
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

SPEC = importlib.util.spec_from_file_location('static_compare', Path(__file__).with_name('parity-static-compare.py'))
CMP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CMP)

def layout_for(case):
    width, height = map(int, case['viewport'].split('-')[0].split('x'))
    gw, gh, _, blocks, _ = CMP.level_geometry(case['level'])
    side = .82 * min(width, height)
    left, top, cw, ch = (width-side)/2, (height-side)/2, side/gw, side/gh
    return [('root', (36,36,36), left, top, side, side)] + [
        (b['name']+str(i) if b['name']=='gold' else b['name'], b['border'],
         left+b['xy'][0]*cw, top+(gh-1-b['xy'][1])*ch, cw, ch)
        for i,b in enumerate(blocks)]

def rgb_runs(values, origin):
    changes = np.flatnonzero(np.any(values[1:] != values[:-1], axis=1))+1
    points = [0, *changes.tolist(), len(values)]
    return [{'physicalRangeExclusive':[origin+a,origin+b], 'rgb':values[a].tolist()}
            for a,b in zip(points,points[1:])]

def profile(array, scale, horizontal, cross, low, high, color):
    values = array[cross, low*scale:high*scale] if horizontal else array[low*scale:high*scale,cross]
    exact = np.all(values == color,axis=1)
    runs = [[low*scale+a,low*scale+b] for a,b in CMP.segments(np.flatnonzero(exact))]
    transitions = []
    for a,b in runs:
        before, after = a-low*scale-1, b-low*scale
        transitions.append({'physicalRunExclusive':[a,b],
            'beforeRGB':values[before].tolist() if before>=0 else None,
            'firstRGB':values[a-low*scale].tolist(),
            'lastRGB':values[b-low*scale-1].tolist(),
            'afterRGB':values[after].tolist() if after<len(values) else None})
    return {'crossPhysical':cross,'alongPhysicalExclusive':[low*scale,high*scale],
            'exactBorderRunsPhysical':runs,'rgbRuns':rgb_runs(values,low*scale),
            'transitions':transitions}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report',type=Path,default=CMP.PROJECT/'docs/parity/static-v4-analysis.json')
    parser.add_argument('--output',type=Path,default=CMP.PROJECT/'docs/parity/static-v4-analysis.borders.json')
    parser.add_argument('--contact-sheet',type=Path)
    args=parser.parse_args()
    report=CMP.read_json(args.report)
    cases=report['cases'];rows=[];verified={};images={}
    def array(record):
        path=CMP.PROJECT/record['path']
        if record['path'] not in verified:
            actual=CMP.file_record(path)
            if actual['sha256']!=record['sha256']:raise ValueError('Report input changed: '+record['path'])
            verified[record['path']]=actual
            images[record['path']]=CMP.image_array(path)
        return images[record['path']]
    for case in cases:
        if case['dpr']!=2:continue
        one=next(c for c in cases if c['level']==case['level'] and c['viewport']==case['viewport'].replace('-dpr2','-dpr1'))
        layout={item[0]:item for item in layout_for(case)}
        for obj,sides in case['borderRunDifferences'].items():
            _,color,x,y,sx,sy=layout[obj]
            for side,difference in sides.items():
                native,web=difference['native'],difference['web']
                if len(native)!=1 or len(web)!=1:raise ValueError('Expected one local run')
                horizontal=side in ('left','right');center=y+sy/2 if horizontal else x+sx/2
                low=math.floor(min(native[0][0],web[0][0]))-2
                high=math.ceil(max(native[0][1],web[0][1]))+2
                groups={}
                for label,scale,records in [('native1x',1,case['nativeInputs']),('webDpr1',1,one['webInputs']),('webDpr2',2,case['webInputs'])]:
                    # Include both physical rows/columns of the native CSS pixel,
                    # plus the exact original comparator scanline if different.
                    crosses=sorted(set([int(center*scale), *range(int(center)*scale,(int(center)+1)*scale)]))
                    frames=[[profile(array(record),scale,horizontal,cross,low,high,color) for cross in crosses] for record in records]
                    groups[label]={'scale':scale,'paths':[r['path'] for r in records],
                        'repeatsExactlyEqual':all(frame==frames[0] for frame in frames),
                        'allPhysicalCrossesSameExactBorderRuns':all(p['exactBorderRunsPhysical']==frames[0][0]['exactBorderRunsPhysical'] for frame in frames for p in frame),
                        'profiles':frames}
                shifts=[web[0][i]-native[0][i] for i in (0,1)]
                width_delta=(web[0][1]-web[0][0])-(native[0][1]-native[0][0])
                rows.append({'level':case['level'],'viewport':case['viewport'],'object':obj,'side':side,
                    'borderRGB':list(color),'axis':'x' if horizontal else 'y','centerCss':center,
                    'nativeRunCssExclusive':native[0],'webRunCssExclusive':web[0],
                    'endpointShiftCss':shifts,'widthDeltaCss':width_delta,
                    'classification':'hard exact-color support differs; native2x reference absent',
                    'sources':groups})
    signatures=Counter((tuple(r['endpointShiftCss']),r['widthDeltaCss']) for r in rows)
    summary={'differingSides':len(rows),'rootSides':sum(r['object']=='root' for r in rows),
        'sameWidth':sum(r['widthDeltaCss']==0 for r in rows),
        'thinner':sum(r['widthDeltaCss']<0 for r in rows),'thicker':sum(r['widthDeltaCss']>0 for r in rows),
        'maximumAbsoluteEndpointShiftCss':max(abs(v) for r in rows for v in r['endpointShiftCss']),
        'allProfilesRepeatExactly':all(g['repeatsExactlyEqual'] for r in rows for g in r['sources'].values()),
        'allExactBorderSupportsRepeatAndCrossStable':all(g['allPhysicalCrossesSameExactBorderRuns'] for r in rows for g in r['sources'].values()),
        'adjacentRgbUnstableGroups':dict(Counter(label for r in rows for label,g in r['sources'].items() if not g['repeatsExactlyEqual'])),
        'allWebDpr1BorderRunsMatchNative1x':all(r['sources']['webDpr1']['profiles'][0][0]['exactBorderRunsPhysical']==r['sources']['native1x']['profiles'][0][0]['exactBorderRunsPhysical'] for r in rows),
        'allDpr2PhysicalCrossesHaveSameBorderRuns':all(r['sources']['webDpr2']['allPhysicalCrossesSameExactBorderRuns'] for r in rows),
        'signatures':[{'endpointShiftCss':list(k[0]),'widthDeltaCss':k[1],'count':v} for k,v in sorted(signatures.items())]}
    if len(rows)!=report['summary']['borderSidesDifferingDpr2']:
        raise ValueError('Mismatch count does not reproduce input report')
    out={'method':'Raw physical RGB runs over every differing border side, native3/Web1 two/Web2 two repeats; no resampling, fitted alignment or tolerance.',
        'limits':'Measures hard exact-color support against native1x. Does not establish native2x appearance or independent visual acceptance. Adjacent nonborder gradients are retained as raw runs, not excused as AA.',
        'reportInput':CMP.file_record(args.report),'script':CMP.file_record(Path(__file__)),
        'verifiedImageInputs':list(verified.values()),'summary':summary,'borders':rows}
    args.output.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
    if args.contact_sheet:
        choices=[('first_puzzle','800x600','rootBottomRight'),('first_puzzle','800x600','player'),
                 ('second_puzzle','1001x733','rootBottomRight'),('third_puzzle','1280x900','rootBottomRight'),
                 ('third_puzzle','1280x900','gold1')]
        sheet=Image.new('RGB',(1400,1320),(235,235,235));draw=ImageDraw.Draw(sheet)
        draw.text((12,8),'OFFLINE v4: nearest-neighbor DISPLAY ONLY. Each CSS pixel spans 4 display pixels.',fill='black')
        for col,label in enumerate(('Native 1x (physical pixel x4)','Web DPR1 (physical pixel x4)','Web DPR2 (physical pixel x2)')):
            draw.text((12+col*460,30),label,fill='black')
        y=56
        for lv,size,crop_name in choices:
            c=next(c for c in cases if c['level']==lv and c['viewport']==size+'-dpr2')
            c1=next(c for c in cases if c['level']==lv and c['viewport']==size+'-dpr1')
            box=next(crop['cssBoxExclusive'] for crop in c['physicalSampling']['cropMappings'] if crop['label']==crop_name)
            draw.text((12,y),f'{lv} {size} {crop_name}; exclusive CSS box {box}',fill='black');y+=20
            for col,(record,scale) in enumerate(((c['nativeInputs'][0],1),(c1['webInputs'][0],1),(c['webInputs'][0],2))):
                a=array(record);physical=[v*scale for v in box]
                crop=Image.fromarray(a).crop(physical)
                crop=crop.resize(((box[2]-box[0])*4,(box[3]-box[1])*4),Image.Resampling.NEAREST)
                sheet.paste(crop,(12+col*460,y))
            y+=(box[3]-box[1])*4+18
        sheet.crop((0,0,1400,y)).save(args.contact_sheet)
    print(json.dumps(summary,indent=2))

if __name__=='__main__':main()
