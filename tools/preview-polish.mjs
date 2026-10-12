// Local visual fixtures only. This server/tool is excluded from Hosting builds.
// No Firebase initialization, real account, API request or signed download.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createPreviewServer } from './serve.mjs';
import { publicIndex } from './public-page.mjs';
const root = new URL('../', import.meta.url);
const assets = createPreviewServer();
const originPort = Number(process.env.PORT || 8088);
const cases = new Set(['login', 'portal', 'pair-nova', 'pair-carton', 'pair-word', 'pair-neutral']);
const phases = new Set(['checking', 'login-required', 'code-entry', 'linking', 'success', 'consumed', 'already-used', 'expired', 'network-error']);
const module = `
import { restrictProducts } from '/portal-gate.mjs';
import { APPS } from '/config.mjs';
import { initExperience } from '/experience.mjs';
import { initMotion } from '/motion.mjs';
const sample = document.body.dataset.review;
if (sample.startsWith('pair-')) {
 const { mountPairPage } = await import('/pair.mjs');
 const phase = document.body.dataset.phase;
 const app = sample === 'pair-nova' ? 'novaStar' : sample === 'pair-carton' ? 'cartonLleno' : sample === 'pair-word' ? 'contrapalabra' : 'unknown';
 const terminal = ['success','consumed','already-used','expired'].includes(phase);
 const state = {app,phase,terminal,authenticated: !['checking','login-required'].includes(phase),busy:['checking','linking'].includes(phase),email:'cuenta@ejemplo.test',message: phase==='success'?'Dispositivo vinculado correctamente. Ya puedes volver a la TV.':phase==='expired'?'El enlace de vinculación expiró. Abre un nuevo QR desde la TV.':phase==='consumed'?'Este dispositivo ya está vinculado. Revisa tu televisor.':phase==='network-error'?'No se pudo confirmar la vinculación. Revisa tu conexión e inténtalo de nuevo.':phase==='checking'?'Cargando dispositivo…':phase==='login-required'?'Inicia sesión para vincular el dispositivo.':phase==='linking'?'Vinculando dispositivo…':'Ingresa el código de 6 dígitos que aparece en la TV.'};
 mountPairPage(document,{subscribe(fn){fn(state);return()=>{};},signIn(){},approve(){},signOut(){}});
} else if (sample === 'portal') {
 document.getElementById('portal-login').hidden=true;
 document.getElementById('portal-content').hidden=false;
 initExperience();initMotion();
 document.getElementById('portal-logout').href='/__review/login';
 // Keep section links inside this local fixture despite its root asset base.
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');if(!link)return;
  const section=document.getElementById(link.getAttribute('href').slice(1));if(!section)return;
  event.preventDefault();history.replaceState(null,'',location.pathname+link.getAttribute('href'));section.scrollIntoView({behavior:'smooth'});
 });
 for(const element of document.querySelectorAll('[data-reveal]')) element.classList.add('is-visible');
 for(const node of document.querySelectorAll('[data-app]')) {
  node.querySelector('[data-version]')?.replaceChildren(document.createTextNode('Vista de diseño'));
  for(const button of node.querySelectorAll('[data-download]')){
   const destination=new URL(button.href);button.href='/__review/login?app='+destination.pathname.split('/').at(-1)+'&platform='+destination.searchParams.get('platform');
  }
 }
} else {
 initMotion();
 document.getElementById('portal-login-form').hidden=false;
 document.getElementById('portal-message').textContent='Vista previa visual. No uses tus credenciales aquí; puedes revisar el portal sin iniciar sesión.';
 for(const control of document.getElementById('portal-login-form').elements)control.disabled=true;
 document.getElementById('portal-retry').hidden=true;
 document.getElementById('portal-back').href='/__review/portal';
 const open = document.createElement('a');open.className='button login-preview-open';open.href='/__review/portal';open.textContent='Ver portal de demostración';
 document.querySelector('.login-actions').append(open);
 document.getElementById('portal-login-form').addEventListener('submit',event=>{event.preventDefault();event.target.elements.password.value='';});
}
document.documentElement.dataset.reviewReady='true';
`;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // This server is a visual fixture, never a local sign-in proxy to production.
  if(url.pathname==='/'){
    res.writeHead(302,{'Location':'/__review/portal','Cache-Control':'no-store'});res.end();return;
  }
  if (url.pathname === '/__review/render.mjs') {
    res.writeHead(200, {'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(module);return;
  }
  if (url.pathname.startsWith('/__review/')) {
    const sample = url.pathname.slice('/__review/'.length);
    if (!cases.has(sample)) { res.writeHead(404);res.end();return; }
    const phase = phases.has(url.searchParams.get('phase')) ? url.searchParams.get('phase') : 'login-required';
    let html = await readFile(new URL(sample.startsWith('pair-') ? 'pair.html' : 'index.html', root), 'utf8');
    html = html.replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/g, '');
    if (sample === 'portal') html = publicIndex(html, await readFile(new URL('functions/portal-content.html',root),'utf8'));
    html = html.replace('<head>', '<head><base href="/">').replace(/<body([^>]*)>/, '<body$1 data-review="'+sample+'" data-phase="'+phase+'">');
    // CSP base-uri stays self, and all fixture code is same-origin.
    html = html.replace('base-uri \'none\'', 'base-uri \'self\'');
    html = html.replace('</body>', '<script type="module" src="/__review/render.mjs"></script></body>');
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;
  }
  assets.emit('request',req,res);
});
server.listen(originPort,'127.0.0.1',()=>console.log('Revisión local (fixtures): http://127.0.0.1:'+originPort+'/__review/login'));
