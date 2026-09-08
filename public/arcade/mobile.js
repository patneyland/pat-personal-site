/* ==========================================================================
   The phone.

   On a phone the cabinet is the problem. The bezel, the dial, the coin slot
   and the rail are the best part of this page on a desktop and they are all
   overhead on a 390px screen: by the time they have had their share there is
   a postage stamp left to play in.

   So on a phone the page becomes three screens instead of one:

     1. THE GATE. Full screen, one coin. Nothing else is reachable until it
        goes in, which is the same rule the cabinet already had - it is just
        no longer competing with a leaderboard for attention.
     2. THE GAME. The whole viewport. While a run is going there is nothing
        else on screen at all.
     3. THE BOARD. A sheet over the top, opened from an icon, and only
        reachable when you are not playing.

   Nothing here reimplements the cabinet. It MOVES the cabinet's own nodes
   into these screens - the coin module into the gate, the rail into the
   sheet - so every handler cabinet.js binds keeps working and the board
   keeps painting into the same <ol> it always did. The two icon buttons
   drive the real controls underneath: the switch-game button clicks the
   dial nobody can see any more.

   Load order matters: this file runs before cabinet.js so that the nodes are
   already where they belong by the time the cabinet queries for them, and
   cabinet.js calls attach() at the end of its own setup to hand over the
   pieces it built itself.

   ?phone=1 forces this shell on a desktop, ?phone=0 forces it off. Both are
   for looking at it, and neither is needed on a real device.
   ========================================================================== */
'use strict';

(function () {
  var root = document.documentElement;

  /* A phone, or a phone lying on its side. Width alone would catch an iPad
     in portrait and a landscape phone would fall out of the shell mid-game,
     which is why the second clause is a height. */
  var MQ = '(pointer: coarse) and (max-width: 820px),' +
           '(pointer: coarse) and (max-height: 560px)';

  var forced = /[?&]phone=([01])/.exec(window.location.search);
  var active = forced ? forced[1] === '1' : window.matchMedia(MQ).matches;

  window.ArcadePhone = { active: active };
  if (!active) return;

  root.setAttribute('data-phone', 'true');

  var ICON = {
    swap:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 8h11a4 4 0 0 1 4 4"></path><polyline points="17 5 20 8 17 11"></polyline>' +
        '<path d="M20 16H9a4 4 0 0 1-4-4"></path><polyline points="7 19 4 16 7 13"></polyline>' +
      '</svg>',
    board:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="13" width="5" height="8"></rect>' +
        '<rect x="9.5" y="7" width="5" height="14"></rect>' +
        '<rect x="16" y="10" width="5" height="11"></rect>' +
      '</svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" aria-hidden="true">' +
        '<line x1="6" y1="6" x2="18" y2="18"></line>' +
        '<line x1="18" y1="6" x2="6" y2="18"></line>' +
      '</svg>'
  };

  var rail = document.querySelector('.rail');
  var coinModule = document.querySelector('.coin-module');

  /* ------------------------------- the gate ------------------------------ */

  var gate = document.createElement('div');
  gate.className = 'ph-gate';
  gate.innerHTML =
    '<div class="ph-gate-name">ARCADE</div>' +
    '<div class="ph-gate-slot"></div>' +
    '<div class="ph-gate-hint">DROP A COIN<br>TO PLAY</div>';
  document.body.appendChild(gate);
  if (coinModule) gate.querySelector('.ph-gate-slot').appendChild(coinModule);

  /* ------------------------------ the sheet ------------------------------ */

  var sheet = document.createElement('div');
  sheet.className = 'ph-sheet';
  sheet.hidden = true;
  sheet.innerHTML =
    '<button type="button" class="ph-close" aria-label="Close the high scores">' +
      ICON.close + '</button>' +
    '<div class="ph-sheet-body"></div>';
  document.body.appendChild(sheet);
  if (rail) sheet.querySelector('.ph-sheet-body').appendChild(rail);

  function openSheet() { sheet.hidden = false; root.setAttribute('data-sheet', 'open'); }
  function closeSheet() { sheet.hidden = true; root.removeAttribute('data-sheet'); }

  sheet.querySelector('.ph-close').addEventListener('click', closeSheet);

  /* ------------------------------- the hud ------------------------------- */
  /* Two buttons, and they are only ever on screen between runs. The rule the
     whole shell is built on is that a run owns the entire viewport. */

  var hud = document.createElement('div');
  hud.className = 'ph-hud';
  hud.innerHTML =
    '<button type="button" class="ph-btn ph-swap" aria-label="Switch to the next game">' +
      ICON.swap + '</button>' +
    '<button type="button" class="ph-btn ph-board" aria-label="High scores">' +
      ICON.board + '</button>';
  document.body.appendChild(hud);

  hud.querySelector('.ph-board').addEventListener('click', openSheet);

  /* ------------------------------- attach -------------------------------- */
  /* cabinet.js calls this once it has built the screen and found the dial. */

  window.ArcadePhone.attach = function (parts) {
    var screen = parts.screen;
    var dial = parts.dial;

    /* The mute button is drawn on the glass, which on a phone is exactly
       where Asteroids puts its fire key. Move it up into the HUD row rather
       than build a second one: it keeps its handler, its pressed state and
       its one source of truth about whether the sound is off. */
    var vol = screen.querySelector('.vol-btn');
    if (vol) hud.appendChild(vol);

    /* Switching games is the dial, pressed by proxy. Going through the real
       control keeps one path through select(): the sound, the tick lights
       and the teardown all happen exactly as they do on a desktop. */
    hud.querySelector('.ph-swap').addEventListener('click', function () {
      if (dial) dial.click();
      closeSheet();
    });

    /* Mirror the game's own state onto <html> so the CSS can clear the
       screen while a run is going. cabinet.js already writes it to the
       screen element; this just puts it somewhere the HUD can see. */
    function paintState() {
      root.setAttribute('data-play', screen.dataset.state || 'idle');
    }
    paintState();
    new MutationObserver(paintState)
      .observe(screen, { attributes: true, attributeFilter: ['data-state'] });

    /* The gate lifts when the credit lands. data-inserted is the cabinet's
       own signal and it covers both cases: the coin that was just dropped,
       and the credit still sitting in sessionStorage from earlier. */
    function lift(animated) {
      if (gate.hidden) return;
      if (!animated) { gate.hidden = true; return; }
      gate.classList.add('is-gone');
      setTimeout(function () { gate.hidden = true; }, 460);
    }
    if (root.getAttribute('data-inserted') === 'true') lift(false);
    new MutationObserver(function () {
      if (root.getAttribute('data-inserted') === 'true') lift(true);
    }).observe(root, { attributes: true, attributeFilter: ['data-inserted'] });
  };
})();
