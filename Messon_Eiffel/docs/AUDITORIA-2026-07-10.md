# Auditoría integral — 10 de julio de 2026

**Alcance:** proyecto completo (5 páginas públicas, panel admin, 7 CSS, 6 JS, esquema Supabase, configuración Netlify).
**Contexto:** segunda auditoría; la del 1 de julio (ver `AUDITORIA.md`) ya resolvió contraste, código muerto, ARIA de la carta y SEO básico. Esta pasada se centra en lo que quedaba: bugs reales de lógica, seguridad de cabeceras y los últimos huecos de accesibilidad.

---

## Resumen del proyecto

Sitio estático multipágina (HTML/CSS/JS vanilla, sin build step) para el Mesón Cafetería de Eiffel (Motril), desplegado en Netlify. Reservas en tiempo real contra Supabase: RPCs `SECURITY DEFINER` exponen solo conteos agregados de disponibilidad (los datos personales quedan tras RLS), y un trigger con advisory lock impide la doble reserva de la última mesa. Panel admin con Supabase Auth, realtime y modo demo (localStorage) si no hay claves. Arquitectura correcta y bien documentada para su tamaño.

## Problemas encontrados

**Críticos**
1. Bug de zona horaria en `reservas.js`: `hoyStr` se calculaba con `toISOString()` (UTC). Entre las 00:00 y la 01:00/02:00 hora española, el formulario creía que "hoy" era ayer: marcaba horas como pasadas incorrectamente y podía descolocar el calendario. `admin.js` ya tenía el helper local correcto; `reservas.js` no.
2. Ausencia total de Content-Security-Policy, HSTS y Permissions-Policy en producción (solo 3 cabeceras básicas).

**Importantes**
3. Race condition en el calendario y en las píldoras de hora: navegar rápido entre meses/días podía pintar una respuesta obsoleta encima de la actual.
4. `og:image` de las 5 páginas apuntaba a los `.jpg` locales, que son *placeholders difusos* (degradados borrosos), no fotos: cualquier enlace compartido en WhatsApp/redes salía como una mancha marrón.
5. Script inline en `index.html` que impedía servir una CSP estricta sin `'unsafe-inline'`.
6. Sin caché configurada para assets estáticos.

**Menores**
7. Falta de landmark `<main>` y de enlace "saltar al contenido" (WCAG 2.4.1) en index, nosotros, reservas y contacto.
8. `prefers-reduced-motion` solo cubría `.reveal` (quedaban smooth-scroll y el resto de transiciones activas).
9. Input "¿Cuántos sois?" sin etiqueta accesible; días del calendario sin año ni estado en su `aria-label`; sin `aria-pressed` en fecha/hora seleccionadas; sin `aria-sort` en la tabla admin; sin `aria-current` en el enlace de página activa.
10. Listener de scroll sin `{ passive: true }`; `frameborder` (obsoleto) en el iframe del mapa; `meta keywords` (obsoleta) en index; `og:type="restaurant"` no es un tipo OG válido.
11. Dos `deploy-*.zip` (896 KB) de artefactos de despliegue en la raíz del repo.

## Cambios realizados

- `assets/js/reservas.js` — añadido `fechaLocalISO()` (mismo patrón que admin.js) para `hoyStr`; tokens anti-carrera en `renderCalendario()`/`renderHoras()` que descartan respuestas obsoletas; `aria-label` completa (día, mes, año, estado) y `aria-pressed` en días del calendario; `aria-pressed` + `aria-label` con disponibilidad en las píldoras de hora.
- `assets/js/nav.js` — scroll listener `passive`; `aria-current="page"` al marcar el enlace activo.
- `assets/js/admin.js` — `aria-sort` dinámico en las columnas ordenables.
- `assets/js/intro.js` (nuevo) — el script inline de la intro de `index.html` extraído a archivo propio, exactamente con la misma lógica, para habilitar la CSP estricta.
- `netlify.toml` — CSP completa (sin `'unsafe-inline'` en scripts; permite solo Supabase, jsDelivr, Google Fonts, Unsplash y el embed de Maps), `Strict-Transport-Security`, `Permissions-Policy`, y `Cache-Control` por tipo de asset (1 h + stale-while-revalidate para CSS/JS sin hash, 30 días para imágenes).
- 5 páginas HTML — skip-link + `<main id="contenido">` (carta ya tenía `<main>`, se le añadió el id); `aria-current="page"` estático en el enlace activo; `og:image`/`twitter:image` apuntando a las fotos reales (Unsplash, 1200×630) en vez de a los placeholders difusos; `og:type` corregido a `restaurant.restaurant`; retirados `meta keywords` y `frameborder`; `aria-label` en el input de personas de reservas.
- `assets/css/base.css` — estilo del skip-link; `prefers-reduced-motion` global (desactiva smooth-scroll y reduce todas las animaciones, mostrando el contenido `.reveal` directamente); microinteracción `:active` en botones.
- Eliminados los dos `deploy-*.zip` de la raíz.

