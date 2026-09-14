import { buildFlowchart } from './flowchart-layout.js';

const CSS = `
.flowchart-host{container:logic-chart / inline-size}
.flowchart{--fc-scale:1;max-width:1100px;margin:0 auto;padding:24px 30px 64px;color:#183446;font:calc(15px * var(--fc-scale))/1.55 system-ui,sans-serif;box-sizing:border-box}
.flowchart *{box-sizing:border-box}.flowchart button{font:inherit;cursor:pointer;white-space:normal;text-align:left}
.flowchart-heading{display:grid;grid-template-columns:minmax(250px, .95fr) minmax(300px,1.2fr);gap:64px;margin:0 0 20px;color:#456372;font-weight:700;font-size:14px}
.flowchart-heading span:first-child:before{content:'↓';margin-right:9px;color:#078477}
.flowchart-row{display:grid;grid-template-columns:minmax(250px,.95fr) minmax(300px,1.2fr);column-gap:64px;align-items:start;position:relative}
.flowchart-main{min-width:0}.flowchart-card{display:block;width:100%;border:1px solid #c6dadb;background:#fff;border-radius:14px;padding:14px;color:inherit;box-shadow:0 3px 12px #1d4a5a06;overflow-wrap:anywhere;position:relative}
.flowchart-card:hover{border-color:#229c91;background:#f8fdfc}.flowchart [data-node].is-selected{border-color:#04897e;box-shadow:0 0 0 3px #0a9f8b22;background:#f1fbf8}
.flowchart-title{display:flex;align-items:flex-start;gap:9px;margin:0 0 8px;font-size:calc(18px * var(--fc-scale));line-height:1.4;font-weight:750;color:#153648}.flowchart-title-text{flex:1;min-width:0}
.flowchart-number{display:inline-grid;place-items:center;flex:none;min-width:30px;height:29px;border-radius:8px;background:#e4f3ef;color:#08776e;font-size:14px;font-weight:800}
.flowchart-badge{display:inline-block;flex:none;max-width:68px;border-radius:5px;background:#edf1f4;color:#586d7b;font-size:11px;line-height:1.5;padding:2px 6px;margin:3px 0 0}.flowchart-badge.changed{background:#e1f4e9;color:#287148}
.flowchart-value{display:grid;grid-template-columns:minmax(30px,max-content) minmax(0,1fr);gap:8px;margin-top:6px;font-size:calc(14px * var(--fc-scale));line-height:1.55}.flowchart-value-label{color:#7b8d96;font-size:12px;padding-top:2px}.flowchart-value.output{font-weight:600;color:#194658}
.flowchart-primary{position:relative;display:flex;flex-direction:column;align-items:center;padding:10px 8px 15px;text-align:center;min-height:56px;color:#117f76;font-size:calc(14px * var(--fc-scale));overflow-wrap:anywhere}
.flowchart-primary:before{content:'';width:2px;height:12px;background:#319e91;position:absolute;top:0}.flowchart-primary:after{content:'▼';font-size:13px;position:absolute;bottom:2px;color:#149080}.flowchart-primary small{display:block;font-size:11px;color:#708a90;margin-top:2px}
.flowchart-branches{display:grid;gap:8px;min-width:0;padding:0 0 18px}.flowchart-branch{position:relative;border:1px solid #c9dfe0;border-left:3px solid #219c91;border-radius:11px;background:#f7fcfb;padding:9px 11px;min-width:0}
.flowchart-branch:before{content:'';position:absolute;width:31px;height:2px;background:#56a99f;left:-34px;top:22px}.flowchart-branch:after{content:'→';position:absolute;left:-17px;top:9px;color:#178d82;font-size:18px}
.flowchart-branch.failure{background:#fff9f3;border-color:#efcfb4;border-left-color:#d7833f}.flowchart-branch.failure:before{background:#d79765}.flowchart-branch.failure:after{color:#b56a32}
.flowchart-condition{display:block;font-size:calc(15px * var(--fc-scale));font-weight:750;line-height:1.5;overflow-wrap:anywhere;margin-bottom:5px;color:#16766c}.flowchart-branch.failure .flowchart-condition{color:#98501e}
.flowchart-kind{font-size:10px;font-weight:700;letter-spacing:.04em;color:#668b85;margin-right:7px}.flowchart-branch.failure .flowchart-kind{color:#b17342}
.flowchart-branch .flowchart-card{padding:7px 10px;box-shadow:none;border-radius:9px}.flowchart-branch .flowchart-title{font-size:calc(16px * var(--fc-scale));margin-bottom:3px}.flowchart-branch .flowchart-number{height:25px;min-width:27px;font-size:12px}
.flowchart-reference{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:5px;color:#69818a;font-size:12px}.flowchart-jump{padding:0;border:0;background:transparent;color:#087f76;text-decoration:underline;text-underline-offset:3px;font-size:12px!important}
.flowchart-continuation{font-size:12px;margin:9px 0 0;color:#5b7581}.flowchart-continuation strong{color:#385765}
.flowchart-terminal{color:#607984;font-size:12px;text-align:center;padding:10px 0 28px}.flowchart-section{font-size:16px;margin:22px 0 20px;padding-top:22px;border-top:1px solid #dce6e9}.flowchart-row.secondary{padding-bottom:20px}.flowchart-row.secondary .flowchart-main>.flowchart-card{border-style:dashed}
.flowchart-note{margin:0 0 20px;color:#66808d;font-size:12px}.flowchart-empty{padding:30px;border:1px dashed #bbccd3;border-radius:12px;color:#6c818e}.flowchart .is-preview{outline:3px solid #32a99e;outline-offset:3px}
@container logic-chart (max-width:900px){.flowchart{padding:20px 18px 44px}.flowchart-heading,.flowchart-row{gap:36px;grid-template-columns:minmax(220px,1fr) minmax(260px,1.15fr)}.flowchart-card{padding:15px}.flowchart-branch:before{width:18px;left:-21px}}
@container logic-chart (max-width:600px){.flowchart{padding:16px 12px 40px}.flowchart-heading{display:block}.flowchart-heading span+span{display:none}.flowchart-row{display:flex;flex-direction:column;gap:0}.flowchart-main{display:contents}.flowchart-branches{width:100%;padding-left:24px;order:1;margin-top:10px}.flowchart-main .flowchart-primary,.flowchart-main .flowchart-terminal{order:2;width:100%;margin-bottom:0}.flowchart-branch:before{width:12px;left:-15px}.flowchart-branch:after{left:-14px}.flowchart-title{font-size:18px}.flowchart-row{margin-bottom:15px}}
`;

