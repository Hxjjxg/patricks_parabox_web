"""Independent fixed-coordinate offline review; never alter or resample inputs."""
from pathlib import Path
from hashlib import sha256
import json
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
read = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
digest = lambda path: sha256(path.read_bytes()).hexdigest()
write = lambda name, data: (HERE / name).write_text(json.dumps(data, indent=2) + chr(10), encoding='utf-8')
comparison_path = ROOT / 'docs/parity/evidence/web-production-candidate-v6/note/comparison.json'
comparison = read(comparison_path)
manifest = {'productionRevision': comparison['productionRevision'], 'archiveRevision': 'be36d4b',
    'inputComparisonSha256': digest(comparison_path), 'viewing': 'tools.view_image detail original; all nine inputs actually viewed',
    'transform': 'No shifts, scaling, resampling, fitted masks or new acceptance threshold', 'viewedImages': []}
metrics = {'scope': 'Three Note pairs and one static pair only; no whole-matrix approval',
    'noteSupportThreshold': 'Established min(R,G,B)>150, diagnostic support only',
    'flatInteriorTolerance': 'Existing1/255 channel tolerance, limited to specified flat rectangles', 'notes': []}

def register(relative, label, expected=None):
    path = ROOT / relative
    actual = digest(path)
    if expected is not None:
        assert actual == expected, (relative, actual, expected)
    image = Image.open(path).convert('RGB')
    manifest['viewedImages'].append({'path': relative, 'label': label, 'sha256': actual, 'size': list(image.size),
        'matchesSuppliedSha256': actual == expected if expected else None})
    return image

def delta(a, b):
    difference = np.abs(a.astype(np.int16)-b.astype(np.int16))
    return {'differentPixels': int(np.any(difference != 0, axis=2).sum()),
        'maxChannelDifference': int(difference.max())}

for pair in comparison['pairs']:
    size = 'x'.join(map(str, pair['viewport']))
    native = register(pair['paths'][0], 'Native Note' + size, pair['sha256'][0])
    final = register(pair['paths'][2], 'Final Note' + size, pair['sha256'][2])
    assert native.size == final.size == tuple(pair['viewport'])
    a, b = np.asarray(native), np.asarray(final)
    roi = pair['crop']
    bands = {'800x600': [(458,481),(481,503)], '1001x733': [(558,587),(587,612)],
        '1280x720': [(576,610),(610,639)]}[size]
    supports = []
    for array in [a, b]:
        rows = []
        for y1,y2 in bands:
            ys,xs = np.where(array[y1:y2,roi[0]:roi[2]].min(axis=2) > 150)
            rows.append([int(xs.min()+roi[0]),int(ys.min()+y1),int(xs.max()+roi[0]),int(ys.max()+y1)])
        supports.append(rows)
    assert supports == [pair['threshold150LineSupportNativePriorFinal'][0],
        pair['threshold150LineSupportNativePriorFinal'][2]]
    trace = read(ROOT / pair['paths'][2].replace('end.png', 'trace.json'))
    native_capture = read((ROOT / pair['paths'][0]).parent / 'capture.json')
    note = {'viewport': pair['viewport'], 'nativeFinalInclusiveInkBounds': supports,
        'roiHalfOpen': roi, 'cropDifferenceDiagnostic': delta(a[roi[1]:roi[3],roi[0]:roi[2]], b[roi[1]:roi[3],roi[0]:roi[2]]),
        'webSettings': {'options': trace['options'], 'viewport': trace['viewport'],
            'state': {k:trace['ending'][k] for k in ['levelName','moveCount','mode','moving','winning','camera','player']}},
        'nativeSettings': {k:native_capture[k] for k in ['screenWidth','screenHeight','targetFrameRate','vSyncCount','moveDelay','allowSkippingAnimation','instantZoom']}}
    if size == '1280x720':
        note['unshiftedNPixelSamples'] = [{'xy':[x,y], 'native':a[y,x].tolist(), 'final':b[y,x].tolist()}
            for x,y in [(114,586),(115,586),(116,586),(114,592),(115,592)]]
    metrics['notes'].append(note)

register(comparison['plate']['path'], 'Actual supplied unscaled Note crop plate', comparison['plate']['sha256'])
static_native = 'docs/parity/evidence/original/third-baseline-settled-20261025/static-0.png'
static_final = 'docs/parity/evidence/web-production-candidate-v6/static/800x600-dpr1/third_puzzle/end.png'
static_hashes = read((ROOT / static_final).parent / 'sha256.json')
native = register(static_native, 'Native settled static third800x600')
final = register(static_final, 'Final settled static third800x600', static_hashes['end.png'])
assert native.size == final.size == (800,600)
a,b = np.asarray(native),np.asarray(final)
trace = read((ROOT / static_final).parent / 'trace.json')
native_capture = read((ROOT / static_native).parent / 'capture.json')
metrics['static'] = {'wholeFrameDifferenceDiagnosticOnly': delta(a,b),
    'webSettings': {'options':trace['options'],'viewport':trace['viewport'],
        'state':{k:trace['ending'][k] for k in ['levelName','moveCount','mode','moving','winning','camera','player']}},
    'nativeSettings':{k:v for k,v in native_capture.items() if k != 'frames'},
    'flatInteriors': [], 'pointSamples': []}
