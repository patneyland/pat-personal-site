/* ==========================================================================
   Arcade - score persistence.

   Talks to Supabase by plain fetch against PostgREST. No supabase-js, no
   CDN, no build step. The key is a publishable anon key behind RLS: anon may
   SELECT and INSERT only, which is the intended setup for a static client.

   This is the PUBLIC, worldwide board and it is its own table. It is
   deliberately NOT public.arcade_scores - that one belongs to the Neon
   Arcade family game night (repos/arcade) and is left alone. Nothing here
   reads or writes it.

   Table public.site_arcade_scores
     game      text      'snake' | 'minesweeper' | 'asteroids'
     mode      text      'classic' for snake/asteroids, '10x10' for minesweeper
     player    text      1-16 chars (CHECK constraint)
     score     integer   score games only, NULL for minesweeper
     time_ms   integer   minesweeper only, NULL for the others
     created_at timestamptz

   A CHECK keeps the metric honest: score games must carry a score and no
   time, minesweeper the reverse. There is no UPDATE or DELETE policy, so a
   score cannot be taken back once it is posted.

   There is no sample data and no fallback board. This page is public, so a
   made-up score under a name that reads like a real person is worse than an
   empty rail. A read that fails reports itself through isOffline() and the
   cabinet says the board is unreachable; a read that succeeds with no rows
   renders as the empty board it is.
   ========================================================================== */
'use strict';

window.ArcadeNet = (function () {
  var URL = 'https://pikvadotiruvanjjnfid.supabase.co';
  var KEY = 'sb_publishable__0QqjeyxrBnBb3Ml7UqDrg_G6_Z2-va';
  var TABLE = 'site_arcade_scores';
  var PLAYER_KEY = 'arcade_player';

  var HEADERS = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  /* Which column each game ranks on, and which way. */
  var METRIC = {
    snake:       { col: 'score',   order: 'score.desc,created_at.asc' },
    asteroids:   { col: 'score',   order: 'score.desc,created_at.asc' },
    minesweeper: { col: 'time_ms', order: 'time_ms.asc,created_at.asc' }
  };

  var offline = false;   // set true after the first failed request

  function cleanPlayerName(raw) {
    var name = String(raw == null ? '' : raw).trim();
    if (name.length < 1 || name.length > 16) return null;
    return name;
  }

  /** Top `limit` rows for one game/mode. Never rejects: falls back to samples. */
  function fetchScores(game, mode, limit) {
    limit = limit || 8;
    var m = METRIC[game];
    if (!m) return Promise.resolve([]);

    if (offline) return Promise.resolve([]);

    var url = URL + '/rest/v1/' + TABLE + ''
      + '?game=eq.' + encodeURIComponent(game)
      + '&mode=eq.' + encodeURIComponent(mode)
      + '&select=id,player,' + m.col + ',created_at'
      + '&order=' + m.order
      + '&limit=' + limit;

    return fetch(url, { headers: HEADERS })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (rows) {
        // An empty board is a real answer and it gets shown as one. Samples
        // are for a request that never arrived, nothing else. The page is
        // public now, and inventing scores under names that read like real
        // people is worse than an honest empty board.
        return rows || [];
      })
      .catch(function () {
        offline = true;
        return [];
      });
  }

  /** Insert one row. Rejects with a human-readable Error on failure. */
  function submitScore(opts) {
    var name = cleanPlayerName(opts.player);
    if (!name) return Promise.reject(new Error('Name must be 1-16 characters.'));
    if (!METRIC[opts.game]) return Promise.reject(new Error('Unknown game: ' + opts.game));

    var row = {
      game: opts.game,
      mode: opts.mode,
      player: name,
      score: opts.score == null ? null : opts.score,
      time_ms: opts.time_ms == null ? null : opts.time_ms
    };

    return fetch(URL + '/rest/v1/' + TABLE + '', {
      method: 'POST',
      headers: Object.assign({}, HEADERS, {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      }),
      body: JSON.stringify([row])
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j.message || ('Submit failed (' + res.status + ')'));
        });
      }
      return res.json().then(function (rows) { return rows[0]; });
    }, function () {
      throw new Error('Network error - score not saved.');
    });
  }

  /* ------------------------------ formatting ------------------------------ */

  /** 41200 -> "0:41.2". The rail is narrow, so one decimal, not three. */
  function formatTime(ms) {
    ms = Math.max(0, Math.floor(ms));
    var m = Math.floor(ms / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    var tenth = Math.floor((ms % 1000) / 100);
    return m + ':' + String(s).padStart(2, '0') + '.' + tenth;
  }

  /** 184750 -> "184,750" */
  function formatScore(n) {
    return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** The value a row shows in the rail, already formatted. */
  function rowValue(game, row) {
    return METRIC[game].col === 'time_ms'
      ? formatTime(row.time_ms)
      : formatScore(row.score);
  }

  /* --------------------------- remembered player --------------------------- */

  function getSavedPlayer() {
    try { return localStorage.getItem(PLAYER_KEY) || ''; } catch (e) { return ''; }
  }

  function savePlayer(name) {
    var clean = cleanPlayerName(name);
    if (!clean) return;
    try { localStorage.setItem(PLAYER_KEY, clean); } catch (e) { /* ignore */ }
  }

  return {
    fetchScores: fetchScores,
    submitScore: submitScore,
    cleanPlayerName: cleanPlayerName,
    formatTime: formatTime,
    formatScore: formatScore,
    rowValue: rowValue,
    getSavedPlayer: getSavedPlayer,
    savePlayer: savePlayer,
    isOffline: function () { return offline; }
  };
})();
