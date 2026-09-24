'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var arrows = { up: '↑', down: '↓', left: '←', right: '→' };
  var bestKey = 'jev-snake-decision-best-v1';
  var best = 0;
  try { best = Number(localStorage.getItem(bestKey)) || 0; } catch (_) {}
  var format = function (n) { return String(n).padStart(4, '0'); };
  $('best').textContent = format(best);
  var running = false, ready = false, epoch = 0, request = null, timer = null, flash = null;
  var records = [], moves = [], runNumber = 0, current = null, outcome = null;
  var sound = window.ArcadeSound;
  if (!sound.isMuted()) sound.toggle();
  var game = window.ArcadeGames.snake.mount($('board'), {
    canStart: function () { return true; },
    palette: function () { return { dim: '#83966a', hot: '#ffb545', name: '#e4ffbd', accent: '#a7cc72' }; },
    setStatus: function (s) { $('score').textContent = s.value; },
    setState: function () {},
    gameOver: function (result) { outcome = result; }
  }, { controlled: true });

  function status(text, live) { $('status').textContent = text; $('lamp').classList.toggle('live', !!live); }
  function overlay(title, note) { $('overlay').hidden = !title; $('overlay-title').textContent = title || ''; $('overlay-note').textContent = note || ''; }
  function cancel() {
    running = false; epoch++;
    if (request) request.abort();
    request = null; clearTimeout(timer); clearTimeout(flash);
    document.querySelectorAll('.key').forEach(function (key) { key.classList.remove('active'); });
  }
  function controls() {
    $('start').disabled = !ready || !!current;
    $('pause').disabled = !current || !!outcome;
    $('pause').textContent = running || !current ? 'PAUSE' : 'RESUME';
    $('restart').disabled = !ready || !current;
    $('export').disabled = !records.some(function (r) { return r.moves.length; });
  }
  async function check() {
    try {
      var res = await fetch('/api/jev', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      ready = !!(await res.json()).ready;
      status(ready ? 'READY' : 'NOT CONNECTED');
      $('notice').textContent = ready ? '' : 'Jev is not connected yet.';
    } catch (_) { ready = false; status('NOT CONNECTED'); $('notice').textContent = 'Could not connect to Jev. Reload to retry.'; }
    controls();
  }
  function finish() {
    cancel();
    current.finishedAt = new Date().toISOString(); current.score = outcome.score; current.result = 'game-over';
    if (outcome.score > best) {
      best = outcome.score;
      try { localStorage.setItem(bestKey, String(best)); } catch (_) {}
      $('best').textContent = format(best);
    }
    status('GAME OVER'); overlay('GAME OVER', format(outcome.score)); controls();
  }
  function log(answer, before, elapsedMs) {
    var record = { step: moves.length + 1, direction: answer.direction, latencyMs: answer.latencyMs,
      confidence: answer.confidence, elapsedMs: elapsedMs, model: answer.model, probabilities: answer.probabilities,
      usage: answer.usage, boardBefore: before, scoreAfter: game.snapshot().score };
    moves.push(record);
    $('empty').hidden = true;
    var row = document.createElement('li'); row.className = 'command';
    var items = [['seq', String(record.step).padStart(4, '0')], ['arrow', arrows[answer.direction]], ['', answer.direction.toUpperCase()]];
    items.forEach(function (item) { var span = document.createElement('span'); span.className = item[0]; span.textContent = item[1]; row.appendChild(span); });
    var time = document.createElement('time'); time.textContent = (elapsedMs / 1000).toFixed(1) + 's'; row.appendChild(time);
    var list = $('commands'); var scroller = list.parentElement; var oldHeight = scroller.scrollHeight; var oldTop = scroller.scrollTop;
    list.prepend(row);
    if (list.children.length > 1000) list.lastElementChild.remove();
    if (oldTop > 5) scroller.scrollTop = oldTop + scroller.scrollHeight - oldHeight;
    document.querySelectorAll('.key').forEach(function (key) { key.classList.toggle('active', key.dataset.dir === answer.direction); });
    document.querySelector('.keyboard').setAttribute('aria-label', 'Jev chose ' + answer.direction);
    clearTimeout(flash); flash = setTimeout(function () { document.querySelectorAll('.key').forEach(function (key) { key.classList.remove('active'); }); }, 170);
    $('moves').textContent = moves.length;
    $('latency').textContent = answer.latencyMs + ' ms';
    $('confidence').textContent = typeof answer.confidence === 'number' ? Math.round(answer.confidence * 100) + '%' : '···';
    $('model').textContent = answer.model || 'JEV';
    controls();
  }
  async function next() {
    if (!running) return;
    var turn = epoch, before = game.snapshot(), start = performance.now();
    var controller = new AbortController(); request = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    status('DECIDING', true);
    try {
      var res = await fetch('/api/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(before), signal: controller.signal });
      var answer = await res.json();
      if (turn !== epoch) return;
      if (!res.ok) throw new Error(answer.error || 'Jev request failed.');
      if (!Object.prototype.hasOwnProperty.call(arrows, answer.direction) || !game.move(answer.direction)) throw new Error('Invalid move received.');
      log(answer, before, Math.round(performance.now() - current.clock));
      if (outcome) { finish(); return; }
      status('PLAYING', true);
      // Minimum 220ms makes each key press legible on camera. No synthetic moves.
      timer = setTimeout(next, Math.max(50, 220 - (performance.now() - start)));
    } catch (err) {
      if (turn !== epoch) return;
      cancel(); status('PAUSED'); overlay('PAUSED', '');
      $('notice').textContent = err.name === 'AbortError' ? 'Jev timed out. Resume to retry.' : err.message;
      controls();
    } finally { clearTimeout(timeout); if (request === controller) request = null; }
  }
  function start() {
    if (!ready) return;
    if (current && !current.finishedAt) { current.finishedAt = new Date().toISOString(); current.result = 'restarted'; current.score = game.snapshot().score; }
    cancel(); outcome = null; moves = []; runNumber++;
    current = { run: runNumber, startedAt: new Date().toISOString(), clock: performance.now(), timing: 'decision-paced, minimum 220ms', moves: moves };
    records.push(current);
    $('commands').replaceChildren(); $('empty').hidden = false; $('moves').textContent = '0';
    $('latency').textContent = '···'; $('confidence').textContent = '···'; $('run').textContent = 'RUN ' + String(runNumber).padStart(2, '0');
    $('notice').textContent = ''; sound.unlock(); game.start(); overlay(null); running = true; controls(); next();
  }
  $('start').addEventListener('click', start); $('restart').addEventListener('click', start);
  $('pause').addEventListener('click', function () {
    if (running) { cancel(); status('PAUSED'); overlay('PAUSED', ''); }
    else { running = true; $('notice').textContent = ''; overlay(null); next(); }
    controls();
  });
  $('mute').addEventListener('click', function () {
    sound.unlock(); sound.toggle(); $('mute').textContent = sound.isMuted() ? 'SOUND OFF' : 'SOUND ON';
    $('mute').setAttribute('aria-pressed', String(sound.isMuted()));
  });
  $('fullscreen').addEventListener('click', async function () {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (_) { $('notice').textContent = 'Fullscreen is unavailable in this browser.'; }
  });
  $('export').addEventListener('click', function () {
    var data = { player: 'JEV', best: best, rules: 'Original 24×24 Snake; one cell per Jev decision. Separate from the classic timed leaderboard.', runs: records.map(function (r) {
      var copy = Object.assign({}, r); delete copy.clock; return copy;
    }) };
    var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    var link = document.createElement('a'); link.href = url; link.download = 'jev-snake-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && running) { cancel(); status('PAUSED'); overlay('PAUSED', ''); controls(); }
  });
  window.addEventListener('pagehide', cancel);
  check();
})();
