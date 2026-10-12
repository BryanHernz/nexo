import { APPS } from '../config.mjs';

// Only the repository-owned presentation template is made public. Release
// manifests, access records and temporary download URLs still come from the API.
export function publicIndex(index, template) {
  let content = template.replace(/<a class="button(?: primary)? header-cta[^>]*>.*?<\/a>/g, '');
  content = content.replace(/<button class="button" id="portal-logout"[^>]*>.*?<\/button>/,
    '<a class="nav-session" id="portal-logout" href="?login=1">Iniciar sesión</a>');
  for (const app of APPS) {
    const region = new RegExp(`(<!-- app:${app.key} -->)([\\s\\S]*?)(<!-- /app:${app.key} -->)`, 'g');
    content = content.replace(region, (_, start, body, end) => start + body.replace(
      /<a ([^>]*data-download="(windows|phone|tv)"[^>]*)>/g,
      (_, attrs, platform) => `<a ${attrs.replace(/ aria-disabled="true"| tabindex="-1"/g, '')} href="/download/${app.key}?platform=${platform}">`) + end);
  }
  content = content.replace(/(<span data-version="">).*?(<\/span>)/g, '$1$2')
    .replace(/(<p[^>]*data-status=""[^>]*>).*?(<\/p>)/g,
      '$1Inicia sesión para descargar con tu cuenta Nexo.$2')
    .replace(' Las versiones web estarán disponibles cuando se publiquen oficialmente.', '')
    .replace('Descubre Nova Star y Cartón Lleno.', 'Descubre Nova Star, Cartón Lleno y Contrapalabra.');
  return index.replace('<section id="portal-login"', '<section hidden id="portal-login"')
    .replace('<div id="portal-content" hidden></div>', `<div id="portal-content">${content}</div>`);
}

export function publicDownloadPage(html, index) {
  // Reuse the approved login's world and icons without any Auth/session data.
  const world = index.match(/<div class="login-world"[\s\S]*?(?=\s*<div class="portal-login-card">)/)?.[0];
  const icons = index.match(/<svg class="symbol-bank"[\s\S]*?<\/svg>/)?.[0];
  if (!world || !icons) throw new Error('Presentación de login ausente');
  return html.replace('<body>', `<body>${icons}`)
    .replace(/(<main class="portal-login"[^>]*>)/, `$1<div class="portal-login-layout">${world.replaceAll('src="assets/', 'src="/assets/')}`)
    .replace('</main>', '</div></main>');
}
