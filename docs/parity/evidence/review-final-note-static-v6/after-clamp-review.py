"""Separate after-clamp audit; never regenerate or overwrite before evidence."""
from pathlib import Path
from hashlib import sha256
import json
import numpy as np
from PIL import Image,ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
digest=lambda p:sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
write=lambda name,data:(HERE/name).write_text(json.dumps(data,indent=2)+chr(10),encoding='utf-8')
before_hashes_path=HERE/'hashes.json'
before_hashes=read(before_hashes_path)
protected={name:digest(HERE/name) for name in before_hashes['files']}
assert protected==before_hashes['files'],'Before evidence hash mismatch'
protected['hashes.json']=digest(before_hashes_path)
base=ROOT/'docs/parity/evidence/web-wall-alpha-clamp-after-dev'
capture=base/'third-800x600-dpr1'
supplied=read(capture/'sha256.json')
for name,expected in supplied.items():
    assert digest(capture/name)==expected,(name,'Capture hash mismatch')
first=read(base/'comparison-first.json')
trace=read(capture/'trace.json')
wall_sha='d05c138db2dbbfac5fcd0135a3adfdf0248625195bf6405d73a223a93dadd199'
assert first['sourceProvenance']['sourceSha256']['src/render/wallRendering.ts']==wall_sha
assert wall_sha in json.dumps(trace),'Trace lacks captured source-wall hash'
native_path=ROOT/'docs/parity/evidence/original/third-baseline-settled-20261025/static-0.png'
before_path=ROOT/'docs/parity/evidence/web-production-candidate-v6/static/800x600-dpr1/third_puzzle/end.png'
native=np.asarray(Image.open(native_path).convert('RGB'))
before=np.asarray(Image.open(before_path).convert('RGB'))
images={'start':np.asarray(Image.open(capture/'start.png').convert('RGB')),
    'end':np.asarray(Image.open(capture/'end.png').convert('RGB'))}
assert all(array.shape==(600,800,3) for array in [native,before,*images.values()])

def region_stats(a,b,roi,include_pixels=False):
    x1,y1,x2,y2=roi
    aa,bb=a[y1:y2,x1:x2],b[y1:y2,x1:x2]
    difference=np.abs(aa.astype(np.int16)-bb.astype(np.int16)).max(axis=2)
    result={'roiHalfOpen':roi,'differentPixels':int((difference!=0).sum()),
        'maxChannelDifference':int(difference.max()),'diagnosticPixelsAbove1':int((difference>1).sum())}
    if include_pixels:
        ys,xs=np.where(difference!=0)
        result['nonExactPixels']=[{'xy':[int(x+x1),int(y+y1)],'native':aa[y,x].tolist(),
            'after':bb[y,x].tolist(),'maxDifference':int(difference[y,x])} for y,x in zip(ys,xs)]
    return result

rois=[('top bevel / upper inner corner',[184,84,452,150]),
    ('L-corner / right white edge',[414,298,612,340]),
    ('lower notch / highlight join',[303,370,443,456])]
result={'status':'Actual uncommitted dev capture only; not frozen-v6 or visual approval',
    'edgeTolerance':'None established. Above1 counts diagnostic only; all nonexact edge pixels remain unapproved.',
    'transforms':'No shift, scaling, resampling, fitted masks or tolerance changes',
    'beforeArtifactsUnchanged':protected,'captureOptions':trace['options'],'viewport':trace['viewport'],
    'recordedRafFrameCount':len(trace.get('frames',[])),'capturedPngCount':2,
    'state':{k:trace['ending'][k] for k in ['levelName','moveCount','mode','moving','winning','camera','player']},
    'sourceWallSha256':wall_sha,'currentSourceWallSha256':digest(ROOT/'src/render/wallRendering.ts'),
    'regions':[],'neighborChecks':[],'flatInteriors':[]}
for name,roi in rois:
    result['regions'].append({'label':name,'nativeBefore':region_stats(native,before,roi),
        'nativeAfterStart':region_stats(native,images['start'],roi,True),
        'nativeAfterEnd':region_stats(native,images['end'],roi,True),
        'afterStartEnd':region_stats(images['start'],images['end'],roi)})
for x,y in [(428,321),(323,382)]:
    for xx,yy in [(x,y),(x-3,y),(x+3,y),(x,y-3),(x,y+3)]:
        result['neighborChecks'].append({'xy':[xx,yy],'native':native[yy,xx].tolist(),
            'before':before[yy,xx].tolist(),'afterStart':images['start'][yy,xx].tolist(),
            'afterEnd':images['end'][yy,xx].tolist()})
before_metrics=read(HERE/'metrics.json')
for region in before_metrics['static']['flatInteriors']:
    roi=region['roiHalfOpen']
    result['flatInteriors'].append({'label':region['label'],
        'nativeAfter':region_stats(native,images['end'],roi),
        'beforeAfter':region_stats(before,images['end'],roi)})

plate=Image.new('RGB',(580,30+sum(roi[3]-roi[1]+30 for _,roi in rois)),(32,32,32))
draw=ImageDraw.Draw(plate)
draw.text((8,5),'Native left / actual after-clamp dev right; unscaled',fill='white')
y=28
for name,roi in rois:
    draw.text((8,y),name+' '+str(roi),fill='white')
    plate.paste(Image.fromarray(native).crop(roi),(8,y+18))
    plate.paste(Image.fromarray(images['end']).crop(roi),(300,y+18))
    y+=roi[3]-roi[1]+30
plate.save(HERE/'after-clamp-native-final-crops.png')
inputs=[native_path,before_path,capture/'start.png',capture/'end.png',capture/'trace.json',capture/'sha256.json',base/'comparison-first.json']
manifest={'inputs':[{'path':p.relative_to(ROOT).as_posix(),'sha256':digest(p)} for p in inputs],
    'sourceProvenance':first['sourceProvenance'],'reviewScope':'Offline full native/start/end PNGs and unscaled native/after ROI plate',
    'beforeEvidenceHashesPreserved':protected,'derivedPlate':'after-clamp-native-final-crops.png'}
write('after-clamp-manifest.json',manifest)
write('after-clamp-metrics.json',result)
assert all(digest(HERE/name)==expected for name,expected in protected.items()),'Before evidence changed'
write('after-clamp-hashes.json',{'algorithm':'SHA-256','files':{p.name:digest(p) for p in sorted(HERE.glob('after-clamp-*')) if p.is_file() and p.name!='after-clamp-hashes.json'}})
print(json.dumps({'sourceWallMatches':result['currentSourceWallSha256']==wall_sha,
    'recordedRafFrames':result['recordedRafFrameCount'],
    'regions':[{'label':r['label'],'before':r['nativeBefore'],
        'after':{k:v for k,v in r['nativeAfterEnd'].items() if k!='nonExactPixels'},'startEnd':r['afterStartEnd']} for r in result['regions']],
    'flatInteriors':result['flatInteriors'],'beforeEvidencePreserved':True}))
