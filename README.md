# Nexo · portal 1.2.1

Portal de Nexo con el diseño final 1.2.1 recuperado de `rescue/nexo-portal-final` (`c8a310a724ce0100675cff250fecdbc2c84063eb`). Conserva la composición, capturas, galerías y motion originales; integra la vinculación de TV y la infraestructura vigente de `main`.

## Ejecutar

Node.js 22.23.3 validado. Las dependencias npm son únicamente para pruebas; el portal sigue siendo estático.

```powershell
npm ci
npm test
npm run check
npm run build
npm run preview
```

Vista previa: http://127.0.0.1:8080/ . El servidor solo escucha en la máquina local. `Ctrl+C` lo detiene.

## Implementado

- Portada proporcional al viewport en escritorio, con dispositivos de Nova Star, Cartón Lleno y Contrapalabra visibles sin iniciar sesión. Las secciones de producto mantienen su composición aprobada.
- Botones planos, sin contorno ni bisel y radio de 8 px. No hay tarjetas decorativas con bordes alrededor de las secciones.
- Capturas reales del usuario dentro de los dispositivos. Las interfaces no se regeneraron con IA.
- Nova Star: biblioteca, tocadiscos y cabina capturados directamente desde la app instalada el 12 de octubre de 2026, ocultando sólo el nombre de cuenta, sin IA. El teléfono muestra el micrófono realmente conectado por Wi-Fi: sólo se recortaron las barras del sistema, se ocultó el nombre del jugador y se giró 180 grados. El torneo muestra cuatro participantes de demostración y su árbol real, sin cantar ni generar resultados; también se muestra la selección de propuestas. La captura de canto de la portada se conserva.
- Galerías de biblioteca/tocadiscos/cabina/canto/torneo/propuestas/fiesta, bingo 75/90/comprobación/celebración y Contrapalabra inicio/rondas/Archivo verbal. Se pueden ampliar, cerrar con Escape y navegar sus pestañas con teclado.
- Contrapalabra comparte la composición de monitor + teléfono, galería, ampliación y motion; mantiene sus colores y tipografía. Las pantallas de Windows son las capturas reales de la release. El teléfono usa el ejemplo real del control PWA documentado en Fase 1.6, no una captura nueva de la release actual.
- Ejemplos originales PDF de cartones de 75 y 90 bolas, con vistas previas derivadas de esos PDF.
- Parallax por capas sobre pantallas, teléfonos y fondos, con velocidades diferentes y desplazamiento acotado. Entrada progresiva de contenido y flotación suave. En móvil se reduce la amplitud, sin desactivar todo el movimiento.
- Animaciones activas normalmente, sin controles manuales de pausa. Respeta movimiento reducido del sistema y muestra ese estado. No altera el scroll nativo ni desplaza los botones de descarga con el parallax.
- Portada pública con inicio de sesión para descargas y autorización por app. Descargas privadas mediante API Nexo: Windows (instalador EXE), Android y Android TV / Google TV. El micrófono de Nova Star conserva su acceso QR. No hay opciones Web, ZIP ni variantes técnicas públicas en el portal.
- Sin nombre personal visible en los textos del portal. Se cubrió el nombre de cuenta en las capturas de biblioteca y modos de juego.

## Distribución privada

Manuales vigentes: [DEPLOY.md](DEPLOY.md), [RELEASES.md](RELEASES.md),
[OPERATIONS.md](OPERATIONS.md). API, portal y voces están en producción.
Nova actual: 1.0.30+1032; Cartón: 1.0.43+45; ambos repositorios de releases son
privados y conservan releases/tags/assets. Los documentos de migración enlazados
abajo son evidencia histórica de sus fases, no instrucciones pendientes actuales.
[Auditoría final de runtime e histórico](docs/runtime-dependency-audit.md).

