/* A result card is prepared before a click, keeping native share inside its
   user gesture. Links always target production and never copy owner tokens. */
'use strict';
(function () {
  var NAMES = { snake: 'SNAKE', minesweeper: 'MINESWEEPER', asteroids: 'ASTEROIDS' };
  function challengeUrl(game) {
    return 'https://www.patrickneyland.com/arcade?game=' +
      (Object.prototype.hasOwnProperty.call(NAMES, game) ? game : 'snake');
  }
  function normalise(data) {
    var game = Object.prototype.hasOwnProperty.call(NAMES, data.game) ? data.game : 'snake';
    return {
      game: game, name: NAMES[game], display: String(data.display || '0').slice(0, 24),
      benchmark: data.benchmark && data.benchmark.display != null
        ? String(data.benchmark.display).slice(0, 24) : null,
      beatPat: !!data.beatPat && !!data.benchmark,
      url: challengeUrl(game)
    };
  }
  function makeCard(data) {
    var c = document.createElement('canvas');
    c.width = 1200; c.height = 630;
    var ctx = c.getContext('2d');
    if (!ctx) return Promise.reject(new Error('Card unavailable'));
    ctx.fillStyle = '#0e0e0e'; ctx.fillRect(0, 0, 1200, 630);
    ctx.strokeStyle = '#343434'; ctx.lineWidth = 2; ctx.strokeRect(26, 26, 1148, 578);
    ctx.fillStyle = '#38d7e8'; ctx.fillRect(62, 62, 8, 36);
    ctx.font = '24px "Press Start 2P", monospace'; ctx.fillText(data.name, 90, 91);
    ctx.fillStyle = '#999'; ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillText(data.game === 'minesweeper' ? 'TIME' : 'SCORE', 64, 177);
    ctx.fillStyle = '#ffe93d';
    var size = 88;
    do { ctx.font = size + 'px "Press Start 2P", monospace'; size -= 2; }
    while (ctx.measureText(data.display).width > 1060 && size > 24);
    ctx.fillText(data.display, 60, 296);
    if (data.benchmark) {
      ctx.fillStyle = '#ff69c7'; ctx.font = '18px "Press Start 2P", monospace';
      ctx.fillText("PAT'S BEST  " + data.benchmark, 64, 369);
    }
    if (data.beatPat) {
      ctx.fillStyle = '#ffe93d'; ctx.font = '24px "Press Start 2P", monospace';
      ctx.fillText("PAT'S SCORE BEATEN", 64, 446);
    }
    ctx.fillStyle = '#38d7e8'; ctx.fillRect(64, 494, 1072, 2);
    ctx.fillStyle = '#ddd'; ctx.font = '22px "JetBrains Mono", monospace';
    ctx.fillText(data.url.replace('https://www.', ''), 64, 550);
    return new Promise(function (resolve, reject) {
      c.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('Card unavailable'));
      }, 'image/png');
    });
  }
  function prepare(data) {
    var safe = normalise(data);
    var fonts = document.fonts ? Promise.all([
      document.fonts.load('24px "Press Start 2P"'),
      document.fonts.load('22px "JetBrains Mono"')
    ]).catch(function () {}) : Promise.resolve();
    // Slow external fonts must not block the share controls indefinitely.
    return Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1800); })])
      .then(function () { return makeCard(safe); });
  }
  function mount(container, data) {
    var safe = normalise(data), disposed = false, blob = null, objectUrl = null;
    container.replaceChildren();
    container.classList.add('result-share');
    var share = document.createElement('button');
    share.type = 'button'; share.className = 'result-share-btn'; share.textContent = 'SHARE RESULT';
    var copy = document.createElement('button');
    copy.type = 'button'; copy.className = 'result-share-btn'; copy.textContent = 'COPY CHALLENGE LINK';
    var save = document.createElement('a');
    save.className = 'result-share-download'; save.textContent = 'SAVE RESULT IMAGE'; save.hidden = true;
    var msg = document.createElement('span');
    msg.className = 'result-share-message'; msg.setAttribute('role', 'status');
    var manual = document.createElement('input');
    manual.className = 'result-share-link'; manual.type = 'text'; manual.readOnly = true;
    manual.setAttribute('aria-label', 'Challenge link'); manual.value = safe.url; manual.hidden = true;
    container.append(share, copy, save, msg, manual);
    prepare(data).then(function (result) {
      if (disposed) return;
      blob = result; objectUrl = URL.createObjectURL(blob);
      save.href = objectUrl; save.download = 'arcade-' + safe.game + '-result.png'; save.hidden = false;
    }).catch(function () { /* Native text/link sharing still works. */ });
    function manualCopy() {
      if (disposed) return;
      manual.hidden = false; manual.focus(); manual.select();
      msg.textContent = 'SELECT AND COPY THE LINK';
    }
    function copyLink() {
      if (!navigator.clipboard || !navigator.clipboard.writeText) { manualCopy(); return; }
      navigator.clipboard.writeText(safe.url).then(function () {
        if (!disposed) msg.textContent = 'LINK COPIED';
      }).catch(manualCopy);
    }
    copy.addEventListener('click', copyLink);
    share.addEventListener('click', function () {
      if (!navigator.share) { copyLink(); return; }
      var payload = {
        title: safe.name + ' - Arcade',
        text: safe.name + ': ' + safe.display +
          (safe.benchmark ? ". Pat's best: " + safe.benchmark + '.' : '.'),
        url: safe.url
      };
      if (blob && typeof File !== 'undefined' && navigator.canShare) {
        var file = new File([blob], 'arcade-' + safe.game + '-result.png', { type: 'image/png' });
        try { if (navigator.canShare({ files: [file] })) payload.files = [file]; } catch (e) { /* link only */ }
      }
      share.disabled = true;
      // No awaited work before share: iOS requires the originating gesture.
      try {
        Promise.resolve(navigator.share(payload)).catch(function (err) {
          if (!disposed && (!err || err.name !== 'AbortError')) {
            msg.textContent = 'SHARING UNAVAILABLE. COPY THE LINK OR SAVE THE IMAGE.';
          }
        }).finally(function () { if (!disposed) share.disabled = false; });
      } catch (e) {
        share.disabled = false; msg.textContent = 'SHARING UNAVAILABLE. COPY THE LINK OR SAVE THE IMAGE.';
      }
    });
    return function () {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      container.replaceChildren();
    };
  }
  window.ArcadeShare = { challengeUrl: challengeUrl, prepare: prepare, mount: mount };
})();
