-- ============================================================
-- Mesón Cafetería de Eiffel — Precios editables desde el admin
-- ------------------------------------------------------------
-- Cada producto de la carta tiene una fila aquí. carta.js lee
-- esta tabla al cargar y sustituye el precio estático del HTML
-- si encuentra un valor (fallback: si falla, se queda el del
-- HTML). El panel admin permite editar precio/precio_media/
-- precio_entera de cada fila. Ver docs/PLAN-PRECIOS-EDITABLES.md
-- ============================================================

CREATE TABLE IF NOT EXISTS precios (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id   TEXT        NOT NULL UNIQUE,
  categoria     TEXT        NOT NULL,
  nombre_ref    TEXT        NOT NULL,
  precio        NUMERIC(6,2)     NULL,
  precio_media  NUMERIC(6,2)     NULL,
  precio_entera NUMERIC(6,2)     NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (precio IS NOT NULL AND precio_media IS NULL AND precio_entera IS NULL)
    OR
    (precio IS NULL AND (precio_media IS NOT NULL OR precio_entera IS NOT NULL))
  )
);

CREATE INDEX IF NOT EXISTS idx_precios_categoria ON precios (categoria);

ALTER TABLE precios ENABLE ROW LEVEL SECURITY;

-- Lectura pública: la carta (sin login) necesita poder leer precios
CREATE POLICY "public_select_precios"
  ON precios
  FOR SELECT
  USING (true);

