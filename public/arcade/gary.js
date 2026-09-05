/* ==========================================================================
   Gary, working the arcade floor.

   Same drawings and the same walk as the Gary on /fun - the sprite sheets in
   /assets are shared - but none of the chat. This page is a standalone
   document, so the React component cannot be imported; the walk maths below
   is carried over from GaryPacing.tsx rather than reinvented, which is why
   the constants match it exactly.

   What he does here:
     - starts centre stage under the screen and tells you to put a coin in
     - once a coin drops, walks over to the dial and explains it
     - if you click him, he tells you to get back to the game

   Where he stands: in front of the cabinet's chin, the 92px band of bezel
   under the glass that holds the dial on the left and the lamp on the right.
   He is mounted inside .bezel, so his feet sit on its bottom border by plain
   CSS and every x below is measured from the bezel's left edge. He used to
   be fixed to the viewport floor, which put his feet 20-30px below the bezel
   (its bottom edge lands short of the page bottom by an amount that depends
   on the screen height) with the border and hairline cutting through his
   torso, and at the coin station the bezel's rounded corner ran through his
   shoulder with the pilot lamp at his ear.

   The one rule that matters: his speed is derived, not chosen. The sprite
   advances a fixed distance per walk cycle, so travel-per-second has to equal
   stride-per-cycle or his feet slide. See SPEED below.
   ========================================================================== */
'use strict';

