/* ==========================================================================
   ASTEROIDS

   New build, written to match the 1979 feel rather than a modern shooter:
   vector outlines only (no fills, no sprites), momentum that never fully
   stops, screen wrap on everything, and rocks that split 3 -> 2 -> 2.

   Deliberate fidelity choices:
   - Four bullets on screen, the original's limit, and no auto-fire: one
     press is one shot. Together they are what force you to aim. Auto-repeat
     hands you a four-shot burst for free and undoes both.
   - Waves grow by two rocks from four, capped at eleven, as the original.
   - Thrust accelerates, it does not set velocity. Drag is very light, so
     you are always flying, never driving.
   - Rocks are irregular polygons generated once per rock, so no two look
     alike, and they keep their shape as they tumble.
   - Respawn only when the middle of the screen is clear, otherwise you die
     the instant you come back.

   Scoring follows the original: 20 large, 50 medium, 100 small.
   ========================================================================== */
'use strict';

window.ArcadeGames = window.ArcadeGames || {};

window.ArcadeGames.asteroids = (function () {
  var W = 800, H = 600;            // virtual play space, scaled to the screen

  var SHIP_R = 14;
  var TURN_RATE = 4.4;             // radians/sec
  var THRUST = 320;                // px/sec^2
  var DRAG = 0.42;                 // per second
  var MAX_SPEED = 420;

  var BULLET_SPEED = 520;
  var BULLET_LIFE = 1.15;          // seconds
  var MAX_BULLETS = 4;
  /* Only there to swallow a double-strike from key jitter. It is not a rate
     limiter: the four-bullet cap is the limiter, exactly as it was in 1979. */
  var FIRE_COOLDOWN = 0.06;

  var ROCK_SPEC = {
    3: { r: 52, score: 20,  splits: 2 },
    2: { r: 30, score: 50,  splits: 2 },
    1: { r: 16, score: 100, splits: 0 }
  };

  var START_LIVES = 3;
  var INVULN_TIME = 2.0;

  /* Rocks get faster as the waves go by. The original did this and it is the
     other half of the difficulty curve: more rocks AND quicker ones. */
  var WAVE_SPEED_STEP = 0.09;
  var WAVE_SPEED_MAX = 1.8;

  /* A free ship every 10,000, as the cabinet gave you. It matters more now
     that the saucer shoots back. */
  var EXTRA_LIFE_EVERY = 10000;

  /* The saucer. Two of them, and the small one is the problem: the large
     fires off at nothing in particular, the small one aims at you and gets
     more accurate the better you are doing. 200 and 1000 points are the
     original's values. */
  var SAUCER = {
    2: { r: 21, score: 200,  speed: 104, fire: 1.55 },
    1: { r: 13, score: 1000, speed: 146, fire: 1.05 }
  };
  var SAUCER_BULLET_SPEED = 380;
  var SAUCER_BULLET_LIFE = 1.6;
  var SAUCER_GAP_MAX = 17;         // seconds between saucers, early
  var SAUCER_GAP_MIN = 6;          // ... and once you are scoring well
  var SMALL_FROM_SCORE = 3000;     // below this it is always the large one
  var SMALL_ONLY_SCORE = 40000;    // above this it is always the small one
  var RESPAWN_CLEAR_R = 110;

  var S = window.ArcadeSound;

  function wrap(p) {
    if (p.x < 0) p.x += W; else if (p.x > W) p.x -= W;
    if (p.y < 0) p.y += H; else if (p.y > H) p.y -= H;
  }

  /** Shortest distance with wrap-around considered. */
  function dist2(a, b) {
    var dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if (dx > W / 2) dx = W - dx;
    if (dy > H / 2) dy = H - dy;
    return dx * dx + dy * dy;
  }

  function mount(host, api) {
    var canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var ship, rocks, bullets, debris;
    var saucer = null, foeBullets = [], saucerTimer = 0;
    var waveStartRocks = 1, thrustTimer = 0, waveSpeed = 1;
    var score, lives, wave, invuln, cooldown, nextExtraLife;
    var state = 'idle';
    var keys = {};
    var last = 0, raf = null;
    var scale = 1, offX = 0, offY = 0;

    /* ------------------------------ sizing ------------------------------ */

    function resize() {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';

      // Letterbox the 4:3 play space inside whatever box we are given
      scale = Math.min(r.width / W, r.height / H) * 0.96;
      offX = (r.width - W * scale) / 2;
      offY = (r.height - H * scale) / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host);

    /* ------------------------------ entities ---------------------------- */

    function makeShip() {
      return { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, thrusting: false };
    }

    /** An irregular rock outline, generated once and kept. */
    function makeRock(size, x, y) {
      var spec = ROCK_SPEC[size];
      var pts = [];
      var n = 9 + Math.floor(Math.random() * 4);
      for (var i = 0; i < n; i++) {
        var jitter = 0.68 + Math.random() * 0.5;
        pts.push({ a: (i / n) * Math.PI * 2, r: spec.r * jitter });
      }
      var speed = (26 + Math.random() * 46) * (1 + (3 - size) * 0.28) * waveSpeed;
      var dir = Math.random() * Math.PI * 2;
      return {
        size: size, r: spec.r, x: x, y: y,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        a: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.5,
        pts: pts
      };
    }

    /** Rocks start away from the middle so the wave never spawns on you. */
    function spawnWave(count) {
      rocks = [];
      waveSpeed = Math.min(WAVE_SPEED_MAX, 1 + (wave - 1) * WAVE_SPEED_STEP);
      // A large rock becomes 2 mediums becomes 4 smalls: 7 kills per rock.
      waveStartRocks = count * 7;
      for (var i = 0; i < count; i++) {
        var x, y, guard = 0;
        do {
          x = Math.random() * W;
          y = Math.random() * H;
          guard++;
        } while (guard < 60 && dist2({ x: x, y: y }, { x: W / 2, y: H / 2 }) < 190 * 190);
        rocks.push(makeRock(3, x, y));
      }
    }

    function burst(x, y, n, spread) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var s = spread * (0.3 + Math.random());
        debris.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4 });
      }
    }

    /* ------------------------------- state ------------------------------ */

    function reset() {
      ship = makeShip();
      bullets = [];
      debris = [];
      score = 0;
      lives = START_LIVES;
      wave = 1;
      invuln = INVULN_TIME;
      cooldown = 0;
      nextExtraLife = EXTRA_LIFE_EVERY;
      S.saucer.stop();
      saucer = null;
      foeBullets = [];
      spawnWave(4);
      saucerTimer = nextSaucerGap();
      report();
    }

    function report() {
      api.setStatus({
        value: window.ArcadeNet.formatScore(score),
        extra: 'W' + wave + '  ' + new Array(Math.max(0, lives) + 1).join('▲')
      });
    }

    function start() {
      if (!api.canStart()) return;
      reset();
      state = 'playing';
      api.setState('playing');
      S.heartbeat.start();
      last = performance.now();
    }

    function gameOver() {
      state = 'over';
      S.heartbeat.stop();
      S.saucer.stop();
      api.gameOver({ score: score, display: window.ArcadeNet.formatScore(score) });
    }

    function loseLife() {
      S.die();
      burst(ship.x, ship.y, 16, 150);
      foeBullets = [];        // do not come back into a shot already in flight
      lives--;
      report();
      if (lives <= 0) { gameOver(); return; }
      ship = makeShip();
      invuln = INVULN_TIME;
    }

    /* ------------------------------- input ------------------------------ */

    function onKeyDown(e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      var k = e.key;

      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { keys.thrust = true; e.preventDefault(); }
      else if (k === ' ') {
        e.preventDefault();
        if (state === 'idle') { start(); return; }
        /* One press, one shot. The cabinet had no auto-fire: holding the
           button did nothing until you let go and pressed again, which is
           what makes the four-bullet cap bite. e.repeat is the OS key-repeat
           coming through, and it is exactly what we do not want. */
        if (!e.repeat) fire();
      } else if (k === 'Enter') {
        if (state === 'idle') { e.preventDefault(); start(); }
      } else if (k === 'r' || k === 'R') { e.preventDefault(); start(); }

      if (state === 'idle' && (keys.left || keys.right || keys.thrust)) start();
    }

    function onKeyUp(e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.thrust = false;
      // Space is edge-triggered in onKeyDown; there is no held fire state.
    }

    function onPointerDown() { if (state === 'idle') start(); }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    host.addEventListener('pointerdown', onPointerDown);

    /* ------------------------------- update ----------------------------- */

    function fire() {
      if (bullets.length >= MAX_BULLETS || cooldown > 0) return;
      bullets.push({
        x: ship.x + Math.cos(ship.a) * SHIP_R,
        y: ship.y + Math.sin(ship.a) * SHIP_R,
        vx: ship.vx + Math.cos(ship.a) * BULLET_SPEED,
        vy: ship.vy + Math.sin(ship.a) * BULLET_SPEED,
        life: BULLET_LIFE
      });
      cooldown = FIRE_COOLDOWN;
      S.fire();
    }

    /* ------------------------------ the saucer --------------------------- */

    function nextSaucerGap() {
      var t = SAUCER_GAP_MAX -
              (SAUCER_GAP_MAX - SAUCER_GAP_MIN) * Math.min(1, score / 30000);
      return t * (0.7 + Math.random() * 0.6);
    }

    /** Large early, small late, a coin toss weighted by score in between. */
    function saucerSize() {
      if (score < SMALL_FROM_SCORE) return 2;
      if (score >= SMALL_ONLY_SCORE) return 1;
      var p = (score - SMALL_FROM_SCORE) / (SMALL_ONLY_SCORE - SMALL_FROM_SCORE);
      return Math.random() < p ? 1 : 2;
    }

    function spawnSaucer() {
      var size = saucerSize();
      var spec = SAUCER[size];
      var fromLeft = Math.random() < 0.5;
      saucer = {
        size: size,
        r: spec.r,
        x: fromLeft ? -spec.r * 2 : W + spec.r * 2,
        y: 50 + Math.random() * (H - 100),
        vx: (fromLeft ? 1 : -1) * spec.speed,
        vy: 0,
        fireTimer: spec.fire * 0.7,
        jogTimer: 0.5 + Math.random() * 1.1
      };
      S.saucer.start(size);
    }

    /** scored: true when the player shot it, false when it simply left. */
    function killSaucer(scored) {
      if (!saucer) return;
      if (scored) {
        score += SAUCER[saucer.size].score;
        S.rock(saucer.size === 1 ? 1 : 2);
        burst(saucer.x, saucer.y, 16, 130);
        report();
        checkExtraLife();
      }
      S.saucer.stop();
      saucer = null;
      saucerTimer = nextSaucerGap();
    }

    function saucerFire() {
      var a;
      if (saucer.size === 1) {
        /* The small one aims, and its error shrinks as you score - which is
           what makes it the dangerous one rather than just the smaller one.
           Aim across the wrap, or it shoots the long way round. */
        var dx = ship.x - saucer.x, dy = ship.y - saucer.y;
        if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
        if (dy > H / 2) dy -= H; else if (dy < -H / 2) dy += H;
        var err = Math.max(0.035, 0.4 - (score / 60000) * 0.36);
        a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2 * err;
      } else {
        a = Math.random() * Math.PI * 2;
      }
      foeBullets.push({
        x: saucer.x + Math.cos(a) * saucer.r,
        y: saucer.y + Math.sin(a) * saucer.r,
        vx: Math.cos(a) * SAUCER_BULLET_SPEED,
        vy: Math.sin(a) * SAUCER_BULLET_SPEED,
        life: SAUCER_BULLET_LIFE
      });
      S.saucerFire();
    }

    function checkExtraLife() {
      while (score >= nextExtraLife) {
        lives++;
        nextExtraLife += EXTRA_LIFE_EVERY;
        S.extraLife();
        report();
      }
    }

    function splitRock(rock) {
      var spec = ROCK_SPEC[rock.size];
      score += spec.score;
      checkExtraLife();
      S.rock(rock.size);
      burst(rock.x, rock.y, rock.size * 4, 90);
      for (var i = 0; i < spec.splits; i++) {
        rocks.push(makeRock(rock.size - 1, rock.x, rock.y));
      }
    }

    function centreIsClear() {
      var c = { x: W / 2, y: H / 2 };
      for (var i = 0; i < rocks.length; i++) {
        if (dist2(rocks[i], c) < (RESPAWN_CLEAR_R + rocks[i].r) * (RESPAWN_CLEAR_R + rocks[i].r)) {
          return false;
        }
      }
      return true;
    }

    function update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      if (invuln > 0) invuln -= dt;

      /* ship */
      if (keys.left) ship.a -= TURN_RATE * dt;
      if (keys.right) ship.a += TURN_RATE * dt;
      ship.thrusting = !!keys.thrust;
      if (ship.thrusting) {
        ship.vx += Math.cos(ship.a) * THRUST * dt;
        ship.vy += Math.sin(ship.a) * THRUST * dt;
        thrustTimer -= dt;
        if (thrustTimer <= 0) { S.thrust(); thrustTimer = 0.085; }
      } else {
        thrustTimer = 0;
      }
      var drag = Math.max(0, 1 - DRAG * dt);
      ship.vx *= drag; ship.vy *= drag;
      var sp = Math.hypot(ship.vx, ship.vy);
      if (sp > MAX_SPEED) { ship.vx = ship.vx / sp * MAX_SPEED; ship.vy = ship.vy / sp * MAX_SPEED; }
      ship.x += ship.vx * dt; ship.y += ship.vy * dt;
      wrap(ship);

      /* bullets */
      for (var i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        wrap(b);
        if (b.life <= 0) bullets.splice(i, 1);
      }

      /* the saucer: across the screen, jogging up and down, shooting */
      if (saucer) {
        saucer.jogTimer -= dt;
        if (saucer.jogTimer <= 0) {
          // It changes lane sometimes and holds course otherwise, which is
          // what gives it the stepped diagonal path rather than a straight run.
          saucer.vy = Math.random() < 0.45
            ? (Math.random() < 0.5 ? -1 : 1) * SAUCER[saucer.size].speed * 0.55
            : 0;
          saucer.jogTimer = 0.5 + Math.random() * 1.2;
        }
        saucer.x += saucer.vx * dt;
        saucer.y += saucer.vy * dt;
        if (saucer.y < 0) saucer.y += H; else if (saucer.y > H) saucer.y -= H;

        if (saucer.x < -70 || saucer.x > W + 70) {
          killSaucer(false);            // it made it across; no points
        } else {
          saucer.fireTimer -= dt;
          if (saucer.fireTimer <= 0) {
            saucerFire();
            saucer.fireTimer = SAUCER[saucer.size].fire;
          }
        }
      } else {
        saucerTimer -= dt;
        if (saucerTimer <= 0) spawnSaucer();
      }

      /* the saucer's bullets */
      for (var fb = foeBullets.length - 1; fb >= 0; fb--) {
        var f = foeBullets[fb];
        f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
        wrap(f);
        if (f.life <= 0) foeBullets.splice(fb, 1);
      }

      /* rocks */
      for (var j = 0; j < rocks.length; j++) {
        var rk = rocks[j];
        rk.x += rk.vx * dt; rk.y += rk.vy * dt; rk.a += rk.spin * dt;
        wrap(rk);
      }

      /* debris */
      for (var d = debris.length - 1; d >= 0; d--) {
        var p = debris[d];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) debris.splice(d, 1);
      }

      /* bullet -> rock */
      for (var bi = bullets.length - 1; bi >= 0; bi--) {
        for (var ri = rocks.length - 1; ri >= 0; ri--) {
          if (dist2(bullets[bi], rocks[ri]) < rocks[ri].r * rocks[ri].r) {
            var hit = rocks[ri];
            rocks.splice(ri, 1);
            bullets.splice(bi, 1);
            splitRock(hit);
            report();
            break;
          }
        }
      }

      /* bullet -> saucer */
      if (saucer) {
        for (var sb = bullets.length - 1; sb >= 0; sb--) {
          if (dist2(bullets[sb], saucer) < saucer.r * saucer.r) {
            bullets.splice(sb, 1);
            killSaucer(true);
            break;
          }
        }
      }

      /* the saucer's own shots break rocks too, same as the original */
      for (var fi = foeBullets.length - 1; fi >= 0; fi--) {
        for (var fr = rocks.length - 1; fr >= 0; fr--) {
          if (dist2(foeBullets[fi], rocks[fr]) < rocks[fr].r * rocks[fr].r) {
            var fhit = rocks[fr];
            rocks.splice(fr, 1);
            foeBullets.splice(fi, 1);
            // No score: you did not shoot it.
            S.rock(fhit.size);
            burst(fhit.x, fhit.y, fhit.size * 4, 90);
            for (var fs = 0; fs < ROCK_SPEC[fhit.size].splits; fs++) {
              rocks.push(makeRock(fhit.size - 1, fhit.x, fhit.y));
            }
            break;
          }
        }
      }

      /* a rock takes the saucer out as readily as it takes you out */
      if (saucer) {
        for (var sr = rocks.length - 1; sr >= 0; sr--) {
          var srad = rocks[sr].r + saucer.r;
          if (dist2(saucer, rocks[sr]) < srad * srad) {
            var srock = rocks[sr];
            rocks.splice(sr, 1);
            splitRock(srock);
            burst(saucer.x, saucer.y, 14, 120);
            S.rock(2);
            S.saucer.stop();
            saucer = null;
            saucerTimer = nextSaucerGap();
            report();
            break;
          }
        }
      }

      /* rock -> ship */
      if (invuln <= 0) {
        for (var k = 0; k < rocks.length; k++) {
          var rad = rocks[k].r + SHIP_R * 0.7;
          if (dist2(ship, rocks[k]) < rad * rad) { loseLife(); break; }
        }
      }

      /* saucer and its shots -> ship */
      if (invuln <= 0 && state === 'playing') {
        for (var fs2 = foeBullets.length - 1; fs2 >= 0; fs2--) {
          if (dist2(ship, foeBullets[fs2]) < (SHIP_R * 0.8) * (SHIP_R * 0.8)) {
            foeBullets.splice(fs2, 1);
            loseLife();
            break;
          }
        }
      }
      if (saucer && invuln <= 0 && state === 'playing') {
        var crad = saucer.r + SHIP_R * 0.7;
        if (dist2(ship, saucer) < crad * crad) {
          burst(saucer.x, saucer.y, 14, 120);
          S.saucer.stop();
          saucer = null;
          saucerTimer = nextSaucerGap();
          loseLife();
        }
      }

      // The heartbeat quickens as the field empties, and resets each wave.
      var remaining = rocks.reduce(function (n, r) {
        return n + (r.size === 3 ? 7 : r.size === 2 ? 3 : 1);
      }, 0);
      S.heartbeat.setRate(1 - remaining / Math.max(1, waveStartRocks));

      /* next wave */
      if (!rocks.length) {
        wave++;
        invuln = Math.max(invuln, 1.0);
        /* The original went up by two a wave from four, capping at eleven:
           4, 6, 8, 10, 11. This was 3 + wave, which is one a wave, so it
           took twice as long to get hard. */
        spawnWave(Math.min(11, 2 + wave * 2));
        report();
      }

      /* respawn safety: hold the ship still until the middle clears */
      if (invuln > 0 && invuln < INVULN_TIME - 0.2 && !centreIsClear() &&
          Math.abs(ship.x - W / 2) < 2 && Math.abs(ship.y - H / 2) < 2) {
        invuln += dt;   // wait it out rather than dying on arrival
      }
    }

    /* -------------------------------- draw ------------------------------ */

    function poly(pts, close) {
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
        else ctx.lineTo(pts[i][0], pts[i][1]);
      }
      if (close) ctx.closePath();
      ctx.stroke();
    }

    function draw() {
      if (!scale) return;
      var p = api.palette();
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.save();
      ctx.translate(offX, offY);
      ctx.scale(scale, scale);
      ctx.lineWidth = 2 / scale * 1.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (!ship) { ctx.restore(); return; }

      /* rocks */
      ctx.strokeStyle = p.name;
      ctx.shadowColor = p.name;
      ctx.shadowBlur = 8;
      for (var i = 0; i < rocks.length; i++) {
        var rk = rocks[i];
        ctx.save();
        ctx.translate(rk.x, rk.y);
        ctx.rotate(rk.a);
        ctx.beginPath();
        for (var j = 0; j < rk.pts.length; j++) {
          var pt = rk.pts[j];
          var px = Math.cos(pt.a) * pt.r, py = Math.sin(pt.a) * pt.r;
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      /* bullets */
      ctx.strokeStyle = p.hot;
      ctx.shadowColor = p.hot;
      for (var b = 0; b < bullets.length; b++) {
        ctx.beginPath();
        ctx.arc(bullets[b].x, bullets[b].y, 2.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      /* the saucer: hull, waistline, dome - all outline, like everything else */
      if (saucer) {
        var sr = saucer.r;
        ctx.strokeStyle = p.accent;
        ctx.shadowColor = p.accent;
        ctx.save();
        ctx.translate(saucer.x, saucer.y);
        poly([[-sr, 0], [-sr * 0.45, -sr * 0.42], [sr * 0.45, -sr * 0.42],
              [sr, 0], [sr * 0.5, sr * 0.4], [-sr * 0.5, sr * 0.4]], true);
        poly([[-sr, 0], [sr, 0]], false);
        poly([[-sr * 0.42, -sr * 0.42], [-sr * 0.2, -sr * 0.8],
              [sr * 0.2, -sr * 0.8], [sr * 0.42, -sr * 0.42]], false);
        ctx.restore();

        /* its shots, same colour as it, so you can read where they came from */
        for (var fbd = 0; fbd < foeBullets.length; fbd++) {
          ctx.beginPath();
          ctx.arc(foeBullets[fbd].x, foeBullets[fbd].y, 2.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (foeBullets.length) {
        ctx.strokeStyle = p.accent;
        ctx.shadowColor = p.accent;
        for (var fbo = 0; fbo < foeBullets.length; fbo++) {
          ctx.beginPath();
          ctx.arc(foeBullets[fbo].x, foeBullets[fbo].y, 2.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      /* debris */
      ctx.strokeStyle = p.accent;
      for (var d = 0; d < debris.length; d++) {
        var dp = debris[d];
        ctx.globalAlpha = Math.max(0, dp.life);
        ctx.beginPath();
        ctx.moveTo(dp.x, dp.y);
        ctx.lineTo(dp.x - dp.vx * 0.02, dp.y - dp.vy * 0.02);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* ship - blinks while invulnerable */
      var showShip = invuln <= 0 || Math.floor(invuln * 10) % 2 === 0;
      if (showShip && state !== 'over') {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.a);
        ctx.strokeStyle = p.score;
        ctx.shadowColor = p.score;
        poly([[SHIP_R, 0], [-SHIP_R * 0.8, SHIP_R * 0.72],
              [-SHIP_R * 0.45, 0], [-SHIP_R * 0.8, -SHIP_R * 0.72]], true);
        if (ship.thrusting && Math.random() > 0.25) {
          ctx.strokeStyle = p.hot;
          poly([[-SHIP_R * 0.5, SHIP_R * 0.34],
                [-SHIP_R * (1.1 + Math.random() * 0.5), 0],
                [-SHIP_R * 0.5, -SHIP_R * 0.34]], false);
        }
        ctx.restore();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* -------------------------------- loop ------------------------------ */

    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (state === 'playing') update(dt);
      draw();
    }

    reset();
    resize();
    api.setState('idle');
    last = performance.now();
    raf = requestAnimationFrame(frame);

    return {
      start: start,
      repaint: draw,
      resize: resize,
      destroy: function () {
        S.heartbeat.stop();
        S.saucer.stop();
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        host.removeEventListener('pointerdown', onPointerDown);
        if (ro) ro.disconnect();
        canvas.remove();
      }
    };
  }

  return {
    id: 'asteroids',
    name: 'ASTEROIDS',
    mode: 'classic',
    metric: 'score',
    attract: 'SPLIT THE ROCKS. MIND THE SAUCER.',
    controls: 'ARROWS TURN AND THRUST  /  SPACE FIRES',
    mount: mount
  };
})();
