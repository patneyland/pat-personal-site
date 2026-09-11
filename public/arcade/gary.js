/* ==========================================================================
   Gary, working the arcade floor.

   Same drawings and the same walk as the Gary on /fun - the sprite sheets in
   /assets are shared - but none of the chat. This page is a standalone
   document, so the React component cannot be imported; the walk maths below
   is carried over from GaryPacing.tsx rather than reinvented, which is why
   the constants match it exactly.

   What he does here:
     - starts in the rail, left of the coin plate, pointing at the slot
     - once a coin drops, walks to the rail's edge, steps off onto the
       cabinet's chin, and walks over to the dial
     - if you click him, he tells you to get back to the game

   The standing sheet is the pointing pair. Unflipped, the arm is on his
   left; flipped, on his right. At the coin he stands left of the plate
   and is flipped, so the arm aims at the slot. At the dial he stands
   right of the game list, unflipped, so it aims at the knob. Centre
   stage on the bezel put that same arm over empty plastic.

   He is mounted on .layout, not .bezel. The coin lives in the rail, a
   sibling of the cabinet, and the slot sits ~90px above the bezel chin.
   A bezel child cannot stand next to it. Layout is the box that holds
   both columns, so both stations and the walk between them share one
   coordinate system: x,y from the layout's top-left.

   The two floors are real. He does not diagonal-slide from plate to chin;
   he walks, steps off, and walks. The hop is 0.42s. The walk is /fun's
   pace, which makes the chin crossing long. That is the cost of standing
   at the slot. Do not raise FPS to shorten it: arcade Gary and /fun Gary
   are the same man.

   The one rule that matters: his speed is derived, not chosen. The sprite
   advances a fixed distance per walk cycle, so travel-per-second has to equal
   stride-per-cycle or his feet slide. See SPEED below.
   ========================================================================== */
'use strict';

