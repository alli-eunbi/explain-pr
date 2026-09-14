import test from 'node:test';
import assert from 'node:assert/strict';

let api;
try { api = await import('../src/game-keys.js'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
function action(key, context = {}, event = {}) {
  assert.ok(api, 'Game keyboard actions must be implemented');
  return api.gameKeyAction({ key, ...event }, { mode: 'follow', outgoing: [], routes: [], selectedIndex: 0, hasHistory: false, ...context });
}
const failure = { from: 'payment', to: 'failed', label: '결제 실패', kind: 'failure' };
const success = { from: 'payment', to: 'save', label: '결제 성공', kind: 'normal' };
const retry = { from: 'payment', to: 'payment', label: '재시도', kind: 'normal' };
const outgoing = [failure, success, retry];

const routes = [{ edge: failure, x: 160, y: -80 }, { edge: success, x: -120, y: -80 }, { edge: retry, x: 5, y: -200 }];
test('up and W immediately follow the most forward screen route, not authored order', () => {
  assert.deepEqual(action('ArrowUp', { outgoing: [success], routes: [{ edge: success, x: 10, y: -80 }] }), { type: 'advance', edge: success });
  assert.deepEqual(action('w', { outgoing, routes }), { type: 'advance', edge: retry });
  assert.deepEqual(action('W', { outgoing, routes }), { type: 'advance', edge: retry });
  assert.equal(action('ArrowUp'), null);
});
test('left/right and A/D immediately advance to the screen side, including failure', () => {
  assert.deepEqual(action('ArrowLeft', { outgoing, routes }), { type: 'advance', edge: success });
  assert.deepEqual(action('d', { outgoing, routes }), { type: 'advance', edge: failure });
  assert.deepEqual(action('a', { outgoing, routes }), { type: 'advance', edge: success });
  assert.deepEqual(action('ArrowRight', { outgoing, routes }), { type: 'advance', edge: failure });
  assert.equal(action('ArrowRight', { outgoing: [success] }), null);
});
test('screen routes preserve authored edges and tie order even when destinations overlap', () => {
  assert.deepEqual(action('w', { outgoing, routes: outgoing.map(edge => ({ edge, x: 0, y: -100 })) }), { type: 'advance', edge: failure });
  const foreign = { to: 'invented' };
  assert.deepEqual(action('w', { outgoing, routes: [{ edge: foreign, x: 0, y: -100 }, ...routes] }), { type: 'advance', edge: retry });
  assert.equal(action('w', { outgoing, routes: [] }), null, 'Missing screen evidence must not invent a direction');
});
test('behind-camera routes cannot win forward or either side while authored edges remain intact', () => {
  const visible = [{ edge: success, x: -30, y: -60, visible: true }, { edge: failure, x: 30, y: -60, visible: true }];
  for (const [key, x] of [['w', 0], ['a', -999], ['d', 999]]) {
    const result = action(key, { outgoing, routes: [...visible, { edge: retry, x, y: -300, visible: false }] });
    assert.notEqual(result?.edge, retry, `${key} cannot select an invisible destination`);
  }
  assert.equal(outgoing.length, 3);
  assert.equal(action('w', { outgoing, routes: [{ edge: retry, x: 0, y: -100, visible: false }] }), null);
});
test('down and S request backtracking only when history exists', () => {
  assert.deepEqual(action('ArrowDown', { hasHistory: true }), { type: 'previous' });
  assert.deepEqual(action('s', { hasHistory: true }), { type: 'previous' });
  assert.equal(action('ArrowDown'), null);
});
test('game input leaves overview, dialogs and focused controls untouched', () => {
  for (const context of [{ mode: 'overview' }, { dialogOpen: true }, { interactiveFocus: true }]) {
    for (const key of ['ArrowUp', 'w', 'ArrowLeft', 'd', 'ArrowDown', 's']) {
      assert.equal(action(key, { outgoing, hasHistory: true, ...context }), null);
    }
  }
});
test('a second movement key is ignored during a hop instead of teleporting', () => {
  assert.equal(action('w', { outgoing, routes, animating: true }), null);
  assert.equal(action('s', { hasHistory: true, animating: true }), null);
});
test('held, composing, modified or already handled keys cannot accidentally jump', () => {
  for (const event of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { defaultPrevented: true }]) {
    assert.equal(action('ArrowUp', { outgoing }, event), null);
  }
  assert.equal(action('Enter', { outgoing }), null);
});
