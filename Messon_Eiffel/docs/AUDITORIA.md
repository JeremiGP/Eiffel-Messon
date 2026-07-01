# Auditoría completa y mejora profesional — Mesón Cafetería de Eiffel

**Fecha:** 1 de julio de 2026
**Alcance:** proyecto completo (`index.html`, 4 páginas internas, panel admin, CSS, JS, esquema Supabase)

---

## Auditoría realizada

El proyecto es un sitio estático multipágina (HTML/CSS/JS vanilla, sin build step) para un restaurante real, con una carta completa con alérgenos, un wizard de reservas en 3 pasos y un panel de administración. El nivel de diseño de partida ya era notablemente alto: paleta coherente, tipografía cuidada (Cormorant Garamond + Inter), animaciones de scroll-reveal, microinteracciones en botones y un panel admin con estados vacíos, toasts y modales — detalles que muchos sitios de este tamaño no tienen.

Dicho esto, se auditó todo el proyecto sin dar nada por bueno, y aparecieron varios problemas reales: dos archivos JS y una hoja de estilos completos que ya no los usaba nadie (código muerto de una versión anterior), un bug de CSS que rompía el scroll horizontal de la tabla del panel admin, contraste insuficiente (WCAG AA) en varios textos sobre fondo oscuro, texto de 8–9px en la práctica totalidad de las etiquetas del wizard de reservas y del bento de contacto, un patrón de pestañas (carta) sin ningún soporte de teclado ni ARIA, un formulario de reservas que deshabilita la validación nativa (`novalidate`) sin sustituirla por nada accesible, credenciales de administrador embebidas en JavaScript del cliente, y ausencia total de `robots.txt`, `sitemap.xml`, Open Graph completo, favicon y datos estructurados.

Se ha corregido todo lo anterior sin tocar el diseño visual de fondo ni romper ninguna funcionalidad existente. Lo que no se ha podido resolver (por requerir un backend real) queda documentado con todo detalle más abajo.

---

## Cambios realizados

### UI

- Textos de 8–9px en `reservas.css` y `contacto.css` (labels, botones, avisos) subidos a un mínimo de 10–12px sin alterar el resto del layout.
- Corregido el color `#C8B490` (contraste ~2:1 sobre blanco, prácticamente ilegible) usado en los números y etiquetas inactivas del wizard de reservas, sustituido por el gris de marca ya existente (`--gris`, ~6,4:1 de contraste).
- Añadidos mensajes de error visibles bajo cada campo del formulario de reservas (antes solo cambiaba el color del borde 2 segundos y desaparecía).
- Área táctil del botón de menú móvil ampliada a 44×44px (antes ~22×15px).

### UX

- El wizard de reservas ahora explica *qué* falla en cada paso ("Elige una fecha para tu reserva.", "El teléfono debe tener 9 dígitos.", etc.) en vez de solo resaltar el campo en rojo.
- El error desaparece en cuanto el usuario empieza a corregir el campo, no solo tras un timeout fijo.
- Las pestañas de la carta ahora se navegan con las flechas del teclado (patrón ARIA `tablist`/`tab`/`tabpanel` estándar), Home/End incluidos.
- El botón de menú móvil anuncia su estado ("Abrir menú" / "Cerrar menú") y se cierra con `Escape` devolviendo el foco al botón.

### Código