[Voces privadas de Cartón Lleno: catálogo independiente, importación,
API y publicación sin recompilar](docs/private-voices.md). El publicador
ofrece `voices:dry-run`, `voices:verify` y `voices:publish`; no modifica
GitHub ni los manifests/latest de las apps. La API de voces está activa; para
reemplazar el catálogo falta aprobar el permiso limitado a ese objeto.

[Arquitectura, contratos, publicación y decisiones antes de deploy](docs/private-release-distribution.md).

La portada es pública: se puede navegar y ver capturas y botones sin iniciar
sesión. El build y el servidor local componen `index.html` con la presentación
versionada en `functions/portal-content.html`; no se incluyen manifests, permisos
ni URLs de descarga firmadas. El backend conserva su respuesta autenticada.
La navbar muestra «Iniciar sesión» o «Cerrar sesión» y el login general vuelve al
portal. Su botón y la marca Nexo adoptan suavemente la paleta de la app visible;
en el área común quedan neutros. Descargas conserva su fondo sin subrayado.
Las versiones y notas se consultan sólo para las apps autorizadas por
`GET /api/v1/portal`; no se monta HTML recibido de la API en la portada pública.

Los botones van a `/download/<app>?platform=windows|phone|tv`. Si falta sesión,
esa página muestra login y conserva la app/plataforma elegidas en la ruta.
Con sesión existente continúa automáticamente. Cada intento vuelve a validar
access en el backend, consulta latest y firma una URL nueva. Sin `platform`,
los QR existentes siguen descargando `phone`. Plataformas desconocidas se
rechazan; no se admite un destino externo ni un redirect arbitrario.
Auth comparte la configuración de pairing; la URL del backend y `/pair` no cambian.

Los repositorios privados `BryanHernz/nova-star-versiones` y
`BryanHernz/carton-lleno-versiones` conservan el histórico, aliases y assets
intactos. Sus snapshots anteriores están en
`tools/legacy-releases.mjs`, fuera del build de Hosting. El portal no usa esos
snapshots ni caché de GitHub para saltarse permisos.

No hay versiones Web ni placeholders. El micrófono companion conserva su sitio
original y se abre desde el QR dentro de Nova Star. No se modificó el PWA.

## Logos

Se conserva el logo de Nova Star incluido en el rescue. `tools/importar-logo.ps1` permite importar el PNG original desde el clon hermano `NovaStar/assets/branding/nova_star_logo.png` cuando está disponible, sustituyendo únicamente ese recurso.

La marca «22» se recortó de la pantalla de inicio enviada por el usuario. No se dibujó un cartón nuevo ni se rediseñaron las cuadrículas. `assets/sources.json` documenta la procedencia y transformaciones de las capturas.

## Descargas autorizadas

Cada botón solicita una URL firmada de cinco minutos mediante el backend.
El ID token sólo viaja en Authorization; ningún token o enlace firmado se guarda
por código propio en localStorage. Ante falta de sesión/acceso/red, falla cerrado.
El bucket privado y las releases oficiales ya están provisionados/importados.
La presentación pública no es un fallback de descarga: no proporciona assets sin autorización.

| Plataforma | Nova Star | Cartón Lleno |
| --- | --- | --- |
| Windows | Instalador EXE | Instalador EXE |
| Android | NovaStar-telefono.apk | CartonLleno-telefono.apk |
| Android TV / Google TV | NovaStar-tele.apk | CartonLleno-tele.apk |

Para publicar artefactos ya compilados: `npm run releases:dry-run -- input.json`,
`npm run releases:verify -- input.json bucket` o, sólo tras aprobación,
`npm run releases:publish -- input.json bucket`. Ver contrato detallado arriba.

## Publicación del portal

`npm run build` genera `_site/` con una lista explícita de archivos públicos, incluyendo `experience.mjs`, `motion.mjs` y todos los archivos de pairing. Copia todos los assets y verifica automáticamente los archivos requeridos, las cuatro capturas principales y la igualdad de cada asset entre origen y build. No copia Functions, scripts de desarrollo, pruebas ni credenciales.

