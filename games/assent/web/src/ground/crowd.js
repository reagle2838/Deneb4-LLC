// The people of a polity. Every person is drawn with instanced body parts
// (a few draw calls for hundreds of people) and animated procedurally:
// walking, chatting, stopping to look at you, waving, filming you on their
// phone, turning their back, holding up a rival's sign, or kneeling.
import * as THREE from 'three';
import { seeded, hashString } from './noise.js';
import { NAMES, JOBS, SKIN } from './places.js';
import { KINDS, KIND_ORDER, AXES } from '../engine/data.js';

const PARTS = ['torso', 'head', 'hair', 'armL', 'armR', 'legL', 'legR', 'sign', 'phone', 'ring'];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

const SHIRTS = [0x2f4b7c, 0xa23b3b, 0xe0c068, 0x3f7f5f, 0xdedad0, 0x222226, 0x7a4f9a, 0xd9793a, 0x4f9fbf, 0x8c8c8c, 0xc85a8a, 0x5b6b2f];
const PANTS = [0x23262d, 0x3b3f4a, 0x4a3b2a, 0x2f3d5c, 0x6b6150, 0x1a1a1a, 0x5a4a3a];
const HAIR = [0x1a1210, 0x2b1d14, 0x3d2a1b, 0x5a3b22, 0x8a6a3a, 0xb8a27a, 0x6b6b6b, 0xd0d0d0];

function skinColor(t) {
  // t: 0 = deep brown, 1 = pale
  const dark = new THREE.Color(0x3b2417), light = new THREE.Color(0xf1d2bd);
  return dark.lerp(light, t);
}

