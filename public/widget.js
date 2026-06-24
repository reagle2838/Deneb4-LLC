/*
 * Deneb4 staging feedback widget.
 * Drop into any staging site with:
 *   <script src="https://YOUR-DENEB4-DOMAIN/widget.js" data-deneb4-key="CLIENT_KEY" defer></script>
 * Renders a draggable, collapsible feedback bubble that posts back to the
 * Deneb4 Workspace. Self-contained: no dependencies, isolated in a shadow DOM.
 */
(function () {
  'use strict';

  var script =
    document.currentScript ||
    document.querySelector('script[data-deneb4-key]');
  if (!script) return;

  var KEY = script.getAttribute('data-deneb4-key');
  if (!KEY) return;

  var API;
  try {
    API = new URL(script.src).origin;
  } catch (e) {
    return;
  }

  var POS_KEY = 'deneb4fb_pos_' + KEY;
  var OPEN_KEY = 'deneb4fb_open_' + KEY;
  var SEEN_KEY = 'deneb4fb_seen_' + KEY;

  var state = {
    thread: [],
    canComment: false,
    project: '',
    loaded: false,
    open: localStorage.getItem(OPEN_KEY) === '1',
    showHistory: false,
    editingId: null,
  };

  // ---- DOM scaffold (shadow DOM for full style isolation) ----
  var host = document.createElement('div');
  host.id = 'deneb4-feedback-widget';
  host.style.cssText =
    'position:fixed;z-index:2147483000;right:24px;bottom:24px;left:auto;top:auto;';
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML =
    '<style>' +
    ':host,*{box-sizing:border-box;}' +
    '.wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}' +
    /* bubble */
    '.bubble{width:56px;height:56px;border-radius:50%;background:#006b8f;color:#fff;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.28);cursor:grab;display:flex;align-items:center;' +
    'justify-content:center;border:none;position:relative;touch-action:none;transition:transform .15s;}' +
    '.bubble:active{cursor:grabbing;}' +
    '.bubble:hover{transform:scale(1.05);}' +
    '.bubble svg{width:26px;height:26px;}' +
    '.dot{position:absolute;top:2px;right:2px;width:13px;height:13px;border-radius:50%;' +
    'background:#e40014;border:2px solid #fff;}' +
    /* panel */
    '.panel{width:340px;max-width:calc(100vw - 32px);max-height:min(560px,calc(100vh - 48px));' +
    'background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);' +
    'display:flex;flex-direction:column;overflow:hidden;border:1px solid #e2e8ec;}' +
    '.head{background:#006b8f;color:#fff;padding:12px 14px;display:flex;align-items:center;' +
    'gap:8px;cursor:grab;touch-action:none;}' +
    '.head:active{cursor:grabbing;}' +
    '.head .grip{font-size:16px;opacity:.7;line-height:1;}' +
    '.head .ttl{font-size:13px;font-weight:600;flex:1;line-height:1.3;}' +
    '.head .sub{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.75;}' +
    '.head button{background:none;border:none;color:#fff;cursor:pointer;font-size:18px;' +
    'line-height:1;padding:2px 4px;opacity:.85;}' +
    '.head button:hover{opacity:1;}' +
    '.body{padding:12px 14px;overflow-y:auto;flex:1;background:#f7f9fa;}' +
    '.note{font-size:11.5px;color:#5b6b73;margin:0 0 10px;line-height:1.5;}' +
    '.msg{border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12.5px;' +
    'border:1px solid #e2e8ec;line-height:1.5;color:#1f2d33;}' +
    '.msg.client{background:#eef6f9;}' +
    '.msg.deneb4{background:#fff;}' +
    '.meta{display:flex;align-items:center;gap:6px;margin-bottom:3px;}' +
    '.who{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#006b8f;}' +
    '.who.them{color:#8a989f;}' +
    '.badge{font-size:8.5px;letter-spacing:.08em;font-weight:700;padding:1px 5px;border-radius:4px;' +
    'background:rgba(22,163,74,.13);color:#16a34a;}' +
    '.page{font-size:10px;color:#8a989f;}' +
    '.when{font-size:10px;color:#8a989f;margin-left:auto;}' +
    '.txt{white-space:pre-wrap;margin:0;}' +
    '.acts{display:flex;gap:10px;margin-top:5px;}' +
    '.acts button{background:none;border:none;padding:0;cursor:pointer;font-size:10.5px;' +
    'letter-spacing:.04em;color:#8a989f;}' +
    '.acts button.del{color:#e40014;}' +
    '.histlink{background:none;border:none;cursor:pointer;font-size:11px;color:#8a989f;' +
    'padding:4px 0;letter-spacing:.04em;}' +
    '.foot{padding:10px 14px;border-top:1px solid #e8edef;background:#fff;}' +
    '.foot input,.foot textarea{width:100%;border:1px solid #cfdade;border-radius:7px;' +
    'padding:7px 9px;font-size:12.5px;font-family:inherit;margin-bottom:7px;color:#1f2d33;resize:vertical;}' +
    '.foot input:focus,.foot textarea:focus{outline:none;border-color:#006b8f;}' +
    '.send{width:100%;background:#006b8f;color:#fff;border:none;border-radius:7px;padding:9px;' +
    'font-size:12.5px;font-weight:600;cursor:pointer;}' +
    '.send:disabled{opacity:.5;cursor:default;}' +
    '.err{color:#e40014;font-size:11px;margin:0 0 7px;}' +
    '.closed{font-size:11.5px;color:#5b6b73;text-align:center;padding:4px 0;}' +
    '.hidden{display:none!important;}' +
    '</style>' +
    '<div class="wrap">' +
    '<button class="bubble" type="button" aria-label="Open feedback">' +
    '<span class="dot hidden"></span>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
    '</button>' +
    '<div class="panel hidden">' +
    '<div class="head">' +
    '<span class="grip">⠿</span>' +
    '<div class="ttl"><span class="sub">Feedback</span><br><span class="proj">Your project</span></div>' +
    '<button class="min" type="button" aria-label="Minimize">–</button>' +
    '</div>' +
    '<div class="body"></div>' +
    '<div class="foot"></div>' +
    '</div>' +
    '</div>';

  var bubble = root.querySelector('.bubble');
  var dot = root.querySelector('.dot');
  var panel = root.querySelector('.panel');
  var head = root.querySelector('.head');
  var minBtn = root.querySelector('.min');
  var bodyEl = root.querySelector('.body');
  var footEl = root.querySelector('.foot');
  var projEl = root.querySelector('.proj');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ---- networking ----
  function load() {
    fetch(API + '/api/widget?key=' + encodeURIComponent(KEY))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) return;
        state.thread = d.thread || [];
        state.canComment = !!d.canComment;
        state.project = d.projectName || '';
        state.loaded = true;
        projEl.textContent = state.project || 'Your project';
        refreshDot();
        if (state.open) renderPanel();
      })
      .catch(function () {});
  }

  function send(payload) {
    payload.key = KEY;
    return fetch(API + '/api/widget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); });
  }

  // ---- unread dot ----
  function latestThemDate() {
    var max = '';
    state.thread.forEach(function (m) {
      if (m.author === 'deneb4' && m.date > max) max = m.date;
    });
    return max;
  }
  function refreshDot() {
    var latest = latestThemDate();
    var seen = localStorage.getItem(SEEN_KEY) || '';
    if (latest && latest > seen && !state.open) dot.classList.remove('hidden');
    else dot.classList.add('hidden');
  }
  function markSeen() {
    var latest = latestThemDate();
    if (latest) localStorage.setItem(SEEN_KEY, latest);
    dot.classList.add('hidden');
  }

  // ---- rendering ----
  function msgHtml(m) {
    var mine = m.author === 'client';
    var editing = state.editingId === m.id;
    var canEdit = mine && state.canComment && !m.resolved;
    var h = '<div class="msg ' + (mine ? 'client' : 'deneb4') + '" data-id="' + esc(m.id) + '">';
    h += '<div class="meta">';
    h += '<span class="who ' + (mine ? '' : 'them') + '">' + (mine ? 'You' : 'Deneb4') + '</span>';
    if (m.resolved) h += '<span class="badge">RESOLVED</span>';
    if (m.page) h += '<span class="page">· ' + esc(m.page) + '</span>';
    if (m.date) h += '<span class="when">' + fmtDate(m.date) + '</span>';
    h += '</div>';
    if (editing) {
      h += '<textarea class="editbox" rows="2">' + esc(m.message) + '</textarea>';
      h += '<div class="acts"><button data-act="saveedit">Save</button><button data-act="canceledit">Cancel</button></div>';
    } else {
      h += '<p class="txt">' + esc(m.message) + '</p>';
      if (canEdit) {
        h += '<div class="acts"><button data-act="edit">Edit</button><button class="del" data-act="del">Delete</button></div>';
      }
    }
    h += '</div>';
    return h;
  }

  function renderBody() {
    var active = state.thread.filter(function (m) { return !m.resolved; });
    var resolved = state.thread.filter(function (m) { return m.resolved; });
    var h = '';
    h += '<p class="note">' + (state.canComment
      ? 'Spotted something on your site? Note it here and Deneb4 will respond.'
      : 'Commenting is closed right now. Your history stays available below.') + '</p>';
    active.forEach(function (m) { h += msgHtml(m); });
    if (resolved.length) {
      h += '<button class="histlink" data-act="hist">' +
        (state.showHistory ? 'Hide' : 'Show') + ' resolved history (' + resolved.length + ')</button>';
      if (state.showHistory) {
        h += '<div style="opacity:.8">';
        resolved.forEach(function (m) { h += msgHtml(m); });
        h += '</div>';
      }
    }
    bodyEl.innerHTML = h;
  }

  function renderFoot() {
    if (state.canComment) {
      footEl.innerHTML =
        '<p class="err hidden"></p>' +
        '<input class="pageinp" type="text" placeholder="Which page or section? (optional)" maxlength="200">' +
        '<textarea class="msginp" rows="3" placeholder="Your comment or suggestion..." maxlength="4000"></textarea>' +
        '<button class="send" type="button" disabled>Send feedback</button>';
    } else {
      footEl.innerHTML = '<p class="closed">Commenting is currently closed.</p>';
    }
  }

  function renderPanel() {
    renderBody();
    renderFoot();
  }

  // ---- body click handling (edit/delete/history) ----
  bodyEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'hist') {
      state.showHistory = !state.showHistory;
      renderBody();
      return;
    }
    var msgEl = btn.closest('.msg');
    var id = msgEl && msgEl.getAttribute('data-id');
    if (act === 'edit') {
      state.editingId = id;
      renderBody();
    } else if (act === 'canceledit') {
      state.editingId = null;
      renderBody();
    } else if (act === 'saveedit') {
      var ta = msgEl.querySelector('.editbox');
      var text = ta.value.trim();
      if (!text) return;
      send({ action: 'edit', id: id, message: text }).then(function (d) {
        if (d && d.ok) {
          state.thread = state.thread.map(function (m) {
            return m.id === id ? Object.assign({}, m, { message: text }) : m;
          });
        }
        state.editingId = null;
        renderBody();
      });
    } else if (act === 'del') {
      if (!confirm('Delete this message?')) return;
      send({ action: 'delete', id: id }).then(function (d) {
        if (d && d.ok) {
          state.thread = state.thread.filter(function (m) { return m.id !== id; });
          renderBody();
        }
      });
    }
  });

  // ---- foot submit handling ----
  footEl.addEventListener('input', function (e) {
    if (e.target.classList.contains('msginp')) {
      var sb = footEl.querySelector('.send');
      if (sb) sb.disabled = !e.target.value.trim();
    }
  });
  footEl.addEventListener('click', function (e) {
    if (!e.target.classList.contains('send')) return;
    var msgInp = footEl.querySelector('.msginp');
    var pageInp = footEl.querySelector('.pageinp');
    var errEl = footEl.querySelector('.err');
    var text = msgInp.value.trim();
    if (!text) return;
    e.target.disabled = true;
    e.target.textContent = 'Sending...';
    send({ message: text, page: pageInp.value })
      .then(function (d) {
        if (d && d.ok && d.entry) {
          state.thread.push(d.entry);
          msgInp.value = '';
          pageInp.value = '';
          renderBody();
        } else if (errEl) {
          errEl.textContent = (d && d.error) || 'Could not send.';
          errEl.classList.remove('hidden');
        }
      })
      .catch(function () {
        if (errEl) { errEl.textContent = 'Server error — try again.'; errEl.classList.remove('hidden'); }
      })
      .finally(function () {
        var sb = footEl.querySelector('.send');
        if (sb) { sb.disabled = false; sb.textContent = 'Send feedback'; }
      });
  });

  // ---- open / close ----
  function openPanel() {
    state.open = true;
    localStorage.setItem(OPEN_KEY, '1');
    bubble.classList.add('hidden');
    panel.classList.remove('hidden');
    markSeen();
    if (state.loaded) renderPanel();
    else load();
  }
  function closePanel() {
    state.open = false;
    localStorage.setItem(OPEN_KEY, '0');
    panel.classList.add('hidden');
    bubble.classList.remove('hidden');
    refreshDot();
  }
  minBtn.addEventListener('click', function (e) { e.stopPropagation(); closePanel(); });

  // ---- dragging (shared by bubble + header) ----
  function applyPos() {
    var raw = localStorage.getItem(POS_KEY);
    if (!raw) return;
    try {
      var p = JSON.parse(raw);
      host.style.left = p.left + 'px';
      host.style.top = p.top + 'px';
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    } catch (e) {}
  }
  function clampPos(left, top, w, h) {
    var maxL = window.innerWidth - w - 4;
    var maxT = window.innerHeight - h - 4;
    return { left: Math.max(4, Math.min(left, maxL)), top: Math.max(4, Math.min(top, maxT)) };
  }
  function makeDraggable(handle, isBubble) {
    var down = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    handle.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      // don't start drag from the minimize button
      if (e.target.closest('.min')) return;
      down = true; moved = false;
      var rect = host.getBoundingClientRect();
      ox = rect.left; oy = rect.top; sx = e.clientX; sy = e.clientY;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true;
      var rect = host.getBoundingClientRect();
      var pos = clampPos(ox + dx, oy + dy, rect.width, rect.height);
      host.style.left = pos.left + 'px';
      host.style.top = pos.top + 'px';
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    });
    handle.addEventListener('pointerup', function (e) {
      if (!down) return;
      down = false;
      try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
      if (moved) {
        var rect = host.getBoundingClientRect();
        localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      } else if (isBubble) {
        openPanel();
      }
    });
  }
  makeDraggable(bubble, true);
  makeDraggable(head, false);

  // keep it on-screen if the window resizes
  window.addEventListener('resize', function () {
    if (!localStorage.getItem(POS_KEY)) return;
    var rect = host.getBoundingClientRect();
    var pos = clampPos(rect.left, rect.top, rect.width, rect.height);
    host.style.left = pos.left + 'px';
    host.style.top = pos.top + 'px';
  });

  // ---- boot ----
  function mount() {
    document.body.appendChild(host);
    applyPos();
    if (state.open) {
      bubble.classList.add('hidden');
      panel.classList.remove('hidden');
    }
    load();
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
