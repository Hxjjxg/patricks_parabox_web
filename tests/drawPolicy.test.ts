import {describe,expect,it} from 'vitest';
import {meetsNativeDrawSize,nativeDrawPolicy} from '../src/render/drawPolicy';

describe('original physical pixel draw policy',()=>{
 it('ports the exact default and scene specific float thresholds',()=>{
  const f=Math.fround;
  expect(nativeDrawPolicy('first_puzzle',800,600)).toEqual({minDrawSize:1,minParticleSize:f(600*f(.0005)),maxDepthMovingBlocks:-1,suppressIiiEffects:false});
  expect(nativeDrawPolicy('infenter_zone_v2',800,600).minDrawSize).toBe(5.399999618530273);
  expect(nativeDrawPolicy('3by3_fun_clone_heist',800,600)).toEqual({minDrawSize:f(600*f(.013)),minParticleSize:f(600*f(.01)),maxDepthMovingBlocks:2,suppressIiiEffects:false});
  expect(nativeDrawPolicy('iii',800,600)).toEqual({minDrawSize:f(600*f(.003)),minParticleSize:f(600*f(.003)),maxDepthMovingBlocks:-1,suppressIiiEffects:true});
 });
 it('converts physical cutoffs to CSS units without imposing a particle pixel floor',()=>{
  expect(nativeDrawPolicy('first_puzzle',800,600,2).minDrawSize).toBe(.5);
  expect(nativeDrawPolicy('first_puzzle',800,600).minParticleSize).toBeLessThan(1);
  expect(nativeDrawPolicy('infenter_zone_v2',800,600,2).minDrawSize).toBe(nativeDrawPolicy('infenter_zone_v2',800,600).minDrawSize);
 });
 it('accepts either dimension at the exact boundary, including thin rectangles',()=>{
  const min=nativeDrawPolicy('infenter_zone_v2',800,600).minDrawSize;
  expect(meetsNativeDrawSize(min,.01,min)).toBe(true);expect(meetsNativeDrawSize(.01,min,min)).toBe(true);
  expect(meetsNativeDrawSize(min-Number.EPSILON*min,min-Number.EPSILON*min,min)).toBe(false);
 });
});
