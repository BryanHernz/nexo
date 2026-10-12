import { initExperience } from './experience.mjs';
import { initMotion } from './motion.mjs';
import { connectPortal } from './portal-auth.mjs?v=private-v2';
import { initPortalGate } from './portal-gate.mjs?v=modal-v1';
import { initDownloadModal } from './download-modal.mjs';
import { createReleaseClient } from './private-releases.mjs';

export async function initDownloads({ document, window, apps, user, fetchImpl = fetch,
  valid = () => true, onDenied = () => {}, navigate = url => window.location.assign(url) }) {
  const client = createReleaseClient({ user, fetchImpl });
  async function failure(error, roots) {
    if ([401, 403].includes(error.status)) await onDenied(error.status);
    for (const root of roots) {
      root.querySelector('[data-status]')?.replaceChildren(document.createTextNode('Descarga no disponible. Revisa el acceso o reintenta.'));
    }
  }
  await Promise.all(apps.map(async app => {
    const roots = [...document.querySelectorAll(`[data-app="${app.id}"]`)];
    for (const root of roots) {
      for (const button of root.querySelectorAll('[data-download]')) {
        button.removeAttribute('href'); button.setAttribute('role', 'button');
        button.setAttribute('aria-disabled', 'true'); button.tabIndex = -1;
      }
    }
    try {
      const manifest = await client.latest(app.key);
      if (!valid()) return;
      for (const root of roots) {
        root.querySelector('[data-version]')?.replaceChildren(document.createTextNode(`v${manifest.version}`));
        root.querySelector('[data-notes]')?.replaceChildren(document.createTextNode(manifest.notes));
        root.querySelector('[data-status]')?.replaceChildren(document.createTextNode('Versión disponible para tu cuenta.'));
        root.querySelector('[data-date]')?.replaceChildren(document.createTextNode(new Date(manifest.releasedAt).toLocaleDateString('es')));
        for (const button of root.querySelectorAll('[data-download]')) {
          const asset = manifest.assets.find(item => item.id === manifest.recommendations[button.dataset.download]);
          if (!asset) continue;
          button.setAttribute('aria-disabled', 'false'); button.tabIndex = 0;
          button.querySelector('[data-size]')?.replaceChildren(document.createTextNode(`· ${(asset.size / 1024 ** 2).toFixed(1)} MB`));
          let busy = false;
          const download = async event => {
            event.preventDefault();
            if (busy || !valid()) return;
            busy = true; button.setAttribute('aria-busy', 'true');
            try {
              const response = await client.download(app.key, manifest.version, asset.id);
              if (valid()) navigate(response.url);
            } catch (error) { if (valid()) await failure(error, roots); }
            finally { busy = false; button.removeAttribute('aria-busy'); }
          };
          button.addEventListener('click', download);
          button.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') void download(event);
          });
        }
      }
    } catch (error) { if (valid()) await failure(error, roots); }
  }));
}

export async function initPublicVersions({ document, apps, user, valid = () => true, fetchImpl = fetch }) {
  const client = createReleaseClient({ user, fetchImpl });
  const allowed = new Set(apps.map(app => app.id));
  for (const root of document.querySelectorAll('[data-app]')) {
    if (!allowed.has(root.dataset.app)) root.querySelector('[data-status]')?.replaceChildren(
      document.createTextNode('Tu cuenta no tiene acceso a esta descarga.'));
  }
  await Promise.all(apps.map(async app => {
    const roots = [...document.querySelectorAll(`[data-app="${app.id}"]`)];
    try {
      const release = await client.latest(app.key);
      if (!valid()) return;
      for (const root of roots) {
        root.querySelector('[data-version]')?.replaceChildren(document.createTextNode(`v${release.version}`));
        root.querySelector('[data-notes]')?.replaceChildren(document.createTextNode(release.notes));
        root.querySelector('[data-status]')?.replaceChildren(document.createTextNode('Descarga privada disponible para tu cuenta.'));
        root.querySelector('[data-date]')?.replaceChildren(document.createTextNode(new Date(release.releasedAt).toLocaleDateString('es')));
        for (const button of root.querySelectorAll('[data-download]')) {
          const asset = release.assets.find(a => a.id === release.recommendations[button.dataset.download]);
          if (asset) button.querySelector('[data-size]')?.replaceChildren(document.createTextNode(`· ${(asset.size / 1024 ** 2).toFixed(1)} MB`));
        }
      }
    } catch {
      if (valid()) for (const root of roots) root.querySelector('[data-status]')?.replaceChildren(
        document.createTextNode('No pudimos consultar la versión. La descarga volverá a verificar tu acceso.'));
    }
  }));
}

if (typeof document !== 'undefined') {
  initMotion();
  initExperience();
  for (const button of document.querySelectorAll('[data-refresh]')) button.addEventListener('click', () => window.location.reload());
  document.getElementById('year').textContent = String(new Date().getFullYear());
  connectPortal().then(auth => {
    const gate = initPortalGate({ document, window, auth, onAuthorized: context =>
      initPublicVersions({ document, ...context }) });
    initDownloadModal({ document, window, auth, getUser: gate.getUser, signOut: gate.signOut });
  }).catch(() => {
    // The public presentation stays available when Auth cannot initialize;
    // stable download routes still fail closed independently.
    document.getElementById('portal-message').textContent = 'No pudimos iniciar la conexión. Recarga para reintentar.';
    document.getElementById('portal-logout').setAttribute('href', '?login=1');
    const login = () => {
      document.getElementById('portal-content').hidden = true;
      document.getElementById('portal-login').hidden = false;
    };
    document.getElementById('portal-logout').addEventListener('click', event => { event.preventDefault(); login(); });
    if (new URL(window.location.href).searchParams.get('login') === '1') login();
    document.getElementById('portal-retry').addEventListener('click', () => window.location.reload());
  });
}
