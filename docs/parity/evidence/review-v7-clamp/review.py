"""Offline frozen-v7 image review; write only this new review folder."""
from pathlib import Path
from hashlib import sha256
import json,subprocess
import numpy as np
from PIL import Image,ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
BASE=ROOT/'docs/parity/evidence/web-production-candidate-v7'
HEAD='e04a40c5ee352bef46cb3fb309675a32f953cd67'
WALL='d05c138db2dbbfac5fcd0135a3adfdf0248625195bf6405d73a223a93dadd199'
digest=lambda p:sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
write=lambda name,data:(HERE/name).write_text(json.dumps(data,indent=2)+chr(10),encoding='utf-8')
build_path=BASE/'build-manifest.json'
build=read(build_path)
assert build['head']==build['headAfter']==HEAD
assert build['sourceStableAcrossBuild'] and build['changed']==[]
assert build['sourceSha256']['src/render/wallRendering.ts']==WALL
assert subprocess.check_output(['git','rev-parse','e04a40c'],cwd=ROOT).decode().strip()==HEAD
working=(ROOT/'src/render/wallRendering.ts').read_bytes()
blob=subprocess.check_output(['git','show',HEAD+':src/render/wallRendering.ts'],cwd=ROOT)
normalize=lambda data:data.replace(bytes([13,10]),bytes([10]))
assert sha256(working).hexdigest()==WALL
assert normalize(working)==normalize(blob)
provenance={'head':HEAD,'buildManifestPath':build_path.relative_to(ROOT).as_posix(),
    'buildManifestSha256':digest(build_path),'buildSourceStable':True,'changedDuringBuild':[],
    'sourceWallWorkingSha256':WALL,'sourceWallGitBlobSha256':sha256(blob).hexdigest(),
    'workingCRLFCount':working.count(bytes([13,10])),'gitCRLFCount':blob.count(bytes([13,10])),
    'workingAndFrozenGitSourceEqualAfterCRLFtoLF':True}
native_path=ROOT/'docs/parity/evidence/original/third-baseline-settled-20261025/static-0.png'
before_path=ROOT/'docs/parity/evidence/web-production-candidate-v6/static/800x600-dpr1/third_puzzle/end.png'
native=np.asarray(Image.open(native_path).convert('RGB'))
before=np.asarray(Image.open(before_path).convert('RGB'))
viewed=[{'path':native_path.relative_to(ROOT).as_posix(),'sha256':digest(native_path),'size':[800,600],
    'viewedAtOriginalDetail':True}]
rois=[('top bevel',[184,84,452,150]),('L-corner',[414,298,612,340]),('lower notch',[303,370,443,456])]

def measure(a,b,roi,pixels=False):
    x1,y1,x2,y2=roi
    aa,bb=a[y1:y2,x1:x2],b[y1:y2,x1:x2]
    d=np.abs(aa.astype(np.int16)-bb.astype(np.int16)).max(axis=2)
    result={'roiHalfOpen':roi,'differentPixels':int((d!=0).sum()),'maxChannelDifference':int(d.max()),
        'diagnosticPixelsAbove1':int((d>1).sum()),'edgeAcceptance':'None; one-byte edge residuals remain unresolved'}
    if pixels:
        ys,xs=np.where(d!=0)
        result['nonExactPixels']=[{'xy':[int(x+x1),int(y+y1)],'native':aa[y,x].tolist(),
            'v7':bb[y,x].tolist(),'maxDifference':int(d[y,x])} for y,x in zip(ys,xs)]
    return result

result={'scope':'Viewed frozen production static starts/end only. No phase/motion/whole-matrix approval.',
    'provenance':provenance,'transform':'No shifts, scaling, resampling, fitted masks or tolerance changes',
    'beforeV6':{'path':before_path.relative_to(ROOT).as_posix(),'sha256':digest(before_path),
        'regions':[{'label':name,**measure(native,before,roi)} for name,roi in rois]},'cases':[]}
cases=[('cardinal '+direction,'cardinal/third_puzzle-'+direction,'start.png') for direction in ['D','L','R','U']]
cases += [('static start','static/800x600-dpr1/third_puzzle','start.png'),
    ('static end','static/800x600-dpr1/third_puzzle','end.png')]
