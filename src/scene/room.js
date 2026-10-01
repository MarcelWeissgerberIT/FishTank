import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TANK, STAND, FLOOR_Y } from '../config.js';

// The living room around the aquarium: blurred photo backdrop, wooden floor,
// cabinet, a warm lamp and the coloured light spilling out of the tank.
export class Room {
  constructor({ scene, roomTex, woodTex }) {
    RectAreaLightUniformsLib.init();
    this.group = new THREE.Group();
    scene.add(this.group);

    // photo backdrop on a cylinder (mirrored so it wraps around)
    roomTex.wrapS = THREE.MirroredRepeatWrapping;
    roomTex.repeat.set(2.4, 1);
    roomTex.offset.set(-0.7, 0);
    this.backdropMat = new THREE.MeshBasicMaterial({ map: roomTex, side: THREE.BackSide, fog: false });
    this.backdropMat.color.setScalar(0.6);
    const R = 7;
    const H = 7.4;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 96, 1, true), this.backdropMat);
    cyl.position.set(0, FLOOR_Y + 1.25, 0);
    cyl.rotation.y = Math.PI / 2;
    this.group.add(cyl);

    // floor with a soft fade into the photo
    const floorTex = woodTex.clone();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(9, 9);
    floorTex.rotation = Math.PI / 2;
    floorTex.needsUpdate = true;
    const fade = new THREE.CanvasTexture(radialFade());
    this.floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      color: 0x8a7b6c,
      roughness: 0.42,
      metalness: 0,
      alphaMap: fade,
      transparent: true,
      depthWrite: false,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6.9, 64), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    this.group.add(floor);

    // cabinet
    const cabTex = woodTex.clone();
    cabTex.wrapS = cabTex.wrapT = THREE.RepeatWrapping;
    cabTex.repeat.set(1.6, 1);
    cabTex.needsUpdate = true;
    const wood = new THREE.MeshStandardMaterial({ map: cabTex, color: 0xc8b8a6, roughness: 0.34, metalness: 0 });
    const cab = new THREE.Mesh(new RoundedBoxGeometry(STAND.w, STAND.h - 0.06, STAND.d, 4, 0.012), wood);
    cab.position.set(0, FLOOR_Y + 0.06 + (STAND.h - 0.06) / 2, 0);
    cab.castShadow = false;
    cab.receiveShadow = true;
    this.group.add(cab);
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(STAND.w - 0.06, 0.06, STAND.d - 0.06),
      new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.8 })
    );
    plinth.position.set(0, FLOOR_Y + 0.03, -0.01);
    this.group.add(plinth);
    // door gaps + handles
    const gapMat = new THREE.MeshStandardMaterial({ color: 0x0a0807, roughness: 0.9 });
    const front = STAND.d / 2 + 0.0005;
    const gy = FLOOR_Y + 0.06 + (STAND.h - 0.06) / 2;
    const vgap = new THREE.Mesh(new THREE.BoxGeometry(0.004, STAND.h - 0.14, 0.002), gapMat);
    vgap.position.set(0, gy, front);
    this.group.add(vgap);
    const hgap = new THREE.Mesh(new THREE.BoxGeometry(STAND.w - 0.04, 0.004, 0.002), gapMat);
    hgap.position.set(0, -0.05, front);
    this.group.add(hgap);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a8, metalness: 1, roughness: 0.25 });
    for (const sx of [-1, 1]) {
      const h = new THREE.Mesh(new RoundedBoxGeometry(0.008, 0.16, 0.014, 2, 0.003), handleMat);
      h.position.set(sx * 0.03, gy + 0.05, front + 0.012);
      this.group.add(h);
    }
    // thin dark mat between cabinet and tank
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(TANK.w + 0.004, 0.004, TANK.d + 0.004),
      new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 })
    );
    mat.position.y = -0.002;
    this.group.add(mat);

    // lights
    this.ambient = new THREE.HemisphereLight(0xffe2c4, 0x1a1410, 0.25);
    scene.add(this.ambient);
    this.lamp = new THREE.PointLight(0xffb36b, 3.0, 0, 1.6);
    this.lamp.position.set(-2.4, FLOOR_Y + 1.6, -1.6);
    scene.add(this.lamp);
    // soft light from the room behind the viewer
    this.fill = new THREE.PointLight(0xffd2a8, 3, 0, 1);
    this.fill.position.set(0.9, 0.5, 2.6);
    scene.add(this.fill);
    this.spill = new THREE.RectAreaLight(0x66aaff, 2, TANK.w, TANK.h);
    this.spill.position.set(0, TANK.h / 2, TANK.d / 2 + 0.01);
    this.spill.lookAt(0, TANK.h / 2 - 0.4, 3);
    scene.add(this.spill);
  }

  setRoomLight(v) {
    this.backdropMat.color.setScalar(0.08 + 0.75 * v);
    this.ambient.intensity = 0.05 + 0.45 * v;
    this.lamp.intensity = 0.4 + 4 * v;
    this.fill.intensity = 0.6 + 5 * v;
  }

  setSpill(color, intensity) {
    this.spill.color.copy(color);
    this.spill.intensity = 1.6 * intensity;
  }
}

function radialFade() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(0.3, '#fff');
  grd.addColorStop(0.62, '#444');
  grd.addColorStop(1, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return c;
}
