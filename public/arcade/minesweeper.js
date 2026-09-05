/* ==========================================================================
   MINESWEEPER - 10x10, 15 mines, fastest time wins.

   Ported from repos/arcade/assets/minesweeper.js with the board size locked.
   The original shipped seven sizes behind a dropdown; Pat picked 10x10, so
   the selector is gone and `mode` is the constant '10x10'. 15 mines is the
   count the original already used for that size, so existing 10x10 rows in
   arcade_scores stay comparable with new ones.

   Kept: safe first click (mines are placed after it, never under it), flood
   fill through zero cells, chording on a revealed number, flags, and a
   millisecond-precision timer that starts on the first reveal.

   Dropped: the size dropdown, the submit form, the mini-scoreboard. The
   cabinet owns those, and the leaderboard lives in the rail.
   ========================================================================== */
'use strict';

window.ArcadeGames = window.ArcadeGames || {};

window.ArcadeGames.minesweeper = (function () {
  var SIZE = 10;
  var MINES = 15;
  var LONG_PRESS_MS = 450;

  var S = window.ArcadeSound;

  function mount(host, api) {
    var wrap = document.createElement('div');
    wrap.className = 'ms-wrap';
    var boardEl = document.createElement('div');
    boardEl.className = 'ms-board';
    wrap.appendChild(boardEl);

    /* Right-click flags, but nobody discovers that and a touch screen has no
       right button at all. This is the visible way in. It sits bottom left,
       opposite the volume button, so it reads as another piece of cabinet
       furniture rather than part of the board. */
    /* The keys are printed on the buttons rather than left in the attract
       text, which is gone by the time anyone needs them. */
    function markButton(cls, glyph, label, key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ms-flag-btn ' + cls;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', label);
      b.innerHTML = '<span class="ms-flag-glyph">' + glyph + '</span>' +
                    '<kbd class="ms-flag-key">' + key + '</kbd>';
      wrap.appendChild(b);
      return b;
    }

    var bar = document.createElement('div');
    bar.className = 'ms-marks';
    wrap.appendChild(bar);
    var flagBtn = markButton('is-flag', '⚑',
                             'Flag mode: click cells to flag them', 'F');
    var quesBtn = markButton('is-question', '?',
                             'Question mode: click cells to mark them unsure', 'Q');
    bar.appendChild(flagBtn);
    bar.appendChild(quesBtn);
    host.appendChild(wrap);

    /* 0 plain clicking, 1 planting flags, 2 planting question marks. One
       mode, two buttons: turning one on turns the other off, because a click
       can only mean one thing. */
    var markMode = 0;

    function setMarkMode(mode) {
      markMode = mode;
      flagBtn.setAttribute('aria-pressed', mode === 1 ? 'true' : 'false');
      quesBtn.setAttribute('aria-pressed', mode === 2 ? 'true' : 'false');
      wrap.classList.toggle('flagging', mode !== 0);
    }

    function wireMode(btn, mode) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setMarkMode(markMode === mode ? 0 : mode);
        S.flag();
        // Give the keyboard back, or the next R/F/Q lands on this button.
        if (e.detail > 0) btn.blur();
      });
    }
    wireMode(flagBtn, 1);
    wireMode(quesBtn, 2);

    var grid, minesPlaced, revealedCount, flagCount;
    var state = 'idle';          // idle | ready | playing | won | lost
    var startedAt = 0, elapsed = 0, timerId = null;
    var pressTimer = null, longPressed = false;

    /* ------------------------------ helpers ------------------------------ */

    function neighbors(r, c) {
      var out = [];
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          var nr = r + dr, nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < SIZE && nc < SIZE) out.push([nr, nc]);
        }
      }
      return out;
    }

    function report() {
      api.setStatus({
        value: window.ArcadeNet.formatTime(elapsed),
        extra: (MINES - flagCount) + ' MINES'
      });
    }

    /* ------------------------------- build ------------------------------- */

    function newGame() {
      stopTimer();
      grid = [];
      minesPlaced = false;
      revealedCount = 0;
      flagCount = 0;
      elapsed = 0;
      state = 'ready';
      boardEl.innerHTML = '';
      boardEl.style.setProperty('--ms-size', SIZE);

      for (var r = 0; r < SIZE; r++) {
        var row = [];
        for (var c = 0; c < SIZE; c++) {
          var el = document.createElement('button');
          el.type = 'button';
          el.className = 'ms-cell';
          el.dataset.r = r;
          el.dataset.c = c;
          boardEl.appendChild(el);
          // mark: 0 none, 1 flag, 2 question. Windows cycled through all
          // three on right click, and only the flag counted against the
          // mine total or blocked a reveal.
          row.push({ el: el, mine: false, adj: 0, revealed: false, mark: 0 });
        }
        grid.push(row);
      }
      setMarkMode(0);
      api.setState('playing');   // the board is live the moment it is drawn
      report();
    }

    /** Mines go down after the first click so it is never a mine. */
    function placeMines(safeR, safeC) {
      var safe = {};
      safe[safeR + ',' + safeC] = true;
      neighbors(safeR, safeC).forEach(function (rc) { safe[rc[0] + ',' + rc[1]] = true; });

      var spots = [];
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (!safe[r + ',' + c]) spots.push([r, c]);
        }
      }
      // Fisher-Yates, take the first MINES
      for (var i = spots.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = spots[i]; spots[i] = spots[j]; spots[j] = t;
      }
      spots.slice(0, MINES).forEach(function (rc) { grid[rc[0]][rc[1]].mine = true; });

      for (var rr = 0; rr < SIZE; rr++) {
        for (var cc = 0; cc < SIZE; cc++) {
          if (grid[rr][cc].mine) continue;
          var n = 0;
          neighbors(rr, cc).forEach(function (rc) { if (grid[rc[0]][rc[1]].mine) n++; });
          grid[rr][cc].adj = n;
        }
      }
      minesPlaced = true;
    }

    /* ------------------------------- timer ------------------------------- */

    function startTimer() {
      startedAt = performance.now();
      timerId = setInterval(function () {
        elapsed = performance.now() - startedAt;
        report();
      }, 100);
    }

    function stopTimer() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    }

    /* ------------------------------ revealing ---------------------------- */

    function paintRevealed(cell) {
      cell.el.classList.add('revealed');
      if (cell.adj > 0) {
        cell.el.textContent = String(cell.adj);
        cell.el.classList.add('n' + cell.adj);
      } else {
        cell.el.textContent = '';
      }
    }

    function reveal(startR, startC) {
      var opened = 0;
      var stack = [[startR, startC]];
      while (stack.length) {
        var rc = stack.pop();
        var r = rc[0], c = rc[1];
        var cell = grid[r][c];
        if (cell.revealed || cell.mark === 1) continue;   // a question mark does not protect a cell
        cell.revealed = true;

        if (cell.mine) { lose(r, c); return; }

        revealedCount++;
        opened++;
        paintRevealed(cell);

        if (cell.adj === 0) {
          // a zero cell's neighbours are mine-free by definition, spread out
          neighbors(r, c).forEach(function (nrc) {
            var nc = grid[nrc[0]][nrc[1]];
            if (!nc.revealed && nc.mark !== 1) stack.push(nrc);
          });
        }
      }
      // One cell is a tick; a flood opening a pocket is the two-note sweep.
      if (opened > 1) S.sweep(); else if (opened === 1) S.tick();
      checkWin();
    }

    /** Plant one particular mark, or lift it if it is already there. */
    function applyMark(r, c, mark) {
      if (!minesPlaced && !api.canStart()) return;
      if (state !== 'playing' && state !== 'ready') return;
      var cell = grid[r][c];
      if (cell.revealed) return;
      setMark(cell, cell.mark === mark ? 0 : mark);
      S.flag();
      report();
    }

    /** none -> flag -> question -> none, as Windows did it. */
    function cycleMark(r, c) {
      if (!minesPlaced && !api.canStart()) return;
      if (state !== 'playing' && state !== 'ready') return;
      var cell = grid[r][c];
      if (cell.revealed) return;
      setMark(cell, (cell.mark + 1) % 3);
      S.flag();
      report();
    }

    function setMark(cell, mark) {
      if (cell.mark === 1) flagCount--;
      cell.mark = mark;
      if (mark === 1) flagCount++;
      cell.el.textContent = mark === 1 ? '⚑' : mark === 2 ? '?' : '';
      cell.el.classList.toggle('flagged', mark === 1);
      cell.el.classList.toggle('guess', mark === 2);
    }

    /** Click a revealed number with the right count of flags around it. */
    function chord(r, c) {
      var cell = grid[r][c];
      if (!cell.revealed || cell.adj === 0) return;
      var around = neighbors(r, c);
      var flags = 0;
      around.forEach(function (rc) { if (grid[rc[0]][rc[1]].mark === 1) flags++; });
      if (flags !== cell.adj) return;
      for (var i = 0; i < around.length; i++) {
        var nc = grid[around[i][0]][around[i][1]];
        if (!nc.revealed && nc.mark !== 1) {
          reveal(around[i][0], around[i][1]);
          if (state === 'lost' || state === 'won') return;
        }
      }
    }

    function handleReveal(r, c) {
      if (!minesPlaced && !api.canStart()) return;
      if (state === 'won' || state === 'lost') return;
      var cell = grid[r][c];
      if (cell.revealed) { chord(r, c); return; }
      if (cell.mark === 1) return;      // flagged cells are protected; questioned ones are not

      if (!minesPlaced) {
        placeMines(r, c);
        state = 'playing';
        startTimer();
      } else if (state === 'ready') {
        state = 'playing';
      }
      reveal(r, c);
    }

    /* ------------------------------- endings ----------------------------- */

    function lose(r, c) {
      state = 'lost';
      stopTimer();
      S.boom();
      grid[r][c].el.classList.add('boom');
      for (var rr = 0; rr < SIZE; rr++) {
        for (var cc = 0; cc < SIZE; cc++) {
          var cell = grid[rr][cc];
          if (cell.mine && cell.mark !== 1) {
            cell.el.classList.remove('guess');
            cell.el.classList.add('revealed', 'mine');
            cell.el.textContent = '✹';
          } else if (!cell.mine && cell.mark === 1) {
            cell.el.classList.add('wrong');
          }
        }
      }
      api.gameOver({ lost: true, message: 'BOOM' });
    }

    function checkWin() {
      if (revealedCount !== SIZE * SIZE - MINES) return;
      state = 'won';
      stopTimer();
      S.win();
      elapsed = startedAt ? performance.now() - startedAt : 0;
      report();
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          var cell = grid[r][c];
          if (cell.mine && cell.mark !== 1) setMark(cell, 1);
        }
      }
      api.gameOver({
        time_ms: Math.round(elapsed),
        display: window.ArcadeNet.formatTime(elapsed)
      });
    }

    /* ------------------------------- input ------------------------------- */

    function cellFrom(e) {
      var el = e.target.closest('.ms-cell');
      if (!el) return null;
      return { r: +el.dataset.r, c: +el.dataset.c };
    }

    function onPointerDown(e) {
      var rc = cellFrom(e);
      if (!rc) return;
      longPressed = false;
      if (e.pointerType === 'touch') {
        pressTimer = setTimeout(function () {
          longPressed = true;
          cycleMark(rc.r, rc.c);
        }, LONG_PRESS_MS);
      }
    }

    function onPointerUp(e) {
      clearTimeout(pressTimer);
      var rc = cellFrom(e);
      if (!rc) return;
      if (longPressed) { longPressed = false; return; }
      if (e.button === 2) return;         // handled by contextmenu
      // In a marking mode a plain click plants that mark, and clicking it
      // again lifts it - no cycling through the other one to get back to
      // plain. Clicking an already revealed cell still chords, because that
      // is never destructive and it is what you want mid-sweep.
      if (markMode && !grid[rc.r][rc.c].revealed) {
        applyMark(rc.r, rc.c, markMode);
        return;
      }
      handleReveal(rc.r, rc.c);
    }

    function onContext(e) {
      e.preventDefault();
      var rc = cellFrom(e);
      if (rc) cycleMark(rc.r, rc.c);
    }

    function onKey(e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); newGame(); }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setMarkMode(markMode === 1 ? 0 : 1); }
      if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); setMarkMode(markMode === 2 ? 0 : 2); }
    }

    boardEl.addEventListener('pointerdown', onPointerDown);
    boardEl.addEventListener('pointerup', onPointerUp);
    boardEl.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey);

    newGame();

    return {
      start: newGame,
      repaint: function () { /* CSS driven, nothing to redraw */ },
      resize: function () { /* CSS grid handles it */ },
      destroy: function () {
        stopTimer();
        clearTimeout(pressTimer);
        boardEl.removeEventListener('pointerdown', onPointerDown);
        boardEl.removeEventListener('pointerup', onPointerUp);
        boardEl.removeEventListener('contextmenu', onContext);
        document.removeEventListener('keydown', onKey);
        wrap.remove();
      }
    };
  }

  return {
    id: 'minesweeper',
    name: 'MINESWEEPER',
    mode: '10x10',
    metric: 'time',
    attract: '10 BY 10. FIFTEEN MINES. FASTEST WINS.',
    controls: 'CLICK REVEALS  /  RIGHT CLICK CYCLES  /  F FLAG  /  Q QUESTION',
    mount: mount
  };
})();
