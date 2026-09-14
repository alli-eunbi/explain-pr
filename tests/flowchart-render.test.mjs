import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlowchart } from '../src/flowchart.js';

// Minimal DOM contract, not a browser/layout simulation: catch missing authored
// content, unsafe HTML writes and selection side effects without browser access.
class Element {
  constructor(tag, ownerDocument) {
    this.tagName = tag; this.ownerDocument = ownerDocument;
    this.children = []; this.dataset = {}; this.attributes = {}; this.events = {};
    this.className = ''; this.value = ''; this.scrolls = 0;
    this.style = { setProperty() {} };
    this.classList = { toggle: (name, enabled) => {
      const values = new Set(this.className.split(' ').filter(Boolean));
      enabled ? values.add(name) : values.delete(name);
      this.className = [...values].join(' ');
    } };
  }
  set innerHTML(_) { throw new Error('unsafe HTML write'); }
  set textContent(value) { this.value = String(value); this.children = []; }
  get textContent() { return this.value + this.children.map(child => child.textContent).join(''); }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.events[name] = listener; }
  scrollIntoView() { this.scrolls++; }
  focus() { this.ownerDocument.activeElement = this; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
const walk = root => [root, ...root.children.flatMap(walk)];
function mount() {
  const doc = { createElement: tag => new Element(tag, doc) };
  const container = doc.createElement('div'), inspected = [];
  return { container, inspected, view: createFlowchart({ container, onInspect: id => inspected.push(id) }) };
}

test('rendered demo and supplied PR preserve every node outcome and condition using original inspection IDs', async () => {
  const reports = [JSON.parse(await readFile(new URL('../examples/demo.json', import.meta.url), 'utf8'))];
  if (process.env.EXPLAIN_PR_TEST_REPORT) reports.push(JSON.parse(await readFile(process.env.EXPLAIN_PR_TEST_REPORT, 'utf8')));
  const { container, inspected, view } = mount();
  for (const flow of reports.flatMap(report => report.flows)) {
    view.setFlow(flow);
    for (const node of flow.nodes) {
      const cards = walk(container).filter(element => element.dataset.node === node.id);
      assert.ok(cards.length, node.id);
      for (const field of ['title', 'output']) assert.ok(cards[0].textContent.includes(node[field]), field);
      cards[0].events.click();
      assert.equal(inspected.at(-1), node.id);
    }
    for (const edge of flow.edges) assert.ok(container.textContent.includes(edge.label), edge.label);
    view.select(flow.entry);
    assert.ok(walk(container).every(element => element.scrolls === 0));
    assert.deepEqual(view.getRoutes(), []);
  }
  view.destroy();
  assert.equal(container.children.length, 0);
});

test('continuing branches retain conditions and explicit return links without invented adjacency', () => {
  const nodes = ['request', 'samples', 'response', 'skip', 'fatal', 'error'].map(id => ({ id, title: id, input: id, output: id === 'error' ? 'malformed_html' : id, changed: null }));
  const edges = [
    { from: 'request', to: 'samples', kind: 'normal', label: '있음' },
    { from: 'samples', to: 'response', kind: 'normal', label: '완료' },
    { from: 'samples', to: 'skip', kind: 'failure', label: '그 외 예외' },
    { from: 'samples', to: 'fatal', kind: 'failure', label: '새 오류' },
    { from: 'skip', to: 'samples', kind: 'normal', label: '다음 샘플' },
    { from: 'fatal', to: 'error', kind: 'normal', label: '전파' },
  ];
  const { container, view } = mount();
  view.setFlow({ entry: 'request', nodes, edges });
  for (const edge of edges) assert.ok(container.textContent.includes(edge.label));
  for (const text of ['malformed_html', '분기에서 이어지는 처리', '이후 처리 계속', '02 단계로 돌아감', '변경 여부 확인 못 함']) assert.ok(container.textContent.includes(text), text);
  const connectors = walk(container).filter(element => element.className === 'flowchart-primary');
  assert.equal(connectors.length, 2);
  const jump = walk(container).find(element => element.textContent === '04 단계의 1개 조건 보기');
  jump.events.click();
  assert.equal(walk(container).filter(element => element.dataset.node === 'skip' && element.scrolls).length, 1);
  assert.equal(container.ownerDocument.activeElement.dataset.node, 'skip');
});