import { t } from './i18n.js';
export function createFlowchart({ container, onInspect = () => {} }) {
  const doc = container.ownerDocument;
  const style = doc.createElement('style');
  style.textContent = CSS;
  const root = doc.createElement('div');
  root.className = 'flowchart';
  container.append(style, root);
  container.classList.toggle('flowchart-host', true);
  container.dataset.renderer = 'flowchart';
  container.dataset.animating = 'false';
  let model, zoom = 1;
  const nodeElements = new Map(), edgeElements = new Map(), canonical = new Map();
  const make = (tag, className, text) => {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const number = value => String(value).padStart(2, '0');
  function jump(id) {
    const destination = canonical.get(id);
    destination?.scrollIntoView({ block: 'center', behavior: 'instant' });
    destination?.focus({ preventScroll: true });
  }
  function jumpButton(id, label) {
    const button = make('button', 'flowchart-jump', label);
    button.type = 'button';
    button.addEventListener('click', () => jump(id));
    return button;
  }
  function nodeCard(node, ordinal, isCanonical = false, compact = false) {
    const card = make('button', 'flowchart-card');
    card.type = 'button';
    card.dataset.node = node.id;
    card.setAttribute('aria-label', t('fc.aria', { n: number(ordinal), title: node.title }));
    const title = make('div', 'flowchart-title');
    title.append(make('span', 'flowchart-number', number(ordinal)), make('span', 'flowchart-title-text', node.title));
    card.append(title);
    const changed = node.changed === null ? t('change.unknownLong') : node.changed ? t('change.changed') : t('change.existing');
    if (!compact) title.append(make('span', `flowchart-badge${node.changed ? ' changed' : ''}`, changed));
    for (const [key, label] of compact ? [['output', t('field.output')]] : [['input', t('field.input')], ['output', t('field.output')]]) {
      const row = make('div', `flowchart-value ${key}`);
      row.append(make('span', 'flowchart-value-label', label), make('span', '', node[key] || t('fc.unknownValue')));
      card.append(row);
    }
    card.addEventListener('click', () => onInspect(node.id));
    if (!nodeElements.has(node.id)) nodeElements.set(node.id, []);
    nodeElements.get(node.id).push(card);
    if (isCanonical || !canonical.has(node.id)) canonical.set(node.id, card);
    return card;
  }
  function branch(item) {
    const { edge, destination, destinationNumber, relation, shared } = item;
    const box = make('div', `flowchart-branch ${edge.kind}`);
    const condition = make('div', 'flowchart-condition');
    condition.append(make('span', 'flowchart-kind', edge.kind === 'failure' ? t('fc.failureBranch') : t('fc.otherBranch')), make('span', '', edge.label));
    box.append(condition, nodeCard(destination, destinationNumber, false, true));
    const reference = make('div', 'flowchart-reference');
    const relationText = relation === 'repeat' ? t('fc.repeat') : relation === 'return' ? t('fc.return', { n: number(destinationNumber) }) : shared ? t('fc.join', { n: number(destinationNumber) }) : t('fc.goto', { n: number(destinationNumber) });
    reference.append(make('span', '', relationText));
    box.append(reference);
    const next = model.rows.find(row => row.node.id === destination.id);
    const continuations = [next.primary, ...next.branches].filter(Boolean);
    if (continuations.length) {
      const note = make('div', 'flowchart-continuation');
      note.append(make('strong', '', t('fc.continue')));
      note.append(jumpButton(destination.id, t('fc.seeConditions', { n: number(destinationNumber), count: continuations.length })));
      box.append(note);
    }
    edgeElements.set(edge, box);
    return box;
  }
  function renderRow(row) {
    const outer = make('section', `flowchart-row${row.spine ? '' : ' secondary'}`);
    outer.setAttribute('aria-label', `${number(row.number)} ${row.node.title}`);
    const main = make('div', 'flowchart-main');
    main.append(nodeCard(row.node, row.number, true));
    if (row.primary) {
      const connector = make('div', 'flowchart-primary', row.primary.edge.label);
      connector.append(make('small', '', `↓ ${number(row.primary.destinationNumber)} ${row.primary.destination.title}`));
      main.append(connector);
      edgeElements.set(row.primary.edge, connector);
    } else if (row.spine) {
      main.append(make('div', 'flowchart-terminal', row.branches.length ? t('fc.moreConditions') : t('fc.lastStep')));
    }
    const aside = make('div', 'flowchart-branches');
    for (const item of row.branches) aside.append(branch(item));
    outer.append(main, aside);
    root.append(outer);
  }
  function setFlow(flow) {
    model = buildFlowchart(flow);
    root.replaceChildren();
    nodeElements.clear(); edgeElements.clear(); canonical.clear();
    container.dataset.currentNode = '';
    container.dataset.cameraMode = 'overview';
    if (!model.rows.length) {
      root.append(make('div', 'flowchart-empty', t('fc.empty')));
      return;
    }
    const heading = make('div', 'flowchart-heading');
    heading.append(make('span', '', t('fc.mainPath')), make('span', '', t('fc.sidePath')));
    root.append(heading, make('p', 'flowchart-note', t('fc.note')));
    for (const row of model.rows.filter(row => row.spine)) renderRow(row);
    // Terminal branch nodes are already fully shown beside their sources. Only
    // continuing branches need another row; their references retain node identity.
    const remaining = model.rows.filter(row => !row.spine && (row.branches.length || row.primary || !row.incoming.length));
    if (remaining.length) {
      root.append(make('h3', 'flowchart-section', t('fc.branchSection')));
      for (const row of remaining) renderRow(row);
    }
  }
  function select(id) {
    container.dataset.currentNode = id || '';
    for (const [nodeId, elements] of nodeElements) {
      for (const element of elements) {
        element.classList.toggle('is-selected', nodeId === id);
        element.setAttribute('aria-pressed', String(nodeId === id));
      }
    }
  }
  function previewEdge(edge) {
    for (const [candidate, element] of edgeElements) element.classList.toggle('is-preview', candidate === edge);
  }
  return {
    setFlow, select, previewEdge,
    getRoutes: () => [],
    setMode: () => { container.dataset.cameraMode = 'overview'; },
    zoomBy: factor => {
      if (Number.isFinite(factor) && factor > 0) zoom = Math.max(.9, Math.min(1.25, zoom * factor));
      root.style.setProperty('--fc-scale', zoom);
    },
    fit: () => { zoom = 1; root.style.setProperty('--fc-scale', zoom); },
    resize: () => {},
    destroy: () => { root.remove(); style.remove(); container.classList.toggle('flowchart-host', false); nodeElements.clear(); edgeElements.clear(); canonical.clear(); },
  };
}
