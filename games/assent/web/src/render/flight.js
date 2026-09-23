// First-person flight around the planet. You are the God: WASD moves you,
// the mouse looks, Space/C climb and descend, Shift boosts. "Up" is always
// away from Earth's centre, so the horizon stays level wherever you fly.
import * as THREE from 'three';

export const FLIGHT = {
  minRadius: 1.07, // ~450 km above the surface
  maxRadius: 5.5,
  baseSpeed: 0.18, // planet radii per second at low altitude
  boost: 3,
  lookSpeed: 0.0022,
  maxPitch: THREE.MathUtils.degToRad(85),
};

export class Flight {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.enabled = false;
    this.keys = new Set();
    this.heading = new THREE.Vector3(0, 0, -1); // tangent to the sphere
    this.pitch = 0;
    this.velocity = new THREE.Vector3();
    this.autopilot = null;
    this.frozen = false; // true while a modal is open

    document.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.locked || this.frozen) return;
      this.turn(e.movementX * FLIGHT.lookSpeed, e.movementY * FLIGHT.lookSpeed);
    });
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      p?.catch?.(() => {});
    } catch { /* pointer lock unavailable (e.g. iframe); arrow keys still work */ }
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }

  // Place the camera above a point, facing along the surface towards `lookAt`.
  placeAbove(point, altitudeRadius = 1.9) {
    const up = point.clone().normalize();
    this.camera.position.copy(up).multiplyScalar(altitudeRadius);
    const north = new THREE.Vector3(0, 1, 0);
    this.heading.copy(north).sub(up.clone().multiplyScalar(north.dot(up))).normalize();
    if (this.heading.lengthSq() < 1e-6) this.heading.set(1, 0, 0);
    this.pitch = -0.9;
    this.apply();
  }

  // Glide to hover over a world-space point, looking down at it.
  flyTo(point, onArrive = null) {
    const up = point.clone().normalize();
    const to = up.clone().multiplyScalar(1.42);
    // Back off along our current heading so the target sits ahead of us.
    const back = this.heading.clone().sub(up.clone().multiplyScalar(this.heading.dot(up))).normalize();
    if (back.lengthSq() > 1e-6) to.addScaledVector(back, -0.22);
    to.setLength(1.42);
    this.autopilot = { from: this.camera.position.clone(), to, target: point.clone(), t: 0, onArrive };
  }

  turn(dx, dy) {
    const up = this.camera.position.clone().normalize();
    this.heading.applyAxisAngle(up, -dx);
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -FLIGHT.maxPitch, FLIGHT.maxPitch);
  }

  forward() {
    const up = this.camera.position.clone().normalize();
    const right = new THREE.Vector3().crossVectors(this.heading, up).normalize();
    return this.heading.clone().applyAxisAngle(right, this.pitch).normalize();
  }

  update(dt) {
    if (!this.enabled) return;
    const cam = this.camera;
    if (this.frozen) { this.velocity.set(0, 0, 0); this.apply(); return; }
    if (this.autopilot) {
      const a = this.autopilot;
      a.t = Math.min(1, a.t + dt * 0.7);
      const e = a.t * a.t * (3 - 2 * a.t);
      const dir = a.from.clone().normalize().lerp(a.to.clone().normalize(), e).normalize();
      cam.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(a.from.length(), a.to.length(), e)));
      this.aimAt(a.target, Math.min(1, dt * 4));
      if (a.t >= 1) { this.autopilot = null; a.onArrive?.(); } else if (this.moving()) this.autopilot = null;
    }

    // Arrow keys look around too, for trackpads and when pointer lock is refused.
    const k = this.keys;
    const look = 1.6 * dt;
    if (k.has('ArrowLeft')) this.turn(-look, 0);
    if (k.has('ArrowRight')) this.turn(look, 0);
    if (k.has('ArrowUp')) this.turn(0, -look);
    if (k.has('ArrowDown')) this.turn(0, look);

    const up = cam.position.clone().normalize();
    const right = new THREE.Vector3().crossVectors(this.heading, up).normalize();
    const fwd = this.forward();
    const wish = new THREE.Vector3();
    if (k.has('KeyW')) wish.add(fwd);
    if (k.has('KeyS')) wish.sub(fwd);
    if (k.has('KeyD')) wish.add(right);
    if (k.has('KeyA')) wish.sub(right);
    if (k.has('Space')) wish.add(up);
    if (k.has('KeyC') || k.has('ControlLeft')) wish.sub(up);
    if (wish.lengthSq() > 0) wish.normalize();

    // Slower near the ground, faster out in space.
    const r = cam.position.length();
    const speed = FLIGHT.baseSpeed * (0.35 + (r - 1) * 1.6) * (k.has('ShiftLeft') || k.has('ShiftRight') ? FLIGHT.boost : 1);
    this.velocity.lerp(wish.multiplyScalar(speed), Math.min(1, dt * 6));
    cam.position.addScaledVector(this.velocity, dt);
    const clamped = THREE.MathUtils.clamp(cam.position.length(), FLIGHT.minRadius, FLIGHT.maxRadius);
    cam.position.setLength(clamped);

    this.apply();
  }

  moving() {
    return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC'].some((c) => this.keys.has(c));
  }

  // Turn heading/pitch towards a world point.
  aimAt(point, amount = 1) {
    const cam = this.camera;
    const up = cam.position.clone().normalize();
    const to = point.clone().sub(cam.position).normalize();
    const flat = to.clone().sub(up.clone().multiplyScalar(to.dot(up)));
    if (flat.lengthSq() > 1e-8) this.heading.lerp(flat.normalize(), amount).normalize();
    const targetPitch = Math.asin(THREE.MathUtils.clamp(to.dot(up), -1, 1));
    this.pitch += (targetPitch - this.pitch) * amount;
  }

  // Re-project the heading onto the local tangent plane (parallel transport)
  // and orient the camera.
  apply() {
    const cam = this.camera;
    const up = cam.position.clone().normalize();
    this.heading.sub(up.clone().multiplyScalar(this.heading.dot(up)));
    if (this.heading.lengthSq() < 1e-8) this.heading.set(0, 0, 1).sub(up.clone().multiplyScalar(up.z));
    this.heading.normalize();
    const target = cam.position.clone().add(this.forward());
    cam.up.copy(up);
    cam.lookAt(target);
  }
}