flat = [
    ('left outer panel', [160,70,190,530]), ('upper right panel',[450,90,600,300]),
    ('right white highlight',[594,340,602,425]), ('bottom white highlight',[220,439,307,447]),
    ('left gray bevel',[197,120,206,430]), ('yellow fill',[379,170,422,211]),
    ('magenta fill below eyes',[268,309,313,323]),
]
for name,(x1,y1,x2,y2) in flat:
    aa,bb = a[y1:y2,x1:x2],b[y1:y2,x1:x2]
    d=np.abs(aa.astype(np.int16)-bb.astype(np.int16))
    metrics['static']['flatInteriors'].append({'label':name,'roiHalfOpen':[x1,y1,x2,y2],
        **delta(aa,bb),'pixelsBeyondExistingOneByte':int(np.any(d>1,axis=2).sum()),
        'nativeDistinctColors':np.unique(aa.reshape(-1,3),axis=0).tolist(),
        'finalDistinctColors':np.unique(bb.reshape(-1,3),axis=0).tolist()})
for x,y in [(200,200),(430,150),(598,360),(240,442),(280,315),(390,180),(500,200),(154,54)]:
    metrics['static']['pointSamples'].append({'xy':[x,y],'native':a[y,x].tolist(),'final':b[y,x].tolist()})

rois = [('top bevel / upper inner corner',[184,84,452,150]),
    ('L-corner / right white edge',[414,298,612,340]),
    ('lower notch / highlight join',[303,370,443,456]),
    ('goals / yellow box / player',[252,150,430,337])]
plate=Image.new('RGB',(580,30+sum(roi[3]-roi[1]+30 for _,roi in rois)),(32,32,32))
draw=ImageDraw.Draw(plate)
draw.text((8,5),'Native left / immutable final-v6 right; all crops unscaled',fill='white')
y=28
for name,roi in rois:
    draw.text((8,y),name+' '+str(roi),fill='white')
    plate.paste(native.crop(roi),(8,y+18))
    plate.paste(final.crop(roi),(300,y+18))
    y+=roi[3]-roi[1]+30
plate.save(HERE / 'static-native-final-crops.png')
metrics['static']['cropPlate']={'path':(HERE/'static-native-final-crops.png').relative_to(ROOT).as_posix(),
    'sha256':digest(HERE/'static-native-final-crops.png'),'roiCoordinates':rois,'scale':1,
    'actuallyViewedAtOriginalDetail':True,
    'rawDifferenceDiagnostic':[{'label':name,'roiHalfOpen':roi,
        **delta(a[roi[1]:roi[3],roi[0]:roi[2]],b[roi[1]:roi[3],roi[0]:roi[2]])} for name,roi in rois]}
metrics['static']['unresolvedCornerResiduals'] = []
for name,roi in rois[1:3]:
    x1,y1,x2,y2=roi
    d=np.abs(a[y1:y2,x1:x2].astype(np.int16)-b[y1:y2,x1:x2].astype(np.int16)).max(axis=2)
    ys,xs=np.where(d>1)
    points=sorted([(int(d[y,x]),int(x+x1),int(y+y1)) for y,x in zip(ys,xs)],reverse=True)
    metrics['static']['unresolvedCornerResiduals'].append({'label':name,'roiHalfOpen':roi,
        'diagnosticPixelsBeyond1':len(xs),'acceptance':'None; flat-interior tolerance is not extended to corners',
        'pixels':[{'xy':[x,y],'maxDifference':v,'native':a[y,x].tolist(),'final':b[y,x].tolist()} for v,x,y in points]})
repeats=[]
for index in range(3):
    relative='docs/parity/evidence/original/third-baseline-settled-20261025/static-'+str(index)+'.png'
    array=np.asarray(Image.open(ROOT/relative).convert('RGB'))
    points=[]
    for x,y in [(428,321),(323,382)]:
        neighbors=[(x-3,y),(x+3,y),(x,y-3),(x,y+3)]
        points.append({'xy':[x,y],'native':array[y,x].tolist(),'final':b[y,x].tolist(),
            'nativePatch7x7Sha256':sha256(array[y-3:y+4,x-3:x+4].tobytes()).hexdigest(),
            'surroundingPixels':[{'xy':[xx,yy],'native':array[yy,xx].tolist(),'final':b[yy,xx].tolist()} for xx,yy in neighbors]})
    repeats.append({'path':relative,'sha256':digest(ROOT/relative),'readPixelsOnlyNotNewVisualCapture':True,'points':points})
native_repeat_check={'frames':repeats,'both7x7NeighborhoodsExactAcrossThreeNativeFrames':
    all(len({row['points'][i]['nativePatch7x7Sha256'] for row in repeats})==1 for i in range(2)),
    'limit':'Retained native static repeats only; no new edge tolerance or final visual approval'}
write('native-static-repeat-check.json',native_repeat_check)
manifest['additionalPixelReadInputs']=[{'path':row['path'],'sha256':row['sha256']} for row in repeats[1:]]
write('manifest.json',manifest)
write('metrics.json',metrics)
write('hashes.json',{'algorithm':'SHA-256','files':{p.name:digest(p) for p in sorted(HERE.iterdir()) if p.is_file() and p.name!='hashes.json'}})
print(json.dumps({'viewedInputs':len(manifest['viewedImages']),'allSuppliedInputHashesMatch':True,
    'flatInteriors':metrics['static']['flatInteriors'],'nSamples':metrics['notes'][2]['unshiftedNPixelSamples']}))
