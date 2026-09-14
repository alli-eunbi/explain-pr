// Stand-in for scene.js in the lite viewer build: no three.js, no 3D mode.
export const available = false;
export function layout() { return { nodes: [], edges: [] }; }
export function createScene() { throw new Error('3D scene is not included in this viewer build; render with --3d'); }
