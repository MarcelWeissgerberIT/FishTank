import * as THREE from 'three';
import { INNER, TANK } from '../config.js';
import { UW } from './underwater.js';
import { rand } from '../util/noise.js';

const pointScale = { value: 800 };
export function updatePointScale(renderer, camera) {
  const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
  pointScale.value = (h * camera.projectionMatrix.elements[5]) / 2;
}

const POINT_VS = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.01), 1.0, 64.0);
  vAlpha = aAlpha;
  vColor = aColor;
}`;

// ---------------------------------------------------------------- bubbles
export class Bubbles {
  constructor(scene, max = 500) {
    this.max = max;
    this.items = [];
    this.sources = [];
    this.enabled = true;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.color = new Float32Array(max * 3).fill(1);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    this.uniforms = { uScale: pointScale, uLight: { value: new THREE.Color(1, 1, 1) }, uScatter: UW.uScatter };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: POINT_VS,
      fragmentShader: /* glsl */ `
        uniform vec3 uLight; uniform vec3 uScatter;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float r = length(c);
          if (r > 1.0) discard;
          float rim = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
          float hl = smoothstep(0.32, 0.0, length(c - vec2(-0.32, -0.36)));
          vec3 col = uLight * (rim * 0.75 + hl * 1.4) + uScatter * 0.25;
          gl_FragColor = vec4(col * vAlpha, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
    this.stones = new THREE.Group();
    scene.add(this.stones);
    this.stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a6066, roughness: 0.95 });
  }

  setSources(list, substrate) {
    this.sources = list.map((s) => ({ ...s, acc: 0 }));
    this.items.length = 0;
    this.stones.clear();
    for (const s of list) {
      if (s.hidden) continue;
      const y = substrate.heightAt(s.x, s.z);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.022, 16), this.stoneMat);
      st.position.set(s.x, y + 0.006, s.z);
      this.stones.add(st);
      // air hose up to the rim
      const hose = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(s.x, y + 0.012, s.z),
            new THREE.Vector3(s.x + 0.005, y + 0.05, INNER.minZ + 0.012),
            new THREE.Vector3(s.x + 0.01, TANK.h + 0.01, INNER.minZ + 0.006),
            new THREE.Vector3(s.x + 0.012, TANK.h + 0.02, -TANK.d / 2 - 0.04),
          ]),
          30,
          0.0022,
          6
        ),
        new THREE.MeshStandardMaterial({ color: 0x9fb8b0, roughness: 0.3, transparent: true, opacity: 0.5 })
      );
      this.stones.add(hose);
      s.y = y + 0.018;
    }
    this.sources.forEach((s, i) => (s.y = list[i].y ?? substrate.heightAt(s.x, s.z) + 0.018));
  }

  update(dt, t) {
    if (this.enabled) {
      for (const s of this.sources) {
        s.acc += dt * s.rate;
        while (s.acc >= 1 && this.items.length < this.max) {
          s.acc -= 1;
          const size = rand(0.0012, 0.0042) * (s.big ?? 1);
          this.items.push({
            x: s.x + rand(-0.006, 0.006) * (s.spread ?? 1),
            y: s.y,
            z: s.z + rand(-0.006, 0.006) * (s.spread ?? 1),
            vy: 0.1 + size * 50,
            size,
            ph: Math.random() * 6.28,
            wob: rand(0.002, 0.006),
          });
        }
        if (s.acc > 1) s.acc = 0;
      }
    }
    const top = INNER.maxY - 0.002;
    let n = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i];
      b.vy = Math.min(b.vy + dt * 0.4, 0.16 + b.size * 60);
      b.y += b.vy * dt;
      b.ph += dt * 9;
      if (b.y > top) {
        this.items.splice(i, 1);
        continue;
      }
    }
    for (const b of this.items) {
      this.pos[n * 3] = b.x + Math.sin(b.ph) * b.wob;
      this.pos[n * 3 + 1] = b.y;
      this.pos[n * 3 + 2] = b.z + Math.cos(b.ph * 0.8) * b.wob;
      this.size[n] = b.size * 2;
      this.alpha[n] = Math.min(1, (top - b.y) * 60);
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- floating particles
export class Particles {
  constructor(scene, count = 700) {
    this.count = count;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const alpha = new Float32Array(count);
    const color = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = rand(INNER.minX, INNER.maxX);
      this.pos[i * 3 + 1] = rand(INNER.minY + 0.05, INNER.maxY);
      this.pos[i * 3 + 2] = rand(INNER.minZ, INNER.maxZ);
      size[i] = rand(0.0006, 0.0018);
      alpha[i] = rand(0.15, 0.6);
      const hue = Math.random();
      const c = new THREE.Color().setHSL(hue, 0.9, 0.6);
      color.set([c.r, c.g, c.b], i * 3);
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    this.uniforms = {
      uScale: pointScale,
      uLight: { value: new THREE.Color(1, 1, 1) },
      uGlow: { value: 0 },
      uTime: UW.uTime,
      uAmount: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: POINT_VS,
      fragmentShader: /* glsl */ `
        uniform vec3 uLight; uniform float uGlow; uniform float uTime; uniform float uAmount;
        varying float vAlpha; varying vec3 vColor; varying vec3 vWp;
        void main() {
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float r = dot(c, c);
          if (r > 1.0) discard;
          float soft = 1.0 - r;
          float tw = 0.5 + 0.5 * sin(uTime * 2.3 + vWp.x * 91.0 + vWp.z * 57.0);
          vec3 col = mix(uLight * 0.5, vColor * (0.6 + 1.6 * tw), uGlow);
          gl_FragColor = vec4(col * soft * vAlpha * uAmount, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
  }

  update(dt, t) {
    const p = this.pos;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      p[k] += Math.sin(t * 0.21 + i * 1.7) * 0.004 * dt + 0.003 * dt;
      p[k + 1] += Math.sin(t * 0.17 + i * 0.37) * 0.003 * dt - 0.0012 * dt;
      p[k + 2] += Math.cos(t * 0.19 + i * 2.3) * 0.003 * dt;
      if (p[k] > INNER.maxX) p[k] = INNER.minX;
      if (p[k + 1] < INNER.minY + 0.03) p[k + 1] = INNER.maxY - 0.01;
      if (p[k + 2] > INNER.maxZ) p[k + 2] = INNER.minZ;
      if (p[k + 2] < INNER.minZ) p[k + 2] = INNER.maxZ;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- god rays
export class GodRays {
  constructor(scene, count = 14) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.uniforms = { uColor: { value: new THREE.Color(1, 1, 1) }, uIntensity: { value: 0.5 }, uTime: UW.uTime };
    this.rays = [];
    const depth = INNER.maxY - INNER.minY;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, -0.5, 0);
    for (let i = 0; i < count; i++) {
      const w = rand(0.04, 0.13);
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms, uPhase: { value: Math.random() * 100 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uIntensity; uniform float uTime; uniform float uPhase;
          varying vec2 vUv;
          void main() {
            float ax = (vUv.x - 0.5) * 2.4;
            float across = exp(-ax * ax * 2.5);
            float along = pow(clamp(vUv.y, 0.0, 1.0), 1.6);
            float streak = 0.55 + 0.45 * sin(vUv.x * 23.0 + uTime * 0.5 + uPhase * 5.0);
            float flick = 0.5 + 0.5 * sin(uTime * 0.9 + uPhase) * sin(uTime * 0.31 + uPhase * 1.7);
            float edge = smoothstep(0.0, 0.08, vUv.y);
            gl_FragColor = vec4(uColor * (across * along * streak * flick * edge * uIntensity * 0.22), 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      const x = rand(INNER.minX + w, INNER.maxX - w);
      const z = rand(INNER.minZ + w * 0.6, INNER.maxZ - w * 0.6);
      m.position.set(x, INNER.maxY - 0.002, z);
      m.scale.set(w, depth * rand(0.75, 1), 1);
      m.userData.lean = rand(-0.12, 0.12);
      m.renderOrder = 4;
      this.group.add(m);
      this.rays.push(m);
    }
  }

  update(camera) {
    for (const r of this.rays) {
      const yaw = Math.atan2(camera.position.x - r.position.x, camera.position.z - r.position.z);
      r.rotation.set(0, yaw, r.userData.lean, 'YXZ');
    }
  }
}

// ---------------------------------------------------------------- fish food
export class Food {
  constructor(scene, max = 300) {
    this.max = max;
    this.items = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.color = new Float32Array(max * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: pointScale, uLight: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: POINT_VS,
      fragmentShader: /* glsl */ `
        uniform float uLight;
        varying float vAlpha; varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          if (abs(c.x) + abs(c.y) * 1.3 > 1.0) discard;
          gl_FragColor = vec4(vColor * (0.25 + uLight * 0.6), vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
    this.palette = [new THREE.Color(0xc0662a), new THREE.Color(0x8a4a20), new THREE.Color(0xd8a040), new THREE.Color(0x6a7a2a)];
  }

  drop(x, z, n = 16) {
    for (let i = 0; i < n && this.items.length < this.max; i++) {
      const c = this.palette[i % this.palette.length];
      this.items.push({
        p: new THREE.Vector3(x + rand(-0.03, 0.03), INNER.maxY - 0.002, z + rand(-0.03, 0.03)),
        state: 'float',
        timer: rand(0.4, 2.5),
        vs: rand(0.012, 0.028),
        ph: Math.random() * 6.28,
        life: 30,
        size: rand(0.0025, 0.004),
        c,
      });
    }
  }

  update(dt, substrate) {
    let n = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.ph += dt * 2;
      if (f.state === 'float') {
        f.p.x += Math.sin(f.ph) * 0.004 * dt;
        f.timer -= dt;
        if (f.timer <= 0) f.state = 'sink';
      } else if (f.state === 'sink') {
        f.p.y -= f.vs * dt;
        f.p.x += Math.sin(f.ph * 1.3) * 0.01 * dt;
        f.p.z += Math.cos(f.ph) * 0.008 * dt;
        const ground = substrate.heightAt(f.p.x, f.p.z) + 0.002;
        if (f.p.y <= ground) {
          f.p.y = ground;
          f.state = 'ground';
        }
      } else {
        f.life -= dt;
        if (f.life <= 0) {
          this.items.splice(i, 1);
          continue;
        }
      }
    }
    for (const f of this.items) {
      this.pos.set([f.p.x, f.p.y, f.p.z], n * 3);
      this.size[n] = f.size;
      this.alpha[n] = Math.min(1, f.life / 3);
      this.color.set([f.c.r, f.c.g, f.c.b], n * 3);
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'aSize', 'aAlpha', 'aColor']) this.geo.attributes[k].needsUpdate = true;
  }

  remove(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }
}
