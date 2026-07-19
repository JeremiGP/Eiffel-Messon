-- ============================================================
-- Mesón Cafetería de Eiffel — Cierres temporales (vacaciones)
-- ------------------------------------------------------------
-- El cierre semanal (miércoles) ya estaba resuelto de forma fija
-- en el código. Esta migración añade cierres de RANGO DE FECHAS
-- configurables desde el admin (ej. "vacaciones de verano, del
-- 1 al 15 de agosto"), sin tocar código:
--   · cierres(fecha_inicio, fecha_fin, motivo) — el admin añade y
--     borra filas desde la pestaña "Cierres".
--   · disponibilidad_dia / disponibilidad_mes excluyen esos rangos,
--     igual que ya excluían los miércoles → el calendario público
--     los pinta como cerrados automáticamente.
--   · El trigger validar_capacidad_reserva rechaza cualquier
--     intento de reserva (público o admin) en esas fechas, como
--     red de seguridad aunque el frontend fallara.
-- Sin política de UPDATE a propósito: para cambiar un cierre se
-- borra y se crea de nuevo (evita casos raros de edición parcial).
-- ============================================================

CREATE TABLE IF NOT EXISTS cierres (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_inicio DATE        NOT NULL,
  fecha_fin    DATE        NOT NULL,
  motivo       TEXT            NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_cierres_rango ON cierres (fecha_inicio, fecha_fin);

ALTER TABLE cierres ENABLE ROW LEVEL SECURITY;

-- Lectura pública: el calendario de reservas (sin login) necesita
-- saber qué días están cerrados
CREATE POLICY "public_select_cierres"
  ON cierres
  FOR SELECT
  USING (true);

-- Solo el admin autenticado puede crear o borrar cierres
CREATE POLICY "admin_insert_cierres"
  ON cierres
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "admin_delete_cierres"
  ON cierres
  FOR DELETE
  USING (auth.uid() IS NOT NULL);


-- ── DISPONIBILIDAD POR DÍA: sin franjas en días de cierre ─────
-- Misma función que en 20260718000000_nuevo_horario.sql, añadiendo
-- el chequeo de cierres temporales junto al de miércoles.
CREATE OR REPLACE FUNCTION disponibilidad_dia(p_fecha DATE)
RETURNS TABLE (
  hora        TEXT,
  capacidad   INT,
  ocupadas    BIGINT,
  disponibles INT,
  nivel       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ch.hora,
    ch.capacidad_mesas AS capacidad,
    COALESCE(r.ocupadas, 0) AS ocupadas,
    GREATEST(ch.capacidad_mesas - COALESCE(r.ocupadas, 0), 0) AS disponibles,
    CASE
      WHEN GREATEST(ch.capacidad_mesas - COALESCE(r.ocupadas, 0), 0) = 0 THEN 'completo'
      WHEN GREATEST(ch.capacidad_mesas - COALESCE(r.ocupadas, 0), 0)::float
           / NULLIF(ch.capacidad_mesas, 0) <= 0.25 THEN 'baja'
      WHEN GREATEST(ch.capacidad_mesas - COALESCE(r.ocupadas, 0), 0)::float
           / NULLIF(ch.capacidad_mesas, 0) <= 0.6 THEN 'media'
      ELSE 'alta'
    END AS nivel
  FROM capacidad_horarios ch
  LEFT JOIN (
    SELECT hora, COUNT(*) AS ocupadas
    FROM reservas
    WHERE fecha = p_fecha AND estado <> 'cancelada'
    GROUP BY hora
  ) r ON r.hora = ch.hora
  WHERE EXTRACT(ISODOW FROM p_fecha) <> 3  -- miércoles: cerrado
    AND NOT EXISTS (
      SELECT 1 FROM cierres c WHERE p_fecha BETWEEN c.fecha_inicio AND c.fecha_fin
    )
  ORDER BY ch.hora;
$$;


-- ── DISPONIBILIDAD POR MES: nueva columna `cerrado` ───────────
-- Antes el calendario detectaba el cierre semanal (miércoles) solo
-- en el frontend (comparando el día de la semana en JS). Ahora la
-- función también informa qué días están cerrados (miércoles O
-- dentro de un rango de `cierres`), para que el frontend pinte
-- ambos casos de la misma forma sin duplicar esa lógica.
-- El tipo de retorno cambia (columna nueva) → hay que DROP antes.
DROP FUNCTION IF EXISTS disponibilidad_mes(INT, INT);

CREATE FUNCTION disponibilidad_mes(p_anio INT, p_mes INT)
RETURNS TABLE (
  fecha   DATE,
  nivel   TEXT,
  cerrado BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dias AS (
    SELECT generate_series(
      make_date(p_anio, p_mes, 1),
      (make_date(p_anio, p_mes, 1) + INTERVAL '1 month - 1 day')::date,
      '1 day'
    )::date AS fecha
  ),
  capacidad_total AS (
    SELECT COALESCE(SUM(capacidad_mesas), 0) AS total FROM capacidad_horarios
  ),
  ocupacion AS (
    SELECT fecha, COUNT(*) AS ocupadas
    FROM reservas
    WHERE estado <> 'cancelada'
      AND fecha >= make_date(p_anio, p_mes, 1)
      AND fecha <  (make_date(p_anio, p_mes, 1) + INTERVAL '1 month')::date
    GROUP BY fecha
  ),
  cierre_por_dia AS (
    SELECT d.fecha,
           (EXTRACT(ISODOW FROM d.fecha) = 3
             OR EXISTS (
               SELECT 1 FROM cierres c WHERE d.fecha BETWEEN c.fecha_inicio AND c.fecha_fin
             )
           ) AS cerrado
    FROM dias d
  )
  SELECT
    d.fecha,
    CASE
      WHEN cp.cerrado THEN 'completo'
      WHEN ct.total = 0 THEN 'alta'
      WHEN GREATEST(ct.total - COALESCE(o.ocupadas, 0), 0) = 0 THEN 'completo'
      WHEN GREATEST(ct.total - COALESCE(o.ocupadas, 0), 0)::float / ct.total <= 0.25 THEN 'baja'
      WHEN GREATEST(ct.total - COALESCE(o.ocupadas, 0), 0)::float / ct.total <= 0.6 THEN 'media'
      ELSE 'alta'
    END AS nivel,
    cp.cerrado
  FROM dias d
  CROSS JOIN capacidad_total ct
  LEFT JOIN ocupacion o ON o.fecha = d.fecha
  LEFT JOIN cierre_por_dia cp ON cp.fecha = d.fecha
  ORDER BY d.fecha;
$$;

GRANT EXECUTE ON FUNCTION disponibilidad_mes(INT, INT) TO anon, authenticated;


-- ── VALIDACIÓN EN SERVIDOR: rechazar reservas en días cerrados ──
-- Misma función que en 20260718000000_nuevo_horario.sql, añadiendo
-- el chequeo de cierres temporales (código CERRADO_TEMPORAL,
-- distinto de DIA_CERRADO para poder dar un mensaje más preciso
-- en el frontend).
CREATE OR REPLACE FUNCTION validar_capacidad_reserva()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacidad INT;
  v_ocupadas  INT;
BEGIN
  -- Día de cierre semanal (miércoles)
  IF EXTRACT(ISODOW FROM NEW.fecha) = 3 THEN
    RAISE EXCEPTION 'DIA_CERRADO: el restaurante cierra los miércoles (%)', NEW.fecha
      USING ERRCODE = 'P0001';
  END IF;

  -- Cierre temporal (vacaciones u otro periodo cerrado desde el admin)
  IF EXISTS (SELECT 1 FROM cierres WHERE NEW.fecha BETWEEN fecha_inicio AND fecha_fin) THEN
    RAISE EXCEPTION 'CERRADO_TEMPORAL: el restaurante permanece cerrado ese día (%)', NEW.fecha
      USING ERRCODE = 'P0001';
  END IF;

  -- Bloqueo consultivo (advisory lock) por fecha+hora: mientras dos
  -- transacciones intenten reservar la misma franja a la vez, la
  -- segunda espera a que la primera termine antes de contar mesas.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.fecha::text || NEW.hora, 0));

  SELECT capacidad_mesas INTO v_capacidad
  FROM capacidad_horarios
  WHERE hora = NEW.hora;

  -- Si la franja no está configurada en capacidad_horarios, no se
  -- bloquea la reserva (evita romper horarios especiales/eventos).
  IF v_capacidad IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_ocupadas
  FROM reservas
  WHERE fecha = NEW.fecha AND hora = NEW.hora AND estado <> 'cancelada';

  IF v_ocupadas >= v_capacidad THEN
    RAISE EXCEPTION 'SIN_DISPONIBILIDAD: no quedan mesas para % a las %', NEW.fecha, NEW.hora
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
