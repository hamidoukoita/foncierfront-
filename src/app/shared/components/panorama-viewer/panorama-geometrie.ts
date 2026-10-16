/**
 * Passage entre un point de l'écran et une direction dans la sphère du panorama,
 * avec exactement la même projection que le shader de la visionneuse (et que l'app mobile).
 * Une direction s'exprime en degrés : azimut (-180 → 180, 0 = centre de l'image) et élévation (-90 → 90).
 */
export interface Direction {
  azimut: number;
  elevation: number;
}

export interface Vue {
  /** Orientation de la caméra, en radians (comme la visionneuse). */
  yaw: number;
  pitch: number;
  fov: number;
  largeur: number;
  hauteur: number;
}

const DEG = Math.PI / 180;

/** Azimut ramené dans ]-180, 180]. */
export function normaliserAzimut(azimut: number): number {
  const a = ((((azimut + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a;
}

/** Direction visée par le pixel (x, y) de la vue. */
export function directionDepuisEcran(x: number, y: number, vue: Vue): Direction {
  const vx = (2 * x) / vue.largeur - 1;
  const vy = 1 - (2 * y) / vue.hauteur;
  const tf = Math.tan(vue.fov / 2);
  let dx = vx * (vue.largeur / vue.hauteur) * tf;
  let dy = vy * tf;
  let dz = -1;
  const n = Math.hypot(dx, dy, dz);
  dx /= n;
  dy /= n;
  dz /= n;
  const cp = Math.cos(vue.pitch), sp = Math.sin(vue.pitch);
  [dy, dz] = [dy * cp - dz * sp, dy * sp + dz * cp];
  const cy = Math.cos(vue.yaw), sy = Math.sin(vue.yaw);
  [dx, dz] = [dx * cy + dz * sy, -dx * sy + dz * cy];
  return {
    azimut: normaliserAzimut(Math.atan2(dx, -dz) / DEG),
    elevation: Math.asin(Math.max(-1, Math.min(1, dy))) / DEG,
  };
}

/** Position à l'écran d'une direction, ou null si elle est derrière la caméra. */
export function positionAEcran(direction: Direction, vue: Vue): { x: number; y: number } | null {
  const lon = direction.azimut * DEG;
  const lat = direction.elevation * DEG;
  // Direction dans le repère du panorama (inverse de lon = atan2(x, -z), lat = asin(y)).
  let dx = Math.cos(lat) * Math.sin(lon);
  let dy = Math.sin(lat);
  let dz = -Math.cos(lat) * Math.cos(lon);
  // Rotations inverses : lacet puis tangage.
  const cy = Math.cos(vue.yaw), sy = Math.sin(vue.yaw);
  [dx, dz] = [dx * cy - dz * sy, dx * sy + dz * cy];
  const cp = Math.cos(vue.pitch), sp = Math.sin(vue.pitch);
  [dy, dz] = [dy * cp + dz * sp, -dy * sp + dz * cp];
  if (dz >= -1e-6) return null;
  const tf = Math.tan(vue.fov / 2);
  const vx = dx / -dz / ((vue.largeur / vue.hauteur) * tf);
  const vy = dy / -dz / tf;
  return { x: ((vx + 1) / 2) * vue.largeur, y: ((1 - vy) / 2) * vue.hauteur };
}

/** Orientation de caméra (yaw, pitch en radians) qui regarde dans cette direction. */
export function orientationVers(direction: Direction): { yaw: number; pitch: number } {
  return { yaw: -direction.azimut * DEG, pitch: direction.elevation * DEG };
}
