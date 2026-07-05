# Mesón Cafetería de Eiffel — Web Oficial

Página web profesional del **Mesón Cafetería de Eiffel** (Motril, Granada), con carta completa, sistema de reservas online y panel de administración.

---

## Estado del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1. Planificación | ✅ Completo | Estructura, tecnologías y diseño definidos |
| 2. Frontend | ✅ Completo | 5 páginas (Home, Nosotros, Carta, Reservas, Contacto) + panel admin |
| 3. Auditoría de calidad | ✅ Completo | Accesibilidad, SEO, performance y limpieza de código (ver `docs/AUDITORIA.md`) |
| 3b. Mejoras UX/responsive | ✅ Completo | Scroll-to-top global, corrección de overflow móvil, drawer de categorías en carta, teléfono centrado en contacto (ver *Registro de cambios*) |
| 4. Base de datos | ⚙️ Estructura lista | CLI de Supabase inicializada, migración creada (`supabase/migrations/`) e integración con GitHub conectada. Falta rellenar `assets/js/config.js` con las claves reales |
| 5. Panel admin con datos reales | ⚙️ Código listo | `admin.js`/`reservas.js` ya usan Supabase automáticamente en cuanto haya claves reales en `config.js`; sin ellas, siguen funcionando en modo demo (`localStorage`) |
| 6. Publicación | ⏳ Pendiente | Deploy en Netlify/Vercel + dominio |

---

## Estructura del proyecto

```
Messon_Eiffel/
├── index.html                   ← Home
├── README.md
│
├── pages/
│   ├── nosotros.html
│   ├── carta.html
│   ├── reservas.html
│   └── contacto.html
│
├── admin/
│   └── index.html               ← Panel de administración (demo, ver aviso de seguridad)
│
├── assets/
│   ├── css/
│   │   ├── base.css             ← Variables, nav, footer, botones (compartido)
│   │   ├── home.css / nosotros.css / carta.css / reservas.css / contacto.css
│   │   └── admin.css            ← Estilos propios del panel admin
│   ├── js/
│   │   ├── nav.js               ← Nav + scroll reveal + reset de scroll (todas las páginas)
│   │   ├── carta.js             ← Pestañas de la carta (teclado/ARIA) + selector inicial y drawer móvil
│   │   ├── reservas.js          ← Wizard de reservas (usa Supabase si está configurado, si no simula el envío)
│   │   ├── admin.js             ← Lógica del panel (usa Supabase Auth + CRUD si está configurado, si no localStorage de demo)
│   │   ├── config.example.js    ← Plantilla de claves de Supabase (sí se versiona)
│   │   └── config.js            ← Tus claves reales (NO se versiona, créalo copiando config.example.js)
│   └── img/
│
├── supabase/
│   ├── config.toml               ← Configuración de la CLI de Supabase (generado con `supabase init`)
│   ├── migrations/
│   │   └── 20260701000000_init_reservas.sql  ← Migración con la tabla `reservas` + políticas RLS
│   ├── schema.sql                ← Mismo esquema en un único archivo, como referencia legible
│   └── queries_test.sql
│
├── robots.txt
└── sitemap.xml
```

---

## Tecnologías

- **Frontend:** HTML5 / CSS3 / JavaScript (vanilla, sin frameworks ni build step)
- **Tipografías:** Cormorant Garamond + Inter (Google Fonts)
- **Iconos:** SVG inline
- **Base de datos:** Supabase (PostgreSQL) — esquema listo, conexión _pendiente_
- **Hosting:** Netlify o Vercel — _pendiente de configurar_
- **Dominio:** mesoncafeteriadeeiffel.es

---

## Características

- Diseño cálido y rústico (tonos tierra, dorado, crema)
- Carta completa dividida en **Desayunos** y **Comidas**, con navegación por pestañas accesible (teclado + ARIA)
- En móvil/tablet (<900px), la carta se abre con una **pantalla de selección de apartados** (tarjetas animadas) y las categorías viven en un **drawer lateral** que se despliega con una flechita fija a media altura
- Iconos de **alérgenos** por plato según el Reglamento UE 1169/2011
- Wizard de reservas en 3 pasos con validación y confirmación
- Panel de administración con listado, filtros, alta/edición/baja de reservas (datos de demo en `localStorage`)
- Diseño **responsive** (móvil, tablet, escritorio) sin desbordamiento horizontal
- **Reset de scroll** en toda la navegación: cada página/sección/paso empieza siempre arriba
- SEO on-page: metadatos Open Graph, datos estructurados (Schema.org Restaurant), `robots.txt` y `sitemap.xml`

> **Nota sobre imágenes:** el hero de portada, la intro, la cabecera de *Nosotros* y la foto de *Historia* usan fotos de **Unsplash enlazadas desde su CDN** (licencia libre). Para producción se recomienda descargarlas a `assets/img/` y actualizar las rutas. Las tarjetas Cocina/Sala/Barra siguen usando los archivos locales de `assets/img/`.

