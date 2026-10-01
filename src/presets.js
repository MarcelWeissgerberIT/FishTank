import { INNER } from './config.js';

const L = INNER.minX;
const R = INNER.maxX;
const B = INNER.minZ;
const F = INNER.maxZ;

// Water: scatter = colour of lit water, absorb = extinction per metre (r, g, b)
export const PRESETS = {
  reef: {
    name: 'Korallenriff',
    icon: '🪸',
    desc: 'Salzwasser-Riff mit Lebendgestein, Korallen, Anemone & Haien',
    light: 'reef',
    backdrop: 'reef',
    water: { scatter: '#0d5a8c', absorb: [1.1, 0.32, 0.18] },
    sand: { profile: { base: 0.03, slope: 0.07, dune: 0.006, seed: 2, mounds: [] }, tint: '#fff7ec', skirt: '#cfc6b8' },
    decor: [
      { id: 'liverock', x: -0.28, z: -0.1, h: 0.27, rot: 0.2 },
      { id: 'liverock', x: 0.3, z: -0.13, h: 0.22, rot: Math.PI + 0.4, flip: true },
      { id: 'acropora', x: -0.24, z: -0.08, h: 0.11, rot: 0.6, sink: 0, onTop: 0.22 },
      { id: 'braincoral', x: 0.15, z: 0.07, h: 0.08, rot: 0.2 },
      { id: 'anemone', x: -0.05, z: 0.02, h: 0.1, rot: 0.3 },
      { id: 'acropora', x: 0.42, z: 0.06, h: 0.12, rot: 2.2 },
      { id: 'braincoral', x: -0.46, z: 0.08, h: 0.06, rot: 1.0 },
    ],
    plants: [],
    bubbles: [{ x: R - 0.06, z: B + 0.04, rate: 18 }],
    fish: { clownfish: 2, bluetang: 1, yellowtang: 2, gramma: 2, mandarin: 1, moorish: 1, blacktip: 1 },
    jellies: 0,
  },
  amazon: {
    name: 'Amazonas',
    icon: '🌿',
    desc: 'Schwarzwasser-Biotop mit Wurzeln, Laub, Neonschwarm & Skalaren',
    light: 'sunrise',
    backdrop: 'amazon',
    water: { scatter: '#4a3510', absorb: [0.55, 0.9, 1.8] },
    sand: { profile: { base: 0.035, slope: 0.06, dune: 0.008, seed: 5, mounds: [] }, tint: '#9b7a58', skirt: '#6e5a45' },
    decor: [
      { id: 'driftwood', x: -0.2, z: -0.06, h: 0.36, rot: 0.3, sink: 0.12 },
      { id: 'driftwood', x: 0.32, z: -0.1, h: 0.3, rot: 2.4, sink: 0.12, flip: true },
      { id: 'stone', x: 0.05, z: 0.05, h: 0.07, rot: 1.2, sink: 0.25 },
    ],
    plants: [
      { type: 'vallisneria', count: 380, area: [L + 0.02, R - 0.02, B + 0.02, B + 0.12], height: [0.25, 0.5], width: [0.006, 0.01], colors: ['#3f7a2a', '#5a8f2e', '#2f6a30'], clusters: 9, clusterRadius: 0.06 },
      { type: 'sword', count: 120, height: [0.12, 0.22], width: [0.03, 0.05], colors: ['#3d8a35', '#4f9a3a', '#2f7a2f'], clusters: 4, clusterRadius: 0.03, tilt: [0.25, 0.9], area: [L + 0.06, R - 0.06, B + 0.1, F - 0.12] },
      { type: 'litter', count: 260, height: [0.035, 0.06], width: [0.02, 0.035], colors: ['#6b3e1d', '#8a5426', '#4d2c15', '#a0662e'] },
    ],
    bubbles: [{ x: L + 0.07, z: B + 0.05, rate: 10 }],
    fish: { neon: 24, angelfish: 3, discus: 2, corydoras: 6, bala: 3 },
    jellies: 0,
  },
  iwagumi: {
    name: 'Iwagumi',
    icon: '🪨',
    desc: 'Japanisches Naturaquarium nach Takashi Amano – Steine & Grasteppich',
    light: 'day',
    backdrop: 'white',
    water: { scatter: '#2a6a6a', absorb: [0.55, 0.16, 0.14] },
    sand: {
      profile: { base: 0.03, slope: 0.08, dune: 0.004, seed: 9, mounds: [{ x: 0.15, z: -0.06, r: 0.18, h: 0.05 }, { x: -0.3, z: -0.1, r: 0.14, h: 0.03 }] },
      tint: '#6c5a48',
      skirt: '#3a2f26',
    },
    decor: [
      { id: 'stone', x: 0.12, z: -0.04, h: 0.27, rot: 0.1, sink: 0.12 },
      { id: 'stone', x: 0.27, z: 0.02, h: 0.15, rot: 2.1, sink: 0.15 },
      { id: 'stone', x: -0.02, z: 0.06, h: 0.1, rot: 4.0, sink: 0.2 },
      { id: 'stone', x: -0.3, z: -0.08, h: 0.16, rot: 1.0, sink: 0.15, flip: true },
      { id: 'stone', x: -0.43, z: 0.05, h: 0.07, rot: 3.0, sink: 0.25 },
      { id: 'stone', x: 0.45, z: -0.1, h: 0.09, rot: 5.0, sink: 0.25 },
    ],
    plants: [
      { type: 'carpet', count: 9000, height: [0.008, 0.016], width: [0.006, 0.01], colors: ['#6fbf3a', '#83cf45', '#5aa832'], tilt: [0.4, 1.2] },
      { type: 'hairgrass', count: 1400, height: [0.03, 0.08], width: [0.0012, 0.002], colors: ['#5aa83a', '#76c048'], clusters: 22, clusterRadius: 0.035, tilt: [0, 0.35] },
    ],
    bubbles: [{ x: L + 0.06, z: B + 0.04, rate: 8 }],
    fish: { neon: 34, corydoras: 4 },
    jellies: 0,
  },
  jelly: {
    name: 'Quallen-Lounge',
    icon: '🪼',
    desc: 'Dunkles Becken voller knallbunter, leuchtender Quallen',
    light: 'moon',
    backdrop: 'black',
    water: { scatter: '#020c22', absorb: [1.4, 0.6, 0.35] },
    sand: { profile: { base: 0.02, slope: 0.03, dune: 0.004, seed: 4, mounds: [] }, tint: '#3a4048', skirt: '#202428' },
    decor: [{ id: 'liverock', x: 0.38, z: -0.12, h: 0.16, rot: 2.5 }],
    plants: [],
    bubbles: [{ x: -0.1, z: B + 0.03, rate: 14, hidden: false }],
    fish: {},
    jellies: 9,
    glowParticles: true,
  },
  shark: {
    name: 'Hai-Lagune',
    icon: '🦈',
    desc: 'Offenes Wasser mit Riffhaien, Epaulettenhaien und Doktorfischen',
    light: 'day',
    backdrop: 'reef',
    water: { scatter: '#0f6a8a', absorb: [0.95, 0.26, 0.17] },
    sand: { profile: { base: 0.03, slope: 0.05, dune: 0.01, seed: 7, mounds: [] }, tint: '#fff4e2', skirt: '#cfc2ae' },
    decor: [
      { id: 'liverock', x: -0.36, z: -0.12, h: 0.2, rot: 0.6 },
      { id: 'braincoral', x: 0.36, z: -0.08, h: 0.09, rot: 0.2 },
      { id: 'acropora', x: 0.47, z: -0.13, h: 0.12, rot: 1.4 },
    ],
    plants: [],
    bubbles: [{ x: R - 0.06, z: B + 0.04, rate: 16 }],
    fish: { blacktip: 2, epaulette: 2, yellowtang: 3, bluetang: 1 },
    jellies: 0,
  },
  goldfish: {
    name: 'Goldfisch-Klassik',
    icon: '🐠',
    desc: 'Kaltwasser-Klassiker mit Kampffisch-Gast, Kies und Wasserpflanzen',
    light: 'day',
    backdrop: 'black',
    water: { scatter: '#2a5a48', absorb: [0.7, 0.25, 0.35] },
    sand: { profile: { base: 0.04, slope: 0.04, dune: 0.01, seed: 11, mounds: [] }, tint: '#d8c4a0', skirt: '#a08e70' },
    decor: [
      { id: 'stone', x: -0.32, z: -0.05, h: 0.16, rot: 0.8, sink: 0.15 },
      { id: 'driftwood', x: 0.28, z: -0.08, h: 0.24, rot: 1.6, sink: 0.12 },
    ],
    plants: [
      { type: 'vallisneria', count: 300, area: [L + 0.02, R - 0.02, B + 0.02, B + 0.1], height: [0.22, 0.48], width: [0.006, 0.009], colors: ['#4f8f2e', '#3f7a2a'], clusters: 8, clusterRadius: 0.07 },
      { type: 'rotala', count: 160, area: [L + 0.05, L + 0.3, B + 0.05, B + 0.2], height: [0.12, 0.3], width: [0.004, 0.007], colors: ['#c0502a', '#d8703a', '#a8402a'], clusters: 3, clusterRadius: 0.05 },
    ],
    bubbles: [
      { x: -0.05, z: B + 0.04, rate: 30, spread: 2 },
      { x: 0.1, z: B + 0.04, rate: 30, spread: 2 },
    ],
    fish: { goldfish: 4, betta: 1, corydoras: 3 },
    jellies: 0,
  },
  empty: {
    name: 'Leeres Becken',
    icon: '✨',
    desc: 'Nur Sand und ein Stein – besetze dein Aquarium selbst',
    light: 'day',
    backdrop: 'white',
    water: { scatter: '#1d5f78', absorb: [0.8, 0.22, 0.15] },
    sand: { profile: { base: 0.03, slope: 0.05, dune: 0.006, seed: 1, mounds: [] }, tint: '#f6efe2', skirt: '#c7bca8' },
    decor: [{ id: 'stone', x: 0.2, z: -0.05, h: 0.18, rot: 0.4, sink: 0.12 }],
    plants: [],
    bubbles: [{ x: R - 0.06, z: B + 0.04, rate: 12 }],
    fish: {},
    jellies: 0,
  },
};

