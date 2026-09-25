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
  /* The phone shell, if mobile.js decided this is a phone. The cabinet only
     ever asks it two things: which control legend to print, and who to hand
     the screen to when it is built. */
  var phone = !!(window.ArcadePhone && window.ArcadePhone.active);
  /* Jev lives on his own page. On the main arcade he appears nowhere but his
     row on the leaderboard - not in the markup, not on the attract screen. */
  var jevPage = root.classList.contains('jev-enabled');
  function phoneMenuOpen() { return phone && root.getAttribute('data-sheet') === 'open'; }
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
  var pending = null;
  var benchmark = null;
  var benchmarkState = 'loading';
  var runBenchmark = null;
  var runInProgress = false;
  var boardRequest = 0;
  var sendingIds = new Set();
  var QUEUE_KEY = 'arcade_unsaved_results_v1';
  var unsaved = [];
  try {
    var stored = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]');
    if (Array.isArray(stored)) unsaved = stored.filter(function (r) {
      return r && ORDER.indexOf(r.game) >= 0 && typeof r.id === 'string' &&
        (r.game === 'minesweeper' ? Number.isFinite(r.time_ms) && r.time_ms > 0 : Number.isFinite(r.score) && r.score > 0);
    });
  } catch (e) { /* Keep results in memory if storage is unavailable. */ }

  function persistUnsaved() {
    try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(unsaved)); } catch (e) { /* keep in memory */ }
    paintUnsaved();
  }

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
    '<div class="challenge-bar">' +
      '<div class="game-choices" aria-label="Choose game"></div></div>' +
    '<button type="button" class="pause-btn" hidden>PAUSE</button>' +
    '<button type="button" class="unsaved-btn" hidden>SAVE PREVIOUS SCORE</button>' +
    '<div class="overlay" data-ov="pause" hidden role="dialog" aria-modal="true" aria-label="Game paused">' +
      '<div class="ov-title ov-title-sm">PAUSED</div><div class="pause-note"></div>' +
      '<button type="button" class="resume-btn">RESUME</button></div>' +
    '<div class="status" hidden><span class="status-value"></span>' +
      '<span class="status-extra"></span></div>' +
    '<div class="overlay" data-ov="attract">' +
      '<div class="ov-title"></div>' +
      '<div class="rule-glow"></div>' +
      '<div class="ov-sub"></div>' +
      '<div class="ov-controls"></div>' +
      '<div class="insert">INSERT COIN</div>' +
      (jevPage
        ? '<div class="ov-demo-tag" hidden></div>' +
          '<button type="button" class="ov-demo-play" hidden>TRY TO BEAT JEV AND PAT</button>'
        : '') +
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
    '<div class="overlay" data-ov="over" hidden role="dialog" aria-label="Game result">' +
      '<div class="ov-title ov-title-sm">GAME OVER</div>' +
      '<div class="ov-result"></div>' +
      '<div class="ov-comparison"></div>' +
      '<button type="button" class="ov-again">TRY AGAIN</button>' +
      '<button type="button" class="ov-save">SAVE SCORE</button>' +
      '<form class="ov-form" autocomplete="off" hidden>' +
        '<label class="ov-label" for="ac-name">ENTER YOUR NAME</label>' +
        '<input id="ac-name" class="ov-input" maxlength="16" spellcheck="false" />' +
        '<button type="submit" class="ov-btn">SUBMIT</button>' +
      '</form>' +
      '<div class="ov-msg" role="status"></div>' +
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
  var ovLabel     = ovOver.querySelector('.ov-label');
  var ovMsg       = ovOver.querySelector('.ov-msg');
  var ovAgain     = ovOver.querySelector('.ov-again');
  var ovComparison = screen.querySelector('.ov-comparison');
  var ovSave = screen.querySelector('.ov-save');
  var pauseOverlay = screen.querySelector('[data-ov="pause"]');
  var demoTag = screen.querySelector('.ov-demo-tag');
  var demoPlay = screen.querySelector('.ov-demo-play');
  /* The play button sits in the strip of screen under Jev's board, never on
     it: snake.js draws a square of 92% of its view's shorter side, in whole
     cells, and the picture runs on below the view. */
  function placeDemoPlay() {
    if (!demoPlay) return;
    var view = stage.querySelector && stage.querySelector('.snake-view');
    var picture = screen.parentNode;
    if (phone || !view || !view.getBoundingClientRect || !picture || !picture.getBoundingClientRect) return;
    var r = view.getBoundingClientRect(), o = ovAttract.getBoundingClientRect(), p = picture.getBoundingClientRect();
    var side = Math.floor(Math.min(r.width, r.height) * 0.92 / 24) * 24;
    var below = r.top + Math.round((r.height - side) / 2) + side, room = p.bottom - below, h = demoPlay.offsetHeight || 48;
    if (!side || room < h + 12) { demoPlay.classList.remove('is-placed'); return; }
    demoPlay.classList.add('is-placed');
    demoPlay.style.top = Math.round(below - o.top + (room - h) / 2) + 'px';
    demoPlay.style.left = Math.round(r.left + r.width / 2 - o.left) + 'px';
  }
  if (window.ResizeObserver) new ResizeObserver(placeDemoPlay).observe(stage);
  window.addEventListener('resize', placeDemoPlay);
  var pauseBtn = screen.querySelector('.pause-btn');
  var unsavedBtn = screen.querySelector('.unsaved-btn');
  var challenge = screen.querySelector('.challenge-bar');
  var rail = document.querySelector('.rail');
  if (rail) rail.appendChild(unsavedBtn);

  challenge.querySelector('.game-choices').innerHTML = ORDER.map(function (id) {
    return '<button type="button" data-game-choice="' + id + '" aria-pressed="false">' + games[id].name + '</button>';
  }).join('');
  document.addEventListener('click', function (e) {
    var choice = e.target.closest('[data-game-choice]');
    if (!choice) return;
    var id = choice.getAttribute('data-game-choice');
    if (screen.dataset.state === 'playing' || (screen.dataset.state === 'paused' && !phoneMenuOpen())) return;
    if (ORDER.indexOf(id) >= 0 && (!game || game.id !== id)) turn(ORDER.indexOf(id), e);
  });
  function paintChallenge() {
    if (!game) return;
    document.querySelectorAll('[data-game-choice]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-game-choice') === game.id));
      btn.disabled = screen.dataset.state === 'playing' || (screen.dataset.state === 'paused' && !phoneMenuOpen());
    });
  }
  function paintUnsaved() {
    if (!unsavedBtn || !game) return;
    var entries = unsaved.filter(function (r) { return r.game === game.id && r !== pending; });
    unsavedBtn.hidden = !entries.length || ['playing', 'paused'].indexOf(screen.dataset.state) >= 0;
    unsavedBtn.textContent = 'SAVE PREVIOUS SCORE' + (entries.length > 1 ? ' (' + entries.length + ')' : '');
  }
  function paintUtilities() {
    var state = screen.dataset.state;
    pauseBtn.hidden = state !== 'playing' && state !== 'paused';
    pauseBtn.textContent = state === 'paused' ? 'RESUME' : 'PAUSE';
    pauseOverlay.hidden = state !== 'paused';
    pauseOverlay.querySelector('.pause-note').textContent = game && game.id === 'minesweeper' ? 'TIMER KEEPS RUNNING' : '';
    stage.inert = state === 'paused' || state === 'over';
    paintUnsaved();
    paintChallenge();
  }

  picture.innerHTML = '';
  picture.appendChild(screen);
  muteBtn = screen.querySelector('.vol-btn');

  /* --------------------------------- api --------------------------------- */

  var api = {
    palette: palette,

    /** Games must ask before starting. No coin, no game. */
    canStart: function () {
      if (phone) S.unlock();
      if (!hasCredit && coinBtn) {
        // Nudge the thing they need to click.
        coinBtn.classList.remove('nudge');
        void coinBtn.offsetWidth;          // restart the animation
        coinBtn.classList.add('nudge');
      }
      return hasCredit;
    },

    setState: function (s) {
      var prior = screen.dataset.state;
      if (s === 'playing' && prior !== 'playing' && prior !== 'paused') {
        if (game.id !== 'minesweeper') {
          runBenchmark = benchmark ? Object.assign({}, benchmark) : null;
          runInProgress = true;
        }
        pending = null;
        ovInput.blur();
      }
      ovAttract.hidden = s !== 'idle';
      statusBar.hidden = s === 'idle' || s === 'ready' || s === 'over';
      if (s !== 'over') ovOver.hidden = true;
      screen.dataset.state = s;
      root.setAttribute('data-play', s);
      paintUtilities();
    },

    /* Snake's attract screen replays Jev's best game on Jev's own page. The
       main arcade is the plain game: no replay, no tag, no play button. The
       only place Jev shows up there is his row on the leaderboard. */
    loadReplay: function () {
      var g = game;
      return g.id === 'snake' && jevPage
        ? net.fetchJevReplay(g.id, g.mode).then(function (r) { return game === g ? r : null; })
        : Promise.resolve(null);
    },
    demoReady: function (r) {
      screen.dataset.demo = 'on';
      demoTag.innerHTML = 'JEV<i class="b-verified" title="Verified: Jev, the AI player, with no human input">' + CROWN + '</i>' +
        (r.score ? '<span>' + net.formatScore(r.score) + '</span>' : '');
      demoTag.hidden = false; demoPlay.hidden = false;
      placeDemoPlay();
    },

    setStatus: function (o) {
      statusValue.textContent = o.value == null ? '' : o.value;
      statusExtra.textContent = o.extra == null ? '' : o.extra;
    },

    runStarted: function () {
      runBenchmark = benchmark ? Object.assign({}, benchmark) : null;
      runInProgress = true;
      paintChallenge();
    },
    runReset: function () {
      runBenchmark = null;
      runInProgress = false;
      pending = null;
    },
    gameOver: function (result) {
      // The separate Jev controller marks decision-paced runs as ineligible.
      var worth = !result.lost && !result.practice &&
        (game.id === 'minesweeper' ? Number.isFinite(result.time_ms) && result.time_ms > 0 : Number.isFinite(result.score) && result.score > 0);
      pending = worth ? {
        id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
        game: game.id, mode: game.mode, score: result.score == null ? null : result.score,
        time_ms: result.time_ms == null ? null : result.time_ms,
        display: result.display || '', benchmark: runBenchmark,
        owner: !result.player && net.isOwnerMode(), player: result.player || null,
        jev: result.player === 'JEV', replay: result.player === 'JEV' ? result.replay || null : null
      } : null;
      if (pending) { unsaved.push(pending); persistUnsaved(); }
      showResult(result, pending);
    }
  };

  function showResult(result, entry) {
    pending = entry;
    api.setState('over');
    ovOver.hidden = false;
    ovMsg.textContent = '';
    ovMsg.className = 'ov-msg';
    ovBtn.disabled = !!(entry && sendingIds.has(entry.id));
    ovForm.hidden = true;
    ovSave.hidden = !entry;
    ovOver.querySelector('.ov-title').textContent = result.lost ? 'GAME OVER' : game.id === 'minesweeper' ? 'BOARD CLEARED' : 'GAME OVER';
    ovAgain.textContent = 'TRY AGAIN';
    ovResult.textContent = result.lost ? result.message || '' : 'YOU: ' + (result.display || '0');
    var target = entry ? entry.benchmark : runBenchmark;
    var actual = game.id === 'minesweeper' ? result.time_ms : result.score;
    var beat = !result.lost && !result.practice && target && (game.id === 'minesweeper' ? actual < target.value : actual > target.value);
    var tied = !result.lost && !result.practice && target && actual === target.value;
    ovComparison.textContent = result.practice ? 'UNRANKED' : beat ? 'YOU BEAT PAT!' : tied ? 'TIED PAT.' : '';
    ovComparison.hidden = !ovComparison.textContent;
    ovComparison.classList.toggle('is-beat', !!beat);
    ovInput.readOnly = !!(entry && (entry.owner || entry.player));
    ovInput.value = entry && entry.player ? entry.player : entry && entry.owner ? net.OWNER_NAME : net.getSavedPlayer();
    ovLabel.textContent = entry && (entry.owner || entry.player) ? 'PLAYING AS' : 'ENTER YOUR NAME';
    paintUnsaved();
  }

  ovSave.addEventListener('click', function () {
    if (!pending) return;
    ovForm.hidden = false;
    ovSave.hidden = true;
    ovInput.focus();
  });
  unsavedBtn.addEventListener('click', function () {
    if (['playing', 'paused'].indexOf(screen.dataset.state) >= 0) return;
    var entry = unsaved.find(function (r) { return r.game === game.id && r !== pending; });
    if (!entry) return;
    if (window.ArcadePhone && window.ArcadePhone.closeSheet) window.ArcadePhone.closeSheet();
    runBenchmark = entry.benchmark || null;
    showResult(entry, entry);
  });

  ovForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pending || sendingIds.has(pending.id)) return;
    var entry = pending;
    var name = net.cleanPlayerName(ovInput.value);
    if (!name) { ovMsg.textContent = 'NAME MUST BE 1-16 CHARACTERS'; ovMsg.className = 'ov-msg is-bad'; return; }
    if (entry.owner && !net.isOwnerMode()) { ovMsg.textContent = 'OWNER MODE REQUIRED TO SAVE THIS SCORE'; return; }
    sendingIds.add(entry.id);
    ovBtn.disabled = true;
    ovMsg.textContent = 'SENDING...';
    ovMsg.className = 'ov-msg';
    var run = { game: entry.game, mode: entry.mode, score: entry.score, time_ms: entry.time_ms };
    // Pat and Jev each keep one row, their best; a worse run changes nothing.
    var best = function (r) { return r.improved ? (r.first ? 'ON THE BOARD' : 'NEW PERSONAL BEST') : 'NOT YOUR BEST. BOARD UNCHANGED'; };
    var sending = entry.owner ? net.submitOwnerScore(run).then(best)
      : entry.jev ? net.submitJevScore(Object.assign({ replay: entry.replay }, run)).then(function (r) { return best(r).replace('YOUR', 'JEV’S'); })
      : net.submitScore(Object.assign({ player: name }, run)).then(function () { if (!entry.player) net.savePlayer(name); return 'ON THE BOARD'; });
    sending.then(function (msg) {
      sendingIds.delete(entry.id);
      unsaved = unsaved.filter(function (r) { return r.id !== entry.id; });
      persistUnsaved();
      if (game.id === entry.game) loadBoard();
      if (pending !== entry || screen.dataset.state !== 'over') return;
      S.submit();
      ovForm.hidden = true;
      ovSave.hidden = true;
      pending = null;
      ovMsg.textContent = msg;
      ovMsg.className = 'ov-msg is-good';
      paintUnsaved();
    }).catch(function (err) {
      sendingIds.delete(entry.id);
      if (pending !== entry || screen.dataset.state !== 'over') return;
      ovBtn.disabled = false;
      ovMsg.textContent = String(err.message || err).toUpperCase();
      ovMsg.className = 'ov-msg is-bad';
    });
  });

  ovAgain.addEventListener('click', function () {
    if (instance && instance.start) instance.start();
    ovAgain.blur();
  });
  function pause() { if (instance && instance.pause && screen.dataset.state === 'playing') instance.pause(); }
  function resume() { if (instance && instance.resume && screen.dataset.state === 'paused') { instance.resume(); pauseBtn.blur(); } }
  pauseBtn.addEventListener('click', function () { if (screen.dataset.state === 'paused') resume(); else pause(); });
  pauseOverlay.querySelector('.resume-btn').addEventListener('click', resume);
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });

  // Preserve native button activation while blocking document game shortcuts.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') return;
    if (root.getAttribute('data-sheet') === 'open') return;
    if (stage.contains(e.target) && screen.dataset.state !== 'paused') return;
    var interactive = e.target.closest && e.target.closest('button,input,select,textarea,a,[contenteditable="true"]');
    if (interactive || !hasCredit) {
      e.stopImmediatePropagation();
      return;
    }
    if (screen.dataset.state === 'paused') {
      e.stopImmediatePropagation();
      if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); resume(); }
      return;
    }
    if (screen.dataset.state === 'over' && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (instance && instance.start) instance.start();
    }
  }, true);

  /* ------------------------------ the rail ------------------------------ */

  /* The marker beside Pat's name: the verified badge, scalloped disc and
     tick, in Twitter's blue. Drawn rather than typed, because Press Start 2P
     has no such glyph and a font fallback turns to mush at 10px. */
  var CROWN =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91' +
        's-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.34 2.19' +
        'c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12' +
        's.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81' +
        'c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81' +
        's1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z' +
        'm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/>' +
    '</svg>';

  function rowHtml(g, row, rank, extraClass) {
    var cls = (row.is_owner ? ' is-owner' : '') + (row.is_jev ? ' is-jev' : '') + (extraClass ? ' ' + extraClass : '');
    return '<li class="' + cls.trim() + '">' +
             '<span class="b-rank">' + ('0' + rank).slice(-2) + '</span>' +
             '<span class="b-name">' + esc(row.player) +
               (row.is_owner ? '<i class="b-verified" title="Verified: Pat’s own score">' +
                                 CROWN + '</i>' : '') +
               (row.is_jev ? '<i class="b-verified" title="Verified: Jev, the AI player, with no human input">' +
                               CROWN + '</i>' : '') +
             '</span>' +
             '<span class="b-score">' + net.rowValue(g.id, row) + '</span>' +
           '</li>';
  }

  /* The rail is only so tall, and a full board is twelve items: ten rows, the
     break, and Pat's pinned row. Rather than let the overflow hide whichever
     came last - which was always his, the one row that must not disappear -
     drop rows off the bottom of the top ten until the rest fits. Four is the
     floor; below that the board is not worth showing.

     paintBoard always redraws from the full set before trimming. Trimming the
     DOM in place looked equivalent and was not: the first paint happens before
     Press Start 2P has loaded, the rows measure short, and rows got cut that
     would have fitted a moment later - permanently, because there was nothing
     left to put back. */
  var lastBoard = null;

  function paintBoard() {
    if (!board || !lastBoard) return;
    var b = lastBoard;
    var html = b.rows.map(function (row, i) { return rowHtml(b.g, row, i + 1); }).join('');
    if (b.mine && !b.inTop) {
      html += '<li class="b-gap" aria-hidden="true">&middot;&middot;&middot;</li>' +
              rowHtml(b.g, b.mine, b.rank || 99, 'is-pinned');
    }
    board.innerHTML = html;

    var guard = 0;
    while (board.scrollHeight > board.clientHeight + 1 && guard++ < 20) {
      var rows = board.querySelectorAll('li:not(.b-gap):not(.is-pinned)');
      if (rows.length <= 4) break;
      rows[rows.length - 1].remove();
    }
  }

  /* Re-fit once the pixel font is in, since everything measures differently
     before it lands. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { paintBoard(); });
  }

  /* The champion strip is Pat's own all-time high, not the world's. Others
     can outrank him on the board below - they cannot take that box, and his
     row is pinned onto the list even when it has been knocked out of the
     top ten. If he has never played this game, the box falls back to whoever
     is top and says so. */
  function loadBoard() {
    var g = game;
    var request = ++boardRequest;
    return Promise.all([
      net.fetchScores(g.id, g.mode, 10),
      net.fetchOwnerBestStatus ? net.fetchOwnerBestStatus(g.id, g.mode) : net.fetchOwnerBest(g.id, g.mode).then(function (row) { return { row: row, status: row ? 'ready' : 'error' }; })
    ]).then(function (res) {
      if (game !== g || request !== boardRequest) return;
      var rows = res[0] || [];
      var mine = res[1].row;
      benchmarkState = res[1].status;
      benchmark = mine ? { value: mine[net.metricCol(g.id)], display: net.rowValue(g.id, mine) } : null;
      paintChallenge();

      if (!rows.length) {
        champLabel.textContent = 'ALL-TIME HIGH';
        champInitials.textContent = '---';
        champScore.textContent = '---';
        if (champDate) champDate.textContent = '';
        lastBoard = null;
        board.innerHTML = '<li class="b-empty">' +
          (net.isOffline() ? 'BOARD UNREACHABLE' : 'BE THE FIRST') + '</li>';
        return;
      }

      var head = mine || rows[0];
      champLabel.textContent = mine ? "PAT'S ALL-TIME HIGH" : 'ALL-TIME HIGH';
      champInitials.textContent = head.player;
      champScore.textContent = net.rowValue(g.id, head);
      if (champDate) champDate.textContent = monthYear(head.created_at);

      // Knocked out of the top ten? Pin him underneath at his real rank.
      var inTop = mine && rows.some(function (r) { return r.id === mine.id; });
      lastBoard = { g: g, rows: rows, mine: mine, inTop: inTop, rank: null };
      paintBoard();

      if (mine && !inTop) {
        net.fetchRank(g.id, g.mode, mine[net.metricCol(g.id)]).then(function (rank) {
          if (game !== g || request !== boardRequest || !lastBoard) return;
          lastBoard.rank = rank;
          paintBoard();
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
    var url = new URL(window.location.href);
    if (!url.searchParams.has('owner')) return;
    var value = url.searchParams.get('owner');
    if (value === 'off') {
      net.setOwnerSecret('');
    } else {
      net.setOwnerSecret(value);
    }
    if (window.history && window.history.replaceState) {
      url.searchParams.delete('owner');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    root.setAttribute('data-owner', net.isOwnerMode() ? 'true' : 'false');
  })();
  root.setAttribute('data-owner', net.isOwnerMode() ? 'true' : 'false');

  /* ------------------------------- the dial ----------------------------- */

  function select(i) {
    if (screen.dataset.state === 'playing' || (screen.dataset.state === 'paused' && !phoneMenuOpen())) return;
    index = ((i % ORDER.length) + ORDER.length) % ORDER.length;
    var next = games[ORDER[index]];
    if (!next) return;

    if (instance) { instance.destroy(); instance = null; }
    game = next;
    benchmark = null;
    runBenchmark = null;
    runInProgress = false;
    benchmarkState = 'loading';
    var url = new URL(window.location.href);
    url.searchParams.set('game', game.id);
    url.searchParams.delete('owner');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);

    root.setAttribute('data-game', game.id);
    if (dial) dial.style.transform = 'rotate(' + DETENT[index] + 'deg)';
    ticks.forEach(function (t) {
      t.setAttribute('data-on', String(t.dataset.slot === game.id));
    });

    if (elTitle) elTitle.textContent = game.name;
    elGameLabels.forEach(function (e) { e.textContent = game.name; });
    ovTitle.textContent = game.name;
    ovSub.textContent = game.attract;
    ovControls.textContent = (phone && game.touchControls) || game.controls;
    paintCredit();

    pending = null;
    ovOver.hidden = true;
    delete screen.dataset.demo;
    if (demoTag) demoTag.hidden = true;
    if (demoPlay) demoPlay.hidden = true;
    instance = game.mount(stage, api);
    loadBoard();
    paintUtilities();

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

  var refit = null;
  window.addEventListener('resize', function () {
    if (instance && instance.resize) instance.resize();
    // Rows were dropped to fit the old height; reload so a taller window
    // gets them back rather than staying short for the rest of the session.
    clearTimeout(refit);
    refit = setTimeout(paintBoard, 200);
  });

  /** The blinking line at the foot of the attract screen. */
  function paintCredit() {
    var line = ovAttract.querySelector('.insert');
    if (line) {
      line.textContent = hasCredit
        ? (phone ? 'TAP TO START' : 'PRESS SPACE TO START')
        : 'INSERT COIN';
    }
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
    paintUtilities();
  }

  function insertCoin() {
    if (root.getAttribute('data-inserted') === 'true') return;
    S.unlock();
    S.coin();
    coinModule.classList.add('is-inserting');
    try { sessionStorage.setItem(CREDIT_KEY, '1'); } catch (e) { /* ignore */ }
    // The tube comes up as the coin finishes going in, not while it is
    // still turning onto its edge. Flip is the first 450ms of a 1.5s drop.
    setTimeout(powerUp, 1500);
  }

  /* Same rule as the dial: a clicked button must not keep the keyboard, or
     the next Space pauses nothing and re-presses this instead. */
  function releaseKeys(btn, e) {
    if (btn && e && e.detail > 0) btn.blur();
  }

  // Starting from the replay puts the coin in on the visitor's behalf.
  if (demoPlay) demoPlay.addEventListener('click', function (e) {
    releaseKeys(demoPlay, e);
    // From Jev's viewing page, the challenge happens on the real arcade.
    if (jevPage) { window.location.href = '/arcade?game=snake'; return; }
    if (!instance || screen.dataset.state !== 'idle') return;
    if (hasCredit) { instance.start(); return; }
    insertCoin();
    setTimeout(function () { if (instance && screen.dataset.state === 'idle') instance.start(); }, 1600);
  });

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
  // The Jev page is for watching, not playing: no coin to put in.
  hasCredit = phone || jevPage || credited();
  root.setAttribute('data-inserted', hasCredit ? 'true' : 'false');
  if (!phone && hasCredit && coinModule) coinModule.classList.add('is-inserting');
  var initialGame = new URL(window.location.href).searchParams.get('game');
  window.ArcadeCabinet = {
    selectGame: function (id) { var i = ORDER.indexOf(id); if (i >= 0) select(i); },
    currentGame: function () { return game && game.id; }, pause: pause, resume: resume,
    refreshUI: paintUtilities
  };
  select(Math.max(0, ORDER.indexOf(initialGame)));

  /* The phone shell is built before this file runs, but the screen and the
     state it publishes only exist once the cabinet has assembled them. */
  if (window.ArcadePhone && window.ArcadePhone.attach) {
    window.ArcadePhone.attach({ screen: screen, dial: dial, pauseBtn: pauseBtn, challenge: challenge });
    paintChallenge();
  }
})();
