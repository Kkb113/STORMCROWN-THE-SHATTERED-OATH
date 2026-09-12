import test from 'node:test';
import assert from 'node:assert/strict';
import { displayPose } from '../src/render/motion.js';

test('rendering between simulation ticks is continuous and does not change gameplay state',()=>{
  const entity=Object.freeze({x:4,y:2,z:8,prevX:2,prevY:0,prevZ:4,angle:.4,prevAngle:0});
  const out={};
  assert.equal(displayPose(entity,.5,out),out,'reuse the presentation buffer');
  assert.equal(out.x,3);assert.equal(out.y,1);assert.equal(out.z,6);
  assert.ok(Math.abs(out.angle-.2)<1e-10);
  assert.equal(entity.x,4);
  const nearEnd=displayPose(entity,.999).x;
  const next={...entity,prevX:4,x:6};
  assert.ok(Math.abs(displayPose(next,0).x-nearEnd)<.003);
});

test('turning through the angle seam takes the short route',()=>{
  const angle=displayPose({prevAngle:Math.PI-.1,angle:-Math.PI+.1},.5).angle;
  assert.ok(Math.abs(angle-Math.PI)<1e-10);
});

test('new entities and paused frames use valid endpoint poses',()=>{
  const entity={x:7,z:-12,angle:.4};
  assert.deepEqual(displayPose(entity,0),{x:7,y:0,z:-12,angle:.4});
  assert.equal(displayPose({...entity,prevX:0},2).x,7);
  assert.equal(displayPose({...entity,prevX:0},NaN).x,7);
  assert.equal(displayPose({...entity,prevX:0},-1).x,0);
});
