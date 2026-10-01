import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TANK, INNER } from '../config.js';
import { UW, UW_GLSL } from './underwater.js';

const EQUIRECT_GLSL = /* glsl */ `
vec2 equirectUv(vec3 d) {
  if (abs(d.x) + abs(d.z) < 1e-5) d.x = 1e-5;
  return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}`;

const BACKDROP_GLSL = /* glsl */ `
uniform sampler2D uMap; uniform int uMode; uniform float uBright; uniform vec3 uLightColor;
vec3 backdropColor(vec2 uv) {
  if (uMode == 0) return texture2D(uMap, uv).rgb * uBright * mix(vec3(1.0), uLightColor, 0.35);
  if (uMode == 1) {
    float g = pow(clamp(1.0 - uv.y, 0.0, 1.0), 1.6);
    return mix(vec3(0.55, 0.75, 0.9), vec3(1.0, 1.0, 0.98), g) * (0.25 + 0.9 * g) * uBright * mix(vec3(1.0), uLightColor, 0.5);
  }
  return vec3(0.004, 0.006, 0.01);
}`;

const OUTPUT_GLSL = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>`;

function glassMaterial(envTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uEnv: { value: envTex },
      uEnvIntensity: { value: 1.0 },
      uTint: { value: new THREE.Color(0.55, 0.75, 0.68) },
      uBase: { value: 0.012 },
      uWaterMin: UW.uWaterMin,
      uWaterMax: UW.uWaterMax,
      uAbsorb: UW.uAbsorb,
      uScatter: UW.uScatter,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWp; varying vec3 vWn;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWp = wp.xyz; vWn = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uEnv; uniform float uEnvIntensity; uniform vec3 uTint; uniform float uBase;
      varying vec3 vWp; varying vec3 vWn;
      ${EQUIRECT_GLSL}
      ${UW_GLSL}
      void main() {
        // inner faces seen through the water: the TIR of the water volume takes over
        if (uwPathLength(cameraPosition, vWp) > 0.015) discard;
        vec3 V = normalize(vWp - cameraPosition);
        vec3 N = normalize(vWn);
        if (dot(N, V) > 0.0) N = -N;
        float c = clamp(dot(-V, N), 0.0, 1.0);
        float F = 0.045 + 0.955 * pow(1.0 - c, 5.0);
        vec3 R = reflect(V, N);
        vec3 env = texture2D(uEnv, equirectUv(R)).rgb * uEnvIntensity;
        float a = clamp(F * 0.9 + uBase, 0.0, 1.0);
        gl_FragColor = vec4(env * F + uTint * uBase, a);
        ${OUTPUT_GLSL}
      }`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export class Tank {
  constructor({ scene, envTex, caustics, isMobile }) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.envTex = envTex;

    // ---------- light from the LED bar, with caustics cookie + shadows
    const lightY = 3.6;
    const tanA = 0.205;
    const spot = new THREE.SpotLight(0xffffff, 6, 0, Math.atan(tanA), 0, 0);
    spot.position.set(0, lightY, 0);
    spot.target.position.set(0, 0, 0);
    spot.map = caustics.texture;
    spot.castShadow = true;
    spot.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
    spot.shadow.camera.near = 2.6;
    spot.shadow.camera.far = 3.8;
    spot.shadow.bias = -0.0003;
    spot.shadow.normalBias = 0.003;
    spot.shadow.radius = 3;
    scene.add(spot, spot.target);
    this.spot = spot;
    const dRef = lightY - 0.25;
    caustics.uniforms.uMask.value.set(INNER.maxX / (dRef * tanA), INNER.maxZ / (dRef * tanA));

    // ---------- glass box
    const g = TANK.glass;
    this.glassMat = glassMaterial(envTex);
    this.edgeMat = new THREE.MeshStandardMaterial({
      color: 0x7cc4a8,
      roughness: 0.15,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      emissive: 0x16352b,
      depthWrite: false,
    });
    const panel = (w, h, d, x, y, z, faceAxis) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      // groups: +x, -x, +y, -y, +z, -z
      const mats = [this.edgeMat, this.edgeMat, this.edgeMat, this.edgeMat, this.edgeMat, this.edgeMat];
      const faces = faceAxis === 'z' ? [4, 5] : faceAxis === 'x' ? [0, 1] : [2, 3];
      faces.forEach((i) => (mats[i] = this.glassMat));
      const m = new THREE.Mesh(geo, mats);
      m.position.set(x, y, z);
      m.renderOrder = 10;
      this.group.add(m);
      return m;
    };
    panel(TANK.w, TANK.h, g, 0, TANK.h / 2, TANK.d / 2 - g / 2, 'z');
    panel(TANK.w, TANK.h, g, 0, TANK.h / 2, -TANK.d / 2 + g / 2, 'z');
    panel(g, TANK.h, TANK.d - 2 * g, -TANK.w / 2 + g / 2, TANK.h / 2, 0, 'x');
    panel(g, TANK.h, TANK.d - 2 * g, TANK.w / 2 - g / 2, TANK.h / 2, 0, 'x');
    panel(TANK.w, g, TANK.d, 0, g / 2, 0, 'y');

    // black silicone seams in the corners
    const sil = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.5 });
    const sGeo = new THREE.BoxGeometry(0.007, TANK.h - 0.004, 0.007);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(sGeo, sil);
        m.position.set(sx * (INNER.maxX - 0.0005), TANK.h / 2, sz * (INNER.maxZ - 0.0005));
        this.group.add(m);
      }

    // ---------- water volume (tints whatever is seen *through* the water)
    const inner = new THREE.Vector3(INNER.maxX - INNER.minX, INNER.maxY - INNER.minY, INNER.maxZ - INNER.minZ);
    this.backdropUniforms = {
      uMap: { value: null },
      uMode: { value: 0 },
      uMirror: { value: 1 },
      uBright: { value: 1 },
      uLightColor: { value: new THREE.Color(1, 1, 1) },
      uWaterMin: UW.uWaterMin,
      uWaterMax: UW.uWaterMax,
      uAbsorb: UW.uAbsorb,
      uScatter: UW.uScatter,
    };
    this.volumeMat = new THREE.ShaderMaterial({
      uniforms: this.backdropUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWp;
        void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vWp;
        ${UW_GLSL}
        ${BACKDROP_GLSL}
        uniform float uMirror;
        void main() {
          float d = uwPathLength(cameraPosition, vWp);
          vec3 T = exp(-uAbsorb * d);
          float a = 1.0 - (T.r + T.g + T.b) / 3.0;
          vec3 col = uScatter * (1.0 - T);
          vec3 size = uWaterMax - uWaterMin;
          bool sideWall = abs(vWp.x - uWaterMin.x) < 0.002 || abs(vWp.x - uWaterMax.x) < 0.002;
          if (sideWall && uMirror > 0.5) {
            // total internal reflection on the side glass mirrors the back wall
            vec3 V = normalize(vWp - cameraPosition);
            float tir = 1.0 - smoothstep(0.5, 0.72, abs(V.x));
            float u = (vWp.z - uWaterMin.z) / size.z;
            u = vWp.x < 0.0 ? u * 0.2 : 1.0 - u * 0.2;
            float v = (vWp.y - uWaterMin.y) / size.y;
            vec3 T2 = exp(-uAbsorb * (d + size.z * 0.8));
            vec3 mir = backdropColor(vec2(u, v)) * T2 + uScatter * (1.0 - T2);
            col = mix(col, mir * 0.85, tir);
            a = mix(a, 1.0, tir);
          }
          gl_FragColor = vec4(col, a);
          ${OUTPUT_GLSL}
        }`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const vol = new THREE.Mesh(new THREE.BoxGeometry(inner.x, inner.y, inner.z), this.volumeMat);
    vol.position.set(0, (INNER.minY + INNER.maxY) / 2, 0);
    vol.renderOrder = 1;
    this.group.add(vol);

    // ---------- water surface
    this.surfaceUniforms = {
      uTime: UW.uTime,
      uEnv: { value: envTex },
      uLightColor: { value: new THREE.Color(1, 1, 1) },
      uLight: { value: 1 },
      uScatter: UW.uScatter,
      uWave: { value: 1 },
    };
    this.surfaceMat = new THREE.ShaderMaterial({
      uniforms: this.surfaceUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uWave;
        varying vec3 vWp; varying vec3 vN;
        vec3 wave(vec2 p, vec2 dir, float freq, float amp, float speed) {
          float ph = dot(p, dir) * freq + uTime * speed;
          return vec3(amp * sin(ph), amp * freq * cos(ph) * dir);
        }
        void main() {
          vec2 p = position.xy;
          vec3 w = wave(p, normalize(vec2(1.0, 0.3)), 38.0, 0.0011, 2.1)
                 + wave(p, normalize(vec2(-0.4, 1.0)), 61.0, 0.0006, 2.9)
                 + wave(p, normalize(vec2(0.8, -0.7)), 93.0, 0.00035, 3.7)
                 + wave(p, normalize(vec2(-1.0, -0.2)), 27.0, 0.0009, 1.4);
          w *= uWave;
          vec3 pos = position + vec3(0.0, 0.0, w.x);
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWp = wp.xyz;
          // plane is rotated so local z -> world y, local y -> world -z
          vN = normalize(vec3(-w.y, 1.0, w.z));
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uEnv; uniform vec3 uLightColor; uniform float uLight; uniform vec3 uScatter; uniform float uTime;
        varying vec3 vWp; varying vec3 vN;
        ${EQUIRECT_GLSL}
        void main() {
          vec3 V = normalize(vWp - cameraPosition);
          vec3 N = normalize(vN);
          vec3 col; float a;
          if (cameraPosition.y > vWp.y) {
            float c = clamp(dot(-V, N), 0.0, 1.0);
            float F = 0.02 + 0.98 * pow(1.0 - c, 5.0);
            vec3 R = reflect(V, N);
            vec3 env = texture2D(uEnv, equirectUv(R)).rgb * 0.8;
            vec3 H = normalize(vec3(0.0, 1.0, 0.0) - V);
            float spec = pow(max(dot(N, H), 0.0), 600.0) * 3.0;
            col = env * F + uLightColor * uLight * spec + uScatter * 0.25;
            a = clamp(F + 0.12 + spec, 0.0, 1.0);
          } else {
            N = -N;
            float c = clamp(dot(-V, N), 0.0, 1.0);
            float window = smoothstep(0.6, 0.72, c);
            float rip = clamp(length(vN.xz) * 18.0, 0.0, 1.0);
            vec3 tir = uScatter * 1.35 + uLightColor * uLight * (0.03 + 0.1 * rip * rip);
            vec3 sky = uLightColor * uLight * 1.4;
            col = mix(tir, sky, window);
            a = mix(0.72, 0.5, window);
          }
          gl_FragColor = vec4(col * a, a);
          ${OUTPUT_GLSL}
        }`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(inner.x, inner.z, 96, 40), this.surfaceMat);
    surf.rotation.x = -Math.PI / 2;
    surf.position.y = TANK.waterLevel;
    surf.renderOrder = 5;
    this.group.add(surf);
    this.surface = surf;

    // ---------- backdrop on the inside of the back glass
    this.backdropMat = new THREE.ShaderMaterial({
      uniforms: this.backdropUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vWp;
        void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vWp;
        ${UW_GLSL}
        ${BACKDROP_GLSL}
        void main() {
          vec3 col = backdropColor(vUv);
          gl_FragColor = vec4(uwApplyWater(col, vWp), 1.0);
          ${OUTPUT_GLSL}
        }`,
    });
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(inner.x, TANK.waterLevel - g + 0.002), this.backdropMat);
    bd.position.set(0, g + (TANK.waterLevel - g) / 2, INNER.minZ + 0.001);
    this.group.add(bd);
    this.backdrop = bd;

    // Above-water part of the back panel uses the plain dark film
    const topStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(inner.x, TANK.h - TANK.waterLevel),
      new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.6 })
    );
    topStrip.position.set(0, TANK.waterLevel + (TANK.h - TANK.waterLevel) / 2, -TANK.d / 2 - 0.001);
    this.group.add(topStrip);
    this.topStrip = topStrip;

    // ---------- LED light bar on aluminium legs
    const fixY = TANK.h + 0.17;
    const alu = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.85, roughness: 0.35 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.018, 0.14, 3, 0.006), alu);
    body.position.set(0, fixY, 0);
    this.group.add(body);
    this.ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const led = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.1), this.ledMat);
    led.rotation.x = Math.PI / 2;
    led.position.set(0, fixY - 0.0095, 0);
    this.group.add(led);
    const legGeo = new THREE.BoxGeometry(0.012, fixY - TANK.h, 0.03);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, alu);
      leg.position.set(sx * (TANK.w / 2 - 0.005), TANK.h + (fixY - TANK.h) / 2, 0);
      this.group.add(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.03), alu);
      arm.position.set(sx * (TANK.w / 2 - 0.025), fixY, 0);
      this.group.add(arm);
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.04), alu);
      clip.position.set(sx * (TANK.w / 2 - g / 2), TANK.h + 0.004, 0);
      this.group.add(clip);
    }
    // power cable
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.45, fixY, -0.07),
          new THREE.Vector3(0.48, fixY + 0.02, -0.2),
          new THREE.Vector3(0.5, TANK.h - 0.05, -TANK.d / 2 - 0.06),
          new THREE.Vector3(0.52, -0.4, -TANK.d / 2 - 0.08),
        ]),
        40,
        0.003,
        6
      ),
      new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.6 })
    );
    this.group.add(cable);

    // ---------- glass lily pipes (filter in/out) in the back corners
    const pipeMat = glassMaterial(envTex);
    pipeMat.uniforms.uBase.value = 0.05;
    const pipe = (pts, r) => {
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 10), pipeMat);
      m.renderOrder = 9;
      this.group.add(m);
    };
    const bz = -TANK.d / 2;
    pipe(
      [
        new THREE.Vector3(-0.52, -0.3, bz - 0.05),
        new THREE.Vector3(-0.52, TANK.h + 0.03, bz - 0.04),
        new THREE.Vector3(-0.52, TANK.h + 0.035, bz + 0.02),
        new THREE.Vector3(-0.52, TANK.h - 0.1, bz + 0.035),
        new THREE.Vector3(-0.52, 0.12, bz + 0.035),
      ],
      0.0075
    );
    pipe(
      [
        new THREE.Vector3(0.52, -0.3, bz - 0.05),
        new THREE.Vector3(0.52, TANK.h + 0.03, bz - 0.04),
        new THREE.Vector3(0.52, TANK.h + 0.035, bz + 0.02),
        new THREE.Vector3(0.52, TANK.waterLevel - 0.06, bz + 0.035),
        new THREE.Vector3(0.515, TANK.waterLevel - 0.09, bz + 0.07),
        new THREE.Vector3(0.505, TANK.waterLevel - 0.085, bz + 0.1),
      ],
      0.0075
    );
  }

  setLight(color, intensity) {
    this.spot.color.copy(color);
    this.spot.intensity = 7.5 * intensity;
    this.surfaceUniforms.uLightColor.value.copy(color);
    this.surfaceUniforms.uLight.value = intensity;
    this.ledMat.color.copy(color).multiplyScalar(0.6 + 2.2 * intensity);
    this.backdropUniforms.uLightColor.value.copy(color);
    this.backdropUniforms.uBright.value = 0.15 + 0.85 * Math.min(1.4, intensity);
  }

  setBackdrop(mode, texture) {
    this.backdrop.visible = mode !== 'none';
    this.topStrip.visible = mode !== 'none';
    const modes = { image: 0, white: 1, black: 2 };
    this.backdropUniforms.uMode.value = texture ? 0 : modes[mode] ?? 2;
    this.backdropUniforms.uMirror.value = mode === 'none' ? 0 : 1;
    this.backdropUniforms.uMap.value = texture || null;
  }

  setRoomReflection(v) {
    this.glassMat.uniforms.uEnvIntensity.value = v;
  }
}