window.ArcadeGary = (function () {
  var FRAMES = 8;            // cells in gary-pace.png
  /* 12, the same as /fun. It was 24 for a while, because the walk used to run
     from the back link to the dial, ~900px, which takes eighteen seconds at
     12. The fix was to shorten the walk (see coinSpot), not to hurry him. */
  var FPS = 12;
  var FACING_FRAMES = 2;     // cells in gary-facing.png
  var FACING_CYCLE = 1.6;    // seconds for both standing poses

  /* 72, the same as /fun, and half the 144px sheet cell so he stays crisp.
     With FPS matched too, SPEED below comes out identical to /fun's: same
     stride, same cadence, same pace. He is also then about the height of
     the dial knob he stands beside (79px) and clears the glass above the
     chin by 17px. */
  var HEIGHT = 72;                       // display height, px
  var ASPECT = 114 / 144;                // one cell in the sheet
  var WIDTH = Math.round(HEIGHT * ASPECT);

  /* 98px of travel per cycle on a 177px-tall figure, measured off the
     drawings. At HEIGHT px tall that is STRIDE px per cycle, and a cycle
     lasts FRAMES/FPS seconds. */
  var STRIDE = HEIGHT * (98 / 177);
  var CYCLE = FRAMES / FPS;
  var SPEED = STRIDE / CYCLE;            // px per second. Do not round.

  var GAP = 14;              // how far he stands off the thing he points at
  /* His feet sit this far above the bezel's bottom edge. 3px is where the
     base of the dial knob lands (measured: knob bottom 965 on a bezel
     bottom of 968), so the two share a floor line. */
  var FOOT = 3;
  var EDGE = 8;              // never nearer than this to either end of the bezel
  var MIN_WIDTH = 760;       // below this the layout stacks and he is in the way

  var LINES = {
    coin: 'Click the coin to drop it in the slot.',
    dial: 'Click the dial to switch to a different game.',
    shush: "Stay focused on the game, this isn't a time for talk."
  };

  var sprite, bubble, root, bezel;
  var x = 0;                 // his left edge, in px from the bezel's left edge
  var facing = 1;            // 1 right, -1 left
  var walking = false;
  var walkTimer = null, bubbleTimer = null;
  var reduced = false;

  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* ignore */ }

  /* ------------------------------- build -------------------------------- */

  function build() {
    bezel = document.querySelector('.bezel');
    if (!bezel) return false;

    root = document.createElement('div');
    root.className = 'gary';
    root.setAttribute('aria-hidden', 'false');
    // Size and seat from the constants here, so they live in one place.
    // The CSS carries the same numbers as defaults.
    root.style.width = WIDTH + 'px';
    root.style.height = HEIGHT + 'px';
    root.style.bottom = FOOT + 'px';

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
    /* Into the bezel, not the body. His vertical seat is then a CSS bottom
       against the cabinet itself, so a relayout - the bezel is sized by the
       viewport height - can never leave him floating above the chin, and
       the stacking is simple: nothing in the CRT stack goes above 6. */
    bezel.appendChild(root);

    stand();
    sprite.addEventListener('click', function (e) {
      e.stopPropagation();
      say(LINES.shush, 4200);
      if (e.detail > 0) sprite.blur();   // hand the keyboard back to the game
    });
    return true;
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

  /* The bubble sits beside him, not over his head: the chin is 92px tall
     and he is 72 of it, so anything above him lands on the glass. Beside
     him it stays on the plastic, level with the game list next to the dial.
     It goes on his right, towards the rail and the coin, and flips to his
     left only if the right side would run off the viewport - which it
     cannot from either station today, but the rule costs nothing. */
  function placeBubble() {
    var bw = bubble.offsetWidth;
    var left = bezel.getBoundingClientRect().left + x + WIDTH;
    bubble.classList.toggle('is-left', left + bw + 24 > window.innerWidth);
  }

  function hush() { bubble.hidden = true; }

  /* ------------------------------- moving ------------------------------- */

  /** Left edge for standing beside a target element, on the given side,
      in bezel coordinates. */
  function spotBeside(selector, side) {
    var t = document.querySelector(selector);
    if (!t) return null;
    var r = t.getBoundingClientRect();
    if (!r.width) return null;
    var b = bezel.getBoundingClientRect();
    var left = (side === 'left' ? r.left - WIDTH - GAP : r.right + GAP) - b.left;
    // Never let him walk off the cabinet.
    return Math.max(EDGE, Math.min(left, b.width - WIDTH - EDGE));
  }

  /** Where he stands to talk about the dial: just right of its game list. */
  function dialSpot() { return spotBeside('.dial-wrap', 'right'); }

  /* Where he stands to talk about the coin: centre stage, under the screen
     that is itself saying INSERT COIN. The coin is across the page in the
     rail, but it glows and is labelled, so he can call across to it; the
     dial is the control that needs someone standing next to it.

     Snapped to a whole number of strides from the dial spot. The walk is a
     CSS transition over exactly cycles*CYCLE seconds, so a distance that is
     exactly cycles*STRIDE is the only one his feet agree with all the way,
     and it lands him exactly on the dial spot with a foot planted. Nobody
     can see that centre stage is up to 20px off true centre. Between the
     layouts this page takes that is 4 to 9 strides, 2.7 to 6 seconds. */
  function coinSpot() {
    var from = dialSpot();
    if (from == null) return null;
    var centre = bezel.getBoundingClientRect().width / 2 - WIDTH / 2;
    var cycles = Math.max(1, Math.round((centre - from) / STRIDE));
    return from + cycles * STRIDE;
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
    // planted foot instead of mid-air. The stations are already a whole
    // number of strides apart (see coinSpot), so this is a no-op in
    // practice and a safety net if a caller hands in some other distance.
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
    var spot = coinSpot();
    if (spot == null) return;
    placeAt(spot);
    say(LINES.coin, 0);          // stays up until the coin goes in
  }

  function toDial() {
    if (atDial) return;
    atDial = true;
    hush();
    var spot = dialSpot();
    if (spot == null) return;
    walkTo(spot, function () { say(LINES.dial, 9000); });
  }

  /** Re-seat him when the layout moves under him. Only x needs redoing:
      the bezel's width changes with the viewport, his seat does not. */
  function reseat() {
    if (walking) return;
    var spot = atDial ? dialSpot() : coinSpot();
    if (spot != null) placeAt(spot);
  }

  function tooNarrow() { return window.innerWidth < MIN_WIDTH; }

  function start() {
    if (tooNarrow()) return;
    if (!build()) return;
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

  return { say: say, toDial: toDial, reseat: reseat };
})();
