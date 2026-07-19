# Plan — Precios editables desde el panel admin

**Objetivo:** que el jefe pueda cambiar el precio de cualquier producto de la carta desde el panel admin, y que el cambio se vea en la web al instante, sin tocar código ni volver a desplegar.

**Fuera de alcance (v1):** nombres de platos, descripciones, alérgenos, traducciones y alta/baja de productos. Eso sigue siendo un cambio de código porque implica editar las 3 versiones de idioma a la vez y ocurre muy pocas veces. Solo se hace editable el número del precio.

---

## Por qué ahora mismo un cambio de precio es un problema

El precio de cada producto está escrito directamente en el HTML de `pages/carta.html`, `en/pages/carta.html` y `fr/pages/carta.html`. Cambiar un precio significa: editar 3 archivos, hacer commit, y volver a desplegar a Netlify — el mismo proceso que nos costó una tarde entera arreglar hoy. No es razonable pedirle eso al jefe cada vez que quiera subir 20 céntimos un café.

## Idea general

Los precios se guardan en una tabla de Supabase. `carta.js` los lee al cargar la página y sustituye el número que ya viene en el HTML por el de la base de datos, si existe uno. El panel admin gana una pantalla nueva para editar esa tabla. Si Supabase no responde (caído, sin red), la carta sigue mostrando el precio que quedó grabado en el último despliegue — nunca se queda sin precios.

Los nombres de plato no cambian de tabla ni de idioma; solo el precio, que es el mismo número en las 3 versiones.

---

## 1. Tabla en Supabase

```sql
CREATE TABLE precios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   TEXT UNIQUE NOT NULL,   -- identificador estable, ej. "croissants-mixto"
  categoria     TEXT NOT NULL,          -- clave del apartado (tostadas, croissants, cafes...)
  nombre_ref    TEXT NOT NULL,          -- nombre en español, solo para que el admin sepa qué está editando
  precio        NUMERIC(6,2),           -- precio único (croissants, cafés, platos...)
  precio_media  NUMERIC(6,2),           -- solo tostadas: media unidad
  precio_entera NUMERIC(6,2),           -- solo tostadas: unidad entera
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE precios ENABLE ROW LEVEL SECURITY;

-- cualquiera puede leer precios (los necesita la carta pública)
CREATE POLICY "public_select_precios" ON precios
  FOR SELECT USING (true);

-- solo el admin logueado puede modificar precios
CREATE POLICY "admin_update_precios" ON precios
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
```

Sin política de `INSERT`/`DELETE`: la tabla se siembra una vez con todos los productos actuales (~90 filas) y el admin solo *edita* precios existentes. Añadir o quitar productos de la carta sigue siendo un cambio de código, a propósito — evita que un desliz en el panel borre un producto entero.

Cada producto usa `precio` **o** `precio_media`+`precio_entera`, nunca los tres a la vez — el tipo de fila que le toca depende de si es un producto de la tabla de tostadas o del resto de la carta.

## 2. IDs estables por producto

Cada elemento con precio en el HTML (los 3 tipos: `plato-precio`, `cafe-precio`, y las celdas de precio de la tabla de tostadas) necesita un atributo `data-precio-id="croissants-mixto"` — el mismo valor en las 3 versiones de idioma, porque el precio no cambia con el idioma. Es un cambio puramente estructural, no visual: no toca ni nombres ni descripciones ni traducciones.

Convención de nombres: `{apartado}-{nombre-corto-en-español}` — ej. `tostadas-mantequilla-tomate`, `croissants-eiffel`, `cafes-solo`, `brasas-entrecot`.

## 3. Cambios en `carta.js`

Al cargar la página:

1. `supabase.from('precios').select('*')` — una sola consulta, tabla pública.
2. Se construye un mapa `producto_id → precio(s)`.
3. Por cada elemento `[data-precio-id]` en el DOM, si su ID está en el mapa, se sustituye el texto mostrado (formateado igual que ahora: `12,00 €`). Si no está, se deja el precio estático del HTML tal cual.
4. Si la consulta falla (red, Supabase caído), no se toca nada — la carta se queda con los precios del último despliegue.

Este mismo patrón de "dato en vivo con fallback al HTML estático" es el que ya usa `reservas.js` para la disponibilidad, así que no es una técnica nueva en el proyecto.

## 4. Pantalla nueva en el panel admin

Una pestaña "Precios" junto al dashboard de reservas actual, reutilizando el mismo login de Supabase Auth que ya existe. Contenido:

- Lista de productos agrupada por apartado (mismo orden que la barra lateral de la carta), con buscador por nombre.
- Cada fila: nombre de referencia, precio(s) actual(es) en un campo editable, botón "Guardar" por fila.
- Al guardar: `supabase.from('precios').update({ precio: nuevoValor, updated_at: new Date() }).eq('producto_id', id)`.

Visualmente reutiliza los estilos de tabla que ya existen en `admin.css` para la lista de reservas — no hace falta un diseño nuevo desde cero.

## 5. Pasos para implementarlo

1. Migración SQL: crear tabla `precios` + políticas RLS (`supabase/migrations/`).
2. Semilla: un `INSERT` con los ~90 productos y sus precios actuales, generado a partir de `pages/carta.html` (fuente de verdad en español).
3. Añadir `data-precio-id` a los 3 archivos de carta (es/en/fr) — solo atributos, cero cambios visuales.
4. Ampliar `carta.js` con la carga de precios en vivo + sustitución con fallback.
5. Construir la pestaña "Precios" en `admin/index.html` + `admin.js`.
6. Probar de extremo a extremo: cambiar un precio en el admin → recargar la carta en los 3 idiomas → confirmar que se actualiza al instante sin desplegar nada.
7. Explicarle al jefe cómo usarlo (una captura de pantalla o dos bastan).

## Preguntas abiertas antes de empezar

- **Suplementos** (leche especial +0,20 €, pan sin gluten +0,30/+0,50 €, etc.): en v1 los dejaría como texto fijo, no editables — son frases, no precios sueltos, y complicarían el modelo de datos para un caso que cambia poquísimo.
- **Añadir o quitar productos** desde el admin: fuera de alcance en v1, tal y como está planteado arriba. Si más adelante interesa, sería una fase 2 aparte (implica gestionar también las traducciones).

## Tamaño del cambio

Es una tarde de trabajo, no un proyecto grande: la parte más delicada es marcar con cuidado los ~90 `data-precio-id` en los 3 archivos de carta sin romper nada más. El resto (tabla, RLS, pantalla del admin) sigue patrones que ya existen en el proyecto para reservas.
