import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {layout} from '../src/scene.js';
let routing;
try { routing=await import('../src/edge-routing.js'); } catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
const positions=new Map([['a',{x:0,z:0}],['b',{x:3.65,z:0}],['c',{x:7.3,z:0}],['failure',{x:.8,z:3.65}]]);
function route(edges){assert.ok(routing,'Obstacle-aware edge routing must exist');return routing.routeEdges(edges,positions);}
function assertClear(result){
  for(let i=1;i<result.points.length;i++)for(const [id,p] of positions){
    assert.equal(routing.segmentHitsBox(result.points[i-1],result.points[i],{minX:p.x-1.5,maxX:p.x+1.5,minZ:p.z-1.5,maxZ:p.z+1.5}),false,`route crosses platform ${id}`);
  }
}
test('a skipped platform is routed around with explicit source and destination ports',()=>{
  const [result]=route([{from:'a',to:'c',kind:'normal',label:'직접 완료'}]);
  assertClear(result);
  for(const [point,id] of [[result.points[0],'a'],[result.points.at(-1),'c']]){
    const p=positions.get(id);assert.ok(Math.abs(Math.max(Math.abs(point.x-p.x),Math.abs(point.z-p.z))-1.62)<1e-6);
  }
  const tail=result.points.at(-1),before=result.points.at(-2),destination=positions.get('c');
  assert.ok((tail.x-before.x)*(destination.x-tail.x)+(tail.z-before.z)*(destination.z-tail.z)>0,'arrow enters the destination face');
});
test('every authored demo edge has a clear routed path and its own condition anchor',async()=>{
  assert.ok(routing);
  const report=JSON.parse(await readFile(new URL('../examples/demo.json',import.meta.url),'utf8'));
  for(const flow of report.flows){
    const {positions:placed}=layout(flow),results=routing.routeEdges(flow.edges,placed);
    assert.equal(results.length,flow.edges.length);
    for(const result of results){
      assert.equal(result.raised,false);
      for(let i=1;i<result.points.length;i++)for(const p of placed.values())assert.equal(routing.segmentHitsBox(result.points[i-1],result.points[i],{minX:p.x-1.5,maxX:p.x+1.5,minZ:p.z-1.5,maxZ:p.z+1.5}),false);
    }
  }
});
test('normal, failure, rejoin and retry routes all retain their authored edge identity',()=>{
  const edges=[{from:'a',to:'b',kind:'normal',label:'성공'},{from:'a',to:'failure',kind:'failure',label:'실패'},
    {from:'failure',to:'c',kind:'normal',label:'합류'},{from:'c',to:'a',kind:'normal',label:'재시도'},
    {from:'b',to:'b',kind:'failure',label:'현재 단계에서 재시도'}];
  const results=route(edges);assert.equal(results.length,edges.length);
  results.forEach((result,i)=>{assert.equal(result.edge,edges[i]);assertClear(result);assert.ok(result.points.length>=2);assert.ok(Number.isFinite(result.label.x)&&Number.isFinite(result.label.z));});
  assert.notDeepEqual(results.at(-1).points[0],results.at(-1).points.at(-1));
});
test('two conditions sharing a destination use distinguishable paths without dropping either',()=>{
  const results=route([{from:'a',to:'c',kind:'normal',label:'조건 하나'},{from:'a',to:'c',kind:'failure',label:'조건 둘'}]);
  assert.notDeepEqual(results[0].points,results[1].points);results.forEach(assertClear);
});
test('straight route pieces do not cut a sharp corner and the cone tip meets the destination',()=>{
  assert.equal(typeof routing.routePrimitives,'function');
  const points=[{x:0,y:1,z:0},{x:2,y:1,z:0},{x:2,y:1,z:2}];
  const result=routing.routePrimitives(points,false);
  assert.equal(result.segments.length,2);
  assert.deepEqual(result.joints,[points[1]]);
  assert.deepEqual(result.arrow.tip,points.at(-1));
  const {center,direction,length}=result.arrow;
  assert.ok(Math.abs(center.z+direction.z*length/2-2)<1e-8);
  assert.equal(direction.x,0);assert.equal(direction.z,1);
});
test('dashes crossing a bend split at the corner instead of drawing a diagonal chord',()=>{
  assert.equal(typeof routing.routePrimitives,'function');
  const points=[{x:0,y:1,z:0},{x:.2,y:1,z:0},{x:.2,y:1,z:2}];
  const result=routing.routePrimitives(points,true);
  assert.ok(result.joints.some(point=>point.x===.2&&point.z===0));
  for(const segment of result.segments)assert.ok(segment.from.x===segment.to.x||segment.from.z===segment.to.z,'no diagonal dash shortcut');
  assert.ok(result.segments.every(segment=>Math.hypot(segment.from.x-segment.to.x,segment.from.z-segment.to.z)>0));
});
test('redundant straight stubs do not shrink arrows or introduce zero-length geometry',()=>{
  assert.equal(typeof routing.routePrimitives,'function');
  const result=routing.routePrimitives([{x:0,y:1,z:0},{x:0,y:1,z:0},{x:0,y:1,z:1.9},{x:0,y:1,z:2}],false);
  assert.equal(result.segments.length,1);
  assert.ok(result.arrow.length>.4);
  assert.deepEqual(result.arrow.tip,{x:0,y:1,z:2});
});
test('nearby offset destinations still leave a readable straight arrow approach',()=>{
  const placed=new Map([['a',{x:3.65,z:0}],['b',{x:4.45,z:3.65}]]);
  const [result]=routing.routeEdges([{from:'a',to:'b',kind:'failure'}],placed);
  assert.ok(routing.routePrimitives(result.points,true).arrow.length>=.24);
});
test('opposite arrows in the same short corridor use parallel lanes at the platform height',()=>{
  const placed=new Map([['a',{x:0,z:0}],['b',{x:3.65,z:0}]]);
  const [forward,reverse]=routing.routeEdges([{from:'a',to:'b',kind:'normal'},{from:'b',to:'a',kind:'normal'}],placed);
  assert.equal(forward.points[0].y,reverse.points[0].y);
  assert.ok(Math.abs(forward.points[0].z-reverse.points[0].z)>=.4);
  assert.equal(routing.routePrimitives(forward.points).arrow.direction.x,1);
  assert.equal(routing.routePrimitives(reverse.points).arrow.direction.x,-1);
});
