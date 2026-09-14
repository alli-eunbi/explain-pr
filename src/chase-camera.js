export const FOLLOW_VIEW_HEIGHT = 11.6;
export const FOLLOW_FOV = 38;

// Match the overview diagonal. Only the target translates; robot turns never orbit the camera.
export function followCameraOffset(distance) {
  const scale = distance / Math.hypot(-11, 14, 12);
  return { x: -11 * scale, y: 14 * scale, z: 12 * scale };
}

export function followCameraTarget(at) {
  return { x: at.x + 1.5, y: 1.85, z: at.z + .6 };
}

export function travelHeading(from, to, lastHeading) {
  const x = to.x - from.x, z = to.z - from.z;
  return Math.hypot(x, z) > 1e-6 ? Math.atan2(x, z) : lastHeading;
}

export function arrivalHeading(at, destinations, lastHeading) {
  let x = 0, z = 0;
  for (const destination of destinations) {
    const dx = destination.x - at.x, dz = destination.z - at.z;
    const length = Math.hypot(dx, dz);
    if (length > 1e-6) { x += dx / length; z += dz / length; }
  }
  return Math.hypot(x, z) > 1e-6 ? Math.atan2(x, z) : lastHeading;
}
