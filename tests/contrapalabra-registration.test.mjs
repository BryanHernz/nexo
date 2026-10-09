import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {allowedApps,restrictProducts} from '../portal-gate.mjs';
import {pairingAppearance,renderPairExperience} from '../pair.mjs';
import {appFromDownloadPath} from '../download.mjs';

test('Contrapalabra only: Hub conserva su tarjeta/categoría y elimina Nova/Cartón',()=>{
  const apps=allowedApps(['contrapalabra']);assert.equal(apps.length,1);
  const dom=new JSDOM(readFileSync(new URL('../functions/portal-content.html',import.meta.url),'utf8'));
  try {
    restrictProducts(dom.window.document,apps);
    assert.ok(dom.window.document.getElementById('contrapalabra'));
    assert.equal(dom.window.document.getElementById('nova-star'),null);
    assert.equal(dom.window.document.getElementById('carton-lleno'),null);
    assert.equal(dom.window.document.querySelector('.hero-domain').textContent,'PALABRAS');
    assert.equal(dom.window.document.querySelector('.scroll-cue').getAttribute('href'),'#contrapalabra');
    assert.equal(dom.window.document.querySelectorAll('#contrapalabra [data-download]').length,3);
  }finally{dom.window.close();}
});
test('theme Contrapalabra sólo desde metadata validada; otros themes mantienen sus colores',()=>{
  const appearance=pairingAppearance('contrapalabra');
  assert.equal(appearance.background,'#f4f6f5');assert.equal(appearance.accent,'#3f6d3e');
  assert.equal(pairingAppearance('novaStar').background,'#050a13');
  assert.equal(pairingAppearance('cartonLleno').background,'#f2f0e6');
  assert.equal(pairingAppearance('<script>').app,'nexo');
  const dom=new JSDOM(readFileSync(new URL('../pair.html',import.meta.url),'utf8'));
  try {
    renderPairExperience(dom.window.document,{app:'contrapalabra',phase:'code-entry',authenticated:true,busy:false,terminal:false});
    assert.equal(dom.window.document.body.dataset.app,'contrapalabra');
    assert.equal(dom.window.document.getElementById('pair-header-name').textContent,'Contrapalabra');
    assert.ok(dom.window.document.querySelector('.pair-carton-balls').hidden);
  }finally{dom.window.close();}
});
test('ruta de descarga conocida reconoce Contrapalabra, sin aceptar una app desconocida',()=>{
  assert.equal(appFromDownloadPath('/download/contrapalabra'),'contrapalabra');
  assert.equal(appFromDownloadPath('/download/contrapalabra/'),'contrapalabra');
  assert.equal(appFromDownloadPath('/download/unknown'),null);
});
