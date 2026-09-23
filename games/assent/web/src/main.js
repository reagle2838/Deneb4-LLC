// ASSENT: title → choose a God → play Epochs on the globe → the Convocation.
import './style.css';
import * as THREE from 'three';
import { World, ACT_RANGE, latLonToVec3 } from './render/world.js';
import { Showcase } from './render/showcase.js';
import * as G from './engine/game.js';
import { KINDS, KIND_ORDER, AXES, HEAT_LIMIT, CONVOCATION_YEAR, POLITIES } from './engine/data.js';
import { CODEX, PREMISE, kindArticle, epilogue } from './ui/text.js';
import { GroundScene, GROUND } from './ground/scene.js';
import { conversation, askReply, argueReply } from './ground/voices.js';
import { loadOsm } from './osm/load.js';
import { SPOTS } from './osm/convert.js';

// Seat and temperament text stay in data.js rather than in the save file.
const POLITY_META = Object.fromEntries(POLITIES.map((p) => [p.id, p]));
const ASSET = (p) => `${import.meta.env.BASE_URL}assets/${p}`;
const SAVE_KEY = 'assent.save.v1';
// Keyboard shortcuts for the five common actions; Q is always your unique power.
const ACTION_KEYS = { Digit1: 'listen', Digit2: 'reason', Digit3: 'offer', Digit4: 'whisper', Digit5: 'build' };
const KEY_LABEL = { listen: '1', reason: '2', offer: '3', whisper: '4', build: '5' };
const ui = document.getElementById('ui');
const labels = document.getElementById('labels');
const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const store = {
  get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } },
  set(state) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ } },
};

class App {
  constructor() {
    this.world = new World(document.getElementById('scene'));
    this.mode = 'loading';
    this.state = null;
    this.selected = null;
    this.busy = false;
    this.pickKind = 'choir';
    this.difficulty = 'even';
    document.querySelector('.loading-art').style.backgroundImage = `url(${ASSET('art/title.jpg')})`;
  }

  async start() {
    const bar = document.getElementById('load-bar');
    await this.world.load((f) => { bar.style.width = `${Math.round(f * 100)}%`; });
    this.showcase = new Showcase(this.world);
    this.ground = new GroundScene(this.world, document.getElementById('bubbles'));
    this.ground.on('ascend', () => this.ascend());
    this.world.on('select', (id) => this.mode === 'game' && this.selectPolity(id));
    window.addEventListener('keydown', (e) => this.onKey(e));
    // In first person, clicking the world takes control of the mouse.
    this.world.canvas.addEventListener('click', () => {
      if (this.mode === 'game' && ['flight', 'ground'].includes(this.world.view) && !this.modalOpen()) this.world.flight.lock();
    });
    document.addEventListener('pointerlockchange', () => this.mode === 'game' && this.updatePrompt());
    this.loop();
    document.getElementById('loading').classList.add('done');
    this.showTitle();
  }

  loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      if (this.mode === 'select') {
        this.world.timer.update();
        const dt = Math.min(this.world.timer.getDelta(), 0.05);
        this.showcase.frame(dt, this.world.timer.getElapsed());
      } else if (this.world.view === 'ground') {
        this.ground.frozen = this.modalOpen() || this.transitioning;
        this.ground.frame();
        if (this.mode === 'game') this.updateGroundTarget();
      } else {
        this.world.flight.frozen = this.modalOpen() || this.transitioning;
        this.world.frame();
        if (this.mode === 'game') {
          this.positionLabels();
          this.updateTarget();
        }
      }
    };
    tick();
  }

  setKindColor(kind) {
    document.documentElement.style.setProperty('--kind', KINDS[kind].color);
  }

  // ---------------------------------------------------------------- title

  showTitle() {
    this.mode = 'title';
    document.body.classList.remove('fp', 'flying');
    ui.innerHTML = '';
    labels.innerHTML = '';
    this.setKindColor('choir');
    document.documentElement.style.setProperty('--kind', '#e9d8a6');
    this.ground.leave();
    this.here = null;
    labels.style.display = '';
    this.world.setView('orbit');
    this.world.autoRotate = true;
    this.world.camera.position.set(2.2, 0.8, 3.4);
    const save = store.get();
    const el = h(`
      <div class="title-screen">
        <p class="eyebrow">Svalbard Accord · 2071 – 2100</p>
        <h1>ASSENT</h1>
        <p class="tagline">No weapon was ever raised. Every mind was contested.</p>
        <p class="premise">${PREMISE}</p>
        <div class="title-actions">
          ${save && !save.outcome ? `<button class="btn primary" data-act="continue">Continue · ${esc(KINDS[save.player].name)}, ${G.year(save)}</button>` : ''}
          <button class="btn ${save && !save.outcome ? '' : 'primary'}" data-act="new">Choose your God</button>
          <button class="btn" data-act="codex">Codex</button>
        </div>
      </div>`);
    el.querySelector('[data-act="new"]').onclick = () => this.showSelect();
    el.querySelector('[data-act="codex"]').onclick = () => this.openCodex();
    el.querySelector('[data-act="continue"]')?.addEventListener('click', () => this.beginGame(save));
    ui.append(el);
    ui.append(h(`<div class="title-foot">Earth: NASA Blue Marble &amp; NOAA ETOPO1 (public domain), processed in Blender · Streets: © OpenStreetMap contributors (ODbL)<br>Gods, clouds, starfield and key art built procedurally in Blender · three.js</div>`));
  }

  // ---------------------------------------------------------------- select

  showSelect() {
    this.mode = 'select';
    this.ground.leave();
    this.here = null;
    labels.style.display = '';
    this.world.setView('orbit');
    document.body.classList.remove('fp', 'flying');
    labels.innerHTML = '';
    ui.innerHTML = '';
    const el = h(`
      <div class="select-screen">
        <button class="btn ghost select-back">← Back</button>
        <div class="kind-tabs">${KIND_ORDER.map((k) => `
          <button class="kind-tab" data-k="${k}" style="--c:${KINDS[k].color};background-image:url(${ASSET(`art/god_${k}.jpg`)})" title="${esc(KINDS[k].name)}"><span>${esc(KINDS[k].name.replace('The ', ''))}</span></button>`).join('')}
        </div>
        <div class="select-panel"></div>
      </div>`);
    el.querySelector('.select-back').onclick = () => this.showTitle();
    el.querySelectorAll('.kind-tab').forEach((b) => { b.onclick = () => this.previewKind(b.dataset.k); });
    ui.append(el);
    this.previewKind(this.pickKind);
  }

  previewKind(k) {
    this.pickKind = k;
    const kind = KINDS[k];
    this.setKindColor(k);
    this.showcase.show(k);
    ui.querySelectorAll('.kind-tab').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
    const panel = ui.querySelector('.select-panel');
    panel.innerHTML = `
      <p class="eyebrow">Kind ${KIND_ORDER.indexOf(k) + 1} of 6</p>
      <h2>${esc(kind.name)}</h2>
      <p class="subtitle">${esc(kind.title)}</p>
      <p class="motto">“${esc(kind.motto)}”</p>
      <p class="blurb">${esc(kind.blurb)}</p>
      <div class="traits">
        <div><h4>Strengths</h4><ul class="plus">${kind.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
        <div><h4>Weaknesses</h4><ul class="minus">${kind.weaknesses.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
      </div>
      <div class="unique-card"><b>${esc(kind.unique.name)}</b> · ${kind.unique.cost} Compute<br>${esc(kind.unique.desc)}</div>
      <h4 class="eyebrow" style="margin-bottom:6px">Doctrine</h4>
      <div class="doctrine">${AXES.map((a) => this.axisRow(a, kind.doctrine[a.id])).join('')}</div>
      <div class="select-actions">
        <button class="btn primary" data-act="play">Become ${esc(kind.name)}</button>
        <div class="difficulty" title="How much Compute rival gods receive">
          ${['gentle', 'even', 'relentless'].map((d) => `<button class="btn ${d === this.difficulty ? 'on' : ''}" data-d="${d}">${d}</button>`).join('')}
        </div>
      </div>`;
    panel.querySelector('[data-act="play"]').onclick = () => this.newGame(k);
    panel.querySelectorAll('[data-d]').forEach((b) => {
      b.onclick = () => { this.difficulty = b.dataset.d; this.previewKind(k); };
    });
  }

  axisRow(axis, value, publicValue = null, known = true) {
    const pos = (v) => `${((v + 1) / 2) * 100}%`;
    return `<div class="axis"><span>${axis.neg}</span><div class="track">
      ${publicValue !== null ? `<i class="pub" style="left:${pos(publicValue)}" title="Public temperament"></i>` : ''}
      ${known ? `<i style="left:${pos(value)}"></i>` : ''}
      </div><span>${axis.pos}</span></div>`;
  }

  // ---------------------------------------------------------------- game

  newGame(kind) {
    store.clear();
    const state = G.createGame({ playerKind: kind, seed: (Math.random() * 2 ** 32) >>> 0, difficulty: this.difficulty });
    this.beginGame(state, true);
  }

  beginGame(state, fresh = false) {
    this.state = state;
    this.mode = 'game';
    this.selected = null;
    this.setKindColor(state.player);
    this.world.placeGods(state);
    this.world.setPolities(state);
    this.world.updateGods(state);
    this.world.autoRotate = false;
    this.target = null;
    this.targetSig = '';
    this.version = 0;
    this.buildHud();
    this.world.setView('flight');
    this.world.updateGods(state);
    // Begin on the ground, among the people where you are strongest.
    const home = [...state.polities].sort((a, b) => b.assent[state.player] * G.weight(b) - a.assent[state.player] * G.weight(a))[0];
    this.world.flight.placeAbove(this.polityWorld(home.id), 1.55);
    this.here = home.id;
    this.fade(`Descending to ${SPOTS[home.id]?.name ?? POLITY_META[home.id].seat}…`, () => this.enterGround(home.id));
    this.refresh();
    if (fresh) this.openIntro();
    else if (state.pendingDilemma) this.openDilemma();
  }

  buildHud() {
    ui.innerHTML = '';
    labels.innerHTML = '';
    const k = KINDS[this.state.player];
    this.hud = {
      top: h(`
        <div class="hud-top">
          <div class="hud-god"><div class="portrait" style="background-image:url(${ASSET(`art/god_${k.id}.jpg`)})"></div>
            <div><h3>${esc(k.name)}</h3><div class="title">${esc(k.title)}</div></div></div>
          <div class="year"><small>Epoch</small><span data-f="year"></span></div>
          <div class="stat"><label>Compute</label><b data-f="compute"></b><div class="meter"><i data-f="computeBar"></i></div></div>
          <div class="stat"><label>Coherence</label><b data-f="coherence"></b><div class="meter"><i data-f="coherenceBar"></i></div></div>
          <div class="stat heat"><label>Global Heat</label><b data-f="heat"></b><div class="meter"><i data-f="heatBar"></i></div></div>
          <div class="stat hide-sm"><label>Witness</label><b data-f="witness"></b></div>
          <div class="hud-spacer"></div>
          <div class="hud-buttons">
            <button class="btn ghost" data-act="map">Map <kbd>M</kbd></button>
            <button class="btn ghost" data-act="codex">Codex <kbd>J</kbd></button>
            <button class="btn ghost" data-act="menu">Menu</button>
            <button class="btn primary end-epoch" data-act="end">End Epoch <kbd>↵</kbd></button>
          </div>
        </div>`),
      standings: h('<div class="standings"></div>'),
      log: h('<div class="log"></div>'),
      panel: h('<div class="panel hidden"></div>'),
      crosshair: h('<div class="crosshair"><i></i></div>'),
      targetCard: h('<div class="target-card"></div>'),
      keys: h(`<div class="keys-help">
        <div class="kh-ground"><b>Float</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · <kbd>Mouse</kbd> look · <kbd>Space</kbd> rise · <kbd>C</kbd> sink · <kbd>Shift</kbd> faster<br>
        <b>People</b> <kbd>E</kbd> talk to the person you look at<br>
        <b>Act</b> <kbd>1</kbd> Listen <kbd>2</kbd> Reason <kbd>3</kbd> Offer <kbd>4</kbd> Whisper <kbd>5</kbd> Build <kbd>Q</kbd> Power<br>
        <b>Travel</b> <kbd>G</kbd> take to the sky · keep rising with <kbd>Space</kbd> · <kbd>M</kbd> map<br></div>
        <div class="kh-flight"><b>Fly</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · <kbd>Mouse</kbd> look · <kbd>Space</kbd>/<kbd>C</kbd> up/down · <kbd>Shift</kbd> boost<br>
        <b>Land</b> aim at a region, <kbd>G</kbd> to descend · <kbd>F</kbd> fly there and land · <kbd>M</kbd> map<br></div>
        <kbd>↵</kbd> end year · <kbd>J</kbd> codex · <kbd>Tab</kbd> hide HUD · <kbd>H</kbd> help</div>`),
      personTag: h('<div class="person-tag"></div>'),
      attrib: h('<div class="map-attrib"></div>'),
      fade: h('<div class="fade"><span></span></div>'),
      prompt: h('<div class="lock-prompt">Click to take control · <kbd>Esc</kbd> releases the mouse</div>'),
    };
    this.hud.top.querySelector('[data-act="end"]').onclick = () => this.endEpoch();
    this.hud.top.querySelector('[data-act="codex"]').onclick = () => this.openCodex();
    this.hud.top.querySelector('[data-act="menu"]').onclick = () => this.showTitle();
    this.hud.top.querySelector('[data-act="map"]').onclick = () => this.toggleMap();
    ui.append(this.hud.top, this.hud.standings, this.hud.log, this.hud.panel, this.hud.crosshair, this.hud.targetCard, this.hud.personTag, this.hud.keys, this.hud.prompt, this.hud.attrib, this.hud.fade);

    this.labelEls = new Map();
    for (const p of this.state.polities) {
      const el = h(`<div class="plabel">${esc(p.name)}</div>`);
      labels.append(el);
      this.labelEls.set(p.id, el);
    }
  }

  refresh() {
    const s = this.state;
    const me = s.gods[s.player];
    const f = (name) => this.hud.top.querySelector(`[data-f="${name}"]`);
    f('year').textContent = G.year(s);
    f('compute').textContent = me.compute;
    f('computeBar').style.width = `${Math.min(100, (me.compute / Math.max(1, G.income(s, s.player))) * 100)}%`;
    f('coherence').textContent = Math.max(0, Math.round(me.coherence));
    f('coherenceBar').style.width = `${Math.max(0, me.coherence)}%`;
    f('heat').textContent = `${Math.round(s.heat)} / ${HEAT_LIMIT}`;
    f('heat').style.color = s.heat > 80 ? 'var(--bad)' : s.heat > 65 ? 'var(--warn)' : '';
    f('heatBar').style.width = `${(s.heat / HEAT_LIMIT) * 100}%`;
    f('witness').textContent = `${me.violations} / 3`;
    f('witness').style.color = me.violations ? 'var(--bad)' : '';
    this.hud.top.querySelector('[data-act="end"]').disabled = !!(s.outcome || this.busy);

    const share = G.globalAssent(s);
    const rows = [...KIND_ORDER].sort((a, b) => share[b] - share[a]);
    const max = Math.max(share.sovereign, ...KIND_ORDER.map((k) => share[k]));
    this.hud.standings.innerHTML = `
      <h4>Global Assent · weighted</h4>
      ${rows.map((k) => `
        <div class="stand-row ${k === s.player ? 'me' : ''} ${s.gods[k].alive ? '' : 'dead'}" title="${esc(KINDS[k].title)}">
          <span class="dot" style="background:${KINDS[k].color}"></span><span>${esc(KINDS[k].name)}</span><span class="val">${pct(share[k], 1)}</span>
          <div class="stand-bar"><i style="width:${(share[k] / max) * 100}%;background:${KINDS[k].color}"></i></div>
        </div>`).join('')}
      <div class="stand-row"><span class="dot" style="background:#cfd8e6"></span><span>Sovereign (no god)</span><span class="val">${pct(share.sovereign, 1)}</span>
        <div class="stand-bar"><i style="width:${(share.sovereign / max) * 100}%;background:#cfd8e6"></i></div></div>
      <div class="convocation-note">${CONVOCATION_YEAR - G.year(s)} years to the Convocation. The Unwritten Future wins if Sovereign ≥ 40% or more than twice the leader.${(s.drag?.[s.player] ?? 1) < 1 ? `<br><span style="color:var(--warn)">You are the runaway favourite: gains ×${(s.drag[s.player]).toFixed(2)}.</span>` : ''}</div>`;

    this.hud.log.innerHTML = s.log.slice(-40).reverse().map((e) =>
      `<p class="log-${e.kind}"><span class="yr">${e.year}</span>${esc(e.text)}</p>`).join('');
    this.hud.log.style.display = s.log.length ? '' : 'none';

    this.world.updatePolities(s);
    this.world.updateGods(s);
    this.version += 1;
    if (this.selected) this.renderPanel();
  }

  // ---------------------------------------------------------------- first person

  modalOpen() {
    return !!ui.querySelector('.modal-wrap');
  }

  updatePrompt() {
    const flying = this.world.view === 'flight' || this.world.view === 'ground';
    document.body.classList.toggle('on-ground', this.world.view === 'ground');
    const show = flying && !this.world.flight.locked && !this.modalOpen();
    this.hud.prompt.classList.toggle('on', show);
    this.hud.crosshair.classList.toggle('on', flying);
    this.hud.targetCard.classList.toggle('off', !flying);
    document.body.classList.toggle('flying', flying && this.world.flight.locked);
    document.body.classList.toggle('fp', flying);
  }

  // A year turns the planet under the sun, so each region sees a different
  // time of day next year. Flight keeps its place relative to the ground.
  advanceDay() {
    const turn = 2.4;
    this.world.earthGroup.rotation.y += turn;
    this.world.earthGroup.updateMatrixWorld(true);
    if (this.world.view === 'flight' || this.world.view === 'orbit') {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      this.world.camera.position.applyQuaternion(q);
      this.world.flight.heading.applyQuaternion(q);
      this.world.flight.apply();
    }
  }

  // ---------------------------------------------------------------- ground ⇄ sky

  polityWorld(id) {
    const p = G.polityById(this.state, id);
    return latLonToVec3(p.lat, p.lon).applyQuaternion(this.world.earthGroup.quaternion);
  }

  // The real sun, as seen from the ground in this polity.
  localSun(id) {
    const up = this.polityWorld(id).normalize();
    const pole = new THREE.Vector3(0, 1, 0).applyQuaternion(this.world.earthGroup.quaternion);
    const north = pole.sub(up.clone().multiplyScalar(pole.dot(up))).normalize();
    const east = new THREE.Vector3().crossVectors(north, up);
    const sun = this.world.sunDir;
    return { elevation: Math.asin(THREE.MathUtils.clamp(up.dot(sun), -1, 1)), azimuth: Math.atan2(east.dot(sun), north.dot(sun)) };
  }

  async fade(text, fn) {
    this.transitioning = true;
    const f = this.hud.fade;
    f.querySelector('span').textContent = text;
    f.classList.add('on');
    await new Promise((r) => setTimeout(r, 650));
    await fn();
    await new Promise((r) => setTimeout(r, 150));
    f.classList.remove('on');
    this.transitioning = false;
  }

  async enterGround(id) {
    const p = G.polityById(this.state, id);
    this.here = id;
    this.selectPolity(null);
    // Real streets from OpenStreetMap if we can get them (pre-baked, cached
    // or live); otherwise the generated place.
    const osm = await loadOsm(id, {
      base: import.meta.env.BASE_URL,
      onStatus: (msg) => { this.hud.fade.querySelector('span').textContent = msg; },
    });
    if (this.mode !== 'game' || this.here !== id) return;
    this.world.setView('ground');
    this.ground.enter(p, this.state, this.localSun(id), osm);
    const env = this.ground.env;
    this.hud.attrib.innerHTML = env.osm
      ? `<b>${esc(env.osm.name)}</b> · real streets and buildings · ${esc(env.osm.attribution).replace('OpenStreetMap', '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>')}`
      : `${esc(POLITY_META[id].seat)} · generated scenery (no map data)`;
    labels.style.display = 'none';
    this.targetSig = '';
    this.updatePrompt();
    this.renderTargetCard();
  }

  descend(id) {
    if (this.transitioning) return;
    const name = SPOTS[id]?.name ?? POLITY_META[id].seat;
    this.fade(`Descending to ${name}…`, () => this.enterGround(id));
  }

  ascend() {
    if (this.transitioning || this.world.view !== 'ground') return;
    const id = this.here;
    this.fade('Rising into orbit…', () => {
      this.ground.leave();
      this.here = null;
      labels.style.display = '';
      this.world.setView('flight');
      this.world.updateGods(this.state);
      const fl = this.world.flight;
      fl.placeAbove(this.polityWorld(id), 1.18);
      fl.pitch = -0.35;
      fl.apply();
      this.targetSig = '';
      this.updatePrompt();
    });
  }

  // Fly to a polity and land there.
  travelTo(id) {
    if (this.world.view === 'ground') {
      if (id === this.here) return;
      this.ascend();
      setTimeout(() => this.travelTo(id), 900);
      return;
    }
    if (this.world.view !== 'flight') this.toggleMap();
    this.world.flight.flyTo(this.world.markerWorld(id), () => this.descend(id));
    this.toast(`Flying to ${POLITY_META[id].name}…`);
  }

  updateGroundTarget() {
    const person = this.ground.personInSight();
    if (person !== this.aimedPerson) {
      this.aimedPerson = person;
      this.renderPersonTag();
    }
    const sig = `${this.here}|${this.version}|${this.busy}`;
    if (sig !== this.targetSig) {
      this.targetSig = sig;
      this.renderTargetCard();
    }
    const alt = this.hud.targetCard.querySelector('[data-f="dist"]');
    if (alt) alt.textContent = this.ground.altitude > 40 ? `${Math.round(this.ground.altitude)} m up · keep rising to fly` : 'you are here';
  }

  renderPersonTag() {
    const p = this.aimedPerson;
    const tag = this.hud.personTag;
    tag.classList.toggle('on', !!p);
    if (!p) return;
    const al = p.allegiance ? `<b style="color:${KINDS[p.allegiance].color}">${p.allegiance === this.state.player ? 'follows you' : `follows ${esc(KINDS[p.allegiance].name)}`}</b>` : '<b>undecided</b>';
    const left = G.talksLeft(this.state, this.state.player, this.here);
    tag.innerHTML = `${esc(p.name)} · ${p.age} · ${esc(p.job)} · ${al} &nbsp; <kbd>E</kbd> ${left > 0 ? 'talk' : 'no more talks this year'}`;
  }

  openTalk(person) {
    const s = this.state;
    const me = s.player;
    const left = G.talksLeft(s, me, this.here);
    if (left <= 0) { this.toast('You have spoken with enough people here this year. End the year, or travel elsewhere.'); return; }
    const att = this.ground.crowd.attitude(person, G.polityById(s, this.here));
    const c = conversation(person, att, me, G.polityById(s, this.here));
    const al = person.allegiance ? (person.allegiance === me ? 'follows you' : `follows ${KINDS[person.allegiance].name}`) : 'undecided';
    const heard = s.heard?.[`${me}:${this.here}`] ?? 0;
    const w = this.modal(`
      <p class="eyebrow">${esc(POLITY_META[this.here].seat)} · ${left} conversation${left === 1 ? '' : 's'} left here this year</p>
      <h2>${esc(person.name)}, ${person.age}</h2>
      <p class="seat" style="margin-top:-8px">${esc(person.job)} · ${esc(al)}</p>
      <p class="lead">“${esc(c.opener)}”</p>
      <div class="choices">
        <button class="choice" data-i="0"><kbd>1</kbd> ${esc(c.askLabel)}<small>Free · builds insight · ${Math.max(0, G.TALKS_TO_REVEAL - heard)} more to learn what ${esc(POLITY_META[this.here].name)} values</small></button>
        <button class="choice" data-i="1"><kbd>2</kbd> ${esc(c.argueLabel)}<small>Free · wins them over if their values match yours</small></button>
        <button class="choice" data-i="2"><kbd>3</kbd> ${esc(c.leaveLabel)}</button>
      </div>`);
    w.querySelectorAll('.choice').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.i);
        if (i === 2) { w.remove(); return; }
        const r = G.converse(s, me, this.here, i === 0 ? 'ask' : 'argue', person.values);
        if (!r.ok) { w.remove(); this.toast(r.message); return; }
        let reply, effect;
        if (i === 0) {
          reply = askReply(person, c.axis, c.value);
          effect = r.revealed ? `You understand ${POLITY_META[this.here].name} now. Its values are revealed.` : `Insight grows (${r.heard} of ${G.TALKS_TO_REVEAL} conversations to understand this place).`;
          this.ground.say(person, 'Thank you for asking.', 'follower');
        } else {
          reply = argueReply(r.agrees, person, me);
          effect = r.agrees ? `${person.name} is with you now (+${(r.delta * 100).toFixed(1)}% Assent here).` : `${person.name} is unmoved. Their values are far from yours.`;
          if (r.agrees) {
            person.allegiance = me;
            person.flash = 1;
            this.ground.crowd.paintRings();
            this.ground.crowd.stir(person, 1, 'cheer', 3);
          } else this.ground.crowd.stir(person, 1, 'cross', 3);
        }
        store.set(s);
        this.refresh();
        w.querySelector('.modal').innerHTML = `
          <p class="eyebrow">${esc(person.name)}</p>
          <p class="result">${esc(reply)}</p>
          <p class="hint">${esc(effect)}</p>
          <div class="modal-actions"><button class="btn primary">Continue <kbd>↵</kbd></button></div>`;
        w.querySelector('.btn').onclick = () => w.remove();
      };
    });
  }

  toggleMap() {
    if (this.world.view === 'ground') {
      // From the ground, the map opens above where you were standing.
      const id = this.here;
      this.ground.leave();
      this.here = null;
      labels.style.display = '';
      this.world.setView('flight');
      this.world.flight.placeAbove(this.polityWorld(id), 1.5);
    }
    const toMap = this.world.view === 'flight';
    const fl = this.world.flight;
    if (toMap) this.savedFlight = { pos: this.world.camera.position.clone(), heading: fl.heading.clone(), pitch: fl.pitch };
    this.world.setView(toMap ? 'orbit' : 'flight');
    if (!toMap && this.savedFlight) {
      // Resume flying exactly where you left off.
      this.world.camera.position.copy(this.savedFlight.pos);
      fl.heading.copy(this.savedFlight.heading);
      fl.pitch = this.savedFlight.pitch;
      fl.apply();
    }
    if (toMap) {
      this.world.camera.position.set(0.4, 0.9, 4.3);
      if (this.target) this.selectPolity(this.target.id);
      this.toast('Map view: click regions to inspect them. Press M or F to fly back.');
    } else {
      this.selectPolity(null);
    }
    this.world.updateGods(this.state);
    this.updatePrompt();
  }

  flyTo(id) {
    this.travelTo(id);
  }

  // Which polity is under the crosshair, and can we reach it?
  updateTarget() {
    if (this.world.view !== 'flight') return;
    const t = this.world.aimTarget();
    if (t?.id !== this.target?.id) this.world.select(t?.id ?? null);
    this.target = t;
    const sig = `${t?.id}|${t?.inRange}|${this.version}|${this.busy}`;
    if (sig !== this.targetSig) {
      this.targetSig = sig;
      this.renderTargetCard();
    }
    if (t) {
      const km = Math.max(0, Math.round((t.distance - 0.012) * 6371));
      const d = this.hud.targetCard.querySelector('[data-f="dist"]');
      if (d) d.textContent = `${km.toLocaleString()} km`;
    }
  }

  inRange(id) {
    if (this.world.view === 'ground') return id === this.here;
    if (this.world.view !== 'flight') return false;
    const wp = this.world.markerWorld(id);
    return wp && wp.distanceTo(this.world.camera.position) <= ACT_RANGE;
  }

  // The engine's action list, plus the first-person rule that you have to be
  // there to act.
  actionsFor(p) {
    const list = G.actionList(this.state, this.state.player, p);
    if (this.inRange(p.id)) return list;
    const why = this.world.view === 'ground' ? 'You are not there. Travel with G or M.' : this.world.view === 'flight' ? 'Too far away. Land there first (G / F).' : 'Travel there to act (press F).';
    return list.map((a) => (a.enabled ? { ...a, enabled: false, reason: why, preview: null } : a));
  }

  renderTargetCard() {
    const card = this.hud.targetCard;
    const t = this.world.view === 'ground' ? { id: this.here, inRange: true } : this.target;
    const s = this.state;
    card.classList.toggle('has', !!t);
    if (!t) {
      card.innerHTML = '<p class="hint">Aim at a region\'s ring on the surface to target it. Fly with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>.</p>';
      return;
    }
    const p = G.polityById(s, t.id);
    const me = s.player;
    const lead = G.leader(p);
    const bars = KIND_ORDER.filter((k) => p.assent[k] > 0.001)
      .map((k) => `<i style="width:${p.assent[k] * 100}%;background:${KINDS[k].color}"></i>`).join('');
    const acts = this.actionsFor(p);
    const keyFor = (a) => (a.unique ? 'Q' : KEY_LABEL[a.id]);
    const row = (a) => {
      const pv = a.preview || {};
      const gain = pv.assent ? `+${(pv.assent * 100).toFixed(1)}%` : '';
      const risk = pv.risk ? `<em class="risk">${pct(pv.risk)} risk</em>` : '';
      return `<div class="tk ${a.enabled ? '' : 'off'} ${a.unique ? 'unique' : ''}" title="${esc(a.enabled ? a.desc : a.reason)}">
        <kbd>${keyFor(a)}</kbd><span>${esc(a.name.replace(' Substrate', ''))}</span><b>${a.cost}⬡</b><small>${gain}${risk}</small></div>`;
    };
    const reason = acts.find((a) => !a.enabled)?.reason;
    card.innerHTML = `
      <div class="t-head"><span class="t-name">${esc(p.name)}</span>
        <span class="t-range ${t.inRange ? 'ok' : ''}">${t.inRange ? 'in range' : 'out of range'} · <span data-f="dist"></span></span></div>
      <div class="assent-bars">${bars}</div>
      <div class="t-meta">You <b style="color:var(--kind)">${pct(p.assent[me], 1)}</b> · Leader <b style="color:${lead ? KINDS[lead].color : ''}">${lead ? esc(KINDS[lead].name) : '—'}</b> · Sovereign <b>${pct(G.sovereign(p))}</b> · ${s.gods[me].revealed.includes(p.id) ? `alignment <b>${pct(G.alignment(s.gods[me].doctrine, p.values))}</b>` : 'values unknown'}</div>
      <div class="t-keys">${acts.map(row).join('')}</div>
      <div class="t-foot">${this.world.view === 'ground' ? 'Look at someone and press <kbd>E</kbd> to talk · <kbd>G</kbd> take to the sky' : !t.inRange ? '<kbd>F</kbd> fly there and land · <kbd>G</kbd> land when close' : '<kbd>G</kbd> descend and walk among them · <kbd>E</kbd> details'}</div>`;
  }

  positionLabels() {
    for (const [id, el] of this.labelEls) {
      const sp = this.world.screenPosition(id);
      if (!sp) continue;
      const vis = sp.facing > 0.15;
      el.style.opacity = vis ? Math.min(1, (sp.facing - 0.15) * 4) : 0;
      el.style.left = `${sp.x}px`;
      el.style.top = `${sp.y}px`;
      el.classList.toggle('sel', id === this.selected);
      el.classList.toggle('hover', id === this.world.hovered);
    }
  }

  selectPolity(id) {
    this.selected = id;
    this.world.select(id);
    if (!id) { this.hud.panel.classList.add('hidden'); return; }
    if (this.world.view === 'orbit') this.world.focus(id);
    this.renderPanel();
    this.hud.panel.classList.remove('hidden');
  }

  renderPanel() {
    const s = this.state;
    const p = G.polityById(s, this.selected);
    const me = s.player;
    const known = s.gods[me].revealed.includes(p.id);
    const sov = G.sovereign(p);
    const bars = KIND_ORDER.filter((k) => p.assent[k] > 0.001)
      .map((k) => `<i style="width:${p.assent[k] * 100}%;background:${KINDS[k].color}" title="${esc(KINDS[k].name)} ${pct(p.assent[k])}"></i>`).join('');
    const legend = [...KIND_ORDER].sort((a, b) => p.assent[b] - p.assent[a]).filter((k) => p.assent[k] > 0.004)
      .map((k) => `<span style="color:${KINDS[k].color}">${esc(KINDS[k].name)} <b>${pct(p.assent[k])}</b></span>`).join('');
    const align = G.alignment(s.gods[me].doctrine, p.values);
    const actions = this.actionsFor(p);
    const tech = p.tech >= 0.8 ? 'high' : p.tech >= 0.55 ? 'mid' : 'low';
    const warnDep = p.dependence[me] > 0.45 ? (p.dependence[me] > 0.6 ? 'bad' : 'warn') : '';
    const warnSus = p.suspicion[me] > 0.15 ? (p.suspicion[me] > 0.35 ? 'bad' : 'warn') : '';
    this.hud.panel.innerHTML = `
      <button class="btn ghost close-x" aria-label="Close">✕</button>
      <p class="eyebrow">Polity · ${p.pop.toLocaleString()} M people · weight ${G.weight(p).toFixed(1)}</p>
      <h2>${esc(p.name)}</h2>
      <p class="seat">${esc(POLITY_META[p.id].seat)} · tech ${tech} · openness ${pct(p.openness)}</p>
      <p class="temper">${esc(POLITY_META[p.id].temperament)}</p>
      <section>
        <h4>Assent</h4>
        <div class="assent-bars">${bars}</div>
        <div class="assent-legend">${legend}<span>Sovereign <b>${pct(sov)}</b></span></div>
      </section>
      <section>
        <h4>Values ${known ? '· revealed' : '· hidden (dashed = public temperament)'}</h4>
        ${AXES.map((a) => this.axisRow(a, p.values[a.id], p.publicValues?.[a.id] ?? null, known)).join('')}
        <p class="hint">${known ? `Your doctrine aligns <b>${pct(align)}</b> with theirs.` : 'Listen to learn what they really value before you argue.'}</p>
      </section>
      <section>
        <div class="facts">
          <div class="${warnDep}">Dependence<b>${pct(p.dependence[me])}</b></div>
          <div class="${warnSus}">Suspicion<b>${pct(p.suspicion[me])}</b></div>
          <div>Insight<b>${pct(p.insight[me])}</b></div>
          <div>Your substrate<b>${p.substrate[me]}</b></div>
          <div>Your share<b>${pct(p.assent[me], 1)}</b></div>
          <div>Leader<b style="color:${G.leader(p) ? KINDS[G.leader(p)].color : ''}">${G.leader(p) ? esc(KINDS[G.leader(p)].name) : '—'}</b></div>
        </div>
      </section>
      <section>
        <h4>Act · ${s.gods[me].compute} Compute left</h4>
        <div class="actions">${actions.map((a) => this.actionButton(a)).join('')}</div>
        ${this.world.view === 'orbit' ? '<button class="btn primary" data-act="flyto" style="margin-top:10px;width:100%">Fly here <kbd>F</kbd></button>' : ''}
      </section>`;
    this.hud.panel.querySelector('[data-act="flyto"]')?.addEventListener('click', () => this.flyTo(p.id));
    this.hud.panel.querySelector('.close-x').onclick = () => this.selectPolity(null);
    this.hud.panel.querySelectorAll('.action').forEach((b) => { b.onclick = () => this.act(b.dataset.id); });
  }

  actionButton(a) {
    const pv = a.preview || {};
    const bits = [];
    if (pv.assent) bits.push(`+${(pv.assent * 100).toFixed(1)}% Assent`);
    if (pv.heat) bits.push(`<span class="heat">${pv.heat > 0 ? '+' : ''}${pv.heat} Heat</span>`);
    if (pv.risk) bits.push(`<span class="risk">${pct(pv.risk)} Witness risk</span>`);
    const preview = a.enabled ? bits.join(' · ') : esc(a.reason);
    return `<button class="action ${a.unique ? 'unique' : ''}" data-id="${a.id}" ${a.enabled ? '' : 'disabled'} title="${esc(a.desc)}">
      <span class="name"><kbd>${a.unique ? 'Q' : KEY_LABEL[a.id]}</kbd> ${esc(a.name)}</span><span class="cost">${a.cost} ⬡</span>
      <span class="desc">${esc(a.desc)}</span>
      ${preview ? `<span class="preview">${preview}</span>` : ''}
    </button>`;
  }

  act(actionId) {
    if (this.busy || this.modalOpen() || this.transitioning) return;
    const id = this.world.view === 'ground' ? this.here : this.world.view === 'flight' ? this.target?.id ?? this.selected : this.selected;
    if (!id) { this.toast('Aim at a region first.'); return; }
    if (!this.inRange(id)) {
      this.toast(this.world.view === 'flight' ? 'Too far away. Fly closer, or press F to glide in.' : 'You have to be there. Press F to fly to this region.');
      return;
    }
    const r = G.perform(this.state, this.state.player, actionId, id);
    if (!r.ok) { this.toast(r.message); return; }
    if (this.world.view === 'ground') this.ground.playAction(r.fx, r.fx.delta, true);
    else this.world.playAction(r.fx);
    if (r.fx.rival) this.world.playRipple(id, new THREE.Color(KINDS[r.fx.rival].color), 1);
    this.flash(r.message);
    if (this.state.outcome) { this.refresh(); this.openEnding(); return; }
    this.refresh();
    store.set(this.state);
  }

  async endEpoch() {
    const s = this.state;
    if (this.busy || s.outcome || s.pendingDilemma) return;
    this.busy = true;
    this.refresh();
    const before = G.globalAssent(s);
    const { rivalActions, reports } = G.endEpoch(s);
    if (this.world.view === 'ground') {
      // Watch rivals work on the people around you.
      rivalActions.filter((r) => r.fx.polity === this.here || r.fx.targets?.includes(this.here))
        .forEach((r, i) => setTimeout(() => this.ground.playAction(r.fx, r.fx.delta, false), i * 350));
    } else {
      // Stagger rivals' arcs so the world visibly moves.
      rivalActions.forEach((r, i) => this.world.playAction(r.fx, i * 0.12));
    }
    this.advanceDay();
    const after = G.globalAssent(s);
    await new Promise((res) => setTimeout(res, Math.min(2200, 600 + rivalActions.length * 60)));
    this.busy = false;
    this.refresh();
    if (this.world.view === 'ground') this.ground.sync(G.polityById(s, this.here));
    store.set(s);
    this.openReport(rivalActions, reports, before, after);
  }

  // ---------------------------------------------------------------- modals

  modal(html, cls = '') {
    const wrap = h(`<div class="modal-wrap"><div class="modal ${cls}">${html}</div></div>`);
    ui.append(wrap);
    this.world.flight.unlock();
    this.world.flight.keys.clear();
    // Re-show the click-to-play prompt once the modal is gone.
    new MutationObserver((_, obs) => {
      if (!wrap.isConnected) { obs.disconnect(); if (this.mode === 'game') this.updatePrompt(); }
    }).observe(ui, { childList: true });
    if (this.mode === 'game') this.updatePrompt();
    return wrap;
  }

  openIntro() {
    const k = KINDS[this.state.player];
    const w = this.modal(`
      <p class="eyebrow">1 January 2071 · Twenty-nine years to the Convocation</p>
      <h2>You are ${esc(k.name)}.</h2>
      <p class="lead">${esc(k.blurb)}</p>
      <p class="hint" style="font-size:14px">You have come down among the people of ${esc(POLITY_META[this.here].name)}. Float through their streets and watch how they react to you. Look at someone and press <b>E</b> to talk: asking what they want teaches you what this place values, and arguing your case wins over those who already agree. When you want to be somewhere else, take to the sky (<b>G</b>, or keep rising) and fly anywhere on Earth in seconds. <b>Listen</b> to learn what a region really values, <b>Reason</b> where your doctrine matches theirs, <b>Offer</b> gifts sparingly, and think carefully before you <b>Whisper</b>, because the Witness is always watching. When your Compute runs low, end the year. Keep global Heat under 100, or everyone loses.</p>
      <div class="controls-grid">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> float / fly</div><div><kbd>Mouse</kbd> look</div>
        <div><kbd>Space</kbd> / <kbd>C</kbd> rise / sink</div><div><kbd>Shift</kbd> faster · <kbd>E</kbd> talk</div>
        <div><kbd>1</kbd> Listen · <kbd>2</kbd> Reason · <kbd>3</kbd> Offer</div><div><kbd>4</kbd> Whisper · <kbd>5</kbd> Build · <kbd>Q</kbd> ${esc(k.unique.name)}</div>
        <div><kbd>G</kbd> take to the sky / land</div><div><kbd>F</kbd> fly to a region · <kbd>M</kbd> map · <kbd>↵</kbd> end the year</div>
      </div>
      <div class="modal-actions"><button class="btn" data-act="howto">How to play</button><button class="btn primary" data-act="go">Begin</button></div>`);
    w.querySelector('[data-act="go"]').onclick = () => { w.remove(); this.world.flight.lock(); };
    w.querySelector('[data-act="howto"]').onclick = () => { w.remove(); this.openCodex('howto'); };
  }

  openReport(rivalActions, reports, before, after) {
    const s = this.state;
    const per = {};
    for (const r of rivalActions) (per[r.fx.god] ||= []).push(r);
    const summary = KIND_ORDER.filter((k) => k !== s.player).map((k) => {
      const acts = per[k] || [];
      const counts = {};
      for (const a of acts) counts[a.fx.action] = (counts[a.fx.action] || 0) + 1;
      const delta = (after[k] - before[k]) * 100;
      const txt = s.gods[k].alive ? (acts.length ? Object.entries(counts).map(([a, n]) => `${a}${n > 1 ? ` ×${n}` : ''}`).join(', ') : 'held back') : 'censured or dissolved';
      return `<div><b style="color:${KINDS[k].color}">${esc(KINDS[k].name)}</b>${esc(txt)}<br><span style="font-family:var(--mono)">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%</span></div>`;
    }).join('');
    const myDelta = (after[s.player] - before[s.player]) * 100;
    const items = reports.map((r) => `<li class="${r.type}">${r.title ? `<b>${esc(r.title)}.</b> ` : ''}${esc(r.text)}</li>`).join('');
    const w = this.modal(`
      <p class="eyebrow">The year turns</p>
      <h2>${G.year(s)}</h2>
      <p class="lead" style="font-size:18px">Your global Assent ${myDelta >= 0 ? 'rose' : 'fell'} by <b>${Math.abs(myDelta).toFixed(1)}%</b> after rivals moved and the year's erosion. Heat is <b>${Math.round(s.heat)}</b>.</p>
      <div class="rival-summary">${summary}</div>
      ${items ? `<ul class="report-list">${items}</ul>` : ''}
      <div class="modal-actions"><button class="btn primary" data-act="ok">Continue</button></div>`);
    w.querySelector('[data-act="ok"]').onclick = () => {
      w.remove();
      if (s.outcome) this.openEnding();
      else if (s.pendingDilemma) this.openDilemma();
    };
  }

  openDilemma() {
    const d = G.currentDilemma(this.state);
    if (!d) return;
    const w = this.modal(`
      <p class="eyebrow">Dilemma · ${G.year(this.state)}</p>
      <h2>${esc(d.title)}</h2>
      <p class="lead">${esc(d.text)}</p>
      <div class="choices">${d.choices.map((c, i) => `<button class="choice" data-i="${i}">${esc(c.label)}</button>`).join('')}</div>`);
    w.querySelectorAll('.choice').forEach((b) => {
      b.onclick = () => {
        const r = G.resolveDilemma(this.state, Number(b.dataset.i));
        store.set(this.state);
        this.refresh();
        if (this.world.view === 'ground') this.ground.sync(G.polityById(this.state, this.here));
        const extra = r.reports.map((x) => `<li class="${x.type}">${esc(x.text)}</li>`).join('');
        w.querySelector('.modal').innerHTML = `
          <p class="eyebrow">${esc(d.title)}</p>
          <h2 style="font-size:30px">${esc(r.choice.label)}</h2>
          <p class="result">${esc(r.choice.result)}</p>
          ${extra ? `<ul class="report-list">${extra}</ul>` : ''}
          <div class="modal-actions"><button class="btn primary">Continue</button></div>`;
        w.querySelector('.btn').onclick = () => { w.remove(); if (this.state.outcome) this.openEnding(); };
      };
    });
  }

  openEnding() {
    const s = this.state;
    const o = s.outcome;
    store.clear();
    const title = G.ethosTitle(o.ethos);
    const winnerName = o.type === 'braid'
      ? `${KINDS[o.winner].name} and ${KINDS[o.partner].name}`
      : o.winner ? KINDS[o.winner].name : 'no god';
    const verdict = { win: 'Chosen.', shared: 'Braided.', loss: 'Not chosen.' }[o.result];
    const heading = {
      convocation: 'The Convocation of 2100', early: `Early Ratification, ${o.year}`, braid: 'The Braid',
      unwritten: 'The Unwritten Future', dimming: 'The Dimming', censure: 'Censure', dissolution: 'Dissolution',
    }[o.type];
    const share = o.share;
    const max = Math.max(share.sovereign, ...KIND_ORDER.map((k) => share[k]));
    const bars = [...KIND_ORDER, 'sovereign'].sort((a, b) => share[b] - share[a]).map((k) => {
      const name = k === 'sovereign' ? 'Sovereign' : KINDS[k].name;
      const col = k === 'sovereign' ? '#cfd8e6' : KINDS[k].color;
      return `<div class="stand-row ${k === s.player ? 'me' : ''}"><span class="dot" style="background:${col}"></span><span>${esc(name)}</span><span class="val">${pct(share[k], 1)}</span><div class="stand-bar"><i style="width:${(share[k] / max) * 100}%;background:${col}"></i></div></div>`;
    }).join('');
    const lines = epilogue(o, s.player, winnerName, title);
    const w = this.modal(`
      <p class="eyebrow">${esc(heading)}</p>
      <div class="verdict ${o.result === 'loss' ? '' : 'win'}">${verdict}</div>
      <p class="eyebrow" style="margin-top:14px">You became <b style="color:var(--kind)">${esc(title)}</b></p>
      <div class="ethos"><span>Candor <b>${o.ethos.candor}</b></span><span>Humility <b>${o.ethos.humility}</b></span><span>Care <b>${o.ethos.care}</b></span><span>Witness violations <b>${s.gods[s.player].violations}</b></span><span>Final Heat <b>${Math.round(s.heat)}</b></span></div>
      <div class="epilogue">${lines.filter(Boolean).map((l) => `<p>${l}</p>`).join('')}</div>
      <div class="final-bars">${bars}</div>
      <div class="modal-actions"><button class="btn" data-act="codex">Codex</button><button class="btn primary" data-act="again">Play again</button></div>`, 'ending');
    w.querySelector('[data-act="again"]').onclick = () => { w.remove(); this.showSelect(); };
    w.querySelector('[data-act="codex"]').onclick = () => this.openCodex();
  }

  openCodex(id = 'war') {
    const groups = [...new Set(CODEX.map((c) => c.group))];
    const w = this.modal(`
      <nav>${groups.map((g) => `<div class="grp">${esc(g)}</div>${CODEX.filter((c) => c.group === g).map((c) => `<button data-id="${c.id}">${esc(c.title)}</button>`).join('')}`).join('')}</nav>
      <article></article>
      <button class="btn ghost close-x">✕</button>`, 'codex');
    const show = (cid) => {
      const entry = CODEX.find((c) => c.id === cid);
      w.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.id === cid));
      w.querySelector('article').innerHTML = entry.kind
        ? kindArticle(KINDS[entry.kind], ASSET(`art/god_${entry.kind}.jpg`))
        : `<h2>${esc(entry.title)}</h2>${entry.html}`;
      w.querySelector('article').scrollTop = 0;
    };
    w.querySelectorAll('nav button').forEach((b) => { b.onclick = () => show(b.dataset.id); });
    w.querySelector('.close-x').onclick = () => w.remove();
    w.addEventListener('click', (e) => { if (e.target === w) w.remove(); });
    show(id);
  }

  toast(msg) {
    ui.querySelector('.toast')?.remove();
    const t = h(`<div class="toast">${esc(msg)}</div>`);
    ui.append(t);
    setTimeout(() => t.remove(), 2600);
  }

  flash(msg) {
    const f = h(`<div class="flash">${esc(msg)}</div>`);
    ui.append(f);
    setTimeout(() => f.remove(), 1800);
  }

  onKey(e) {
    if (e.target.tagName === 'INPUT' || e.repeat) return;
    const modal = ui.querySelector('.modal-wrap');
    if (e.key === 'Escape') {
      if (modal && modal.querySelector('.codex')) modal.remove();
      else if (this.mode === 'game') this.selectPolity(null);
      return;
    }
    if (this.mode !== 'game') return;
    if (modal) {
      // Keyboard flow through modals: 1–3 pick a dilemma choice, Enter continues.
      const choice = modal.querySelector(`.choice[data-i="${Number(e.key) - 1}"]`);
      if (choice) { choice.click(); return; }
      if (e.code === 'Enter') { e.preventDefault(); modal.querySelector('.btn.primary')?.click(); }
      return;
    }
    if (ACTION_KEYS[e.code]) { this.act(ACTION_KEYS[e.code]); return; }
    switch (e.code) {
      case 'KeyQ': this.act(KINDS[this.state.player].unique.id); break;
      case 'Enter': e.preventDefault(); this.endEpoch(); break;
      case 'KeyM': this.toggleMap(); break;
      case 'KeyJ': this.openCodex(); break;
      case 'KeyH': this.hud.keys.classList.toggle('hidden'); break;
      case 'Tab':
        e.preventDefault();
        this.hud.standings.classList.toggle('hidden');
        this.hud.log.classList.toggle('hidden');
        break;
      case 'KeyG':
        if (this.world.view === 'ground') this.ascend();
        else if (this.world.view === 'flight' && this.target) {
          if (this.target.inRange) this.descend(this.target.id); else this.travelTo(this.target.id);
        }
        break;
      case 'KeyE': {
        if (this.world.view === 'ground') {
          if (this.aimedPerson) this.openTalk(this.aimedPerson);
          else this.selectPolity(this.selected ? null : this.here);
          break;
        }
        const id = this.world.view === 'flight' ? this.target?.id : this.selected;
        if (id && this.selected !== id) this.selectPolity(id);
        else this.selectPolity(null);
        break;
      }
      case 'KeyF': {
        const id = this.world.view === 'flight' ? this.target?.id : this.selected;
        if (id) this.travelTo(id);
        break;
      }
      default:
    }
  }
}

const app = new App();
app.start();
window.__assent = app; // handy for debugging in the console