// Light modes. intensity is relative, actinic drives coral fluorescence.
export const LIGHT_MODES = {
  day: { name: 'Tageslicht', color: '#fff3e2', intensity: 1.0, actinic: 0.1, room: 0.45 },
  reef: { name: 'Riff-Blau', color: '#8fb0ff', intensity: 0.95, actinic: 1.0, room: 0.3 },
  sunrise: { name: 'Sonnenaufgang', color: '#ffb46e', intensity: 0.85, actinic: 0.0, room: 0.4 },
  moon: { name: 'Mondlicht', color: '#5a78ff', intensity: 0.32, actinic: 0.6, room: 0.08 },
  rainbow: { name: 'Regenbogen', color: '#ffffff', intensity: 0.9, actinic: 0.5, room: 0.15, dynamic: 'rainbow' },
  storm: { name: 'Gewitter', color: '#9db4dc', intensity: 0.45, actinic: 0.2, room: 0.1, dynamic: 'storm' },
  disco: { name: 'Party', color: '#ff40c0', intensity: 0.8, actinic: 0.8, room: 0.1, dynamic: 'disco' },
};

export const BACKDROPS = {
  reef: 'Ozean',
  amazon: 'Urwald',
  white: 'Lichtfolie',
  black: 'Schwarz',
  none: 'Ohne (Raum)',
};
