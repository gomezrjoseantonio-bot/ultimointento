# Traspaso para el lanzamiento público de ATLAS

**Última actualización:** 22 de agosto de 2026
**Para:** la persona que se encargue de la "última milla" (publicación) y el propietario del proyecto.

Este documento es la lista de lo que queda pendiente para que ATLAS pueda salir a
producción de cara al público. No es una auditoría del producto: solo recoge los
cabos sueltos de publicación. Se actualiza a medida que aparecen cosas nuevas.

---

## 1. Punto de partida

- Aplicación React (Create React App, `react-scripts` 5.0.1), TypeScript, Tailwind.
- Funciona como **PWA instalable**, con datos en el navegador (IndexedDB).
- Se despliega en **Netlify** (`netlify.toml`), con funciones serverless en `functions/`.
- Hoy vive en `https://ultimointento.netlify.app` y **no está publicada** de cara al público.

---

## 2. Pendiente para publicar

### 2.1 Dominio propio

Hoy no hay dominio propio configurado. Cuando se contrate uno, la URL aparece
escrita en estos sitios y hay que cambiarla en todos:

| Fichero | Qué hay que cambiar |
|---|---|
| `public/index.html` | `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image` |
| `public/robots.txt` | la línea `Sitemap:` |

### 2.2 Falta `sitemap.xml`

`public/robots.txt` anuncia un `sitemap.xml` que **no existe** en el repositorio.
Hoy eso es una URL rota. Hay dos salidas válidas y es una decisión de producto:

- Si va a haber una web pública o landing → crear el `sitemap.xml` con esas páginas.
- Si ATLAS es solo aplicación tras login → quitar la línea `Sitemap:` de `robots.txt`.

### 2.3 Capturas de pantalla del manifest (`screenshots`)

`public/manifest.json` no declara capturas. Es la clave que hace que Chrome y Edge
muestren un diálogo de instalación rico (con carrusel) en lugar de un aviso soso.
Requiere capturas **reales** de la aplicación terminada, por eso está pendiente:

- 2 capturas horizontales (`form_factor: "wide"`, 1280×720)
- 2 capturas verticales (`form_factor: "narrow"`, 390×844)

Se hace al final, cuando las pantallas ya no vayan a cambiar.

### 2.4 Texto comercial: es provisional

El título público, la descripción y la imagen que se ve al compartir el enlace
están puestos con un texto **de relleno** pendiente de decidir:

> "Controla tus inmuebles y tus finanzas | ATLAS"

Aparece en `public/index.html` (título, descripción, Open Graph y Twitter Card),
en `public/manifest.json` y dentro de la imagen `public/og-image.png`. Cuando se
cierre el mensaje real hay que actualizar los tres.

### 2.5 La imagen para compartir usa una tipografía provisional

`public/og-image.png` (1200×630) se generó con **Liberation Sans**, no con las
tipografías de marca del proyecto (Inter / IBM Plex Sans, ver `design-bible/`).
Conviene rehacerla con la tipografía correcta antes de publicar.

### 2.6 Variables de entorno de las funciones serverless

Las funciones de `functions/` dependen de credenciales externas que hay que dar de
alta en el panel de Netlify del entorno de producción. **Los nombres** de las
variables que el código espera (los valores nunca van en el repositorio):

- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- `DOC_AI_PROJECT_ID`, `DOC_AI_LOCATION`, `DOC_AI_PROCESSOR_ID`, `DOC_AI_SA_JSON_B`

Además hay `REACT_APP_*` que activan o desactivan funcionalidades del front
(páginas de desarrollo, telemetría, OCR automático del inbox, dashboard de QA…).
Antes de publicar hay que revisar una por una cuáles deben quedar **apagadas** en
producción.

### 2.7 Aviso en `netlify.toml`

La función `chat` está configurada con un `timeout` de 60 segundos, y el propio
fichero avisa de que eso **requiere un plan de Netlify compatible**; si no, manda
el límite del runtime. Hay que confirmar que el plan contratado lo soporta.

### 2.8 Comprobación de la PWA

Verificar en el sitio ya desplegado, con Chrome → DevTools → Application → Manifest,
que la aplicación es instalable y que no hay iconos rotos. Pasar también Lighthouse.
En este repositorio no se ha podido ejecutar esa comprobación.

### 2.9 Legal y analítica (decisión del propietario)

Sin resolver, y necesarios antes de abrir al público:

- Aviso legal, política de privacidad y condiciones de uso.
- Si se instala analítica (Google Analytics o similar), banner de consentimiento
  conforme al RGPD.
- Al tratarse de datos financieros personales, revisar dónde se almacenan y qué
  se informa al usuario.

### 2.10 Primera ejecución de la tarea de índices oficiales

Hay una tarea programada que actualiza sola el Euríbor, el IPC y el IRAV
(`.github/workflows/actualizar-indices.yml`). **Su primera ejecución hay que
lanzarla a mano** desde la pestaña Actions y leer el registro: los códigos de
serie del INE y del BCE se escribieron sin poder llamar a las APIs reales, y el
registro imprime el nombre de la serie tal como lo devuelve cada organismo, que
es como se confirma que se está descargando lo que se cree.

Mientras eso no se compruebe, el dato descargado no debe darse por bueno.
Detalle completo en `docs/INDICES-automatizacion-v1.md`, apartado 6.

### 2.11 Nota técnica: `react-scripts` está sin mantenimiento

El proyecto usa Create App (`react-scripts` 5.0.1), un empaquetador que ya no
recibe mantenimiento activo. **No impide publicar** y no es urgente, pero quien
recoja el proyecto debe saberlo: a medio plazo lo razonable es migrar a Vite.

---

## 3. Ya resuelto (no hace falta rehacerlo)

Commit `214a8f9`, agosto de 2026, en `public/`:

- Tarjeta al compartir el enlace (Open Graph + Twitter Card) con imagen 1200×630.
  Antes, compartir el enlace mostraba una tarjeta vacía.
- `canonical`, datos estructurados JSON-LD, y título orientado al cliente.
- Metas de iOS y `viewport-fit=cover`: la PWA instalada respeta las zonas seguras
  de la pantalla (notch / Dynamic Island).
- `notranslate`: evita que el navegador traduzca la interfaz y estropee etiquetas
  e importes.
- **Corregido**: `apple-touch-icon` apuntaba a `logo192.png`, un fichero inexistente.
- **Corregido**: el manifest solo tenía un icono PNG (512). Añadidos `icon-192x192.png`
  y `icon-512x512-maskable.png`; los de 192 y el maskable eran SVG, que Chrome no
  admite para instalar la aplicación en Android.
- Añadidos `id` y `lang` al manifest. `id` evita que un cambio futuro de `start_url`
  duplique la aplicación ya instalada en los dispositivos.
- Precache del service worker actualizado y versión de caché subida a `v4`.

---

## 4. Cómo se mantiene este documento

Cada vez que aparezca un cabo suelto de publicación, se añade aquí en lugar de
confiarlo a la memoria. El objetivo es que quien recoja el proyecto pueda empezar
leyendo solo este fichero.
