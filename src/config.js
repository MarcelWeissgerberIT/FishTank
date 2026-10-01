// Global dimensions (metres). The tank's bottom glass sits at y = 0,
// the cabinet underneath, the floor at FLOOR_Y.
export const TANK = {
  w: 1.2,
  d: 0.5,
  h: 0.6,
  glass: 0.01,
  waterLevel: 0.555,
};

export const INNER = {
  minX: -TANK.w / 2 + TANK.glass,
  maxX: TANK.w / 2 - TANK.glass,
  minZ: -TANK.d / 2 + TANK.glass,
  maxZ: TANK.d / 2 - TANK.glass,
  minY: TANK.glass,
  maxY: TANK.waterLevel,
};

export const STAND = { w: 1.26, d: 0.54, h: 0.78 };
export const FLOOR_Y = -STAND.h;

export const BASE = import.meta.env.BASE_URL;
export const asset = (p) => `${BASE}assets/${p}`;

export const IS_MOBILE =
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
