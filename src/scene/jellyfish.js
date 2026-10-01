import * as THREE from 'three';
import { INNER } from '../config.js';
import { UW } from './underwater.js';
import { rand, clamp } from '../util/noise.js';

// Colour themes: [hue offset, hue spread, comb rows?]
export const JELLY_THEMES = [
  { name: 'Aurora', hue: 0.48, spread: 0.45, comb: 0.6, sat: 0.85 },
  { name: 'Neon-Pink', hue: 0.88, spread: 0.25, comb: 0.3, sat: 0.9 },
  { name: 'Elektro-Blau', hue: 0.6, spread: 0.2, comb: 1.0, sat: 0.95 },
  { name: 'Regenbogen', hue: 0.0, spread: 1.0, comb: 1.0, sat: 0.9 },
  { name: 'Sonnenglut', hue: 0.03, spread: 0.18, comb: 0.4, sat: 0.95 },
  { name: 'Geist', hue: 0.55, spread: 0.9, comb: 1.0, sat: 0.35 },
];

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uPulse;      // 0..1 contraction
uniform float uHue;
uniform float uSpread;
uniform float uSat;
uniform float uBright;
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
`;

const bellVS = /* glsl */ `
${COMMON}
varying vec3 vN; varying vec3 vWp; varying vec2 vUv; varying float vAng;
void main() {
  vUv = uv;
  vec3 p = position;
  float low = 1.0 - clamp(p.y / 0.75, 0.0, 1.0);        // 1 at the rim, 0 at the top
  float squeeze = 1.0 - uPulse * 0.28 * (0.3 + 0.7 * low);
  p.xz *= squeeze;
  p.y *= 1.0 + uPulse * 0.12;
  p.y -= low * low * uPulse * 0.08;
  vAng = atan(position.z, position.x);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const bellFS = /* glsl */ `
${COMMON}
uniform float uComb;
varying vec3 vN; varying vec3 vWp; varying vec2 vUv; varying float vAng;
void main() {
  vec3 V = normalize(cameraPosition - vWp);
  vec3 N = normalize(vN);
  float f = pow(1.0 - abs(dot(N, V)), 2.2);
  float h = uHue + uSpread * (f * 0.7 + vUv.y * 0.35) + uTime * 0.04;
  vec3 base = hsv2rgb(vec3(fract(h), uSat, 1.0));
  // radial canals + ring canal
  float canals = smoothstep(0.93, 1.0, cos(vAng * 4.0)) * smoothstep(0.1, 0.6, vUv.y);
  float ring = smoothstep(0.82, 0.9, vUv.y) * (1.0 - smoothstep(0.9, 0.98, vUv.y));
  // gonads glow near the top
  float gon = smoothstep(0.35, 0.0, vUv.y) * (0.5 + 0.5 * cos(vAng * 4.0 + 0.8));
  // ctenophore-like travelling rainbow comb rows
  float rows = smoothstep(0.86, 1.0, cos(vAng * 8.0 + 0.4));
  vec3 comb = hsv2rgb(vec3(fract(vUv.y * 3.0 - uTime * 1.3 + vAng * 0.5), 1.0, 1.0)) * rows * uComb * (0.5 + 0.5 * sin(vUv.y * 40.0 - uTime * 12.0));
  float rim = smoothstep(0.9, 1.0, vUv.y);
  float I = 0.05 + f * 0.95 + canals * 0.35 + ring * 0.6 + rim * 0.9 + gon * 0.35;
  vec3 col = base * I + comb * 1.4 + base * uPulse * 0.25;
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

const strandVS = /* glsl */ `
${COMMON}
attribute float aS;        // 0 at the bell, 1 at the tip
attribute float aPhase;
attribute float aLen;
uniform vec3 uDrag;        // object space trailing direction * strength
varying float vS; varying float vPhase;
void main() {
  vec3 p = position;
  float s = aS;
  float w = sin(uTime * 1.6 - s * 7.0 + aPhase) * 0.18 + sin(uTime * 0.7 - s * 3.0 + aPhase * 2.3) * 0.12;
  vec3 side = normalize(vec3(cos(aPhase), 0.0, sin(aPhase)));
  p += side * w * s * aLen * 0.5;
  p += vec3(sin(uTime * 0.9 + aPhase * 3.1), 0.0, cos(uTime * 0.8 + aPhase)) * 0.06 * s * s * aLen;
  p += uDrag * s * s * aLen;
  p.y += uPulse * 0.1 * s * aLen;       // tentacles lag behind during the stroke
  p.xz *= 1.0 - uPulse * 0.15 * (1.0 - s);
  vS = s; vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const strandFS = /* glsl */ `
${COMMON}
uniform float uAlpha;
varying float vS; varying float vPhase;
void main() {
  float h = uHue + uSpread * (vS * 0.8 + vPhase * 0.05) + uTime * 0.05;
  vec3 col = hsv2rgb(vec3(fract(h), uSat, 1.0));
  float spark = pow(0.5 + 0.5 * sin(vS * 60.0 - uTime * 6.0 + vPhase * 7.0), 8.0);
  float a = (1.0 - vS) * (0.35 + 0.65 * (1.0 - vS)) * uAlpha + spark * 0.3 * (1.0 - vS);
  gl_FragColor = vec4(col * a * uBright, 1.0);
}`;

function bellGeometry() {
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI * 0.5;
    let r = Math.sin(a) * (1 + 0.08 * Math.pow(t, 6));
    let y = Math.cos(a) * 0.75;
    if (t > 0.92) y -= (t - 0.92) * 0.6;
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  const g = new THREE.LatheGeometry(pts, 48);
  // uv.y: 0 top -> 1 rim
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i));
  return g;
}

