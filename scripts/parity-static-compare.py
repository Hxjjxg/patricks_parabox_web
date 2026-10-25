"""Offline static diagnostics; no runtime, browser, dist, or reference mutation."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
EVIDENCE = PROJECT / 'docs/parity/evidence'
LEVELS = ('first_puzzle', 'second_puzzle', 'third_puzzle')
SIZES = ((800, 600), (1001, 733), (1280, 720))

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def file_record(path):
    return {'path': path.relative_to(PROJECT).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

def image_array(path):
    with Image.open(path) as image:
        return np.array(image.convert('RGB'))

def expected_cases():
    return [(level, w, h, dpr) for w, h in SIZES for dpr in (1, 2) for level in LEVELS] + [('third_puzzle', 1280, 900, dpr) for dpr in (1, 2)]

def native_directory(level, width, height):
    if (width, height) == (1280, 900):
        name = 'third-integer-1280x900-static-20261025'
    elif (width, height) == (800, 600):
        name = 'reviewer-third-static-20261025' if level == 'third_puzzle' else level + '-static-20261025'
    else:
        name = f'{level}-{width}x{height}-static-v2-20261025'
    return EVIDENCE / 'original' / name

def input_paths(root, level, width, height, dpr):
    folder = root / f'{width}x{height}-dpr{dpr}' / level
    if (folder / 'start.png').is_file():
        images = [folder / 'start.png']
        if (folder / 'end.png').is_file():
            images.append(folder / 'end.png')
        return images, folder / 'trace.json'
    stem = f'{level}-{width}x{height}-dpr{dpr}'
    images = [root / (stem + '.png')]
    if (root / (stem + '-repeat.png')).is_file():
        images.append(root / (stem + '-repeat.png'))
    return images, root / (stem + '.json')

def level_geometry(level):
    lines = (PROJECT / 'src/assets/levels' / (level + '.txt')).read_text(encoding='utf-8-sig').splitlines()
    root = next(line.split() for line in lines if line.startswith('Block '))
    walls, blocks, goals = set(), [], set()
    for line in lines:
        parts = line.split()
        if line.startswith('\tWall ') and not line.startswith('\t\t'):
            walls.add((int(parts[1]), int(parts[2])))
        if line.startswith('\tBlock ') and not line.startswith('\t\t'):
            player = parts[6] == '0.9'
            blocks.append({'xy': (int(parts[1]), int(parts[2])), 'name': 'player' if player else 'gold', 'border': (32, 0, 16) if player else (46, 28, 2)})
        if line.startswith('\tFloor ') and not line.startswith('\t\t'):
            goals.add((int(parts[1]), int(parts[2])))
    return int(root[4]), int(root[5]), walls, blocks, goals

def sample(native, web, x, y, dpr, kind, extra=None):
    ns = [a[y, x].tolist() for a in native]
    ws = [a[y*dpr:(y+1)*dpr, x*dpr:(x+1)*dpr].reshape(-1, 3).tolist() for a in web]
    native_stable = all(value == ns[0] for value in ns)
    web_stable = len(ws) >= 2 and all(value == ws[0] for value in ws)
    delta = max(int(np.abs(np.array(rgb, dtype=int) - np.array(ns[0], dtype=int)).max()) for frame in ws for rgb in frame)
    span = max(int(np.ptp(a[y-2:y+3, x-2:x+3].reshape(-1, 3).astype(int), axis=0).max()) for a in native)
    return {'xyCss': [x, y], 'kind': kind, 'nativeRGB': ns, 'webPhysicalRGB': ws, 'nativeRepeatStable': native_stable, 'webRepeatVerified': web_stable, 'repeatStable': native_stable and web_stable, 'native5x5ChannelSpan': span, 'flatNativeInteriorEligible': span <= 2, 'maxChannelDelta': delta, 'withinEstablishedInterior1': delta <= 1, **(extra or {})}

def summarize_samples(rows):
    stable = [row for row in rows if row['repeatStable']]
    eligible = [row for row in stable if row['flatNativeInteriorEligible']]
    return {'count': len(rows), 'repeatStableCount': len(stable), 'flatNativeInteriorSampleCount': len(eligible), 'maxFlatNativeInteriorChannelDelta': max((r['maxChannelDelta'] for r in eligible), default=None), 'flatNativeInteriorOutside1': [r for r in eligible if not r['withinEstablishedInterior1']], 'edgeAdjacentOutside1Diagnostics': [r for r in stable if not r['flatNativeInteriorEligible'] and not r['withinEstablishedInterior1']], 'repeatUnverifiedOrUnstableCount': len(rows)-len(stable)}

def segments(values):
    return [] if not len(values) else [[int(g[0]), int(g[-1])+1] for g in np.split(values, np.flatnonzero(np.diff(values)>1)+1)]

def border_runs(image, layout, scale):
    result = {}
    for name, color, x, y, sx, sy in layout:
        cx, cy = int((x+sx/2)*scale), int((y+sy/2)*scale)
        horizontal = np.flatnonzero(np.all(image[cy, :] == color, axis=1))
        vertical = np.flatnonzero(np.all(image[:, cx] == color, axis=1))
        def near(values, center):
            return [[a/scale, b/scale] for a, b in segments(values[(values>scale*(center-10)) & (values<scale*(center+10))])]
        result[name] = {'color': color, 'left': near(horizontal, x), 'right': near(horizontal, x+sx), 'top': near(vertical, y), 'bottom': near(vertical, y+sy)}
    return result

def join_measurements(native, web, x, y, dx, dpr):
    def span(image, scale):
        px, py, radius = round(x*scale), round(y*scale), 3*scale
        strip = image[py, px-radius:px+radius+1] if dx else image[py-radius:py+radius+1, px]
        return int(np.ptp(strip.astype(int), axis=0).max())
    ns, ws = [span(a, 1) for a in native], [span(a, dpr) for a in web]
    return {'nativeSpans': ns, 'webSpans': ws, 'suspect': max(ns)<=2 and max(ws)>max(4, max(ns)+3)}

def seam_positive_control():
    native_path=EVIDENCE/'original/third-baseline-settled-20261025/static-0.png'
    web_path=EVIDENCE/'web-third-before-800x600-dpr1.png'
    if not native_path.is_file() or not web_path.is_file():
        return {'available':False,'expectedSuspects':4}
    native,web=image_array(native_path),image_array(web_path)
    gw,gh,walls,_,_=level_geometry('third_puzzle')
    side=.82*600;left=(800-side)/2;top=(600-side)/2
    suspects=[]
    for gx,gy in sorted(walls):
        for dx,dy in ((1,0),(0,1)):
            if (gx+dx,gy+dy) not in walls:continue
            x=left+side*(gx+1 if dx else gx+.5)/gw
            y=top+side*(gh-gy-.5 if dx else gh-gy-1)/gh
            result=join_measurements([native],[web],x,y,dx,1)
            if result['suspect']:suspects.append({'cells':[[gx,gy],[gx+dx,gy+dy]],**result})
    return {'available':True,'nativeInput':file_record(native_path),'webInput':file_record(web_path),'expectedSuspects':4,'actualSuspects':len(suspects),'detectorVerified':len(suspects)==4,'suspects':suspects}

def compare_case(level, width, height, dpr, web_paths, metadata_path):
    native_paths = sorted(native_directory(level, width, height).glob('static-*.png'))
    if len(native_paths) != 3:
        raise ValueError(f'Expected exactly3 native repeats: {native_directory(level, width, height)}')
    native, web = list(map(image_array, native_paths)), list(map(image_array, web_paths))
    if any(a.shape[:2] != (height, width) for a in native):
        raise ValueError(f'Native dimensions disagree for {level} {width}x{height}')
    backing = all(a.shape[:2] == (height*dpr, width*dpr) for a in web)
    if not backing:
        return {'level': level, 'viewport': f'{width}x{height}-dpr{dpr}', 'backingCorrect': False, 'actualBacking': [[a.shape[1], a.shape[0]] for a in web], 'error': 'Do not resample or analyze mismatched physical dimensions'}
    gw, gh, walls, blocks, goals = level_geometry(level)
    # Preserve established independent-review ROI coordinates; no fitted alignment.
    side = .82*min(width, height)
    left, top, cw, ch = (width-side)/2, (height-side)/2, side/gw, side/gh
    layout = [('root', (36,36,36), left, top, side, side)] + [(b['name']+str(i) if b['name']=='gold' else b['name'], b['border'], left+b['xy'][0]*cw, top+(gh-1-b['xy'][1])*ch, cw, ch) for i, b in enumerate(blocks)]
    wall_rows, floor_rows, joins = [], [], []
    occupied = {b['xy'] for b in blocks} | goals
    for gx in range(gw):
        for gy in range(gh):
            if (gx, gy) in walls:
                for fx, fy in ((.25,.25),(.5,.5),(.75,.75)):
                    wall_rows.append(sample(native, web, int(left+(gx+fx)*cw), int(top+(gh-gy-1+fy)*ch), dpr, 'wallFill', {'cell':[gx,gy]}))
                for dx, dy, fx, fy, label in ((-1,0,.05,.5,'leftGray'),(1,0,.95,.5,'rightWhite'),(0,1,.5,.05,'topGray'),(0,-1,.5,.95,'bottomWhite')):
                    if (gx+dx,gy+dy) not in walls:
                        wall_rows.append(sample(native, web, int(left+(gx+fx)*cw), int(top+(gh-gy-1+fy)*ch), dpr, label, {'cell':[gx,gy]}))
                for dx, dy in ((1,0),(0,1)):
                    if (gx+dx,gy+dy) in walls:
                        x, y = left+cw*(gx+1 if dx else gx+.5), top+ch*(gh-gy-.5 if dx else gh-gy-1)
                        joins.append({'cells':[[gx,gy],[gx+dx,gy+dy]], 'xyCss':[x,y], **join_measurements(native,web,x,y,dx,dpr)})
            elif (gx,gy) not in occupied:
                x, y = int(left+(gx+.5)*cw), int(top+(gh-gy-.5)*ch)
                if all(40<=int(c)<=110 for c in native[0][y,x]) and np.ptp(native[0][y,x])==0:
                    floor_rows.append(sample(native,web,x,y,dpr,'floorCenter',{'cell':[gx,gy]}))
    nb, wb = [border_runs(a,layout,1) for a in native], [border_runs(a,layout,dpr) for a in web]
    differences = {name:{side:{'native':nb[0][name][side], 'web':wb[0][name][side]} for side in ('left','right','top','bottom') if nb[0][name][side] != wb[0][name][side]} for name in nb[0]}
    shadow = []
    if level == 'third_puzzle':
        right, cy = int(left+cw*5), int(height-(top+ch*6.5))
        shadow = [sample(native,web,right+dx,cy+dy,dpr,'goldRightWhiteClip') for dx in (1,3,5) for dy in (-10,0,10)]
    metadata = read_json(metadata_path) if metadata_path.is_file() else None
    viewport = metadata.get('viewport',{}) if metadata else {}
    fresh = all(s.get('moveCount')==0 and s.get('levelName')==level and not s.get('moving') for s in (metadata.get('starting',{}),metadata.get('ending',{}))) if metadata and 'starting' in metadata and 'ending' in metadata else None
    result = {'level':level, 'viewport':f'{width}x{height}-dpr{dpr}', 'dpr':dpr, 'backingCorrect':backing, 'metadataViewportCorrect':viewport.get('canvasWidth')==width*dpr and viewport.get('canvasHeight')==height*dpr if viewport else None, 'freshStatesCorrect':fresh, 'nativeInputs':[file_record(p) for p in native_paths], 'webInputs':[file_record(p) for p in web_paths], 'metadataInput':file_record(metadata_path) if metadata else None, 'webRepeatCount':len(web), 'wallSamples':summarize_samples(wall_rows), 'floorSamples':summarize_samples(floor_rows), 'joinCount':len(joins), 'joinMeasurements':len(joins)*len(web), 'suspectJoins':[j for j in joins if j['suspect']], 'allJoins':joins, 'borderNativeRepeatStable':all(b==nb[0] for b in nb), 'borderWebRepeatVerified':len(wb)>=2 and all(b==wb[0] for b in wb), 'borderRunDifferences':{k:v for k,v in differences.items() if v}, 'goldWhiteClipSamples':shadow, 'goldWhiteClipAllExact255':all(r['repeatStable'] and r['nativeRGB'][0]==[255,255,255] and r['maxChannelDelta']==0 for r in shadow) if shadow else None, 'physicalSampling':{'oneCssPixelNativeRect':[0,0,1,1], 'oneCssPixelWebRect':[0,0,dpr,dpr], 'allSubpixelsCompared':True, 'numericResampling':False, 'referenceRoiBoardCss':[left,top,side,side], 'fractionalTileCss':[cw,ch]}}
    right=int(max(run[1] for run in nb[0]['root']['right']))
    bottom=int(max(run[1] for run in nb[0]['root']['bottom']))
    points=[(right,bottom-i) for i in range(2,7)]+[(right-i,bottom) for i in range(2,7)]
    guards=[sample(native,web,x,y,dpr,'rootExteriorGuard') for x,y in points]
    result['rootExteriorGuards']=guards
    result['rootExteriorAll10StableNonblackWhereNativeBlack']=all(r['repeatStable'] and r['nativeRGB'][0]==[0,0,0] and all(any(rgb) for frame in r['webPhysicalRGB'] for rgb in frame) for r in guards)
    crops=[('rootTopLeft',[int(left)-4,int(top)-4,int(left)+14,int(top)+14]),('rootBottomRight',[int(left+side)-14,int(top+side)-14,int(left+side)+4,int(top+side)+4])]
    crops += [(name,[int(x)-7,int(y)-7,int(x+sx)+8,int(y+sy)+8]) for name,_,x,y,sx,sy in layout[1:]]
    result['physicalSampling']['cropMappings']=[{'label':name,'cssBoxExclusive':box,'nativePhysicalBox':box,'webPhysicalBox':[p*dpr for p in box]} for name,box in crops]
    return result

def summary(cases):
    valid = [c for c in cases if c['backingCorrect']]
    historical = [c for c in valid if c['level']=='third_puzzle' and c['dpr']==1 and not c['viewport'].startswith('1280x900')]
    result = {'caseCount':len(cases), 'allBackingCorrect':len(valid)==len(cases), 'allFreshStatesCorrect':all(c['freshStatesCorrect'] is True for c in valid), 'webRepeatVerifiedCases':sum(c['webRepeatCount']>=2 for c in valid), 'flatNativeWallInteriorSamples':sum(c['wallSamples']['flatNativeInteriorSampleCount'] for c in valid), 'flatNativeWallInteriorOutside1':sum(len(c['wallSamples']['flatNativeInteriorOutside1']) for c in valid), 'flatNativeFloorSamples':sum(c['floorSamples']['flatNativeInteriorSampleCount'] for c in valid), 'flatNativeFloorOutside1':sum(len(c['floorSamples']['flatNativeInteriorOutside1']) for c in valid), 'joinSitesAcrossConditions':sum(c['joinCount'] for c in valid), 'webJoinMeasurementsIncludingStartEnd':sum(c['joinMeasurements'] for c in valid), 'historicalThirdDpr1JoinMeasurements':sum(c['joinMeasurements'] for c in historical), 'suspectJoins':sum(len(c['suspectJoins']) for c in valid), 'goldWhiteClipCssSamples':sum(len(c['goldWhiteClipSamples']) for c in valid), 'goldWhiteClipAllExact255':all(c['goldWhiteClipAllExact255'] for c in valid if c['goldWhiteClipSamples']), 'borderSidesDifferingDpr1':sum(sum(map(len,c['borderRunDifferences'].values())) for c in valid if c['dpr']==1), 'borderSidesDifferingDpr2':sum(sum(map(len,c['borderRunDifferences'].values())) for c in valid if c['dpr']==2)}
    result['allBackingCorrect']=len(valid)==20 and all(c['metadataViewportCorrect'] is True for c in valid)
    result['allFreshStatesCorrect']=len(valid)==20 and result['allFreshStatesCorrect']
    result['goldWhiteClipAllExact255']=len(valid)==20 and result['goldWhiteClipAllExact255']
    result['historicalGoldRightWhiteCssSamples']=sum(len(c['goldWhiteClipSamples']) for c in historical)
    result['historicalGoldRightWhiteAllExact255']=len(historical)==3 and all(c['goldWhiteClipAllExact255'] for c in historical)
    result['all10RootGuardPixelsStableNonblackCases']=sorted(c['level']+'/'+c['viewport'] for c in valid if c['rootExteriorAll10StableNonblackWhereNativeBlack'])
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-root',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--validate-against',type=Path)
    parser.add_argument('--require-complete',action='store_true')
    args=parser.parse_args()
    root=(PROJECT/args.web_root).resolve()
    cases, missing=[], []
    for level,w,h,dpr in expected_cases():
        images,metadata=input_paths(root,level,w,h,dpr)
        if not images[0].is_file():
            missing.append(images[0].relative_to(PROJECT).as_posix());continue
        cases.append(compare_case(level,w,h,dpr,images,metadata))
    report={'method':'Established independent-review root-cell ROIs, exact native/Web repeat qualification, unchanged interior RGB channel tolerance1/255. Flat native5x5 span<=2 qualifies interiors. Other edge/AA samples are diagnostic only. Every DPR physical subpixel is compared without resampling. Seam detector retains prior positive control thresholds; border runs have no newly accepted tolerance.', 'limits':'Offline reproducibility diagnostics, not independent visual acceptance. No global particle/blink clock synchronization. Missing Web repeat or state metadata stays unverified. No fitted shifts, resampling, new AA or geometric tolerance.', 'webRoot':root.relative_to(PROJECT).as_posix(), 'script':file_record(Path(__file__)), 'levelInputs':[file_record(PROJECT/'src/assets/levels'/(level+'.txt')) for level in LEVELS], 'expectedCases':20, 'missingInputs':missing, 'cases':cases, 'summary':summary(cases)}
    report['seamPositiveControl']=seam_positive_control()
    if args.validate_against:
        old=read_json(PROJECT/args.validate_against)['summary']
        shared=sorted(set(old)&set(report['summary']))
        equal=lambda a,b:sorted(a)==sorted(b) if isinstance(a,list) and isinstance(b,list) else a==b
        report['baselineEquivalence']={'source':file_record(PROJECT/args.validate_against), 'comparedSummaryKeys':shared, 'differences':{k:{'established':old[k], 'reproduced':report['summary'][k]} for k in shared if not equal(old[k],report['summary'][k])}}
    output=PROJECT/args.output
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'summary':report['summary'], 'missingInputs':missing, 'baselineEquivalence':report.get('baselineEquivalence')},indent=2))
    if args.validate_against and report['baselineEquivalence']['differences']:
        raise SystemExit('Baseline numeric equivalence failed; report retained')
    if not report['seamPositiveControl'].get('detectorVerified'):
        raise SystemExit('Historical four-seam positive control is unverified; report retained')
    if args.require_complete and (missing or report['summary']['webRepeatVerifiedCases']!=20 or not report['summary']['allBackingCorrect'] or not report['summary']['allFreshStatesCorrect']):
        raise SystemExit('Complete20-case repeated capture input with verified dimensions/fresh states is required; report retained')

if __name__=='__main__':
    main()
