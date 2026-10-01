import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { TANK, INNER, IS_MOBILE, asset } from './config.js';
import { UW } from './scene/underwater.js';
import { Caustics } from './scene/caustics.js';
import { Tank } from './scene/tank.js';
import { Room } from './scene/room.js';
import { Substrate } from './scene/substrate.js';
import { Plants } from './scene/plants.js';
import { Decor } from './scene/decor.js';
import { Bubbles, Particles, GodRays, Food, updatePointScale } from './scene/effects.js';
import { Jellyfish } from './scene/jellyfish.js';
import { FishManager } from './fish/school.js';
import { SPECIES_BY_ID } from './fish/species.js';
import { PRESETS, LIGHT_MODES } from './presets.js';
import { Ambience } from './audio.js';
import { createUI } from './ui.js';
import { rand, lerp, clamp } from './util/noise.js';

const STORE_KEY = 'fishtank:v1';
// ?lite in the URL starts without heavy effects (troubleshooting / weak GPUs)
const LITE = new URLSearchParams(location.search).has('lite');

const DEFAULT_STATE = {
  preset: 'reef',
  light: 'reef',
  intensity: 1,
  lightColor: null,
  waterTint: null,
  clarity: 1,
  backdrop: 'reef',
  caustics: true,
  rays: true,
  bubbles: true,
  particles: true,
  bloom: true,
  room: 0.6,
  sound: false,
  fish: null,
  jellies: null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (e) {
    /* storage unavailable */
  }
  return { ...DEFAULT_STATE };
}

class App {
  constructor() {
    this.state = loadState();
    this.listeners = new Set();
    this.timer = new THREE.Timer();
    this.time = 0;
    this.camMode = 'orbit';
    this.selected = null;
    this.flash = 0;
    this.stormTimer = 3;
    this.shake = 0;
    this.fpsAcc = { t: 0, n: 0 };
    this.maxPixelRatio = LITE ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.pixelRatio = this.maxPixelRatio;
    this.lightColor = new THREE.Color();
    this.audio = new Ambience();
  }

  async init() {
    const canvas = document.getElementById('scene');
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(this.pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.debug.onShaderError = (gl, program, vs, fs) => {
      const log = (gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs) || gl.getProgramInfoLog(program) || '').trim();
      console.error('Shader error:', log);
      this.ui?.hint('Shader-Fehler: ' + log.split('\n')[0].slice(0, 120), 8000);
    };

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x050608);
    scene.fog = new THREE.FogExp2(0x07080a, 0.045);