window.ArcadeGary = (function () {
  var FRAMES = 8;            // cells in gary-pace.png
  /* 12, the same as /fun. The coin-to-dial crossing is the width of the
     cabinet, ~18s at this pace. That is slow and it is correct. Raising
     FPS would hurry him, and then the Gary on this page would not be the
     Gary on /fun. */
  var FPS = 12;
  var FACING_FRAMES = 2;     // cells in gary-facing.png
  var FACING_CYCLE = 1.6;    // seconds for both standing poses

  /* 72, the same as /fun, and half the 144px sheet cell so he stays crisp.
     With FPS matched too, SPEED below comes out identical to /fun's: same
     stride, same cadence, same pace. He is also then about the height of
     the dial knob he stands beside (79px) and of the slot plate (79px). */
  var HEIGHT = 72;                       // display height, px
  var ASPECT = 114 / 144;                // one cell in the sheet
  var WIDTH = Math.round(HEIGHT * ASPECT);

  /* 98px of travel per cycle on a 177px-tall figure, measured off the
     drawings. At HEIGHT px tall that is STRIDE px per cycle, and a cycle
     lasts FRAMES/FPS seconds. */
  var STRIDE = HEIGHT * (98 / 177);
  var CYCLE = FRAMES / FPS;
  var SPEED = STRIDE / CYCLE;            // px per second. Do not round.

  var GAP = 14;              // how far he stands off the dial
  /* The pointing hand is the sprite's edge, so a small gap is the whole
     aim. 8px leaves the hand next to the plate without covering the slot. */
  var COIN_GAP = 8;
  /* His feet sit this far above the bezel's bottom edge at the dial.
     3px is where the base of the dial knob lands, so the two share a
     floor line. */
  var FOOT = 3;
  var EDGE = 8;              // never nearer than this to either end of the bezel
  var HOP = 0.42;            // seconds, the drop off the rail onto the chin
  /* Under 1000px the layout stacks the rail below the cabinet, and the
     two stations are a screen apart. Matches the query in index.html. */
  var MIN_WIDTH = 1001;

  var LINES = {
    coin: 'Click the coin to drop it in the slot.',
    dial: 'Click the dial to switch to a different game.',
    shush: "Stay focused on the game, this isn't a time for talk."
  };

  var sprite, bubble, root, stage, bezel;
  var x = 0, y = 0;          // top-left, px from .layout's top-left
  var facing = 1;            // 1 as drawn (arm left), -1 mirrored (arm right)
  var walking = false;
  var station = 'coin';      // 'coin' | 'dial'
  var walkTimer = null, bubbleTimer = null;
  var reduced = false;

  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* ignore */ }

  /* ------------------------------- build -------------------------------- */

  function build() {
    stage = document.querySelector('.layout');
    bezel = document.querySelector('.bezel');
    if (!stage || !bezel) return false;

    root = document.createElement('div');
    root.className = 'gary';
    root.setAttribute('aria-hidden', 'false');
    root.style.width = WIDTH + 'px';
    root.style.height = HEIGHT + 'px';

    sprite = document.createElement('button');
    sprite.type = 'button';
    sprite.className = 'gary-sprite';
    sprite.setAttribute('aria-label', 'Gary');
    sprite.style.width = WIDTH + 'px';
    sprite.style.height = HEIGHT + 'px';
    sprite.style.setProperty('--gary-w', WIDTH + 'px');

    bubble = document.createElement('div');
    bubble.className = 'gary-bubble';
    bubble.hidden = true;

    root.appendChild(bubble);
    root.appendChild(sprite);
    stage.appendChild(root);

    stand();
    sprite.addEventListener('click', function (e) {
      e.stopPropagation();
      say(LINES.shush, 4200);
      if (e.detail > 0) sprite.blur();
    });
    return true;
  }

  /* ------------------------------ drawing ------------------------------- */

  function stand() {
    sprite.style.backgroundImage =
      'url(/assets/gary-facing.png), url(/assets/gary-facing-solid.png)';
    sprite.style.backgroundSize = (WIDTH * FACING_FRAMES) + 'px ' + HEIGHT + 'px';
    sprite.style.backgroundPosition = '0 0';
    sprite.style.setProperty('--gary-cells', -FACING_FRAMES);
    sprite.style.animation = reduced
      ? 'none'
      : 'gary-step ' + FACING_CYCLE + 's steps(' + FACING_FRAMES + ') infinite';
    paint();
  }

  function walk() {
    sprite.style.backgroundImage =
      'url(/assets/gary-pace.png), url(/assets/gary-pace-solid.png)';
    sprite.style.backgroundSize = (WIDTH * FRAMES) + 'px ' + HEIGHT + 'px';
    sprite.style.backgroundPosition = '0 0';
    sprite.style.setProperty('--gary-cells', -FRAMES);
    sprite.style.animation =
      'gary-step ' + CYCLE + 's steps(' + FRAMES + ') infinite';
    paint();
  }

  /** Arms-down pose, held. The second cell of the facing sheet. */
  function hang() {
    sprite.style.backgroundImage =
      'url(/assets/gary-facing.png), url(/assets/gary-facing-solid.png)';
    sprite.style.backgroundSize = (WIDTH * FACING_FRAMES) + 'px ' + HEIGHT + 'px';
    sprite.style.animation = 'none';
    sprite.style.backgroundPosition = (-WIDTH) + 'px 0';
    paint();
  }

  function paint() {
    root.style.transform =
      'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)';
    sprite.style.transform = 'scaleX(' + facing + ')';
    if (bubble && !bubble.hidden) placeBubble();
  }

  /* ------------------------------ speaking ------------------------------ */

  function say(text, ms) {
    bubble.textContent = text;
    bubble.hidden = false;
    placeBubble();
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(hush, ms);
  }

  /* At the dial: beside him, on the chin, because 72px of a 92px band
     leaves no room overhead without landing on the glass.
     At the coin: above him, hung off his right shoulder, growing left.
     Beside him there the slot is on his right and the glass is on his
     left. Above him is the empty coin-stage band. */
  function placeBubble() {
    var above = station === 'coin';
    bubble.classList.toggle('is-above', above);
    if (above) { bubble.classList.remove('is-left'); return; }
    var bw = bubble.offsetWidth;
    var left = stage.getBoundingClientRect().left + x + WIDTH;
    bubble.classList.toggle('is-left', left + bw + 24 > window.innerWidth);
  }

  function hush() { bubble.hidden = true; }

  /* ------------------------------ stations ------------------------------ */

  function rect(selector) {
    var t = document.querySelector(selector);
    if (!t) return null;
    var r = t.getBoundingClientRect();
    return r.width ? r : null;
  }

  function stageRect() { return stage.getBoundingClientRect(); }

  /** Left of the slot plate, feet on the plate's bottom edge. */
  function coinStation() {
    var p = rect('.plate'), s = stageRect();
    if (!p) return null;
    return {
      x: p.left - COIN_GAP - WIDTH - s.left,
      y: p.bottom - HEIGHT - s.top
    };
  }

  /** Just right of the dial's game list, feet on the cabinet chin. */
  function dialStation() {
    var d = rect('.dial-wrap'), b = bezel.getBoundingClientRect(), s = stageRect();
    if (!d) return null;
    var left = d.right + GAP;
    left = Math.max(b.left + EDGE, Math.min(left, b.right - WIDTH - EDGE));
    return {
      x: left - s.left,
      y: b.bottom - FOOT - HEIGHT - s.top
    };
  }

  function railEdge() {
    var r = rect('.rail'), s = stageRect();
    if (!r) return null;
    return r.left - s.left;
  }

  function placeAt(px, py) {
    x = px;
    y = py;
    paint();
  }

  /* ------------------------------- moving ------------------------------- */

  /** Flush the current transform so a new transition starts from here,
      not from a previous leg that is still interpolating. */
  function startMove(transition) {
    root.style.transition = transition;
    void root.offsetWidth;
  }

  function walkTo(toX, toY, done) {
    var dist = Math.abs(toX - x);
    if (reduced || dist < 4) { placeAt(toX, toY); if (done) done(); return; }

    facing = toX > x ? 1 : -1;
    walking = true;
    walk();

    var seconds = dist / SPEED;
    var cycles = Math.max(1, Math.round(seconds / CYCLE));
    seconds = cycles * CYCLE;

    startMove('transform ' + seconds + 's linear');
    placeAt(toX, toY);

    clearTimeout(walkTimer);
    walkTimer = setTimeout(function () {
      root.style.transition = '';
      walking = false;
      if (done) done();
    }, seconds * 1000 + 40);
  }

  function hop(toX, toY, done) {
    if (reduced) { placeAt(toX, toY); if (done) done(); return; }
    walking = true;
    hang();
    startMove('transform ' + HOP + 's cubic-bezier(0.45, 0, 1, 1)');
    placeAt(toX, toY);
    clearTimeout(walkTimer);
    walkTimer = setTimeout(function () {
      root.style.transition = '';
      walking = false;
      if (done) done();
    }, HOP * 1000 + 40);
  }

  /* ------------------------------ the script ---------------------------- */

  var leaving = false;

  function toCoin() {
    var c = coinStation();
    if (!c) return;
    station = 'coin';
    leaving = false;
    facing = -1;
    placeAt(c.x, c.y);
    stand();
    say(LINES.coin, 0);
  }

  /* Three legs, each walking leg a whole number of strides:

       1. left along the rail to a planted foot near its edge
       2. off the edge onto the chin. The landing is snapped to strides
          from the dial, so the hop carries the remainder (never backward)
       3. along the chin to the dial */
  function toDial() {
    if (leaving) return;
    leaving = true;
    hush();
    var c = coinStation(), d = dialStation(), edge = railEdge();
    if (!c || !d || edge == null) return;

    var n1 = Math.max(0, Math.floor((c.x - edge) / STRIDE));
    var edgeX = n1 === 0 ? c.x : c.x - n1 * STRIDE;
    var n2 = Math.max(0, Math.floor((edgeX - d.x) / STRIDE));
    var landX = n2 === 0 ? edgeX : Math.min(edgeX, d.x + n2 * STRIDE);

    function arrive() {
      station = 'dial';
      facing = 1;
      stand();
      say(LINES.dial, 9000);
    }

    walkTo(edgeX, c.y, function () {
      hop(landX, d.y, function () {
        walkTo(d.x, d.y, arrive);
      });
    });
  }

  function reseat() {
    if (walking) return;
    var s = station === 'dial' ? dialStation() : coinStation();
    if (s) {
      if (station === 'coin') facing = -1;
      if (station === 'dial') facing = 1;
      placeAt(s.x, s.y);
    }
  }

  function tooNarrow() { return window.innerWidth < MIN_WIDTH; }

  function start() {
    if (tooNarrow()) return;
    if (!build()) return;
    toCoin();

    // data-inserted flips at 1.5s, same as the drop. 200ms more lets
    // the coin finish going in before he turns. Longer than that and
    // he stands there pointing at an empty plate.
    var html = document.documentElement;
    if (html.getAttribute('data-inserted') === 'true') {
      setTimeout(toDial, 400);
    } else {
      var mo = new MutationObserver(function () {
        if (html.getAttribute('data-inserted') === 'true') {
          mo.disconnect();
          setTimeout(toDial, 200);
        }
      });
      mo.observe(html, { attributes: true, attributeFilter: ['data-inserted'] });
    }

    var t = null;
    window.addEventListener('resize', function () {
      if (!root) return;
      root.hidden = tooNarrow();
      clearTimeout(t);
      t = setTimeout(reseat, 150);
    });
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);

  return { say: say, toDial: toDial, reseat: reseat };
})();
