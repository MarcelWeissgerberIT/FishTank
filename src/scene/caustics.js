import * as THREE from 'three';

// Renders an animated, chromatic caustic pattern into a texture that is
// projected by the tank's spot light (a light "cookie"). Because the spot
// light also casts shadows, fish and decor block the caustics naturally.
export class Caustics {
  constructor(renderer, size = 512) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.texture = this.target.texture;
    this.uniforms = {
      uTime: { value: 0 },
      uAmount: { value: 1 },
      uMask: { value: new THREE.Vector2(0.95, 0.4) },
      uScale: { value: 3.2 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uAmount;
        uniform vec2 uMask;
        uniform float uScale;
        #define TAU 6.28318530718
        float caustic(vec2 uv, float time) {
          vec2 p = mod(uv * TAU, TAU) - 250.0;
          vec2 i = p;
          float c = 1.0;
          float inten = 0.005;
          for (int n = 0; n < 4; n++) {
            float t = time * (1.0 - (3.5 / float(n + 1)));
            i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
            // == 1 / length(p / (vec2(sin, cos) / inten)), written without divisions by ~0
            float s1 = sin(i.x + t);
            float s2 = cos(i.y + t);
            float A = p.x * inten;
            float B = p.y * inten;
            c += abs(s1 * s2) / sqrt(A * A * s2 * s2 + B * B * s1 * s1 + 1e-12);
          }
          c /= 4.0;
          c = 1.17 - pow(max(c, 0.0), 1.4);
          return min(pow(abs(c), 8.0), 40.0);
        }
        float layered(vec2 uv, float t) {
          return 0.65 * caustic(uv, t) + 0.45 * caustic(uv * 1.37 + vec2(0.31, 0.17), t * 0.83 + 3.0);
        }
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          vec2 q = abs(p) / uMask;
          float m = (1.0 - smoothstep(0.9, 1.0, q.x)) * (1.0 - smoothstep(0.82, 1.0, q.y));
          vec2 cuv = p * uScale;
          float t = uTime * 0.55;
          float off = 0.012;
          vec3 c = vec3(layered(cuv + vec2(off, 0.0), t), layered(cuv, t), layered(cuv - vec2(off, 0.0), t));
          vec3 col = mix(vec3(1.0), 0.42 + c * 2.1, uAmount);
          gl_FragColor = vec4(clamp(col * m, 0.0, 12.0), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  update(time) {
    this.uniforms.uTime.value = time;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prev);
  }
}
