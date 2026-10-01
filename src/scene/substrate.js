import * as THREE from 'three';
import { INNER } from '../config.js';
import { fbm2, smooth } from '../util/noise.js';
import { patchUnderwater } from './underwater.js';

const SEG_X = 140;
const SEG_Z = 60;

// Sand bed with a sloped profile, dunes and mounds, plus the visible
// cross-section ("skirt") behind the front and side glass.
export class Substrate {
  constructor(scene, sandTex) {
    this.profile = { base: 0.035, slope: 0.06, dune: 0.006, mounds: [], seed: 3 };
    const tex = sandTex.clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 2.5);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    this.material = patchUnderwater(
      new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 1.2, roughness: 0.96, metalness: 0 })
    );
    const w = INNER.maxX - INNER.minX;
    const d = INNER.maxZ - INNER.minZ;
    const geo = new THREE.PlaneGeometry(w, d, SEG_X, SEG_Z);
    geo.rotateX(-Math.PI / 2);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    const sTex = sandTex.clone();
    sTex.wrapS = sTex.wrapT = THREE.RepeatWrapping;
    sTex.repeat.set(1, 1);
    sTex.needsUpdate = true;
    this.skirtMat = patchUnderwater(
      new THREE.MeshStandardMaterial({ map: sTex, color: 0x9a8f80, roughness: 1, metalness: 0, emissiveMap: sTex, emissive: 0x9a8f80, emissiveIntensity: 0.2 })
    );
    this.skirtGeo = new THREE.BufferGeometry();
    this.skirt = new THREE.Mesh(this.skirtGeo, this.skirtMat);
    scene.add(this.skirt);
    this.rebuild();
  }

  heightAt(x, z) {
    const p = this.profile;
    const t = THREE.MathUtils.clamp((INNER.maxZ - z) / (INNER.maxZ - INNER.minZ), 0, 1);
    let h = p.base + p.slope * smooth(t);
    h += p.dune * (fbm2(x * 7 + p.seed * 13.1, z * 7 + p.seed * 3.7, 4) - 0.5) * 2;
    for (const m of p.mounds) {
      const dx = x - m.x;
      const dz = z - m.z;
      h += m.h * Math.exp(-(dx * dx + dz * dz) / (m.r * m.r));
    }
    return INNER.minY + Math.max(0.006, h);
  }

  setProfile(profile, tint = 0xffffff, skirtTint = 0x9a8f80) {
    this.profile = { base: 0.035, slope: 0.06, dune: 0.006, mounds: [], seed: 3, ...profile };
    this.material.color.set(tint);
    this.skirtMat.color.set(skirtTint);
    this.skirtMat.emissive.set(skirtTint);
    this.rebuild();
  }

  rebuild() {
    const pos = this.geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.heightAt(pos.getX(i), pos.getZ(i)));
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();

    // skirt strips: front (+z), left (-x), right (+x)
    const P = [];
    const N = [];
    const U = [];
    const I = [];
    const k = 5.5; // texture scale on the cross-section
    const strip = (count, at, normal) => {
      const base = P.length / 3;
      for (let i = 0; i <= count; i++) {
        const [x, z, u] = at(i / count);
        const top = this.heightAt(x, z);
        P.push(x, top, z, x, INNER.minY, z);
        N.push(...normal, ...normal);
        U.push(u * k, top * k, u * k, INNER.minY * k);
        if (i < count) {
          const a = base + i * 2;
          I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    };
    const eps = 0.0004;
    strip(SEG_X, (t) => [THREE.MathUtils.lerp(INNER.minX, INNER.maxX, t), INNER.maxZ - eps, THREE.MathUtils.lerp(INNER.minX, INNER.maxX, t)], [0, 0, 1]);
    strip(SEG_Z, (t) => [INNER.minX + eps, THREE.MathUtils.lerp(INNER.minZ, INNER.maxZ, t), t * 0.5], [-1, 0, 0]);
    strip(SEG_Z, (t) => [INNER.maxX - eps, THREE.MathUtils.lerp(INNER.maxZ, INNER.minZ, t), t * 0.5], [1, 0, 0]);
    this.skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    this.skirtGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    this.skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    this.skirtGeo.setIndex(I);
    this.skirtGeo.computeBoundingSphere();
  }
}
