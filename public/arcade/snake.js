/* ==========================================================================
   SNAKE

   Ported from repos/arcade/assets/snake.js. The mechanics are unchanged:
   24x24 grid, fixed-timestep loop (rAF + accumulator), a direction queue
   that compares against the last *queued* direction so two fast keypresses
   inside one tick cannot fold the snake back on itself, and a speed ramp
   of 3.5ms per food from 130ms down to a 60ms floor.

   What was dropped: the page chrome. No HUD elements, no submit form, no
   mini-scoreboard. The cabinet owns all of that now, and the
   leaderboard lives in the rail.
   ========================================================================== */
'use strict';

window.ArcadeGames = window.ArcadeGames || {};

window.ArcadeGames.snake = (function () {
  var GRID = 24;
  var START_TICK_MS = 130;
  var MIN_TICK_MS = 60;
  var TICK_STEP_PER_FOOD = 3.5;
  var MAX_DT = 250;              // clamp huge gaps after a tab switch

  var DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 }
  };

  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };

  var S = window.ArcadeSound;

  function opposite(a, b) { return a.x + b.x === 0 && a.y + b.y === 0; }
  function key(x, y) { return x + ',' + y; }

  function mount(host, api, options) {
    var controlled = !!(options && options.controlled);
    var ticks = 0;
    var view = document.createElement('div');
    view.className = 'snake-view';
    host.classList.add('has-snake');
    host.appendChild(view);
    var canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    view.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var controls = document.createElement('div');
    controls.className = 'snake-controls';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'snake-pad-toggle';
    toggle.textContent = 'Arrow buttons';
    controls.appendChild(toggle);
    var pad = document.createElement('div');
    pad.className = 'snake-pad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'Snake direction');
    controls.appendChild(pad);
    host.appendChild(controls);
    var padEnabled = false;
    try { padEnabled = localStorage.getItem('arcade-snake-pad') === '1'; } catch (_) { /* Optional preference. */ }
    function syncPad() {
      pad.hidden = !padEnabled;
      toggle.setAttribute('aria-pressed', String(padEnabled));
      host.classList.toggle('has-snake-pad', padEnabled);
    }
    syncPad();
    toggle.addEventListener('click', function () {
      padEnabled = !padEnabled;
      syncPad();
      try { localStorage.setItem('arcade-snake-pad', padEnabled ? '1' : '0'); } catch (_) { /* Keep this session usable. */ }
      resize();
    });
    ['up', 'left', 'down', 'right'].forEach(function (name) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'snake-key snake-key-' + name;
      button.textContent = { up: '↑', left: '←', down: '↓', right: '→' }[name];
      button.setAttribute('aria-label', 'Turn ' + name);
      function turn() {
        if (state === 'idle') start();
        if (state === 'playing') queueDir(name);
      }
      button.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        turn();
      });
      button.addEventListener('click', function (e) { if (e.detail === 0) turn(); });
      pad.appendChild(button);
    });

    var snake, occupied, dir, dirQueue, food, score, tickMs, acc, last, raf;
    /* Attract-mode demo: while nobody is playing, the screen replays Jev's
       best game through these same rules. A recording is the apple spawned
       on each tick and the direction taken on each step that turned. Any
       start ends the demo and resets to an ordinary game. */
    var demo = null;
    var state = 'idle';          // idle | playing | paused | over
    var cell = 0, ox = 0, oy = 0;

    /* ------------------------------ sizing ------------------------------ */

    function resize() {
      var r = view.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Square play area, centred, with a little breathing room
      var phone = !controlled && window.ArcadePhone && window.ArcadePhone.active;
      var side = Math.min(r.width, r.height) * (phone ? 1 : 0.92);
      cell = Math.floor(side / GRID);
      ox = Math.round((r.width - cell * GRID) / 2);
      oy = Math.round((r.height - cell * GRID) / 2);
      draw();
    }

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(view);

    /* ------------------------------- state ------------------------------- */

    function reset() {
      ticks = 0;
      snake = [];
      occupied = new Set();
      var cy = Math.floor(GRID / 2);
      for (var i = 0; i < 3; i++) {
        var seg = { x: 8 - i, y: cy };
        snake.push(seg);
        occupied.add(key(seg.x, seg.y));
      }
      dir = DIRS.right;
      dirQueue = [];
      score = 0;
      tickMs = START_TICK_MS;
      acc = 0;
      spawnFood();
      report();
    }

    function spawnFood() {
      var free = [];
      for (var y = 0; y < GRID; y++) {
        for (var x = 0; x < GRID; x++) {
          if (!occupied.has(key(x, y))) free.push({ x: x, y: y });
        }
      }
      var planned = demo && demo.running && demo.foods[ticks];
      if (planned && !occupied.has(key(planned.x, planned.y))) { food = { x: planned.x, y: planned.y }; return; }
      food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
    }

    function report() {
      api.setStatus({
        value: window.ArcadeNet.formatScore(score),
        extra: (START_TICK_MS / tickMs).toFixed(1).replace(/\.0$/, '') + 'x'
      });
    }

    /* ------------------------------- input ------------------------------- */

    function queueDir(name) {
      var d = DIRS[name];
      if (!d) return;
      // Compare against the last *effective* direction - the tail of the
      // queue, or the live direction if the queue is empty. This is what
      // stops the two-keypresses-in-one-tick 180 reversal.
      var ref = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
      if (d === ref || opposite(d, ref)) return;
      if (dirQueue.length < 3) { dirQueue.push(d); S.turn(); }
    }

    function onKey(e) {
      if (controlled) return;
      var tag = e.target && e.target.tagName;
      if (e.defaultPrevented || /^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/.test(tag) || (e.target && e.target.isContentEditable)) return;

      if (KEYMAP[e.key]) {
        e.preventDefault();
        if (state === 'idle') start();
        else if (state === 'playing') queueDir(KEYMAP[e.key]);
        return;
      }
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        if (state === 'over') return;
        e.preventDefault();
        if (state === 'idle') start();
        else if (state === 'playing') pause();
        else if (state === 'paused') resume();
        return;
      }
      if (e.key === 'Enter') {
        if (state === 'idle') { e.preventDefault(); start(); }
        else if (state === 'paused') { e.preventDefault(); resume(); }
        return;
      }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); start(); }
    }
    document.addEventListener('keydown', onKey);

    /* Tap or swipe on the screen itself */
    var touchStart = null;
    function onPointerDown(e) {
      if (controlled) return;
      if (e.button !== 0 || touchStart || state === 'paused' || state === 'over') return;
      if (state === 'idle') start();
      if (state !== 'playing') return;
      touchStart = { id: e.pointerId, x: e.clientX, y: e.clientY, turned: false };
      try { view.setPointerCapture(e.pointerId); } catch (_) { /* Pointer may already have ended. */ }
    }
    function onPointerMove(e) {
      if (!touchStart || touchStart.id !== e.pointerId || touchStart.turned || state !== 'playing') return;
      var dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
      var ax = Math.abs(dx), ay = Math.abs(dy);
      // Decide while the finger is moving. Ambiguous diagonals wait until one
      // axis clearly wins; one gesture still queues at most one direction.
      if (Math.max(ax, ay) < 18 || Math.max(ax, ay) < Math.min(ax, ay) * 1.2) return;
      touchStart.turned = true;
      if (ax > ay) queueDir(dx > 0 ? 'right' : 'left');
      else queueDir(dy > 0 ? 'down' : 'up');
    }
    function clearPointer(e) {
      if (!touchStart || (e && e.pointerId !== touchStart.id)) return;
      var id = touchStart.id;
      touchStart = null;
      try { if (view.hasPointerCapture(id)) view.releasePointerCapture(id); } catch (_) { /* Already released. */ }
    }
    function onPointerUp(e) {
      if (controlled) return; onPointerMove(e); clearPointer(e); }
    view.addEventListener('pointerdown', onPointerDown);
    view.addEventListener('pointermove', onPointerMove);
    view.addEventListener('pointerup', onPointerUp);
    view.addEventListener('pointercancel', clearPointer);
    view.addEventListener('lostpointercapture', clearPointer);

    /* --------------------------- transitions --------------------------- */

    function start() {
      if (!api.canStart()) return;
      if (demo) demo.running = false;
      clearPointer();
      reset();
      state = 'playing';
      api.setState('playing');
      last = performance.now();
    }

    function pause() {
      if (state !== 'playing') return;
      clearPointer();
      state = 'paused';
      api.setState('paused');
    }

    function resume() {
      if (state !== 'paused') return;
      state = 'playing';
      acc = 0;
      last = performance.now();
      api.setState('playing');
    }

    function gameOver() {
      if (demo && demo.running) { demo.running = false; demo.endedAt = performance.now(); return; }
      clearPointer();
      state = 'over';
      S.die();
      api.gameOver({ score: score, display: window.ArcadeNet.formatScore(score) });
    }

    /* ------------------------------- tick ------------------------------- */

    function step() {
      var playing = !(demo && demo.running);
      if (playing && api.beforeStep) api.beforeStep();
      ticks++;
      if (!playing) {
        var turned = demo.moves[ticks];
        if (turned) { dir = DIRS[turned]; if (api.jevKey) api.jevKey(turned); }
      }
      else if (dirQueue.length) dir = dirQueue.shift();

      var head = snake[0];
      var nx = head.x + dir.x;
      var ny = head.y + dir.y;

      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) { gameOver(); return; }

      var tail = snake[snake.length - 1];
      var eating = food && nx === food.x && ny === food.y;

      // The tail vacates this tick unless we are eating, so moving into the
      // current tail cell is legal. Check that before the occupied test.
      if (occupied.has(key(nx, ny)) && !(!eating && nx === tail.x && ny === tail.y)) {
        gameOver();
        return;
      }

      var next = { x: nx, y: ny };
      snake.unshift(next);
      occupied.add(key(nx, ny));

      if (eating) {
        score += 10;
        if (playing) S.eat();
        tickMs = Math.max(MIN_TICK_MS, tickMs - TICK_STEP_PER_FOOD);
        spawnFood();
        report();
        if (!food) gameOver();
      } else {
        var gone = snake.pop();
        if (gone.x !== nx || gone.y !== ny) occupied.delete(key(gone.x, gone.y));
      }
    }

    /* ------------------------------- draw ------------------------------- */

    function draw() {
      if (!cell) return;
      var p = api.palette();
      var w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Playfield border
      ctx.strokeStyle = p.dim;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 0.5, oy + 0.5, cell * GRID - 1, cell * GRID - 1);
      ctx.globalAlpha = 1;

      if (!snake) return;

      // Food
      if (food) {
        ctx.fillStyle = p.hot;
        ctx.shadowColor = p.hot;
        ctx.shadowBlur = 12;
        var fpad = Math.max(1, Math.floor(cell * 0.22));
        ctx.fillRect(ox + food.x * cell + fpad, oy + food.y * cell + fpad,
                     cell - fpad * 2, cell - fpad * 2);
        ctx.shadowBlur = 0;
      }

      // Body, head brightest
      var pad = Math.max(1, Math.floor(cell * 0.1));
      for (var i = snake.length - 1; i >= 0; i--) {
        var s = snake[i];
        ctx.fillStyle = i === 0 ? p.name : p.accent;
        if (i === 0) { ctx.shadowColor = p.name; ctx.shadowBlur = 10; }
        ctx.fillRect(ox + s.x * cell + pad, oy + s.y * cell + pad,
                     cell - pad * 2, cell - pad * 2);
        ctx.shadowBlur = 0;
      }
    }

    /* ------------------------------- loop ------------------------------- */

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (state === 'playing' && !controlled) {
        var dt = Math.min(now - last, MAX_DT);
        last = now;
        acc += dt;
        while (acc >= tickMs && state === 'playing') {
          acc -= tickMs;
          step();
        }
      } else if (state === 'idle' && demo && !controlled) {
        // Same clock as a real game. After the recorded death, hold the
        // final frame a moment and play it again.
        if (demo.running) {
          acc += Math.min(now - last, MAX_DT);
          while (acc >= tickMs && demo.running) { acc -= tickMs; step(); }
        } else if (now - demo.endedAt > 2500) beginDemo();
        last = now;
      } else {
        last = now;
      }
      draw();
    }

    function beginDemo() {
      if (!demo || state !== 'idle') return;
      demo.running = true;
      reset();
      if (api.demoStart) api.demoStart();
      last = performance.now();
    }
    function setDemo(recording) {
      if (!recording || !Array.isArray(recording.foods) || !Array.isArray(recording.moves)) return false;
      var foods = {}, moves = {};
      recording.foods.forEach(function (f) { if (f && Number.isInteger(f.t) && Number.isInteger(f.x) && Number.isInteger(f.y)) foods[f.t] = { x: f.x, y: f.y }; });
      recording.moves.forEach(function (m) { if (m && Number.isInteger(m.t) && DIRS[m.d]) moves[m.t] = m.d; });
      demo = { foods: foods, moves: moves, running: false, endedAt: 0 };
      beginDemo();
      return true;
    }

    reset();
    resize();
    api.setState('idle');
    raf = requestAnimationFrame(frame);
    if (api.loadReplay) api.loadReplay().then(function (r) { if (r && setDemo(r) && api.demoReady) api.demoReady(r); }, function () {});

    return {
      start: start,
      setDemo: setDemo,
      setControlled: function (value) {
        if (state === 'playing' || state === 'paused') return false;
        controlled = !!value;
        acc = 0;
        return true;
      },
      snapshot: function () {
        return { grid: GRID, tick: ticks, tickMs: tickMs, snake: snake.map(function (p) { return { x: p.x, y: p.y }; }),
          food: food && { x: food.x, y: food.y },
          direction: Object.keys(DIRS).filter(function (k) { return DIRS[k] === dir; })[0],
          score: score, state: state };
      },
      move: function (name) {
        if (!controlled || state !== 'playing' || !Object.prototype.hasOwnProperty.call(DIRS, name) || opposite(DIRS[name], dir)) return false;
        dir = DIRS[name];
        step();
        draw();
        return true;
      },
      pause: pause,
      resume: resume,
      getState: function () { return state; },
      repaint: draw,
      resize: resize,
      destroy: function () {
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        clearPointer();
        view.removeEventListener('pointerdown', onPointerDown);
        view.removeEventListener('pointermove', onPointerMove);
        view.removeEventListener('pointerup', onPointerUp);
        view.removeEventListener('pointercancel', clearPointer);
        view.removeEventListener('lostpointercapture', clearPointer);
        if (ro) ro.disconnect();
        view.remove();
        controls.remove();
        host.classList.remove('has-snake', 'has-snake-pad');
      }
    };
  }

  return {
    id: 'snake',
    name: 'SNAKE',
    mode: 'classic',
    metric: 'score',
    attract: 'EAT. GROW. DO NOT BITE YOURSELF.',
    controls: 'ARROWS OR WASD',
    touchControls: 'SWIPE TO TURN',
    mount: mount
  };
})();
