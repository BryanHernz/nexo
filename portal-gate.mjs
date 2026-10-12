import { APPS } from './config.mjs?v=private-v2';

export function allowedApps(keys) {
  if (!Array.isArray(keys) || keys.some(key => !APPS.some(app => app.key === key))) return [];
  return APPS.filter(app => keys.includes(app.key));
}

export function restrictProducts(document, apps) {
  // Presentation only: keep the authenticated server template and its access gate.
  for (const cta of document.querySelectorAll('.header .header-cta')) cta.remove();
  const logout = document.getElementById('portal-logout');
  logout?.classList.remove('button', 'primary');
  logout?.classList.add('quiet-action');
  for (const button of document.querySelectorAll('[data-download="tv"]')) {
    const label = button.querySelector('strong') ?? button.querySelector(':scope > span');
    if (!label || label.querySelector('.platform-subline')) continue;
    label.firstChild.textContent = 'Android TV';
    const line = document.createElement('span'); line.className = 'platform-subline'; line.textContent = '/ Google TV';
    label.insertBefore(line, label.querySelector('small'));
  }
  const downloadsIntro = document.querySelector('.downloads-intro > p');
  if (downloadsIntro) downloadsIntro.textContent = 'Elige Windows, Android o Android TV / Google TV.';
  const first = apps[0]?.id;
  for (const link of document.querySelectorAll('.scroll-cue')) link.setAttribute('href', `#${first}`);
  const allowed = new Set(apps.map(app => app.id));
  for (const app of APPS.filter(app => !allowed.has(app.id))) {
    for (const node of document.querySelectorAll(`[data-app="${app.id}"], [data-product="${app.id}"], a[href="#${app.id}"]`)) node.remove();
  }
  const description = document.querySelector('.hero-description');
  if (description) description.textContent = `Descubre ${apps.map(app => app.name).join(' y ')}. Elige tu pantalla y empieza a jugar.`;
  if (apps.length === 1) {
    document.querySelector('.art-aside')?.remove();
    document.querySelector('.hero-domain').textContent = apps[0].key === 'novaStar' ? 'KARAOKE' : apps[0].key === 'cartonLleno' ? 'BINGO' : 'PALABRAS';
  }
}

// Public presentation never grants download permission. Every stable download
// route rechecks the current server-owned access before requesting a signed URL.
export function initPortalGate({ document, window, auth, onAuthorized = () => {} }) {
  const shell = document.getElementById('portal-content');
  const gate = document.getElementById('portal-login');
  const form = document.getElementById('portal-login-form');
  const message = document.getElementById('portal-message');
  const action = document.getElementById('portal-logout');
  let revision = 0, currentUser = null, previousScroll = 0;
  function publicView() {
    shell.hidden = false; gate.hidden = true;
    const url = new URL(window.location.href); url.searchParams.delete('login');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  function loginView() {
    previousScroll = window.scrollY;
    shell.hidden = true; gate.hidden = false;
    form.hidden = false;
    document.querySelector('dialog[open]')?.close();
    const url = new URL(window.location.href); url.searchParams.set('login', '1');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    form.elements.email.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }
  function resetMetadata() {
    for (const node of shell.querySelectorAll('[data-version], [data-date], [data-notes], [data-size]')) node.textContent = '';
    for (const node of shell.querySelectorAll('[data-status]')) node.textContent = 'Inicia sesión para descargar con tu cuenta Nexo.';
  }
  async function session(user) {
    const run = ++revision;
    currentUser = user;
    resetMetadata();
    action.textContent = user && !user.isAnonymous ? 'Cerrar sesión' : 'Iniciar sesión';
    action.setAttribute('href', '?login=1');
    form.hidden = false;
    document.getElementById('portal-gate-logout').hidden = !user;
    if (!user) { message.textContent = 'Inicia sesión para descargar tus aplicaciones.'; return; }
    if (user.isAnonymous) { await auth.signOut(); return; }
    try {
      await user.getIdToken(true);
      const content = await auth.loadPortal(user);
      if (run !== revision) return;
      const apps = allowedApps(content.apps);
      if (!apps.length) throw Object.assign(new Error('access_denied'), { status: 403 });
      const wasLogin = !gate.hidden;
      publicView();
      if (wasLogin) window.scrollTo?.(0, previousScroll);
      await onAuthorized({ user, apps, valid: () => run === revision && currentUser === user });
    } catch (error) {
      if (run !== revision) return;
      const text = error.status === 403 ? 'Tu cuenta no tiene acceso a las descargas de Nexo.' :
        'No pudimos verificar tu acceso. Reintenta cuando haya conexión.';
      message.textContent = text;
      for (const node of shell.querySelectorAll('[data-status]')) node.textContent = text;
      if (error.status === 401) await auth.signOut();
    }
  }
  async function signOut() {
    ++revision; currentUser = null;
    resetMetadata();
    try { await auth.signOut(); await session(null); publicView(); }
    catch { message.textContent = 'No pudimos cerrar la sesión. Reintenta.'; loginView(); }
  }
  action.addEventListener('click', event => { event.preventDefault(); if (currentUser) void signOut(); else loginView(); });
  const back = document.getElementById('portal-back');
  back.addEventListener('click', event => {
    event.preventDefault(); publicView(); action.focus({ preventScroll: true }); window.scrollTo?.(0, previousScroll);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button'); button.disabled = true;
    const password = form.elements.password.value; form.elements.password.value = '';
    message.removeAttribute('data-error');
    for (const input of form.querySelectorAll('input')) input.removeAttribute('aria-invalid');
    try { await auth.signIn(form.elements.email.value.trim(), password); }
    catch {
      message.textContent = 'No se pudo iniciar sesión. Revisa tus datos e inténtalo nuevamente.';
      message.dataset.error = 'true';
      for (const input of form.querySelectorAll('input')) input.setAttribute('aria-invalid', 'true');
    } finally { button.disabled = false; }
  });
  document.getElementById('portal-gate-logout').addEventListener('click', () => void signOut());
  document.getElementById('portal-retry').addEventListener('click', () => void session(currentUser));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) void session(currentUser);
  });
  if (new URL(window.location.href).searchParams.get('login') === '1') loginView(); else publicView();
  const unsubscribe = auth.subscribe(user => void session(user), () => {
    ++revision; currentUser = null; resetMetadata();
    action.textContent = 'Iniciar sesión'; message.textContent = 'No pudimos restaurar la sesión. Vuelve a iniciar sesión.';
  });
  return { session, signOut, getUser: () => currentUser, stop: () => { ++revision; unsubscribe(); } };
}
