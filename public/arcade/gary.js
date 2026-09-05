/* ==========================================================================
   Gary, working the arcade floor.

   Same drawings and the same walk as the Gary on /fun - the sprite sheets in
   /assets are shared - but none of the chat. This page is a standalone
   document, so the React component cannot be imported; the walk maths below
   is carried over from GaryPacing.tsx rather than reinvented, which is why
   the constants match it exactly.

   What he does here:
     - starts beside the coin slot and tells you to put a coin in
     - once a coin drops, walks across to the dial and explains it
     - if you click him, he tells you to get back to the game

   The one rule that matters: his speed is derived, not chosen. The sprite
   advances a fixed distance per walk cycle, so travel-per-second has to equal
   stride-per-cycle or his feet slide. See SPEED below.
   ========================================================================== */
'use strict';

window.ArcadeGary = (function () {
  var FRAMES = 8;            // cells in gary-pace.png
  /* 24, not the 12 he paces at on /fun. Speed is stride over cycle, so the
     only way to cross the page in a sensible time without his feet sliding is
     to step faster. At 12 the walk from the coin to the dial took 15 seconds;
     at 24 it is under eight and reads as him hustling, which suits an arcade
     floor. Do not raise the translate duration on its own. */
  var FPS = 24;
  var FACING_FRAMES = 2;     // cells in gary-facing.png
  var FACING_CYCLE = 1.6;    // seconds for both standing poses

  var HEIGHT = 62;                       // display height, px
  var ASPECT = 114 / 144;                // one cell in the sheet
  var WIDTH = Math.round(HEIGHT * ASPECT);

  /* 98px of travel per cycle on a 177px-tall figure, measured off the
     drawings. At HEIGHT px tall that is STRIDE px per cycle, and a cycle
     lasts FRAMES/FPS seconds. */
  var STRIDE = HEIGHT * (98 / 177);
  var CYCLE = FRAMES / FPS;
  var SPEED = STRIDE / CYCLE;            // px per second. Do not round.

  var GAP = 14;              // how far he stands off the thing he points at
  var MIN_WIDTH = 760;       // below this the layout stacks and he is in the way

  var LINES = {
    coin: 'Click the coin to drop it in the slot.',
    dial: 'Click the dial to switch to a different game.',
    shush: "Stay focused on the game, this isn't a time for talk."
  };

  var sprite, bubble, root;
  var x = 0;                 // his left edge, in px from the viewport left
  var facing = 1;            // 1 right, -1 left
  var walking = false;
  var walkTimer = null, bubbleTimer = null;
  var reduced = false;

  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* ignore */ }

  /* ------------------------------- build -------------------------------- */

  function build() {
    root = document.createElement('div');
    root.className = 'gary';
    root.setAttribute('aria-hidden', 'false');

    sprite = document.createElement('button');
    sprite.type = 'button';
    sprite.className = 'gary-sprite';
    sprite.setAttribute('aria-label', 'Gary');

    bubble = document.createElement('div');
    bubble.className = 'gary-bubble';
    bubble.hidden = true;

    root.appendChild(bubble);
    root.appendChild(sprite);
    document.body.appendChild(root);

    stand();
    sprite.addEventListener('click', function (e) {
      e.stopPropagation();
      say(LINES.shush, 4200);
      if (e.detail > 0) sprite.blur();   // hand the keyboard back to the game
    });

  }

  /* ------------------------------ drawing ------------------------------- */

  /** Standing, facing you, alternating the two drawn poses. */
  function stand() {
    sprite.style.backgroundImage =
      'url(/assets/gary-facing.png), url(/assets/gary-facing-solid.png)';
    sprite.style.backgroundSize = (WIDTH * FACING_FRAMES) + 'px ' + HEIGHT + 'px';
    sprite.style.setProperty('--gary-cells', -FACING_FRAMES);
    sprite.style.animation = reduced
      ? 'none'
      : 'gary-step ' + FACING_CYCLE + 's steps(' + FACING_FRAMES + ') infinite';
    paint();
  }

  /** Mid-stride, walking. */
  function walk() {
    sprite.style.backgroundImage =
      'url(/assets/gary-pace.png), url(/assets/gary-pace-solid.png)';
    sprite.style.backgroundSize = (WIDTH * FRAMES) + 'px ' + HEIGHT + 'px';
    sprite.style.setProperty('--gary-cells', -FRAMES);
    sprite.style.animation =
      'gary-step ' + CYCLE + 's steps(' + FRAMES + ') infinite';
    paint();
  }

  function paint() {
    root.style.transform = 'translateX(' + Math.round(x) + 'px)';
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

  /* Centre the bubble on him, then pull it back inside the viewport if that
     would hang it off an edge - he stands near both edges by design. The tail
     stays on him rather than on the bubble's middle, so a shifted bubble
     still points at the right person. */
  function placeBubble() {
    bubble.style.left = '0px';
    var bw = bubble.offsetWidth;
    var centre = x + WIDTH / 2;
    var left = Math.max(8, Math.min(centre - bw / 2, window.innerWidth - bw - 8));
    bubble.style.left = (left - x) + 'px';
    bubble.style.setProperty('--tail', (centre - left) + 'px');
  }

  function hush() { bubble.hidden = true; }

  /* ------------------------------- moving ------------------------------- */

  /** Left edge for standing beside a target element, on the given side. */
  function spotBeside(selector, side) {
    var t = document.querySelector(selector);
    if (!t) return null;
    var r = t.getBoundingClientRect();
    if (!r.width) return null;
    var left = side === 'left' ? r.left - WIDTH - GAP : r.right + GAP;
    // Never let him walk off the page.
    return Math.max(8, Math.min(left, window.innerWidth - WIDTH - 8));
  }

  function placeAt(px) {
    x = px;
    paint();
  }

  /** Walk to `to`, then run `done`. Duration is derived from SPEED. */
  function walkTo(to, done) {
    var from = x;
    var dist = Math.abs(to - from);
    if (reduced || dist < 4) { placeAt(to); if (done) done(); return; }

    facing = to > from ? 1 : -1;
    walking = true;
    walk();

    var seconds = dist / SPEED;
    // Round the travel to a whole number of cycles so he finishes on a
    // planted foot instead of mid-air.
    var cycles = Math.max(1, Math.round(seconds / CYCLE));
    seconds = cycles * CYCLE;

    root.style.transition = 'transform ' + seconds + 's linear';
    // next frame, so the transition has a start value to work from
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { placeAt(to); });
    });

    clearTimeout(walkTimer);
    walkTimer = setTimeout(function () {
      root.style.transition = '';
      walking = false;
      facing = 1;
      stand();
      if (done) done();
    }, seconds * 1000 + 40);
  }

  /* ------------------------------ the script ---------------------------- */

  var atDial = false;

  function toCoin() {
    var spot = spotBeside('.back-wrap', 'left');
    if (spot == null) return;
    placeAt(spot);
    say(LINES.coin, 0);          // stays up until the coin goes in
  }

  function toDial() {
    if (atDial) return;
    atDial = true;
    hush();
    var spot = spotBeside('.dial-wrap', 'right');
    if (spot == null) return;
    walkTo(spot, function () { say(LINES.dial, 9000); });
  }

  /** Re-seat him when the layout moves under him. */
  function reseat() {
    if (walking) return;
    var spot = atDial ? spotBeside('.dial-wrap', 'right')
                      : spotBeside('.back-wrap', 'left');
    if (spot != null) placeAt(spot);
  }

  function tooNarrow() { return window.innerWidth < MIN_WIDTH; }

  function start() {
    if (tooNarrow()) return;
    build();
    toCoin();

    // The coin is his cue to move on. data-inserted flips on documentElement
    // when the credit lands - see cabinet.js.
    var html = document.documentElement;
    if (html.getAttribute('data-inserted') === 'true') {
      setTimeout(toDial, 400);
    } else {
      var mo = new MutationObserver(function () {
        if (html.getAttribute('data-inserted') === 'true') {
          mo.disconnect();
          setTimeout(toDial, 900);   // let the coin land and the tube warm up
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

  return { say: say, toDial: toDial };
})();
