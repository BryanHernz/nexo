import { APPS } from './config.mjs';
import { createReleaseClient } from './private-releases.mjs';
import { appFromDownloadPath, prepareRecommendedDownload } from './download.mjs?v=modal-v1';

export function initDownloadModal({ document, window, auth, getUser, signOut,
  clientFor = user => createReleaseClient({ user }), navigate = url => window.location.assign(url) }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'download-modal';
  dialog.setAttribute('aria-labelledby', 'download-modal-title');
  dialog.setAttribute('aria-describedby', 'download-modal-message');
  dialog.innerHTML = `<button type="button" class="download-modal-close" aria-label="Cerrar descarga">×</button>
    <p class="download-modal-kicker">DESCARGA PRIVADA · NEXO</p>
    <h2 id="download-modal-title"></h2><p class="download-modal-platform"></p>
    <div class="download-modal-status"><span class="download-modal-spinner" aria-hidden="true"></span>
      <p id="download-modal-message" role="status" aria-live="polite"></p></div>
    <div class="download-modal-actions"><button type="button" class="download-modal-retry" hidden>Volver a descargar</button>
      <button type="button" class="download-modal-done">Cerrar</button></div>`;
  document.body.append(dialog);
  const message = dialog.querySelector('#download-modal-message');
  const retry = dialog.querySelector('.download-modal-retry');
  let revision = 0, busy = false, selected = null, opener = null;
  function close() {
    ++revision; busy = false; selected = null;
    if (dialog.open) dialog.close();
    opener?.focus({ preventScroll: true });
  }
  function render(state, text) {
    dialog.dataset.state = state;
    message.textContent = text;
    retry.hidden = !['complete', 'error'].includes(state);
    retry.textContent = state === 'complete' ? 'Volver a descargar' : 'Reintentar';
  }
  async function download() {
    if (busy || !selected) return;
    const user = getUser();
    if (!user || user.isAnonymous) { const path = selected.path; close(); navigate(path); return; }
    const { app, platform, path } = selected, run = ++revision;
    const valid = () => run === revision && dialog.open && getUser() === user;
    busy = true;
    render('verifying', 'Verificando tu acceso…');
    try {
      const prepared = await prepareRecommendedDownload({ client: clientFor(user), app, platform, valid,
        onStage: state => render(state, state === 'verifying' ? 'Verificando tu acceso…' : 'Preparando tu archivo…') });
      if (!prepared || !valid()) return;
      // Hand off to the browser download manager; do not persist the URL or fetch
      // large files into memory merely to display an artificial progress bar.
      navigate(prepared.result.url);
      render('complete', `Descarga solicitada · v${prepared.release.version}. Puedes seguir explorando Nexo. El navegador muestra el progreso del archivo.`);
    } catch (error) {
      if (!valid()) return;
      if (error.status === 401) {
        close(); await signOut(); navigate(path);
      } else if (error.status === 403) {
        render('denied', 'Tu cuenta no tiene acceso a esta aplicación.');
      } else {
        render('error', error.status === 404 ? 'Esta descarga no está disponible.' :
          'No pudimos preparar la descarga. Revisa tu conexión y reintenta.');
      }
    } finally { if (run === revision) busy = false; }
  }
  function click(event) {
    const link = event.target.closest?.('a[data-download]');
    if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const user = getUser();
    if (!user || user.isAnonymous) return; // Keep the stable authenticated login route.
    const url = new URL(link.href, window.location.href);
    const app = appFromDownloadPath(url.pathname), platform = url.searchParams.get('platform') ?? 'phone';
    const product = APPS.find(item => item.key === app);
    if (url.origin !== window.location.origin || !product || !['windows', 'phone', 'tv'].includes(platform)) return;
    event.preventDefault();
    if (busy) return;
    selected = { app, platform, user, path: url.pathname + url.search };
    opener = link;
    dialog.dataset.app = product.id;
    dialog.querySelector('h2').textContent = `Descargar ${product.name}`;
    dialog.querySelector('.download-modal-platform').textContent = platform === 'windows' ? 'Windows' : platform === 'tv' ? 'Android TV / Google TV' : 'Android';
    if (!dialog.open) dialog.showModal();
    void download();
  }
  document.addEventListener('click', click);
  dialog.querySelector('.download-modal-close').addEventListener('click', close);
  dialog.querySelector('.download-modal-done').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { ++revision; busy = false; selected = null; });
  retry.addEventListener('click', () => void download());
  const unsubscribe = auth.subscribe(user => { if (dialog.open && (!user || user.isAnonymous || user !== selected?.user)) close(); }, close);
  return { dialog, close, download, stop: () => { close(); unsubscribe(); document.removeEventListener('click', click); dialog.remove(); } };
}
