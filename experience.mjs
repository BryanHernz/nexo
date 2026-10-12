import { initMotion } from './motion.mjs';
import { initGalleryCarousel, validScreenshotPath } from './gallery.mjs';
export { validScreenshotPath } from './gallery.mjs';

export function initExperience() {
  if (typeof document === 'undefined') return;
  initMotion();
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  const setMenu = (open, focusFirst = false) => {
    menu?.setAttribute('aria-expanded', String(open));
    menu?.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    nav?.classList.toggle('is-open', open);
    if (open && focusFirst) nav?.querySelector('a[href]')?.focus();
  };
  menu?.addEventListener('click', event => setMenu(menu.getAttribute('aria-expanded') !== 'true', event.detail === 0));
  menu?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setMenu(true, true); }
  });
  nav?.addEventListener('click', event => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header')) setMenu(false);
  });
  document.addEventListener('focusin', event => {
    if (!event.target.closest('.header')) setMenu(false);
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', () => setMenu(false));

  for (const list of document.querySelectorAll('.gallery-controls')) {
    initGalleryCarousel(list);
  }
  const dialog = document.getElementById('image-dialog');
  let opener;
  function closeImage() {
    if (dialog?.open) dialog.close();
    document.body.classList.remove('dialog-open');
    opener?.focus({ preventScroll: true });
  }
  for (const button of document.querySelectorAll('[data-lightbox]')) {
    button.addEventListener('click', () => {
      const source = button.dataset.lightbox;
      if (!dialog || !validScreenshotPath(source)) return;
      opener = button;
      const image = dialog.querySelector('img');
      image.src = source;
      image.alt = button.querySelector('img')?.alt || 'Captura de la aplicación';
      dialog.querySelector('p').textContent = image.alt;
      dialog.showModal();
      document.body.classList.add('dialog-open');
      dialog.querySelector('button').focus();
    });
  }
  dialog?.querySelector('.lightbox-close')?.addEventListener('click', closeImage);
  dialog?.addEventListener('cancel', event => { event.preventDefault(); closeImage(); });
  dialog?.addEventListener('click', event => { if (event.target === dialog) closeImage(); });
  dialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
      setMenu(false); menu.focus();
    }
  });
}