- **Eliminados** `assets/js/main.js` y `assets/js/carta.js` (código muerto de una versión anterior del sitio, ningún HTML los cargaba) y `assets/css/styles.css` (mismo caso).
- Reescrito `assets/js/carta.js` desde cero: la lógica de pestañas que vivía como `<script>` inline dentro de `carta.html` ahora es un archivo propio, con navegación por teclado añadida.
- Consolidados decenas de colores hardcodeados (`#B8833A`, `#1A110A`, `#E8D9C4`, `#6B5C4E`, `#D4A55A`, etc.) en `reservas.css` y `contacto.css` para que usen las variables de `base.css`, igual que ya hacía `carta.css`. Los tonos que no coincidían exactamente con la paleta (`#FAF4E8`, `#C9913F`, `#2A1A0E`) se documentaron como nuevas variables (`--arena-alt`, `--dorado-hover`, `--carbon-cl`) en vez de dejarlos sueltos.
- `README.md` reescrito: reflejaba una estructura de carpetas de una versión anterior del proyecto (un único `styles.css`/`main.js`) que ya no existía.
- Añadido `.gitignore` en la raíz del repo (no existía) — evita subir `.DS_Store` y futuras claves de Supabase.

### Arquitectura

- Separación de responsabilidades reforzada: cero `<script>` inline restantes fuera de `index.html` (el único que queda ahí es el de la animación de entrada, deliberadamente acoplado a esa página).
- Documentado en `README.md` y en comentarios de código que el panel admin y el formulario público son dos piezas independientes hoy (uno no alimenta al otro) — antes no estaba señalado en ningún sitio y podía llevar a confusión.

### Performance

- Precarga (`<link rel="preload">`) de `intro.jpg`, que es la imagen que realmente se pinta primero (LCP) al cargar `index.html` — antes solo se descubría cuando el navegador parseaba el CSS del overlay.
- Añadidos `width`/`height` y `decoding="async"` a las 10 imágenes de `nosotros.html`; 3 de ellas (`equipo-card`) ni siquiera tenían `loading="lazy"` y se cargaban de forma inmediata pese a estar bien abajo en la página.
- Corregido un bug real en `admin.css`: `.table-wrap` declaraba `overflow-x: auto` y, tres líneas después, `overflow: hidden` — el shorthand pisaba la propiedad anterior y anulaba el scroll horizontal de la tabla en pantallas medianas. Ahora usa `overflow-x`/`overflow-y` explícitos.
- Imágenes ya estaban razonablemente optimizadas (68–72 KB en JPG a 1920×1080); no se ha tocado el material gráfico.

### Accesibilidad (WCAG 2.2)

- Contraste de texto corregido en `base.css`, `carta.css` y `nosotros.css`: varios textos en `rgba(255,255,255,0.2–0.4)` sobre fondo `--carbon` no llegaban al 3:1, muy lejos del 4,5:1 exigido para texto normal (calculado: 2,0–3,8:1 según el caso). Subidos a un mínimo de 0,55–0,6 de opacidad (~6–7:1).
- Botón de menú móvil: añadido `aria-expanded`, `aria-controls`, `aria-label` dinámico y área táctil de 44×44px (criterio 2.5.8).
- Pestañas de la carta: patrón ARIA completo (`tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`, `roving tabindex`) + navegación por teclado. Antes eran `<button>` sin ningún semántica de pestaña ni soporte de teclado más allá del foco por Tab.
- Formulario de reservas: como usa `novalidate` (para controlar el flujo por pasos), los errores no tenían ningún equivalente accesible. Ahora cada error añade `aria-invalid`, `aria-describedby` y un texto con `role="alert"` leído por lectores de pantalla.

### Responsive

- Revisados los breakpoints de las 7 hojas de estilo (`base`, `home`, `nosotros`, `carta`, `reservas`, `contacto`, `admin`): cobertura sólida en 1024/900/640-600px según página. Ninguno de los cambios de esta auditoría (colores, variables, tamaños de fuente, atributos ARIA) toca grid/flex/anchos, así que el comportamiento responsive no se ha visto alterado.
- Corregido el bug de `overflow` de la tabla del admin (ver Performance), que sí afectaba directamente al responsive de esa tabla.

### SEO

