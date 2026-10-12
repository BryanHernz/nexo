export function validScreenshotPath(value) {
  return typeof value === 'string' && /^assets\/screens\/[a-z0-9-]+\.(webp|png)$/.test(value);
}

const galleries = new WeakMap();
export const GALLERY_INTERVAL_MS = 4000;
export const GALLERY_TRANSITION_MS = 600;

function highlightApp(media, button) {
  const app = button.dataset.product ?? media.closest('[data-app]')?.dataset.app ?? 'nexo';
  media.dataset.activeProduct = app;
  for (const phone of media.querySelectorAll('.hub-controllers [data-product]')) {
    phone.dataset.active = String(phone.dataset.product === app);
  }
}

// Timers run only for an on-screen gallery; manual interaction takes precedence.
export function initGalleryCarousel(list, options = {}) {
  if (galleries.has(list)) return galleries.get(list);
  const document = list.ownerDocument, window = document.defaultView;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const image = document.getElementById(tabs[0]?.getAttribute('aria-controls'));
  if (!image) return () => {};
  const media = list.closest('.product-media') ?? list.parentElement;
  const shared = list.classList.contains('hub-selectors');
  if (tabs.length === 1) {
    if (validScreenshotPath(tabs[0].dataset.image)) {
      image.src = tabs[0].dataset.image; image.alt = tabs[0].dataset.caption;
      tabs[0].setAttribute('aria-selected', 'true'); tabs[0].tabIndex = 0;
      highlightApp(media, tabs[0]);
    }
    return () => {};
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const schedule = options.setTimeout ?? window.setTimeout.bind(window);
  const cancel = options.clearTimeout ?? window.clearTimeout.bind(window);
  const Observer = options.IntersectionObserver ?? window.IntersectionObserver;
  const now = options.now ?? (() => window.performance.now());
  const duration = options.interval ?? GALLERY_INTERVAL_MS;
  let remaining = duration, started = 0, progressAnimation, outgoingAnimation, outgoing, revision = 0;
  let current = Math.max(0, tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true'));
  let visible = !Observer, paused = false, hover = false, timer, disposed = false;
  const removers = [];
  const tintTransitions = new Set();
  const listen = (node, event, fn) => {
    node.addEventListener(event, fn);
    removers.push(() => node.removeEventListener(event, fn));
  };
  const toolbar = document.createElement('div'); toolbar.className = 'gallery-toolbar';
  toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', 'Controles de la galería');
  const counter = document.createElement('span'); counter.className = 'gallery-position';
  const timeline = document.createElement('div'); timeline.className = shared ? 'gallery-countdown' : 'gallery-timeline'; timeline.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span'); timeline.append(fill);
  const iconButton = (button, symbol, label = '') => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', `#i-${symbol}`); svg.append(use);
    button.replaceChildren(svg);
    if (label) { const text = document.createElement('span'); text.textContent = label; button.append(text); }
  };
  const makeButton = (label, text) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'gallery-action'; button.setAttribute('aria-label', label);
    button.setAttribute('aria-controls', image.id); button.textContent = text;
    return button;
  };
  const previous = makeButton('Vista anterior', '‹'); previous.dataset.galleryPrevious = '';
  const next = makeButton('Vista siguiente', '›'); next.dataset.galleryNext = '';
  const toggle = makeButton('Pausar galería', 'Pausar'); toggle.dataset.galleryAutoplay = '';
  iconButton(previous, 'previous'); iconButton(next, 'chevron');
  toolbar.append(counter);
  if (!shared) toolbar.append(timeline);
  toolbar.append(previous, next, toggle); list.before(toolbar);

  function stop(reset = false) {
    if (timer !== undefined) { cancel(timer); remaining = Math.max(1, remaining - (now() - started)); }
    timer = undefined; progressAnimation?.pause();
    toolbar.dataset.running = 'false';
    if (reset) {
      remaining = duration; progressAnimation?.cancel(); progressAnimation = undefined;
      fill.style.width = '100%';
    }
  }
  function render() {
    toggle.disabled = reduced.matches;
    iconButton(toggle, paused || reduced.matches ? 'play' : 'pause', reduced.matches ? 'Manual' : paused ? 'Reproducir' : 'Pausar');
    toggle.setAttribute('aria-label', reduced.matches ? 'Galería manual por movimiento reducido' : paused ? 'Reproducir galería' : 'Pausar galería');
    toggle.setAttribute('aria-pressed', String(!paused && !reduced.matches));
    counter.textContent = `${current + 1} de ${tabs.length} · ${tabs[current].textContent.trim()}`;
    list.dataset.autoplay = reduced.matches ? 'reduced' : paused ? 'paused' : 'on';
  }
  function restart() {
    stop(); render();
    if (disposed || paused || hover || !visible || document.hidden || reduced.matches || document.querySelector('dialog[open]')) return;
    toolbar.dataset.running = 'true'; started = now();
    progressAnimation?.cancel();
    if (fill.animate) progressAnimation = fill.animate([
      { width: `${remaining / duration * 100}%` }, { width: '0%' },
    ], { duration: remaining, fill: 'forwards', easing: 'linear' });
    timer = schedule(() => { timer = undefined; select((current + 1) % tabs.length, false); }, remaining);
  }
  function select(index, manual = true) {
    const button = tabs[index];
    if (!button || !validScreenshotPath(button.dataset.image)) return;
    stop();
    const fadeTint = (node, frames, remove = false) => {
      const animation = node.animate(frames, { duration: GALLERY_TRANSITION_MS, easing: 'ease-in-out', fill: 'forwards' });
      const transition = {node, animation, remove}; tintTransitions.add(transition);
      animation.finished.then(() => {
        if (remove) node.remove(); else animation.cancel();
        tintTransitions.delete(transition);
      }, () => { if (remove) node.remove(); tintTransitions.delete(transition); });
    };
    const switchingTint = shared && timeline.parentElement && timeline.parentElement !== button && !reduced.matches && timeline.animate;
    if (switchingTint) {
      const previous = timeline.cloneNode(true);
      previous.classList.add('gallery-countdown-outgoing');
      previous.firstElementChild.style.width = `${remaining / duration * 100}%`;
      previous.firstElementChild.style.background = window.getComputedStyle(fill).backgroundColor;
      timeline.parentElement.append(previous);
      fadeTint(previous, [{opacity:1},{opacity:0}], true);
    }
    stop(true);
    const run = ++revision;
    outgoingAnimation?.cancel(); outgoing?.remove(); outgoing = undefined;
    if (!reduced.matches && image.animate && validScreenshotPath(image.getAttribute('src')) && image.getAttribute('src') !== button.dataset.image) {
      outgoing = image.cloneNode(false); outgoing.removeAttribute('id'); outgoing.removeAttribute('role');
      outgoing.alt = ''; outgoing.setAttribute('aria-hidden', 'true'); outgoing.classList.add('gallery-outgoing');
      image.parentElement.append(outgoing);
    }
    current = index;
    if (manual) paused = true;
    for (const tab of tabs) {
      tab.setAttribute('aria-selected', String(tab === button));
      tab.tabIndex = tab === button ? 0 : -1;
    }
    if (shared) button.prepend(timeline);
    if (switchingTint) fadeTint(timeline, [{opacity:0},{opacity:1}]);
    image.src = button.dataset.image; image.alt = button.dataset.caption;
    highlightApp(media, button);
    if (outgoing) {
      const snapshot = outgoing;
      Promise.resolve(image.decode?.()).catch(() => {}).then(() => {
        if (disposed || run !== revision || reduced.matches) { snapshot.remove(); return; }
        outgoingAnimation = snapshot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: GALLERY_TRANSITION_MS, easing: 'ease-in-out', fill: 'forwards' });
        outgoingAnimation.finished.then(() => snapshot.remove(), () => snapshot.remove());
      });
    }
    const opener = image.closest('[data-lightbox]');
    if (opener) opener.dataset.lightbox = button.dataset.image;
    counter.setAttribute('aria-live', manual ? 'polite' : 'off');
    restart();
  }
  tabs.forEach((button, index) => {
    listen(button, 'click', () => select(index));
    listen(button, 'keydown', event => {
      const target = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (target === undefined) return;
      event.preventDefault(); select(target); tabs[target].focus();
    });
  });
  listen(previous, 'click', () => select((current + tabs.length - 1) % tabs.length));
  listen(next, 'click', () => select((current + 1) % tabs.length));
  listen(toggle, 'click', () => { paused = !paused; restart(); });
  listen(media, 'mouseenter', () => { hover = true; restart(); });
  listen(media, 'mouseleave', () => { hover = false; restart(); });
  listen(media, 'focusin', event => { if (event.target !== toggle) { paused = true; restart(); } });
  listen(media, 'click', event => { if (event.target.closest('[data-lightbox]')) { paused = true; restart(); } });
  listen(document, 'visibilitychange', restart);
  listen(reduced, 'change', () => {
    if (reduced.matches) { outgoingAnimation?.cancel(); outgoing?.remove(); }
    if (reduced.matches) for (const transition of tintTransitions) {
      transition.animation.cancel(); if (transition.remove) transition.node.remove();
    }
    restart();
  });
  const observer = Observer ? new Observer(entries => {
    visible = entries.some(entry => entry.isIntersecting); restart();
  }, { threshold: .35 }) : null;
  observer?.observe(image.closest('.product-monitor') ?? media);
  const dispose = () => {
    disposed = true; stop(); progressAnimation?.cancel(); outgoingAnimation?.cancel(); outgoing?.remove(); observer?.disconnect();
    for (const transition of tintTransitions) { transition.animation.cancel(); if (transition.remove) transition.node.remove(); }
    tintTransitions.clear();
    for (const remove of removers) remove();
    timeline.remove(); toolbar.remove(); galleries.delete(list);
  };
  galleries.set(list, dispose); select(current, false);
  return dispose;
}
