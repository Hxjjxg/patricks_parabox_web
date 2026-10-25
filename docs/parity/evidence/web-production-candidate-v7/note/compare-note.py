"""Bounded unscaled Note comparison using retained native reference ROIs."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
repo = root.parents[4]
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
prior_path = repo / 'docs/parity/evidence/web-native-note-after-dev/comparison.json'
prior = read(prior_path)
report = {'productionRevision': 'e04a40c5ee352bef46cb3fb309675a32f953cd67',
    'priorComparisonSha256': sha(prior_path), 'boundsConvention': 'inclusive ink extrema; add1 to maxima for half-open bounds',
    'method': 'Same retained physical ROIs, no scaling or offset. Established threshold150 reports actual support; independent void particle phases affect alpha-composited edge support. No new tolerance or pixel-equality acceptance.',
    'activation': 'Each viewport starts with empty isolated save; actual Hub RDD then physical Down40ms enters first_puzzle and establishes Intro controls. Subsequent debug API third_puzzle load preserves real controlsFromIntro; no transient field injection.',
    'limits': 'Three unit-resolution Note samples only. Unity general wrapping, arbitrary DPR, unmatched void phases and whole-Canvas parity remain unverified.', 'pairs': []}
plate = Image.new('RGB', (540, 270), (32,32,32))
draw = ImageDraw.Draw(plate)
draw.text((8,4), 'Native / previous bounded Note / immutable v7 (unscaled)', fill='white')
for index, pair in enumerate(prior['pairs']):
    size = 'x'.join(map(str,pair['viewport']))
    paths = [repo / pair['paths'][0], repo / pair['paths'][2], root / size / 'third/end.png']
    roi = pair['crop']
    arrays = [np.asarray(Image.open(p).convert('RGB')) for p in paths]
    bands = { '800x600': [(458,481),(481,503)], '1001x733': [(558,587),(587,612)], '1280x720': [(576,610),(610,639)] }[size]
    supports = []
    for arr in arrays:
        measured = []
        for y1,y2 in bands:
            ys,xs = np.where(arr[y1:y2,roi[0]:roi[2]].min(axis=2) > 150)
            measured.append([int(xs.min()+roi[0]),int(ys.min()+y1),int(xs.max()+roi[0]),int(ys.max()+y1)] if len(xs) else None)
        supports.append(measured)
    y = 25 + index*78
    draw.text((8,y),size,fill='white')
    for col,arr in enumerate(arrays):
        plate.paste(Image.fromarray(arr).crop(roi),(8+col*175,y+15))
    report['pairs'].append({'viewport':pair['viewport'],'physicalDpr':1,'crop':roi,
        'paths':[p.relative_to(repo).as_posix() for p in paths], 'sha256':[sha(p) for p in paths],
        'threshold150LineSupportNativePriorFinal':supports,
        'nativeFinalBottomRowsEqual':[supports[0][j][3]==supports[2][j][3] for j in range(2)],
        'scope':'Actual glyph support only; changed particles are retained and not fitted away.'})
plate.save(root / 'native-final-crops.png')
report['plate']={'path':(root/'native-final-crops.png').relative_to(repo).as_posix(),'sha256':sha(root/'native-final-crops.png')}
(root/'comparison.json').write_text(json.dumps(report,indent=2)+chr(10),encoding='utf-8')
print(json.dumps(report,indent=2))
