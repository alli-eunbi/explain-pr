import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import * as scene from '../src/scene.js';
let camera;
try { camera = await import('../src/chase-camera.js'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
test('follow camera uses the fixed overview diagonal at a 40–45 degree elevation', () => {
  assert.equal(typeof camera.followCameraOffset, 'function');
  const offset = camera.followCameraOffset(10);
  const pitch = Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) * 180 / Math.PI;
  assert.ok(pitch >= 40 && pitch <= 45);
  assert.ok(Math.abs(offset.x / offset.z + 11 / 12) < 1e-9);
  assert.ok(Math.abs(Math.hypot(offset.x, offset.y, offset.z) - 10) < 1e-9);
  const farther = camera.followCameraOffset(20);
  assert.deepEqual(farther, {x:offset.x*2,y:offset.y*2,z:offset.z*2});
});
test('follow target translates with the current platform without depending on robot turns or hop height', () => {
  assert.equal(typeof camera.followCameraTarget, 'function');
  const start = camera.followCameraTarget({x:0,y:0,z:0});
  const next = camera.followCameraTarget({x:7.3,y:8,z:3.65});
  assert.ok(Math.abs(next.x-start.x-7.3)<1e-9);
  assert.ok(Math.abs(next.z-start.z-3.65)<1e-9);
  assert.equal(next.y,start.y);
});
test('demo current platform, robot and both outgoing platforms fit desktop and mobile projections', async () => {
  assert.equal(typeof scene.layout, 'function');
  const report=JSON.parse(await readFile(new URL('../examples/demo.json',import.meta.url),'utf8'));
  const flow=report.flows[0],{positions}=scene.layout(flow),current=positions.get('charge');
  const target=new THREE.Vector3().copy(camera.followCameraTarget(current));
  const distance=camera.FOLLOW_VIEW_HEIGHT/(2*Math.tan(THREE.MathUtils.degToRad(camera.FOLLOW_FOV/2)));
  const offset=new THREE.Vector3().copy(camera.followCameraOffset(distance));
  const points=[];
  for(const id of ['charge',...flow.edges.filter(edge=>edge.from==='charge').map(edge=>edge.to)]) {
    for(const x of [-1.4,1.4])for(const z of [-1.4,1.4])points.push({id,point:positions.get(id).clone().add(new THREE.Vector3(x,1.35,z))});
  }
  points.push({id:'robot head',point:current.clone().add(new THREE.Vector3(-.67,3.95,-.68))});
  for(const [width,height] of [[1046,690],[886,590],[390,350],[390,500]]) {
    const view=new THREE.PerspectiveCamera(camera.FOLLOW_FOV,width/height,.1,250);
    view.position.copy(target).add(offset);view.lookAt(target);view.updateMatrixWorld();
    for(const {id,point} of points){const p=point.clone().project(view);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>=-1&&p.z<=1,`${width}×${height}: ${id} is outside the frustum (${p.toArray()})`);}
  }
});
test('terminal and self-loop retain last heading while actual travel turns the robot', () => {
  assert.ok(camera, 'Ground heading camera geometry must exist');
  const start = { x: 4, z: 3 };
  assert.equal(camera.travelHeading(start, start, 1.2), 1.2);
  assert.equal(camera.travelHeading(start, { x: 5, z: 3 }, 0), Math.PI / 2);
  assert.equal(camera.travelHeading(start, { x: 4, z: 5 }, 1.2), 0);
});
test('arrival looks toward next platforms after backtracking and keeps terminal heading', () => {
  assert.equal(typeof camera.arrivalHeading, 'function');
  const at = { x: 0, z: 0 };
  assert.equal(camera.arrivalHeading(at, [{ x: 4, z: 0 }], -Math.PI / 2), Math.PI / 2);
  assert.equal(camera.arrivalHeading(at, [], 1.2), 1.2);
  assert.equal(camera.arrivalHeading(at, [at], 1.2), 1.2);
  assert.ok(Math.abs(camera.arrivalHeading(at, [{ x: 4, z: 0 }, { x: 0, z: 4 }], 0) - Math.PI / 4) < 1e-9);
});