-- Solo el admin autenticado puede modificar precios
CREATE POLICY "admin_update_precios"
  ON precios
  FOR UPDATE
  USING     (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Sin políticas de INSERT/DELETE a propósito: la tabla se siembra
-- una vez con todos los productos actuales: el admin solo edita
-- precios de filas existentes, nunca crea ni borra productos.

-- ── SEMILLA: precios actuales extraídos de pages/carta.html ────
INSERT INTO precios (producto_id, categoria, nombre_ref, precio, precio_media, precio_entera) VALUES
  ('tostadas-mantequilla-tomate', 'tostadas', 'De mantequilla o tomate', NULL, 1.20, 2.40),
  ('tostadas-sobrasada-pate', 'tostadas', 'De sobrasada o paté', NULL, 1.40, 2.80),
  ('tostadas-mantequilla-mermelada', 'tostadas', 'De mantequilla con mermelada', NULL, 1.40, 2.80),
  ('tostadas-jamonyork-o-queso', 'tostadas', 'De jamón de york o queso', NULL, 1.80, 3.60),
  ('tostadas-jamonyork-y-queso', 'tostadas', 'De jamón de york y queso', NULL, 2.30, 4.60),
  ('tostadas-serrano-o-manchego', 'tostadas', 'De serrano o queso manchego', NULL, 2.40, 4.80),
  ('tostadas-serrano-y-manchego', 'tostadas', 'De serrano y queso manchego', NULL, 3.60, 7.20),
  ('tostadas-atun', 'tostadas', 'De atún', NULL, 2.30, 4.60),
  ('tostadas-atun-aguacate', 'tostadas', 'De atún y aguacate', NULL, 3.30, 6.60),
  ('tostadas-atun-aguacate-queso', 'tostadas', 'De atún, aguacate y queso', NULL, 3.90, 7.80),
  ('tostadas-pavo', 'tostadas', 'De pavo', NULL, 2.00, 4.00),
  ('tostadas-pavo-queso', 'tostadas', 'De pavo y queso', NULL, 2.60, 5.20),
  ('tostadas-jamon-asado', 'tostadas', 'De jamón asado', NULL, 3.00, 6.00),
  ('tostadas-pintxo-tortilla', 'tostadas', 'Pintxo de tortilla de patatas', NULL, NULL, 3.50),
  ('croissants-croissant', 'croissants', 'Croissant', 2.50, NULL, NULL),
  ('croissants-mixto', 'croissants', 'Croissant mixto', 3.00, NULL, NULL),
  ('croissants-york', 'croissants', 'Croissant de york', 3.50, NULL, NULL),
  ('croissants-eiffel', 'croissants', 'Croissant Eiffel', 6.00, NULL, NULL),
  ('suizos-mantequilla', 'suizos', 'Suizo con mantequilla', 2.50, NULL, NULL),
  ('suizos-mixto', 'suizos', 'Suizo mixto', 3.00, NULL, NULL),
  ('suizos-york', 'suizos', 'Suizo de york', 3.50, NULL, NULL),
  ('sandwiches-mixto', 'sandwiches', 'Sándwich mixto', 3.00, NULL, NULL),
  ('sandwiches-atun', 'sandwiches', 'Sándwich de atún', 3.00, NULL, NULL),
  ('crepes-sirope', 'crepes', 'Crepes con sirope', 3.00, NULL, NULL),
  ('crepes-sirope-nata', 'crepes', 'Crepes con sirope y nata', 3.50, NULL, NULL),
  ('crepes-gofre-sirope', 'crepes', 'Gofre con sirope', 3.00, NULL, NULL),
  ('crepes-gofre-sirope-nata', 'crepes', 'Gofre con sirope y nata', 3.50, NULL, NULL),
  ('crepes-tortitas-sirope', 'crepes', 'Tortitas con sirope', 3.00, NULL, NULL),
  ('crepes-tortitas-sirope-nata', 'crepes', 'Tortitas con sirope y nata', 3.50, NULL, NULL),
  ('cafes-solo', 'cafes', 'Café solo', 1.60, NULL, NULL),
  ('cafes-doble', 'cafes', 'Café doble', 2.40, NULL, NULL),
  ('cafes-con-leche', 'cafes', 'Café con leche', 1.60, NULL, NULL),
  ('cafes-bombon', 'cafes', 'Café bombón', 2.00, NULL, NULL),
  ('cafes-capuchino', 'cafes', 'Capuchino de la casa', 4.00, NULL, NULL),
  ('cafes-irlandes', 'cafes', 'Café Irlandés', 5.00, NULL, NULL),
  ('cafes-carajillo-bayleis', 'cafes', 'Carajillo Bayleis', 2.60, NULL, NULL),
  ('cafes-carajillo-bayleis-hielo', 'cafes', 'Carajillo Bayleis en hielo', 3.00, NULL, NULL),
  ('cafes-carajillo-clasico', 'cafes', 'Carajillo (Coñac, Anís o Ron)', 2.20, NULL, NULL),
  ('cafes-batido-chocolate', 'cafes', 'Batido de chocolate', 2.60, NULL, NULL),
  ('cafes-batido-fresa', 'cafes', 'Batido de fresa', 2.60, NULL, NULL),
  ('cafes-batido-vainilla', 'cafes', 'Batido de vainilla', 2.60, NULL, NULL),
  ('cafes-colacao', 'cafes', 'Cola-Cao', 2.30, NULL, NULL),
  ('cafes-zumo-naranja-pequeno', 'cafes', 'Zumo de naranja natural (pequeño)', 2.50, NULL, NULL),
  ('cafes-zumo-naranja-grande', 'cafes', 'Zumo de naranja natural (grande)', 3.00, NULL, NULL),
  ('chocolates-normal', 'chocolates', 'Chocolate normal', 2.50, NULL, NULL),
  ('chocolates-nata', 'chocolates', 'Con nata montada', 3.00, NULL, NULL),
  ('chocolates-blanco', 'chocolates', 'Chocolate blanco', 2.50, NULL, NULL),
  ('chocolates-naranja', 'chocolates', 'Chocolate naranja', 2.50, NULL, NULL),
  ('chocolates-menta', 'chocolates', 'Chocolate menta', 2.50, NULL, NULL),
  ('chocolates-coco', 'chocolates', 'Chocolate coco', 2.50, NULL, NULL),
  ('chocolates-avellana', 'chocolates', 'Chocolate avellana', 2.50, NULL, NULL),
  ('tes-agua', 'tes', 'Té o infusión en agua', 1.80, NULL, NULL),
  ('tes-agua-leche', 'tes', 'Té o infusión en agua y leche', 2.00, NULL, NULL),
  ('tes-leche', 'tes', 'Té o infusión en leche', 2.20, NULL, NULL),
  ('compartimos-jamon-asado', 'compartimos', 'Jamón asado', 15.00, NULL, NULL),
  ('compartimos-tomate-alinao', 'compartimos', 'Tomate aliñao', 12.00, NULL, NULL),
  ('compartimos-ensalada-pollo', 'compartimos', 'Ensalada de pollo crujiente', 15.00, NULL, NULL),
  ('compartimos-pimientos-padron', 'compartimos', 'Pimientos del padrón', 10.00, NULL, NULL),
  ('compartimos-parrillada-verduras', 'compartimos', 'Parrillada de verduras', 15.00, NULL, NULL),
  ('compartimos-alcachofa-xl', 'compartimos', 'Alcachofa XL (unidad)', 8.00, NULL, NULL),
  ('compartimos-jamon-juviles', 'compartimos', 'Jamón Juviles Oro (150 g)', 15.00, NULL, NULL),
  ('compartimos-jamon-iberico-bellota', 'compartimos', 'Jamón ibérico de bellota (150 g)', 24.00, NULL, NULL),
  ('compartimos-tabla-iberica-media', 'compartimos', 'Tabla ibérica media (250 g)', 16.00, NULL, NULL),
  ('compartimos-tabla-iberica-entera', 'compartimos', 'Tabla ibérica entera (400 g)', 28.00, NULL, NULL),
  ('compartimos-provoleta', 'compartimos', 'Nuestra provoleta', 13.00, NULL, NULL),
  ('compartimos-steak-tartar-ternera', 'compartimos', 'Steak tartar de ternera', 26.00, NULL, NULL),
  ('compartimos-steak-tartar-salchichon', 'compartimos', 'Steak tartar de salchichón', 15.00, NULL, NULL),
  ('compartimos-gambas-arrieras', 'compartimos', 'Gambas arrieras', 19.00, NULL, NULL),
  ('compartimos-pulpo-brasa', 'compartimos', 'Pulpo a la brasa', 22.00, NULL, NULL),
  ('compartimos-habas-jamon', 'compartimos', 'Habas con jamón', 15.00, NULL, NULL),
  ('compartimos-croquetas', 'compartimos', 'Esas croquetas', 14.00, NULL, NULL),
  ('compartimos-tiritas-pollo', 'compartimos', 'Tiritas de pollo frito', 12.00, NULL, NULL),
  ('compartimos-albondigas', 'compartimos', 'Que albóndigas', 13.00, NULL, NULL),
  ('compartimos-pollo-curry', 'compartimos', 'Pollo al curry', 12.00, NULL, NULL),
  ('compartimos-pimientos-piquillo', 'compartimos', 'Pimientos del piquillo rellenos', 16.00, NULL, NULL),
  ('huevos-rotos-jamon', 'huevos', 'Huevos rotos con jamón', 15.00, NULL, NULL),
  ('huevos-rotos-picadillo', 'huevos', 'Huevos rotos con picadillo', 15.00, NULL, NULL),
  ('huevos-con-ajos', 'huevos', 'Huevos con ajos', 15.00, NULL, NULL),
  ('huevos-tortilla-betanzos', 'huevos', 'Tortilla estilo Betanzos', 15.00, NULL, NULL),
  ('brasas-pluma-iberico', 'brasas', 'Pluma de cerdo ibérico (350 g)', 23.00, NULL, NULL),
  ('brasas-entrecot', 'brasas', 'Entrecot de ternera (350–400 g)', 24.00, NULL, NULL),
  ('brasas-solomillo', 'brasas', 'Solomillo de ternera (250 g)', 25.00, NULL, NULL),
  ('brasas-chuleton', 'brasas', 'Chuletón de ternera (800 g)', 50.00, NULL, NULL),
  ('brasas-surtido', 'brasas', 'Surtido de brasas (500 g)', 25.00, NULL, NULL),
  ('dulces-tarta-lotus', 'dulces', 'Tarta de queso con crema Lotus', 7.00, NULL, NULL),
  ('dulces-tarta-pistacho', 'dulces', 'Tarta de queso, choco blanco y pistacho', 8.00, NULL, NULL),
  ('dulces-coulant', 'dulces', 'Coulant de chocolate', 6.00, NULL, NULL),
  ('dulces-torrija-clasica', 'dulces', 'Torrija clásica', 7.50, NULL, NULL),
  ('dulces-torrija-nutella', 'dulces', 'Torrija con Nutella', 8.00, NULL, NULL)
ON CONFLICT (producto_id) DO NOTHING;
