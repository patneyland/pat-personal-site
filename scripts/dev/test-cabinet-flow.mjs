import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Cabinet integration without network or a browser. Games and services expose
// their real boundary contracts; all result/UI handlers are the shipped code.
const source = readFileSync(new URL('../../public/arcade/cabinet.js', import.meta.url), 'utf8');
const phoneSource = readFileSync(new URL('../../public/arcade/mobile.js', import.meta.url), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture(search = '?game=snake', deferBoards = false, options = {}) {
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.observers = [];
      this.dataset = new Proxy({}, { set: (target, key, value) => {
        const attr = 'data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
        target[key] = value; this.attrs[attr] = String(value); this.notify(attr); return true;
      } });
      this.style = {}; this.handlers = {}; this.hidden = false; this.disabled = false;
      this.value = ''; this._text = ''; this.clientHeight = 1000; this.scrollHeight = 0;
      this.classList = {
        contains: x => this.className.split(/\s+/).includes(x),
        add: (...xs) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...xs])].join(' '); },
        remove: (...xs) => { this.className = this.className.split(/\s+/).filter(x => !xs.includes(x)).join(' '); },
        toggle: (x, on) => (on ? this.classList.add : this.classList.remove)(x)
      };
    }
    get className() { return this.attrs.class || ''; }
    set className(value) { this.attrs.class = value; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set innerHTML(html) {
      this.children = []; this._text = ''; const stack = [this];
      for (const match of html.matchAll(/<(\/?)([\w-]+)([^>]*)>/g)) {
        const [, close, tag, attrs] = match;
        if (close) { if (stack.length > 1) stack.pop(); continue; }
        const el = new Element(tag);
        for (const attr of attrs.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) el.setAttribute(attr[1], attr[2] ?? '');
        stack.at(-1).appendChild(el);
        if (!['input', 'br', 'img', 'hr', 'meta', 'link'].includes(tag) && !attrs.endsWith('/')) stack.push(el);
      }
    }
    setAttribute(k, value) {
      this.attrs[k] = String(value);
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
      if (k === 'hidden') this.hidden = true;
      this.notify(k);
    }
    notify(key) { for (const o of this.observers) if (!o.keys || o.keys.includes(key)) queueMicrotask(o.callback); }
    getAttribute(k) { if (k === 'hidden') return this.hidden ? '' : null; if (k === 'disabled') return this.disabled ? '' : null; return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    appendChild(el) { el.remove(); this.children.push(el); el.parent = this; return el; }
    append(...els) { els.forEach(el => this.appendChild(el)); }
    insertBefore(el, before) { el.remove(); const at = this.children.indexOf(before); this.children.splice(at < 0 ? this.children.length : at, 0, el); el.parent = this; }
    replaceChildren(...els) { this.children = []; this._text = ''; els.forEach(el => this.appendChild(el)); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    matches(selector) {
      return selector.split(',').some(s => {
        s = s.trim();
        const exclusions = [...s.matchAll(/:not\(([^)]+)\)/g)];
        if (exclusions.some(([, excluded]) => this.matches(excluded))) return false;
        s = s.replace(/:not\([^)]+\)/g, '');
        if (s.includes(' ')) { const at = s.lastIndexOf(' '); return this.matches(s.slice(at + 1)) && !!this.parent?.closest(s.slice(0, at)); }
        const attrs = [...s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
        if (!attrs.every(([, k, v]) => v === undefined ? this.getAttribute(k) !== null : this.getAttribute(k) === v)) return false;
        s = s.replace(/\[[^\]]+\]/g, '');
        const cls = [...s.matchAll(/\.([\w-]+)/g)];
        if (!cls.every(([, c]) => this.classList.contains(c))) return false;
        const tag = s.match(/^[\w-]+/);
        return !tag || this.tagName === tag[0].toUpperCase();
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
    contains(el) { return el === this || this.children.some(c => c.contains(el)); }
    querySelectorAll(s) { return this.children.flatMap(c => [...(c.matches(s) ? [c] : []), ...c.querySelectorAll(s)]); }
    querySelector(s) { return this.querySelectorAll(s)[0] || null; }
    get offsetParent() { for (let el = this; el; el = el.parent) if (el.hidden) return null; return this.parent; }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    focus() { document.activeElement = this; }
    blur() { if (document.activeElement === this) document.activeElement = null; }
    click() { this.emit('click', { detail: 0 }); }
    emit(type, data = {}) {
      const e = { type, target: this, detail: 1, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; },
        stopImmediatePropagation() { this.stopped = true; }, ...data };
      for (const fn of this.handlers[type] || []) { fn(e); if (e.stopped) break; }
      return e;
    }
  }
  document = new Element('document'); document.documentElement = new Element('html');
  document.appendChild(document.documentElement);
  document.body = new Element('body'); document.documentElement.appendChild(document.body);
  document.body.innerHTML = '<div class="wrap"><div class="picture"></div><button class="dial"></button>' +
    '<div class="dial-ticks"><span data-slot="snake"></span><span data-slot="minesweeper"></span><span data-slot="asteroids"></span></div>' +
    '<div class="rail">' +
    '<ol class="board"></ol><div class="coin-module"><button class="coin-btn"></button></div>' +
    '<div data-slot-title></div><span data-slot-game></span><div class="champion-initials"></div>' +
    '<div class="champion-score"></div><div class="champion-date"></div><div class="champion-label"></div></div></div>';
  document.createElement = tag => new Element(tag);
  const storage = new Map(options.credited === false ? [] : [['arcade_credited', '1']]);
  const requests = [], boardRequests = [], mounted = {};
  const best = { snake: 310, minesweeper: 40000, asteroids: 1200 };
  let player = '', owner = false, now = 10000;
  const net = {
    isOwnerMode: () => owner, setOwnerSecret: s => { owner = !!s; }, OWNER_NAME: 'pat neyland',
    getSavedPlayer: () => player, savePlayer: name => { player = name; }, cleanPlayerName: s => s.trim(),
    isOffline: () => false, metricCol: id => id === 'minesweeper' ? 'time_ms' : 'score',
    rowValue: (id, row) => String(row[net.metricCol(id)]),
    fetchScores: async () => [],
    fetchOwnerBestStatus: id => {
      if (deferBoards) { const d = deferred(); boardRequests.push({ ...d, id }); return d.promise; }
      return Promise.resolve({ status: 'ready', row: { [net.metricCol(id)]: best[id] } });
    },
    fetchRank: async () => 1,
    submitScore: run => { const d = deferred(); requests.push({ ...d, run }); return d.promise; },
    submitOwnerScore: run => { const d = deferred(); requests.push({ ...d, run, owner: true }); return d.promise; }
  };
  const games = {};
  for (const id of Object.keys(best)) games[id] = {
    id, name: id.toUpperCase(), mode: id === 'minesweeper' ? '10x10' : 'classic',
    mount(host, api) {
      let state = id === 'minesweeper' ? 'ready' : 'idle', beforePause;
      let arrowToggle;
      if (id === 'snake') {
        arrowToggle = new Element('button'); arrowToggle.className = 'snake-pad-toggle';
        arrowToggle.setAttribute('aria-pressed', 'false');
        arrowToggle.addEventListener('click', () => arrowToggle.setAttribute('aria-pressed', String(arrowToggle.getAttribute('aria-pressed') !== 'true')));
        host.appendChild(arrowToggle);
      }
      const instance = {
        api, getState: () => state, destroy() { arrowToggle?.remove(); }, resize() {},
        start() { if (!api.canStart()) return; state = id === 'minesweeper' ? 'ready' : 'playing';
          if (id === 'minesweeper') api.runReset?.(); api.setState(state); },
        pause() { if (state !== 'playing' && state !== 'ready') return; beforePause = state; state = 'paused'; api.setState('paused'); },
        resume() { if (state !== 'paused') return; state = beforePause; api.setState(state); },
        reveal() { if (!api.canStart()) return; state = 'playing'; api.runStarted?.(); api.setState('playing'); },
        finish(result) { state = 'over'; api.gameOver(result); }
      };
      mounted[id] = instance;
      if (id === 'minesweeper') { api.runReset?.(); api.setState('ready'); } else api.setState('idle');
      return instance;
    }
  };
  const window = new Element('window'); window.location = new URL('https://www.patrickneyland.com/arcade' + search);
  window.matchMedia = () => ({ matches: !!options.phone });
  window.history = { replaceState(a, b, href) { window.location = new URL(href, window.location); } };
  window.ArcadeNet = net; window.ArcadeGames = games;
  window.ArcadeSound = new Proxy({}, { get: () => () => false });
  const context = { window, document, URL, console, Set, Promise, Number, Math,
    Date: class extends Date { static now() { return ++now; } },
    sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    getComputedStyle: () => ({ getPropertyValue: () => '' }), setTimeout: () => 1, clearTimeout() {},
    MutationObserver: class { constructor(callback) { this.callback = callback; }
      observe(el, opts) { el.observers.push({ callback: this.callback, keys: opts.attributeFilter }); } }
  };
  const runtime = vm.createContext(context);
  if (options.phone) vm.runInContext(phoneSource, runtime);
  vm.runInContext(source, runtime);
  const find = s => { const el = document.querySelector(s); assert(el, `Missing ${s}`); return el; };
  return { window, document, find, mounted, requests, boardRequests, best, storage,
    score(value, id = window.ArcadeCabinet.currentGame()) { mounted[id].finish({ score: value, display: String(value) }); },
    submit() { find('.ov-save').emit('click'); find('.ov-input').value = 'tester'; find('.ov-form').emit('submit'); },
    retry() { find('.ov-again').emit('click'); }
  };
}

{
  const h = fixture('?game=asteroids&phone=1&owner=off&utm_source=linkedin#play'); await flush();
  assert.equal(h.window.ArcadeCabinet.currentGame(), 'asteroids');
  assert.equal(h.window.location.searchParams.has('owner'), false);
  assert.equal(h.window.location.searchParams.get('phone'), '1');
  assert.equal(h.window.location.searchParams.get('utm_source'), 'linkedin');
  assert.equal(h.window.location.hash, '#play');
  assert.equal(h.document.querySelector('.practice-btn'), null, 'there is only one game mode');
  h.mounted.asteroids.start();
  h.mounted.asteroids.finish({ score: 900, display: '900' });
  assert.equal(h.find('.ov-save').hidden, false, 'ordinary Asteroids results may be saved');
  assert.equal(h.find('.ov-form').hidden, true, 'name entry is opt-in');
  assert.equal(h.document.querySelector('.ov-share'), null, 'result sharing is absent');
  assert.equal(h.requests.length, 0, 'game over never submits automatically');
  h.retry();
  assert.equal(h.requests.length, 0, 'players can replay without submitting');
  h.mounted.asteroids.finish({ score: 800, display: '800' });
  h.submit();
  assert.equal(h.requests.length, 1, 'players can choose to submit their score');
  assert.equal(h.document.querySelector('.unsaved-btn'), null, 'no save-previous-score button');
}

{
  const h = fixture(); await flush(); h.mounted.snake.start(); h.score(50); h.submit();
  assert.equal(h.requests.length, 1);
  h.find('.ov-form').emit('submit'); assert.equal(h.requests.length, 1, 'duplicate submit is locked');
  h.retry();
  h.best.snake = 400;
  h.requests[0].resolve({}); await flush();
  assert.equal(h.find('.screen-ui').dataset.state, 'playing', 'old response cannot interrupt a new run');
  assert.equal(h.find('.ov-msg').textContent, 'SENDING...', 'old response does not repaint hidden/new result state');
  assert.equal(h.document.querySelector('.challenge-target'), null, 'owner high score is only displayed in the scoreboard');
  h.score(350);
  assert.equal(h.find('.ov-comparison').textContent, 'YOU BEAT PAT!', 'result uses starting target without repeating its value');
}

{
  const h = fixture(); await flush(); h.mounted.snake.start(); h.score(50);
  h.submit();
  assert.equal(h.find('.ov-btn').disabled, true, 'sending result stays locked');
  h.requests[0].reject(new Error('offline')); await flush();
  assert.equal(h.find('.ov-btn').disabled, false, 'failed request unlocks the result');
  assert.match(h.find('.ov-msg').textContent, /OFFLINE/);
  h.find('.ov-form').emit('submit'); h.requests[1].resolve({}); await flush();
  assert.equal(h.find('.ov-save').hidden, true, 'success updates the result');
  assert.equal(h.find('.ov-form').hidden, true);
  assert.match(h.find('.ov-msg').textContent, /ON THE BOARD/);
}

{
  const h = fixture('?game=snake', true);
  h.window.ArcadeCabinet.selectGame('asteroids');
  h.window.ArcadeCabinet.selectGame('snake');
  h.boardRequests[2].resolve({ status: 'ready', row: { score: 310 } }); await flush();
  h.boardRequests[0].resolve({ status: 'ready', row: { score: 50 } });
  h.boardRequests[1].resolve({ status: 'ready', row: { score: 1200 } }); await flush();
  h.mounted.snake.start(); h.score(350);
  assert.equal(h.find('.ov-comparison').textContent, 'YOU BEAT PAT!', 'late prior board reads cannot overwrite the selected game');
}

{
  const h = fixture('?game=minesweeper'); await flush();
  h.window.ArcadeCabinet.selectGame('asteroids');
  assert.equal(h.window.ArcadeCabinet.currentGame(), 'asteroids', 'untouched Mines board does not trap game selection');
  h.window.ArcadeCabinet.selectGame('minesweeper'); await flush();
  h.mounted.minesweeper.reveal();
  h.window.ArcadeCabinet.selectGame('asteroids');
  assert.equal(h.window.ArcadeCabinet.currentGame(), 'minesweeper', 'timed run locks selection');
  h.mounted.minesweeper.finish({ time_ms: 30000, display: '30000' });
  assert.equal(h.find('.ov-comparison').textContent, 'YOU BEAT PAT!', 'Minesweeper compares against its loaded benchmark');
}

{
  const h = fixture('?game=snake&phone=1', false, { phone: true, credited: false }); await flush();
  assert.equal(h.storage.has('arcade_credited'), false, 'fresh phone has no saved coin credit');
  assert.equal(h.mounted.snake.api.canStart(), true, 'phone games require no coin');
  h.mounted.snake.start();
  assert.equal(h.find('.screen-ui').dataset.state, 'playing');
  assert.equal(h.document.querySelector('.ph-gate'), null, 'phone shell has no coin gate');
  assert(h.find('.coin-module').hidden && h.find('.coin-module').inert, 'coin is not reachable on phone');
  h.find('.ph-board').emit('click'); await flush();
  assert.equal(h.find('.screen-ui').dataset.state, 'paused', 'opening scoreboard pauses action game');
  assert.equal(h.find('.ph-sheet').hidden, false);
  assert(h.find('.wrap').inert && h.find('.ph-hud').inert, 'game is inaccessible behind sheet');
  assert.equal(h.find('[data-game-choice="asteroids"]').disabled, false, 'sheet permits changing paused game');
  assert.equal(h.find('.ph-sheet').emit('keydown', { key: 'r' }).propagationStopped, true, 'sheet keyboard input never bubbles to games');
  const sheetControls = h.find('.ph-sheet').querySelectorAll('button:not([disabled]),a[href],input:not([disabled])').filter(el => el.offsetParent !== null);
  sheetControls.at(-1).focus();
  assert.equal(h.find('.ph-sheet').emit('keydown', { key: 'Tab' }).defaultPrevented, true);
  assert.equal(h.document.activeElement, sheetControls[0], 'Tab wraps inside open sheet');
  h.find('.ph-sheet').emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(h.document.activeElement, sheetControls.at(-1), 'reverse Tab wraps inside sheet');
  h.find('.ph-arrows').emit('click');
  assert.equal(h.find('.snake-pad-toggle').getAttribute('aria-pressed'), 'true', 'settings forwards arrow preference to actual game control');
  assert.equal(h.find('.ph-arrows').getAttribute('aria-pressed'), 'true');
  h.find('.ph-close').emit('click'); await flush();
  assert.equal(h.find('.screen-ui').dataset.state, 'playing', 'explicit Back to game resumes');
  assert(!h.find('.wrap').inert && !h.find('.ph-hud').inert);
  h.window.emit('blur'); h.window.emit('focus');
  assert.equal(h.find('.screen-ui').dataset.state, 'paused', 'returning to app does not resume');
  h.find('.ph-board').emit('click');
  h.find('.ph-sheet').emit('keydown', { key: 'Escape' });
  assert.equal(h.find('.screen-ui').dataset.state, 'playing', 'explicit sheet Escape resumes existing pause');
  h.find('.ph-board').emit('click');
  h.document.emit('click', { target: h.find('[data-game-choice="asteroids"]') }); await flush();
  assert.equal(h.window.ArcadeCabinet.currentGame(), 'asteroids');
  assert.equal(h.find('.screen-ui').dataset.state, 'idle');
  assert.equal(h.find('.ph-arrows').hidden, true, 'Snake-only setting hides after game change');
  h.find('.ph-close').emit('click');
  assert.equal(h.find('.screen-ui').dataset.state, 'idle', 'switching game does not auto-start replacement');
  h.mounted.asteroids.start(); await flush();
  assert.equal(h.find('.screen-ui').dataset.state, 'playing');
  h.find('.ph-board').emit('click'); h.find('.pause-btn').emit('click');
  assert.equal(h.find('.ph-sheet').hidden, true, 'Resume button closes settings');
  assert.equal(h.find('.screen-ui').dataset.state, 'playing');
  assert.equal(h.storage.has('arcade_credited'), false, 'phone play never persists desktop credit');
}

{
  const h = fixture('?game=minesweeper&phone=1', false, { phone: true, credited: false }); await flush();
  h.find('.ph-board').emit('click'); h.find('.ph-close').emit('click');
  assert.equal(h.find('.screen-ui').dataset.state, 'ready', 'opening settings does not start Minesweeper timer');
  h.mounted.minesweeper.reveal(); h.find('.ph-board').emit('click');
  assert.equal(h.find('.screen-ui').dataset.state, 'paused');
  h.find('.ph-close').emit('click');
  assert.equal(h.find('.screen-ui').dataset.state, 'playing');
}

{
  const h = fixture('?game=snake&phone=0', false, { credited: false }); await flush();
  assert.equal(h.mounted.snake.api.canStart(), false, 'desktop still requires coin credit');
  h.mounted.snake.start();
  assert.equal(h.find('.screen-ui').dataset.state, 'idle');
}

{
  const h = fixture(); await flush(); h.mounted.snake.start();
  h.mounted.snake.finish({ score: 900, display: '900', player: 'JEV', practice: true });
  assert.equal(h.find('.ov-save').hidden, true, 'separate decision-paced Jev runs remain ineligible');
}

console.log('Cabinet/phone checks passed: optional submission, submission recovery, frozen benchmarks, URL preservation, credit rules, settings pause/resume/switch, keyboard isolation and focus trapping.');
