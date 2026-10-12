import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initGalleryCarousel, GALLERY_INTERVAL_MS, GALLERY_TRANSITION_MS } from '../gallery.mjs';
import { restrictProducts } from '../portal-gate.mjs';
import { APPS } from '../config.mjs';
import { portalHtml } from './portal-fixture.mjs';

function fixture(t, id = 'gallery-nova', reduce = false) {
  const dom = new JSDOM(portalHtml(), { pretendToBeVisual: true });
  let callback, observerCallback, cancelled = 0, clock = 0, scheduledMs;
  const reduced = new dom.window.EventTarget(); reduced.matches = reduce;
  dom.window.matchMedia = () => reduced;
  const image = dom.window.document.getElementById(id);
  const list = dom.window.document.querySelector(`[role=tablist]:has([aria-controls="${id}"])`);
  class Observer {
    constructor(fn) { observerCallback = fn; }
    observe() {}
    disconnect() {}
  }
  const options = { IntersectionObserver: Observer, now:()=>clock, setTimeout(fn, ms) { assert.ok(ms>0&&ms<=GALLERY_INTERVAL_MS); scheduledMs=ms;callback = fn; return 1; }, clearTimeout() { callback = undefined; cancelled++; } };
  const dispose = initGalleryCarousel(list, options);
  t.after(() => { dispose(); dom.window.close(); });
  return { dom, image, list, reduced, options, dispose,
    visible(value = true) { observerCallback([{ isIntersecting: value }]); },
    advance() { assert.ok(callback, 'a visible gallery schedules rotation'); clock+=scheduledMs; const fn = callback; callback = undefined; fn(); },
    elapse(ms){clock+=ms;}, get scheduledMs(){return scheduledMs;},
    get scheduled() { return Boolean(callback); }, get cancelled() { return cancelled; } };
}

for (const id of ['gallery-hub', 'gallery-nova', 'gallery-carton', 'gallery-contrapalabra']) {
  test(`${id}: automatic rotation only while visible; manual next/previous select the actual local capture`, t => {
    const f = fixture(t, id), doc = f.dom.window.document;
    const tabs = [...f.list.querySelectorAll('[role=tab]')];
    assert.equal(f.scheduled, false);
    f.visible(); f.advance();
    assert.ok(f.image.src.endsWith(tabs[1].dataset.image));
    assert.equal(doc.querySelector(`[aria-controls="${id}"][data-gallery-autoplay]`).getAttribute('aria-pressed'), 'true');
    doc.querySelector(`[aria-controls="${id}"][data-gallery-next]`).click();
    assert.ok(f.image.src.endsWith(tabs[2].dataset.image));
    assert.equal(f.scheduled, false);
    assert.equal(f.list.dataset.autoplay, 'paused');
    doc.querySelector(`[aria-controls="${id}"][data-gallery-previous]`).click();
    assert.ok(f.image.src.endsWith(tabs[1].dataset.image));
    doc.querySelector(`[aria-controls="${id}"][data-gallery-autoplay]`).click();
    assert.equal(f.scheduled, true);
    f.visible(false); assert.equal(f.scheduled, false);
  });
}

test('reduced motion disables automatic rotation and keeps tabs and arrows usable', t => {
  const f = fixture(t, 'gallery-carton', true); f.visible();
  assert.equal(f.scheduled, false);
  assert.equal(f.list.dataset.autoplay, 'reduced');
  assert.equal(f.dom.window.document.querySelector('[aria-controls="gallery-carton"][data-gallery-autoplay]').disabled, true);
  f.list.querySelectorAll('[role=tab]')[1].click();
  assert.match(f.image.src, /carton-90\.webp$/);
});

test('shorter carousel preserves the remaining countdown on hover and highlights the matching phone', t => {
  assert.equal(GALLERY_INTERVAL_MS,4000); assert.equal(GALLERY_TRANSITION_MS,600);
  const f=fixture(t,'gallery-hub'); f.visible(); f.elapse(1000);
  const media=f.list.parentElement;
  media.dispatchEvent(new f.dom.window.Event('mouseenter'));
  assert.equal(f.scheduled,false);
  media.dispatchEvent(new f.dom.window.Event('mouseleave'));
  assert.equal(f.scheduledMs,3000);
  f.advance();
  assert.equal(media.dataset.activeProduct,'carton-lleno');
  assert.equal(media.querySelector('.hero-phone-carton').dataset.active,'true');
  assert.equal(media.querySelector('.hero-phone-nova').dataset.active,'false');
  assert.match(media.querySelector('.gallery-position').textContent,/2 de 3/);
  assert.ok(f.list.querySelector('[aria-selected=true] .gallery-countdown[aria-hidden=true] > span'));
  assert.equal(media.querySelector('.gallery-timeline'),null);
});

