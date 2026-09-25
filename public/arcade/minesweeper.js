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

    /* Explicit primary modes remain visible below the board. Question marks
       are secondary, while right-click and keyboard shortcuts still work. */
    function markButton(cls, glyph, label, key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ms-flag-btn ' + cls;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', label);
      b.innerHTML = '<span class="ms-mode-label">' + glyph + '</span>' +
                    (key ? '<kbd class="ms-flag-key">' + key + '</kbd>' : '');
      return b;
    }

    var bar = document.createElement('div');
    bar.className = 'ms-marks';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Cell action');
    wrap.appendChild(bar);
    var revealBtn = markButton('is-reveal', 'Reveal', 'Reveal cells', '');
    var flagBtn = markButton('is-flag', 'Flag',
                             'Flag mode: click cells to flag them', 'F');
    var quesBtn = markButton('is-question', 'Question',
                             'Question mode: click cells to mark them unsure', 'Q');
    bar.appendChild(revealBtn);
    bar.appendChild(flagBtn);
    var secondary = document.createElement('details');
    secondary.className = 'ms-secondary';
    var summary = document.createElement('summary');
    summary.textContent = 'More';
    secondary.appendChild(summary);
    secondary.appendChild(quesBtn);
    bar.appendChild(secondary);
    host.appendChild(wrap);

    /* 0 plain clicking, 1 planting flags, 2 planting question marks. One
       mode: turning one on turns the others off, because a click
       can only mean one thing. */
    var markMode = 0;

    function setMarkMode(mode) {
      markMode = mode;
      revealBtn.setAttribute('aria-pressed', mode === 0 ? 'true' : 'false');
      flagBtn.setAttribute('aria-pressed', mode === 1 ? 'true' : 'false');
      quesBtn.setAttribute('aria-pressed', mode === 2 ? 'true' : 'false');
      wrap.classList.toggle('flagging', mode !== 0);
      if (mode === 2) secondary.open = true;
    }

    function wireMode(btn, mode) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setMarkMode(mode);
        S.flag();
        // Give the keyboard back, or the next R/F/Q lands on this button.
        if (e.detail > 0) btn.blur();
      });
    }
    wireMode(revealBtn, 0);
    wireMode(flagBtn, 1);
    wireMode(quesBtn, 2);

    var grid, minesPlaced, revealedCount, flagCount;
    var state = 'idle';          // idle | ready | playing | won | lost
    var startedAt = 0, elapsed = 0, timerId = null;
    var pressTimer = null, press = null, beforePause = null;

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
      cancelPress();
      stopTimer();
      if (api.runReset) api.runReset();
      beforePause = null;
      wrap.classList.remove('is-paused');
      boardEl.inert = false;
      bar.inert = false;
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
          el.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1) + ': hidden');
          boardEl.appendChild(el);
          // mark: 0 none, 1 flag, 2 question. Windows cycled through all
          // three on right click, and only the flag counted against the
          // mine total or blocked a reveal.
          row.push({ el: el, mine: false, adj: 0, revealed: false, mark: 0 });
        }
        grid.push(row);
      }
      setMarkMode(0);
      api.setState('ready');     // choices stay available until the first reveal
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
      // Wall time includes time spent in a suspended browser or paused sheet.
      startedAt = Date.now();
      timerId = setInterval(function () {
        elapsed = Math.max(0, Date.now() - startedAt);
        report();
      }, 100);
    }

    function stopTimer() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    }

    /* ------------------------------ revealing ---------------------------- */

    function labelCell(cell, description) {
      cell.el.setAttribute('aria-label',
        'Row ' + (+cell.el.dataset.r + 1) + ', column ' + (+cell.el.dataset.c + 1) + ': ' + description);
    }

    function paintRevealed(cell) {
      cell.el.classList.add('revealed');
      if (cell.adj > 0) {
        cell.el.textContent = String(cell.adj);
        cell.el.classList.add('n' + cell.adj);
      } else {
        cell.el.textContent = '';
      }
      labelCell(cell, cell.adj > 0 ? cell.adj + ' adjacent ' + (cell.adj === 1 ? 'mine' : 'mines') : 'revealed, no adjacent mines');
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
      labelCell(cell, mark === 1 ? 'flagged' : mark === 2 ? 'question mark' : 'hidden');
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
      if (state !== 'playing' && state !== 'ready') return;
      var cell = grid[r][c];
      if (cell.revealed) { chord(r, c); return; }
      if (cell.mark === 1) return;      // flagged cells are protected; questioned ones are not

      if (!minesPlaced) {
        placeMines(r, c);
        state = 'playing';
        if (api.runStarted) api.runStarted();
        api.setState('playing');
        startTimer();
      } else if (state === 'ready') {
        state = 'playing';
      }
      reveal(r, c);
    }

    /* ------------------------------- endings ----------------------------- */

    function lose(r, c) {
      cancelPress();
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
            labelCell(cell, rr === r && cc === c ? 'exploded mine' : 'mine');
          } else if (!cell.mine && cell.mark === 1) {
            cell.el.classList.add('wrong');
            labelCell(cell, 'incorrect flag');
          }
        }
      }
      api.gameOver({ lost: true, message: 'BOOM' });
    }

    function checkWin() {
      if (revealedCount !== SIZE * SIZE - MINES) return;
      state = 'won';
      cancelPress();
      stopTimer();
      S.win();
      elapsed = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
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
      if (!el || !boardEl.contains(el)) return null;
      return { r: +el.dataset.r, c: +el.dataset.c, el: el };
    }

    function cancelPress(e) {
      if (e && (!press || e.pointerId !== press.id)) return;
      clearTimeout(pressTimer);
      pressTimer = null;
      if (!press) return;
      var old = press;
      press = null;
      old.cell.el.classList.remove('is-pressed');
      try { if (boardEl.hasPointerCapture(old.id)) boardEl.releasePointerCapture(old.id); } catch (_) { /* Already released. */ }
    }

    function insidePressedCell(e) {
      var bounds = press.cell.el.getBoundingClientRect();
      return e.clientX >= bounds.left && e.clientX < bounds.right &&
             e.clientY >= bounds.top && e.clientY < bounds.bottom;
    }

    function onPointerMove(e) {
      if (press && press.id === e.pointerId && !insidePressedCell(e)) cancelPress(e);
    }

    function onPointerDown(e) {
      if (e.button !== 0 || press || (state !== 'playing' && state !== 'ready')) return;
      var rc = cellFrom(e);
      if (!rc) return;
      press = { id: e.pointerId, cell: rc, long: false };
      rc.el.classList.add('is-pressed');
      try { boardEl.setPointerCapture(e.pointerId); } catch (_) { /* Already ended. */ }
      if (e.pointerType === 'touch') {
        pressTimer = setTimeout(function () {
          if (!press || press.id !== e.pointerId) return;
          press.long = true;
          applyMark(rc.r, rc.c, 1);
        }, LONG_PRESS_MS);
      }
    }

    function onPointerUp(e) {
      if (!press || press.id !== e.pointerId) return;
      var rc = press.cell;
      var activate = !press.long && insidePressedCell(e) && e.button === 0;
      cancelPress(e);
      if (!activate) return;
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

    function onCellClick(e) {
      // Pointer release is handled above; keyboard and assistive clicks have
      // no pointer gesture and still need to activate the focused cell.
      if (e.detail !== 0) return;
      var rc = cellFrom(e);
      if (!rc) return;
      if (markMode && !grid[rc.r][rc.c].revealed) applyMark(rc.r, rc.c, markMode);
      else handleReveal(rc.r, rc.c);
    }

    function onContext(e) {
      e.preventDefault();
      if (e.pointerType === 'touch' || (press && press.long)) return;
      var rc = cellFrom(e);
      if (rc) cycleMark(rc.r, rc.c);
    }

    function onKey(e) {
      var tag = e.target && e.target.tagName;
      var ownCell = e.target && e.target.classList && e.target.classList.contains('ms-cell') && boardEl.contains(e.target);
      if (e.defaultPrevented || (/^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/.test(tag) && !ownCell) || (e.target && e.target.isContentEditable)) return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); newGame(); }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setMarkMode(markMode === 1 ? 0 : 1); }
      if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); setMarkMode(markMode === 2 ? 0 : 2); }
    }

    boardEl.addEventListener('pointerdown', onPointerDown);
    boardEl.addEventListener('pointermove', onPointerMove);
    boardEl.addEventListener('pointerup', onPointerUp);
    boardEl.addEventListener('pointercancel', cancelPress);
    boardEl.addEventListener('lostpointercapture', cancelPress);
    boardEl.addEventListener('click', onCellClick);
    boardEl.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey);

    newGame();

    function pause() {
      if (state !== 'playing' && state !== 'ready') return;
      cancelPress();
      beforePause = state;
      state = 'paused';
      wrap.classList.add('is-paused');
      boardEl.inert = true;
      bar.inert = true;
      api.setState('paused');
    }

    function resume() {
      if (state !== 'paused') return;
      state = beforePause;
      beforePause = null;
      wrap.classList.remove('is-paused');
      boardEl.inert = false;
      bar.inert = false;
      if (minesPlaced) elapsed = Math.max(0, Date.now() - startedAt);
      report();
      api.setState(state);
    }

    return {
      start: newGame,
      pause: pause,
      resume: resume,
      getState: function () { return state; },
      repaint: function () { /* CSS driven, nothing to redraw */ },
      resize: function () { /* CSS grid handles it */ },
      destroy: function () {
        stopTimer();
        cancelPress();
        boardEl.removeEventListener('pointerdown', onPointerDown);
        boardEl.removeEventListener('pointermove', onPointerMove);
        boardEl.removeEventListener('pointerup', onPointerUp);
        boardEl.removeEventListener('pointercancel', cancelPress);
        boardEl.removeEventListener('lostpointercapture', cancelPress);
        boardEl.removeEventListener('click', onCellClick);
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
    touchControls: 'TAP REVEALS  /  HOLD PLANTS A FLAG',
    mount: mount
  };
})();
