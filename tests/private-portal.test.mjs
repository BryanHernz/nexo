import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { APPS } from '../config.mjs';
import { initDownloads, initPublicVersions } from '../app.js';
import { allowedApps, initPortalGate } from '../portal-gate.mjs';
import { createReleaseClient, validateRelease } from '../private-releases.mjs';
import { publicIndex } from '../tools/public-page.mjs';
import { portalHtml, portalContent } from './portal-fixture.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const user = { uid: 'test-user', isAnonymous: false, getIdToken: async () => 'local-test-id-token' };
const access = { active: true, apps: { novaStar: true, cartonLleno: false } };
const manifest = { schemaVersion: 1, app: 'novaStar', version: '1.0.27', build: 1029,
  releasedAt: '2026-10-01T00:00:00.000Z', notes: '<script>not executable</script>',
  recommendations: { windows: 'novaStar-1.0.27-installer', phone: 'novaStar-1.0.27-phone', tv: 'novaStar-1.0.27-tv' },
  assets: ['installer', 'phone', 'tv', 'updater'].map((variant, i) => ({
    id: `novaStar-1.0.27-${variant}`, variant: i === 0 || i === 3 ? 'standard' : variant,
    platform: i === 0 || i === 3 ? 'windows' : 'android', purpose: i === 0 ? 'installer' : i === 3 ? 'updater' : 'package',
    architecture: i === 0 || i === 3 ? 'x64' : i === 1 ? 'arm64-v8a' : 'armeabi-v7a',
    format: i === 0 ? 'exe' : i === 3 ? 'zip' : 'apk', filename: `artifact-${i}.bin`,
    versionCode: i === 0 || i === 3 ? null : 3029, size: 1234, sha256: 'a'.repeat(64), generation: String(i + 1),
    downloadEndpoint: `/api/v1/releases/novaStar/1.0.27/download/novaStar-1.0.27-${variant}`,
  })) };
function dom(t) {
  const instance = new JSDOM(portalHtml(), { url: 'http://127.0.0.1:8080/' });
  t.after(() => instance.window.close());
  return instance;
}
function gate(t, { loadPortal = async () => ({ apps: ['novaStar'], html: '<p>Not mounted</p>' }), onAuthorized = () => {} } = {}) {
  const instance = new JSDOM(publicIndex(html, portalContent), { url: 'https://nexo-hub.web.app/' });
  const { window } = instance; window.scrollTo = () => {};
  let signOuts = 0, signedIn;
  const auth = { subscribe: () => () => {}, signOut: async () => { signOuts++; },
    signIn: async (email, password) => { signedIn = { email, password }; }, loadPortal };
  const controller = initPortalGate({ document: window.document, window, auth, onAuthorized });
  t.after(() => { controller.stop(); window.close(); });
  return { ...controller, window, document: window.document, auth, signOuts: () => signOuts, signedIn: () => signedIn };
}

test('sin sesión muestra las tres apps y sólo rutas estables de descarga', async t => {
  const g = gate(t); await g.session(null);
  assert.equal(g.document.getElementById('portal-content').hidden, false);
  assert.equal(g.document.getElementById('portal-login').hidden, true);
  for (const app of APPS) {
    assert.ok(g.document.getElementById(app.id));
    for (const target of ['windows', 'phone', 'tv']) assert.ok(g.document.querySelector(`[data-app="${app.id}"] [href="/download/${app.key}?platform=${target}"]`));
  }
  assert.equal(g.document.getElementById('portal-logout').textContent, 'Iniciar sesión');
  assert.doesNotMatch(g.document.documentElement.outerHTML, /github\.com|X-Goog-Signature|downloadEndpoint|recommendations/);
});

test('navbar abre login con el estilo aprobado; volver no exige autenticación', async t => {
  const g = gate(t); await g.session(null);
  const button = g.document.getElementById('portal-logout'); button.click();
  assert.ok(button.classList.contains('nav-session'));
  assert.equal(g.document.getElementById('portal-login').hidden, false);
  assert.equal(g.document.getElementById('portal-login-form').hidden, false);
  assert.equal(g.window.location.search, '?login=1');
  g.document.getElementById('portal-back').click();
  assert.equal(g.document.getElementById('portal-content').hidden, false);
  assert.equal(g.window.location.search, '');
});