- Open Graph completo (`og:site_name`, `og:url`, `og:image` + dimensiones, `og:locale`) y Twitter Card en las 5 páginas públicas — antes solo `index.html` tenía 3 etiquetas OG básicas, sin `og:url` ni `og:image`.
- `<link rel="canonical">` en las 5 páginas.
- Datos estructurados **Schema.org `Restaurant`** en `index.html` (dirección, teléfono, horario, menú, Instagram) — mejora directa la aparición en Google (rich results, Maps, horario en la ficha).
- `robots.txt` (permite todo salvo `/admin/`) y `sitemap.xml` con las 5 páginas — no existían.
- Favicon SVG de marca (monograma "E" en dorado sobre fondo carbón) enlazado en las 5 páginas — no existía ninguno.

### Seguridad

- **Documentado con un aviso destacado** (en `admin.js`, en el `<head>` del panel no hacía falta porque ya tiene `noindex, nofollow`, y en `README.md`) que las credenciales del panel admin (`ADMIN` / `123456789`) están embebidas en el JavaScript del cliente y son visibles para cualquiera que abra el código fuente. **No se ha podido resolver de fondo** porque requiere un backend de autenticación real (Supabase Auth), que hoy no está conectado — ver "Problemas encontrados".
- Revisado el uso de `innerHTML` en `admin.js`: todos los campos con datos del usuario (`nombre`, `teléfono`, `email`, `personas`) pasan por `escHtml()` antes de insertarse en el DOM — no hay XSS ahí.
- Enlaces externos (`target="_blank"`) ya llevaban `rel="noopener"` de forma consistente.

---

## Problemas encontrados

| # | Problema | Estado |
|---|----------|--------|
| 1 | `main.js`, `carta.js` (viejo) y `styles.css` eran código muerto sin usar | ✅ Resuelto (eliminados) |
| 2 | `overflow: hidden` anulaba `overflow-x: auto` en la tabla del admin | ✅ Resuelto |
| 3 | Contraste de texto insuficiente sobre fondo oscuro en varias páginas | ✅ Resuelto |
| 4 | Texto de 8–9px en reservas y contacto | ✅ Resuelto |
| 5 | Color `#C8B490` casi ilegible en el wizard de reservas | ✅ Resuelto |
| 6 | Pestañas de la carta sin ARIA ni teclado | ✅ Resuelto |
| 7 | Errores de formulario solo visibles por color de borde, sin texto ni ARIA | ✅ Resuelto |
| 8 | Botón de menú móvil sin `aria-expanded` y con área táctil <24px | ✅ Resuelto |
| 9 | Colores hardcodeados repetidos en vez de variables CSS | ✅ Resuelto (reservas/contacto); carta.css usa variables locales propias — ver pendientes |
| 10 | Sin `robots.txt`, `sitemap.xml`, favicon, OG completo ni datos estructurados | ✅ Resuelto |
| 11 | `README.md` describía una estructura de carpetas obsoleta | ✅ Resuelto |
| 12 | Sin `.gitignore` en el repo | ✅ Resuelto |
| 13 | **Credenciales de admin hardcodeadas en JS del cliente** | ⚠️ **No resuelto** — requiere backend de auth real (ver abajo) |
| 14 | El formulario público de reservas no persiste datos en ningún sitio (solo simula el envío) y no está conectado al panel admin | ⚠️ **No resuelto** — requiere Supabase (ya estaba marcado como "pendiente" en el proyecto original) |
| 15 | El panel admin guarda todo en `localStorage`: no sincroniza entre dispositivos ni sobrevive a borrar datos del navegador | ⚠️ **No resuelto** — mismo motivo que el #14 |
| 16 | Sin tests automatizados ni linter configurado | ⚠️ No resuelto (ver mejoras pendientes) |

Los puntos 13–15 son, con diferencia, lo más importante que queda por hacer. No los he "arreglado" con una solución parcial falsa (por ejemplo, conectar el formulario público al `localStorage` del admin) porque eso solo funcionaría si ambas páginas se abren en el mismo navegador, daría una falsa sensación de que el sistema ya es funcional en producción, y no es lo que un usuario esperaría de una reserva real. El propio proyecto ya documentaba esto como "Fase 3 pendiente" antes de empezar esta auditoría.

