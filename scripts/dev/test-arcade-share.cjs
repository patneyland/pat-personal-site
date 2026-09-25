const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const labels = [], revoked = [];
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.classList = { add() {} }; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute() {}
  addEventListener(event, fn) { this.listeners[event] = fn; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  click() { this.listeners.click(); }
}
const document = {
  fonts: { load: () => Promise.resolve() },
  createElement(tag) {
    const el = new Element(tag);
    if (tag === 'canvas') {
      el.getContext = () => ({ fillRect() {}, strokeRect() {}, fillText: text => labels.push(text), measureText: text => ({width: text.length*20}) });
      el.toBlob = cb => cb(new Blob(['test'], {type:'image/png'}));
    }
    return el;
  }
};
const navigator = {};
const context = { window: {}, document, navigator, Blob, File, Promise, setTimeout: fn => setImmediate(fn), URL: {
  createObjectURL: () => 'blob:review-card', revokeObjectURL: url => revoked.push(url)
}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../public/arcade/share.js'), 'utf8'), context);
const api = context.window.ArcadeShare;
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  assert.equal(api.challengeUrl('asteroids'), 'https://www.patrickneyland.com/arcade?game=asteroids');
  assert.equal(api.challengeUrl('snake&owner=secret'), 'https://www.patrickneyland.com/arcade?game=snake');
  assert.equal(api.challengeUrl('__proto__'), 'https://www.patrickneyland.com/arcade?game=snake');
  const data = {game:'minesweeper', display:'0:41.2', benchmark:{value:60000,display:'1:00.0'}, beatPat:true};
  const container = new Element('div');
  const dispose = api.mount(container, data);
  await settle(); await settle();
  assert(labels.includes('TIME')); assert(labels.includes("PAT'S SCORE BEATEN"));
  assert(labels.includes("PAT'S BEST  1:00.0"));
  const [share, copy, save, msg, manual] = container.children;
  assert.equal(save.hidden, false); assert.equal(save.download,'arcade-minesweeper-result.png');
  share.click(); assert.equal(manual.selected,true); // no Web Share or clipboard
  let copied = '';
  navigator.clipboard = {writeText: async value => { copied = value; }};
  copy.click(); await settle();
  assert.equal(copied, api.challengeUrl('minesweeper')); assert.equal(msg.textContent,'LINK COPIED');
  let payload;
  navigator.canShare = () => true;
  navigator.share = async value => { payload=value; };
  share.click(); await settle();
  assert.equal(payload.files[0].type,'image/png'); assert.equal(payload.url,api.challengeUrl('minesweeper'));
  assert.equal(share.disabled,false);
  copied = ''; msg.textContent = '';
  navigator.share = async () => { throw Object.assign(new Error('cancelled'),{name:'AbortError'}); };
  share.click(); await settle();
  assert.equal(copied,''); assert.equal(msg.textContent,'');
  navigator.share = () => { throw new Error('blocked'); };
  share.click(); assert.equal(share.disabled,false); assert.match(msg.textContent,/UNAVAILABLE/);
  dispose(); assert.deepEqual(revoked,['blob:review-card']); assert.equal(container.children.length,0);
  labels.length=0;
  await api.prepare({game:'snake',display:10,beatPat:true,benchmark:null});
  assert(!labels.includes("PAT'S SCORE BEATEN"));
  console.log('PASS result card, secret-free canonical links, share files, cancellation, fallback, disposal and unavailable benchmark');
})().catch(err => {console.error(err); process.exitCode=1;});
