-- ============================================================
-- Mesón Cafetería de Eiffel — Queries de prueba
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- Ejecutar en orden para no romper dependencias entre pasos
-- ============================================================


-- ── 1. VERIFICAR QUE LA TABLA EXISTE ──────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'reservas'
ORDER BY ordinal_position;


-- ── 2. INSERTAR RESERVAS DE PRUEBA ────────────────────────────
INSERT INTO reservas (nombre, telefono, email, fecha, hora, personas, notas, estado)
VALUES
  ('María García',     '612345678', 'maria@email.com',   '2026-07-10', '14:00', '2',  'Sin gluten por favor',            'pendiente'),
  ('Carlos Rodríguez', '698765432', 'carlos@email.com',  '2026-07-10', '21:00', '4',  'Mesa cerca de la ventana',        'confirmada'),
  ('Laura Martínez',   '655444333',  NULL,               '2026-07-11', '14:30', '6',  'Cumpleaños — necesitan tarta',    'pendiente'),
  ('Pedro Sánchez',    '677123456', 'pedro@email.com',   '2026-07-12', '20:30', '2',   NULL,                             'cancelada'),
  ('Ana López',        '611999888', 'ana@email.com',     '2026-07-13', '13:00', '3',  'Alergia a los frutos secos',      'pendiente');


-- ── 3. LEER TODAS LAS RESERVAS ────────────────────────────────
SELECT
  id, nombre, telefono, email,
  fecha, hora, personas, estado, created_at
FROM reservas
ORDER BY created_at DESC;


-- ── 4. FILTRAR POR ESTADO ─────────────────────────────────────
-- Ver solo las pendientes (las que necesitan confirmación)
SELECT id, nombre, telefono, fecha, hora, personas
FROM reservas
WHERE estado = 'pendiente'
ORDER BY fecha ASC, hora ASC;


-- ── 5. FILTRAR POR FECHA (vista del día) ──────────────────────
SELECT id, nombre, telefono, hora, personas, estado
FROM reservas
WHERE fecha = '2026-07-10'
ORDER BY hora ASC;


-- ── 6. BUSCAR POR NOMBRE O TELÉFONO ──────────────────────────
SELECT id, nombre, telefono, fecha, hora, estado
FROM reservas
WHERE nombre   ILIKE '%maría%'
   OR telefono ILIKE '%612%';


-- ── 7. CONTAR RESERVAS POR ESTADO ─────────────────────────────
SELECT
  COUNT(*)                                      AS total,
  COUNT(*) FILTER (WHERE estado = 'pendiente')  AS pendientes,
  COUNT(*) FILTER (WHERE estado = 'confirmada') AS confirmadas,
  COUNT(*) FILTER (WHERE estado = 'cancelada')  AS canceladas
FROM reservas;


-- ── 8. RESERVAS DEL DÍA DE HOY ────────────────────────────────
SELECT id, nombre, telefono, hora, personas, estado
FROM reservas
WHERE fecha = CURRENT_DATE
ORDER BY hora ASC;


-- ── 9. ACTUALIZAR EL ESTADO DE UNA RESERVA ────────────────────
-- Confirmar la reserva de María García
UPDATE reservas
SET   estado = 'confirmada'
WHERE nombre = 'María García'
  AND telefono = '612345678';

-- Verificar el cambio:
SELECT id, nombre, estado FROM reservas WHERE nombre = 'María García';


-- ── 10. ELIMINAR UNA RESERVA ───────────────────────────────────
DELETE FROM reservas
WHERE nombre   = 'Pedro Sánchez'
  AND telefono = '677123456';

-- Verificar que se eliminó:
SELECT nombre, estado FROM reservas ORDER BY fecha;


-- ── 11. LIMPIAR TODOS LOS DATOS DE PRUEBA ─────────────────────
-- PRECAUCIÓN: elimina TODOS los registros de la tabla
-- Descomentar solo si se quiere dejar la tabla vacía y lista para producción
-- TRUNCATE TABLE reservas RESTART IDENTITY;