test('the shared selector drains its tint, retains remaining time on pause, and follows the selected app', t => {
  const f=fixture(t,'gallery-hub'), calls=[];
  const fill=f.list.querySelector('.gallery-countdown > span');
  fill.animate=(frames,options)=>{calls.push({frames,options});return {pause(){},cancel(){}};};
  f.visible();
  assert.deepEqual(calls.at(-1).frames,[{width:'100%'},{width:'0%'}]);
  f.elapse(1000);
  const media=f.list.parentElement;
  media.dispatchEvent(new f.dom.window.Event('mouseenter'));
  media.dispatchEvent(new f.dom.window.Event('mouseleave'));
  assert.equal(calls.at(-1).frames[0].width,'75%');
  assert.equal(calls.at(-1).options.duration,3000);
  f.advance();
  assert.equal(fill.closest('[role=tab]').dataset.product,'carton-lleno');
  assert.equal(f.list.querySelectorAll('.gallery-countdown').length,1);
  f.dispose();
  assert.equal(f.list.querySelector('.gallery-countdown'),null);
});

test('product countdown stays between its counter and navigation controls', t => {
  const f=fixture(t),toolbar=f.list.closest('.product-media').querySelector('.gallery-toolbar');
  assert.ok(toolbar.querySelector('.gallery-position').nextElementSibling.matches('.gallery-timeline'));
  assert.ok(toolbar.querySelector('.gallery-timeline').nextElementSibling.matches('[data-gallery-previous]'));
  let frames;
  toolbar.querySelector('.gallery-timeline > span').animate=value=>{frames=value;return {pause(){},cancel(){}};};
  f.visible();
  assert.deepEqual(frames,[{width:'100%'},{width:'0%'}]);
});

test('shared app selection fades both tints and removes transient layers on disposal', t => {
  const f=fixture(t,'gallery-hub'),calls=[];
  f.dom.window.HTMLElement.prototype.animate=function(frames,options){
    calls.push({node:this,frames,options});
    return {pause(){},cancel(){},finished:new Promise(()=>{})};
  };
  f.list.querySelectorAll('[role=tab]')[1].click();
  assert.ok(calls.some(call=>call.node.classList.contains('gallery-countdown-outgoing')&&call.frames[1].opacity===0&&call.options.duration===600));
  assert.ok(calls.some(call=>call.node.classList.contains('gallery-countdown')&&!call.node.classList.contains('gallery-countdown-outgoing')&&call.frames[0].opacity===0&&call.frames[1].opacity===1));
  f.dispose();
  assert.equal(f.list.querySelectorAll('.gallery-countdown').length,0);
});

test('hover, keyboard focus, hidden page and an open lightbox suspend rotation; initialization is idempotent', t => {
  const f = fixture(t); f.visible(); const media = f.list.closest('.product-media');
  media.dispatchEvent(new f.dom.window.Event('mouseenter')); assert.equal(f.scheduled, false);
  media.dispatchEvent(new f.dom.window.Event('mouseleave')); assert.equal(f.scheduled, true);
  Object.defineProperty(f.dom.window.document, 'hidden', { value: true, configurable: true });
  f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange')); assert.equal(f.scheduled, false);
  Object.defineProperty(f.dom.window.document, 'hidden', { value: false, configurable: true });
  f.dom.window.document.dispatchEvent(new f.dom.window.Event('visibilitychange')); assert.equal(f.scheduled, true);
  f.image.closest('[data-lightbox]').click(); assert.equal(f.scheduled, false);
  assert.equal(initGalleryCarousel(f.list, f.options), f.dispose);
  assert.equal(media.querySelectorAll('.gallery-toolbar').length, 1);
  f.dispose(); assert.equal(media.querySelectorAll('.gallery-toolbar').length, 0);
});

test('the shared monitor initially displays only the authorized app, including a single-app account', t => {
  const dom = new JSDOM(portalHtml()); t.after(() => dom.window.close());
  restrictProducts(dom.window.document, APPS.filter(app => app.key === 'cartonLleno'));
  const list = dom.window.document.querySelector('.hub-selectors');
  assert.equal(list.querySelectorAll('[role=tab]').length, 1);
  initGalleryCarousel(list);
  assert.match(dom.window.document.getElementById('gallery-hub').src, /carton-75\.webp$/);
  assert.equal(dom.window.document.querySelector('.hero-phone-nova'), null);
  assert.equal(dom.window.document.querySelector('.hero-phone-word'), null);
});
