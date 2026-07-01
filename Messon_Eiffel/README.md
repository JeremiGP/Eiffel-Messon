# Mesón Cafetería de Eiffel — Web Oficial

Página web profesional del **Mesón Cafetería de Eiffel** (Motril, Granada), con carta completa, sistema de reservas online y panel de administración.

---

## Estado del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1. Planificación | ✅ Completo | Estructura, tecnologías y diseño definidos |
| 2. Frontend | ✅ Completo | 5 páginas (Home, Nosotros, Carta, Reservas, Contacto) + panel admin |
| 3. Auditoría de calidad | ✅ Completo | Accesibilidad, SEO, performance y limpieza de código (ver `docs/AUDITORIA.md`) |
| 4. Base de datos | ⏳ Pendiente | Conexión con Supabase (esquema ya preparado en `supabase/schema.sql`) |
| 5. Panel admin con datos reales | ⏳ Pendiente | Hoy usa `localStorage` de demo — pendiente de sustituir por Supabase |
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
│   │   ├── nav.js               ← Nav + scroll reveal (todas las páginas)
│   │   ├── carta.js             ← Pestañas de la carta (con soporte de teclado/ARIA)
│   │   ├── reservas.js          ← Wizard de reservas (validación de pasos)
│   │   └── admin.js             ← Lógica del panel (demo con localStorage)
│   └── img/
│
├── supabase/
│   ├── schema.sql                ← Esquema + políticas RLS, listo para ejecutar
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
- Iconos de **alérgenos** por plato según el Reglamento UE 1169/2011
- Wizard de reservas en 3 pasos con validación y confirmación
- Panel de administración con listado, filtros, alta/edición/baja de reservas (datos de demo en `localStorage`)
- Diseño **responsive** (móvil, tablet, escritorio)
- SEO on-page: metadatos Open Graph, datos estructurados (Schema.org Restaurant), `robots.txt` y `sitemap.xml`

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

### Conectar Supabase
1. Crear cuenta en [supabase.com](https://supabase.com)
2. Crear nuevo proyecto
3. Ejecutar `supabase/schema.sql` en el editor SQL de Supabase
4. Añadir las claves en `assets/js/config.js` (no subir a Git — añadir a `.gitignore`)
5. Conectar el formulario de `pages/reservas.html` con la tabla `reservas`
6. Sustituir el login y el `localStorage` de `admin/index.html` por Supabase Auth + consultas reales

### Publicar en Netlify/Vercel
1. Conectar el repositorio de GitHub
2. Deploy automático en cada push
3. Configurar el dominio `mesoncafeteriadeeiffel.es`
4. Actualizar las URLs de `robots.txt`, `sitemap.xml` y las etiquetas `og:url`/`canonical` si el dominio final cambia

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