test('sesión usa access del backend; descripciones públicas no conceden descargas', async t => {
  let context;
  const g = gate(t, { onAuthorized: value => { context = value; } }); await g.session(user);
  assert.deepEqual(context.apps.map(app => app.key), ['novaStar']);
  assert.equal(context.valid(), true);
  assert.ok(g.document.getElementById('carton-lleno'));
  assert.equal(g.document.getElementById('portal-logout').textContent, 'Cerrar sesión');
  assert.doesNotMatch(g.document.body.textContent, /Not mounted/);
  assert.equal(g.window.localStorage.length, 0);
  await g.session(null); assert.equal(context.valid(), false);
});

test('metadata privada sólo se consulta para apps autorizadas; respuesta tardía no vuelve tras logout', async t => {
  const g = gate(t), calls = [];
  await initPublicVersions({ document: g.document, apps: [APPS[0]], user,
    fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => manifest }; } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /novaStar\/latest$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer local-test-id-token');
  assert.match(g.document.querySelector('[data-app="nova-star"] [data-version]').textContent, /1\.0\.27/);
  assert.match(g.document.querySelector('[data-app="carton-lleno"] [data-status]').textContent, /no tiene acceso/);
  await g.session(null);
  let resolve, valid = true;
  const pending = initPublicVersions({ document: g.document, apps: [APPS[0]], user, valid: () => valid,
    fetchImpl: () => new Promise(done => { resolve = done; }) });
  await new Promise(done => setImmediate(done));
  valid = false; resolve({ ok: true, json: async () => manifest }); await pending;
  assert.equal(g.document.querySelector('[data-app="nova-star"] [data-version]').textContent, '');
  assert.equal(g.window.localStorage.length, 0);
  assert.doesNotMatch(g.document.documentElement.outerHTML, /local-test-id-token|X-Goog-Signature/);
});

test('sin access o sin conexión mantiene portada pública sin habilitar metadata privada', async t => {
  for (const status of [403, 503]) {
    let authorized = false;
    const g = gate(t, { loadPortal: async () => { throw Object.assign(new Error('private detail'), { status }); }, onAuthorized: () => { authorized = true; } });
    await g.session(user);
    assert.equal(authorized, false);
    assert.equal(g.document.getElementById('portal-content').hidden, false);
    assert.doesNotMatch(g.document.body.textContent, /private detail/);
    assert.ok([...g.document.querySelectorAll('[data-version]')].every(node => node.textContent === ''));
  }
});

test('apps desconocidas fallan cerradas; usuario revocado vuelve a autenticar', async t => {
  for (const keys of [undefined, [], ['unknown'], [true], { novaStar: true }]) assert.equal(allowedApps(keys).length, 0);
  let authorized = false;
  const g = gate(t, { loadPortal: async () => ({ apps: ['unknown'] }), onAuthorized: () => { authorized = true; } });
  await g.session(user); assert.equal(authorized, false);
  g.auth.loadPortal = async () => { throw Object.assign(new Error('revoked'), { status: 401 }); };
  await g.session(user); assert.equal(g.signOuts(), 1);
});

