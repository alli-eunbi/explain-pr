import test from 'node:test';
import assert from 'node:assert/strict';
let layout;
try { layout = await import('../src/label-layout.js'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
test('a destination label moves outside the avatar while staying inside the scene', () => {
  assert.ok(layout, 'Avatar-safe label placement must exist');
  const avatar={x:220,y:100,width:180,height:270};
  const label=layout.placeLabel({x:210,y:190,width:136,height:90},[avatar],{width:650,height:500});
  assert.equal(overlaps(label,avatar),false);
  assert.ok(label.x>=0 && label.x+label.width<=650 && label.y>=0 && label.y+label.height<=500);
});
test('a mobile label avoids both the avatar and an already placed route label', () => {
  assert.ok(layout, 'Avatar-safe label placement must exist');
  const obstacles=[{x:115,y:120,width:170,height:270},{x:4,y:160,width:105,height:80}];
  const label=layout.placeLabel({x:90,y:190,width:120,height:80},obstacles,{width:390,height:550,top:60});
  assert.ok(obstacles.every(obstacle=>!overlaps(label,obstacle)));
  assert.ok(label.x>=0 && label.x+label.width<=390 && label.y>=60 && label.y+label.height<=550);
});
test('a crowded annotation reports no room instead of covering readable labels', () => {
  assert.equal(layout.placeLabel({x:20,y:20,width:100,height:60},[{x:0,y:0,width:200,height:200}],{width:200,height:200}),null);
});
test('zooming a platform gives its wrapped label more room within readable bounds',()=>{
  assert.equal(typeof layout.labelWidth,'function');
  assert.ok(layout.labelWidth(260,1000)>layout.labelWidth(130,1000));
  assert.ok(layout.labelWidth(25,390)>=100);
  assert.ok(layout.labelWidth(2000,390)<=300);
});
