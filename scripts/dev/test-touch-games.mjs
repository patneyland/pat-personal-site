// Real game modules under a small DOM/clock harness, without a browser or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.attributes = {}; this.handlers = {}; this.captures = new Set();
    this.style = { setProperty() {} }; this.clientWidth = 360; this.clientHeight = 500;
    this.className = ''; this.textContent = '';
    this.classList = {
      contains: x => this.className.split(' ').includes(x),
      add: (...xs) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...xs])].join(' '); },
      remove: (...xs) => { this.className = this.className.split(' ').filter(x => !xs.includes(x)).join(' '); },
      toggle: (x, yes) => { (yes ? this.classList.add : this.classList.remove)(x); }
    };
  }
  set innerHTML(value) { this.children = []; this.html = value; }
  appendChild(el) { this.children.push(el); el.parent = this; return el; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(el => el !== this); }
  setAttribute(k, v) { this.attributes[k] = v; }
  addEventListener(k, fn) { (this.handlers[k] ||= []).push(fn); }
  removeEventListener(k, fn) { this.handlers[k] = (this.handlers[k] || []).filter(f => f !== fn); }
  closest(selector) { return this.classList.contains(selector.slice(1)) ? this : this.parent?.closest(selector); }
  contains(el) { return el === this || this.children.some(child => child.contains(el)); }
  getBoundingClientRect() {
    const left = this.dataset.c === undefined ? 0 : Number(this.dataset.c) * 30;
    const top = this.dataset.r === undefined ? 0 : Number(this.dataset.r) * 30;
    return { left, top, right: left + 30, bottom: top + 30, width: 360, height: 500 };
  }
  setPointerCapture(id) { this.captures.add(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => { o[k] = v; return true; } }); }
  blur() {}
  emit(type, data = {}) {
    const event = { target: this, pointerId: 1, pointerType: 'touch', button: 0,
      clientX: 10, clientY: 10, detail: 1, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...data };
    for (const fn of this.handlers[type] || []) fn(event);
    return event;
  }
}
function descendants(el, className) {
  return el.children.flatMap(child => [ ...(child.classList.contains(className) ? [child] : []), ...descendants(child, className) ]);
}
function fixture(game) {
  const document = new Element('document'); document.createElement = tag => new Element(tag);
  const host = new Element(); const sounds = {}; let now = 1000, seq = 0;
  const timeouts = new Map(), intervals = new Map(); const states = []; let status;
  let starts = 0, resets = 0;
  const window = { devicePixelRatio: 1,
    ArcadeSound: new Proxy({}, { get: (_, k) => () => { sounds[k] = (sounds[k] || 0) + 1; } }),
    ArcadeNet: { formatScore: String, formatTime: String }
  };
  const context = { window, document, Set, Math, performance: { now: () => now }, Date: { now: () => now },
    requestAnimationFrame: () => ++seq, cancelAnimationFrame() {},
    setTimeout: fn => { timeouts.set(++seq, fn); return seq; }, clearTimeout: id => timeouts.delete(id),
    setInterval: fn => { intervals.set(++seq, fn); return seq; }, clearInterval: id => intervals.delete(id),
    localStorage: { getItem() { throw Error('Storage blocked'); }, setItem() { throw Error('Storage blocked'); } }
  };
  vm.runInNewContext(fs.readFileSync(new URL(`../../public/arcade/${game}.js`, import.meta.url), 'utf8'), context);
  const api = { canStart: () => true, palette: () => ({}), setState: s => states.push(s), setStatus: s => { status = s; }, gameOver() {},
    runStarted() { starts++; }, runReset() { resets++; } };
  const instance = window.ArcadeGames[game].mount(host, api);
  return { document, host, sounds, states, instance, timeouts, intervals,
    get status() { return status; },
    get starts() { return starts; }, get resets() { return resets; },
    advance(ms) { now += ms; for (const fn of intervals.values()) fn(); },
    hold() { for (const [id, fn] of [...timeouts]) { timeouts.delete(id); fn(); } }
  };
}

