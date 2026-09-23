// Ground level: you float through a polity as its people go about their
// lives. WASD moves, the mouse looks, Space rises (keep rising to return to
// orbit), C sinks. People notice you and react; your actions play out in
// the streets around you.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEnvironment } from './env.js';
import { Crowd } from './crowd.js';
import { shout } from './voices.js';
import { smoothstep } from './noise.js';
import { KINDS } from '../engine/data.js';

export const GROUND = {
  eye: 2.4, // you float a little above head height
  maxAltitude: 140, // rise above this and you return to orbit
  speed: 7,
  boost: 4,
  look: 0.0022,
};

export class GroundScene {
  constructor(world, bubbleLayer) {
    this.world = world;
    this.renderer = world.renderer;
    this.canvas = world.canvas;
    this.bubbleLayer = bubbleLayer;
    this.active = false;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.frozen = false;
    this.listeners = { ascend: [], speak: [] };
    this.timer = new THREE.Timer();
    this.timer.connect(document);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 4000);
    this.camera.rotation.order = 'YXZ';

    this.sky = new Sky();
    this.sky.scale.setScalar(3500);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 8;
    u.rayleigh.value = 2.4;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.75;
    this.scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xfff1e0, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -90; sc.right = sc.top = 90; sc.near = 1; sc.far = 700;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a2e22, 0.8);
    this.scene.add(this.hemi);

    this.low = world.lowPower;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sun.castShadow = !this.low;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.45, 1.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // The rival Gods watch from the sky above the places they hold.
    this.watchers = new THREE.Group();
    this.scene.add(this.watchers);

    this.bubbles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('keydown', (e) => {
      if (!this.active || e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.active || this.frozen || document.pointerLockElement !== this.canvas) return;
      this.yaw -= e.movementX * GROUND.look;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * GROUND.look, -1.45, 1.45);
    });
  }

  on(evt, fn) { this.listeners[evt].push(fn); }
  emit(evt, v) { for (const fn of this.listeners[evt]) fn(v); }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ enter / leave

  // sun: { elevation, azimuth } in radians, from the real sun direction.
  enter(polity, state, sun, osm = null) {
    this.leave();
    this.polity = polity;
    this.state = state;
    this.player = state.player;
    const night = smoothstep(0.06, -0.14, Math.sin(sun.elevation));
    this.night = night;
    this.env = buildEnvironment(polity, state, { night, low: this.low, osm });
    this.scene.add(this.env.group);
    this.crowd = new Crowd(this.env, polity, state, 1, this.low ? 0.5 : 1);
    this.scene.add(this.crowd.group);

    // Sun and sky. Below the horizon we keep a faint moonlight.
    const el = Math.max(sun.elevation, -0.3);
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(sun.azimuth), Math.sin(el), -Math.cos(el) * Math.cos(sun.azimuth));
    this.sunDir = dir;
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    const day = 1 - night;
    this.sun.position.copy(dir.clone().multiplyScalar(300));
    this.sun.intensity = 3.4 * smoothstep(-0.02, 0.25, dir.y) + 0.6 * night;
    this.sun.color.set(dir.y < 0.15 ? 0xffb070 : 0xfff1e0).lerp(new THREE.Color(0x9fb4ff), night);
    if (night > 0.5) this.sun.position.set(-dir.x * 300, 200, -dir.z * 300); // moon, roughly opposite
    this.hemi.intensity = 0.45 + day * 0.6;
    this.hemi.color.set(0xbfd8ff).lerp(new THREE.Color(0x26324f), night);
    // The physical sky is very bright; expose for it like a camera would.
    this.renderer.toneMappingExposure = 0.45 + night * 0.45;
    this.renderer.shadowMap.enabled = !this.low;
    // The physical sky is far brighter than anything else, so bloom only
    // matters at night (lit windows, lamps, the Gods' datacenters).
    this.bloom.strength = 0.05 + night * 0.3;
    this.bloom.threshold = night > 0.5 ? 0.9 : 3;
    if (this.env.water?.material.uniforms) {
      this.env.water.material.uniforms.sunDirection.value.copy(dir).normalize();
      this.env.water.material.uniforms.sunColor.value.set(night > 0.5 ? 0x334466 : 0xffffff);
    }
    // Haze and environment lighting from the sky itself.
    const fogCol = new THREE.Color(0x8fa6c4).lerp(new THREE.Color(0xc79a6a), dir.y < 0.2 ? 0.45 : 0).multiplyScalar(0.12 + day * 0.5);
    this.scene.fog = new THREE.FogExp2(fogCol, 0.00065 * this.env.place.haze);
    this.sky.visible = true;
    const skyScene = new THREE.Scene();
    const skyCopy = new Sky();
    skyCopy.scale.setScalar(1000);
    Object.assign(skyCopy.material.uniforms.sunPosition.value, dir);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) skyCopy.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    skyScene.add(skyCopy);
    this.envMap?.dispose();
    this.envMap = this.pmrem.fromScene(skyScene).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.08 + day * 0.22;

    // Stars at night.
    this.stars?.removeFromParent();
    if (night > 0.05 && this.world.scene.background?.isTexture) {
      this.stars = new THREE.Mesh(
        new THREE.SphereGeometry(3000, 48, 24),
        new THREE.MeshBasicMaterial({ map: this.world.scene.background, side: THREE.BackSide, transparent: true, opacity: night * 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
      );
      this.scene.add(this.stars);
    }

    this.placeWatchers(polity);

    // Arrive from the sky at the heart of the place.
    const start = this.env.spawn;
    this.camera.position.set(start.x, this.env.heightAt(start.x, start.z) + 26, start.z);
    this.yaw = this.env.osm ? Math.atan2(start.x, start.z) + Math.PI : 0;
    this.pitch = -0.28;
    this.descending = 1;
    this.active = true;
    this.clearBubbles();
  }

  leave() {
    this.renderer.toneMappingExposure = 1.05;
    if (!this.env) return;
    this.scene.remove(this.env.group, this.crowd.group);
    const disposeTree = (o) => o.traverse((c) => {
      c.geometry?.dispose?.();
      const ms = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
      for (const m of ms) { if (m.map && m.map !== this.world.scene.background) m.map = null; m.dispose(); }
    });
    disposeTree(this.env.group);
    disposeTree(this.crowd.group);
    this.env = this.crowd = null;
    this.active = false;
    this.keys.clear();
    this.clearBubbles();
  }

  placeWatchers(polity) {
    this.watchers.clear();
    let slot = 0;
    for (const [g, a] of Object.entries(polity.assent)) {
      if (g === this.player || a < 0.08 || !this.world.avatarTemplates?.[g]) continue;
      const m = this.world.avatar(g);
      const ang = 0.7 + slot++ * 1.1;
      m.position.set(Math.cos(ang) * 420, 120 + a * 260, Math.sin(ang) * 420);
      m.scale.setScalar(10 + a * 40);
      const light = new THREE.PointLight(new THREE.Color(KINDS[g].color), 2000, 400, 2);
      light.position.copy(m.position);
      this.watchers.add(m, light);
    }
  }

  // Refresh the crowd after the year turns or anything else changes.
  sync(polity) {
    this.polity = polity;
    this.crowd?.sync(polity);
    this.placeWatchers(polity);
  }

  // ------------------------------------------------------------ actions

  godPosition() {
    return this.camera.position;
  }

  // Visible consequences of an action (yours or a rival's) here.
  playAction(fx, delta, isPlayer = true) {
    if (!this.crowd) return;
    const color = new THREE.Color(KINDS[fx.god].color);
    const me = this.camera.position;
    const reach = fx.action === 'offer' ? 16 : 9;
    const at = isPlayer ? { x: me.x - Math.sin(this.yaw) * reach, z: me.z - Math.cos(this.yaw) * reach } : { x: (Math.random() - 0.5) * 60, z: (Math.random() - 0.5) * 60 };
    const cheer = (p) => p.allegiance === fx.god;
    switch (fx.action) {
      case 'listen':
        this.crowd.burst(at, color, 18, 3);
        this.crowd.stir(at, 30, 'watch', 5);
        break;
      case 'reason':
        this.crowd.burst(at, color, 45, 2.6);
        this.crowd.convert(fx.god, delta, at);
        this.crowd.stir(at, 45, 'cheer', 4, cheer);
        break;
      case 'offer':
        this.spawnGift(fx.god, at);
        this.crowd.convert(fx.god, delta, at);
        this.crowd.stir(at, 60, 'cheer', 5, cheer);
        this.crowd.stir(at, 60, 'watch', 5, (p) => !cheer(p));
        break;
      case 'whisper':
        this.crowd.burst(at, color.clone().multiplyScalar(0.4), 30, 4);
        this.crowd.convert(fx.god, delta, at);
        this.crowd.stir(at, 30, 'watch', 6);
        break;
      case 'build':
        this.spawnDatacenter(fx.god);
        this.crowd.stir({ x: 0, z: 0 }, 200, 'watch', 5);
        break;
      default:
        this.crowd.burst(at, color, 90, 3.4);
        this.crowd.burst(at, new THREE.Color(0xffffff), 60, 2.4);
        if (delta) this.crowd.convert(fx.god, delta, at);
        this.crowd.stir(at, 90, 'cheer', 5, cheer);
    }
  }

  spawnGift(god, at) {
    const color = new THREE.Color(KINDS[god].color);
    const g = new THREE.Group();
    const y = this.env.heightAt(at.x, at.z);
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 3, 8, 16).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.3, metalness: 0.1 }));
    pod.position.y = 2.4;
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.12, 8, 48).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 2 }));
    band.position.y = 2.4;
    const light = new THREE.PointLight(color, 25, 25, 2);
    light.position.y = 5;
    pod.castShadow = true;
    g.add(pod, band, light);
    g.position.set(at.x, y - 6, at.z);
    g.rotation.y = this.yaw;
    this.env.group.add(g);
    this.env.obstacles.push({ x: at.x, z: at.z, hx: 3.6, hz: 3.6, top: y + 5 });
    this.rising = (this.rising || []).concat({ obj: g, to: y, t: 0 });
  }

  spawnDatacenter(god) {
    const n = this.env.godSites.length;
    const a = 2.2 + n * 0.55;
    const x = Math.cos(a) * 200, z = Math.sin(a) * 200;
    const shell = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.35, metalness: 0.5 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 24).translate(0, 8, 0), shell);
    body.castShadow = true;
    const glow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(KINDS[god].color), emissiveIntensity: 2.4 });
    for (let i = 0; i < 5; i++) g.add(new THREE.Mesh(new THREE.BoxGeometry(40.2, 0.35, 24.2).translate(0, 2.5 + i * 3, 0), glow));
    g.add(body);
    const y = this.env.heightAt(x, z);
    g.position.set(x, y - 20, z);
    g.lookAt(0, y - 20, 0);
    this.env.group.add(g);
    this.env.godSites.push({ god, x, z });
    this.rising = (this.rising || []).concat({ obj: g, to: y, t: 0, slow: true });
  }

  // ------------------------------------------------------------ targeting

  personInSight() {
    if (!this.crowd) return null;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    return this.crowd.nearest(this.camera.position, 16, dir);
  }

  // ------------------------------------------------------------ speech bubbles

  say(person, text, cls = '') {
    if (!this.bubbleLayer) return;
    let b = this.bubbles.find((x) => x.person === person);
    if (!b) {
      if (this.bubbles.length > 7) { const old = this.bubbles.shift(); old.el.remove(); }
      const el = document.createElement('div');
      el.className = `bubble ${cls}`;
      this.bubbleLayer.append(el);
      b = { person, el, t: 0 };
      this.bubbles.push(b);
    }
    b.el.className = `bubble ${cls}`;
    b.el.textContent = text;
    b.t = 0;
    b.life = 3 + text.length * 0.05;
  }

  clearBubbles() {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles = [];
  }

  positionBubbles(dt) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    this.bubbles = this.bubbles.filter((b) => {
      b.t += dt;
      if (b.t > b.life || !this.crowd) { b.el.remove(); return false; }
      this.crowd.headPosition(b.person, v);
      v.y += 0.45;
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist < 60;
      b.el.style.opacity = visible ? Math.min(1, (b.life - b.t) * 2, b.t * 5) * (dist > 35 ? (60 - dist) / 25 : 1) : 0;
      b.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%) scale(${Math.max(0.7, Math.min(1.1, 14 / dist))})`;
      return true;
    });
  }

  // ------------------------------------------------------------ frame

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    if (!this.active || !this.env) return;
    const cam = this.camera;
    const k = this.keys;

    if (!this.frozen) {
      const look = 1.8 * dt;
      if (k.has('ArrowLeft')) this.yaw += look;
      if (k.has('ArrowRight')) this.yaw -= look;
      if (k.has('ArrowUp')) this.pitch = Math.min(1.45, this.pitch + look);
      if (k.has('ArrowDown')) this.pitch = Math.max(-1.45, this.pitch - look);
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const move = new THREE.Vector3();
      if (k.has('KeyW')) move.add(fwd);
      if (k.has('KeyS')) move.sub(fwd);
      if (k.has('KeyD')) move.add(right);
      if (k.has('KeyA')) move.sub(right);
      if (move.lengthSq()) move.normalize();
      const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? GROUND.boost : 1;
      const speed = GROUND.speed * boost * (1 + Math.max(0, cam.position.y - this.env.heightAt(cam.position.x, cam.position.z)) / 25);
      const nx = cam.position.x + move.x * speed * dt, nz = cam.position.z + move.z * speed * dt;
      const ground = (x, z) => Math.max(this.env.heightAt(x, z), this.env.isWater(x, z) ? 0 : -999);
      const tryMove = (x, z) => {
        const o = this.env.blocked(x, z, 1.2);
        return !o || cam.position.y > (o.top ?? 1e9) + 1;
      };
      if (Math.hypot(nx, nz) < this.env.playRadius + 60) {
        if (tryMove(nx, cam.position.z)) cam.position.x = nx;
        if (tryMove(cam.position.x, nz)) cam.position.z = nz;
      }
      let vy = 0;
      if (k.has('Space')) vy += 1;
      if (k.has('KeyC') || k.has('ControlLeft')) vy -= 1;
      cam.position.y += vy * (6 + (cam.position.y - ground(cam.position.x, cam.position.z)) * 0.6) * boost * dt;
      // Settle gently after arriving from the sky.
      if (this.descending > 0) {
        const floor = ground(cam.position.x, cam.position.z) + GROUND.eye + 3;
        cam.position.y += (floor - cam.position.y) * Math.min(1, dt * 1.2);
        this.descending -= dt * 0.5;
        if (vy) this.descending = 0;
      }
      const minY = ground(cam.position.x, cam.position.z) + GROUND.eye;
      if (cam.position.y < minY) cam.position.y += (minY - cam.position.y) * Math.min(1, dt * 10);
      const altitude = cam.position.y - ground(cam.position.x, cam.position.z);
      this.altitude = altitude;
      if (altitude > GROUND.maxAltitude) this.emit('ascend');
    }
    cam.rotation.set(this.pitch, this.yaw, 0);

    // Shadows follow you.
    this.sun.target.position.set(cam.position.x, 0, cam.position.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir.y > 0 ? this.sunDir : new THREE.Vector3(-this.sunDir.x, 0.6, -this.sunDir.z).normalize(), 300);

    this.crowd.update(dt, t, cam.position, this.polity, (p, att) => {
      const line = shout(p, att, this.player, this.polity);
      this.say(p, line, att);
      this.emit('speak', { person: p, line, attitude: att });
    });
    for (const h of this.env.turbines) if (h) h.rotation.z += dt * 0.6;
    if (this.env.water?.material.uniforms) this.env.water.material.uniforms.time.value += dt * 0.5;
    this.rising = (this.rising || []).filter((r) => {
      r.t += dt * (r.slow ? 0.25 : 0.8);
      const e = 1 - (1 - Math.min(1, r.t)) ** 3;
      r.obj.position.y = r.to - (r.slow ? 20 : 6) * (1 - e);
      return r.t < 1;
    });
    for (const c of this.watchers.children) if (c.isObject3D && !c.isLight) c.rotation.y += dt * 0.1;
    this.positionBubbles(dt);
    this.composer.render();
  }
}
