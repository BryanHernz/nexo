import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { initExperience } from '../experience.mjs';
import { restrictProducts } from '../portal-gate.mjs';
import { APPS } from '../config.mjs';
import { portalHtml } from './portal-fixture.mjs';

test('Contrapalabra participates in the shared hero and has a device scene, gallery and controller', () => {
  const dom = new JSDOM(portalHtml());
  try {
    const doc = dom.window.document, product = doc.getElementById('contrapalabra');
    assert.equal(doc.querySelector('.hub-selectors [data-product="contrapalabra"]').textContent.trim(), 'Contrapalabra');
    assert.equal(doc.querySelectorAll('.hub-selectors img').length, 0);
    assert.ok(product.hasAttribute('data-motion-scene'));
    assert.ok(product.querySelector('.product-copy[data-reveal]'));
    assert.ok(product.querySelector('.product-monitor[data-parallax][data-float] .motion-float'));
    assert.ok(product.querySelector('.phone[data-parallax][data-float] .phone-screen img'));
    assert.equal(product.querySelectorAll('.features .feature').length,4);
    assert.equal(product.querySelectorAll('[data-download]').length,3);
    const downloads=doc.getElementById('descargas-contrapalabra');
    assert.ok(downloads);
    assert.deepEqual([...downloads.querySelectorAll('[data-download]')].map(button=>button.dataset.download),['windows','phone','tv']);
    assert.equal(product.querySelectorAll('.gallery-controls [role="tab"]').length,4);
    assert.match(product.querySelector('#gallery-contrapalabra').src,/contrapalabra-game-20261012\.png$/);
    for (const tab of product.querySelectorAll('[data-image]')) assert.ok(existsSync(new URL('../'+tab.dataset.image,import.meta.url)));
    assert.equal(product.querySelectorAll('.contrapalabra-shots').length,0);
    assert.doesNotMatch(doc.querySelector('.hero').textContent,/Dos experiencias|KARAOKE & BINGO/);
  } finally { dom.window.close(); }
});

test('unauthorized Contrapalabra is removed from the hero, navigation and product scene', () => {
  const dom = new JSDOM(portalHtml());
  try {
    restrictProducts(dom.window.document,APPS.filter(app=>app.key!=='contrapalabra'));
    const content = dom.window.document.getElementById('portal-content');
    assert.equal(content.querySelector('[data-product="contrapalabra"]'),null);
    assert.equal(content.querySelector('#contrapalabra'),null);
    assert.doesNotMatch(content.textContent,/Contrapalabra/i);
    assert.ok(content.querySelector('#nova-star'));
    assert.ok(content.querySelector('#carton-lleno'));
  } finally { dom.window.close(); }
});

test('Nova uses current native captures with the account label masked and retains the hero performance', () => {
  const dom = new JSDOM(portalHtml());
  try {
    const doc = dom.window.document;
    const sources = JSON.parse(readFileSync(new URL('../assets/sources.json',import.meta.url)));
    for (const view of ['library','detail','session','tournament','bracket','fiesta-proposals']) {
      const path = `assets/screens/nova-${view}-20261012.webp`;
      assert.ok(doc.querySelector(`#nova-star [data-image="${path}"]`));
      const provenance = sources.find(source=>source.asset===path);
      assert.equal(provenance.generativeRedraw,false);
      assert.equal(provenance.transforms.accountLabelMasked,true);
    }
    assert.match(doc.getElementById('gallery-nova').src,/nova-library-20261012\.webp$/);
    assert.match(doc.querySelector('.hub-selectors [data-product="nova-star"]').dataset.image,/nova-duet\.webp$/);
    const tabs=[...doc.querySelectorAll('#nova-star [role="tab"]')];
    assert.equal(new Set(tabs.map(tab=>tab.dataset.image)).size,tabs.length);
  } finally { dom.window.close(); }
});

test('Cartón preserves both original printed examples, including the horizontal 90-ball card', () => {
  const dom = new JSDOM(portalHtml());
  try {
    const product=dom.window.document.getElementById('carton-lleno');
    const prints=[...product.querySelectorAll('.floating-print')];
    assert.equal(prints.length,2);
    assert.ok(prints.some(img=>img.src.endsWith('carton-90-detalle.webp')));
    for (const img of prints) assert.ok(existsSync(new URL('../'+img.getAttribute('src'),import.meta.url)));
  } finally { dom.window.close(); }
});

test('Contrapalabra PNG gallery supports click, keyboard and the existing lightbox', () => {
  const dom = new JSDOM(portalHtml(),{pretendToBeVisual:true});
  const previous = {window:globalThis.window,document:globalThis.document};
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  dom.window.matchMedia = ()=>({matches:true,addEventListener(){},removeEventListener(){}});
  const dialog = dom.window.document.getElementById('image-dialog');
  dialog.showModal = ()=>{dialog.open = true;};
  dialog.close = ()=>{dialog.open = false;};
  try {
    initExperience();
    const tabs = [...dom.window.document.querySelectorAll('#contrapalabra .gallery-tab')];
    const image = dom.window.document.getElementById('gallery-contrapalabra');
    tabs[2].click();
    assert.match(image.src,/contrapalabra-windows-catalogue\.png$/);
    assert.equal(tabs[2].getAttribute('aria-selected'),'true');
    assert.equal(tabs[0].tabIndex,-1);
    tabs[2].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    assert.match(image.src,/contrapalabra-windows-archive\.png$/);
    assert.equal(dom.window.document.activeElement,tabs[3]);
    image.closest('[data-lightbox]').click();
    assert.equal(dialog.open,true);
    assert.equal(dialog.querySelector('img').src,image.src);
    dialog.querySelector('.lightbox-close').click();
    assert.equal(dialog.open,false);
    assert.equal(dom.window.document.activeElement,image.closest('[data-lightbox]'));
  } finally {
    for (const key of ['window','document']) {
      if (previous[key]===undefined) delete globalThis[key]; else globalThis[key]=previous[key];
    }
    dom.window.close();
  }
});

test('visual polish does not publish private template, bypass Auth or add a motion toggle', () => {
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const product = readFileSync(new URL('../functions/portal-content.html',import.meta.url),'utf8');
  assert.match(html,/login-scene-contrapalabra/);
  assert.doesNotMatch(html,/data-download|downloadEndpoint|X-Goog-Signature/);
  assert.doesNotMatch(product,/Animaciones activas|motion-toggle|github\.com\/.*releases/);
});
