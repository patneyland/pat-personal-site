import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the real event handlers and animation loop with a deterministic
// clock. The only injected seam exposes state for assertions, never shipping.
const source = readFileSync(new URL('../../public/arcade/asteroids.js', import.meta.url), 'utf8');
const instrumented = source.replace('start: start,', `
  test: { read: () => ({ ship, bullets, keys, lives, score, W, H }),
    loseLife, spawnSaucer, safe: () => { invuln = 10000; saucerTimer = 10000;
      rocks = [{ x: 0, y: 0, vx: 0, vy: 0, a: 0, spin: 0, r: 0, size: 3, pts: [] }]; } },
  start: start,`);
assert.notEqual(instrumented, source);

function harness(coarse = true) {
  const nodes = [];
  const noop = () => {};
  class Node {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.listeners = {}; this.children = [];
      this.style = {}; this.attributes = {}; this.classes = new Set(); this.captures = new Set();
      this.classList = { add: v => this.classes.add(v), remove: v => this.classes.delete(v),
        toggle: (v, on) => on ? this.classes.add(v) : this.classes.delete(v) };
      nodes.push(this);
    }
    appendChild(node) { this.children.push(node); node.parent = this; }
    setAttribute(k, v) { this.attributes[k] = v; }
    closest() { return ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(this.tagName) ? this : null; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.className === 'ast-joystick' ? 108 : 300,
        height: this.className === 'ast-joystick' ? 108 : 200 };
    }
    getContext() { return new Proxy({}, { get: () => noop }); }
    addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); }
    removeEventListener(k, fn) { this.listeners[k] = (this.listeners[k] || []).filter(f => f !== fn); }
    remove() {}
    send(type, fields = {}) {
      const e = { type, target: this, pointerId: 1, button: 0, detail: 1, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...fields };
      for (const handler of this.listeners[type] || []) handler(e);
      return e;
    }
  }
  const document = new Node('document');
  document.createElement = tag => new Node(tag);
  let now = 0, nextFrame, heartbeat = false, saucerSound = false, shots = 0;
  const sound = { heartbeat: { start() { heartbeat = true; }, stop() { heartbeat = false; }, setRate: noop },
    saucer: { start() { saucerSound = true; }, stop() { saucerSound = false; } },
    fire() { shots++; }, die: noop, thrust: noop, hyperspace: noop, rock: noop, extraLife: noop, saucerFire: noop };
  const window = { ArcadeSound: sound, ArcadeNet: { formatScore: String },
    matchMedia: () => ({ matches: coarse }), devicePixelRatio: 1 };
  const context = vm.createContext({ window, document, performance: { now: () => now },
    requestAnimationFrame(fn) { nextFrame = fn; return 1; }, cancelAnimationFrame() { nextFrame = null; },
    Math, Map });
  vm.runInContext(instrumented, context);
  const results = [], statuses = [], states = [];
  const api = { canStart: () => true, setStatus: v => statuses.push(v), setState: v => states.push(v),
    gameOver: v => results.push(v), palette: () => ({}) };
  const game = window.ArcadeGames.asteroids.mount(new Node('div'), api);
  const step = ms => { now += ms; nextFrame(now); };
  return { game, step, document, results, statuses, states, Node,
    find: cls => nodes.find(n => (n.className || '').split(' ').includes(cls)),
    sound: () => ({ heartbeat, saucerSound, shots }) };
}

{
  const h = harness();
  h.game.start(); h.game.test.safe();
  const stick = h.find('ast-joystick'), knob = h.find('ast-joystick-knob'), fire = h.find('ast-key-fire');
  stick.send('pointerdown', { clientX: 54, clientY: 54 });
  assert.equal(h.game.test.read().keys.left, false, 'resting thumb is neutral');
  assert.equal(h.game.test.read().keys.thrust, false);
  assert(stick.captures.has(1), 'joystick captures the steering pointer');
  stick.send('pointermove', { clientX: 57, clientY: 51 });
  assert.equal(h.game.test.read().keys.thrust, false, 'small movements stay inside dead zone');
  stick.send('pointermove', { clientX: 25, clientY: 25 });
  assert.equal(h.game.test.read().keys.left, true);
  assert.equal(h.game.test.read().keys.thrust, true);
  const heldTransform = knob.style.transform;
  stick.send('pointerdown', { pointerId: 2, clientX: 90, clientY: 54 });
  stick.send('pointermove', { pointerId: 2, clientX: 90, clientY: 54 });
  stick.send('pointerup', { pointerId: 2 });
  assert.equal(knob.style.transform, heldTransform, 'second touch cannot steal or release joystick');
  const before = h.game.test.read().ship.a;
  fire.send('pointerdown', { pointerId: 2 });
  h.step(100);
  assert.ok(h.game.test.read().ship.a < before, 'diagonal control turns while thrusting');
  assert.ok(Math.hypot(h.game.test.read().ship.vx, h.game.test.read().ship.vy) > 0);
  assert.equal(h.sound().shots, 1, 'second thumb fires while steering');
  h.step(100);
  assert.equal(h.sound().shots, 1, 'holding Fire never auto-fires');
  for (let id = 3; id < 6; id++) {
    fire.send('pointerup', { pointerId: id - 1 });
    fire.send('pointerdown', { pointerId: id });
    h.step(50); h.step(50);
  }
  assert.equal(h.game.test.read().bullets.length, 4, 'four bullet cap preserved');
  fire.send('pointerup', { pointerId: 5 });
  fire.send('pointerdown', { pointerId: 6 });
  assert.equal(h.sound().shots, 4);
  stick.send('pointermove', { clientX: 90, clientY: 54 });
  assert.equal(h.game.test.read().keys.right, true);
  assert.equal(h.game.test.read().keys.thrust, false);
  stick.send('pointermove', { clientX: 400, clientY: 400 });
  assert.equal(h.game.test.read().keys.right, true, 'captured drag outside ring keeps its direction');
  assert.equal(h.game.test.read().keys.thrust, false, 'pulling down cannot reverse thrust');
  const displacement = [...knob.style.transform.matchAll(/translate\(([-\d.]+)px, ([-\d.]+)px\)/g)][0];
  assert.ok(Math.hypot(Number(displacement[1]), Number(displacement[2])) <= 108 * 0.28 + 1e-8, 'knob stays within circular travel limit');
  stick.send('pointerup');
  assert.equal(h.game.test.read().keys.right, false);
  assert.equal(knob.style.transform, 'translate(-50%, -50%) translate(0px, 0px)', 'release recenters knob');
  assert.equal(stick.captures.size, 0, 'release drops pointer capture');
  stick.send('pointerdown', { clientX: 25, clientY: 25 });
  stick.send('pointercancel');
  assert.equal(h.game.test.read().keys.thrust, false, 'cancel releases joystick');
  stick.send('pointerdown', { clientX: 25, clientY: 25 });
  stick.send('lostpointercapture');
  assert.equal(h.game.test.read().keys.left, false, 'capture loss cannot leave stuck steering');
  h.document.send('keydown', { key: 'd' });
  stick.send('pointerdown', { clientX: 54, clientY: 10 });
  stick.send('pointerup');
  assert.equal(h.game.test.read().keys.right, true, 'releasing thumb preserves held keyboard direction');
  h.document.send('keyup', { key: 'd' });
  assert.equal(h.game.test.read().keys.right, false);
  h.game.destroy();
}

