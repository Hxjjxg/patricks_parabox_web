"""Prepare the focused recursive replay using existing natural-frame capture code.

Does not drive a browser. Evaluate its output through DevTools, then poll
window.__coreRecursiveRun. Raw reports go to the local capture sink.
"""
from pathlib import Path
from copy import deepcopy
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[1]
evidence = root / 'docs/parity/evidence/core-gameplay-final-20261102'
evidence.mkdir(parents=True, exist_ok=True)
old = json.loads((root / 'docs/parity/evidence/web-production-candidate-v7/replay-plan.json').read_text(encoding='utf-8-sig'))
names = ['enter', 'exit', 'carry', 'cycle', 'infexit', 'infinity', 'clone', 'possess', 'flip-first', 'flip']
plan = [{'name': name, 'options': deepcopy(next(x['options'] for x in old if x['path'] == 'mechanics/' + name))} for name in names]
plan += [
    {'name': 'infexit-player', 'options': {**plan[4]['options'], 'setup': 'DLLDRRRRUR'}},
    {'name': 'terminal', 'options': {**plan[0]['options'], 'level': 'infenter_poswall_setup', 'setup': 'LLL'}},
    {'name': 'strict-enter', 'options': {**plan[5]['options'], 'setup': 'DD',
        'events': [{'at': 0, 'key': 'ArrowDown', 'duration': 40}]}},
]
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
files = ['src/GameController.ts', 'src/core/movement.ts', 'src/core/animation.ts',
         'src/render/GameRenderer.ts', 'src/render/wallRendering.ts', 'scripts/parity-capture-web.js']
source = {'revision': revision, 'sha256': {f: hashlib.sha256((root/f).read_bytes()).hexdigest() for f in files}}
for item in plan:
    item['options']['revision'] = revision
    item['options']['inputMethod'] = 'Synthetic DOM keyboard; debug API setup; natural browser rAF'
    if item['name'] == 'terminal':
        item['options']['events'][0]['key'] = 'ArrowRight'
capture = (root / 'scripts/parity-capture-web.js').read_text(encoding='utf-8-sig')
script = '''() => {
  if (window.__coreRecursiveRun?.running) throw new Error('Replay already running');
  window.__coreRecursiveRun = { running: true, completed: [], error: null };
  const status = window.__coreRecursiveRun;
  (async () => {
    const plan = PLAN, capture = (CAPTURE), source = SOURCE, retained = RETAINED;
    for (const item of plan) {
      if (retained.includes(item.name)) continue;
      status.current = item.name;
      window.PARITY_OPTIONS = item.options;
      const report = await capture();
      report.source = source;
      report.inputMethod = item.options.inputMethod;
      report.relevantFinalBlocks = window.__PARABOX__.world().blocks.map(b => ({
        id:b.id, x:b.x, y:b.y, outer:b.outerLevel?.id, sub:b.subLevel?.id,
        isPlayer:b.isPlayer, flipH:b.flipH, isInfExit:b.isSomeInfExitBlock
      }));
      const response = await fetch('http://127.0.0.1:4181/capture/recursive-' + item.name, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(report)
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(saved));
      status.completed.push({name:item.name, saved, starting:report.starting, ending:report.ending});
    }
  })().catch(e => { status.error = String(e.stack || e); }).finally(() => { status.running = false; });
  return {started:true};
}'''.replace('PLAN', json.dumps(plan)).replace('CAPTURE', capture).replace('SOURCE', json.dumps(source)).replace('RETAINED', json.dumps([x['name'] for x in plan if (evidence / ('recursive-' + x['name']) / 'trace.json').exists()]))
(evidence / 'recursive-plan.json').write_text(json.dumps({'source': source, 'cases': plan}, indent=2) + '\n', encoding='utf-8')
(evidence / 'recursive-runner.js').write_text(script, encoding='utf-8')
print(json.dumps({'runner': str(evidence / 'recursive-runner.js'), 'cases': len(plan), 'source': source}))
