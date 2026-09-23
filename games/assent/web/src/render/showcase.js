// The selection stage: one God at a time on a dark reflective floor, lit in
// its own colour. Shares the World's renderer and avatar models.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { KINDS } from '../engine/data.js';

export class Showcase {
  constructor(world) {
    this.world = world;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030407);
    this.scene.fog = new THREE.Fog(0x030407, 6, 14);
    this.scene.environment = world.scene.environment;
    this.scene.environmentIntensity = 0.35;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
    this.camera.position.set(0, 0.35, 5.6);
    this.camera.lookAt(0, 0.1, 0);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(12, 96),
      new THREE.MeshStandardMaterial({ color: 0x010102, roughness: 0.9, metalness: 0.0, envMapIntensity: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.05;
    this.scene.add(floor);

    this.key = new THREE.SpotLight(0xffffff, 16, 20, 0.45, 0.7, 1.5);
    this.key.position.set(2.5, 3.5, 3);
    this.scene.add(this.key, this.key.target);
    this.rim = new THREE.SpotLight(0xffffff, 30, 20, 0.6, 0.7, 1.5);
    this.rim.position.set(-2.8, 2.2, -2.5);
    this.scene.add(this.rim, this.rim.target);
    this.fill = new THREE.PointLight(0x8899ff, 1, 10);
    this.fill.position.set(-3, 0, 3);
    this.scene.add(this.fill);

    this.pedestal = new THREE.Group();
    this.scene.add(this.pedestal);

    this.composer = new EffectComposer(world.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.spin = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  show(kind) {
    this.pedestal.clear();
    const model = this.world.avatar(kind);
    model.position.y = 0.1;
    this.pedestal.add(model);
    this.model = model;
    const c = new THREE.Color(KINDS[kind].color);
    this.rim.color.copy(c);
    this.fill.color.copy(c).lerp(new THREE.Color(0x8899ff), 0.5);
    this.enter = 0;
  }

  resize() {
    const canvas = this.world.canvas;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    // Keep the avatar clear of the side panel on wide screens.
    this.camera.setViewOffset(w, h, w > 900 ? w * 0.18 : 0, 0, w, h);
    this.camera.updateProjectionMatrix();
  }

  frame(dt, t) {
    if (this.model) {
      this.enter = Math.min(1, this.enter + dt * 1.5);
      const e = 1 - (1 - this.enter) ** 3;
      this.model.scale.setScalar(0.4 + e * 0.6);
      this.model.rotation.y += dt * 0.35;
      this.model.position.y = 0.1 + Math.sin(t * 0.8) * 0.04;
    }
    this.composer.render();
  }
}