---

## Mejoras pendientes (recomendadas para una futura versión)

- **Conectar Supabase de verdad**: el esquema (`supabase/schema.sql`) ya está listo, con políticas RLS correctas (inserción pública, lectura/edición/borrado solo autenticado). Falta: crear el proyecto, sustituir el login de `admin.js` por Supabase Auth, y conectar tanto el formulario público como el panel admin a la tabla real.
- **Imágenes responsive** (`srcset`/`sizes` o `<picture>`): hoy todas las páginas sirven la misma imagen de 1920×1080 aunque se muestre en una tarjeta de 270px. El peso actual (68–72 KB) es aceptable, pero en 3G/4G se notaría con variantes más pequeñas.
- **Unificar `carta.css`**: define su propio bloque `:root` con colores que duplican los de `base.css` (`--carta-sidebar-bg: #1A110A` en vez de `var(--carbon)`, etc.). Funciona bien, pero son dos fuentes de verdad para el mismo color.
- **Tests**: no hay ningún test automatizado (ni siquiera de humo) para el flujo de reservas o el CRUD del admin. Con JS vanilla sin build, se podría añadir Playwright para un puñado de flujos críticos.
- **Extraer los platos de la carta a datos** (JSON + plantilla) en vez de HTML repetido a mano: `carta.html` tiene más de 900 líneas, gran parte de ellas son tarjetas de plato casi idénticas. Cambiar un precio hoy implica editar HTML a mano; con una fuente de datos sería mucho más mantenible a medida que la carta crezca. No se ha hecho en esta auditoría porque implica introducir un paso de build o JS de renderizado que cambia la arquitectura del proyecto, y el enunciado pedía no romper nada existente sin necesidad.
- **`config.js` para claves de Supabase**: ya está contemplado en `.gitignore`, pero no existe todavía — créalo cuando se conecte Supabase.

---

## Valoración final

| Área | Nota | Justificación |
|------|------|----------------|
| **Diseño** | 8.5/10 | Paleta, tipografía y microinteracciones de nivel notable para un sitio de este tamaño. Los ajustes de esta auditoría (contraste, tamaños de fuente) eran pulido, no un rediseño. |
| **UX** | 8/10 | Wizard de reservas con buen flujo y confirmación clara; ahora además con errores comprensibles y accesibles. Falta feedback de disponibilidad real (solo simula el envío). |
| **Código** | 7.5/10 | Limpio, bien comentado y sin duplicar lógica salvo casos puntuales. Se eliminó código muerto real y se consolidaron colores. La carta sigue siendo HTML repetitivo a mano. |
| **Arquitectura** | 7/10 | Correcta para un sitio estático de este tamaño (CSS/JS por página, base compartida). El esquema de Supabase está bien diseñado pero no conectado; el admin y el formulario público viven como dos mundos separados hoy. |
| **Rendimiento** | 8/10 | Imágenes ya ligeras, ahora con preload del recurso crítico y dimensiones explícitas. Sin framework ni JS pesado que penalice Core Web Vitals. |
| **Accesibilidad** | 8/10 | Se corrigieron los problemas reales más importantes (contraste, teclado en pestañas, formulario, área táctil). Quedaría una pasada con lector de pantalla real y una auditoría axe-core completa antes de un lanzamiento formal. |
| **Escalabilidad** | 6.5/10 | Válido tal cual para el tamaño actual. Si la carta o el número de páginas crece bastante, el HTML repetitivo y la falta de un paso de build empezarán a notarse. |
| **Mantenibilidad** | 7.5/10 | Mucho mejor que al empezar: sin archivos muertos, colores centralizados en variables, README fiel a la realidad, y un aviso de seguridad que no se puede pasar por alto. La duplicación de paleta en `carta.css`/`admin.css` es lo único que queda suelto. |

---

*Auditoría e implementación realizadas por Claude (Anthropic), 1 de julio de 2026.*
