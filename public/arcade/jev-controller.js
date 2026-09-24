'use strict';
(function () {
  if (location.pathname !== '/arcade-jev') return;
  var style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/arcade/jev-controller.css'; document.head.appendChild(style);
  document.documentElement.classList.add('jev-enabled');
  var panel = document.createElement('aside'); panel.className = 'jev-panel'; panel.setAttribute('aria-label', 'Jev live controls and command log');
  panel.innerHTML = '<header><b>JEV</b><span id="j-status" role="status">CONNECTING</span><button id="j-collapse" aria-label="Collapse Jev log">−</button></header>' +
    '<div class="j-body"><details id="j-settings" open><summary>OPENROUTER KEY <span id="j-key-state">NOT SAVED</span></summary>' +
    '<form id="j-key-form"><label for="j-api-key">OpenRouter API key</label><input id="j-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-or-…" />' +
    '<div><button type="submit" id="j-save-key">SAVE KEY</button><button type="button" id="j-forget-key">FORGET KEY</button></div><small>Saved in this browser. Sent securely through this site to OpenRouter.</small></form></details><div class="j-keys" role="img" aria-label="Jev arrow keys">' +
    '<div class="j-key j-up" data-direction="up">↑<small>UP</small></div><div class="j-key j-left" data-direction="left">←<small>LEFT</small></div>' +
    '<div class="j-key j-down" data-direction="down">↓<small>DOWN</small></div><div class="j-key j-right" data-direction="right">→<small>RIGHT</small></div></div>' +
    '<label class="j-timing" for="j-pace">TIMING<select id="j-pace"><option value="plan">Real time · planned turns</option><option value="arcade">Real time · reactive</option></select></label><div class="j-best">JEV BEST <b id="j-best">0</b></div><div class="j-controls"><button id="j-start" disabled>START JEV</button><button id="j-pause" disabled>PAUSE</button></div>' +
    '<div class="j-stats"><span>COMMANDS <b id="j-count">0</b></span><span>RESPONSE <b id="j-latency">···</b></span></div>' +
    '<div class="j-spend">SESSION SPEND <b id="j-spend">$0.000000</b></div><p id="j-notice" role="status"></p><div class="j-log-head"><span>COMMAND LOG</span><button id="j-export" disabled>↓ SAVE</button></div>' +
    '<ol id="j-log" tabindex="0" aria-label="Jev commands, newest first"></ol><footer><span id="j-model">JEV</span><span id="j-timing-label">REAL TIME / PLANNED TURNS</span></footer></div>';
  document.body.appendChild(panel);
  var $ = function (id) { return document.getElementById(id); };
  var arrows = { up: '↑', down: '↓', left: '←', right: '→' };
  var keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  var instance = null, enabled = false, ready = false, generation = 0, timer = null, request = null, flash = null;
  var runs = [], run = null, runPlayer = null;
  var pace = 'plan', best = 0, queuedPlan = null, leadMs = 400;
  var planView = document.createElement('p'); planView.id = 'j-plan'; planView.setAttribute('aria-live', 'polite'); $('j-notice').before(planView);
  try { best = Number(localStorage.getItem('jev-snake-realtime-best-v1')) || 0; } catch (_) {}
  $('j-best').textContent = best;
  var keyStorage = 'arcade-jev-openrouter-key', savedKey = '', checkVersion = 0;
  var charges = [], spend = 0, unknownCharges = 0;
  try { savedKey = localStorage.getItem(keyStorage) || ''; } catch (_) {}
  function headers() { return savedKey ? { 'x-openrouter-key': savedKey } : {}; }
  function recordCharge(answer, requestRun, provider) {
    if (provider !== 'OpenRouter') return;
    var cost = answer.usage && answer.usage.cost;
    var known = typeof cost === 'number' && Number.isFinite(cost);
    if (known) spend += cost; else unknownCharges++;
    charges.push({ at: new Date().toISOString(), run: requestRun && requestRun.startedAt, generationId: answer.generationId || null, cost: known ? cost : null, usage: answer.usage || null });
    $('j-spend').textContent = '$' + spend.toFixed(6) + (unknownCharges ? ' + unknown' : '');
    $('j-export').disabled = false;
  }
  function status(text) { $('j-status').textContent = text; }
  function clearRequest() { generation++; clearTimeout(timer); request = null; if (queuedPlan) queuedPlan.entry.outcome = 'cancelled'; queuedPlan = null; }
  function buttons() {
    var state = instance && instance.snapshot().state;
    $('j-pace').disabled = state === 'playing' || state === 'paused';
    $('j-start').disabled = !ready || !instance || state === 'playing' || state === 'paused';
    $('j-start').textContent = state === 'over' ? 'RESTART JEV' : 'START JEV';
    $('j-pause').disabled = !enabled || (state !== 'playing' && state !== 'paused');
    $('j-pause').textContent = state === 'paused' ? 'RESUME' : 'PAUSE';
  }
  function beginRun() {
    clearRequest();
    run = { startedAt: new Date().toISOString(), timing: 'Original arcade timed loop, 130ms accelerating to 60ms; ' + pace, plans: [], commands: [] };
    runs.push(run); runPlayer = 'JEV';
    planView.textContent = '';
    $('j-log').replaceChildren(); $('j-count').textContent = '0'; $('j-notice').textContent = '';
    status('PLAYING'); timer = setTimeout(next, 0);
  }
  function addCommand(answer, before, atInput) {
    var entry = { n: run.commands.length + 1, direction: answer.direction, at: new Date().toISOString(),
      latencyMs: answer.latencyMs, model: answer.model, confidence: answer.confidence, usage: answer.usage,
      boardAtRequest: before, boardAtInput: atInput };
    run.commands.push(entry);
    var row = document.createElement('li');
    [String(entry.n).padStart(4, '0'), arrows[entry.direction], entry.direction.toUpperCase(), entry.latencyMs + 'ms'].forEach(function (text) {
      var span = document.createElement('span'); span.textContent = text; row.appendChild(span);
    });
    var list = $('j-log'), oldTop = list.scrollTop, height = list.scrollHeight;
    list.prepend(row); if (list.children.length > 1000) list.lastElementChild.remove();
    if (oldTop > 5) list.scrollTop = oldTop + list.scrollHeight - height;
    panel.querySelectorAll('.j-key').forEach(function (key) { key.classList.toggle('active', key.dataset.direction === entry.direction); });
    panel.querySelector('.j-keys').setAttribute('aria-label', 'Jev pressed ' + entry.direction);
    clearTimeout(flash); flash = setTimeout(function () { panel.querySelectorAll('.j-key').forEach(function (key) { key.classList.remove('active'); }); }, 120);
    $('j-count').textContent = run.commands.length; $('j-latency').textContent = entry.latencyMs + 'ms';
    $('j-model').textContent = answer.model || 'JEV'; $('j-export').disabled = false;
  }
  function sameBoard(a, b) {
    return a.tick === b.tick && a.direction === b.direction && JSON.stringify(a.snake) === JSON.stringify(b.snake) && JSON.stringify(a.food) === JSON.stringify(b.food);
  }
  function forecast(board, direction, count) {
    var result = JSON.parse(JSON.stringify(board));
    var vector = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] }[direction];
    for (var i = 0; i < count; i++) {
      var head = { x: result.snake[0].x + vector[0], y: result.snake[0].y + vector[1] };
      // New food is random. Never predict through it or silently dodge a crash.
      if (head.x < 0 || head.y < 0 || head.x >= 24 || head.y >= 24 ||
          (head.x === result.food.x && head.y === result.food.y) ||
          result.snake.slice(0,-1).some(function(p){ return p.x === head.x && p.y === head.y; })) return null;
      result.snake.unshift(head); result.snake.pop(); result.tick++; result.direction = direction;
    }
    return result;
  }
  async function planNext(target) {
    if (!enabled || !instance || instance.snapshot().state !== 'playing') return;
    var active = instance, token = generation, current = active.snapshot();
    var before = target || forecast(current, current.direction, Math.max(2, Math.ceil(leadMs / current.tickMs)));
    if (!before || before.tick < current.tick) { timer = setTimeout(function(){ planNext(); }, 40); return; }
    var requestRun = run, provider = savedKey ? 'OpenRouter' : 'TypeSafe', charged = false, started = performance.now();
    var abort = new AbortController(), timeout = setTimeout(function(){abort.abort();},20000); request = abort;
    status('PLANNING');
    try {
      var response = await fetch('/api/jev', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},headers()), body:JSON.stringify(Object.assign({},before,{plan:true})), signal:abort.signal });
      var answer = await response.json(); recordCharge(answer,requestRun,provider); charged = true;
      if (token !== generation || instance !== active || active.snapshot().state !== 'playing') return;
      leadMs = Math.max(250, Math.min(1500, (performance.now() - started) * 1.3));
      if (!response.ok) throw new Error(answer.error || 'Jev request failed.');
      if (!Object.prototype.hasOwnProperty.call(keys,answer.direction) || !Number.isInteger(answer.steps) || answer.steps < 1 || answer.steps > 23) throw new Error('Invalid plan.');
      var entry = { at:new Date().toISOString(), board:before, direction:answer.direction, steps:answer.steps, latencyMs:Math.round(performance.now()-started), outcome:'queued' };
      requestRun.plans.push(entry); $('j-export').disabled = false;
      if (active.snapshot().tick > before.tick) {
        entry.outcome = 'late'; $('j-notice').textContent = 'Plan arrived late. Clock kept running.';
        timer = setTimeout(function(){planNext();},0); return;
      }
      queuedPlan = { answer:answer, before:before, entry:entry };
      planView.textContent = 'PLAN ' + arrows[answer.direction] + ' ' + answer.direction.toUpperCase() + ' · ' + answer.steps + ' CELLS';
      status('PLAN READY');
    } catch(error) {
      if (!charged) recordCharge({},requestRun,provider);
      if (token !== generation) return;
      $('j-notice').textContent = error.message + ' Game clock continues.'; status('RETRYING');
      timer = setTimeout(function(){planNext();},500);
    } finally { clearTimeout(timeout); if(request === abort) request = null; }
  }
  function applyPlannedTurn() {
    if (!enabled || pace !== 'plan' || !queuedPlan || !instance) return;
    var now = instance.snapshot(), plan = queuedPlan;
    if (now.tick < plan.before.tick) return;
    queuedPlan = null;
    if (!sameBoard(now,plan.before)) {
      plan.entry.outcome = 'stale'; timer = setTimeout(function(){planNext();},0); return;
    }
    plan.entry.outcome = 'applied'; plan.entry.appliedAt = new Date().toISOString();
    // A direction stays held by the original game. Send and log only real turns.
    if (plan.answer.direction !== now.direction) {
      document.dispatchEvent(new KeyboardEvent('keydown',{key:keys[plan.answer.direction],code:keys[plan.answer.direction],bubbles:true,cancelable:true}));
      document.dispatchEvent(new KeyboardEvent('keyup',{key:keys[plan.answer.direction],code:keys[plan.answer.direction],bubbles:true}));
      addCommand(plan.answer,plan.before,now);
    }
    status('PLAYING'); $('j-notice').textContent = '';
    var endpoint = forecast(now,plan.answer.direction,plan.answer.steps);
    var token = generation, endTick = now.tick + plan.answer.steps;
    // Think while the existing game travels. After food, wait only for the new
    // board observation, never stop or slow the game clock.
    function continuePlanning() {
      if (token !== generation || !instance || instance.snapshot().state !== 'playing') return;
      if (!endpoint && instance.snapshot().tick < endTick) { timer = setTimeout(continuePlanning,20); return; }
      planNext(endpoint);
    }
    timer = setTimeout(continuePlanning,0);
  }
  async function next() {
    if (pace === 'plan') return planNext();
    if (!enabled || !instance || instance.snapshot().state !== 'playing') return;
    var token = generation, active = instance, before = active.snapshot(), started = performance.now();
    var requestRun = run, provider = savedKey ? 'OpenRouter' : 'TypeSafe', charged = false;
    var abort = new AbortController(); request = abort;
    var timeout = setTimeout(function () { abort.abort(); }, 20000);
    status('DECIDING');
    try {
      var response = await fetch('/api/jev', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers()), body: JSON.stringify(before), signal: abort.signal });
      var answer = await response.json();
      recordCharge(answer, requestRun, provider); charged = true;
      if (token !== generation || instance !== active || active.snapshot().state !== 'playing') return;
      if (!response.ok) throw new Error(answer.error || 'Jev request failed.');
      if (!Object.prototype.hasOwnProperty.call(keys, answer.direction)) throw new Error('Invalid direction.');
      var atInput = active.snapshot();
      if (answer.direction !== atInput.direction) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: keys[answer.direction], code: keys[answer.direction], bubbles: true, cancelable: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: keys[answer.direction], code: keys[answer.direction], bubbles: true }));
      addCommand(answer, before, atInput);
      }
      if (active.snapshot().state === 'over') { status('GAME OVER'); buttons(); return; }
      status('PLAYING');
      timer = setTimeout(next, Math.max(0, 180 - (performance.now() - started)));
    } catch (error) {
      if (!charged) recordCharge({}, requestRun, provider);
      if (token !== generation) return;
      $('j-notice').textContent = (error.name === 'AbortError' ? 'Request timed out.' : error.message) + ' Game clock continues.';
      status('RETRYING'); timer = setTimeout(next, 500);
    } finally { clearTimeout(timeout); if (request === abort) request = null; }
  }
  var mount = window.ArcadeGames.snake.mount;
  window.ArcadeGames.snake.mount = function (host, api) {
    var proxy = Object.assign({}, api);
    proxy.beforeStep = applyPlannedTurn;
    proxy.setState = function (state) {
      api.setState(state);
      if (enabled && instance) {
        if (state === 'paused') { clearRequest(); status('PAUSED'); }
        else if (state === 'playing') { clearRequest(); status('PLAYING'); timer = setTimeout(next, 0); }
      }
      buttons();
    };
    proxy.gameOver = function (result) {
      clearRequest();
      if (runPlayer) result = Object.assign({}, result, { player: runPlayer });
      if (runPlayer === 'JEV' && result.score > best) {
        best = result.score; $('j-best').textContent = best;
        try { localStorage.setItem('jev-snake-decision-best-v1', String(best)); } catch (_) {}
      }
      if (run) { run.score = result.score; run.finishedAt = new Date().toISOString(); run.player = runPlayer; }
      api.gameOver(result);
      status(enabled ? 'GAME OVER' : 'READY'); buttons();
    };
    var mounted = mount(host, proxy, { controlled: false }); instance = mounted;
    var start = mounted.start, destroy = mounted.destroy;
    mounted.start = function () {
      clearRequest(); runPlayer = null;
      if (mounted.setControlled) mounted.setControlled(false);
      start();
      if (enabled && mounted.snapshot().state === 'playing') beginRun();
      buttons();
    };
    mounted.destroy = function () { clearRequest(); enabled = false; runPlayer = null; instance = null; destroy(); status('SELECT SNAKE'); buttons(); };
    buttons(); return mounted;
  };
  $('j-pace').addEventListener('change', function () {
    pace = $('j-pace').value;
    if (instance && instance.setControlled) instance.setControlled(false);
    $('j-timing-label').textContent = pace === 'jev' ? 'ONE DECISION / CELL' : 'ORIGINAL GAME SPEED';
  });
  $('j-start').addEventListener('click', function () {
    if (!ready || !instance) return;
    if (document.documentElement.getAttribute('data-inserted') !== 'true') {
      $('j-notice').textContent = 'Insert a coin, then start Jev.';
      var coin = document.querySelector('.coin-btn'); if (coin) coin.click();
      return;
    }
    enabled = true; window.ArcadeSound.unlock(); instance.start(); $('j-start').blur();
  });
  $('j-pause').addEventListener('click', function () {
    if (!instance) return;
    $('j-notice').textContent = '';
    if (instance.snapshot().state === 'paused') instance.resume(); else instance.pause();
    $('j-pause').blur();
  });
  // Human intervention is labeled, so a mixed run never becomes a claimed Jev-only score.
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input,textarea,button,select')) return;
    if (e.isTrusted && enabled && /^Arrow|^[wasdWASD]$/.test(e.key)) runPlayer = 'JEV + HUMAN';
  }, true);
  document.addEventListener('pointerdown', function (e) {
    if (enabled && e.target.closest && e.target.closest('.snake-view,.snake-controls')) runPlayer = 'JEV + HUMAN';
  }, true);
  $('j-collapse').addEventListener('click', function () {
    var closed = panel.classList.toggle('j-collapsed'); $('j-collapse').textContent = closed ? '+' : '−';
    $('j-collapse').setAttribute('aria-label', closed ? 'Expand Jev log' : 'Collapse Jev log');
  });
  var drag = null, header = panel.querySelector('header');
  header.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button') || e.button !== 0) return;
    var rect = panel.getBoundingClientRect(); drag = { x: e.clientX - rect.left, y: e.clientY - rect.top, id: e.pointerId };
    header.setPointerCapture(e.pointerId); e.preventDefault();
  });
  header.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    panel.style.left = Math.max(0, Math.min(innerWidth - panel.offsetWidth, e.clientX - drag.x)) + 'px';
    panel.style.top = Math.max(0, Math.min(innerHeight - header.offsetHeight, e.clientY - drag.y)) + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
  });
  function endDrag() { drag = null; }
  header.addEventListener('pointerup', endDrag); header.addEventListener('pointercancel', endDrag);
  $('j-export').addEventListener('click', function () {
    var url = URL.createObjectURL(new Blob([JSON.stringify({ source: location.pathname, runs: runs, cost: { usd: spend, unknownRequests: unknownCharges, requests: charges } }, null, 2)], { type: 'application/json' }));
    var link = document.createElement('a'); link.href = url; link.download = 'jev-arcade-commands.json'; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    var costUrl = URL.createObjectURL(new Blob([JSON.stringify({ usd: spend, unknownRequests: unknownCharges, requests: charges }, null, 2)], { type: 'application/json' }));
    var costLink = document.createElement('a'); costLink.href = costUrl; costLink.download = 'jev-arcade-commands.cost.json'; costLink.click();
    setTimeout(function () { URL.revokeObjectURL(costUrl); }, 1000);
  });
  window.addEventListener('pagehide', clearRequest);
  function paintKey() {
    $('j-key-state').textContent = savedKey ? 'SAVED' : 'NOT SAVED';
    $('j-api-key').value = '';
    $('j-api-key').placeholder = savedKey ? 'Key saved · enter to replace' : 'sk-or-…';
    $('j-forget-key').disabled = !savedKey;
  }
  async function verify(candidate, save) {
    var version = ++checkVersion; ready = false; buttons(); status('CONNECTING');
    $('j-save-key').disabled = true;
    try {
      var response = await fetch('/api/jev', { cache: 'no-store', headers: candidate ? { 'x-openrouter-key': candidate } : {} });
      var data = await response.json();
      if (version !== checkVersion) return;
      if (!response.ok) throw new Error(data.error || 'Could not verify key.');
      ready = !!data.ready;
      if (save && ready) {
        savedKey = candidate;
        try { localStorage.setItem(keyStorage, candidate); } catch (_) { $('j-notice').textContent = 'Key works for this page; browser storage is unavailable.'; }
      }
      paintKey(); status(ready ? 'READY' : 'NOT CONNECTED');
      $('j-settings').open = !ready;
      if (ready) $('j-notice').textContent = '';
      else $('j-notice').textContent = 'Add your OpenRouter key to connect Jev.';
    } catch (error) {
      if (version !== checkVersion) return;
      ready = false; status('NOT CONNECTED'); $('j-notice').textContent = error.message; $('j-settings').open = true;
    } finally { if (version === checkVersion) { $('j-save-key').disabled = false; buttons(); } }
  }
  $('j-key-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var candidate = $('j-api-key').value.trim();
    if (!/^sk-or-[A-Za-z0-9_-]{10,250}$/.test(candidate)) { $('j-notice').textContent = 'Enter a valid OpenRouter key.'; return; }
    if (instance && instance.snapshot().state === 'playing') instance.pause();
    clearRequest(); verify(candidate, true);
  });
  $('j-forget-key').addEventListener('click', function () {
    if (instance && instance.snapshot().state === 'playing') instance.pause();
    clearRequest(); if (runPlayer) runPlayer = 'JEV + HUMAN'; savedKey = ''; ready = false; enabled = false;
    try { localStorage.removeItem(keyStorage); } catch (_) {}
    paintKey(); verify('', false);
  });
  paintKey(); verify(savedKey, false);
})();