flat=[('left panel',[160,70,190,530]),('right panel',[450,90,600,300]),
    ('white right highlight',[594,340,602,425]),('white lower highlight',[220,439,307,447]),
    ('gray bevel',[197,120,206,430]),('yellow fill',[379,170,422,211]),('magenta fill',[268,309,313,323])]
for label,folder_name,filename in cases:
    folder=BASE/folder_name
    hashes=read(folder/'sha256.json')
    for name in [filename,'trace.json']:
        assert digest(folder/name)==hashes[name],(folder_name,name)
    trace=read(folder/'trace.json')
    assert trace['provenance']['head']==HEAD
    assert trace['provenance']['manifestSha256']==digest(build_path)
    assert trace['starting']['levelName']=='third_puzzle'
    assert trace['starting']['moveCount']==0 and not trace['starting']['moving']
    assert trace['starting']['player']['x']==2 and trace['starting']['player']['y']==4
    assert trace['starting']['camera']['x']==trace['starting']['camera']['y']==0
    array=np.asarray(Image.open(folder/filename).convert('RGB'))
    assert array.shape==(600,800,3)
    viewed.append({'path':(folder/filename).relative_to(ROOT).as_posix(),'sha256':hashes[filename],
        'size':[800,600],'viewedAtOriginalDetail':True})
    result['cases'].append({'label':label,'path':(folder/filename).relative_to(ROOT).as_posix(),
        'sha256':hashes[filename],'traceSha256':hashes['trace.json'],'provenance':trace['provenance'],
        'options':trace['options'],'viewport':trace['viewport'],'frameCount':len(trace.get('frames',[])),
        'starting':{k:trace['starting'][k] for k in ['levelName','moveCount','mode','moving','winning','camera','player']},
        'regions':[{'label':name,**measure(native,array,roi,label=='static end')} for name,roi in rois],
        'flatInteriors':[{'label':name,**{k:v for k,v in measure(native,array,roi).items() if k!='edgeAcceptance'}} for name,roi in flat],
        'neighbors':[{'xy':[x,y],'native':native[y,x].tolist(),'v7':array[y,x].tolist()} for x,y in
            [(428,321),(425,321),(431,321),(428,318),(428,324),(323,382),(320,382),(326,382),(323,379),(323,385)]]})
    if label=='static end':
        static=array

plate=Image.new('RGB',(580,30+sum(roi[3]-roi[1]+30 for _,roi in rois)),(32,32,32))
draw=ImageDraw.Draw(plate)
draw.text((8,5),'Native left / frozen e04a40c v7 static end right; unscaled',fill='white')
y=28
for name,roi in rois:
    draw.text((8,y),name+' '+str(roi),fill='white')
    plate.paste(Image.fromarray(native).crop(roi),(8,y+18))
    plate.paste(Image.fromarray(static).crop(roi),(300,y+18))
    y+=roi[3]-roi[1]+30
plate.save(HERE/'native-v7-static-crops.png')
manifest={'provenance':provenance,'actuallyViewedWholeImages':viewed,
    'unscaledDerivedPlate':'native-v7-static-crops.png','unscaledDerivedPlateActuallyViewedAtOriginalDetail':True,
    'notReviewed':['infexit motion phases','cardinal end/motion phase parity','other viewports/DPRs'],
    'metadataCaveat':'Cardinal options.revision retains historical 6427161/v4 label; source identity is verified from trace provenance plus hashed build manifest and frozen Git source.'}
write('manifest.json',manifest)
write('metrics.json',result)
write('hashes.json',{'algorithm':'SHA-256','files':{p.name:digest(p) for p in sorted(HERE.iterdir()) if p.is_file() and p.name!='hashes.json'}})
print(json.dumps({'provenanceVerified':True,'wholeImagesViewed':len(viewed),'cases':[{'label':case['label'],'regions':
    [{k:v for k,v in row.items() if k!='nonExactPixels'} for row in case['regions']]} for case in result['cases']]}))