El workflow de `main` ejecuta exclusivamente CI (`npm ci`, pruebas, check y build), sin publicar a GitHub Pages. Firebase conserva el target `portal` asociado a `nexo-hub` y la reescritura `/pair/**` a `/pair.html`. El portal se despliega exclusivamente con `firebase deploy --only hosting:portal --project nova-star-bd0d9`.

## Validación

- Pruebas Node de gate, descargas privadas, publicador, compatibilidad GitHub, movimiento, recursos, branding, build y pairing; pruebas backend de Auth/access, integridad y firma.
- Sintaxis de JavaScript y generación del sitio estático.
- El rescue documenta validación visual en Chromium de 1920 a 320 px. Se conserva su CSS; el motion mantiene sus efectos y accesibilidad, sin controles manuales de pausa.
- Desplazamientos de profundidad distintos comprobados en escritorio y móvil; flotación y cambios en vivo de movimiento reducido. La antigua preferencia de pausa manual ya no desactiva las animaciones.
- Navegación de pestañas, menú móvil, ampliación de imagen y Escape.
- Respuestas de API simuladas como no disponibles: las descargas quedan cerradas sin fallback público.

Las pruebas de pairing usan dobles de Auth/API; no crean ni consumen pairings en producción. La comprobación local y el build no equivalen a un deploy público ni validan la instalación de EXE/APK.

## Enlaces estables de instalación en teléfonos

Las rutas preparadas para QR son `https://nexo-hub.web.app/download/cartonLleno`
y `https://nexo-hub.web.app/download/novaStar`. Reutilizan la apariencia del login
actual y Firebase Auth email/password, sin registro ni autenticación anónima.
Una sesión existente continúa automáticamente; sin sesión se solicita login.

Cada intento consulta `GET /api/v1/portal` con el ID token y comprueba que la app
solicitada esté autorizada. Luego consulta su release `latest`, selecciona
`recommendations.phone`, solicita `POST /api/v1/releases/:app/:version/download/:assetId`
y abre la URL temporal de Storage. Nunca se utiliza GitHub ni se monta el HTML
del catálogo en esta pantalla. Acceso denegado muestra un estado 403; una app
desconocida no tiene rewrite y recibe el 404 de Hosting. La página también
rechaza rutas inválidas antes de inicializar Auth.

La URL firmada no se incorpora al HTML, enlaces, almacenamiento o logs. No se
reutiliza: «Volver a descargar» vuelve a comprobar permisos, latest y firma.
Cerrar sesión invalida las respuestas pendientes. Firebase conserva la sesión
con la misma persistencia del portal; el código no guarda tokens ni contraseñas.

El build incluye esta pantalla y sus módulos. `/pair/**` conserva su rewrite y
su flujo independiente. Las rutas ya están publicadas y el QR de Cartón Lleno
1.0.43 apunta a Nexo. No se necesita Functions para actualizar esta pantalla.

## Vinculación web de TV en Nexo

La pantalla `/pair/:pairingId` usa la identidad NEXO y conserva los colores del portal. El identificador es el valor opaco de 48 caracteres hexadecimales que entrega el backend. La pantalla no crea pairings: solicita el código de seis dígitos de la TV y aprueba el pairing existente.

`pair-config.mjs` contiene la configuración **pública** de Firebase del proyecto existente `nova-star-bd0d9` (obtenida de su configuración pública de Hosting), el dominio Auth `nova-star-bd0d9.firebaseapp.com` y la URL de API `https://api-jfqflryoka-tl.a.run.app`. No contiene secretos. Se carga Firebase Web SDK modular 12.19.0 desde el CDN oficial, sin dependencias de producción de npm.

El único inicio de sesión ofrecido es email/password para cuentas existentes; no hay registro ni autenticación anónima. Firebase Auth restaura y mantiene la sesión mediante IndexedDB, con persistencia de sesión o memoria como respaldo. La aplicación no guarda contraseñas ni ID tokens en localStorage ni los escribe en logs. La contraseña se vacía al enviar el formulario. Para aprobar se obtiene un ID token actualizado y se envía exclusivamente en `Authorization: Bearer …`, junto con `{ "code": "123456" }`, a `POST /api/v1/tv/pairings/:pairingId/approve`. Cerrar sesión devuelve al login y descarta respuestas pendientes.

