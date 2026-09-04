/* ==========================================================================
   SNAKE

   Ported from repos/arcade/assets/snake.js. The mechanics are unchanged:
   24x24 grid, fixed-timestep loop (rAF + accumulator), a direction queue
   that compares against the last *queued* direction so two fast keypresses
   inside one tick cannot fold the snake back on itself, and a speed ramp
   of 3.5ms per food from 130ms down to a 60ms floor.

   What was dropped: the page chrome. No HUD elements, no submit form, no
   mini-scoreboard, no D-pad. The cabinet owns all of that now, and the
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

  function mount(host, api) {
    var canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var snake, occupied, dir, dirQueue, food, score, tickMs, acc, last, raf;
    var state = 'idle';          // idle | playing | paused | over
    var cell = 0, ox = 0, oy = 0;

    /* ------------------------------ sizing ------------------------------ */

    function resize() {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Square play area, centred, with a little breathing room
      var side = Math.min(r.width, r.height) * 0.92;
      cell = Math.floor(side / GRID);
      ox = Math.round((r.width - cell * GRID) / 2);
      oy = Math.round((r.height - cell * GRID) / 2);
      draw();
    }

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host);

    /* ------------------------------- state ------------------------------- */

    function reset() {
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
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

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
      if (state === 'idle') start();
      else if (state === 'paused') resume();
      touchStart = { x: e.clientX, y: e.clientY };
    }
    function onPointerUp(e) {
      if (!touchStart || state !== 'playing') { touchStart = null; return; }
      var dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
      touchStart = null;
      var ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < 24) return;
      if (ax > ay) queueDir(dx > 0 ? 'right' : 'left');
      else queueDir(dy > 0 ? 'down' : 'up');
    }
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointerup', onPointerUp);

    /* --------------------------- transitions --------------------------- */

    function start() {
      if (!api.canStart()) return;
      reset();
      state = 'playing';
      api.setState('playing');
      last = performance.now();
    }

    function pause() {
      state = 'paused';
      api.setState('paused');
    }

    function resume() {
      state = 'playing';
      acc = 0;
      last = performance.now();
      api.setState('playing');
    }

    function gameOver() {
      state = 'over';
      S.die();
      api.gameOver({ score: score, display: window.ArcadeNet.formatScore(score) });
    }

    /* ------------------------------- tick ------------------------------- */

    function step() {
      if (dirQueue.length) dir = dirQueue.shift();

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
        S.eat();
        tickMs = Math.max(MIN_TICK_MS, tickMs - TICK_STEP_PER_FOOD);
        spawnFood();
        report();
      } else {
        var gone = snake.pop();
        occupied.delete(key(gone.x, gone.y));
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
      if (state === 'playing') {
        var dt = Math.min(now - last, MAX_DT);
        last = now;
        acc += dt;
        while (acc >= tickMs && state === 'playing') {
          acc -= tickMs;
          step();
        }
      } else {
        last = now;
      }
      draw();
    }

    reset();
    resize();
    api.setState('idle');
    raf = requestAnimationFrame(frame);

    return {
      start: start,
      repaint: draw,
      resize: resize,
      destroy: function () {
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        host.removeEventListener('pointerdown', onPointerDown);
        host.removeEventListener('pointerup', onPointerUp);
        if (ro) ro.disconnect();
        canvas.remove();
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
    mount: mount
  };
})();
