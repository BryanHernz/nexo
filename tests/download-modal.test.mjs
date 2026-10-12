import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { APPS } from '../config.mjs';
import { initDownloadModal } from '../download-modal.mjs';
import { publicIndex } from '../tools/public-page.mjs';
import { portalContent } from './portal-fixture.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const user = { uid: 'test-user', isAnonymous: false };
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(t, { initialUser = user, apps = APPS.map(app => app.key), status, waitForPortal } = {}) {
  const dom = new JSDOM(publicIndex(html, portalContent), { url: 'https://nexo-hub.web.app/#contrapalabra' });
  const { window } = dom, calls = [], navigations = [];
  let currentUser = initialUser, observer, signatures = 0;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  const auth = { subscribe(fn) { observer = fn; return () => {}; } };
  const controller = initDownloadModal({ document: window.document, window, auth, getUser: () => currentUser,
    signOut: async () => { currentUser = null; observer(null); }, navigate: url => navigations.push(url),
    clientFor: () => ({
      async portal() { calls.push('portal'); if (waitForPortal) await waitForPortal(); if (status) throw { status }; return { apps }; },
      async latest(app) { calls.push(['latest', app]); return { version: '1.0.0', recommendations: {
        windows: `${app}-installer`, phone: `${app}-phone`, tv: `${app}-tv` },
        assets: ['installer', 'phone', 'tv'].map(variant => ({ id: `${app}-${variant}` })) }; },
      async download(...args) { calls.push(['download', ...args]); return {
        url: `https://storage.googleapis.com/private/file?X-Goog-Signature=temporary-${++signatures}` }; },
    }) });
  function click(app = 'contrapalabra', platform = 'windows', options = {}) {
    const item = APPS.find(value => value.key === app);
    const link = window.document.querySelector(`[data-app="${item.id}"] [data-download="${platform}"]`);
    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true, ...options });
    // Avoid jsdom's navigation attempt after checking the event's actual outcome.
    link.dispatchEvent(event);
    return event.defaultPrevented;
  }
  t.after(() => { controller.stop(); window.close(); });
  return { ...controller, window, calls, navigations, click, changeUser(value) { currentUser = value; observer(value); } };
}

test('sin sesión o anónimo conserva la ruta estable de login; no consulta ni firma', t => {
  for (const initialUser of [null, { uid: 'anon', isAnonymous: true }]) {
    const view = setup(t, { initialUser });
    assert.equal(view.click(), false);
    assert.equal(view.dialog.open, false);
    assert.deepEqual(view.calls, []);
  }
});

for (const app of APPS) {
  test(`${app.name}: modal de su aplicación, descarga recomendada sin abandonar el portal`, async t => {
    const view = setup(t);
    for (const platform of ['windows', 'phone', 'tv']) {
      assert.equal(view.click(app.key, platform), true);
      await tick();
      assert.equal(view.dialog.dataset.app, app.id);
      assert.match(view.dialog.querySelector('h2').textContent, new RegExp(app.name));
      assert.equal(view.dialog.dataset.state, 'complete');
      assert.deepEqual(view.calls.at(-1), ['download', app.key, '1.0.0', `${app.key}-${platform === 'windows' ? 'installer' : platform}`]);
      assert.match(view.navigations.at(-1), /^https:\/\/storage\.googleapis\.com\//);
      assert.equal(view.window.location.href, 'https://nexo-hub.web.app/#contrapalabra');
      assert.doesNotMatch(view.window.document.documentElement.outerHTML, /X-Goog-Signature|storage\.googleapis\.com|github\.com/);
      assert.equal(view.window.localStorage.length, 0);
      assert.equal(view.window.sessionStorage.length, 0);
      view.close();
    }
  });
}

test('access denegado no consulta latest ni firma', async t => {
  const view = setup(t, { apps: ['novaStar'] }); view.click(); await tick();
  assert.equal(view.dialog.dataset.state, 'denied');
  assert.deepEqual(view.calls, ['portal']); assert.deepEqual(view.navigations, []);
});

test('sesión revocada vuelve a login conservando app y plataforma', async t => {
  const view = setup(t, { status: 401 }); view.click(); await tick();
  assert.equal(view.dialog.open, false);
  assert.deepEqual(view.navigations, ['/download/contrapalabra?platform=windows']);
});

test('cerrar, Escape, logout o cambio de cuenta suprimen la descarga tardía', async t => {
  for (const action of ['close', 'escape', 'logout', 'switch']) {
    let finish;
    const view = setup(t, { waitForPortal: () => new Promise(resolve => { finish = resolve; }) });
    view.click();
    if (action === 'close') view.dialog.querySelector('.download-modal-done').click();
    if (action === 'escape') view.dialog.dispatchEvent(new view.window.Event('cancel', { cancelable: true }));
    if (action === 'logout') view.changeUser(null);
    if (action === 'switch') view.changeUser({ uid: 'another-user', isAnonymous: false });
    finish(); await tick();
    assert.equal(view.dialog.open, false); assert.deepEqual(view.calls, ['portal']);
    assert.deepEqual(view.navigations, []);
  }
});

test('cada reintento revalida acceso/latest y pide una firma nueva; no porcentaje ficticio', async t => {
  const view = setup(t); view.click(); await tick();
  view.dialog.querySelector('.download-modal-retry').click(); await tick();
  assert.equal(view.calls.filter(call => call === 'portal').length, 2);
  assert.equal(view.navigations.length, 2);
  assert.notEqual(view.navigations[0], view.navigations[1]);
  assert.match(view.dialog.textContent, /navegador muestra el progreso/);
  assert.equal(view.dialog.querySelector('[role="progressbar"]'), null);
});

test('doble clic no duplica solicitudes; enlaces modificados mantienen comportamiento nativo', async t => {
  let finish;
  const view = setup(t, { waitForPortal: () => new Promise(resolve => { finish = resolve; }) });
  assert.equal(view.click('novaStar', 'phone', { ctrlKey: true }), false);
  assert.deepEqual(view.calls, []);
  view.click(); view.click();
  assert.deepEqual(view.calls, ['portal']); finish(); await tick();
  assert.equal(view.navigations.length, 1);
});

test('fallo de red permite reintento con nuevo chequeo y conserva el portal', async t => {
  const view = setup(t, { status: 503 }); view.click(); await tick();
  assert.equal(view.dialog.dataset.state, 'error');
  assert.equal(view.dialog.querySelector('.download-modal-retry').hidden, false);
  assert.deepEqual(view.navigations, []);
});
