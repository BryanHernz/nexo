import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validScreenshotPath, initExperience } from '../experience.mjs';
import { portalHtml } from './portal-fixture.mjs';
const html = portalHtml();
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
test('el modulo visual no requiere DOM al importarse', () => { assert.doesNotThrow(initExperience); });
test('la galeria solo acepta capturas locales', () => {
  assert.ok(validScreenshotPath('assets/screens/nova-microphone.webp'));
  assert.ok(validScreenshotPath('assets/screens/contrapalabra-windows-home.png'));
  for (const invalid of ['javascript:alert(1)', '../foo.webp', 'https://example.com/x.webp', 'assets/screens/../x.webp', 'assets/screens/a.webp?x=1']) assert.equal(validScreenshotPath(invalid), false);
});
test('no hay nombre personal visible en el HTML principal', () => {
  const copy = html.replace(/<[^>]+>/g, '');
  assert.doesNotMatch(copy, /Bryan|Hern[aá]ndez|Hernz/iu);
});
test('los recursos locales declarados existen', () => {
  for (const match of html.matchAll(/(?:src|href|data-image|data-lightbox)="(assets\/[^"#]+)"/g)) {
    assert.ok(existsSync(new URL(`../${match[1]}`, import.meta.url)), match[1]);
  }
});
test('el companion usa el teléfono realmente conectado con barras del sistema recortadas, sin IA', () => {
  const source = JSON.parse(readFileSync(new URL('../assets/sources.json', import.meta.url))).find(x => x.asset.endsWith('nova-microphone-connected-20261012.png'));
  assert.match(source.source, /teléfono conectado.*2026-10-12/);
  assert.equal(source.transforms.statusBarRemoved, true);
  assert.equal(source.transforms.bottomSystemBarRemoved, true);
  assert.equal(source.transforms.playerLabelMasked, true);
  assert.equal(source.transforms.rotationDegrees, 180);
  assert.equal(source.generativeRedraw, false);
  assert.match(html, /src="assets\/screens\/nova-microphone-connected-20261012\.png"/);
});
test('los botones principales son planos y las secciones admiten alto completo', () => {
  const rule = css.match(/\.button\{([^}]+)\}/)[1];
  assert.match(rule, /box-shadow:none/);
  assert.match(rule, /border:0/);
  assert.match(rule, /background-image:none/);
  assert.match(css, /--radius:8px/);
  assert.match(css, /min-height:1060px/);
});
test('el despliegue incluye el nuevo modulo visual', () => {
  const build = readFileSync(new URL('../tools/build.mjs', import.meta.url), 'utf8');
  assert.match(build, /experience.mjs/);
  assert.match(build, /assets/);
});