function tentacleGeometry(count, segs, len) {
  const P = [];
  const S = [];
  const PH = [];
  const L = [];
  for (let k = 0; k < count; k++) {
    const ang = (k / count) * Math.PI * 2 + rand(-0.1, 0.1);
    const r0 = 0.95;
    const l = len * rand(0.6, 1.2);
    const ph = ang + rand(0, 6.28);
    for (let i = 0; i < segs; i++) {
      for (const j of [i, i + 1]) {
        const s = j / segs;
        P.push(Math.cos(ang) * r0 * (1 - s * 0.15), -0.02 - s * l, Math.sin(ang) * r0 * (1 - s * 0.15));
        S.push(s);
        PH.push(ph);
        L.push(l);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(PH, 1));
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(L, 1));
  return g;
}

function oralArmGeometry(count, len) {
  // frilly curtains hanging from the centre
  const P = [];
  const S = [];
  const PH = [];
  const L = [];
  const I = [];
  const rows = 28;
  let base = 0;
  for (let k = 0; k < count; k++) {
    const ang = (k / count) * Math.PI * 2 + 0.4;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const ph = ang * 2.0;
    for (let i = 0; i <= rows; i++) {
      const s = i / rows;
      const width = 0.22 * (1 - s * 0.6);
      const frill = Math.sin(s * 30 + k) * 0.06;
      for (const side of [0, 1]) {
        const off = side * width;
        P.push(dir.x * (0.05 + off) + frill * dir.z, -0.1 - s * len, dir.z * (0.05 + off) - frill * dir.x);
        S.push(s);
        PH.push(ph);
        L.push(len);
      }
      if (i < rows) {
        const a = base + i * 2;
        I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base += (rows + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(PH, 1));
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(L, 1));
  g.setIndex(I);
  return g;
}

let BELL_GEO = null;

class Jelly {
  constructor(theme, size) {
    this.theme = theme;
    this.size = size;
    this.group = new THREE.Group();
    const u = (extra = {}) => ({
      uTime: UW.uTime,
      uPulse: this.pulseU,
      uHue: { value: theme.hue + rand(-0.04, 0.04) },
      uSpread: { value: theme.spread },
      uSat: { value: theme.sat },
      uBright: this.bright,
      ...extra,
    });
    this.pulseU = { value: 0 };
    this.bright = { value: 1 };
    this.drag = { value: new THREE.Vector3() };
    BELL_GEO ??= bellGeometry();
    const bell = new THREE.Mesh(
      BELL_GEO,
      new THREE.ShaderMaterial({
        uniforms: u({ uComb: { value: theme.comb } }),
        vertexShader: bellVS,
        fragmentShader: bellFS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    const strandMat = (alpha) =>
      new THREE.ShaderMaterial({
        uniforms: u({ uDrag: this.drag, uAlpha: { value: alpha } }),
        vertexShader: strandVS,
        fragmentShader: strandFS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
    const tent = new THREE.LineSegments(tentacleGeometry(18, 22, rand(2.5, 4.5)), strandMat(0.9));
    const arms = new THREE.Mesh(oralArmGeometry(4, rand(1.2, 2.2)), strandMat(0.35));
    bell.renderOrder = tent.renderOrder = arms.renderOrder = 3;
    bell.frustumCulled = tent.frustumCulled = arms.frustumCulled = false;
    this.group.add(bell, tent, arms);
    this.group.scale.setScalar(size);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.axis = new THREE.Vector3(0, 1, 0);
    this.target = new THREE.Vector3(0, 1, 0);
    this.period = rand(1.6, 2.6);
    this.phase = Math.random() * this.period;
    this.wander = Math.random() * 100;
  }

  update(dt, t) {
    this.phase += dt;
    const cyc = (this.phase % this.period) / this.period;
    const pulse = cyc < 0.3 ? Math.sin((cyc / 0.3) * Math.PI * 0.5) : Math.max(0, 1 - (cyc - 0.3) / 0.45) ** 2;
    this.pulseU.value = pulse;
    // propulsion during contraction
    if (cyc < 0.3) this.vel.addScaledVector(this.axis, dt * 0.09 * (this.size / 0.05));
    this.vel.y -= dt * 0.006; // slight negative buoyancy
    this.vel.multiplyScalar(Math.exp(-dt * 1.4));
    // wander the axis, keep mostly upright, steer away from walls
    this.wander += dt * 0.15;
    const m = this.size * 2.5;
    this.target.set(Math.sin(this.wander * 1.3) * 0.5, 1.2, Math.cos(this.wander) * 0.4);
    const p = this.pos;
    if (p.x < INNER.minX + m) this.target.x += 2;
    if (p.x > INNER.maxX - m) this.target.x -= 2;
    if (p.z < INNER.minZ + m) this.target.z += 2;
    if (p.z > INNER.maxZ - m) this.target.z -= 2;
    if (p.y > INNER.maxY - this.size * 1.5) this.target.y = -1.5;
    if (p.y < INNER.minY + 0.12 + this.size * 4) this.target.y = 2.5;
    this.target.normalize();
    this.axis.lerp(this.target, 1 - Math.exp(-dt * 0.6)).normalize();
    p.addScaledVector(this.vel, dt);
    p.x = clamp(p.x, INNER.minX + this.size, INNER.maxX - this.size);
    p.z = clamp(p.z, INNER.minZ + this.size, INNER.maxZ - this.size);
    p.y = clamp(p.y, INNER.minY + 0.05, INNER.maxY - this.size * 0.9);
    this.group.position.copy(p);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.axis);
    // trailing tentacles (object space)
    const localV = this.vel.clone().applyQuaternion(this.group.quaternion.clone().invert());
    this.drag.value.copy(localV).multiplyScalar(-6).clampLength(0, 0.6);
  }
}

export class Jellyfish {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.brightness = 1;
  }

  get count() {
    return this.items.length;
  }

  add(n = 1, themeIndex = null) {
    for (let i = 0; i < n; i++) {
      const theme = JELLY_THEMES[themeIndex ?? Math.floor(Math.random() * JELLY_THEMES.length)];
      const j = new Jelly(theme, rand(0.032, 0.058));
      j.pos.set(rand(INNER.minX + 0.15, INNER.maxX - 0.15), rand(0.2, 0.45), rand(INNER.minZ + 0.1, INNER.maxZ - 0.1));
      j.bright.value = this.brightness;
      this.items.push(j);
      this.group.add(j.group);
    }
  }

  remove(n = 1) {
    for (let i = 0; i < n && this.items.length; i++) {
      const j = this.items.pop();
      this.group.remove(j.group);
      j.group.traverse((o) => o.material?.dispose());
    }
  }

  clear() {
    this.remove(this.items.length);
  }

  setBrightness(b) {
    this.brightness = b;
    for (const j of this.items) j.bright.value = b;
  }

  update(dt, t) {
    for (const j of this.items) j.update(dt, t);
  }
}
