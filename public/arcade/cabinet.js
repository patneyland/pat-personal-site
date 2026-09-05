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
  var champLabel = document.querySelector('.champion-label');

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
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" ' +
          'fill="currentColor" stroke="currentColor" stroke-width="1.6"></polygon>' +
        '<g class="wave">' +
          '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>' +
          '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>' +
        '</g>' +
        '<g class="slash">' +
          '<line x1="22.2" y1="9" x2="16.2" y2="15"></line>' +
          '<line x1="16.2" y1="9" x2="22.2" y2="15"></line>' +
        '</g>' +
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
    }).then(function (row) {
      net.savePlayer(name);
      S.submit();
      ovForm.hidden = true;
      pending = null;
      // In owner mode, claim the row we just wrote. The insert cannot set
      // is_owner itself; this is the only door, and it needs the secret.
      if (net.isOwnerMode() && row && row.id) {
        return net.claimScore(row.id).then(function (ok) {
          ovMsg.textContent = ok ? 'ON THE BOARD — CLAIMED' : 'ON THE BOARD';
          ovMsg.className = 'ov-msg is-good';
          loadBoard();
        });
      }
      ovMsg.textContent = 'ON THE BOARD';
      ovMsg.className = 'ov-msg is-good';
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

  /* The marker beside Pat's name. Drawn rather than typed: Press Start 2P
     has no crown or star glyph, so a character falls back to a system font
     and turns to mush at 9px. An SVG stays crisp at any size. */
  var CROWN =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.35 6.3L12 16.5l-5.65 3.2 1.35-6.3' +
        'L2.9 9.1l6.4-.7z" fill="currentColor"/>' +
    '</svg>';

  function rowHtml(g, row, rank, extraClass) {
    var cls = (row.is_owner ? ' is-owner' : '') + (extraClass ? ' ' + extraClass : '');
    return '<li class="' + cls.trim() + '">' +
             '<span class="b-rank">' + ('0' + rank).slice(-2) + '</span>' +
             '<span class="b-name">' + esc(row.player) +
               (row.is_owner ? '<i class="b-crown" title="Pat’s own score">' +
                                 CROWN + '</i>' : '') +
             '</span>' +
             '<span class="b-score">' + net.rowValue(g.id, row) + '</span>' +
           '</li>';
  }

  /* The champion strip is Pat's own all-time high, not the world's. Others
     can outrank him on the board below - they cannot take that box, and his
     row is pinned onto the list even when it has been knocked out of the
     top ten. If he has never played this game, the box falls back to whoever
     is top and says so. */
  function loadBoard() {
    var g = game;
    return Promise.all([
      net.fetchScores(g.id, g.mode, 10),
      net.fetchOwnerBest(g.id, g.mode)
    ]).then(function (res) {
      if (game !== g) return;                 // dial moved while we waited
      var rows = res[0] || [];
      var mine = res[1];

      if (!rows.length) {
        champLabel.textContent = 'ALL-TIME HIGH';
        champInitials.textContent = '---';
        champScore.textContent = '---';
        if (champDate) champDate.textContent = '';
        board.innerHTML = '<li class="b-empty">' +
          (net.isOffline() ? 'BOARD UNREACHABLE' : 'BE THE FIRST') + '</li>';
        return;
      }

      var head = mine || rows[0];
      champLabel.textContent = mine ? "PAT'S ALL-TIME HIGH" : 'ALL-TIME HIGH';
      champInitials.textContent = head.player;
      champScore.textContent = net.rowValue(g.id, head);
      if (champDate) champDate.textContent = monthYear(head.created_at);

      var html = rows.map(function (row, i) {
        return rowHtml(g, row, i + 1);
      }).join('');

      // Knocked out of the top ten? Pin him underneath at his real rank.
      var inTop = mine && rows.some(function (r) { return r.id === mine.id; });
      board.innerHTML = html;
      if (mine && !inTop) {
        net.fetchRank(g.id, g.mode, mine[net.metricCol(g.id)]).then(function (rank) {
          if (game !== g) return;
          board.insertAdjacentHTML('beforeend',
            '<li class="b-gap" aria-hidden="true">&middot;&middot;&middot;</li>' +
            rowHtml(g, mine, rank || 99, 'is-pinned'));
        });
      }
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

  /* ------------------------------ owner mode ---------------------------- */
  /* Pat turns his own browser into the owner by visiting the page once with
     ?owner=<secret>. The secret is kept in localStorage and the query string
     is scrubbed from the URL immediately, so it never sits in history or in
     a screenshot. ?owner=off forgets it again. Nothing about owner mode
     ships in the page: without the secret these calls just return false. */
  (function initOwnerMode() {
    var m = /[?&]owner=([^&]+)/.exec(window.location.search);
    if (!m) return;
    var value = decodeURIComponent(m[1]);
    if (value === 'off') {
      net.setOwnerSecret('');
    } else {
      net.setOwnerSecret(value);
    }
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    root.setAttribute('data-owner', net.isOwnerMode() ? 'true' : 'false');
  })();
  root.setAttribute('data-owner', net.isOwnerMode() ? 'true' : 'false');

  /* ------------------------------- the dial ----------------------------- */

  function select(i) {
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

  }

  /* e.detail is 0 when a click came from the keyboard (Enter/Space on a
     focused button) and >0 when it came from a real pointer. Only the
     pointer case gives the keyboard back to the game; someone who tabbed
     here on purpose keeps focus and can keep arrowing through the games. */
  function turn(to, e) {
    S.dial();
    select(to);
    if (dial && e && e.detail > 0) dial.blur();
  }

  if (dial) {
    dial.addEventListener('click', function (e) { turn(index + 1, e); });
    dial.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); turn(index + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); turn(index - 1); }
    });
  }
  ticks.forEach(function (t) {
    t.addEventListener('click', function (e) {
      var i = ORDER.indexOf(t.dataset.slot);
      if (i >= 0 && i !== index) turn(i, e);
      if (dial && e && e.detail > 0) dial.blur();
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

  /* Same rule as the dial: a clicked button must not keep the keyboard, or
     the next Space pauses nothing and re-presses this instead. */
  function releaseKeys(btn, e) {
    if (btn && e && e.detail > 0) btn.blur();
  }

  if (coinBtn) coinBtn.addEventListener('click', function (e) {
    insertCoin();
    releaseKeys(coinBtn, e);
  });

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
      releaseKeys(muteBtn, e);
    });
  }

  // Attract mode runs either way. The only difference a credit makes is
  // whether pressing a key does anything.
  hasCredit = credited();
  root.setAttribute('data-inserted', hasCredit ? 'true' : 'false');
  if (hasCredit && coinModule) coinModule.classList.add('is-inserting');
  select(0);
})();