export class Crowd {
  constructor(env, polity, state, rngSeed = 1, density = 1) {
    this.env = env;
    this.polity = polity;
    this.player = state.player;
    this.group = new THREE.Group();
    this.people = [];
    this.bursts = [];
    this.events = []; // speech bubbles for the scene to show: { person, text, t }
    const rand = seeded(hashString(polity.id) ^ rngSeed);
    this.rand = rand;
    const count = Math.round(env.place.people * density);

    const geos = {
      torso: new THREE.CapsuleGeometry(0.17, 0.42, 4, 10),
      head: new THREE.SphereGeometry(0.115, 14, 10),
      hair: new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      armL: new THREE.CapsuleGeometry(0.055, 0.52, 3, 6).translate(0, -0.3, 0),
      armR: new THREE.CapsuleGeometry(0.055, 0.52, 3, 6).translate(0, -0.3, 0),
      legL: new THREE.CapsuleGeometry(0.075, 0.74, 3, 6).translate(0, -0.44, 0),
      legR: new THREE.CapsuleGeometry(0.075, 0.74, 3, 6).translate(0, -0.44, 0),
      sign: new THREE.BoxGeometry(0.7, 0.45, 0.03),
      phone: new THREE.BoxGeometry(0.07, 0.13, 0.015),
      ring: new THREE.RingGeometry(0.34, 0.42, 24).rotateX(-Math.PI / 2),
    };
    const mats = {
      torso: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      head: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      armL: null, armR: null,
      legL: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      legR: null,
      sign: new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.25 }),
      phone: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xbfe6ff, emissiveIntensity: 2 }),
      ring: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    mats.armL = mats.armR = mats.torso;
    mats.legR = mats.legL;
    this.meshes = {};
    for (const p of PARTS) {
      const mesh = new THREE.InstancedMesh(geos[p], mats[p], count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = !['ring', 'phone'].includes(p);
      mesh.frustumCulled = false;
      this.meshes[p] = mesh;
      this.group.add(mesh);
    }

    const names = NAMES[polity.id] || NAMES.rhine;
    const [skinLo, skinHi] = SKIN[polity.id] || [0.3, 0.9];
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const spot = this.randomSpot();
      const age = Math.round(16 + Math.pow(rand(), 1.3) * 68);
      const person = {
        i,
        name: rand.pick(names),
        age,
        job: age > 68 ? rand.pick(['retired schoolteacher', 'grandmother of nine', 'retired grid technician', 'veteran of the Seven Weeks']) : age < 21 ? 'student' : rand.pick(JOBS),
        x: spot.x, z: spot.y,
        heading: rand() * Math.PI * 2,
        targetHeading: 0,
        speed: rand.range(1.0, 1.5),
        scale: rand.range(0.9, 1.08) * (age < 18 ? 0.92 : 1),
        width: rand.range(0.88, 1.18),
        phase: rand() * 10,
        mode: rand() < 0.35 ? 'idle' : 'walk',
        timer: rand.range(2, 10),
        goal: null,
        react: 'none',
        reactT: 0,
        reactStrength: 0,
        headYaw: 0,
        headPitch: 0,
        kneel: 0,
        armsUp: 0,
        wave: 0,
        film: 0,
        cross: 0,
        sign: 0,
        spoke: -99,
        talkedYear: null,
        values: Object.fromEntries(AXES.map(({ id }) => [id, Math.max(-1, Math.min(1, polity.values[id] + rand.gauss() * 0.35))])),
        allegiance: null,
        flash: 0,
      };
      mats.torso && this.meshes.torso.setColorAt(i, col.set(rand.pick(SHIRTS)).offsetHSL(0, rand.range(-0.1, 0.05), rand.range(-0.08, 0.08)));
      this.meshes.armL.setColorAt(i, col);
      this.meshes.armR.setColorAt(i, col);
      const skin = skinColor(rand.range(skinLo, skinHi));
      this.meshes.head.setColorAt(i, skin);
      this.meshes.hair.setColorAt(i, col.set(age > 60 && rand() < 0.7 ? rand.pick([0x9a9a9a, 0xd8d8d8]) : rand.pick(HAIR)));
      this.meshes.legL.setColorAt(i, col.set(rand.pick(PANTS)));
      this.meshes.legR.setColorAt(i, col);
      this.meshes.sign.setColorAt(i, col.set(0xffffff));
      this.meshes.ring.setColorAt(i, col.set(0x000000));
      this.people.push(person);
    }
    this.sync(polity);
    for (const p of PARTS) if (this.meshes[p].instanceColor) this.meshes[p].instanceColor.needsUpdate = true;
  }

  randomSpot() {
    const nav = this.env.navPoints;
    for (let k = 0; k < 30; k++) {
      const n = nav[Math.floor(this.rand() * nav.length)];
      const x = n.x + this.rand.range(-9, 9), z = n.y + this.rand.range(-9, 9);
      if (!this.env.isWater(x, z) && !this.env.blocked(x, z, 0.8)) return new THREE.Vector2(x, z);
    }
    return new THREE.Vector2(this.rand.range(-15, 15), this.rand.range(-15, 15));
  }

  // Match people's allegiances to the polity's Assent shares, changing as
  // few people as possible.
  sync(polity) {
    this.polity = polity;
    const n = this.people.length;
    const want = {};
    for (const g of KIND_ORDER) want[g] = Math.round(polity.assent[g] * n);
    const have = {};
    for (const p of this.people) if (p.allegiance) have[p.allegiance] = (have[p.allegiance] || 0) + 1;
    // Release surplus followers to sovereignty.
    for (const g of KIND_ORDER) {
      let extra = (have[g] || 0) - want[g];
      for (const p of this.people) {
        if (extra <= 0) break;
        if (p.allegiance === g) { p.allegiance = null; extra--; }
      }
    }
    // Recruit from the unaligned.
    for (const g of KIND_ORDER) {
      let need = want[g] - this.people.filter((p) => p.allegiance === g).length;
      for (const p of this.people) {
        if (need <= 0) break;
        if (!p.allegiance) { p.allegiance = g; need--; }
      }
    }
    this.paintRings();
  }

  paintRings() {
    const col = new THREE.Color();
    for (const p of this.people) this.meshes.ring.setColorAt(p.i, p.allegiance ? col.set(KINDS[p.allegiance].color) : col.set(0x000000));
    this.meshes.ring.instanceColor.needsUpdate = true;
  }

  // People near `at` who switch to `god` (after an action), with a flash.
  convert(god, amount, at) {
    const target = Math.round(Math.max(0, amount) * this.people.length);
    if (!target) return [];
    const candidates = this.people.filter((p) => p.allegiance !== god)
      .sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
    const changed = candidates.slice(0, target);
    for (const p of changed) { p.allegiance = god; p.flash = 1; }
    this.paintRings();
    return changed;
  }

  nearest(pos, maxDist = 14, dir = null) {
    let best = null, bestScore = Infinity;
    for (const p of this.people) {
      const dx = p.x - pos.x, dz = p.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > maxDist) continue;
      let score = d;
      if (dir) {
        const y = this.env.heightAt(p.x, p.z) + 1.5 * p.scale;
        _v.set(dx, y - pos.y, dz).normalize();
        const ang = Math.acos(Math.min(1, _v.dot(dir)));
        if (ang > 0.22) continue;
        score = ang * 30 + d * 0.3;
      }
      if (score < bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  headPosition(p, out = new THREE.Vector3()) {
    return out.set(p.x, this.env.heightAt(p.x, p.z) + (1.95 - p.kneel * 0.5) * p.scale, p.z);
  }

  // Attitude of this person towards the player's God.
  attitude(p, polity) {
    const me = this.player;
    if (p.allegiance === me) return polity.dependence[me] > 0.4 && (p.i % 3 === 0) ? 'devoted' : 'follower';
    if (p.allegiance) return 'rival';
    if (polity.suspicion[me] > 0.25 && p.i % 2 === 0) return 'accuser';
    return p.i % 4 === 0 ? 'wary' : 'curious';
  }

  update(dt, t, god, polity, onSpeak) {
    const env = this.env;
    const gx = god.x, gz = god.z;
    for (const p of this.people) {
      const dx = gx - p.x, dz = gz - p.z;
      const dist = Math.hypot(dx, dz);
      const att = this.attitude(p, polity);
      const aware = dist < 28;
      const close = dist < 11;
      const toGod = Math.atan2(dx, dz);

      // ---- decide what to do
      let react = 'none';
      if (aware) {
        switch (att) {
          case 'follower': react = close ? 'wave' : 'watch'; break;
          case 'devoted': react = close ? 'kneel' : 'approach'; break;
          case 'rival': react = close ? (p.i % 2 ? 'protest' : 'turnaway') : 'watch'; break;
          case 'accuser': react = close ? 'cross' : 'watch'; break;
          case 'wary': react = close ? 'retreat' : 'watch'; break;
          default: react = close ? (p.i % 3 === 0 ? 'film' : 'watch') : (dist < 18 ? 'watch' : 'none');
        }
      }
      if (p.forced && p.forcedT > 0) { react = p.forced; p.forcedT -= dt; } else p.forced = null;
      p.react = react;

      // ---- speak, now and then, when you come close
      if (close && t - p.spoke > 18 && Math.random() < dt * 0.6) {
        p.spoke = t;
        onSpeak?.(p, att);
      }

      // ---- movement
      let moveSpeed = 0;
      if (react === 'none') {
        p.timer -= dt;
        if (p.mode === 'walk') {
          if (!p.goal || Math.hypot(p.goal.x - p.x, p.goal.y - p.z) < 1.5) p.goal = this.randomSpot();
          p.targetHeading = Math.atan2(p.goal.x - p.x, p.goal.y - p.z);
          moveSpeed = p.speed;
          if (p.timer < 0) { p.mode = 'idle'; p.timer = this.rand.range(3, 9); }
        } else if (p.timer < 0) { p.mode = 'walk'; p.timer = this.rand.range(8, 22); p.goal = this.randomSpot(); }
      } else if (react === 'approach') {
        p.targetHeading = toGod; moveSpeed = dist > 5 ? 1.2 : 0;
      } else if (react === 'retreat') {
        p.targetHeading = toGod + Math.PI; moveSpeed = 1.6;
      } else if (react === 'turnaway') {
        p.targetHeading = toGod + Math.PI;
      } else {
        p.targetHeading = toGod;
      }
      let dh = ((p.targetHeading - p.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      p.heading += dh * Math.min(1, dt * 3);
      if (moveSpeed > 0) {
        const nx = p.x + Math.sin(p.heading) * moveSpeed * dt;
        const nz = p.z + Math.cos(p.heading) * moveSpeed * dt;
        if (!env.blocked(nx, nz, 0.5) && !env.isWater(nx, nz) && Math.hypot(nx, nz) < 330) { p.x = nx; p.z = nz; }
        else p.goal = this.randomSpot();
        p.phase += dt * moveSpeed * 5.2;
      }
      p.moving = moveSpeed > 0;

      // ---- blend pose weights
      const k = Math.min(1, dt * 4);
      const tgt = (name, on) => { p[name] += ((on ? 1 : 0) - p[name]) * k; };
      tgt('kneel', react === 'kneel');
      tgt('wave', react === 'wave');
      tgt('armsUp', react === 'cheer');
      tgt('film', react === 'film');
      tgt('cross', react === 'cross' || react === 'turnaway');
      tgt('sign', react === 'protest');
      // Head: look at you (you float above them).
      const look = react !== 'none' && react !== 'turnaway' && react !== 'retreat';
      const rel = ((toGod - p.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const yawT = look ? Math.max(-1.2, Math.min(1.2, rel)) : Math.sin(t * 0.3 + p.i) * 0.3;
      const pitchT = look ? -Math.atan2(god.y - (env.heightAt(p.x, p.z) + 1.6), Math.max(1, dist)) * 0.8 : 0;
      p.headYaw += (yawT - p.headYaw) * k;
      p.headPitch += (pitchT - p.headPitch) * k;
      p.flash = Math.max(0, p.flash - dt * 0.7);
    }

    this.separate();
    this.writeMatrices(t);
    this.tickBursts(dt);
  }

  // Keep people from walking through each other.
  separate() {
    const ps = this.people;
    for (let a = 0; a < ps.length; a++) {
      for (let b = a + 1; b < ps.length; b++) {
        const dx = ps[b].x - ps[a].x, dz = ps[b].z - ps[a].z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.36 && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (0.6 - d) * 0.5;
          ps[a].x -= (dx / d) * push; ps[a].z -= (dz / d) * push;
          ps[b].x += (dx / d) * push; ps[b].z += (dz / d) * push;
        }
      }
    }
  }

  writeMatrices(t) {
    const M = this.meshes;
    const root = new THREE.Matrix4(), local = new THREE.Matrix4();
    const set = (mesh, i, m) => mesh.setMatrixAt(i, m);
    for (const p of this.people) {
      const y = this.env.heightAt(p.x, p.z);
      const walk = p.moving ? Math.sin(p.phase) : 0;
      const bob = p.moving ? Math.abs(Math.cos(p.phase)) * 0.04 : Math.sin(t * 1.3 + p.i) * 0.005;
      const drop = p.kneel * 0.45;
      const jump = p.armsUp * Math.max(0, Math.sin(t * 7 + p.i)) * 0.12;
      root.compose(_v.set(p.x, y + jump, p.z), _q.setFromAxisAngle(_s.set(0, 1, 0), p.heading), _s.set(p.scale * p.width, p.scale, p.scale * p.width));

      const lean = p.kneel * 0.35 - (p.film * 0.05);
      local.compose(_v.set(0, 1.2 + bob - drop, 0), _q.setFromEuler(_e.set(lean, 0, 0)), _s.set(1, 1, 0.75));
      set(M.torso, p.i, _m.multiplyMatrices(root, local));

      const headY = 1.64 + bob - drop * 1.05;
      const pitch = p.headPitch + p.kneel * 0.5;
      local.compose(_v.set(0, headY, lean * 0.15), _q.setFromEuler(_e.set(pitch, p.headYaw, 0, 'YXZ')), _s.set(1, 1.08, 1));
      set(M.head, p.i, _m.multiplyMatrices(root, local));
      set(M.hair, p.i, _m);

      // Arms: swing when walking; wave, cheer, film, fold or hold a sign.
      const armSwing = walk * 0.45;
      const waveOsc = Math.sin(t * 9 + p.i) * 0.35;
      for (const side of [-1, 1]) {
        const right = side === 1;
        let rx = (right ? -armSwing : armSwing), rz = side * 0.08;
        const up = Math.max(p.armsUp, p.sign);
        rz += side * up * 2.7;
        rx -= p.sign * 0.2;
        if (right) { rz += p.wave * (2.5 + waveOsc); rx -= p.film * 1.35; }
        rx -= p.cross * 1.2; rz -= side * p.cross * 0.5;
        rx -= p.kneel * 0.6;
        local.compose(_v.set(side * 0.225, 1.47 + bob - drop, 0), _q.setFromEuler(_e.set(rx, 0, rz, 'ZXY')), _s.set(1, 1, 1));
        set(right ? M.armR : M.armL, p.i, _m.multiplyMatrices(root, local));
      }
      for (const side of [-1, 1]) {
        let rx = (side === 1 ? walk : -walk) * 0.5;
        rx -= p.kneel * 1.45 * (side === 1 ? 1 : 0.2);
        local.compose(_v.set(side * 0.095, 0.92 + bob - drop * 0.9, 0), _q.setFromEuler(_e.set(rx, 0, 0)), _s.set(1, 1, 1));
        set(side === 1 ? M.legR : M.legL, p.i, _m.multiplyMatrices(root, local));
      }
      // Props: a rival's sign above the head, a glowing phone in hand.
      const signS = p.sign > 0.05 ? p.sign : 0;
      local.compose(_v.set(0, 2.25 - drop, 0.05), _q.identity(), _s.set(signS, signS, signS));
      set(M.sign, p.i, _m.multiplyMatrices(root, local));
      const ph = p.film > 0.05 ? p.film : 0;
      local.compose(_v.set(0.2, 1.62, 0.42), _q.setFromEuler(_e.set(-0.2, 0, 0)), _s.set(ph, ph, ph));
      set(M.phone, p.i, _m.multiplyMatrices(root, local));
      const ringS = p.allegiance ? 1 + p.flash * 4 : 0;
      _m.compose(_v.set(p.x, y + 0.04, p.z), _q.identity(), _s.set(ringS, 1, ringS));
      set(M.ring, p.i, _m);
    }
    // Signs carry the colour of the god the protester follows.
    const col = new THREE.Color();
    for (const p of this.people) if (p.sign > 0.05) this.meshes.sign.setColorAt(p.i, col.set(p.allegiance ? KINDS[p.allegiance].color : 0xffffff));
    this.meshes.sign.instanceColor.needsUpdate = true;
    for (const k of PARTS) M[k].instanceMatrix.needsUpdate = true;
  }

  // Make people near a point react for a few seconds (after your actions).
  stir(at, radius, react, seconds = 4, filter = () => true) {
    for (const p of this.people) {
      if (Math.hypot(p.x - at.x, p.z - at.z) < radius && filter(p)) { p.forced = react; p.forcedT = seconds * (0.6 + Math.random() * 0.8); }
    }
  }

  // Expanding light rings on the ground.
  burst(at, color, radius = 30, seconds = 2.2) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.set(at.x, this.env.heightAt(at.x, at.z) + 0.3, at.z);
    this.group.add(mesh);
    this.bursts.push({ mesh, t: 0, radius, seconds });
  }

  tickBursts(dt) {
    this.bursts = this.bursts.filter((b) => {
      b.t += dt;
      const k = b.t / b.seconds;
      b.mesh.scale.setScalar(0.5 + k * b.radius);
      b.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); return false; }
      return true;
    });
  }

  dispose() {
    for (const k of PARTS) { this.meshes[k].geometry.dispose(); }
  }
}
