const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export function labelWidth(projectedWidth, viewportWidth) {
  return Math.max(100,Math.min(280,viewportWidth-24,projectedWidth*.86));
}

// Keep the nearest readable position, using obstacle edges as candidate locations.
export function placeLabel(label, obstacles, bounds) {
  const gap = 8, xs = [label.x], ys = [label.y];
  // Only nearby rectangles create candidates; every obstacle still rejects collisions.
  const nearby=[...obstacles].sort((a,b)=>Math.hypot(a.x-label.x,a.y-label.y)-Math.hypot(b.x-label.x,b.y-label.y)).slice(0,10);
  for (const obstacle of nearby) {
    xs.push(obstacle.x - label.width - gap, obstacle.x + obstacle.width + gap);
    ys.push(obstacle.y - label.height - gap, obstacle.y + obstacle.height + gap);
  }
  const candidates = xs.flatMap(x => ys.map(y => ({ ...label,
    x: Math.max(4, Math.min(bounds.width - label.width - 4, x)),
    y: Math.max(bounds.top ?? 4, Math.min(bounds.height - label.height - 4, y)),
  })));
  const distance = candidate => (candidate.x - label.x) ** 2 + (candidate.y - label.y) ** 2;
  candidates.sort((a, b) => distance(a) - distance(b));
  return candidates.find(candidate => obstacles.every(obstacle => !overlaps(candidate, obstacle))) || null;
}
