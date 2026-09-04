/* ==========================================================================
   The cabinet.

   Owns everything around the games: the dial, mounting and tearing down the
   game inside the CRT, the attract screen, the on-screen status line, the
   game-over/submit flow, and the leaderboard in the rail.

   Games know nothing about any of this. Each one exposes
   { id, name, mode, metric, attract, controls, mount(host, api) } and gets
   back an api of { setState, setStatus, gameOver, palette }. That contract
   is deliberately framework-free: when this moves into the Next app the
   same modules mount from a useEffect against a ref, unchanged.
   ========================================================================== */
'use strict';

(function () {
  var ORDER = ['snake', 'minesweeper', 'asteroids'];
  var DETENT = [-40, 0, 40];          // dial angle per slot

  var net = window.ArcadeNet;
  var games = window.ArcadeGames;
  var S = window.ArcadeSound;

  var root = document.documentElement;
  var picture = document.querySelector('.picture');
  var dial = document.querySelector('.dial');
  var ticks = document.querySelectorAll('.dial-ticks span');
  var board = document.querySelector('.board');
  var coinBtn = document.querySelector('.coin-btn');
  var coinModule = document.querySelector('.coin-module');
  var muteBtn = null;   // built below, onto the glass

  var elTitle = document.querySelector('[data-slot-title]');
  var elGameLabels = document.querySelectorAll('[data-slot-game]');
  var champInitials = document.querySelector('.champion-initials');
  var champScore = document.querySelector('.champion-score');
  var champDate = document.querySelector('.champion-date');

  var index = 0;
  var hasCredit = false;
  var game = null;          // the game definition
  var instance = null;      // its mounted instance
  var pending = null;       // an unsubmitted result

  /* ------------------------------- palette ------------------------------- */

  var cachedPalette = null;

  function palette() {
    if (cachedPalette) return cachedPalette;
    var cs = getComputedStyle(root);
    cachedPalette = {
      hot:    cs.getPropertyValue('--ink-hot').trim()  || '#fff',
      name:   cs.getPropertyValue('--sc-name').trim()  || '#fff',
      score:  cs.getPropertyValue('--sc-score').trim() || '#ff0',
      accent: cs.getPropertyValue('--sc-rank').trim()  || '#0ff',
      dim:    cs.getPropertyValue('--sc-rule').trim()  || '#333'
    };
    return cachedPalette;
  }

  /* ------------------------------- screens ------------------------------- */

  var screen = document.createElement('div');
  screen.className = 'screen-ui';
  screen.innerHTML =
    '<div class="stage"></div>' +
    '<div class="status" hidden><span class="status-value"></span>' +
      '<span class="status-extra"></span></div>' +
    '<div class="overlay" data-ov="attract">' +
      '<div class="ov-title"></div>' +
      '<div class="rule-glow"></div>' +
      '<div class="ov-sub"></div>' +
      '<div class="ov-controls"></div>' +
      '<div class="insert">INSERT COIN</div>' +
    '</div>' +
    '<button type="button" class="vol-btn" aria-pressed="false" ' +
      'aria-label="Mute or unmute the arcade">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polygon points="4,9 8,9 13,5 13,19 8,15 4,15" fill="currentColor" ' +
          'stroke="currentColor"></polygon>' +
        '<g class="wave">' +
          '<path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4"></path>' +
          '<path d="M19.2 6.2a8 8 0 0 1 0 11.6"></path>' +
        '</g>' +
        '<line class="slash" x1="16" y1="8" x2="22" y2="16"></line>' +
      '</svg>' +
    '</button>' +
    '<div class="overlay" data-ov="over" hidden>' +
      '<div class="ov-title ov-title-sm">GAME OVER</div>' +
      '<div class="ov-result"></div>' +
      '<form class="ov-form" autocomplete="off">' +
        '<label class="ov-label" for="ac-name">ENTER YOUR NAME</label>' +
        '<input id="ac-name" class="ov-input" maxlength="16" spellcheck="false" />' +
        '<button type="submit" class="ov-btn">SUBMIT</button>' +
      '</form>' +
      '<div class="ov-msg"></div>' +
      '<div class="ov-again">PRESS R TO PLAY AGAIN</div>' +
    '</div>';

  var stage       = screen.querySelector('.stage');
  var statusBar   = screen.querySelector('.status');
  var statusValue = screen.querySelector('.status-value');
  var statusExtra = screen.querySelector('.status-extra');
  var ovAttract   = screen.querySelector('[data-ov="attract"]');
  var ovOver      = screen.querySelector('[data-ov="over"]');
  var ovTitle     = ovAttract.querySelector('.ov-title');
  var ovSub       = ovAttract.querySelector('.ov-sub');
  var ovControls  = ovAttract.querySelector('.ov-controls');
  var ovResult    = ovOver.querySelector('.ov-result');
  var ovForm      = ovOver.querySelector('.ov-form');
  var ovInput     = ovOver.querySelector('.ov-input');
  var ovBtn       = ovOver.querySelector('.ov-btn');
  var ovMsg       = ovOver.querySelector('.ov-msg');

  picture.innerHTML = '';
  picture.appendChild(screen);
  muteBtn = screen.querySelector('.vol-btn');

  /* --------------------------------- api --------------------------------- */

  var api = {
    palette: palette,

    /** Games must ask before starting. No coin, no game. */
    canStart: function () {
      if (!hasCredit && coinBtn) {
        // Nudge the thing they need to click.
        coinBtn.classList.remove('nudge');
        void coinBtn.offsetWidth;          // restart the animation
        coinBtn.classList.add('nudge');
      }
      return hasCredit;
    },

    setState: function (s) {
      var idle = (s === 'idle');
      ovAttract.hidden = !idle;
      statusBar.hidden = idle;
      if (s !== 'over') ovOver.hidden = true;
      screen.dataset.state = s;
    },

    setStatus: function (o) {
      statusValue.textContent = o.value == null ? '' : o.value;
      statusExtra.textContent = o.extra == null ? '' : o.extra;
    },

    gameOver: function (result) {
      screen.dataset.state = 'over';
      statusBar.hidden = false;
      ovAttract.hidden = true;
      ovOver.hidden = false;
      ovMsg.textContent = '';
      ovMsg.className = 'ov-msg';
      ovBtn.disabled = false;

      if (result.lost) {
        // Minesweeper: hitting a mine is not a score, it is a reset.
        ovResult.textContent = result.message || '';
        ovForm.hidden = true;
        pending = null;
        return;
      }

      ovResult.textContent = result.display || '';
      var worth = (result.score == null) ? true : result.score > 0;
      ovForm.hidden = !worth;
      if (!worth) { pending = null; return; }

      pending = {
        game: game.id,
        mode: game.mode,
        score: result.score == null ? null : result.score,
        time_ms: result.time_ms == null ? null : result.time_ms
      };
      ovInput.value = net.getSavedPlayer();
      if (!ovInput.value) setTimeout(function () { ovInput.focus(); }, 30);
    }
  };

  ovForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pending) return;
    var name = net.cleanPlayerName(ovInput.value);
    if (!name) {
      ovMsg.textContent = 'NAME MUST BE 1-16 CHARACTERS';
      ovMsg.className = 'ov-msg is-bad';
      return;
    }
    ovBtn.disabled = true;
    ovMsg.textContent = 'SENDING...';
    ovMsg.className = 'ov-msg';

    net.submitScore({
      game: pending.game, mode: pending.mode, player: name,
      score: pending.score, time_ms: pending.time_ms
    }).then(function () {
      net.savePlayer(name);
      S.submit();
      ovMsg.textContent = 'ON THE BOARD';
      ovMsg.className = 'ov-msg is-good';
      ovForm.hidden = true;
      pending = null;
      loadBoard();
    }).catch(function (err) {
      ovBtn.disabled = false;
      ovMsg.textContent = String(err.message || err).toUpperCase();
      ovMsg.className = 'ov-msg is-bad';
    });
  });

  // R restarts from the game-over screen without stealing the name field.
  document.addEventListener('keydown', function (e) {
    if (screen.dataset.state !== 'over') return;
    if (e.target === ovInput) return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (instance && instance.start) instance.start();
    }
  });

  /* ------------------------------ the rail ------------------------------ */

  function loadBoard() {
    var g = game;
    return net.fetchScores(g.id, g.mode, 8).then(function (rows) {
      if (game !== g) return;                 // dial moved while we waited
      if (!rows.length) { board.innerHTML = ''; return; }

      var top = rows[0];
      champInitials.textContent = top.player;
      champScore.textContent = net.rowValue(g.id, top);
      if (champDate) champDate.textContent = monthYear(top.created_at);

      board.innerHTML = rows.slice(1).map(function (row, i) {
        return '<li><span class="b-rank">' + ('0' + (i + 2)).slice(-2) + '</span>' +
               '<span class="b-name">' + esc(row.player) + '</span>' +
               '<span class="b-score">' + net.rowValue(g.id, row) + '</span></li>';
      }).join('');
    });
  }

  /* "MAR 2026" for the champion strip. Sample rows carry no date, so the
     slot just empties rather than printing an Invalid Date. */
  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN',
                'JUL','AUG','SEP','OCT','NOV','DEC'];
  function monthYear(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ------------------------------- the dial ----------------------------- */

  function select(i, isFirst) {
    index = ((i % ORDER.length) + ORDER.length) % ORDER.length;
    var next = games[ORDER[index]];
    if (!next) return;

    if (instance) { instance.destroy(); instance = null; }
    game = next;

    root.setAttribute('data-game', game.id);
    if (dial) dial.style.transform = 'rotate(' + DETENT[index] + 'deg)';
    ticks.forEach(function (t) {
      t.setAttribute('data-on', String(t.dataset.slot === game.id));
    });

    if (elTitle) elTitle.textContent = game.name;
    elGameLabels.forEach(function (e) { e.textContent = game.name; });
    ovTitle.textContent = game.name;
    ovSub.textContent = game.attract;
    ovControls.textContent = game.controls;
    paintCredit();

    pending = null;
    ovOver.hidden = true;
    instance = game.mount(stage, api);
    loadBoard();

    if (!isFirst && dial) dial.focus({ preventScroll: true });
  }

  if (dial) {
    dial.addEventListener('click', function () { S.dial(); select(index + 1); });
    dial.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); S.dial(); select(index + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); S.dial(); select(index - 1); }
    });
  }
  ticks.forEach(function (t) {
    t.addEventListener('click', function () {
      var i = ORDER.indexOf(t.dataset.slot);
      if (i >= 0 && i !== index) { S.dial(); select(i); }
    });
  });

  window.addEventListener('resize', function () {
    if (instance && instance.resize) instance.resize();
  });

  /** The blinking line at the foot of the attract screen. */
  function paintCredit() {
    var line = ovAttract.querySelector('.insert');
    if (line) line.textContent = hasCredit ? 'PRESS SPACE TO START' : 'INSERT COIN';
  }

  /* ------------------------------ the credit ----------------------------
     The machine is off until a coin goes in. That click is also the user
     gesture browsers require before an AudioContext will make any noise,
     so the coin unlocks the sound for everything that follows.
     Credit lasts the browser session, not forever - come back tomorrow and
     you put another one in.
     ---------------------------------------------------------------------- */

  var CREDIT_KEY = 'arcade_credited';

  function credited() {
    try { return sessionStorage.getItem(CREDIT_KEY) === '1'; } catch (e) { return false; }
  }

  function powerUp() {
    hasCredit = true;
    root.setAttribute('data-inserted', 'true');
    S.powerOn();
    paintCredit();
  }

  function insertCoin() {
    if (root.getAttribute('data-inserted') === 'true') return;
    S.unlock();
    S.coin();
    coinModule.classList.add('is-inserting');
    try { sessionStorage.setItem(CREDIT_KEY, '1'); } catch (e) { /* ignore */ }
    // The tube comes up as the coin lands, not before.
    setTimeout(powerUp, 620);
  }

  if (coinBtn) coinBtn.addEventListener('click', insertCoin);

  if (muteBtn) {
    var paintMute = function () {
      muteBtn.setAttribute('aria-pressed', String(S.isMuted()));
    };
    paintMute();
    muteBtn.addEventListener('click', function (e) {
      e.stopPropagation();          // never counts as a tap on the game
      S.unlock();
      S.toggle();
      paintMute();
      if (!S.isMuted()) S.tick();   // a blip so you know it came back
    });
  }

  // Attract mode runs either way. The only difference a credit makes is
  // whether pressing a key does anything.
  hasCredit = credited();
  root.setAttribute('data-inserted', hasCredit ? 'true' : 'false');
  if (hasCredit && coinModule) coinModule.classList.add('is-inserting');
  select(0, true);
})();
