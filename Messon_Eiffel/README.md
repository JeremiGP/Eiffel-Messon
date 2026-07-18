# Mesón Cafetería de Eiffel — Web Oficial

Página web profesional del **Mesón Cafetería de Eiffel** (Motril, Granada), con carta completa, sistema de reservas online con disponibilidad en tiempo real y panel de administración.

---

## Estado del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1. Planificación | ✅ Completo | Estructura, tecnologías y diseño definidos |
| 2. Frontend | ✅ Completo | 5 páginas (Home, Nosotros, Carta, Reservas, Contacto) + panel admin |
| 3. Auditoría de calidad | ✅ Completo | Accesibilidad, SEO, performance y limpieza de código (ver `docs/`) |
| 4. Base de datos | ✅ Completo | Supabase conectado: tabla `reservas` con RLS, capacidad por franja, funciones de disponibilidad y triggers de validación en servidor |
| 5. Panel admin | ✅ Completo | Login con Supabase Auth, CRUD de reservas en tiempo real (Realtime), filtros, exportación e impresión |
| 6. Publicación | ✅ Completo | Deploy automático en Netlify con headers de seguridad (CSP estricta) + tests E2E en GitHub Actions |

---

## Horario del restaurante

| Día | Horario |
|-----|---------|
| Jueves a martes | 07:00 – 16:00 y 20:00 – 23:30 |
| Miércoles | Cerrado |

El día de cierre está bloqueado en el calendario de reservas y también se rechaza a nivel de base de datos (trigger `validar_capacidad_reserva`).

---

## Estructura del proyecto

```
Messon_Eiffel/
├── index.html                   ← Home (con datos estructurados Schema.org)
├── _headers                     ← Headers de seguridad (respaldo de netlify.toml)
│
├── pages/
│   ├── nosotros.html
│   ├── carta.html
│   ├── reservas.html
│   └── contacto.html
│
├── admin/
│   └── index.html               ← Panel de administración (Supabase Auth)
│
├── assets/
│   ├── css/                     ← base.css compartido + un CSS por página
│   ├── fonts/                   ← Cormorant Garamond + Inter autoalojadas (woff2)
│   ├── js/
│   │   ├── nav.js               ← Nav + scroll reveal + reset de scroll
│   │   ├── intro.js             ← Overlay de entrada (extraído para CSP sin unsafe-inline)
│   │   ├── carta.js             ← Pestañas de la carta + drawer móvil
│   │   ├── reservas.js          ← Wizard de reservas con disponibilidad real por día/hora
│   │   ├── admin.js             ← Panel admin (Auth + CRUD + Realtime)
│   │   ├── config.example.js    ← Plantilla de claves de Supabase (sí se versiona)
│   │   ├── config.js            ← Claves reales (NO se versiona; en Netlify se genera en el build)
│   │   └── vendor/              ← supabase-js autoalojado
│   └── img/                     ← Imágenes + iconos de alérgenos (SVG)
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260701000000_init_reservas.sql            ← Tabla reservas + RLS
│   │   ├── 20260706000000_capacidad_disponibilidad.sql ← Aforo por franja + funciones de disponibilidad
│   │   ├── 20260710120000_endurecimiento_reservas.sql  ← Límites de longitud, personas y rate limiting
│   │   └── 20260718000000_nuevo_horario.sql            ← Horario actual (07:00 + miércoles cerrado)
│   ├── functions/
│   │   └── confirmar-reserva/   ← Edge Function: email de confirmación al cliente
│   ├── schema.sql               ← Esquema de referencia legible
│   └── queries_test.sql
│
├── docs/                        ← Auditorías y notas internas (no se publican)
├── robots.txt
└── sitemap.xml

(raíz del repo)
├── netlify.toml                 ← Build, CSP y caché
├── playwright.config.js
├── tests/e2e/                   ← Tests de navegación y del wizard de reservas
└── .github/workflows/e2e.yml    ← CI: tests E2E en cada push/PR
```

---

## Tecnologías

