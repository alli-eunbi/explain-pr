import { createScene, available as sceneAvailable } from './scene.js';
import { createFlowchart } from './flowchart.js';

// Keep the report and selection intact when switching between reading and walking.
export function createLogicView(options) {
  let mode = 'overview', flow = null, selection = null;
  let renderer = createFlowchart(options);
  return {
    supports3d: sceneAvailable,
    setFlow(next) { flow = next; selection = null; renderer.setFlow(next); },
    select(id, state = {}) { selection = { id, state }; renderer.select(id, state); },
    setMode(next) {
      next = next === 'follow' && sceneAvailable ? 'follow' : 'overview';
      if (mode === next) return;
      renderer.destroy();
      options.container.replaceChildren();
      mode = next;
      options.container.dataset.animating = 'false';
      renderer = mode === 'follow' ? createScene(options) : createFlowchart(options);
      if (flow) renderer.setFlow(flow);
      renderer.setMode(mode);
      if (selection) renderer.select(selection.id, { ...selection.state, animate: false });
    },
    previewEdge(edge) { renderer.previewEdge(edge); },
    getRoutes() { return renderer.getRoutes(); },
    zoomBy(factor) { renderer.zoomBy(factor); },
    fit() { renderer.fit(); },
    resize() { renderer.resize(); },
    destroy() { renderer.destroy(); options.container.replaceChildren(); },
  };
}
