// The strategic view: a photoreal Earth in orbit, the six Gods circling it,
// polity markers on the surface and arcs of influence when anyone acts.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  earthVertex, earthFragment, cloudVertex, cloudFragment, atmosphereVertex, atmosphereFragment,
} from './shaders.js';
import { KINDS, KIND_ORDER } from '../engine/data.js';
import { Flight } from './flight.js';

// How close (in planet radii) you must be to a polity to act on it.
export const ACT_RANGE = 0.8;

const ASSET = (p) => `${import.meta.env.BASE_URL}assets/${p}`;

// Lat/lon → position on the unit sphere, matching SphereGeometry's UVs so
// markers sit on the right spot of the equirectangular textures.
export function latLonToVec3(lat, lon, r = 1) {
  const la = THREE.MathUtils.degToRad(lat);
  const ph = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-Math.cos(ph) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(ph) * Math.cos(la) * r);
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Software GL (no GPU) or ?quality=low → lighter ground scenes.
    const q = new URLSearchParams(location.search).get('quality');
    let software = false;
    try {
      const gl = this.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      software = /swiftshader|llvmpipe|software/i.test(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '');
    } catch { /* unknown renderer */ }
    this.lowPower = q ? q === 'low' : software;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
    this.camera.position.set(0.6, 0.9, 4.2);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 9;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.7;
    this.flight = new Flight(this.camera, canvas);
    this.view = 'orbit';
    this.playerKind = null;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Late-afternoon light from the right, so the terminator and city
    // lights are always somewhere in view.
    this.sunDir = new THREE.Vector3(1, 0.22, 0.12).normalize();
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.markers = new Map();
    this.avatars = new Map();
    this.fx = [];
    this.selected = null;
    this.hovered = null;
    this.listeners = { select: [], hover: [] };
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-9, -9);
    this.autoRotate = true;

    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);
    this.buildComposer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointermove', (e) => this.onPointer(e));
    canvas.addEventListener('pointerdown', (e) => { this.downAt = [e.clientX, e.clientY]; this.autoRotate = false; });
    canvas.addEventListener('pointerup', (e) => this.onClick(e));
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();
  }

  buildComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  async load(onProgress = () => {}) {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => onProgress(loaded / total);
    const tl = new THREE.TextureLoader(manager);
    const tex = (name, srgb = false) =>
      new Promise((resolve) => {
        tl.load(ASSET(`textures/${name}`), (t) => {
          t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          if (srgb) t.colorSpace = THREE.SRGBColorSpace;
          resolve(t);
        }, undefined, () => resolve(null));
      });
    const [day, night, normal, spec, clouds, stars] = await Promise.all([
      tex('earth_albedo.jpg'), tex('earth_lights.jpg'), tex('earth_normal.jpg'),
      tex('earth_spec.jpg'), tex('earth_clouds.jpg'), tex('stars.jpg', true),
    ]);
    for (const t of [clouds]) if (t) t.wrapS = THREE.RepeatWrapping;

    if (stars) {
      stars.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.background = stars;
      this.scene.backgroundIntensity = 0.55;
    }

    const blank = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    blank.needsUpdate = true;
    const uniforms = {
      dayMap: { value: day ?? blank },
      nightMap: { value: night ?? blank },
      normalMap: { value: normal ?? blank },
      specMap: { value: spec ?? blank },
      cloudMap: { value: clouds ?? blank },
      sunDir: { value: this.sunDir },
      cloudOffset: { value: 0 },
      normalStrength: { value: 0.9 },
      lightsBoost: { value: 2.4 },
    };
    this.earthUniforms = uniforms;
    const geo = new THREE.SphereGeometry(1, 256, 128);
    this.earth = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: earthVertex, fragmentShader: earthFragment }));
    this.earthGroup.add(this.earth);

    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.007, 192, 96),
      new THREE.ShaderMaterial({
        uniforms: { cloudMap: uniforms.cloudMap, sunDir: uniforms.sunDir, cloudOffset: uniforms.cloudOffset },
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    );
    this.earthGroup.add(this.clouds);

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.065, 128, 64),
      new THREE.ShaderMaterial({
        uniforms: { sunDir: uniforms.sunDir, planetCenter: { value: new THREE.Vector3() } },
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(this.atmosphere);

    // Sunlight for the avatars and a faint blue earthshine.
    const sun = new THREE.DirectionalLight(0xfff4e6, 3.2);
    sun.position.copy(this.sunDir).multiplyScalar(10);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x3a5a9a, 0x000000, 0.25));

    await this.loadAvatars(manager);
  }

  async loadAvatars(manager) {
    const loader = new GLTFLoader(manager);
    this.avatarTemplates = {};
    await Promise.all(KIND_ORDER.map((k) => new Promise((resolve) => {
      loader.load(ASSET(`models/god_${k}.glb`), (gltf) => {
        this.avatarTemplates[k] = gltf.scene;
        resolve();
      }, undefined, () => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: KINDS[k].color, emissive: KINDS[k].color, emissiveIntensity: 1.5, flatShading: true }));
        const g = new THREE.Group();
        g.add(m);
        this.avatarTemplates[k] = g;
        resolve();
      });
    })));
  }

  avatar(kind) {
    return this.avatarTemplates[kind].clone(true);
  }

  // ------------------------------------------------------------ gods in orbit

  placeGods(state) {
    for (const [, a] of this.avatars) this.scene.remove(a.group);
    this.avatars.clear();
    KIND_ORDER.forEach((k, i) => {
      const group = new THREE.Group();
      const model = this.avatar(k);
      const player = k === state.player;
      this.playerKind = state.player;
      model.scale.setScalar(player ? 0.085 : 0.065);
      group.add(model);
      const glow = new THREE.PointLight(new THREE.Color(KINDS[k].color), player ? 0.6 : 0.3, 0.8, 2);
      group.add(glow);
      this.scene.add(group);
      this.avatars.set(k, {
        group,
        model,
        radius: 1.75 + (i % 3) * 0.22,
        speed: 0.05 + i * 0.008,
        phase: (i / KIND_ORDER.length) * Math.PI * 2,
        tilt: new THREE.Euler(((i * 37) % 50 - 25) * (Math.PI / 180), 0, ((i * 23) % 40 - 20) * (Math.PI / 180)),
        alive: true,
      });
    });
  }

  updateGods(state) {
    for (const [k, a] of this.avatars) {
      a.alive = state.gods[k].alive;
      // In first person you are your God, so your own avatar is hidden.
      a.group.visible = a.alive && !(this.view === 'flight' && k === this.playerKind);
    }
  }

  // ------------------------------------------------------------ views

  setView(view) {
    this.view = view;
    const flying = view === 'flight';
    this.flight.enabled = flying;
    this.controls.enabled = view === 'orbit';
    this.focusTween = null;
    if (flying || view === 'ground') {
      this.autoRotate = false;
      if (view === 'ground') this.flight.autopilot = null;
    } else {
      this.flight.unlock();
      this.flight.autopilot = null;
      this.camera.up.set(0, 1, 0);
      this.camera.position.setLength(Math.max(3.2, this.camera.position.length()));
      this.controls.target.set(0, 0, 0);
      this.camera.lookAt(0, 0, 0);
    }
    for (const [k, a] of this.avatars) a.group.visible = a.alive && !(flying && k === this.playerKind);
    this.canvas.style.cursor = flying ? 'crosshair' : 'grab';
  }

  markerWorld(id) {
    const m = this.markers.get(id);
    return m ? m.sprite.getWorldPosition(new THREE.Vector3()) : null;
  }

  // The polity under the crosshair: the visible marker closest to the centre
  // of view, within a few degrees. Returns { id, distance, inRange }.
  aimTarget() {
    const cam = this.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    let best = null, bestAngle = THREE.MathUtils.degToRad(7);
    for (const [id, m] of this.markers) {
      const wp = m.sprite.getWorldPosition(new THREE.Vector3());
      const to = wp.clone().sub(cam.position);
      const dist = to.length();
      // Hidden behind the planet?
      if (wp.clone().normalize().dot(to.clone().negate().normalize()) < 0.02) continue;
      // Wider cone when close, so nearby regions are easy to pick.
      const angle = fwd.angleTo(to);
      const cone = bestAngle + Math.atan2(m.size * 0.6, dist);
      if (angle < cone && (!best || angle < best.angle)) best = { id, angle, distance: dist, inRange: dist <= ACT_RANGE };
    }
    return best;
  }

  godPosition(kind, t = this.timer.getElapsed()) {
    const a = this.avatars.get(kind);
    if (!a) return new THREE.Vector3(0, 2, 0);
    const ang = a.phase + t * a.speed;
    const v = new THREE.Vector3(Math.cos(ang) * a.radius, 0, Math.sin(ang) * a.radius);
    return v.applyEuler(a.tilt);
  }

  // ------------------------------------------------------------ polity markers

  setPolities(state) {
    for (const [, m] of this.markers) this.earthGroup.remove(m.group);
    this.markers.clear();
    for (const p of state.polities) {
      const group = new THREE.Group();
      const pos = latLonToVec3(p.lat, p.lon, 1.0);
      group.position.copy(pos);
      group.lookAt(pos.clone().multiplyScalar(2));

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: true, sizeAttenuation: true }));
      const s = 0.05 + Math.sqrt(p.pop) * 0.0028;
      sprite.scale.set(s, s, 1);
      sprite.position.set(0, 0, 0.012);
      sprite.userData.polity = p.id;
      group.add(sprite);

      // A beam of light whose height and colour show who leads here.
      const beamGeo = new THREE.CylinderGeometry(0.0012, 0.003, 1, 8, 1, true);
      beamGeo.rotateX(Math.PI / 2);
      beamGeo.translate(0, 0, 0.5);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
      group.add(beam);

      const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.scale.setScalar(s * 0.8);
      ring.position.z = 0.003;
      group.add(ring);

      this.earthGroup.add(group);
      this.markers.set(p.id, { group, sprite, canvas, texture, beam, ring, size: s, pos });
    }
    this.updatePolities(state);
  }

  updatePolities(state) {
    for (const p of state.polities) {
      const m = this.markers.get(p.id);
      if (!m) continue;
      const ctx = m.canvas.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);
      // Donut of Assent shares; the unclaimed share stays dark.
      let a0 = -Math.PI / 2;
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.arc(64, 64, 46, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6,9,15,0.85)';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(64, 64, 59, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(230,236,245,0.7)';
      ctx.stroke();
      ctx.lineWidth = 20;
      for (const k of KIND_ORDER) {
        const v = p.assent[k];
        if (v <= 0.002) continue;
        const a1 = a0 + v * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(64, 64, 46, a0, a1);
        ctx.strokeStyle = KINDS[k].color;
        ctx.stroke();
        a0 = a1;
      }
      ctx.beginPath();
      ctx.arc(64, 64, 12, 0, Math.PI * 2);
      const mine = p.assent[state.player];
      ctx.fillStyle = mine > 0.0 ? KINDS[state.player].color : '#9aa4b5';
      ctx.globalAlpha = 0.35 + Math.min(1, mine * 3) * 0.65;
      ctx.fill();
      ctx.globalAlpha = 1;
      m.texture.needsUpdate = true;

      let lead = null, best = 0;
      for (const k of KIND_ORDER) if (p.assent[k] > best) { best = p.assent[k]; lead = k; }
      const sovereign = Math.max(0, 1 - Object.values(p.assent).reduce((x, y) => x + y, 0));
      const color = lead && best > sovereign * 0.5 ? KINDS[lead].color : '#cfd8e6';
      m.beam.material.color.set(color);
      m.beam.scale.set(1, 1, 0.03 + best * 0.22);
    }
  }

  select(id) {
    this.selected = id;
    for (const [pid, m] of this.markers) {
      m.ring.material.opacity = pid === id ? 0.9 : 0;
    }
  }

  focus(id) {
    const m = this.markers.get(id);
    if (!m) return;
    const target = m.pos.clone().applyMatrix4(this.earthGroup.matrixWorld).normalize();
    const dist = this.camera.position.length();
    this.focusTween = { from: this.camera.position.clone(), to: target.multiplyScalar(Math.max(2.4, Math.min(dist, 3.4))), t: 0 };
    this.autoRotate = false;
  }

  on(event, fn) { this.listeners[event].push(fn); }
  emit(event, v) { for (const fn of this.listeners[event]) fn(v); }

  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const sprites = [...this.markers.values()].map((m) => m.sprite).filter((s) => this.facing(s));
    const hit = this.raycaster.intersectObjects(sprites, false)[0];
    return hit ? hit.object.userData.polity : null;
  }

  facing(obj) {
    const wp = obj.getWorldPosition(new THREE.Vector3());
    return wp.clone().normalize().dot(this.camera.position.clone().sub(wp).normalize()) > 0.05;
  }

  onPointer(e) {
    const id = this.pick(e.clientX, e.clientY);
    if (id !== this.hovered) {
      this.hovered = id;
      this.canvas.style.cursor = id ? 'pointer' : 'grab';
      this.emit('hover', id);
    }
  }

  onClick(e) {
    if (!this.downAt || this.view === 'flight') { this.downAt = null; return; }
    const moved = Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]);
    this.downAt = null;
    if (moved > 5) return;
    const id = this.pick(e.clientX, e.clientY);
    this.emit('select', id);
  }

  // Screen position of a polity for HTML labels (null when on the far side).
  screenPosition(id) {
    const m = this.markers.get(id);
    if (!m) return null;
    const wp = m.sprite.getWorldPosition(new THREE.Vector3());
    const facing = wp.clone().normalize().dot(this.camera.position.clone().sub(wp).normalize());
    const v = wp.project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, facing };
  }

  // ------------------------------------------------------------ action effects

  playAction(fx, delay = 0) {
    const m = this.markers.get(fx.polity);
    if (!m) return;
    const color = new THREE.Color(KINDS[fx.god].color);
    // Your own influence pours out of you, just below the crosshair.
    const fromMe = this.view === 'flight' && fx.god === this.playerKind;
    const start = fromMe
      ? this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), 0.12).addScaledVector(this.camera.up, -0.05)
      : this.godPosition(fx.god, this.timer.getElapsed() + delay);
    const end = m.pos.clone().applyMatrix4(this.earthGroup.matrixWorld);
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(Math.max(start.length(), 1.02 + start.distanceTo(end) * 0.35) * 1.02);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const tube = new THREE.TubeGeometry(curve, 64, (fx.action === 'whisper' ? 0.0025 : 0.005) * (fromMe ? 0.35 : 1), 6, false);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fx.action === 'whisper' ? 0.45 : 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(tube, mat);
    mesh.geometry.setDrawRange(0, 0);
    this.scene.add(mesh);
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.group.add(ripple);
    ripple.position.z = 0.004;
    this.fx.push({ mesh, ripple, t: -delay, total: tube.index.count, dur: 1.6 });
    for (const id of fx.targets || []) if (id !== fx.polity) this.playRipple(id, color, delay + 0.8);
  }

  playRipple(id, color, delay = 0) {
    const m = this.markers.get(id);
    if (!m) return;
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ripple.position.z = 0.004;
    m.group.add(ripple);
    this.fx.push({ ripple, t: -delay, dur: 1.6, rippleOnly: true });
  }

  tickFx(dt) {
    this.fx = this.fx.filter((f) => {
      f.t += dt;
      if (f.t < 0) return true;
      const k = Math.min(1, f.t / f.dur);
      if (f.mesh) {
        const grow = Math.min(1, k * 1.8);
        f.mesh.geometry.setDrawRange(0, Math.floor(f.total * grow / 3) * 3);
        f.mesh.material.opacity = (1 - Math.max(0, (k - 0.55) / 0.45)) * 0.9;
      }
      const rk = Math.max(0, (k - 0.45) / 0.55);
      f.ripple.scale.setScalar(0.01 + rk * 0.12);
      f.ripple.material.opacity = rk > 0 ? (1 - rk) * 0.9 : 0;
      if (k >= 1) {
        if (f.mesh) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); }
        f.ripple.parent?.remove(f.ripple);
        f.ripple.geometry.dispose();
        return false;
      }
      return true;
    });
  }

  // ------------------------------------------------------------ frame loop

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    if (this.earth) {
      this.earthUniforms.cloudOffset.value = (t * 0.0015) % 1;
      if (this.autoRotate) this.earthGroup.rotation.y += dt * 0.03;
    }
    for (const [k, a] of this.avatars) {
      if (!a.alive) continue;
      a.group.position.copy(this.godPosition(k, t));
      a.model.rotation.y += dt * 0.25;
    }
    if (this.focusTween) {
      const f = this.focusTween;
      f.t = Math.min(1, f.t + dt * 1.4);
      const e = 1 - (1 - f.t) ** 3;
      const dir = f.from.clone().normalize().lerp(f.to.clone().normalize(), e).normalize();
      this.camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(f.from.length(), f.to.length(), e)));
      if (f.t >= 1) this.focusTween = null;
    }
    this.tickFx(dt);
    if (this.view === 'flight') {
      this.flight.update(dt);
      // Keep markers readable up close instead of filling the screen.
      const cam = this.camera.position;
      for (const [, m] of this.markers) {
        const d = m.sprite.getWorldPosition(this._tmp ||= new THREE.Vector3()).distanceTo(cam);
        const k = THREE.MathUtils.clamp(d / 1.4, 0.18, 1);
        m.sprite.scale.set(m.size * k, m.size * k, 1);
        m.ring.scale.setScalar(m.size * 0.8 * k);
      }
    } else {
      if (this._scaled) {
        for (const [, m] of this.markers) { m.sprite.scale.set(m.size, m.size, 1); m.ring.scale.setScalar(m.size * 0.8); }
      }
      this.controls.update();
    }
    this._scaled = this.view === 'flight';
    this.composer.render();
  }
}