const snake = fixture('snake');
const view = descendants(snake.host, 'snake-view')[0];
view.emit('pointerdown', { clientX: 100, clientY: 100 });
assert.equal(snake.instance.getState(), 'playing');
view.emit('pointermove', { clientX: 104, clientY: 60 });
assert.equal(snake.sounds.turn, 1, 'Swipe turns before finger release');
view.emit('pointerup', { clientX: 104, clientY: 40 });
assert.equal(snake.sounds.turn, 1, 'Release does not duplicate the turn');
view.emit('pointerdown', { clientX: 100, clientY: 100 });
view.emit('pointermove', { clientX: 104, clientY: 150 });
assert.equal(snake.sounds.turn, 1, 'Opposite queued turn is rejected');
view.emit('pointercancel');
view.emit('pointerup', { clientX: 50, clientY: 100 });
assert.equal(snake.sounds.turn, 1, 'Cancelled gesture cannot turn');
snake.instance.pause(); snake.instance.pause();
assert.equal(snake.states.filter(s => s === 'paused').length, 1);
view.emit('pointerdown');
assert.equal(snake.instance.getState(), 'paused', 'Touch cannot resume');
snake.instance.resume(); snake.instance.resume();
assert.equal(snake.states.filter(s => s === 'playing').length, 2);
const toggle = descendants(snake.host, 'snake-pad-toggle')[0];
toggle.emit('click');
assert.equal(toggle.attributes['aria-pressed'], 'true', 'Blocked storage still allows pad preference');
descendants(snake.host, 'snake-key-left')[0].emit('pointerdown');
assert.equal(snake.sounds.turn, 2, 'Pad turn joins the same direction queue');
snake.document.emit('keydown', { key: 'ArrowDown', defaultPrevented: true });
assert.equal(snake.sounds.turn, 2, 'Cabinet can capture keyboard events');
snake.instance.destroy();
assert.equal(snake.host.children.length, 0);

const mines = fixture('minesweeper');
const board = descendants(mines.host, 'ms-board')[0];
assert.equal(board.children.length, 100, 'Ranked board stays 10 by 10');
assert.equal(mines.starts, 0, 'Unstarted board does not freeze a benchmark');
assert.equal(mines.resets, 1);
assert.equal(mines.states.at(-1), 'ready', 'Unstarted board leaves game choices available');
mines.instance.pause(); mines.instance.resume();
assert.equal(mines.states.at(-1), 'ready', 'Resume before first reveal returns to ready');
const first = board.children[0], second = board.children[1];
board.emit('pointerdown', { target: first });
assert(first.classList.contains('is-pressed'));
board.emit('pointermove', { target: first, clientX: 40 });
assert(!first.classList.contains('is-pressed'));
mines.hold();
board.emit('pointerup', { target: second, clientX: 40 });
assert(!first.classList.contains('revealed') && !second.classList.contains('revealed'), 'Slide cancels rather than revealing another cell');
assert.equal(first.textContent, '', 'Cancelled hold does not mark');
board.emit('pointerdown', { target: first });
board.emit('pointercancel');
board.emit('pointerup', { target: first });
assert(!first.classList.contains('revealed'));
board.emit('pointerdown', { target: first }); mines.hold();
board.emit('pointerup', { target: first });
assert(first.classList.contains('flagged'), 'Long press flags without revealing');
assert.match(first.attributes['aria-label'], /flagged$/);
assert(!first.classList.contains('revealed'));
board.emit('pointerdown', { target: first }); mines.hold();
board.emit('pointerup', { target: first });
assert(!first.classList.contains('flagged'), 'Second hold lifts flag');
assert.match(first.attributes['aria-label'], /hidden$/);
descendants(mines.host, 'is-question')[0].emit('click');
board.emit('click', { target: first, detail: 0 });
assert.match(first.attributes['aria-label'], /question mark$/);
descendants(mines.host, 'is-reveal')[0].emit('click');
mines.document.emit('keydown', { target: first, key: 'f' });
assert.equal(descendants(mines.host, 'is-flag')[0].attributes['aria-pressed'], 'true', 'Mode shortcuts work while a board cell has focus');
board.emit('pointerdown', { target: second, clientX: 40 });
board.emit('pointerup', { target: second, clientX: 40 });
assert(second.classList.contains('flagged'), 'Explicit flag mode');
descendants(mines.host, 'is-reveal')[0].emit('click');
board.emit('pointerdown', { target: first }); board.emit('pointerup', { target: first });
assert(first.classList.contains('revealed') && !first.classList.contains('mine'), 'First reveal stays safe');
assert.match(first.attributes['aria-label'], /revealed, no adjacent mines$/);
const clue = board.children.find(cell => /n[1-8]/.test(cell.className));
assert(clue, 'First safe pocket exposes a numbered boundary');
assert.match(clue.attributes['aria-label'], /[1-8] adjacent mines?$/, 'Accessible name includes revealed clue');
assert.equal(mines.starts, 1, 'First real reveal freezes the benchmark once');
assert.equal(mines.states.at(-1), 'playing', 'First reveal locks game choices');
mines.advance(1200); mines.instance.pause();
assert.equal(mines.instance.getState(), 'paused');
assert(board.inert && descendants(mines.host, 'ms-wrap')[0].classList.contains('is-paused'));
mines.advance(3800); mines.instance.resume();
assert.equal(mines.status.value, '5000', 'Paused time remains part of ranked time');
assert.equal(mines.instance.getState(), 'playing');
mines.instance.destroy();
assert.equal(mines.intervals.size, 0); assert.equal(mines.timeouts.size, 0);
assert.equal(mines.host.children.length, 0);
console.log('Touch game checks pass: swipe timing, direction safety, cancellation, pad/storage, pause guards, Minesweeper modes, safe reveal and elapsed time.');
