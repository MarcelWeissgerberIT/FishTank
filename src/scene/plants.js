import * as THREE from 'three';
import { INNER } from '../config.js';
import { patchUnderwater } from './underwater.js';
import { rng } from '../util/noise.js';

const SHAPES = {
  grass: (t) => Math.max(0.04, 1 - Math.pow(t, 3)),
  ribbon: (t) => (t > 0.92 ? (1 - t) / 0.08 : 1) * 0.9 + 0.1,
  sword: (t) => (t < 0.18 ? 0.1 : Math.pow(Math.max(0, Math.sin((Math.PI * (t - 0.18)) / 0.82)), 0.75)),
  round: (t) => Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.5),
  leaf: (t) => Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.85),
};

function bladeGeometry(shape, segs, curve) {
  const fn = SHAPES[shape];
  const P = [];
  const N = [];
  const UV = [];
  const C = [];
  const I = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = fn(t) * 0.5;
    const z = curve * t * t;
    const shade = 0.45 + 0.55 * Math.min(1, t * 1.6);
    P.push(-w, t, z, w, t, z);
    N.push(0, 0.35, 1, 0, 0.35, 1);
    UV.push(0, t, 1, t);
    C.push(shade, shade, shade, shade, shade, shade);
    if (i < segs) {
      const a = i * 2;
      I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}

const TYPES = {
  vallisneria: { shape: 'ribbon', segs: 14, curve: 0.18, sway: 0.09, speed: 0.9, rough: 0.55 },
  rotala: { shape: 'grass', segs: 10, curve: 0.08, sway: 0.05, speed: 1.1, rough: 0.6 },
  hairgrass: { shape: 'grass', segs: 6, curve: 0.2, sway: 0.12, speed: 1.4, rough: 0.6 },
  carpet: { shape: 'round', segs: 4, curve: 0.25, sway: 0.03, speed: 1.6, rough: 0.55 },
  sword: { shape: 'sword', segs: 12, curve: 0.35, sway: 0.035, speed: 0.8, rough: 0.45 },
  litter: { shape: 'leaf', segs: 6, curve: 0.08, sway: 0, speed: 0, rough: 0.8 },
};

export class Plants {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  clear() {
    for (const m of [...this.group.children]) {
      m.geometry.dispose();
      m.material.dispose();
      this.group.remove(m);
    }
  }

  // specs: [{ type, count, area:[x0,x1,z0,z1], height:[a,b], width:[a,b], colors:[...], clusters? }]
  build(specs, substrate, obstacles = [], seed = 7) {
    this.clear();
    const R = rng(seed);
    const r = (a, b) => a + (b - a) * R();
    const blocked = (x, z) => obstacles.some((o) => (x - o.x) ** 2 + (z - o.z) ** 2 < o.r * o.r);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();

    for (const spec of specs) {
      const type = TYPES[spec.type];
      const geo = bladeGeometry(type.shape, type.segs, type.curve);
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: type.rough,
        metalness: 0,
      });
      patchUnderwater(mat, {
        plant: true,
        sway: type.sway ? { amp: { value: type.sway }, speed: { value: type.speed } } : null,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, spec.count);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const [x0, x1, z0, z1] = spec.area ?? [INNER.minX + 0.02, INNER.maxX - 0.02, INNER.minZ + 0.02, INNER.maxZ - 0.02];

      // cluster centres
      const clusters = [];
      const nClusters = spec.clusters ?? 0;
      for (let c = 0, tries = 0; c < nClusters && tries < 400; tries++) {
        const cx = r(x0, x1);
        const cz = r(z0, z1);
        if (blocked(cx, cz)) continue;
        clusters.push([cx, cz]);
        c++;
      }

      let n = 0;
      for (let tries = 0; n < spec.count && tries < spec.count * 8; tries++) {
        let x;
        let z;
        let base = null;
        if (clusters.length) {
          base = clusters[Math.floor(R() * clusters.length)];
          const ang = R() * Math.PI * 2;
          const rad = Math.sqrt(R()) * (spec.clusterRadius ?? 0.04);
          x = base[0] + Math.cos(ang) * rad;
          z = base[1] + Math.sin(ang) * rad;
        } else {
          x = r(x0, x1);
          z = r(z0, z1);
        }
        if (x < INNER.minX + 0.01 || x > INNER.maxX - 0.01 || z < INNER.minZ + 0.01 || z > INNER.maxZ - 0.01) continue;
        if (blocked(x, z)) continue;
        const y = substrate.heightAt(x, z) - 0.004;
        let h = r(spec.height[0], spec.height[1]);
        h = Math.min(h, INNER.maxY - y - 0.015);
        const w = r(spec.width[0], spec.width[1]);
        let tilt = r(spec.tilt?.[0] ?? 0, spec.tilt?.[1] ?? 0.15);
        let yaw = R() * Math.PI * 2;
        if (spec.type === 'sword' && base) {
          // rosette: leaves point away from the centre
          yaw = Math.atan2(x - base[0], z - base[1]) + r(-0.3, 0.3);
        }
        if (spec.type === 'litter') {
          tilt = Math.PI / 2 - r(0, 0.25);
          h = Math.min(h, 0.06);
        }
        e.set(tilt, yaw, r(-0.08, 0.08), 'YXZ');
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(x, spec.type === 'litter' ? y + 0.006 : y, z), q, new THREE.Vector3(w, h, h));
        mesh.setMatrixAt(n, m4);
        col.set(spec.colors[Math.floor(R() * spec.colors.length)]);
        col.offsetHSL(r(-0.02, 0.02), r(-0.05, 0.05), r(-0.06, 0.06));
        mesh.setColorAt(n, col);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
    }
  }
}
