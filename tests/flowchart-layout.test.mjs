import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let api;
try {api=await import('../src/flowchart-layout.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
function plan(flow){assert.equal(typeof api?.buildFlowchart,'function');return api.buildFlowchart(flow);}
test('normal entry path reads top to bottom while each authored branch remains beside its source',()=>{
  const nodes=['entry','check','done','failure'].map(id=>({id,title:id,output:id+' result'}));
  const edges=[{from:'entry',to:'check',kind:'normal',label:'검사'},
    {from:'check',to:'done',kind:'normal',label:'통과'},
    {from:'check',to:'failure',kind:'failure',label:'실패'}];
  const result=plan({entry:'entry',nodes,edges});
  assert.deepEqual(result.rows.map(row=>row.node.id),['entry','check','done','failure']);
  assert.equal(result.rows[1].primary.edge,edges[1]);
  assert.equal(result.rows[1].branches[0].edge,edges[2]);
  assert.equal(result.rows[1].branches[0].destination,nodes[3]);
  assert.equal(result.rows[1].branches[0].destination.output,'failure result');
});
test('shared sinks, self loops and return edges point at canonical node identity without losing conditions',()=>{
  const nodes=['a','b','error'].map(id=>({id,title:id}));
  const edges=[{from:'a',to:'b',kind:'normal',label:'진행'},
    {from:'a',to:'error',kind:'failure',label:'입력 오류'},
    {from:'b',to:'error',kind:'failure',label:'저장 오류'},
    {from:'b',to:'a',kind:'normal',label:'다시 시작'},
    {from:'b',to:'b',kind:'normal',label:'현재 재시도'}];
  const result=plan({entry:'a',nodes,edges});
  const all=result.rows.flatMap(row=>[row.primary,...row.branches].filter(Boolean));
  assert.equal(all.length,edges.length);
  assert.deepEqual(new Set(all.map(item=>item.edge)),new Set(edges));
  assert.equal(all.find(item=>item.edge===edges[3]).relation,'return');
  assert.equal(all.find(item=>item.edge===edges[4]).relation,'repeat');
  for(const item of all.filter(item=>item.destination.id==='error'))assert.equal(item.shared,true);
  assert.equal(result.rows.filter(row=>row.node.id==='error').length,1);
});
test('demo flows preserve all original nodes and edges, including unread empty flow',async()=>{
  const report=JSON.parse(await readFile(new URL('../skills/explain-pr/examples/demo.json',import.meta.url),'utf8'));
  for(const flow of report.flows){
    const before=JSON.stringify(flow),result=plan(flow);
    assert.equal(result.rows.length,flow.nodes.length);
    assert.deepEqual(new Set(result.rows.map(row=>row.node)),new Set(flow.nodes));
    const all=result.rows.flatMap(row=>[row.primary,...row.branches].filter(Boolean));
    assert.deepEqual(new Set(all.map(item=>item.edge)),new Set(flow.edges));
    assert.equal(JSON.stringify(flow),before);
  }
});
test('an earlier result is a merge rather than a loop unless its path reaches the source again',()=>{
  const nodes=['entry','samples','response','skip'].map(id=>({id,title:id}));
  const edges=[{from:'entry',to:'samples',kind:'normal',label:'start'},
    {from:'samples',to:'response',kind:'normal',label:'done'},
    {from:'samples',to:'skip',kind:'failure',label:'skip'},
    {from:'skip',to:'samples',kind:'normal',label:'next'},
    {from:'skip',to:'response',kind:'normal',label:'all done'}];
  const result=plan({entry:'entry',nodes,edges});
  const branches=result.rows.find(row=>row.node.id==='skip').branches;
  assert.equal(branches[0].relation,'return');
  assert.equal(branches[1].relation,'forward');
});