test('rechaza Anonymous y vacía contraseña del login sin guardarla', async t => {
  const g = gate(t); await g.session({ ...user, isAnonymous: true }); assert.equal(g.signOuts(), 1);
  await g.session(null);
  const form = g.document.getElementById('portal-login-form');
  form.elements.email.value = 'test@example.invalid'; form.elements.password.value = 'local-test-password';
  form.dispatchEvent(new g.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(form.elements.password.value, '');
  assert.equal(g.signedIn().email, 'test@example.invalid');
  assert.equal(g.window.localStorage.length, 0);
});

test('logout conserva portada; respuesta antigua no restaura permisos ni sesión', async t => {
  let resolve, authorized = false;
  const g = gate(t, { loadPortal: () => new Promise(done => { resolve = done; }), onAuthorized: () => { authorized = true; } });
  const pending = g.session(user); await new Promise(done => setImmediate(done));
  await g.signOut(); resolve({ html: portalContent, apps: ['novaStar'] }); await pending;
  assert.equal(authorized, false);
  assert.equal(g.document.getElementById('portal-content').hidden, false);
  assert.equal(g.document.getElementById('portal-logout').textContent, 'Iniciar sesión');
});
test('descargas consultan API autenticada y firman bajo demanda, sin enlaces/caché persistentes', async t => {
  const { window } = dom(t), calls = [], navigated = [];
  await initDownloads({ document: window.document, window, apps: [APPS[0]], user,
    navigate: url => navigated.push(url), fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => url.endsWith('/latest') ? manifest : {
        url: 'https://storage.googleapis.com/private/installer.exe?X-Goog-Signature=local-test',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      } };
    } });
  assert.equal(calls.length, 1); assert.match(calls[0].url, /releases\/novaStar\/latest$/);
  const button = window.document.querySelector('[data-download="windows"]');
  assert.equal(button.getAttribute('href'), null); assert.equal(button.getAttribute('aria-disabled'), 'false');
  assert.match(window.document.querySelector('[data-notes]').textContent, /<script>/);
  button.click(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[1].options.method, 'POST'); assert.equal(calls[1].options.body, '{}');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer local-test-id-token');
  assert.match(calls[1].url, /novaStar\/1.0.27\/download\/novaStar-1.0.27-installer$/);
  assert.equal(navigated.length, 1); assert.equal(window.localStorage.length, 0);
  assert.equal(button.getAttribute('href'), null);
});
test('rechaza manifest manipulado, signed URL vencida y 403; no usa fallback GitHub', async t => {
  assert.throws(() => validateRelease({ ...manifest, assets: manifest.assets.map(a => ({ ...a, downloadEndpoint: 'https://evil.test' })) }, 'novaStar'));
  const client = createReleaseClient({ user, fetchImpl: async () => ({ ok: true, json: async () => ({
    url: 'https://storage.googleapis.com/private?X-Goog-Signature=local-test', expiresAt: new Date(Date.now() - 1000).toISOString(),
  }) }) });
  await assert.rejects(client.download('novaStar', '1.0.27', 'novaStar-1.0.27-installer'), error => error.status === 503);
  const { window } = dom(t), denied = [];
  await initDownloads({ document: window.document, window, apps: [APPS[0]], user,
    onDenied: status => denied.push(status), fetchImpl: async () => ({ ok: false, status: 403 }) });
  assert.deepEqual(denied, [403]);
  assert.equal(window.document.querySelector('[data-download="windows"]').getAttribute('aria-disabled'), 'true');
});

test('portal usa defaults teléfono/TV y nunca el updater como instalador Windows', async t => {
  const { window } = dom(t), downloads = [];
  await initDownloads({ document: window.document, window, apps: [APPS[0]], user,
    navigate: () => {}, fetchImpl: async url => ({ ok: true, json: async () => {
      if (url.endsWith('/latest')) return manifest;
      downloads.push(url);
      return { url: 'https://storage.googleapis.com/private?X-Goog-Signature=test',
        expiresAt: new Date(Date.now() + 300000).toISOString() };
    } }) });
  for (const target of ['windows', 'phone', 'tv']) {
    window.document.querySelector(`[data-download="${target}"]`).click();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(downloads.at(-1).endsWith(`/download/${manifest.recommendations[target]}`));
  }
  assert.ok(downloads.every(url => !url.endsWith('updater')));
});
test('el nuevo gate no se incluye en pairing y el build copia sus dependencias independientes', () => {
  const pair = readFileSync(new URL('../pair.html', import.meta.url), 'utf8');
  assert.doesNotMatch(pair, /portal-gate|portal-auth|app.js|portal-content/);
  const source = readFileSync(new URL('../portal-auth.mjs', import.meta.url), 'utf8');
  assert.match(source, /createReleaseClient/); assert.match(source, /connectFirebaseAuth/);
  assert.doesNotMatch(source, /firebase-firestore|getDoc|readAccess/);
  assert.doesNotMatch(source, /localStorage|signInAnonymously|createUser/);
});

test('los módulos del nuevo gate evitan la configuración pública cacheada', () => {
  assert.match(readFileSync(new URL('../portal-gate.mjs', import.meta.url), 'utf8'), /config\.mjs\?v=private-v2/);
  assert.match(html, /app\.js\?v=public-v1/);
});
