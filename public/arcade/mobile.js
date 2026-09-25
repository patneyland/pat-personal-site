'use strict';

/* A mobile game surface with one scoreboard button. Settings live in its sheet. */
(function () {
  var root = document.documentElement;
  var forced = /[?&]phone=([01])/.exec(window.location.search);
  var active = forced ? forced[1] === '1' : window.matchMedia('(max-width: 820px), (pointer: coarse) and (max-height: 560px)').matches;
  window.ArcadePhone = { active: active };
  if (!active) return;
  root.setAttribute('data-phone', 'true');
  var rail = document.querySelector('.rail');
  var coin = document.querySelector('.coin-module');
  if (coin) { coin.hidden = true; coin.inert = true; }

  var sheet = document.createElement('div');
  sheet.className = 'ph-sheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'High scores');
  sheet.innerHTML = '<button type="button" class="ph-close" aria-label="Back to game">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>' +
    '<div class="ph-sheet-body"><div class="ph-sheet-controls"></div>' +
    '<div class="ph-sheet-scores"></div><div class="ph-sheet-settings" aria-label="Game settings"></div></div>';
  document.body.appendChild(sheet);
  if (rail) sheet.querySelector('.ph-sheet-scores').appendChild(rail);
  var closeBtn = sheet.querySelector('.ph-close');
  var hud = document.createElement('div');
  hud.className = 'ph-hud';
  hud.innerHTML = '<button type="button" class="ph-btn ph-board" aria-label="High scores and game settings" aria-haspopup="dialog">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="13" width="5" height="8"/><rect x="9.5" y="7" width="5" height="14"/><rect x="16" y="10" width="5" height="11"/></svg></button>';
  document.body.appendChild(hud);
  var boardBtn = hud.querySelector('.ph-board');
  var screen, arrowsBtn, timerNote, returnToRun = false;
  var wrap = document.querySelector('.wrap');

  function syncSettings() {
    if (!screen) return;
    root.setAttribute('data-play', screen.dataset.state || 'idle');
    if (timerNote) {
      var pauseNote = screen.querySelector('.pause-note');
      timerNote.textContent = pauseNote ? pauseNote.textContent : '';
      timerNote.hidden = screen.dataset.state !== 'paused' || !timerNote.textContent;
    }
    if (arrowsBtn) {
      var toggle = screen.querySelector('.snake-pad-toggle');
      arrowsBtn.hidden = !toggle;
      arrowsBtn.setAttribute('aria-pressed', toggle ? toggle.getAttribute('aria-pressed') : 'false');
    }
  }
  function openSheet() {
    if (!screen || !sheet.hidden) return;
    returnToRun = screen.dataset.state === 'playing' || screen.dataset.state === 'paused';
    root.setAttribute('data-sheet', 'open');
    if (window.ArcadeCabinet) {
      window.ArcadeCabinet.pause();
      window.ArcadeCabinet.refreshUI();
    }
    sheet.hidden = false;
    wrap.inert = true;
    hud.inert = true;
    syncSettings();
    closeBtn.focus();
  }
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    root.removeAttribute('data-sheet');
    wrap.inert = false;
    hud.inert = false;
    if (returnToRun && screen.dataset.state === 'paused' && window.ArcadeCabinet) window.ArcadeCabinet.resume();
    returnToRun = false;
    if (window.ArcadeCabinet) window.ArcadeCabinet.refreshUI();
    boardBtn.focus();
  }
  closeBtn.addEventListener('click', closeSheet);
  boardBtn.addEventListener('click', openSheet);
  window.ArcadePhone.closeSheet = closeSheet;
  sheet.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
    if (e.key !== 'Tab') return;
    var controls = Array.from(sheet.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')).filter(function (el) { return el.offsetParent !== null; });
    var first = controls[0], last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.ArcadePhone.attach = function (parts) {
    screen = parts.screen;
    var settings = sheet.querySelector('.ph-sheet-settings');
    sheet.querySelector('.ph-sheet-controls').appendChild(parts.challenge);
    settings.appendChild(parts.pauseBtn);
    parts.pauseBtn.addEventListener('click', function () {
      if (screen.dataset.state !== 'paused') closeSheet();
    });
    var vol = screen.querySelector('.vol-btn');
    if (vol) {
      var label = document.createElement('span'); label.textContent = 'SOUND';
      vol.appendChild(label); settings.appendChild(vol);
    }
    arrowsBtn = document.createElement('button');
    arrowsBtn.type = 'button'; arrowsBtn.className = 'ph-arrows';
    arrowsBtn.textContent = 'ARROW BUTTONS';
    arrowsBtn.addEventListener('click', function () {
      var toggle = screen.querySelector('.snake-pad-toggle');
      if (toggle) toggle.click();
      syncSettings();
    });
    settings.appendChild(arrowsBtn);
    timerNote = document.createElement('p');
    timerNote.className = 'ph-timer-note';
    settings.appendChild(timerNote);
    syncSettings();
    new MutationObserver(syncSettings).observe(screen, { attributes: true, attributeFilter: ['data-state'] });
  };
})();
