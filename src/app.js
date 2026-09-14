import { createLogicView } from './logic-view.js';
import { gameKeyAction } from './game-keys.js';
import { t, applyStatic } from './i18n.js';

const REPORT = window.__EXPLAIN_PR_REPORT__;
const MARKDOWN = window.explainPrMarkdown;
const $ = id => document.getElementById(id);
const STATUS = { reviewed: t('status.reviewed'), partial: t('status.partial'), unread: t('status.unread') };
const TESTS = { 'not-run': t('tests.not-run'), passed: t('tests.passed'), failed: t('tests.failed') };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeIndex = 0;
let current = null;
let history = [];
let visitedEdges = [];
let inspecting = false;
let mode = 'overview';
let detailSelection = null;

function element(tag, className = '', text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

const flow = () => REPORT.flows[activeIndex];
const currentNode = () => flow().nodes.find(node => node.id === current);
const outgoingEdges = () => flow().edges.filter(edge => edge.from === current);
const changeLabel = node => node.changed === true ? t('change.changed') : node.changed === false ? t('change.existing') : t('change.unknown');
const nodeNumber = nodeId => String(flow().nodes.findIndex(node => node.id === nodeId) + 1).padStart(2, '0');

function sourceURL(source) {
  if (REPORT.sample) return null;
  const pr = REPORT.pr;
  const parts = String(source.path).split('/');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(pr.repo) ||
      !['base', 'head'].includes(source.side) || !/^[a-f0-9]{40}$/i.test(pr[source.side]) ||
      parts.some(part => !part || part === '.' || part === '..') ||
      /[\\\x00-\x1f\x7f:]/.test(source.path) ||
      !Number.isSafeInteger(source.start) || source.start < 1 ||
      !Number.isSafeInteger(source.end) || source.end < source.start) return null;
  try {
    const url = new URL(pr.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        url.pathname.replace(/\/$/, '') !== `/${pr.repo}/pull/${pr.number}`) return null;
    const encoded = parts.map(part => encodeURIComponent(part).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())).join('/');
    return `${url.origin}/${pr.repo}/blob/${pr[source.side]}/${encoded}#L${source.start}${source.end > source.start ? '-L' + source.end : ''}`;
  } catch { return null; }
}

