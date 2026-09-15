/* Headless harness for Diamond Heroes.

   Loads every script the way index.html does, into a minimal DOM/canvas/audio
   shim, then drives the real game loop. Lives outside the repo on purpose: the
   project must stay npm-free and build-free.

   Usage:  node harness.js <path-to-project> [steps] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.argv[2] || path.resolve(__dirname, '..', '..');
const STEPS = parseInt(process.argv[3] || '600', 10);
const errors = [];
const warnings = [];

/* ---------------------------------------------------------- tiny DOM */

let uid = 0;
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this._id = '';
    this._cls = new Set();
    this.dataset = {};
    this.style = new Proxy({ setProperty() {}, removeProperty() {} }, {
      get: (t, k) => (k in t ? t[k] : ''),
      set: (t, k, v) => { t[k] = v; return true; }
    });
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this._html = '';
    this._listeners = {};
    this.uid = ++uid;
    this.classList = {
      add: (...c) => c.forEach((x) => this._cls.add(x)),
      remove: (...c) => c.forEach((x) => this._cls.delete(x)),
      toggle: (c, on) => { if (on === undefined) { this._cls.has(c) ? this._cls.delete(c) : this._cls.add(c); } else if (on) this._cls.add(c); else this._cls.delete(c); },
      contains: (c) => this._cls.has(c)
    };
  }
  get id() { return this._id; }
  set id(v) { this._id = v; REG.byId[v] = this; }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }

  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = String(v);
    this.children = parseChildren(this._html, this);
  }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = v; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  removeEventListener() {}
  setPointerCapture() {}
  focus() {}
  getBoundingClientRect() { return { x: 0, y: 0, width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540 }; }
  get offsetWidth() { return 100; }
  get naturalWidth() { return this._nw === undefined ? 64 : this._nw; }
  get naturalHeight() { return 64; }

  descendants() {
    const out = [];
    const walk = (e) => e.children.forEach((c) => { out.push(c); walk(c); });
    walk(this);
    return out;
  }
  matches(sel) {
    if (sel.startsWith('#')) return this._id === sel.slice(1);
    if (sel.startsWith('.')) return this._cls.has(sel.slice(1));
    const m = sel.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (m) return m[2] === undefined ? (m[1] in this.attrs || camel(m[1]) in this.dataset)
                                     : (this.attrs[m[1]] === m[2] || this.dataset[camel(m[1])] === m[2]);
    return this.tagName === sel.toUpperCase();
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const last = sel.trim().split(/\s+/).pop();
    return this.descendants().filter((e) => { try { return e.matches(last); } catch (x) { return false; } });
  }
  closest(sel) {
    let n = this;
    while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentNode; }
    return null;
  }
  get canvas() { return this; }
  getContext() { return CTX; }
  cloneNode() { const e = new El(this.tagName); e._cls = new Set(this._cls); return e; }
  play() { return { catch() {} }; }
  pause() {}
}
function camel(s) { return s.replace(/^data-/, '').replace(/-([a-z])/g, (m, c) => c.toUpperCase()); }

const REG = { byId: {} };

/* Parse a fragment well enough to register ids, classes and data-attrs. */
function parseChildren(html, parent) {
  const out = [];
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, close, tag, attrs, self] = m;
    if (close) { stack.pop(); continue; }
    const el = new El(tag);
    const ar = /([\w:-]+)(?:="([^"]*)")?/g;
    let a;
    while ((a = ar.exec(attrs))) {
      const k = a[1], v = a[2] === undefined ? '' : a[2];
      if (k === 'id') el.id = v;
      else if (k === 'class') el.className = v;
      else if (k.startsWith('data-')) { el.dataset[camel(k)] = v; el.attrs[k] = v; }
      else { el.attrs[k] = v; if (k === 'disabled') el.disabled = true; }
    }
    const p = stack.length ? stack[stack.length - 1] : parent;
    el.parentNode = p;
    if (p === parent) out.push(el); else p.children.push(el);
    if (!self && !/^(img|br|input|hr|meta|link|path|use)$/i.test(tag)) stack.push(el);
  }
  return out;
}

/* ---------------------------------------------------------- canvas ctx */

const CTX = new Proxy({
  canvas: { width: 960, height: 540 },
  globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
  shadowColor: '', shadowBlur: 0, globalCompositeOperation: '', filter: '',
  imageSmoothingEnabled: true, textAlign: ''
}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createLinearGradient' || k === 'createRadialGradient') {
      return () => ({ addColorStop() {} });
    }
    if (k === 'measureText') return () => ({ width: 10 });
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; }
});

/* ---------------------------------------------------------- globals */

const listeners = {};
const storage = {};
const window = {
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  removeEventListener: () => {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  localStorage: {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  },
  performance: { now: () => Date.now() },
  Image: class { constructor() { this._nw = 64; } set src(v) { this._src = v; } get src() { return this._src; } get naturalWidth() { return 0; } get naturalHeight() { return 0; } addEventListener() {} },
  Audio: class { constructor() {} play() { return { catch() {} }; } addEventListener() {} },
  AudioContext: undefined,
  speechSynthesis: null,
  SpeechSynthesisUtterance: class {},
  screen: {},
  gsap: undefined
};

const document = {
  body: new El('body'),
  documentElement: new El('html'),
  activeElement: null,
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  createElement: (t) => new El(t),
  getElementById: (id) => REG.byId[id] || null,
  querySelector: (s) => docQuery(s)[0] || null,
  querySelectorAll: (s) => docQuery(s),
  fullscreenElement: null
};

function docQuery(sel) {
  sel = sel.trim();
  if (sel.startsWith('#')) {
    const bare = sel.slice(1).split(/[\s>]/)[0];
    const el = REG.byId[bare];
    if (!el) return [];
    const rest = sel.slice(1 + bare.length).trim();
    return rest ? el.querySelectorAll(rest) : [el];
  }
  const all = Object.values(REG.byId).flatMap((e) => [e, ...e.descendants()]);
  const uniq = [...new Set(all)];
  const last = sel.split(/\s+/).pop();
  return uniq.filter((e) => { try { return e.matches(last); } catch (x) { return false; } });
}

/* ---------------------------------------------------------- build the DOM */

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const bodyHtml = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
document.body.innerHTML = bodyHtml;
// re-register every id created by the parse
document.body.descendants().forEach((e) => { if (e._id) REG.byId[e._id] = e; });

/* ---------------------------------------------------------- run scripts */

const sandbox = {
  window, document, console,
  Image: window.Image, Audio: window.Audio,
  localStorage: window.localStorage,
  performance: window.performance,
  requestAnimationFrame: window.requestAnimationFrame,
  screen: window.screen,
  Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map, Error,
  parseInt, parseFloat, isNaN, setTimeout, clearTimeout, Proxy, Symbol
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
for (const rel of scripts) {
  if (rel.includes('vendor')) continue;            // GSAP needs a real DOM
  const file = path.join(ROOT, rel);
  try {
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: rel });
  } catch (e) {
    errors.push(['LOAD ' + rel, e.message, (e.stack || '').split('\n')[1]]);
  }
}

module.exports = { sandbox, window, document, REG, errors, warnings, listeners, STEPS, El };