- **Frontend:** HTML5 / CSS3 / JavaScript (vanilla, sin frameworks ni build step)
- **Tipografías:** Cormorant Garamond + Inter (autoalojadas, sin CDN de terceros)
- **Base de datos:** Supabase (PostgreSQL) con RLS, funciones `SECURITY DEFINER` y triggers de validación
- **Email:** Edge Function `confirmar-reserva` (Resend) para confirmar reservas
- **Hosting:** Netlify (deploy automático por push, CSP estricta, caché por tipo de asset)
- **Tests:** Playwright (E2E del wizard de reservas) + GitHub Actions
- **Dominio:** mesoncafeteriadeeiffel.es

---

## Características

- Diseño cálido y rústico (tonos tierra, dorado, crema)
- Carta completa dividida en **Desayunos** y **Comidas**, con navegación por pestañas accesible (teclado + ARIA)
- En móvil/tablet (<900px), pantalla de selección de apartados y **drawer lateral** de categorías
- Iconos de **alérgenos** por plato según el Reglamento UE 1169/2011
- Wizard de reservas en 3 pasos con **disponibilidad real por día y franja** (calendario con niveles de ocupación, miércoles bloqueado)
- Validación en servidor: aforo por franja con advisory locks (sin dobles reservas), día de cierre y rate limiting anti-spam
- Panel de administración con login real, agenda del día, filtros, edición, exportación e impresión, actualizado en tiempo real
- Diseño **responsive** sin desbordamiento horizontal y reset de scroll en toda la navegación
- SEO on-page: Open Graph, datos estructurados (Schema.org Restaurant con horario real), `robots.txt` y `sitemap.xml`

---

## Cómo trabajar en local

1. Clona el repositorio y entra en la carpeta.
2. Para la web basta abrir `Messon_Eiffel/index.html` en el navegador. Sin `config.js`, reservas y admin funcionan en **modo demo** (no tocan la base de datos).
3. Para conectar con Supabase en local: copia `assets/js/config.example.js` como `assets/js/config.js` y pon la URL y la `anon key` del proyecto.
4. Tests E2E (siempre corren en modo demo, nunca tocan datos reales):
   ```bash
   npm install
   npm run test:e2e
   ```

---

## Despliegue

- **Netlify** publica `Messon_Eiffel/` en cada push: genera `config.js` desde las variables de entorno `SUPABASE_URL`/`SUPABASE_ANON_KEY` y retira `docs/` y `supabase/` de la copia publicada.
- **GitHub Actions** ejecuta los tests E2E en cada push y PR (Chromium + WebKit).
- Las migraciones de `supabase/migrations/` se aplican vía la integración de Supabase con GitHub (o manualmente en el SQL Editor).

---

## Registro de cambios

### 2026-07-18 — Nuevo horario
- Apertura a las 07:00 (nuevas franjas de desayuno 07:00/07:30/08:00), cierre a las 23:30 y **miércoles cerrado**.
- Miércoles bloqueado en calendario, funciones de disponibilidad y trigger de validación (`DIA_CERRADO`).
- Actualizados JSON-LD, página de contacto, selects del admin y tests E2E.

### 2026-07-05 — Mejoras UX, responsive y contenido
- Reset de scroll global; cada vista empieza siempre arriba.
- Blindaje anti-overflow, foco visible por teclado, mejoras móvil 320–400px.
- Carta en móvil: pantalla de selección de apartados + drawer lateral de categorías.
- Fotos de Unsplash (CDN) en hero/intro/Nosotros; tarjetas Cocina/Sala/Barra locales.

*(Historial completo de auditorías y endurecimiento en `docs/`.)*

---

## Contacto del negocio

| Campo | Dato |
|-------|------|
| Dirección | C/ Rio Mundo, Local 2 — Motril, Granada |
| Teléfono | 958 87 24 24 |
| Instagram | [@meson_cafeteria_de_eiffel](https://instagram.com/meson_cafeteria_de_eiffel) |
| Web | [mesoncafeteriadeeiffel.es](https://mesoncafeteriadeeiffel.es) |

---

*Desarrollado por Aaron Jiménez Martínez · 2025–2026*
