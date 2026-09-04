/* ==========================================================================
   Arcade sound.

   Everything is synthesised with WebAudio at call time - no mp3s, no
   fetches, nothing to 404 when the page is opened off disk. That is also the
   period-correct way to do it: an arcade board in 1979 had a couple of
   oscillators, a noise source and a filter, which is exactly what this is.

   Traditional, specifically:
   - Asteroids gets its heartbeat. Two alternating low thumps that speed up
     as the wave is cleared and reset when the next one spawns. It is the
     most recognisable thing about that cabinet and it is pure tension.
   - Fire is a short downward chirp, thrust is filtered noise, and rocks
     explode as a noise burst whose pitch depends on how big the rock was.
   - Snake is plain square-wave blips, the way a single-chip handheld did it.
   - Minesweeper is a PC speaker: one channel, square waves, no envelope to
     speak of. It is a 1990 Windows game, not an arcade cabinet, and it
     should not pretend otherwise.
   - The coin is a coin: metal hitting metal and bouncing, then the credit
     beep the board plays back to say it counted.

   Browsers start an AudioContext suspended until a real user gesture. The
   coin click is that gesture, which is the other reason the coin goes in
   first.
   ========================================================================== */
'use strict';

window.ArcadeSound = (function () {
  var ctx = null, master = null;
  var muted = false;
  var MUTE_KEY = 'arcade_muted';

  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* ignore */ }

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.3;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ---------------------------- primitives ---------------------------- */

  function tone(o) {
    if (muted || !ac()) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.from, t0);
    if (o.to != null) {
      osc.frequency[o.linear ? 'linearRampToValueAtTime' : 'exponentialRampToValueAtTime'](
        Math.max(1, o.to), t0 + o.dur);
    }
    var peak = o.gain == null ? 0.28 : o.gain;
    // A hard-edged attack is the point: arcade boards did not fade in.
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  function noise(o) {
    if (muted || !ac()) return;
    var t0 = ctx.currentTime + (o.delay || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.from, t0);
    if (o.to != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    f.Q.value = o.q == null ? 1 : o.q;

    var g = ctx.createGain();
    var peak = o.gain == null ? 0.28 : o.gain;
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + o.dur + 0.02);
  }

  /* ------------------------------ the coin ----------------------------- */

  var S = {
    /* Metal on metal, three bounces down the chute, then the credit beep.
       The bounces get quieter, shorter and slightly lower each time. */
    coin: function () {
      var bounces = [
        { d: 0.00, g: 0.30, f: 5400 },
        { d: 0.085, g: 0.20, f: 4600 },
        { d: 0.150, g: 0.12, f: 3900 },
        { d: 0.198, g: 0.06, f: 3300 }
      ];
      bounces.forEach(function (b) {
        noise({ dur: 0.06, from: b.f, to: b.f * 0.55, filter: 'bandpass', q: 12, gain: b.g, delay: b.d });
        tone({ type: 'triangle', from: b.f * 0.42, to: b.f * 0.3, dur: 0.05, gain: b.g * 0.5, delay: b.d });
      });
      // the mech accepting it
      tone({ type: 'square', from: 988,  dur: 0.08, gain: 0.20, delay: 0.30 });
      tone({ type: 'square', from: 1319, dur: 0.15, gain: 0.20, delay: 0.38 });
    },

    /* Degauss thump and the tube coming up. */
    powerOn: function () {
      tone({ type: 'sine', from: 70, to: 38, dur: 0.35, gain: 0.30 });
      noise({ dur: 0.45, from: 300, to: 5200, filter: 'highpass', gain: 0.05, delay: 0.06 });
      tone({ type: 'square', from: 220, to: 880, dur: 0.3, gain: 0.07, delay: 0.15 });
    },

    /* ------------------------------ snake ------------------------------ */
    eat:  function () { tone({ type: 'square', from: 700, to: 1250, dur: 0.075, gain: 0.24 }); },
    turn: function () { tone({ type: 'square', from: 380, dur: 0.022, gain: 0.05 }); },

    /* --------------------------- minesweeper --------------------------- */
    /* PC speaker: bare square waves, no filtering, nothing clever. */
    tick:  function () { tone({ type: 'square', from: 1100, dur: 0.02,  gain: 0.10 }); },
    sweep: function () { tone({ type: 'square', from: 700,  dur: 0.045, gain: 0.11 });
                         tone({ type: 'square', from: 1050, dur: 0.05,  gain: 0.11, delay: 0.045 }); },
    flag:  function () { tone({ type: 'square', from: 1500, dur: 0.03,  gain: 0.13 }); },

    /* ---------------------------- asteroids ---------------------------- */
    fire: function () { tone({ type: 'square', from: 1400, to: 180, dur: 0.09, gain: 0.16 }); },
    thrust: function () { noise({ dur: 0.1, from: 380, to: 240, filter: 'lowpass', gain: 0.09 }); },
    rock: function (size) {
      var top = size === 3 ? 1000 : size === 2 ? 1500 : 2200;
      noise({ dur: size === 3 ? 0.42 : size === 2 ? 0.3 : 0.22, from: top, to: 70,
              filter: 'lowpass', gain: 0.3 });
    },

    /* ----------------------------- endings ----------------------------- */
    die: function () {
      noise({ dur: 0.6, from: 1900, to: 55, filter: 'lowpass', gain: 0.34 });
      tone({ type: 'sawtooth', from: 300, to: 35, dur: 0.65, gain: 0.2 });
    },
    boom: function () {
      noise({ dur: 0.75, from: 2800, to: 45, filter: 'lowpass', gain: 0.4 });
      tone({ type: 'sawtooth', from: 170, to: 28, dur: 0.8, gain: 0.22 });
    },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ type: 'square', from: f, dur: 0.15, gain: 0.2, delay: i * 0.1 });
      });
    },
    submit: function () {
      tone({ type: 'square', from: 784,  dur: 0.08, gain: 0.2 });
      tone({ type: 'square', from: 1047, dur: 0.13, gain: 0.2, delay: 0.08 });
    },
    extraLife: function () {
      [1047, 1319, 1568].forEach(function (f, i) {
        tone({ type: 'square', from: f, dur: 0.1, gain: 0.18, delay: i * 0.07 });
      });
    },

    /* -------------------------------- ui ------------------------------- */
    dial: function () {
      noise({ dur: 0.045, from: 3000, to: 1000, filter: 'bandpass', q: 9, gain: 0.20 });
      tone({ type: 'square', from: 200, dur: 0.035, gain: 0.10, delay: 0.012 });
    }
  };

  /* ------------------------- the Asteroids heartbeat -------------------
     Two alternating low thumps. The original sped the tempo up as the wave
     emptied and reset it on the next wave; setRate(0..1) is "how far
     through the wave are we", 0 slow, 1 frantic.
     -------------------------------------------------------------------- */
  var beat = { timer: null, hi: false, interval: 1000 };

  S.heartbeat = {
    start: function () {
      S.heartbeat.stop();
      beat.hi = false;
      tickBeat();
    },
    stop: function () {
      if (beat.timer) { clearTimeout(beat.timer); beat.timer = null; }
    },
    /** progress 0..1 through the current wave */
    setRate: function (progress) {
      var p = Math.max(0, Math.min(1, progress));
      beat.interval = 1000 - p * 640;      // 1000ms down to 360ms
    }
  };

  function tickBeat() {
    if (!muted) {
      // Two pitches, alternating - the classic "thump, thump"
      tone({ type: 'triangle', from: beat.hi ? 108 : 86, to: beat.hi ? 88 : 70,
             dur: 0.13, gain: 0.30 });
    }
    beat.hi = !beat.hi;
    beat.timer = setTimeout(tickBeat, beat.interval);
  }

  /* ------------------------------- mute -------------------------------- */

  S.isMuted = function () { return muted; };
  S.setMuted = function (v) {
    muted = !!v;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.value = muted ? 0 : 0.3;
  };
  S.toggle = function () { S.setMuted(!muted); return muted; };
  /** Called from the coin click, so the context unlocks on a real gesture. */
  S.unlock = function () { ac(); };

  return S;
})();
