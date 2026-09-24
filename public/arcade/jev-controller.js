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
  var pace = 'plan', best = 0, leadMs = 400, lastScore = 0, latencies = [];
  // Planned mode keeps a schedule of turns keyed by engine tick, plus the
  // predicted board at the end of everything scheduled (the horizon).
  var schedule = [], horizon = null, expected = {};
  var planView = document.createElement('p'); planView.id = 'j-plan'; planView.setAttribute('aria-live', 'polite'); $('j-notice').before(planView);
  var bestKey = 'jev-snake-realtime-best-v1';
  try { best = Number(localStorage.getItem(bestKey)) || 0; } catch (_) {}
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
  function dropSchedule(outcome) {
    schedule.forEach(function (turn) { if (turn.plan.outcome === 'queued') turn.plan.outcome = outcome; else if (turn.plan.outcome === 'applied') turn.plan.dropped = outcome; });
    if (horizon && horizon.plan && horizon.plan.outcome === 'queued') horizon.plan.outcome = outcome;
    schedule = []; horizon = null; expected = {}; showPlan();
  }
  function clearRequest() { generation++; clearTimeout(timer); request = null; dropSchedule('cancelled'); }
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
    runs.push(run); runPlayer = 'JEV'; lastScore = 0;
    planView.textContent = '';
    $('j-log').replaceChildren(); $('j-count').textContent = '0'; $('j-notice').textContent = '';
    status('PLAYING'); timer = setTimeout(next, 0);
  }
  function addCommand(answer, before, atInput, extra) {
    var entry = Object.assign({ n: run.commands.length + 1, direction: answer.direction, at: new Date().toISOString(), tick: atInput.tick,
      latencyMs: answer.latencyMs, model: answer.model, confidence: answer.confidence, usage: answer.usage,
      boardAtRequest: before, boardAtInput: atInput }, extra || {});
    run.commands.push(entry);
    var row = document.createElement('li');
    [String(entry.n).padStart(4, '0'), arrows[entry.direction], entry.direction.toUpperCase() + (entry.role === 'escape' ? ' · ESCAPE' : ''), entry.role ? 'T' + entry.tick : entry.latencyMs + 'ms'].forEach(function (text) {
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
  var vectors = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  function copyBoard(b) { return JSON.parse(JSON.stringify(b)); }
  // One engine step, mirroring snake.js. Food becomes unknown (null) once eaten.
  function advance(board, direction) {
    var v = vectors[direction], head = { x: board.snake[0].x + v[0], y: board.snake[0].y + v[1] };
    if (head.x < 0 || head.y < 0 || head.x >= 24 || head.y >= 24) return null;
    var eats = !!board.food && head.x === board.food.x && head.y === board.food.y;
    var body = eats ? board.snake : board.snake.slice(0, -1);
    if (body.some(function (p) { return p.x === head.x && p.y === head.y; })) return null;
    var result = copyBoard(board);
    result.snake.unshift(head); if (!eats) result.snake.pop();
    result.tick++; result.direction = direction;
    if (eats) { result.food = null; result.score = (result.score || 0) + 10; result.ate = true; } else delete result.ate;
    return result;
  }
  // Holding the heading needs no key. Stop before a crash or a known apple, so
  // the request board is the last one that is certain to happen.
  function hold(board, targetTick, path) {
    var result = board;
    while (result.tick < targetTick) { var moved = advance(result, result.direction); if (!moved || moved.ate) break; result = moved; if (path) path.push(result); }
    return result;
  }
  // Every forecast tick is checked as it happens, so a human key or a dropped
  // input is caught on the next step instead of at the next planned turn.
  function expect(board) { expected[board.tick] = board.snake[0].x + ',' + board.snake[0].y + ',' + board.direction; }
  function mismatch(now, expect, checkFood) {
    if (now.tick !== expect.tick) return 'tick ' + now.tick + ' not ' + expect.tick;
    if (now.direction !== expect.direction) return 'heading changed';
    if (JSON.stringify(now.snake) !== JSON.stringify(expect.snake)) return 'body differs from forecast';
    if (checkFood && JSON.stringify(now.food) !== JSON.stringify(expect.food)) return 'apple moved';
    return '';
  }
  function showPlan() {
    var waiting = horizon && horizon.awaitingFood && !schedule.some(function (t) { return t.role === 'escape'; });
    if (!schedule.length && !waiting) { planView.textContent = ''; return; }
    var tick = instance ? instance.snapshot().tick : 0;
    var parts = schedule.map(function (turn) {
      return (turn.role === 'escape' ? 'EAT → ' : '') + arrows[turn.direction] + ' in ' + Math.max(0, turn.tick - tick);
    });
    if (waiting) parts.push('EAT → hold');
    planView.textContent = 'PLAN ' + parts.join(' · ');
  }
  function invalidate(reason) {
    dropSchedule('invalidated: ' + reason);
    generation++; if (request) request.abort(); request = null; clearTimeout(timer);
    if (run) run.discarded = (run.discarded || 0) + 1;
    $('j-notice').textContent = 'Plan dropped: ' + reason + '. Replanning; clock keeps running.';
    timer = setTimeout(planNext, 0);
  }
  // Turn a chosen trajectory into keypresses scheduled on exact engine ticks.
  function queuePlan(answer, board, entry) {
    var b = copyBoard(board), turns = [];
    for (var i = 0; i < answer.turns.length; i++) {
      var leg = answer.turns[i], last = i === answer.turns.length - 1;
      turns.push({ tick: b.tick, direction: leg.direction, expect: b, checkFood: true, role: i ? 'turn' : 'start', plan: entry });
      for (var k = 0; k < leg.steps; k++) {
        var moved = advance(b, leg.direction);
        if (!moved || (moved.ate && !(answer.eats && last && k === leg.steps - 1))) throw new Error('Plan does not match this board.');
        b = moved; expect(b);
      }
    }
    if (answer.eats) {
      if (!b.ate) throw new Error('Plan does not reach the apple.');
      entry.eatTick = b.tick;
      if (answer.escape) turns.push({ tick: b.tick, direction: answer.escape, expect: b, checkFood: false, role: 'escape', plan: entry });
      b = Object.assign(copyBoard(b), { direction: answer.escape || b.direction });
    }
    schedule = schedule.concat(turns);
    horizon = { board: b, awaitingFood: !!answer.eats, plan: entry };
    entry.endTick = b.tick; showPlan();
  }
  async function planNext() {
    if (!enabled || pace !== 'plan' || !instance || request || !run || instance.snapshot().state !== 'playing') return;
    if (horizon && horizon.awaitingFood) return; // resumes when the apple is eaten
    var active = instance, token = generation, current = active.snapshot();
    var delay = Math.max(1, Math.ceil(leadMs / current.tickMs) + 1);
    if (horizon && horizon.board.tick < current.tick) dropSchedule('expired');
    var base = horizon ? horizon.board : current;
    // Enough is already decided; look again shortly instead of planning far ahead.
    if (horizon && base.tick - current.tick > 2 * delay + 4) { timer = setTimeout(planNext, 40); return; }
    var holdPath = [], target = hold(base, current.tick + delay, holdPath);
    // A new apple right in front of the escape: let the engine eat it, then replan.
    if (target.tick === base.tick && schedule.some(function (t) { return t.tick === base.tick; })) { timer = setTimeout(planNext, 40); return; }
    var requestRun = run, provider = savedKey ? 'OpenRouter' : 'TypeSafe', charged = false, started = performance.now();
    var abort = new AbortController(), timeout = setTimeout(function(){abort.abort();},20000); request = abort;
    var entry = { at:new Date().toISOString(), observed:current, board:target, decisionDelayTicks:delay, outcome:'pending' };
    requestRun.plans.push(entry);
    status('PLANNING');
    try {
      var response = await fetch('/api/jev', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},headers()), body:JSON.stringify(Object.assign({},target,{plan:true,decisionDelayTicks:delay})), signal:abort.signal });
      var answer = await response.json(); recordCharge(answer,requestRun,provider); charged = true;
      entry.latencyMs = Math.round(performance.now()-started);
      if (token !== generation || instance !== active || active.snapshot().state !== 'playing') { entry.outcome = 'cancelled'; return; }
      // Size the lead from the slow end of recent responses, not the last one:
      // one latency spike at 60ms ticks is enough to miss a wall.
      latencies = latencies.concat(performance.now() - started).slice(-12);
      var sorted = latencies.slice().sort(function (a, b) { return b - a; });
      leadMs = Math.max(250, Math.min(1500, sorted[Math.min(1, sorted.length - 1)] * 1.2));
      if (!response.ok) throw new Error(answer.error || 'Jev request failed.');
      if (!Array.isArray(answer.turns) || !answer.turns.length || !answer.turns.every(function (t) { return Object.prototype.hasOwnProperty.call(keys, t.direction) && Number.isInteger(t.steps) && t.steps >= 1 && t.steps <= 23; }) ||
        (answer.escape != null && !Object.prototype.hasOwnProperty.call(keys, answer.escape))) throw new Error('Invalid plan.');
      Object.assign(entry, { choice:answer.choice, turns:answer.turns, eats:!!answer.eats, escape:answer.escape || null, candidates:answer.candidates, confidence:answer.confidence, model:answer.model, generationId:answer.generationId });
      $('j-latency').textContent = entry.latencyMs + 'ms'; $('j-model').textContent = answer.model || 'JEV'; $('j-export').disabled = false;
      var now = active.snapshot();
      if (now.tick > target.tick) {
        entry.outcome = 'late'; entry.lateByTicks = now.tick - target.tick;
        $('j-notice').textContent = 'Plan arrived ' + entry.lateByTicks + ' ticks late and was discarded. Clock kept running.';
        request = null; timer = setTimeout(planNext,0); return;
      }
      entry.outcome = 'queued';
      queuePlan(answer, target, entry);
      holdPath.forEach(expect);
      status('PLAN READY');
      request = null; timer = setTimeout(planNext,0);
    } catch(error) {
      if (!charged) recordCharge({},requestRun,provider);
      if (entry.outcome === 'pending') { entry.outcome = 'failed'; entry.error = error.message; }
      if (token !== generation) return;
      $('j-notice').textContent = (error.name === 'AbortError' ? 'Request timed out.' : error.message) + ' Game clock continues.'; status('RETRYING');
      request = null; timer = setTimeout(planNext,500);
    } finally { clearTimeout(timeout); if(request === abort) request = null; }
  }
  // Runs inside the engine right before each step, so a turn lands on its tick.
  function applyPlannedTurn() {
    if (!enabled || pace !== 'plan' || !instance) return;
    var now = instance.snapshot(), seen = expected[now.tick];
    delete expected[now.tick - 1];
    if (seen && (horizon || schedule.length) && seen !== now.snake[0].x + ',' + now.snake[0].y + ',' + now.direction) return invalidate('snake left the forecast path');
    if (!schedule.length) return;
    if (schedule[0].tick < now.tick) return invalidate('missed tick ' + schedule[0].tick);
    if (schedule[0].tick !== now.tick) return;
    var turn = schedule[0], reason = mismatch(now, turn.expect, turn.checkFood);
    if (reason) return invalidate(reason);
    schedule.shift();
    if (turn.role === 'start') turn.plan.outcome = 'applied';
    turn.plan.appliedTurns = (turn.plan.appliedTurns || 0) + 1;
    // A direction stays held by the original game. Send and log only real turns.
    if (turn.direction !== now.direction) {
      document.dispatchEvent(new KeyboardEvent('keydown',{key:keys[turn.direction],code:keys[turn.direction],bubbles:true,cancelable:true}));
      document.dispatchEvent(new KeyboardEvent('keyup',{key:keys[turn.direction],code:keys[turn.direction],bubbles:true}));
      addCommand({ direction:turn.direction, latencyMs:turn.plan.latencyMs, model:turn.plan.model, confidence:turn.plan.confidence }, turn.plan.board, now,
        { role:turn.role, choice:turn.plan.choice, decidedAt:turn.plan.at, decidedForTick:turn.plan.board.tick });
    }
    if (!request) status('PLAYING');
    showPlan();
  }
  // snake.js reports status when it eats. That is the moment the next apple
  // becomes known, so the planned escape keeps running while Jev looks again.
  function onScore() {
    if (!enabled || pace !== 'plan' || !instance || !run) return;
    var now = instance.snapshot();
    if (now.state !== 'playing' || now.score <= lastScore) { lastScore = now.score; return; }
    lastScore = now.score;
    if (!horizon || !horizon.awaitingFood) return invalidate('unplanned apple');
    var reason = now.tick !== horizon.board.tick ? 'ate on tick ' + now.tick : JSON.stringify(now.snake) !== JSON.stringify(horizon.board.snake) ? 'body differs after eating' : '';
    if (reason) return invalidate(reason);
    horizon.board.food = now.food && { x: now.food.x, y: now.food.y }; horizon.board.score = now.score;
    horizon.board.tickMs = now.tickMs; horizon.awaitingFood = false; showPlan();
    clearTimeout(timer); timer = setTimeout(planNext, 0);
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
    proxy.setStatus = function (value) { api.setStatus(value); onScore(); };
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
        try { localStorage.setItem(bestKey, String(best)); } catch (_) {}
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
    $('j-timing-label').textContent = pace === 'plan' ? 'REAL TIME / PLANNED TURNS' : 'REAL TIME / REACTIVE';
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
  window.__jevRuns = runs; // read-only view for local test scripts
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