La pantalla contempla éxito, sesión inválida (401), código incorrecto o falta de acceso (403), enlace inexistente (404), ya aprobado/consumido (409), expirado (410), bloqueo por intentos (429) y errores de red. Solo distingue los errores 403 si recibe los códigos conocidos `incorrect_code` o `app_access_denied`; otros 403 muestran un mensaje neutro. El backend conserva la decisión sobre los permisos de cada app.

`npm run build` copia exclusivamente los archivos públicos a `_site/`. El target
Hosting `portal` apunta a **nexo-hub** y conserva `/pair/** -> /pair.html`.
El Hosting de Nova Star permanece separado. Las pruebas locales de pairing usan
dobles de Auth/API para evitar CORS y escrituras en producción; no enviar
credenciales reales a una vista previa genérica.

### Revisión de escenas del 12 de octubre de 2026

La portada reúne los tres juegos en un monitor compartido que muestra las capturas completas. Los selectores de texto permiten elegir manualmente y los tres teléfonos permanecen juntos bajo la pantalla. Cartón conserva sus cartones originales de 75 y 90 bolas y los PDF: el contorno CSS oculta sólo las esquinas blancas exteriores, sin retocar números ni contenido impreso. Las bases de notebook de la portada y de Cartón se sustituyeron por cuello y pie de monitor.

Contrapalabra muestra una captura real de una partida local de Hueco exacto con Luna, Nico y Sol (nombres predeterminados), junto a Inicio, Rondas y Archivo verbal. Fiesta muestra la primera ronda con cuatro participantes y una propuesta enviada desde el teléfono, sin cantar ni generar puntos. Los nombres personales de Nova se ocultan con la máscara local autorizada; no se recreó ninguna interfaz con IA. La imagen del mando de Contrapalabra sigue siendo la referencia real de Fase 1.6, no una captura nueva de esta versión.

### Portada y galerías compartidas

Los cambios usan un fundido de 600 ms y un contador con barra de tiempo. La portada destaca el teléfono de la app visible y alterna las capturas completas de los tres juegos visibles públicamente, sin cortes ni recortes diagonales. Las galerías de Nova, Cartón y Contrapalabra avanzan cada cuatro segundos mientras su monitor está visible. Las pestañas, anterior/siguiente y el teclado permiten elegir una captura; esa interacción pausa el avance hasta pulsar Reproducir. El avance también se suspende al pasar el puntero, abrir una imagen o cambiar de pestaña. `prefers-reduced-motion` mantiene las galerías en modo manual. El control de galería no modifica el parallax global.

Los fondos del Hub combinan tonos crema, carbón/ámbar y verde, con Manrope original de Nova (licencia OFL incluida), Nunito/Fredoka de Cartón y Atkinson de Contrapalabra. Las tres vinculaciones conservan sus temas propios y el acceso independiente de `/pair`; sólo se ajusta su presentación. La revisión local `/__review/pair-word` permite revisar también Contrapalabra sin crear ni aprobar un pairing real.

La raíz del servidor de revisión visual redirige a /__review/portal: es una demostración sin Firebase ni peticiones a la API. Los campos están deshabilitados y el botón Ver portal de demostración abre los tres juegos de prueba. La autenticación real se comprueba sólo en el dominio oficial; el backend mantiene el rechazo de otros orígenes.

El área común usa una base de grafito con iluminación que cambia suavemente según
la app destacada. El monitor conserva la altura y muestra las capturas completas;
los teléfonos se superponen ligeramente donde hay espacio y sus selectores se
alinean a su base. Las escenas de cada producto se centran junto al texto, con
espacio suficiente para las filas de controles en pantallas angostas.
