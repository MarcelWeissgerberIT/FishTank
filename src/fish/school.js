import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { INNER, asset } from '../config.js';
import { SPECIES_BY_ID } from './species.js';
import { patchUnderwater } from '../scene/underwater.js';
import { rand, clamp, lerp, noise2 } from '../util/noise.js';

const MAX_PER_SPECIES = 80;
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();
const tmpG = new THREE.Vector3();

// smooth signed noise in [-1, 1]
const nz = (x, seed) => (noise2(x, seed) - 0.5) * 2;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class FishManager {
  constructor({ scene, loader, substrate, food, envMap }) {
    this.scene = scene;
    this.loader = loader;
    this.substrate = substrate;
    this.food = food;
    this.envMap = envMap;
    this.groups = new Map();
    this.loading = new Map();
    this.fish = [];
    this.obstacles = [];
    this.homes = [];
    this.schoolGoals = new Map();
    this.envIntensity = 0.6;
  }

  setObstacles(list, homes = []) {
    this.obstacles = list;
    this.homes = homes;
  }

  count(id) {
    return this.groups.get(id)?.fish.length ?? 0;
  }

  get total() {
    return this.fish.length;
  }

  ensure(id) {
    if (this.groups.has(id)) return Promise.resolve(this.groups.get(id));
    if (this.loading.has(id)) return this.loading.get(id);
    const sp = SPECIES_BY_ID[id];
    const p = this.loader.loadAsync(asset(`fish/${id}.glb`)).then((gltf) => {
      const geos = [];
      let material = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        geos.push(g);
        material ??= o.material;
      });
      let geo = geos.length > 1 ? mergeGeometries(geos) : geos[0];
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const c = bb.getCenter(new THREE.Vector3());
      const size = bb.getSize(new THREE.Vector3());
      geo.translate(-c.x, -c.y, -c.z);
      geo.scale(1 / size.z, 1 / size.z, 1 / size.z);
      geo.computeBoundingSphere();
      sp.aspect = { w: size.x / size.z, h: size.y / size.z };

      const mat = material.clone();
      mat.metalness = 0;
      mat.roughness = 0.42;
      mat.envMap = this.envMap;
      mat.envMapIntensity = this.envIntensity;
      const swimU = {
        amp: { value: sp.swim.amp },
        wave: { value: sp.swim.wave },
        stiff: { value: sp.swim.stiff },
      };
      patchUnderwater(mat, { swim: swimU });

      const mesh = new THREE.InstancedMesh(geo, mat, MAX_PER_SPECIES);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      const swimAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PER_SPECIES * 3), 3);
      swimAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aSwim', swimAttr);
      this.scene.add(mesh);
      const group = { sp, mesh, mat, swimAttr, fish: [] };
      this.groups.set(id, group);
      this.loading.delete(id);
      return group;
    });
    this.loading.set(id, p);
    return p;
  }

  async add(id, n = 1, opts = {}) {
    const group = await this.ensure(id);
    const sp = group.sp;
    // schooling fish spawn close to their mates (or to the first new fish)
    let center = sp.school >= 0.5 ? group.fish[0]?.pos.clone() ?? null : null;
    for (let i = 0; i < n && group.fish.length < MAX_PER_SPECIES; i++) {
      const f = this.spawn(sp, opts);
      if (sp.school >= 0.5) {
        if (!center) {
          center = f.pos.clone();
        } else {
          f.pos.copy(center).add(tmpV.set(rand(-0.08, 0.08), rand(-0.04, 0.04), rand(-0.06, 0.06)));
          const b = this.bounds(f, f.pos.x, f.pos.z);
          f.pos.set(clamp(f.pos.x, b.minX, b.maxX), clamp(f.pos.y, b.minY, b.maxY), clamp(f.pos.z, b.minZ, b.maxZ));
          f.dir.copy(group.fish[0]?.dir ?? f.dir);
          f.yaw = Math.atan2(f.dir.x, f.dir.z);
        }
      }
      f.group = group;
      group.fish.push(f);
      this.fish.push(f);
    }
    group.mesh.count = group.fish.length;
  }

  remove(id, n = 1) {
    const group = this.groups.get(id);
    if (!group) return;
    for (let i = 0; i < n && group.fish.length; i++) {
      const f = group.fish.pop();
      this.fish.splice(this.fish.indexOf(f), 1);
      if (this.onRemove) this.onRemove(f);
    }
    group.mesh.count = group.fish.length;
  }

  clear() {
    for (const [id, g] of this.groups) this.remove(id, g.fish.length);
  }

  bounds(f, x, z) {
    const sp = f.sp;
    const mH = sp.length * 0.55;
    const sand = this.substrate.heightAt(x, z);
    return {
      minX: INNER.minX + mH,
      maxX: INNER.maxX - mH,
      minZ: INNER.minZ + Math.min(mH, 0.12),
      maxZ: INNER.maxZ - Math.min(mH, 0.12),
      minY: sand + Math.max(0.012, sp.length * (sp.aspect?.h ?? 0.4) * 0.45),
      maxY: INNER.maxY - Math.max(0.015, sp.length * (sp.aspect?.h ?? 0.4) * 0.4),
    };
  }

  zoneY(f, x, z, t) {
    const b = this.bounds(f, x, z);
    const [lo, hi] = f.sp.zone;
    return lerp(b.minY, b.maxY, lerp(lo, hi, t));
  }

  randomPoint(f, out = new THREE.Vector3(), tries = 12) {
    for (let k = 0; k < tries; k++) {
      const b = this.bounds(f, 0, 0);
      const x = rand(b.minX, b.maxX);
      const z = rand(b.minZ, b.maxZ);
      out.set(x, this.zoneY(f, x, z, Math.random()), z);
      if (!this.insideObstacle(out, f.sp.length * 0.3)) return out;
    }
    return out;
  }

  insideObstacle(p, pad = 0) {
    for (const o of this.obstacles) {
      if (
        p.x > o.min.x - pad && p.x < o.max.x + pad &&
        p.y > o.min.y - pad && p.y < o.max.y + pad &&
        p.z > o.min.z - pad && p.z < o.max.z + pad
      )
        return o;
    }
    return null;
  }

  spawn(sp, opts) {
    const f = {
      sp,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      dir: new THREE.Vector3(1, 0, 0),
      goal: new THREE.Vector3(),
      goalTimer: 0,
      mode: 'swim',
      modeTimer: rand(2, 8),
      yaw: 0,
      turn: 0,
      roll: 0,
      phase: Math.random() * 10,
      scale: sp.length * rand(0.85, 1.12),
      seed: Math.random() * 100,
      flee: 0,
      fleeDir: new THREE.Vector3(),
      hunger: rand(0.5, 1),
      lap: Math.random() < 0.5 ? -1 : 1,
      amp: 1,
    };
    this.randomPoint(f, f.pos);
    if (opts.from) f.pos.copy(opts.from);
    const a = Math.random() * Math.PI * 2;
    f.dir.set(Math.sin(a), 0, Math.cos(a));
    f.vel.copy(f.dir).multiplyScalar(sp.speed[0] * 0.5);
    f.yaw = a;
    this.pickGoal(f);
    return f;
  }

  // Now and then a fish swims up to the front glass to look at the viewer,
  // or goes to nibble at a rock or coral.
  maybeExplore(f) {
    const b = f.sp.behavior;
    if (b === 'school' || b === 'bottom' || b === 'walker' || b === 'patrol') return false;
    const r = Math.random();
    const v = this.viewer;
    if (v && v.z > INNER.maxZ + 0.05 && r < 0.07) {
      const bb = this.bounds(f, 0, INNER.maxZ);
      const x = clamp(v.x * 0.5 + rand(-0.15, 0.15), bb.minX, bb.maxX);
      const y = clamp(v.y + rand(-0.08, 0.05), bb.minY + 0.03, bb.maxY - 0.03);
      f.goal.set(x, y, this.bounds(f, x, INNER.maxZ).maxZ - 0.02);
      f.mode = 'visit';
      f.modeTimer = f.goalTimer = 14;
      return true;
    }
    const pInspect = b === 'lurk' || b === 'perch' ? 0.35 : b === 'host' ? 0 : 0.18;
    if (this.obstacles.length && r < 0.07 + pInspect) {
      const o = this.obstacles[Math.floor(Math.random() * this.obstacles.length)];
      let x = rand(o.min.x, o.max.x);
      let z = rand(o.min.z, o.max.z);
      let y;
      if (Math.random() < 0.5) y = o.max.y + f.scale * 0.3 + 0.01;
      else {
        z = o.max.z + f.scale * 0.35;
        y = rand(o.min.y + 0.03, o.max.y);
      }
      const bb = this.bounds(f, x, z);
      f.goal.set(clamp(x, bb.minX, bb.maxX), clamp(y, bb.minY, bb.maxY), clamp(z, bb.minZ, bb.maxZ));
      f.mode = 'inspect';
      f.modeTimer = f.goalTimer = 12;
      return true;
    }
    return false;
  }

  pickGoal(f) {
    const sp = f.sp;
    if (f.mode === 'swim' && this.maybeExplore(f)) return;
    const b = this.bounds(f, f.pos.x, f.pos.z);
    switch (sp.behavior) {
      case 'cruise':
      case 'patrol': {
        f.lap = -f.lap;
        const x = f.lap * (b.maxX - rand(0, 0.12));
        const z = rand(b.minZ, b.maxZ);
        f.goal.set(x, this.zoneY(f, x, z, Math.random()), z);
        f.goalTimer = rand(6, 14);
        break;
      }
      case 'school': {
        this.randomPoint(f, f.goal);
        f.goalTimer = rand(3, 7);
        break;
      }
      case 'host': {
        const home = this.homes[Math.floor(f.seed) % Math.max(1, this.homes.length)];
        if (home) {
          f.goal.set(home.x + rand(-0.06, 0.06), home.y + rand(0.0, 0.08), home.z + rand(-0.05, 0.05));
        } else {
          tmpV.set(rand(-0.15, 0.15), rand(-0.05, 0.05), rand(-0.1, 0.1));
          f.goal.copy(f.pos).add(tmpV);
        }
        f.goalTimer = rand(1.5, 4);
        break;
      }
      case 'bottom':
      case 'walker':
      case 'perch': {
        const r = sp.behavior === 'walker' ? 0.3 : 0.18;
        const x = clamp(f.pos.x + rand(-r, r), b.minX, b.maxX);
        const z = clamp(f.pos.z + rand(-r * 0.6, r * 0.6), b.minZ, b.maxZ);
        const bb = this.bounds(f, x, z);
        f.goal.set(x, bb.minY + (sp.behavior === 'perch' ? rand(0, 0.05) : 0.002), z);
        f.goalTimer = rand(2, 6);
        break;
      }
      default: {
        // hover / lurk / flow: shorter excursions near the current spot
        const r = sp.behavior === 'lurk' ? 0.15 : 0.28;
        const x = clamp(f.pos.x + rand(-r, r), b.minX, b.maxX);
        const z = clamp(f.pos.z + rand(-r * 0.6, r * 0.6), b.minZ, b.maxZ);
        f.goal.set(x, this.zoneY(f, x, z, Math.random()), z);
        f.goalTimer = rand(3, 8);
      }
    }
    // clamp goal into the swimmable box
    const gb = this.bounds(f, f.goal.x, f.goal.z);
    f.goal.x = clamp(f.goal.x, gb.minX, gb.maxX);
    f.goal.z = clamp(f.goal.z, gb.minZ, gb.maxZ);
    f.goal.y = clamp(f.goal.y, gb.minY, gb.maxY);
  }

  freeSwim(f, dt, t) {
    const sp = f.sp;
    const cruise = sp.speed[0];
    const burst = sp.speed[1];
    const steer = tmpV2.set(0, 0, 0);

    // ---- desired velocity
    let goal = f.goal;
    if (sp.behavior === 'school' && f.mode !== 'feed') {
      const sg = this.schoolGoals.get(sp.id);
      if (sg) {
        f.schoolOff ??= new THREE.Vector3(rand(-0.07, 0.07), rand(-0.03, 0.03), rand(-0.05, 0.05));
        goal = tmpG.copy(sg.goal).add(f.schoolOff);
      }
    }
    const toGoal = tmpV.copy(goal).sub(f.pos);
    const dist = toGoal.length();
    const still = f.mode === 'pause' || f.mode === 'rest' || f.mode === 'look' || f.mode === 'peck';
    let desiredSpeed = cruise;
    if (still) desiredSpeed = 0;
    else if (f.mode === 'forage') desiredSpeed = cruise * 0.25;
    else if (f.mode === 'feed') desiredSpeed = lerp(cruise, burst, 0.7);
    else if (f.mode === 'surface') desiredSpeed = burst * 0.8;
    if (f.mode !== 'feed') desiredSpeed *= Math.min(1, dist / 0.08);
    // individual mood: some moments faster, some lazier
    desiredSpeed *= 0.8 + 0.4 * (noise2(t * 0.15, f.seed + 40));

    // burst-and-coast: a few strong tail beats, then gliding
    let pulse = 1;
    const beat = sp.beat ?? 1;
    if (beat > 0 && !still && f.mode !== 'forage') {
      f.beat = (f.beat ?? Math.random()) + dt / (beat * (0.85 + 0.3 * noise2(t * 0.2, f.seed)));
      const sb = Math.max(0, Math.sin((f.beat % 1) * Math.PI * 2));
      pulse = 0.62 + 0.78 * sb * sb;
    }
    f.pulse = pulse;
    desiredSpeed *= pulse;

    if (dist > 1e-4) toGoal.multiplyScalar(desiredSpeed / dist);
    else toGoal.set(0, 0, 0);
    if (f.mode === 'forage') {
      toGoal.x += Math.sin(t * 2.1 + f.seed) * cruise * 0.4;
      toGoal.z += Math.cos(t * 1.7 + f.seed) * cruise * 0.4;
    }
    if (f.mode === 'peck') {
      // nibbling: tiny pushes forward and back
      toGoal.addScaledVector(f.dir, Math.sin(t * 9 + f.seed) * cruise * 0.35);
    }
    steer.copy(toGoal).sub(f.vel).multiplyScalar(sp.agility * 0.9);

    // organic wander: smooth sideways and vertical drift so paths curve
    f.wa = (f.wa ?? f.seed) + dt * (0.3 + 0.12 * sp.agility);
    const lat = nz(f.wa, f.seed);
    const ver = nz(f.wa * 0.6, f.seed + 31);
    const wk = sp.behavior === 'walker' && still ? 0 : (sp.wander ?? 0.8) * cruise * (still ? 0.5 : 2.2);
    steer.x += -f.dir.z * lat * wk;
    steer.z += f.dir.x * lat * wk;
    steer.y += ver * wk * 0.3;

    // ---- neighbours: separation + schooling
    let ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0, nn = 0;
    const schoolR = sp.behavior === 'school' ? 0.2 : 0.22;
    for (const o of this.fish) {
      if (o === f) continue;
      const dx = f.pos.x - o.pos.x;
      const dy = f.pos.y - o.pos.y;
      const dz = f.pos.z - o.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const minD = (f.scale + o.scale) * 0.42;
      if (d2 < minD * minD && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const k = ((minD - d) / minD) * cruise * 10;
        steer.x += (dx / d) * k;
        steer.y += (dy / d) * k * 0.6;
        steer.z += (dz / d) * k;
      }
      if (sp.school > 0 && o.sp === sp && d2 < schoolR * schoolR) {
        ax += o.vel.x; ay += o.vel.y; az += o.vel.z;
        cx += o.pos.x; cy += o.pos.y; cz += o.pos.z;
        nn++;
      }
    }
    if (nn > 0 && f.mode !== 'feed') {
      const s = sp.school;
      const coh = sp.behavior === 'school' ? 3.2 : 1.4;
      steer.x += (ax / nn - f.vel.x) * s * 1.8 + (cx / nn - f.pos.x) * s * coh;
      steer.y += (ay / nn - f.vel.y) * s * 1.2 + (cy / nn - f.pos.y) * s * coh * 0.8;
      steer.z += (az / nn - f.vel.z) * s * 1.8 + (cz / nn - f.pos.z) * s * coh;
    }

    // ---- walls (look-ahead)
    const look = f.scale * 0.8 + f.vel.length() * 0.8;
    const ahead = tmpV.copy(f.dir).multiplyScalar(look).add(f.pos);
    const b = this.bounds(f, ahead.x, ahead.z);
    const W = 10;
    if (ahead.x < b.minX) steer.x += (b.minX - ahead.x) * W;
    if (ahead.x > b.maxX) steer.x -= (ahead.x - b.maxX) * W;
    if (ahead.z < b.minZ) steer.z += (b.minZ - ahead.z) * W;
    if (ahead.z > b.maxZ) steer.z -= (ahead.z - b.maxZ) * W;
    if (ahead.y < b.minY) steer.y += (b.minY - ahead.y) * W;
    if (ahead.y > b.maxY) steer.y -= (ahead.y - b.maxY) * W;

    const pb = this.bounds(f, f.pos.x, f.pos.z);
    if (f.pos.x < pb.minX) steer.x += (pb.minX - f.pos.x) * W * 2;
    if (f.pos.x > pb.maxX) steer.x -= (f.pos.x - pb.maxX) * W * 2;
    if (f.pos.z < pb.minZ) steer.z += (pb.minZ - f.pos.z) * W * 2;
    if (f.pos.z > pb.maxZ) steer.z -= (f.pos.z - pb.maxZ) * W * 2;

    // ---- obstacles (decor boxes)
    const pad = f.scale * 0.35;
    for (const o of this.obstacles) {
      if (
        ahead.x > o.min.x - pad && ahead.x < o.max.x + pad &&
        ahead.y > o.min.y - pad && ahead.y < o.max.y + pad &&
        ahead.z > o.min.z - pad && ahead.z < o.max.z + pad
      ) {
        const cxo = (o.min.x + o.max.x) / 2;
        const czo = (o.min.z + o.max.z) / 2;
        const px = ahead.x - cxo;
        const pz = ahead.z - czo;
        const up = o.max.y + pad - ahead.y;
        const sideX = (o.max.x - o.min.x) / 2 + pad - Math.abs(px);
        const sideZ = (o.max.z - o.min.z) / 2 + pad - Math.abs(pz);
        if (up < sideX && up < sideZ && o.max.y < INNER.maxY - 0.08) steer.y += up * W * 1.2;
        else if (sideX < sideZ) steer.x += Math.sign(px || 1) * sideX * W;
        else steer.z += Math.sign(pz || 1) * sideZ * W;
      }
    }

    // ---- fleeing
    let maxSpeed = burst;
    if (f.flee > 0) {
      steer.addScaledVector(f.fleeDir, burst * 9 * f.flee);
      f.flee -= dt;
      maxSpeed = burst * 1.5;
    }

    // integrate
    const maxAcc = burst * sp.agility * 2.5;
    if (steer.length() > maxAcc) steer.setLength(maxAcc);
    f.vel.addScaledVector(steer, dt);
    if (sp.behavior === 'walker' && (f.mode === 'rest' || f.mode === 'pause')) f.vel.multiplyScalar(Math.exp(-dt * 3));
    const speed = f.vel.length();
    if (speed > maxSpeed) f.vel.multiplyScalar(maxSpeed / speed);
    // fish swim mostly level: limit climb/dive relative to forward speed
    const maxPitch = f.mode === 'surface' ? 1.2 : sp.maxPitch ?? 0.45;
    const vh = Math.hypot(f.vel.x, f.vel.z);
    const vyMax = Math.tan(maxPitch) * Math.max(vh, cruise * 0.3);
    f.vel.y = clamp(f.vel.y, -vyMax, vyMax);
    f.pos.addScaledVector(f.vel, dt);

    // hard limits
    const hb = this.bounds(f, f.pos.x, f.pos.z);
    const hard = (v, lo, hi, axis) => {
      if (v < lo) {
        f.vel[axis] = Math.abs(f.vel[axis]) * 0.3;
        return lo;
      }
      if (v > hi) {
        f.vel[axis] = -Math.abs(f.vel[axis]) * 0.3;
        return hi;
      }
      return v;
    };
    f.pos.x = hard(f.pos.x, hb.minX - 0.02, hb.maxX + 0.02, 'x');
    f.pos.z = hard(f.pos.z, hb.minZ - 0.02, hb.maxZ + 0.02, 'z');
    f.pos.y = hard(f.pos.y, hb.minY - 0.004, hb.maxY + 0.01, 'y');
    const inside = this.insideObstacle(f.pos, -0.002);
    if (inside) {
      // push out to the top of the obstacle
      f.pos.y += (inside.max.y - f.pos.y) * Math.min(1, dt * 4);
    }
  }

  // Smooth lap following with a limited turn rate (no wall braking), with
  // gliding phases, tail-beat bursts and small heading wobbles.
  patrolMove(f, dt, t) {
    const sp = f.sp;
    const target = this.patrolTarget(f, dt, t);
    if (f.pyaw == null) f.pyaw = Math.atan2(f.dir.x, f.dir.z);
    const d = wrapAngle(Math.atan2(target.x - f.pos.x, target.z - f.pos.z) - f.pyaw);
    const maxTurn = 0.9 + 0.35 * nz(t * 0.2, f.seed + 2);
    f.pyaw = wrapAngle(f.pyaw + clamp(d, -maxTurn * dt, maxTurn * dt) + nz(t * 0.6, f.seed + 11) * 0.12 * dt);
    f.kickT = (f.kickT ?? rand(3, 8)) - dt;
    if (f.kickT <= 0) {
      f.kick = rand(0.8, 1.8);
      f.kickT = rand(5, 12);
    }
    let pulse = 0.85 + 0.25 * nz(t * 0.18, f.seed + 9);
    if (f.kick > 0) {
      f.kick -= dt;
      pulse = 1.4;
    }
    f.pulse = pulse;
    const want = sp.speed[0] * pulse * (1 - 0.25 * Math.min(1, Math.abs(d)));
    f.pv = f.pv == null ? want : lerp(f.pv, want, 1 - Math.exp(-dt * 1.2));
    // glide over rocks that lie ahead on the path
    let ty = target.y;
    let climb = 0.013;
    const hh = sp.length * (sp.aspect?.h ?? 0.3);
    for (const look of [0.12, 0.24, 0.36]) {
      const ax = f.pos.x + Math.sin(f.pyaw) * look;
      const az = f.pos.z + Math.cos(f.pyaw) * look;
      for (const o of this.obstacles) {
        // trigger below a lower line than the clearance we climb to (hysteresis, no bobbing)
        if (ax > o.min.x - 0.04 && ax < o.max.x + 0.04 && az > o.min.z - 0.04 && az < o.max.z + 0.04 && f.pos.y < o.max.y + hh * 0.45) {
          ty = Math.max(ty, o.max.y + hh * 0.7);
          climb = 0.035;
        }
      }
    }
    f.lift = climb > 0.02;
    let vy = clamp((ty - f.pos.y) * 0.6, -climb, climb);
    // two sharks on crossing laps pass above/below each other
    for (const o of this.fish) {
      if (o === f || o.sp.group !== 'shark') continue;
      const dx = o.pos.x - f.pos.x;
      const dz = o.pos.z - f.pos.z;
      const dy = f.pos.y - o.pos.y;
      if (dx * dx + dz * dz < 0.09 && Math.abs(dy) < 0.08) vy += Math.sign(dy || f.seed - 50) * 0.01;
    }
    f.vel.set(Math.sin(f.pyaw) * f.pv, clamp(vy, -0.04, 0.04), Math.cos(f.pyaw) * f.pv);
    f.pos.addScaledVector(f.vel, dt);
    const b = this.bounds(f, f.pos.x, f.pos.z);
    f.pos.set(clamp(f.pos.x, b.minX, b.maxX), clamp(f.pos.y, b.minY, b.maxY), clamp(f.pos.z, b.minZ, b.maxZ));
  }

  // The lap is never quite the same: its size, centre and depth drift, the
  // shark sometimes cuts across the tank or turns around.
  patrolTarget(f, dt, t) {
    const sp = f.sp;
    const rx = Math.max(0.12, INNER.maxX - sp.length * 0.85 - 0.04);
    const rz = Math.max(0.05, INNER.maxZ - Math.min(sp.length * 0.55, 0.12) - 0.03);
    const pickY = () => {
      // stay above the decor so rocks don't keep pushing the shark up and down
      const b = this.bounds(f, 0, 0);
      // cruise above most of the decor; the few taller pieces are glided over
      const tops = this.obstacles.map((o) => o.max.y).sort((a, c) => a - c);
      const q = tops.length ? tops[Math.floor((tops.length - 1) * 0.75)] : 0;
      const top = q + sp.length * (sp.aspect?.h ?? 0.3) * 0.5;
      return clamp(Math.max(this.zoneY(f, 0, 0, Math.random()), top), b.minY, b.maxY - 0.05);
    };
    if (f.lapDir == null) {
      f.lapDir = Math.random() < 0.5 ? 1 : -1;
      f.patrolY = pickY();
      f.patrolT = rand(12, 25);
      f.excT = rand(12, 25);
    }
    f.patrolT -= dt;
    if (f.patrolT <= 0) {
      f.patrolT = rand(10, 22);
      f.patrolY = pickY();
      if (Math.random() < 0.35) f.lapDir *= -1;
    }
    f.curY = f.curY == null ? f.pos.y : lerp(f.curY, f.patrolY, 1 - Math.exp(-dt * 0.25));
    const yb = this.bounds(f, f.pos.x, f.pos.z);
    const y = clamp(f.curY + 0.05 * nz(t * 0.09, f.seed + 5), yb.minY + 0.02, yb.maxY - 0.04);

    // occasional excursion straight through the middle of the tank
    f.excT -= dt;
    if (f.excT <= 0) {
      f.excT = rand(9, 22);
      f.exc = { p: new THREE.Vector3(rand(-rx * 0.8, rx * 0.8), 0, rand(-rz, rz)), timer: rand(4, 8) };
      if (Math.random() < 0.4) f.patrolY = pickY();
    }
    if (f.exc) {
      f.exc.timer -= dt;
      const dx = f.exc.p.x - f.pos.x;
      const dz = f.exc.p.z - f.pos.z;
      if (f.exc.timer <= 0 || dx * dx + dz * dz < 0.006) f.exc = null;
      else return tmpG.set(f.exc.p.x, y, f.exc.p.z);
    }

    const cx = nz(t * 0.04, f.seed + 1) * 0.12;
    const cz = -0.01 + nz(t * 0.045, f.seed + 6) * 0.03;
    const rxE = (rx - Math.abs(cx)) * (0.72 + 0.28 * nz(t * 0.05, f.seed + 2));
    const rzE = Math.max(0.035, rz * (0.6 + 0.4 * nz(t * 0.06, f.seed + 3)));
    const ang = Math.atan2((f.pos.z - cz) / rzE, (f.pos.x - cx) / rxE);
    const a2 = ang + f.lapDir * (0.6 + 0.2 * nz(t * 0.1, f.seed + 4));
    return tmpG.set(cx + Math.cos(a2) * rxE, y, cz + Math.sin(a2) * rzE);
  }

  tap(point) {
    for (const f of this.fish) {
      const d = f.pos.distanceTo(point);
      if (d > 0.75) continue;
      const fear = f.sp.group === 'shark' ? 0.4 : 1;
      f.flee = (0.6 + Math.random() * 0.8) * fear * (1 - d / 0.9);
      f.fleeDir.copy(f.pos).sub(point).normalize();
      f.fleeDir.x += rand(-0.4, 0.4);
      f.fleeDir.y += rand(-0.3, 0.3);
      f.fleeDir.normalize();
      f.mode = 'swim';
    }
  }

  pick(ray) {
    let best = null;
    let bestT = Infinity;
    for (const f of this.fish) {
      const r = f.scale * 0.42;
      tmpV.copy(f.pos).sub(ray.origin);
      const t = tmpV.dot(ray.direction);
      if (t < 0) continue;
      const d2 = tmpV.lengthSq() - t * t;
      if (d2 < r * r && t < bestT) {
        bestT = t;
        best = f;
      }
    }
    return best;
  }

  setEnvIntensity(v) {
    this.envIntensity = v;
    for (const g of this.groups.values()) g.mat.envMapIntensity = v;
  }

  update(dt, t) {
    dt = Math.min(dt, 0.05);
    // shared school goals
    for (const [id, g] of this.groups) {
      if (g.sp.behavior !== 'school' || !g.fish.length) continue;
      let sg = this.schoolGoals.get(id);
      if (!sg) {
        sg = { goal: g.fish[0].pos.clone(), target: new THREE.Vector3(), timer: 0, curve: 1 };
        this.schoolGoals.set(id, sg);
      }
      sg.timer -= dt;
      if (sg.timer <= 0 || sg.goal.distanceTo(sg.target) < 0.06) {
        this.randomPoint(g.fish[0], sg.target);
        sg.timer = rand(5, 11);
        sg.curve = Math.random() < 0.5 ? 1 : -1;
      }
      // the shared waypoint glides on a curved path, the school follows it
      tmpV.copy(sg.target).sub(sg.goal);
      if (tmpV.lengthSq() > 1e-6) {
        tmpV.normalize();
        const v = g.sp.speed[0] * 0.85 * dt;
        sg.goal.x += (tmpV.x - tmpV.z * sg.curve * 0.7) * v;
        sg.goal.y += tmpV.y * v;
        sg.goal.z += (tmpV.z + tmpV.x * sg.curve * 0.7) * v;
        const b = this.bounds(g.fish[0], sg.goal.x, sg.goal.z);
        sg.goal.set(clamp(sg.goal.x, b.minX, b.maxX), clamp(sg.goal.y, b.minY + 0.03, b.maxY - 0.03), clamp(sg.goal.z, b.minZ, b.maxZ));
      }
    }

    const foods = this.food.items;
    for (const f of this.fish) this.steer(f, dt, t, foods);

    for (const g of this.groups.values()) {
      const arr = g.swimAttr.array;
      g.fish.forEach((f, i) => {
        tmpE.set(f.pitch ?? 0, f.yaw, f.roll, 'YXZ');
        tmpQ.setFromEuler(tmpE);
        tmpS.setScalar(f.scale);
        tmpM.compose(f.pos, tmpQ, tmpS);
        g.mesh.setMatrixAt(i, tmpM);
        arr[i * 3] = f.phase;
        arr[i * 3 + 1] = f.amp;
        arr[i * 3 + 2] = clamp(f.turn * 0.12, -0.9, 0.9);
      });
      g.mesh.instanceMatrix.needsUpdate = true;
      g.swimAttr.needsUpdate = true;
    }
  }

  steer(f, dt, t, foods) {
    const sp = f.sp;
    const cruise = sp.speed[0];

    f.hunger = Math.min(1, f.hunger + dt * 0.012);
    f.goalTimer -= dt;
    f.modeTimer -= dt;

    // ---- behaviour state machine
    if (f.mode !== 'feed' && f.modeTimer <= 0) {
      const b = sp.behavior;
      if (['pause', 'forage', 'rest', 'visit', 'look', 'inspect', 'peck'].includes(f.mode)) {
        f.mode = 'swim';
        f.modeTimer = rand(3, 10);
        this.pickGoal(f);
      } else if (b === 'hover' || b === 'lurk' || b === 'flow' || b === 'perch') {
        f.mode = 'pause';
        f.modeTimer = b === 'lurk' ? rand(5, 14) : rand(1.5, 5);
      } else if (b === 'bottom') {
        if (Math.random() < 0.18) {
          f.mode = 'surface';
          const x = f.pos.x;
          const z = f.pos.z;
          f.goal.set(x, this.bounds(f, x, z).maxY, z);
          f.modeTimer = 6;
        } else {
          f.mode = 'forage';
          f.modeTimer = rand(2, 6);
        }
      } else if (b === 'walker') {
        f.mode = Math.random() < 0.7 ? 'rest' : 'swim';
        f.modeTimer = f.mode === 'rest' ? rand(4, 12) : rand(4, 8);
        if (f.mode === 'swim') {
          const x = rand(INNER.minX + 0.2, INNER.maxX - 0.2);
          const z = rand(INNER.minZ + 0.1, INNER.maxZ - 0.1);
          f.goal.set(x, this.zoneY(f, x, z, rand(0.3, 1.5)), z);
        }
      } else {
        f.modeTimer = rand(4, 10);
      }
    }
    if (f.mode === 'surface' && f.pos.y > this.bounds(f, f.pos.x, f.pos.z).maxY - 0.01) {
      f.mode = 'swim';
      f.modeTimer = rand(4, 10);
      this.pickGoal(f);
    }

    // ---- food
    let feeding = false;
    if (foods.length && f.hunger > 0.15) {
      let best = null;
      let bd = 0.55;
      for (const it of foods) {
        if (sp.behavior === 'bottom' || sp.behavior === 'walker') {
          if (it.state !== 'ground' && it.p.y > f.pos.y + 0.08) continue;
        }
        const d = it.p.distanceTo(f.pos);
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
      if (best) {
        feeding = true;
        f.goal.copy(best.p);
        f.mode = 'feed';
        if (bd < f.scale * 0.32 + 0.008) {
          this.food.remove(best);
          f.hunger -= 0.2;
          f.phase += 2.5;
        }
      }
    }
    if (!feeding && f.mode === 'feed') {
      f.mode = 'swim';
      this.pickGoal(f);
    }
    if ((f.mode === 'visit' || f.mode === 'inspect') && f.pos.distanceTo(f.goal) < Math.max(0.035, f.scale * 0.5)) {
      f.mode = f.mode === 'visit' ? 'look' : 'peck';
      f.modeTimer = f.mode === 'look' ? rand(2.5, 6) : rand(1.5, 4);
    }

    if (f.goalTimer <= 0 || (f.mode === 'swim' && f.pos.distanceTo(f.goal) < Math.max(0.03, f.scale * 0.5))) {
      if (f.mode === 'swim' || f.mode === 'pause' || f.mode === 'forage' || f.mode === 'rest') this.pickGoal(f);
    }

    // ---- movement: sharks follow their lap kinematically, everyone else steers
    const kinematic = sp.behavior === 'patrol' && !feeding && f.flee <= 0;
    if (kinematic) this.patrolMove(f, dt, t);
    else {
      f.pyaw = null;
      f.lift = false;
      this.freeSwim(f, dt, t);
    }


    // ---- orientation
    const sp2 = f.vel.length();
    if (f.mode === 'look' && this.viewer) {
      tmpV.set(this.viewer.x - f.pos.x, 0, this.viewer.z - f.pos.z).normalize();
      f.dir.lerp(tmpV, 1 - Math.exp(-dt * 1.6)).normalize();
    } else if (sp2 > Math.max(0.006, cruise * 0.12)) {
      const vh = Math.hypot(f.vel.x, f.vel.z);
      const maxP = f.mode === 'surface' ? 1.0 : f.lift ? 0.4 : sp.maxPitch ?? 0.45;
      const p = clamp(Math.atan2(f.vel.y, Math.max(vh, 1e-6)), -maxP, maxP);
      let hx = f.dir.x;
      let hz = f.dir.z;
      if (vh > 1e-4) {
        hx = f.vel.x / vh;
        hz = f.vel.z / vh;
      } else {
        const hl = Math.hypot(hx, hz) || 1;
        hx /= hl;
        hz /= hl;
      }
      tmpV.set(hx * Math.cos(p), Math.sin(p), hz * Math.cos(p));
      f.dir.lerp(tmpV, 1 - Math.exp(-dt * (kinematic ? 8 : sp.agility * 2.2))).normalize();
    } else if (f.mode === 'pause' && Math.random() < dt * 0.15) {
      // occasionally turn on the spot
      f.goal.copy(f.pos).add(tmpV.set(rand(-0.1, 0.1), 0, rand(-0.05, 0.05)));
    }
    const yaw = Math.atan2(f.dir.x, f.dir.z);
    const dyaw = wrapAngle(yaw - f.yaw) / Math.max(dt, 1e-4);
    f.yaw = yaw;
    f.turn = lerp(f.turn, dyaw, 1 - Math.exp(-dt * 5));
    const sinMax = Math.sin(f.mode === 'surface' ? 1.0 : f.lift ? 0.4 : sp.maxPitch ?? 0.45);
    let pitch = -Math.asin(clamp(f.dir.y, -sinMax, sinMax));
    if (f.mode === 'forage') pitch += 0.28;
    if (f.mode === 'peck') pitch += 0.3;
    if (sp.behavior === 'walker' && f.mode === 'rest') pitch = 0;
    f.pitch = lerp(f.pitch ?? 0, pitch, 1 - Math.exp(-dt * 4));
    const maxRoll = sp.group === 'shark' ? 0.3 : 0.45;
    f.roll = lerp(f.roll, clamp(-f.turn * 0.12, -maxRoll, maxRoll), 1 - Math.exp(-dt * 4));

    // ---- swimming animation
    const rel = clamp(sp2 / cruise, 0, 2);
    let rate = sp.swim.base + (sp.swim.k * sp2) / sp.length;
    let amp = 0.3 + 0.7 * Math.min(1.3, rel);
    const thrust = clamp(((f.pulse ?? 1) - 0.62) / 0.78, 0, 1);
    amp *= 0.6 + 0.75 * thrust;
    rate *= 0.8 + 0.4 * thrust;
    if (f.mode === 'pause' || f.mode === 'rest' || f.mode === 'look' || f.mode === 'peck') {
      rate = sp.swim.base * 0.7;
      amp = sp.behavior === 'walker' ? 0.08 : 0.25;
    }
    f.amp = lerp(f.amp, amp, 1 - Math.exp(-dt * 3));
    f.phase += rate * dt;
    if (f.mode === 'pause' || f.mode === 'look') f.pos.y += Math.cos(t * 1.2 + f.seed) * 0.002 * dt;
  }
}