function sources(list, { expandFirst = false } = {}) {
  const wrapper = element('div', 'source-list');
  for (const [index, source] of (list || []).entries()) {
    const row = element('div', 'source');
    const href = sourceURL(source);
    const title = `${source.path}:${source.start}${source.end > source.start ? '–' + source.end : ''}`;
    const link = element(href ? 'a' : 'span', href ? '' : 'sample-source', title + (href ? ' ↗' : ''));
    if (href) { link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    const revision = REPORT.sample ? t('src.sampleRevision') : REPORT.pr[source.side].slice(0, 12);
    link.append(element('small', '', `${source.side === 'base' ? t('src.base') : t('src.head')} · ${revision}`));
    row.append(link);
    if (source.excerpt) {
      const details = element('details');
      details.open = expandFirst && index === 0;
      details.append(element('summary', '', t('src.excerpt')), element('pre', '', source.excerpt));
      row.append(details);
    }
    wrapper.append(row);
  }
  return wrapper;
}

function section(title) {
  const result = element('section', 'detail-section');
  result.append(element('h3', 'detail-label', title));
  return result;
}

const scene = createLogicView({
  container: $('sceneScroll'),
  reducedMotion: reducedMotion.matches,
  onInspect: nodeId => inspectNode(nodeId),
});

function inspectNode(nodeId) {
  if (!flow().nodes.some(node => node.id === nodeId)) return;
  current = nodeId;
  history = [];
  visitedEdges = [];
  inspecting = true;
  update(true);
}

function choose(edge) {
  if (!outgoingEdges().includes(edge)) return;
  history.push(current);
  visitedEdges.push(edge);
  if (history.length > 100) { history.shift(); visitedEdges.shift(); }
  current = edge.to;
  inspecting = false;
  update(true);
}

function previous() {
  if (!history.length) return;
  current = history.pop();
  visitedEdges.pop();
  inspecting = false;
  update(true);
}

function renderRouteSelection() {
  const outgoing = outgoingEdges();
  const routes = scene.getRoutes();
  const edge = gameKeyAction({ key: 'w' }, { mode, outgoing, routes })?.edge;
  const destination = edge && flow().nodes.find(node => node.id === edge.to);
  $('selectedRoute').textContent = edge ? t('route.front', { label: edge.label, title: destination.title }) : mode === 'overview' ? (outgoing.length > 1 ? t('route.forks', { n: outgoing.length }) : outgoing.length ? t('route.follow') : t('route.none')) : outgoing.length ? t('route.offscreen') : t('route.none');
  $('keyGuide').classList.toggle('muted', mode !== 'follow');
  $('keyGuide').textContent = mode === 'overview' ? t('keys.overview') : t('keys.follow');
  $('keyGuide').title = mode === 'overview' ? t('keys.overviewTitle') : t('keys.followTitle');
  for (const [index, button] of [...$('choices').querySelectorAll('button')].entries()) {
    button.classList.toggle('route-selected', outgoing[index] === edge);
    const keys = [['ArrowLeft', '←'], ['w', '↑'], ['ArrowRight', '→']].filter(([key]) => gameKeyAction({ key }, { mode, outgoing, routes })?.edge === outgoing[index]).map(([, label]) => label);
    button.dataset.keys = keys.join(' ');
  }
  scene.previewEdge(edge);
}

function renderDetail(node, outgoing) {
  const selection = node || flow();
  if (selection !== detailSelection) {
    $('detailPanel').scrollTop = 0;
    detailSelection = selection;
  }
  const detail = $('detail');
  detail.replaceChildren();
  if (!node) {
    detail.append(element('p', 'eyebrow', t('unread.eyebrow')), element('h2', '', flow().title),
      element('p', 'detail-description', t('unread.desc')));
    const limitSection = section(t('unread.why'));
    for (const limitation of flow().limitations) limitSection.append(element('p', 'detail-description', limitation));
    detail.append(limitSection);
    return;
  }
  const title = element('div', 'detail-title-row');
  title.append(element('span', 'step-number', nodeNumber(node.id)), element('h2', '', node.title),
    element('span', 'pill' + (node.changed === true ? ' teal' : ''), changeLabel(node)));
  detail.append(title, element('p', 'detail-description', node.description));

  const io = element('div', 'io');
  for (const [label, value] of [[t('field.input'), node.input], [t('field.output'), node.output]]) {
    const row = element('div', 'io-row');
    row.append(element('span', '', label), element('p', '', value));
    io.append(row);
  }
  detail.append(io);
  if (node.before || node.after) {
    const comparison = section(t('diff.title'));
    if (node.changed === null) comparison.firstChild.textContent = t('diff.confirmed');
    if (node.changed === false) comparison.firstChild.textContent = t('diff.thisStep');
    const blocks = element('div', 'compare');
    for (const [label, value, className] of [[t('diff.before'), node.before, ''], [t('diff.after'), node.after, ' after']]) {
      if (!value) continue;
      const block = element('div', 'compare-block' + className);
      block.append(element('small', '', label), element('p', '', value));
      blocks.append(block);
    }
    comparison.append(blocks);
    detail.append(comparison);
  }

  const ownFindings = flow().findings.filter(finding => finding.nodeId === node.id);
  const nextIds = new Set(outgoing.map(edge => edge.to).filter(id => id !== node.id));
  const nextFindings = flow().findings.filter(finding => nextIds.has(finding.nodeId));
  const concerns = [...ownFindings.map(finding => ({ finding, adjacent: false })),
    ...nextFindings.map(finding => ({ finding, adjacent: true }))];
  for (const { finding, adjacent } of concerns.slice(0, 2)) {
    const card = element('div', 'node-warning');
    const concernNode = flow().nodes.find(item => item.id === finding.nodeId);
    const label = adjacent ? t('finding.next') : finding.kind === 'issue' ? t('finding.issueHere') : t('finding.questionHere');
    card.append(element('strong', '', 'ⓘ ' + label));
    if (adjacent) card.append(element('p', 'eyebrow', `${nodeNumber(finding.nodeId)} ${concernNode.title} · ${finding.title}`));
    else card.append(element('p', 'eyebrow', finding.title));
    card.append(element('p', '', finding.condition));
    const button = element('button', '', adjacent ? t('finding.inspectStep', { n: nodeNumber(finding.nodeId) }) : t('finding.inspect'));
    button.addEventListener('click', () => adjacent ? inspectNode(finding.nodeId) : openReview('findings'));
    card.append(button);
    detail.append(card);
  }
  if (concerns.length > 2) {
    const more = element('button', '', t('finding.more', { n: concerns.length - 2 }));
    more.addEventListener('click', () => openReview('findings'));
    detail.append(more);
  }

  const evidence = section(t('section.evidence'));
  evidence.append(sources(node.sources, { expandFirst: true }));
  detail.append(evidence);
  if (outgoing.length) {
    const routes = section(t('section.routes'));
    for (const edge of outgoing) {
      const destination = flow().nodes.find(item => item.id === edge.to);
      const details = element('details', 'route-details');
      details.append(element('summary', '', `${edge.label} → ${destination.title}`), sources(edge.sources));
      routes.append(details);
    }
    detail.append(routes);
  }
  detail.parentElement.scrollTop = 0;
}

function update(animate = false) {
  const selectedFlow = flow();
  const node = currentNode();
  const outgoing = outgoingEdges();
  $('previous').disabled = !history.length;
  $('next').disabled = !node || outgoing.length !== 1;
  $('next').textContent = !node ? t('next.unread') : outgoing.length > 1 ? t('next.choose') : outgoing.length === 0 ? t('next.end') : t('next.jump');
  $('journeyTitle').textContent = node ? `${nodeNumber(node.id)} / ${String(selectedFlow.nodes.length).padStart(2, '0')} · ${node.title}` : t('journey.none');
  const origin = current === selectedFlow.entry ? t('journey.entry') : t('journey.middle');
  const journey = inspecting ? t('journey.inspecting') : history.length ? t('journey.moved', { n: history.length }) : origin;
  $('journeyMeta').textContent = node ? journey + (history.length === 100 ? t('journey.cap') : '') : t('status.unread');

  $('choices').replaceChildren();
  if (outgoing.length > 1) {
    for (const edge of outgoing) {
      const button = element('button', 'choice' + (edge.kind === 'failure' ? ' failure' : ''), edge.label);
      const destination = selectedFlow.nodes.find(item => item.id === edge.to);
      button.append(element('small', '', '→ ' + destination.title));
      button.addEventListener('click', () => choose(edge));
      $('choices').append(button);
    }
  } else if (outgoing.length === 1) {
    $('choices').append(element('span', 'route-condition', t('choices.next') + outgoing[0].label));
  }
  $('stateItems').replaceChildren();
  for (const state of node?.state || []) {
    const item = element('div', 'state-item');
    item.append(element('span', '', state.name), element('strong', '', state.value));
    $('stateItems').append(item);
  }
  if (!node?.state.length) $('stateItems').append(element('span', 'muted', node ? t('state.none') : t('status.unread')));
  if (node) scene.select(node.id, { animate: animate && !reducedMotion.matches, visitedIds: [...history, current], visitedEdges: [...visitedEdges] });
  renderRouteSelection();
  renderDetail(node, outgoing);
}

function renderReview() {
  const selectedFlow = flow();
  $('reviewFlow').textContent = selectedFlow.title;
  $('flowStatus').textContent = STATUS[selectedFlow.status];
  $('scenarios').replaceChildren();
  if (!selectedFlow.scenarios.length) {
    $('scenarios').append(element('p', 'empty', selectedFlow.status === 'unread' ? t('scenarios.unread') : t('scenarios.none')));
  } else {
    const wrap = element('div', 'scenario-wrap');
    const table = element('table', 'scenario-table');
    const head = element('thead');
    const labels = element('tr');
    for (const label of [t('th.condition'), t('th.result'), t('th.assessment'), t('th.evidence')]) labels.append(element('th', '', label));
    head.append(labels);
    const body = element('tbody');
    for (const scenario of selectedFlow.scenarios) {
      const row = element('tr');
      for (const value of [scenario.condition, scenario.result, scenario.assessment]) row.append(element('td', '', value));
      const evidence = element('td');
      evidence.append(sources(scenario.sources));
      row.append(evidence);
      body.append(row);
    }
    table.append(head, body);
    wrap.append(table);
    $('scenarios').append(wrap);
  }
  $('findingTab').textContent = t('tab.findings', { n: selectedFlow.findings.length });
  $('findings').replaceChildren();
  if (!selectedFlow.findings.length) {
    $('findings').append(element('p', 'empty', selectedFlow.status === 'unread' ? t('findings.unread') : t('findings.none')));
  } else {
    const grid = element('div', 'finding-grid');
    for (const finding of selectedFlow.findings) {
      const card = element('article', 'finding-card');
      card.append(element('span', 'pill amber', finding.kind === 'issue' ? t('finding.issue') : t('finding.question')), element('h3', '', finding.title));
      const description = element('dl');
      for (const [label, value] of [[t('f.condition'), finding.condition], [t('f.behavior'), finding.behavior], [t('f.impact'), finding.impact]]) {
        description.append(element('dt', '', label), element('dd', '', value));
      }
      card.append(description, sources(finding.sources));
      const button = element('button', '', t('finding.inspectStep', { n: nodeNumber(finding.nodeId) }));
      button.addEventListener('click', () => {
        $('reviewDialog').close();
        inspectNode(finding.nodeId);
        const label = $('sceneScroll').querySelector(`[data-node="${finding.nodeId}"]`);
        label?.focus({ preventScroll: true });
      });
      card.append(button);
      grid.append(card);
    }
    $('findings').append(grid);
  }
  const limitations = [...REPORT.limitations, ...selectedFlow.limitations];
  $('limitsTitle').textContent = t('limits.title', { n: limitations.length });
  $('limitsList').replaceChildren();
  for (const limitation of limitations) $('limitsList').append(element('li', '', limitation));
  if (!limitations.length) $('limitsList').append(element('li', '', t('limits.none')));
  $('reportSummary').textContent = REPORT.summary;
}

function selectFlow(index) {
  activeIndex = index;
  current = flow().entry;
  history = [];
  visitedEdges = [];
  inspecting = false;
  $('flowTitle').textContent = flow().title;
  $('summary').textContent = flow().summary;
  for (const [buttonIndex, button] of [...$('flows').children].entries()) {
    button.classList.toggle('active', buttonIndex === index);
    button.setAttribute('aria-current', buttonIndex === index ? 'true' : 'false');
  }
  $('unreadScene').classList.toggle('hide', flow().status !== 'unread');
  scene.setFlow(flow());
  scene.setMode(mode);
  update();
  renderReview();
}

function showTab(name) {
  for (const [id, panel] of [['scenarioTab', 'scenarios'], ['findingTab', 'findings'], ['limitTab', 'limitations']]) {
    const selected = name === panel;
    $(id).classList.toggle('active', selected);
    $(id).setAttribute('aria-selected', String(selected));
    $(id).tabIndex = selected ? 0 : -1;
    $(panel).classList.toggle('hide', !selected);
  }
}

function openReview(name = 'scenarios') {
  showTab(name);
  if (!$('reviewDialog').open) $('reviewDialog').showModal();
  $('reviewDialog').querySelector('[role="tab"][aria-selected="true"]')?.focus();
}

function selectMode(nextMode) {
  mode = nextMode;
  document.body.classList.toggle('chart-mode', mode === 'overview');
  for (const [id, value] of [['followMode', 'follow'], ['overviewMode', 'overview']]) {
    $(id).classList.toggle('active', value === mode);
    $(id).setAttribute('aria-pressed', String(value === mode));
  }
  scene.setMode(mode);
  renderRouteSelection();
}

applyStatic(document);
$('prTitle').textContent = REPORT.pr.title;
$('prTitle').title = REPORT.pr.title;
$('repo').textContent = `PR #${REPORT.pr.number}`;
$('repo').title = REPORT.pr.repo;
$('baseSha').textContent = 'base ' + REPORT.pr.base.slice(0, 12);
$('headSha').textContent = 'head ' + REPORT.pr.head.slice(0, 12);
$('baseSha').title = REPORT.pr.base;
$('headSha').title = REPORT.pr.head;
document.title = `explain-pr · ${REPORT.pr.title}`;
$('testStatus').textContent = `${TESTS[REPORT.tests.status]} · ${REPORT.tests.note}`;
$('evidenceNote').textContent = REPORT.sample ? t('note.sample') : t('note.real');
if (REPORT.sample) {
  $('sampleBadge').classList.remove('hide');
  $('prLink').classList.add('hide');
} else {
  $('prLink').href = REPORT.pr.url;
}
for (const [index, item] of REPORT.flows.entries()) {
  const button = element('button', 'flow-button');
  button.title = `${item.title} · ${STATUS[item.status]}`;
  button.append(element('span', 'flow-number', String(index + 1).padStart(2, '0')), element('span', 'flow-name', item.title), element('span', 'flow-dot ' + item.status));
  if (item.status === 'unread') button.append(element('span', 'pill', t('status.unread')));
  button.addEventListener('click', () => selectFlow(index));
  $('flows').append(button);
}
const count = status => REPORT.flows.filter(item => item.status === status).length;
$('coverage').append(element('h3', '', t('coverage.title')), element('strong', '', t('coverage.count', { done: count('reviewed') + count('partial'), total: REPORT.flows.length })), element('p', '', t('coverage.breakdown', { r: count('reviewed'), p: count('partial'), u: count('unread') })));
const unreadNames = REPORT.flows.filter(item => item.status === 'unread').map(item => item.title);
if (unreadNames.length) $('coverage').append(element('p', '', unreadNames.join(', ') + ' · ' + t('status.unread')));

$('previous').addEventListener('click', previous);
document.addEventListener('keydown', event => {
  const controls = 'button,a,input,textarea,select,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="textbox"],[role="combobox"],[role="slider"]';
  const action = gameKeyAction(event, {
    mode, outgoing: outgoingEdges(), routes: scene.getRoutes(), hasHistory: history.length > 0,
    animating: $('sceneScroll').dataset.animating === 'true',
    dialogOpen: !!document.querySelector('dialog[open]'),
    interactiveFocus: !!(event.target.closest?.(controls) || document.activeElement?.closest(controls)),
  });
  if (!action) return;
  event.preventDefault();
  if (action.type === 'advance') choose(action.edge);
  else if (action.type === 'previous') previous();
});
// Camera turns can change the visible route order; labels use the same projection as keys.
$('sceneScroll').addEventListener('routeschange', renderRouteSelection);
$('next').addEventListener('click', () => { const outgoing = outgoingEdges(); if (outgoing.length === 1) choose(outgoing[0]); });
if (!scene.supports3d) $('followMode').hidden = true; // lite viewer build: flowchart only
$('followMode').addEventListener('click', () => { if (scene.supports3d) selectMode('follow'); });
$('overviewMode').addEventListener('click', () => selectMode('overview'));
$('zoomIn').addEventListener('click', () => scene.zoomBy(1.15));
$('zoomOut').addEventListener('click', () => scene.zoomBy(1 / 1.15));
$('fit').addEventListener('click', () => {
  selectMode('overview');
  scene.fit();
});
$('openReview').addEventListener('click', () => openReview());
$('closeReview').addEventListener('click', () => $('reviewDialog').close());
$('reviewDialog').addEventListener('click', event => { if (event.target === $('reviewDialog')) $('reviewDialog').close(); });
const reviewTabs = [['scenarioTab', 'scenarios'], ['findingTab', 'findings'], ['limitTab', 'limitations']];
for (const [index, [id, panel]] of reviewTabs.entries()) {
  $(id).addEventListener('click', () => showTab(panel));
  $(id).addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowLeft' ? 2 : 1)) % 3;
    showTab(reviewTabs[next][1]);
    $(reviewTabs[next][0]).focus();
  });
}
$('download').addEventListener('click', () => {
  const blob = new Blob([MARKDOWN], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = `explain-pr-${REPORT.pr.number}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});
window.addEventListener('pagehide', () => scene.destroy(), { once: true });
showTab('scenarios');
document.body.classList.add('chart-mode');
selectFlow(0);