---

## ⚠️ Aviso importante de seguridad (panel admin)

El panel `/admin` usa **credenciales de demostración embebidas en el JavaScript del cliente**
(`assets/js/admin.js`) y guarda las reservas en `localStorage` del navegador. Esto es
**solo para pruebas/demo** y **no debe usarse en producción**:

- Cualquiera puede ver el usuario/contraseña abriendo el código fuente.
- Los datos no se sincronizan entre dispositivos ni persisten de verdad.
- El formulario público de reservas (`reservas.js`) todavía **no está conectado** a ningún
  almacenamiento real — hoy solo simula el envío.

**Antes de publicar el sitio:** conectar Supabase (esquema ya preparado), sustituir el login
por Supabase Auth, y mover el formulario público y el panel admin a leer/escribir en la
tabla `reservas` real. Ver pasos detallados en `supabase/schema.sql`.

---

## Cómo abrir el proyecto localmente

1. Clona el repositorio:
   ```bash
   git clone https://github.com/TU_USUARIO/meson-eiffel.git
   ```
2. Abre `index.html` directamente en el navegador (no necesita servidor local).

---

## Próximos pasos

### Conectar Supabase (lo único que falta — todo lo demás ya está hecho)
1. Crear cuenta y proyecto en [supabase.com](https://supabase.com) (si aún no existe).
2. La integración con GitHub ya está configurada apuntando al directorio `Messon_Eiffel`; al hacer push a `main` con `Deploy to production` activado, se aplica automáticamente la migración de `supabase/migrations/`.
3. Ir a Project Settings → API y copiar el `Project URL` y la `anon public key`.
4. Copiar `assets/js/config.example.js` como `assets/js/config.js` y pegar ahí esas dos claves (este archivo no se sube a Git).
5. Crear el usuario admin en Authentication → Users → Add user (con email + contraseña reales).
6. Recargar `reservas.html` y `admin/index.html`: en cuanto `config.js` tenga las claves reales, ambos pasan automáticamente de "modo demo" a usar Supabase de verdad — no hace falta tocar más código.

### Publicar en Netlify/Vercel
1. Conectar el repositorio de GitHub
2. Deploy automático en cada push
3. Configurar el dominio `mesoncafeteriadeeiffel.es`
4. Actualizar las URLs de `robots.txt`, `sitemap.xml` y las etiquetas `og:url`/`canonical` si el dominio final cambia

---

## Registro de cambios

### 2026-07-05 — Mejoras UX, responsive y contenido

**Scroll y navegación**
- `nav.js`: reset de scroll global (`scrollRestoration: manual` + `scrollTo(0,0)` al cargar y al volver desde bfcache). Cada vista empieza siempre arriba.
- `index.html`: el botón "Entrar al mesón" resetea el scroll y bloquea el deslizamiento de fondo mientras la intro está visible.
- `carta.js` / `reservas.js`: al cambiar de categoría o de paso, la vista sube al inicio del contenido compensando el nav fijo.

**Responsive / overflow**
- `base.css`: blindaje anti-overflow (`max-width` en html/body/medios, `overflow-wrap`), `line-height` legible, foco visible por teclado, menú móvil con separadores y animación.
- `home.css`: hero con `100svh`, títulos con mínimos aptos para 320–400px, botones del hero con wrap (ancho completo en móvil).
- `carta.css`: la tabla de alérgenos pasa a rejilla fluida en móvil (ya no desborda).
- `contacto.css`: teléfono completamente centrado en todas las resoluciones; hover sutil en las tarjetas.

**Carta en móvil/tablet (<900px)**
- Nueva pantalla inicial de selección de apartados con tarjetas animadas (sale en cada visita).
- Las categorías pasan de tira horizontal a drawer lateral (aspecto de escritorio) con flechita fija a media altura; la flechita solo aparece tras elegir el primer apartado. Se cierra al elegir categoría, tocar fuera o Escape. Anclado `top/bottom` para cubrir siempre el alto completo.

**Contenido**
- `nosotros.html`: eliminada la sección de galería "El espacio / Un rincón de Motril" (y su CSS).
- Quitada la pista "Desliza" del hero de portada.
- Fotos de Unsplash (CDN) para: hero de portada, intro, cabecera de *Nosotros* e imagen de *Historia*. Tarjetas Cocina/Sala/Barra intactas.

---

## Contacto del negocio

| Campo | Dato |
|-------|------|
| Dirección | C/ Rio Mundo, Local 2 — Motril, Granada |
| Teléfono | 958 87 24 24 |
| Instagram | [@meson_cafeteria_de_eiffel](https://instagram.com/meson_cafeteria_de_eiffel) |
| Web actual | [mesoncafeteriadeeiffel.es](https://mesoncafeteriadeeiffel.es) |

---

*Desarrollado con ayuda de Claude (Anthropic) · 2025–2026*
