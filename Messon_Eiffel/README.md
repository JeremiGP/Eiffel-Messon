# Mesón Cafetería de Eiffel — Web Oficial

Página web profesional del **Mesón Cafetería de Eiffel** (Motril, Granada), con carta completa, sistema de reservas online y panel de administración.

---

## Estado del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1. Planificación | ✅ Completo | Estructura, tecnologías y diseño definidos |
| 2. Frontend | ✅ Completo | HTML, CSS, JS — carta completa con alérgenos |
| 3. Base de datos | ⏳ Pendiente | Conexión con Supabase |
| 4. Panel admin | ⏳ Pendiente | Gestión de reservas |
| 5. Publicación | ⏳ Pendiente | Deploy en Netlify + dominio |

---

## Estructura del proyecto

```
meson-eiffel/
├── index.html                  ← Página principal
├── README.md
├── .gitignore
│
├── assets/
│   ├── css/
│   │   └── styles.css          ← Todos los estilos
│   ├── js/
│   │   └── main.js             ← JavaScript (tabs, formulario, animaciones)
│   └── img/
│       └── README.md           ← Instrucciones para añadir fotos
│
├── admin/
│   └── index.html              ← Panel de administración (en desarrollo)
│
├── supabase/
│   └── schema.sql              ← Esquema de la base de datos
│
└── docs/
    └── CONTEXTO_PROYECTO.md    ← Contexto completo del proyecto
```

---

## Tecnologías

- **Frontend:** HTML5 / CSS3 / JavaScript (vanilla, sin frameworks)
- **Tipografías:** Cormorant Garamond + Inter (Google Fonts)
- **Iconos:** SVG inline
- **Base de datos:** Supabase (PostgreSQL) — _pendiente de conectar_
- **Hosting:** Netlify o Vercel — _pendiente de configurar_
- **Dominio:** mesoncafeteriadeeiffel.es

---

## Características

- Diseño cálido y rústico (tonos tierra, dorado, crema)
- Carta completa dividida en **Desayunos** y **Comidas**
- Iconos de **alérgenos** por plato (Gluten, Lácteos, Huevos, Pescado, Crustáceos, Moluscos, Frutos secos)
- Animaciones: zoom de entrada en hero, scroll reveal escalonado, hover con línea dorada
- Formulario de reservas online
- Diseño **responsive** (móvil, tablet, escritorio)
- Sin dependencias externas (solo Google Fonts)

---

## Cómo abrir el proyecto localmente

1. Clona el repositorio:
   ```bash
   git clone https://github.com/TU_USUARIO/meson-eiffel.git
   ```
2. Abre `index.html` directamente en el navegador

No necesita servidor local para funcionar (hasta que se conecte Supabase).

---

## Próximos pasos

### Conectar Supabase
1. Crear cuenta en [supabase.com](https://supabase.com)
2. Crear nuevo proyecto
3. Ejecutar `supabase/schema.sql` en el editor SQL de Supabase
4. Añadir las claves en `assets/js/config.js` (no subir a GitHub)
5. Conectar el formulario de `index.html` con la tabla `reservas`

### Publicar en Netlify
1. Conectar el repositorio de GitHub con Netlify
2. Deploy automático en cada push
3. Configurar el dominio `mesoncafeteriadeeiffel.es`

---

## Contacto del negocio

| Campo | Dato |
|-------|------|
| Dirección | C/ Rio Mundo, Local 2 — Motril, Granada |
| Teléfono | 958 87 24 24 |
| Instagram | [@meson_cafeteria_de_eiffel](https://instagram.com/meson_cafeteria_de_eiffel) |
| Web actual | [mesoncafeteriadeeiffel.es](https://mesoncafeteriadeeiffel.es) |

---

*Desarrollado con ayuda de Claude (Anthropic) · 2025*
