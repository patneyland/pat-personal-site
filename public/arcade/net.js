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
     is_owner  boolean   true only on Pat's own rows
     created_at timestamptz

   is_owner cannot be set by anyone holding this key. The INSERT policy is
   WITH CHECK (is_owner = false), and the only way to flip it is
   claim_arcade_score(id, secret), a SECURITY DEFINER function that compares
   the secret against a table the anon role cannot read. So a visitor typing
   "Pat" gets the name and nothing else - no marker, no pinned row.

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
    /* `beats` is the PostgREST operator for "strictly better than", which is
       how a rank is counted: rank = (rows that beat you) + 1. */
    snake:       { col: 'score',   order: 'score.desc,created_at.asc',   beats: 'gt' },
    asteroids:   { col: 'score',   order: 'score.desc,created_at.asc',   beats: 'gt' },
    minesweeper: { col: 'time_ms', order: 'time_ms.asc,created_at.asc',  beats: 'lt' }
  };

  var OWNER_KEY = 'arcade_owner_secret';

  function getOwnerSecret() {
    try { return localStorage.getItem(OWNER_KEY) || ''; } catch (e) { return ''; }
  }
  function setOwnerSecret(v) {
    try {
      if (v) localStorage.setItem(OWNER_KEY, v);
      else localStorage.removeItem(OWNER_KEY);
    } catch (e) { /* ignore */ }
  }
  function isOwnerMode() { return !!getOwnerSecret(); }

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
      + '&select=id,player,' + m.col + ',is_owner,created_at'
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
          var raw = String(j.message || '');
          if (/reserved_name/.test(raw) || /site_arcade_scores_reserved_name/.test(raw)) {
            throw new Error('That name is taken. Pick another.');
          }
          throw new Error(raw || ('Submit failed (' + res.status + ')'));
        });
      }
      return res.json().then(function (rows) { return rows[0]; });
    }, function () {
      throw new Error('Network error - score not saved.');
    });
  }

  /** Pat's best row for this game, or null. Never falls back to samples:
      an invented owner row would be a lie about who holds the score. */
  function fetchOwnerBest(game, mode) {
    var m = METRIC[game];
    if (!m || offline) return Promise.resolve(null);
    var url = URL + '/rest/v1/' + TABLE
      + '?game=eq.' + encodeURIComponent(game)
      + '&mode=eq.' + encodeURIComponent(mode)
      + '&is_owner=is.true'
      + '&select=id,player,' + m.col + ',is_owner,created_at'
      + '&order=' + m.order
      + '&limit=1';
    return fetch(url, { headers: HEADERS })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (rows) { return (rows && rows[0]) || null; })
      .catch(function () { return null; });
  }

  /** Where a value sits on the board: one plus however many rows beat it. */
  function fetchRank(game, mode, value) {
    var m = METRIC[game];
    if (!m || offline || value == null) return Promise.resolve(null);
    var url = URL + '/rest/v1/' + TABLE
      + '?game=eq.' + encodeURIComponent(game)
      + '&mode=eq.' + encodeURIComponent(mode)
      + '&' + m.col + '=' + m.beats + '.' + encodeURIComponent(value)
      + '&select=id';
    return fetch(url, { headers: Object.assign({}, HEADERS, { Prefer: 'count=exact' }) })
      .then(function (res) {
        // PostgREST reports the total in Content-Range as "0-24/1234".
        var cr = res.headers.get('content-range') || '';
        var total = parseInt(cr.split('/')[1], 10);
        return isNaN(total) ? null : total + 1;
      })
      .catch(function () { return null; });
  }

  /* The name Pat plays under. Owner runs never ask for it, and the database
     reserves it: a CHECK constraint refuses any row carrying this name,
     in any casing, that is not flagged is_owner. */
  var OWNER_NAME = 'pat neyland';

  /** Owner submit. Keeps exactly ONE row per game: it updates that row when
      the run beat it and leaves it alone when it did not, so the board shows
      Pat once, at his best, rather than filling up with his attempts.
      Resolves { ok, improved, first }. */
  function submitOwnerScore(opts) {
    var secret = getOwnerSecret();
    if (!secret) return Promise.reject(new Error('Not in owner mode.'));
    return fetch(URL + '/rest/v1/rpc/submit_owner_score', {
      method: 'POST',
      headers: Object.assign({}, HEADERS, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        p_secret: secret,
        p_game: opts.game,
        p_mode: opts.mode,
        p_player: OWNER_NAME,
        p_score: opts.score == null ? null : opts.score,
        p_time_ms: opts.time_ms == null ? null : opts.time_ms
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Submit failed (' + res.status + ')');
      return res.json();
    }).then(function (r) {
      if (!r || r.ok !== true) throw new Error('Owner key rejected.');
      return r;
    }, function () {
      throw new Error('Network error - score not saved.');
    });
  }

  /** Flip is_owner on a row. Returns true only if the secret was right. */
  function claimScore(id) {
    var secret = getOwnerSecret();
    if (!id || !secret) return Promise.resolve(false);
    return fetch(URL + '/rest/v1/rpc/claim_arcade_score', {
      method: 'POST',
      headers: Object.assign({}, HEADERS, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p_id: id, p_secret: secret })
    })
      .then(function (res) { return res.ok ? res.json() : false; })
      .then(function (ok) { return ok === true; })
      .catch(function () { return false; });
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

  /** Which column this game ranks on: 'score' or 'time_ms'. */
  function metricCol(game) {
    return METRIC[game] ? METRIC[game].col : 'score';
  }

  return {
    OWNER_NAME: OWNER_NAME,
    submitOwnerScore: submitOwnerScore,
    metricCol: metricCol,
    fetchScores: fetchScores,
    fetchOwnerBest: fetchOwnerBest,
    fetchRank: fetchRank,
    claimScore: claimScore,
    getOwnerSecret: getOwnerSecret,
    setOwnerSecret: setOwnerSecret,
    isOwnerMode: isOwnerMode,
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
