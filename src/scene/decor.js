import * as THREE from 'three';
import { asset } from '../config.js';
import { patchUnderwater } from './underwater.js';

// The generated models face +X in their source images; rotate them so that
// their photographed "front" looks at the viewer (+Z).
export const DECOR_TYPES = {
  stone: { rough: 0.85, sparse: 1 },
  driftwood: { rough: 0.9, sparse: 0.55 },
  liverock: { rough: 0.95, sparse: 0.8 },
  braincoral: { rough: 0.6, sparse: 1, coral: true },
  acropora: { rough: 0.55, sparse: 0.7, coral: true },
  anemone: { rough: 0.5, sparse: 0.85, coral: true, home: true },
};

export class Decor {
  constructor({ scene, loader, substrate }) {
    this.scene = scene;
    this.loader = loader;
    this.substrate = substrate;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.cache = new Map();
    this.glow = { value: new THREE.Color(0, 0, 0) };
    this.anemones = [];
  }

  load(id) {
    if (!this.cache.has(id)) {
      const type = DECOR_TYPES[id];
      this.cache.set(
        id,
        this.loader.loadAsync(asset(`decor/${id}.glb`)).then((gltf) => {
          const root = gltf.scene;
          root.rotation.y = -Math.PI / 2;
          root.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(root);
          const c = box.getCenter(new THREE.Vector3());
          const holder = new THREE.Group();
          root.position.set(-c.x, -box.min.y, -c.z);
          holder.add(root);
          holder.userData.height = box.max.y - box.min.y;
          root.traverse((o) => {
            if (!o.isMesh) return;
            const m = o.material.clone();
            m.metalness = 0;
            m.roughness = type.rough;
            patchUnderwater(m, type.coral ? { glow: this.glow } : {});
            o.material = m;
            o.castShadow = true;
            o.receiveShadow = true;
          });
          return holder;
        })
      );
    }
    return this.cache.get(id);
  }

  clear() {
    this.group.clear();
    this.anemones = [];
  }

  // items: [{ id, x, z, h, rot, sink }]
  async build(items) {
    const protos = await Promise.all(items.map((it) => this.load(it.id)));
    this.clear();
    const obstacles = [];
    const footprints = [];
    const homes = [];
    items.forEach((it, i) => {
      const proto = protos[i];
      const obj = proto.clone(true);
      const s = it.h / proto.userData.height;
      obj.scale.set(s * (it.flip ? -1 : 1), s, s);
      obj.rotation.y = it.rot ?? 0;
      const y = this.substrate.heightAt(it.x, it.z) + (it.onTop ?? 0) - (it.sink ?? 0.08) * it.h;
      obj.position.set(it.x, y, it.z);
      this.group.add(obj);
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const type = DECOR_TYPES[it.id];
      const shrink = type.sparse;
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const half = new THREE.Vector3(size.x * shrink * 0.5, size.y * 0.5, size.z * shrink * 0.5);
      obstacles.push({ id: it.id, min: c.clone().sub(half), max: c.clone().add(half) });
      footprints.push({ x: c.x, z: c.z, r: Math.max(size.x, size.z) * 0.42 * shrink });
      if (type.home) homes.push(new THREE.Vector3(c.x, box.max.y - size.y * 0.2, c.z));
    });
    this.homes = homes;
    return { obstacles, footprints, homes };
  }

  setFluorescence(color) {
    this.glow.value.copy(color);
  }
}
