// Reading order is presentation only: keep every original node and authored edge.
export function buildFlowchart(flow) {
  const nodes = flow.nodes || [], edges = flow.edges || [];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  const incoming = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    outgoing.get(edge.from)?.push(edge);
    incoming.get(edge.to)?.push(edge);
  }
  const spine = [], chosen = new Map(), seen = new Set();
  let current = byId.get(flow.entry);
  while (current && !seen.has(current.id)) {
    spine.push(current);
    seen.add(current.id);
    const next = outgoing.get(current.id).find(edge => edge.kind === 'normal' && !seen.has(edge.to));
    if (!next) break;
    chosen.set(current.id, next);
    current = byId.get(next.to);
  }
  const ordered = [...spine, ...nodes.filter(node => !seen.has(node.id))];
  const index = new Map(ordered.map((node, i) => [node.id, i]));
  const numbers = new Map(nodes.map((node, i) => [node.id, i + 1]));
  function reaches(from, target) {
    const pending = [from], visited = new Set();
    while (pending.length) {
      const id = pending.pop();
      if (id === target) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const edge of outgoing.get(id) || []) pending.push(edge.to);
    }
    return false;
  }
  function describe(edge) {
    return {
      edge,
      destination: byId.get(edge.to),
      destinationNumber: numbers.get(edge.to),
      shared: incoming.get(edge.to).length > 1,
      relation: edge.from === edge.to ? 'repeat' : index.get(edge.to) < index.get(edge.from) && reaches(edge.to, edge.from) ? 'return' : 'forward',
    };
  }
  return {
    rows: ordered.map(node => ({
      node,
      number: numbers.get(node.id),
      spine: seen.has(node.id),
      incoming: incoming.get(node.id),
      primary: chosen.has(node.id) ? describe(chosen.get(node.id)) : null,
      branches: outgoing.get(node.id).filter(edge => edge !== chosen.get(node.id)).map(describe),
    })),
  };
}
