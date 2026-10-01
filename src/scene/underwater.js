import * as THREE from 'three';
import { INNER } from '../config.js';

// Shared uniforms for everything that lives inside the water volume.
export const UW = {
  uTime: { value: 0 },
  uWaterMin: { value: new THREE.Vector3(INNER.minX, INNER.minY, INNER.minZ) },
  uWaterMax: { value: new THREE.Vector3(INNER.maxX, INNER.maxY, INNER.maxZ) },
  uAbsorb: { value: new THREE.Vector3(0.9, 0.35, 0.22) }, // extinction per metre (r, g, b)
  uScatter: { value: new THREE.Color(0x0a3550) }, // in-scattered (lit) water colour
  uAmbTop: { value: new THREE.Color(0.12, 0.16, 0.2) },
  uAmbBottom: { value: new THREE.Color(0.05, 0.05, 0.04) },
};

export const UW_GLSL = /* glsl */ `
uniform vec3 uWaterMin;
uniform vec3 uWaterMax;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
float uwPathLength(vec3 ro, vec3 wp) {
  vec3 rd = wp - ro;
  float L = length(rd);
  rd /= max(L, 1e-5);
  vec3 safe = mix(rd, vec3(1e-5), step(abs(rd), vec3(1e-5)));
  vec3 inv = 1.0 / safe;
  vec3 t0 = (uWaterMin - ro) * inv;
  vec3 t1 = (uWaterMax - ro) * inv;
  vec3 tmin = min(t0, t1);
  float tEnter = max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
  return max(L - tEnter, 0.0);
}
vec3 uwApplyWater(vec3 col, vec3 wp) {
  float d = uwPathLength(cameraPosition, wp);
  vec3 T = exp(-uAbsorb * d);
  return col * T + uScatter * (1.0 - T);
}
`;

const SWIM_HEAD = /* glsl */ `
attribute vec3 aSwim; // x: phase, y: amplitude scale, z: turn bend
uniform float uSwimAmp;
uniform float uSwimWave;
uniform float uSwimStiff;
vec3 swimDeform(vec3 p) {
  float tb = clamp(0.5 - p.z, 0.0, 1.0);       // 0 at the head, 1 at the tail tip
  float env = uSwimStiff + (1.0 - uSwimStiff) * tb * tb;
  float lat = sin(aSwim.x - tb * uSwimWave) * env * uSwimAmp * aSwim.y;
  lat += aSwim.z * tb * tb * 0.22;              // bend the body into turns
  p.x += lat;
  return p;
}
`;

const SWAY_HEAD = /* glsl */ `
uniform float uSwayAmp;
uniform float uSwaySpeed;
`;

const SWAY_BODY = /* glsl */ `
{
  vec3 iPos = vec3(0.0);
  #ifdef USE_INSTANCING
  iPos = instanceMatrix[3].xyz;
  #endif
  float hh = transformed.y * transformed.y;
  float s = sin(uTime * uSwaySpeed + iPos.x * 6.0 + iPos.z * 4.0) + 0.45 * sin(uTime * uSwaySpeed * 1.7 + iPos.x * 13.0);
  transformed.x += s * uSwayAmp * hh;
  transformed.z += cos(uTime * uSwaySpeed * 0.8 + iPos.z * 7.0 + iPos.x * 3.0) * uSwayAmp * 0.6 * hh;
}
`;

/**
 * Patches a lit three.js material (Standard/Physical/Lambert) so that it
 * receives water absorption, ambient water light and optional vertex animation.
 */
export function patchUnderwater(material, opts = {}) {
  const { swim = null, sway = null, plant = false, glow = null } = opts;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = UW.uTime;
    shader.uniforms.uWaterMin = UW.uWaterMin;
    shader.uniforms.uWaterMax = UW.uWaterMax;
    shader.uniforms.uAbsorb = UW.uAbsorb;
    shader.uniforms.uScatter = UW.uScatter;
    shader.uniforms.uAmbTop = UW.uAmbTop;
    shader.uniforms.uAmbBottom = UW.uAmbBottom;
    if (swim) {
      shader.uniforms.uSwimAmp = swim.amp;
      shader.uniforms.uSwimWave = swim.wave;
      shader.uniforms.uSwimStiff = swim.stiff;
    }
    if (sway) {
      shader.uniforms.uSwayAmp = sway.amp;
      shader.uniforms.uSwaySpeed = sway.speed;
    }
    if (glow) shader.uniforms.uGlow = glow;

    let vs = shader.vertexShader;
    vs = vs.replace(
      '#include <common>',
      `#include <common>
varying vec3 vUwPos;
varying vec3 vUwNormal;
uniform float uTime;
${swim ? SWIM_HEAD : ''}
${sway ? SWAY_HEAD : ''}`
    );
    if (swim) {
      vs = vs.replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
{
  float e = 0.01;
  float dl = (swimDeform(position + vec3(0.0, 0.0, e)).x - swimDeform(position - vec3(0.0, 0.0, e)).x) / (2.0 * e);
  objectNormal = normalize(vec3(objectNormal.x, objectNormal.y + 1e-5, objectNormal.z - dl * objectNormal.x));
}`
      );
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = swimDeform(transformed);`);
    }
    if (sway) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${SWAY_BODY}`);
    vs = vs.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
{
  vec4 uwWp = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
  uwWp = batchingMatrix * uwWp;
  #endif
  #ifdef USE_INSTANCING
  uwWp = instanceMatrix * uwWp;
  #endif
  uwWp = modelMatrix * uwWp;
  vUwPos = uwWp.xyz;
  vUwNormal = inverseTransformDirection(transformedNormal, viewMatrix);
}`
    );
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = fs.replace(
      '#include <common>',
      `#include <common>
varying vec3 vUwPos;
varying vec3 vUwNormal;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;
${glow ? 'uniform vec3 uGlow;' : ''}
${UW_GLSL}`
    );
    if (plant) {
      fs = fs.replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
{
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  if (dot(normal, upV) < 0.0) normal = -normal;
  normal = normalize(normal + upV * 0.7);
}`
      );
    }
    fs = fs.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
{
  float uwUp = clamp(normalize(vUwNormal + vec3(0.0, 1e-4, 0.0)).y * 0.5 + 0.5, 0.0, 1.0);
  reflectedLight.indirectDiffuse += diffuseColor.rgb * mix(uAmbBottom, uAmbTop, uwUp);
}`
    );
    fs = fs.replace(
      '#include <opaque_fragment>',
      `${glow ? 'outgoingLight += diffuseColor.rgb * uGlow;' : ''}
outgoingLight = uwApplyWater(outgoingLight, vUwPos);
#include <opaque_fragment>`
    );
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () =>
    `uw${swim ? '-swim' : ''}${sway ? '-sway' : ''}${plant ? '-plant' : ''}${glow ? '-glow' : ''}`;
  return material;
}