{
  const h = harness(); h.game.start(); h.game.test.safe();
  h.game.test.spawnSaucer();
  h.document.send('keydown', { key: 'w' });
  const stick = h.find('ast-joystick'), knob = h.find('ast-joystick-knob');
  stick.send('pointerdown', { clientX: 20, clientY: 20 });
  h.step(20);
  h.game.pause();
  assert.equal(stick.captures.size, 0, 'pause releases captured thumb');
  assert.equal(knob.style.transform, 'translate(-50%, -50%) translate(0px, 0px)');
  const ship = { ...h.game.test.read().ship };
  h.step(10000);
  assert.deepEqual({ ...h.game.test.read().ship }, ship, 'pause freezes simulation');
  assert.equal(h.game.getState(), 'paused');
  assert.equal(h.sound().heartbeat, false);
  assert.equal(h.sound().saucerSound, false);
  h.find('ast-key-fire').send('pointerdown', { pointerId: 2 });
  h.document.send('keydown', { key: 'r' });
  assert.equal(h.game.getState(), 'paused', 'game input cannot silently resume');
  h.game.resume(); h.step(20);
  stick.send('pointermove', { clientX: 20, clientY: 20 });
  assert.equal(h.game.test.read().keys.thrust, false, 'old pointer movement cannot steer after resume');
  assert.equal(h.game.test.read().keys.left, false, 'resume clears previously held input');
  assert.equal(h.sound().heartbeat, true);
  assert.equal(h.sound().saucerSound, true);
  assert.equal(h.sound().shots, 0, 'no shots while paused');
  h.game.destroy();
}

{
  const h = harness(); h.game.start(); h.game.test.safe();
  assert.equal(h.game.test.read().lives, 3, 'normal run starts with three ships');
  h.step(31000);
  assert.equal(h.game.getState(), 'playing', 'normal run has no timed cutoff');
  h.game.test.loseLife();
  assert.equal(h.game.getState(), 'playing', 'losing first ship keeps the run alive');
  assert.equal(h.game.test.read().lives, 2);
  h.game.test.loseLife(); h.game.test.loseLife();
  assert.equal(h.game.getState(), 'over');
  assert.deepEqual({ ...h.results[0] }, { score: 0, display: '0' }, 'normal score result has no mode flag');
  h.game.start();
  assert.equal(h.game.test.read().lives, 3, 'restart restores the ranked run');
  const stick = h.find('ast-joystick');
  stick.send('pointerdown', { clientX: 20, clientY: 20 });
  h.game.destroy();
  assert.equal(stick.captures.size, 0, 'destroy releases joystick pointer');
}

{
  const h = harness(false);
  assert.equal(h.game.test.read().W, 800); assert.equal(h.game.test.read().H, 600);
  h.document.send('keydown', { key: ' ', target: new h.Node('button') });
  h.document.send('keydown', { key: ' ', defaultPrevented: true });
  assert.equal(h.game.getState(), 'idle', 'cabinet controls do not start hidden game');
  h.document.send('keydown', { key: 'w' });
  assert.equal(h.game.getState(), 'playing');
  assert.equal(h.game.test.read().keys.thrust, true, 'first keyboard direction survives start');
  h.document.send('keydown', { key: ' ', repeat: false });
  h.step(100);
  h.document.send('keydown', { key: ' ', repeat: true });
  assert.equal(h.sound().shots, 1, 'keyboard autorepeat cannot shoot');
  h.game.destroy();
  assert.equal((h.document.listeners.keydown || []).length, 0);
}

console.log('Asteroids joystick checks passed: dead zone, simultaneous steer/thrust/fire, clamped knob, capture/cancel/reset, four-bullet cap, pause, three-life runs and keyboard controls.');