    const camera = (this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 60));
    camera.position.set(0, 0.27, 1.55);
    const controls = (this.controls = new OrbitControls(camera, canvas));
    controls.target.set(0, 0.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.25;
    controls.maxDistance = 4.2;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = 1.78;
    controls.minAzimuthAngle = -1.5;
    controls.maxAzimuthAngle = 1.5;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.6;
    controls.screenSpacePanning = true;
    this.fitCamera();
    camera.position.z = this.fitDist;

    // ---------- loading
    this.setLoadText('Lade Texturen …');
    this.slowTimer = setTimeout(() => {
      const el = document.getElementById('load-text');
      if (el && document.getElementById('loader'))
        el.innerHTML = 'Das dauert ungewöhnlich lange … <a href="?lite" style="color:#46d3ff">ohne Effekte starten</a>';
    }, 25000);
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => this.setProgress(loaded / Math.max(total, 1));
    const texLoader = new THREE.TextureLoader(manager);
    const loader = new GLTFLoader(manager);
    loader.setMeshoptDecoder(MeshoptDecoder);
    this.loader = loader;
    const tex = (name, srgb = true) =>
      texLoader.loadAsync(asset(`tex/${name}.webp`)).then((t) => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        return t;
      });
    const [roomTex, sandTex, woodTex, reefTex, amazonTex] = await Promise.all([
      tex('room'),
      tex('sand'),
      tex('wood'),
      tex('reef'),
      tex('amazon'),
    ]);
    this.backdropTex = { reef: reefTex, amazon: amazonTex };
    const envTex = roomTex.clone();
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.needsUpdate = true;

    // ---------- world
    this.caustics = new Caustics(renderer, IS_MOBILE ? 384 : 512);
    this.room = new Room({ scene, roomTex, woodTex });
    this.tank = new Tank({ scene, envTex, caustics: this.caustics, isMobile: IS_MOBILE });
    this.substrate = new Substrate(scene, sandTex);
    this.plants = new Plants(scene);
    this.decor = new Decor({ scene, loader, substrate: this.substrate });
    this.food = new Food(scene);
    this.bubbles = new Bubbles(scene);
    this.particles = new Particles(scene, IS_MOBILE ? 380 : 750);
    this.rays = new GodRays(scene, IS_MOBILE ? 9 : 14);
    this.jellies = new Jellyfish(scene);
    this.fishEnv = this.makeFishEnv();
    this.fish = new FishManager({ scene, loader, substrate: this.substrate, food: this.food, envMap: this.fishEnv });
    this.fish.viewer = camera.position;
    this.fish.onRemove = (f) => {
      if (this.selected === f) this.selectFish(null);
    };

    // ---------- post processing
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const ext = renderer.extensions;
    const floatOk = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: floatOk ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: IS_MOBILE ? 2 : 4,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    // A single NaN/Inf pixel (driver-specific maths) would be smeared over the
    // whole screen by the bloom blur – scrub them before bloom.
    this.composer.addPass(
      new ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform sampler2D tDiffuse; varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            if (any(isnan(c)) || any(isinf(c)) || !(c.r + c.g + c.b >= 0.0)) c = vec4(0.0, 0.0, 0.0, 1.0);
            gl_FragColor = vec4(min(c.rgb, vec3(16.0)), c.a);
          }`,
      })
    );
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.onResize());
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ui?.hint('Grafik-Kontext verloren – wird wiederhergestellt …', 4000);
    });
    this.onResize();
    this.bindInput(canvas);

    this.ui = createUI(this);
    if (LITE) Object.assign(this.state, { bloom: false, rays: false });
    this.setLoadText('Lade 3D-Modelle …');
    await this.setPreset(this.state.preset, { restore: true });
    this.applySettings();

    // Compile all shaders without blocking the page (KHR_parallel_shader_compile),
    // so the browser stays responsive on drivers with slow compilers.
    this.setLoadText('Bereite Grafik vor …');
    this.setProgress(1);
    try {
      await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 15000))]);
    } catch (e) {
      console.warn('compileAsync failed', e);
    }
    let first = true;
    renderer.setAnimationLoop(() => {
      this.frame();
      if (first) {
        first = false;
        clearTimeout(this.slowTimer);
        this.hideLoader();
      }
    });
  }

  setLoadText(text) {
    const el = document.getElementById('load-text');
    if (el) el.textContent = text;
  }

  // ------------------------------------------------------------ helpers
  makeFishEnv() {
    // soft studio-like gradient: bright from above, dim from the sand
    const s = new THREE.Scene();
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; void main(){ float y = vP.y; vec3 top = vec3(1.4,1.45,1.5); vec3 mid = vec3(0.25,0.32,0.38); vec3 bot = vec3(0.12,0.1,0.08); vec3 c = y > 0.0 ? mix(mid, top, pow(max(y, 0.0), 0.7)) : mix(mid, bot, pow(max(-y, 0.0), 0.6)); gl_FragColor = vec4(c, 1.0); }`,
    });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), m));
    const pm = new THREE.PMREMGenerator(this.renderer);
    const rt = pm.fromScene(s, 0.02);
    pm.dispose();
    return rt.texture;
  }

  setProgress(p) {
    const bar = document.getElementById('load-bar');
    if (bar) bar.style.width = `${Math.round(clamp(p, 0, 1) * 100)}%`;
  }

  hideLoader() {
    const el = document.getElementById('loader');
    el.classList.add('done');
    setTimeout(() => el.remove(), 1200);
  }

  emit() {
    for (const cb of this.listeners) cb(this);
  }

  onChange(cb) {
    this.listeners.add(cb);
  }

  save() {
    if (LITE) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        const s = { ...this.state, fish: this.counts(), jellies: this.jellies.count };
        localStorage.setItem(STORE_KEY, JSON.stringify(s));
      } catch (e) {
        /* ignore */
      }
    }, 400);
  }

  counts() {
    const c = {};
    for (const [id, g] of this.fish.groups) if (g.fish.length) c[id] = g.fish.length;
    return c;
  }

  // ------------------------------------------------------------ presets & settings
  async setPreset(id, { restore = false, keepFish = false } = {}) {
    const p = PRESETS[id] ?? PRESETS.reef;
    this.state.preset = id;
    if (!restore) {
      this.state.light = p.light;
      this.state.backdrop = p.backdrop;
      this.state.waterTint = null;
      this.state.lightColor = null;
    }
    this.busy = true;
    this.emit();

    this.substrate.setProfile(p.sand.profile, p.sand.tint, p.sand.skirt);
    const { obstacles, footprints, homes } = await this.decor.build(p.decor);
    this.plants.build(p.plants, this.substrate, footprints, 11);
    this.bubbles.setSources(p.bubbles, this.substrate);
    this.fish.setObstacles(obstacles, homes);
    this.particles.uniforms.uGlow.value = p.glowParticles ? 1 : 0;
    this.food.items.length = 0;

    const fishCounts = restore && this.state.fish ? this.state.fish : p.fish;
    const jellyCount = restore && this.state.jellies != null ? this.state.jellies : p.jellies;
    if (!keepFish) {
      this.fish.clear();
      this.jellies.clear();
      await Promise.all(Object.entries(fishCounts).map(([fid, n]) => (SPECIES_BY_ID[fid] ? this.fish.add(fid, n) : null)));
      this.jellies.add(jellyCount);
    }
    this.state.fish = null;
    this.state.jellies = null;
    this.applySettings();
    this.busy = false;
    this.emit();
    this.save();
  }

  set(key, value) {
    this.state[key] = value;
    if (key === 'sound') value ? this.audio.start() : this.audio.stop();
    this.applySettings();
    this.emit();
    this.save();
  }

  applySettings() {
    const s = this.state;
    const p = PRESETS[s.preset] ?? PRESETS.reef;
    this.waterScatter = new THREE.Color(s.waterTint ?? p.water.scatter);
    const clarity = clamp(s.clarity, 0.2, 2.5);
    UW.uAbsorb.value.set(...p.water.absorb).multiplyScalar(1 / clarity);
    if (s.waterTint) {
      // derive absorption from the chosen tint: colours far from the tint are absorbed
      const c = new THREE.Color(s.waterTint);
      UW.uAbsorb.value.set(0.25 + (1 - c.r) * 1.6, 0.2 + (1 - c.g) * 1.4, 0.15 + (1 - c.b) * 1.4).multiplyScalar(1 / clarity);
    }
    const bd = s.backdrop;
    this.tank.setBackdrop(bd, this.backdropTex[bd] ?? null);
    this.rays.group.visible = s.rays;
    this.particles.points.visible = s.particles;
    this.bubbles.enabled = s.bubbles;
    this.audio.bubbleRate = s.bubbles ? 1 : 0;
    this.caustics.uniforms.uAmount.value = s.caustics ? 1 : 0;
    this.bloom.enabled = s.bloom;
  }

  async addFish(id, n = 1) {
    if (id === 'jelly') this.jellies.add(n);
    else await this.fish.add(id, n);
    this.emit();
    this.save();
  }

  removeFish(id, n = 1) {
    if (id === 'jelly') this.jellies.remove(n);
    else this.fish.remove(id, n);
    this.emit();
    this.save();
  }

  clearFish() {
    this.fish.clear();
    this.jellies.clear();
    this.emit();
    this.save();
  }

  feed(x = rand(-0.35, 0.35), z = rand(-0.1, 0.12)) {
    this.food.drop(x, z, 18);
    if (this.audio.on) for (let i = 0; i < 4; i++) setTimeout(() => this.audio.blip(0.6), i * 60);
  }

  knock() {
    const p = new THREE.Vector3(rand(-0.3, 0.3), rand(0.15, 0.4), INNER.maxZ);
    this.fish.tap(p);
    this.audio.knock();
    this.shake = 0.25;
  }

  // ------------------------------------------------------------ light
  updateLight(dt, t) {
    const s = this.state;
    const mode = LIGHT_MODES[s.light] ?? LIGHT_MODES.day;
    const c = this.lightColor.set(s.lightColor ?? mode.color);
    let intensity = mode.intensity * s.intensity;
    if (mode.dynamic === 'rainbow') c.setHSL((t * 0.04) % 1, 0.7, 0.62);
    if (mode.dynamic === 'disco') {
      const beat = Math.floor(t * 1.6);
      c.setHSL(((beat * 0.37) % 1 + t * 0.02) % 1, 0.95, 0.55);
      intensity *= 0.75 + 0.25 * Math.pow(1 - ((t * 1.6) % 1), 2);
    }
    if (mode.dynamic === 'storm') {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        this.flash = 1;
        this.stormTimer = rand(2.5, 9);
        this.flashDouble = Math.random() < 0.5 ? 0.18 : -1;
      }
      if (this.flashDouble > 0) {
        this.flashDouble -= dt;
        if (this.flashDouble <= 0) this.flash = 0.8;
      }
      intensity += this.flash * 2.6;
      c.lerp(new THREE.Color(0xe8f0ff), this.flash);
      this.flash = Math.max(0, this.flash - dt * 4.5);
    }
    this.tank.setLight(c, intensity);
    this.room.setSpill(c, intensity);
    const roomLight = mode.room * s.room * 2 + (mode.dynamic === 'storm' ? this.flash * 0.6 : 0);
    this.room.setRoomLight(clamp(roomLight, 0, 1.2));
    this.tank.setRoomReflection(0.25 + roomLight * 0.9);

    const lit = Math.min(intensity, 1.6);
    const tint = new THREE.Color(1, 1, 1).lerp(c, 0.55);
    UW.uScatter.value.copy(this.waterScatter).multiply(tint).multiplyScalar(0.18 + 0.75 * lit);
    UW.uAmbTop.value.copy(c).multiplyScalar(0.1 * lit).add(UW.uScatter.value.clone().multiplyScalar(0.55));
    UW.uAmbBottom.value.copy(c).multiplyScalar(0.05 * lit).add(UW.uScatter.value.clone().multiplyScalar(0.25));
    this.rays.uniforms.uColor.value.copy(c);
    this.rays.uniforms.uIntensity.value = lit * (0.55 + 0.45 * Math.sin(t * 0.3));
    this.bubbles.uniforms.uLight.value.copy(c).multiplyScalar(0.25 + 0.7 * lit);
    this.particles.uniforms.uLight.value.copy(c).multiplyScalar(0.3 + 0.6 * lit);
    this.food.uniforms.uLight.value = 0.3 + 0.6 * lit;
    const fl = mode.actinic * (0.35 + 0.5 * lit);
    this.decor.setFluorescence(new THREE.Color(0.18 * fl, 0.22 * fl, 0.32 * fl));
    this.fish.setEnvIntensity(0.25 + 0.55 * lit);
    this.substrate.skirtMat.emissiveIntensity = 0.06 + 0.22 * lit;
    this.jellies.setBrightness(0.75 + 0.6 * clamp(1 - lit, 0, 1));
    this.bloom.strength = 0.28 + 0.45 * clamp(1 - lit, 0, 1);
    this.scene.background.setRGB(0.012, 0.014, 0.018).multiplyScalar(0.4 + roomLight);
  }

  // ------------------------------------------------------------ camera
  fitCamera() {
    const aspect = innerWidth / innerHeight;
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    this.fitDist = Math.max(1.45, 0.72 / Math.tan(hfov / 2));
  }

  view(name) {
    this.setCamMode('orbit');
    const d = this.fitDist;
    const views = {
      front: [new THREE.Vector3(0, 0.27, d), new THREE.Vector3(0, 0.2, 0)],
      close: [new THREE.Vector3(0.12, 0.28, d * 0.5), new THREE.Vector3(0.05, 0.25, 0)],
      corner: [new THREE.Vector3(-d * 0.62, 0.36, d * 0.72), new THREE.Vector3(0, 0.25, 0)],
      top: [new THREE.Vector3(0, 1.45, 0.42), new THREE.Vector3(0, 0.2, 0)],
      sofa: [new THREE.Vector3(0.4, 0.55, d * 2.1), new THREE.Vector3(0, 0.05, 0)],
      inside: [new THREE.Vector3(-0.4, 0.3, 0.12), new THREE.Vector3(0.3, 0.26, -0.05)],
    };
    const [pos, target] = views[name] ?? views.front;
    this.camAnim = {
      p0: this.camera.position.clone(),
      t0: this.controls.target.clone(),
      p1: pos,
      t1: target,
      k: 0,
    };
  }

  setCamMode(mode) {
    this.camMode = mode;
    this.followYaw = null;
    this.followLook = null;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'cinema') this.cine = { t: 0, focus: null, switchT: 0, look: this.controls.target.clone() };
    if (mode === 'follow' && !this.selected) {
      const all = this.fish.fish;
      if (all.length) this.selectFish(all[Math.floor(Math.random() * all.length)], false);
      else this.camMode = 'orbit';
    }
    if (mode === 'orbit') {
      // keep the current framing
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.controls.target.copy(this.camera.position).addScaledVector(dir, 0.6);
    }
    this.emit();
  }

  selectFish(f, show = true) {
    this.selected = f;
    if (show) this.ui.showFish(f);
    this.emit();
  }

  updateCamera(dt, t) {
    const cam = this.camera;
    if (this.camAnim) {
      const a = this.camAnim;
      a.k = Math.min(1, a.k + dt / 1.6);
      const e = a.k < 0.5 ? 4 * a.k ** 3 : 1 - (-2 * a.k + 2) ** 3 / 2;
      cam.position.lerpVectors(a.p0, a.p1, e);
      this.controls.target.lerpVectors(a.t0, a.t1, e);
      if (a.k >= 1) this.camAnim = null;
    }
    if (this.camMode === 'orbit') {
      this.controls.update();
    } else if (this.camMode === 'cinema') {
      const c = this.cine;
      c.t += dt;
      c.switchT -= dt;
      if ((c.switchT <= 0 || !this.fish.fish.includes(c.focus)) && this.fish.fish.length) {
        c.focus = this.fish.fish[Math.floor(Math.random() * this.fish.fish.length)];
        c.switchT = rand(9, 16);
      }
      const ph = c.t * 0.045;
      const radius = this.fitDist * (0.55 + 0.25 * Math.sin(c.t * 0.07));
      const az = Math.sin(ph) * 0.85;
      const pos = new THREE.Vector3(Math.sin(az) * radius, 0.24 + 0.12 * Math.sin(c.t * 0.09), Math.cos(az) * radius);
      cam.position.lerp(pos, 1 - Math.exp(-dt * 0.8));
      const look = c.focus ? c.focus.pos.clone().lerp(new THREE.Vector3(0, 0.27, 0), 0.35) : new THREE.Vector3(0, 0.27, 0);
      c.look.lerp(look, 1 - Math.exp(-dt * 1.2));
      cam.lookAt(c.look);
    } else if (this.camMode === 'follow') {
      const f = this.selected;
      if (!f || !this.fish.fish.includes(f)) {
        this.setCamMode('orbit');
      } else {
        // chase camera: distance scales with the fish but always fits into the
        // tank, and the camera swings round slowly when the fish turns
        const fy = Math.atan2(f.dir.x, f.dir.z);
        if (this.followYaw == null) this.followYaw = fy;
        let dy = fy - this.followYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.followYaw += dy * (1 - Math.exp(-dt * 1.3));
        const fwd = new THREE.Vector3(Math.sin(this.followYaw), 0, Math.cos(this.followYaw));
        const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
        const back = clamp(f.scale * 1.7, 0.12, 0.3);
        const want = f.pos.clone().addScaledVector(fwd, -back).addScaledVector(side, back * 0.4);
        want.y += f.scale * 0.35 + 0.015;
        const m = 0.03;
        want.x = clamp(want.x, INNER.minX + m, INNER.maxX - m);
        want.z = clamp(want.z, INNER.minZ + m, INNER.maxZ - m);
        want.y = clamp(want.y, this.substrate.heightAt(want.x, want.z) + 0.03, INNER.maxY - 0.025);
        const rock = this.fish.insideObstacle(want, 0.01);
        if (rock) want.y = Math.min(INNER.maxY - 0.025, rock.max.y + 0.04);
        cam.position.lerp(want, 1 - Math.exp(-dt * 2));
        const look = f.pos.clone().addScaledVector(f.dir, f.scale * 0.4);
        if (!this.followLook) this.followLook = look.clone();
        this.followLook.lerp(look, 1 - Math.exp(-dt * 3));
        cam.lookAt(this.followLook);
      }
    }
    if (this.shake > 0) {
      this.shake -= dt;
      const k = this.shake * 0.004;
      cam.position.x += Math.sin(t * 90) * k;
      cam.position.y += Math.cos(t * 77) * k;
    }
  }

  // ------------------------------------------------------------ input
  bindInput(canvas) {
    let down = null;
    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dur = performance.now() - down.t;
      down = null;
      if (moved < 7 && dur < 450) this.click(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.hover = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerleave', () => (this.hover = null));
    canvas.addEventListener('wheel', () => {
      if (this.camMode !== 'orbit') this.setCamMode('orbit');
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'f') this.toggleFullscreen();
      else if (k === 'h') this.ui.toggleHidden();
      else if (k === 'k') this.knock();
      else if (k === ' ') {
        e.preventDefault();
        this.feed();
      } else if (k === 'c') this.setCamMode(this.camMode === 'cinema' ? 'orbit' : 'cinema');
      else if (k === 'escape') {
        this.selectFish(null, false);
        this.ui.showFish(null);
        if (this.camMode !== 'orbit') this.setCamMode('orbit');
      } else if (/^[1-7]$/.test(k)) this.setPreset(Object.keys(PRESETS)[+k - 1]);
    });
  }

  rayFrom(x, y) {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    return rc.ray;
  }

  click(x, y) {
    const ray = this.rayFrom(x, y);
    const f = this.fish.pick(ray);
    if (f) {
      this.selectFish(f);
      return;
    }
    const box = new THREE.Box3(new THREE.Vector3(INNER.minX, INNER.minY, INNER.minZ), new THREE.Vector3(INNER.maxX, INNER.maxY, INNER.maxZ));
    const hit = ray.intersectBox(box, new THREE.Vector3());
    if (hit) {
      this.feed(clamp(hit.x, INNER.minX + 0.03, INNER.maxX - 0.03), clamp(hit.z, INNER.minZ + 0.03, INNER.maxZ - 0.03));
      this.ui.hint('Futter! 🍤', 1200);
    }
  }

  toggleFullscreen() {
    const d = document;
    const el = d.documentElement;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.())?.catch?.(() => {});
    } else {
      (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d);
    }
  }

  onResize() {
    const w = innerWidth;
    const h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.composer?.setPixelRatio(this.pixelRatio);
    this.composer?.setSize(w, h);
    this.fitCamera();
    updatePointScale(this.renderer, this.camera);
  }

  // Lower the resolution if the GPU can't keep up. Only ever steps down (no
  // ping-pong between sizes) and ignores the first seconds / hidden tabs.
  adaptQuality() {
    const now = performance.now() / 1000;
    const a = this.fpsAcc;
    if (document.hidden) {
      a.start = null;
      return;
    }
    if (a.start == null) {
      a.start = now + 5;
      a.n = 0;
      a.low = 0;
      return;
    }
    if (now < a.start) return;
    a.n++;
    if (now - a.start < 4) return;
    const fps = a.n / (now - a.start);
    a.start = now;
    a.n = 0;
    a.low = fps < 30 ? a.low + 1 : 0;
    if (a.low >= 2 && this.pixelRatio > 0.75) {
      a.low = 0;
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
      this.onResize();
    }
  }

  // If the frame comes out completely black (broken driver maths), fall back
  // step by step to simpler rendering instead of showing nothing.
  // Runs only a handful of times after start-up (each check is one readPixels).
  watchdog() {
    const t = performance.now() / 1000;
    const w = (this.wd ??= { next: t + 3, step: 0, checks: 0 });
    if (t < w.next || w.step > 3 || w.checks >= 4) return;
    w.next = t + 3;
    w.checks++;
    const gl = this.renderer.getContext();
    const width = gl.drawingBufferWidth;
    const row = new Uint8Array(width * 4);
    gl.readPixels(0, Math.floor(gl.drawingBufferHeight * 0.55), width, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
    let lit = 0;
    for (let i = 0; i < row.length; i += 16) lit += row[i] + row[i + 1] + row[i + 2];
    if (lit > 0) return;
    w.checks = 0;
    w.step++;
    console.warn('FishTank: black frame detected, fallback step', w.step);
    if (w.step === 1) this.set('bloom', false);
    else if (w.step === 2) this.set('rays', false);
    else if (w.step === 3) {
      this.set('caustics', false);
      this.set('particles', false);
    }
    this.ui.hint('Kompatibilitätsmodus für deine Grafikkarte aktiviert', 4000);
  }

  // ------------------------------------------------------------ main loop
  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.time += dt;
    const t = this.time;
    UW.uTime.value = t;

    this.updateLight(dt, t);
    this.caustics.update(t);
    this.fish.update(dt, t);
    this.jellies.update(dt, t);
    this.food.update(dt, this.substrate);
    this.bubbles.update(dt, t);
    if (this.state.particles) this.particles.update(dt, t);
    this.updateCamera(dt, t);
    this.rays.update(this.camera);
    this.ui.update?.(dt);
    this.composer.render(dt);
    this.watchdog();
    this.adaptQuality();
  }
}

const app = new App();
window.__app = app;
app.init().catch((err) => {
  console.error(err);
  const el = document.getElementById('load-text');
  if (el) el.textContent = 'Fehler beim Laden: ' + err.message;
});