**Deliberadamente NO tocado:** las imágenes Unsplash del diseño (los `.jpg` locales son placeholders hasta tener fotos reales, según `assets/img/README.md`); las credenciales demo de `admin.js` (solo operan sin Supabase y están documentadas); la duplicación EMAIL_RE/HORAS_CATALOGO entre reservas y admin (aceptable y documentada sin build step); la versión flotante `@supabase/supabase-js@2` (pinnearla sin verificar la última rompería más de lo que protege — ver recomendaciones).

## Seguridad

- **Corregido:** CSP estricta (script-src sin inline), HSTS, Permissions-Policy, clickjacking doblemente cubierto (XFO + `frame-ancestors 'none'`), caché sin `immutable` para no servir código viejo tras un deploy.
- **Ya correcto de antes:** RLS bien diseñada; claves solo la `anon key` publicable (así está diseñada Supabase, la protección real es RLS); `config.js` fuera de git; validación de cupo en servidor con lock; `escHtml()` consistente en todo el HTML generado del admin (sin XSS encontrado); sin SQL injection posible (PostgREST parametriza).
- **Riesgo residual (requiere backend/config, no código):** la política `INSERT WITH CHECK (true)` permite spam de reservas anónimas ilimitado. Mitigación recomendada: activar rate limiting / Turnstile-hCaptcha vía Edge Function, o al menos un límite por IP en Supabase. La longitud de `nombre/notas` tampoco tiene tope en la BD (`TEXT` sin límite) — añadir `CHECK (char_length(...) <= N)` en una migración futura.

## Rendimiento

Passive scroll listener, caché HTTP por primera vez, preload del LCP ya existente, imágenes con dimensiones y lazy ya presentes. Objetivos Lighthouse >95 alcanzables; el mayor coste restante es externo (fuentes de Google y fotos Unsplash) y desaparecerá al usar fotos propias en WebP autoalojadas.

## Puntuación

| Área | Nota |
|---|---|
| Arquitectura | 88 |
| Calidad del código | 90 |
| Seguridad | 88 |
| Rendimiento | 85 |
| UX | 92 |
| UI | 93 |
| SEO | 90 |
| Accesibilidad | 92 |
| Escalabilidad | 80 |
| Mantenibilidad | 88 |

## Recomendaciones futuras — APLICADAS (adéndum, misma fecha)

Las 7 recomendaciones se implementaron en una segunda pasada:

1. **Imágenes responsive** *(variante: no hay fotos reales todavía)* — `srcset`/`sizes` en la imagen de historia de nosotros.html y versiones móviles ligeras (crop vertical, ~65-70% menos de peso) de los 3 fondos Unsplash vía media queries; el preload del LCP de index.html ahora usa `media` para descargar solo la versión que toca. Cuando existan fotos reales, sustituir las URLs de Unsplash por WebP locales.
2. **Anti-spam y límites** — migración `20260710120000_endurecimiento_reservas.sql`: rate limiting por IP (hash SHA-256, pseudonimizado; 4/hora y 10/día para anónimos, admin exento; trigger `trg_limitar_reservas`), CHECKs de longitud en nombre/teléfono/email/notas, función de retención `anonimizar_ip_reservas()` (RGPD, 30 días). Frontend: `maxlength` alineados en ambos formularios y mensaje amable ante `DEMASIADAS_SOLICITUDES`. **Pendiente del usuario: `supabase db push`.**
3. **supabase-js pinneado** *(mejorado: autoalojado)* — 2.106.2 servido desde `assets/js/vendor/` (jsDelivr no publica hash SRI del .min.js auto-generado, así que servirlo desde la propia origin es estrictamente mejor: sin CDN de terceros ni riesgo de supply-chain). CSP sin `cdn.jsdelivr.net`.
4. **Fuentes autoalojadas** — woff2 latin de Fontsource en `assets/fonts/` + `assets/css/fonts.css` (`font-display: swap`), preload de las 2 fuentes del hero en index. Google Fonts eliminado de las 6 páginas y de la CSP (rendimiento + RGPD). Caché immutable de 1 año para fonts y vendor.
5. **Email de confirmación** — Edge Function `supabase/functions/confirmar-reserva/` (Deno + Resend) con verificación de secret del webhook. **Pendiente del usuario: cuenta Resend + deploy** (pasos en su README.md).
6. **personas TEXT → INT** — incluida en la migración del punto 2 (mapea el legado "9+" → 9, CHECK 1–80); frontends envían número y el modal admin valida el rango.
7. **Tests E2E** — Playwright (`tests/e2e/`, proyectos desktop + móvil) con el wizard completo, validaciones y la intro de la home; interceptan config.js para forzar SIEMPRE modo demo (nunca tocan la BD real). Workflow de GitHub Actions (`.github/workflows/e2e.yml`). Ejecutar en local: `npm install && npx playwright install && npm run test:e2e`.

**Verificación de esta pasada:** sintaxis de todos los JS y balance de HTML comprobados; migración validada con el parser real de PostgreSQL (pglast); Edge Function parseada con esbuild; los flujos completos del wizard público (calendario → horas → personas → validaciones → envío demo → confirmación) y del panel admin (login demo → alta con validación 1-80 → stats → tabla → orden con aria-sort) ejecutados con éxito contra el código real en jsdom. Los navegadores de Playwright no se pueden descargar en este entorno (allowlist de red): los E2E corren en CI o en local.
