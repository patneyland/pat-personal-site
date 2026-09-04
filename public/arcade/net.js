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

   FALLBACK: the board starts empty, and opened from file:// the origin is
   null and Supabase may refuse the request. Either way a read degrades to
   local sample rows so the page never looks broken.
   ========================================================================== */
'use strict';

window.ArcadeNet = (function () {
  var URL = 'https://pikvadotiruvanjjnfid.supabase.co';
  var KEY = 'sb_publishable__0QqjeyxrBnBb3Ml7UqDrg_G6_Z2-va';
  var TABLE = 'site_arcade_scores';
  var PLAYER_KEY = 'arcade_player';

  var HEADERS = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  /* Sample boards, used when the network is unreachable (file://, offline,
     RLS refusal). The page must never look broken just because it is being
     previewed from disk. */
  var FALLBACK = {
    snake: [
      { player: 'NEYLAND',  score: 184750 }, { player: 'ROOKIE',  score: 96410 },
      { player: 'AVALON',   score: 88205 },  { player: 'DIGDUG',  score: 71940 },
      { player: 'JLWATTS',  score: 64330 },  { player: 'ZEKE',    score: 52875 },
      { player: 'HOTBOX',   score: 41600 },  { player: 'CASSIDY', score: 33215 }
    ],
    minesweeper: [
      { player: 'NEYLAND',  time_ms: 41200 },  { player: 'SWEEPER', time_ms: 53800 },
      { player: 'ROOKIE',   time_ms: 62400 },  { player: 'HOTBOX',  time_ms: 74100 },
      { player: 'AVALON',   time_ms: 81600 },  { player: 'DIGDUG',  time_ms: 97300 },
      { player: 'ZEKE',     time_ms: 108900 }, { player: 'JLWATTS', time_ms: 125400 }
    ],
    asteroids: [
      { player: 'NEYLAND',  score: 42780 }, { player: 'VECTOR',  score: 31150 },
      { player: 'ROCKHTR',  score: 27600 }, { player: 'AVALON',  score: 22940 },
      { player: 'DRIFTER',  score: 18320 }, { player: 'ZEKE',    score: 14775 },
      { player: 'ROOKIE',   score: 11040 }, { player: 'CASSIDY', score: 8615 }
    ]
  };

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

    if (offline) return Promise.resolve(sample(game, limit));

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
        // An empty live board is still a live board, but it looks broken on a
        // mockup, so only real rows win.
        return (rows && rows.length) ? rows : sample(game, limit);
      })
      .catch(function () {
        offline = true;
        return sample(game, limit);
      });
  }

  function sample(game, limit) {
    return (FALLBACK[game] || []).slice(0, limit).map(function (r) {
      return { id: null, player: r.player, score: r.score, time_ms: r.time_ms, sample: true };
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
