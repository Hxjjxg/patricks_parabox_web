"""Separate raw native2x/WebDPR2 comparison; preserves the native1x report."""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('static_compare',Path(__file__).with_name('parity-static-compare.py'))
CMP=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(CMP)

def physical_labels(value):
    names={'xyCss':'xyPhysical','oneCssPixelNativeRect':'oneFramebufferPixelNativeRect',
        'oneCssPixelWebRect':'oneFramebufferPixelWebRect','referenceRoiBoardCss':'referenceRoiBoardPhysical',
        'fractionalTileCss':'fractionalTilePhysical','cssBoxExclusive':'framebufferBoxExclusive'}
    if isinstance(value,list):return [physical_labels(v) for v in value]
    if isinstance(value,dict):return {names.get(k,k):physical_labels(v) for k,v in value.items()}
    return value

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report',type=Path,default=CMP.PROJECT/'docs/parity/static-v4-analysis.json')
    parser.add_argument('--native-root',type=Path,default=CMP.EVIDENCE/'original')
    parser.add_argument('--output',type=Path,default=CMP.PROJECT/'docs/parity/static-v4-analysis.physical.json')
    parser.add_argument('--require-complete',action='store_true')
    args=parser.parse_args();old=CMP.read_json(args.report)
    results=[];missing=[];rejected=[];rechecks=[]
    for case in old['cases']:
        if case['dpr']!=2:continue
        level=case['level'];width,height=map(int,case['viewport'].split('-')[0].split('x'))
        pw,ph=width*2,height*2
        folder=args.native_root/f"native-framebuffer-{pw}x{ph}-{level.replace('_','-')}-v15-20261025"
        required=[folder/f'static-{i}.png' for i in range(3)]+[folder/name for name in ('capture.json','state.json','resolution-request.json')]
        absent=[str(p.relative_to(CMP.PROJECT)) for p in required if not p.is_file()]
        if absent:missing.append({'level':level,'cssViewport':case['viewport'],'missing':absent});continue
        capture,state,resolution=[CMP.read_json(p) for p in required[3:]]
        dims={'static-'+str(i)+'.png':[pw,ph] for i in range(3)}
        native_verified=(capture.get('level')==level and capture.get('screenWidth')==pw and capture.get('screenHeight')==ph
            and state.get('levelName')==level and state.get('moveCount')==0 and state.get('trace')==[]
            and resolution.get('requested')==[pw,ph] and resolution.get('actualScreen')==[pw,ph]
            and resolution.get('pngDimensions')==dims and resolution.get('resampled') is False
            and resolution.get('drawLogicChanged') is False)
        if not native_verified:
            rejected.append({'level':level,'cssViewport':case['viewport'],
                'reason':'Actual native dimensions or fresh-state metadata do not verify requested physical condition',
                'requestedPhysical':[pw,ph],'capturePhysical':[capture.get('screenWidth'),capture.get('screenHeight')],
                'resolutionEvidence':resolution,'metadataInputs':[CMP.file_record(p) for p in required[3:]]})
            continue
        for record in case['webInputs']+[case['metadataInput']]:
            if CMP.file_record(CMP.PROJECT/record['path'])['sha256']!=record['sha256']:
                raise ValueError('Immutable Web input changed: '+record['path'])
        # Reuse the established comparison unchanged at scale1 physical pixels.
        # Both arrays are pw x ph. No numerical resize or averaging occurs.
        CMP.native_directory=lambda _level,_width,_height,folder=folder:folder
        result=CMP.compare_case(level,pw,ph,1,[CMP.PROJECT/r['path'] for r in case['webInputs']],CMP.PROJECT/case['metadataInput']['path'])
        result=physical_labels(result)
        result['framebufferExtent']=result.pop('viewport').split('-')[0]
        result['comparisonScale']=result.pop('dpr')
        result['framebufferSampling']=result.pop('physicalSampling')
        result['webDpr']=2
        result['cssViewport']=case['viewport'];result['nativeFramebuffer']=[pw,ph]
        result['comparisonCoordinates']='physical framebuffer pixels, scale1'
        result['nativeMetadataVerified']=native_verified
        result['nativeMetadataInputs']=[CMP.file_record(p) for p in required[3:]]
        for obj,sides in case['borderRunDifferences'].items():
            for side,historical in sides.items():
                now=result['borderRunDifferences'].get(obj,{}).get(side)
                rechecks.append({'level':level,'cssViewport':case['viewport'],'object':obj,'side':side,
                    'historicalNative1xVsWebDpr2Css':historical,
                    'matchedPhysicalNativeVsWeb':now,'exactBorderSupportMatches':now is None})
        results.append(result)
    summary={'expectedConditions':10,'completedConditions':len(results),'missingConditions':len(missing),'rejectedConditions':len(rejected),
        'completeConditionSet':len(results)==10 and not missing and not rejected,
        'nativeMetadataAllVerified':all(r['nativeMetadataVerified'] for r in results),
        'allBackingCorrect':all(r['backingCorrect'] for r in results),
        'allWebFreshStatesCorrect':all(r['freshStatesCorrect'] for r in results),
        'allBorderNativeRepeatsStable':all(r['borderNativeRepeatStable'] for r in results),
        'allBorderWebRepeatsStable':all(r['borderWebRepeatVerified'] for r in results),
        'borderSidesDifferingMatchedPhysical':sum(sum(map(len,r['borderRunDifferences'].values())) for r in results),
        'historicalDpr2Differences':old['summary']['borderSidesDifferingDpr2'],
        'historicalDifferencesRechecked':len(rechecks),
        'historicalDifferencesNowMatching':sum(r['exactBorderSupportMatches'] for r in rechecks),
        'flatNativeWallSamples':sum(r['wallSamples']['flatNativeInteriorSampleCount'] for r in results),
        'flatNativeWallOutside1':sum(len(r['wallSamples']['flatNativeInteriorOutside1']) for r in results),
        'flatNativeFloorSamples':sum(r['floorSamples']['flatNativeInteriorSampleCount'] for r in results),
        'flatNativeFloorOutside1':sum(len(r['floorSamples']['flatNativeInteriorOutside1']) for r in results),
        'joinSites':sum(r['joinCount'] for r in results),'joinMeasurements':sum(r['joinMeasurements'] for r in results),
        'suspectJoins':sum(len(r['suspectJoins']) for r in results)}
    out={'method':'Separate matched physical framebuffer comparison: actual native2x versus raw WebDPR2 at identical PNG dimensions. Existing comparator at physical scale1, same RGB1 flat-interior tolerance and seam thresholds. No resampling, alignment or new tolerance.',
        'limits':'Does not replace native1x report or grant independent visual approval. Physical sample counts are a separate condition set. Adjacent unsynchronized particles and blink state are not globally accepted.',
        'historical1xReport':CMP.file_record(args.report),'script':CMP.file_record(Path(__file__)),
        'comparator':CMP.file_record(Path(CMP.__file__)),'summary':summary,'missingInputs':missing,'rejectedInputs':rejected,
        'cases':results,'historicalBorderRechecks':rechecks}
    args.output.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,indent=2))
    if args.require_complete and (len(results)!=10 or len(rechecks)!=old['summary']['borderSidesDifferingDpr2']):
        raise SystemExit('Complete10-condition native physical capture set required; partial report retained')

if __name__=='__main__':main()
