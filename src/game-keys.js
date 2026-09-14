// Resolve navigation intent without mutating the graph or browser focus.
export function gameKeyAction(event, context) {
  if (context.mode !== 'follow' || context.dialogOpen || context.interactiveFocus || context.animating ||
      event.repeat || event.isComposing || event.ctrlKey || event.altKey ||
      event.metaKey || event.shiftKey || event.defaultPrevented) return null;
  const key = event.key.toLowerCase();
  const { outgoing, routes, hasHistory } = context;
  if (key === 'arrowdown' || key === 's') return hasHistory ? { type: 'previous' } : null;
  const direction = ['arrowleft', 'a'].includes(key) ? -1 : ['arrowright', 'd'].includes(key) ? 1 : 0;
  if (!direction && key !== 'arrowup' && key !== 'w') return null;
  if (direction && outgoing.length < 2) return null;
  const candidates = routes.filter(route => route.visible !== false && outgoing.includes(route.edge) && Number.isFinite(route.x) && Number.isFinite(route.y));
  // Stable sorting retains authored order when two actual routes share a destination.
  const score = route => direction ? -direction * route.x : Math.abs(Math.atan2(route.x, -route.y));
  const route = [...candidates].sort((a, b) => score(a) - score(b))[0];
  return route ? { type: 'advance', edge: route.edge } : null;
}
