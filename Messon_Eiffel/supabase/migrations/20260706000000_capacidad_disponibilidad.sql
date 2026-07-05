-- ============================================================
-- Mesón Cafetería de Eiffel — Disponibilidad por franja horaria
-- Migración: tabla de capacidad + funciones de disponibilidad
--
-- Por qué existe esto:
-- La tabla `reservas` está protegida por RLS (solo admin puede
-- hacer SELECT) para no exponer nombres/teléfonos de clientes.
-- Pero el calendario público necesita saber "cuántas mesas quedan
-- libres" por día/hora sin ver esos datos personales. Estas
-- funciones SECURITY DEFINER exponen SOLO conteos agregados.
-- ============================================================

-- ── CAPACIDAD POR FRANJA ───────────────────────────────────────
-- Nº de mesas disponibles en cada horario de servicio.
-- Editable desde el SQL Editor o el Table Editor de Supabase sin
-- tocar código: si el aforo cambia, solo hay que actualizar filas.
CREATE TABLE IF NOT EXISTS capacidad_horarios (
  hora           TEXT NOT NULL PRIMARY KEY,
  capacidad_mesas INT NOT NULL DEFAULT 20 CHECK (capacidad_mesas >= 0)
);

INSERT INTO capacidad_horarios (hora, capacidad_mesas) VALUES
  ('08:30', 20), ('09:00', 20), ('09:30', 20), ('10:00', 20),
  ('10:30', 20), ('11:00', 20), ('11:30', 20), ('12:00', 20),
  ('13:00', 20), ('13:30', 20), ('14:00', 20), ('14:30', 20),
  ('15:00', 20), ('15:30', 20),
  ('20:00', 20), ('20:30', 20), ('21:00', 20), ('21:30', 20),
  ('22:00', 20), ('22:30', 20)
ON CONFLICT (hora) DO NOTHING;

ALTER TABLE capacidad_horarios ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede LEER la capacidad configurada (no es dato sensible)
CREATE POLICY "public_select_capacidad"
  ON capacidad_horarios
  FOR SELECT
  USING (true);

-- Solo el admin autenticado puede modificar el aforo
CREATE POLICY "admin_update_capacidad"
  ON capacidad_horarios
  FOR UPDATE
  USING     (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);


-- ── DISPONIBILIDAD POR DÍA (para los botones de hora) ─────────
-- Devuelve, para cada franja configurada, cuántas mesas quedan y
-- un "nivel" (alta/media/baja/completo) para pintar los botones.
-- Cuenta solo reservas NO canceladas.
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
  ORDER BY ch.hora;
$$;

GRANT EXECUTE ON FUNCTION disponibilidad_dia(DATE) TO anon, authenticated;


-- ── DISPONIBILIDAD POR MES (para pintar el calendario) ────────
-- Nivel global del día = ocupación agregada de todas las franjas.
CREATE OR REPLACE FUNCTION disponibilidad_mes(p_anio INT, p_mes INT)
RETURNS TABLE (
  fecha DATE,
  nivel TEXT
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
  )
  SELECT
    d.fecha,
    CASE
      WHEN ct.total = 0 THEN 'alta'
      WHEN GREATEST(ct.total - COALESCE(o.ocupadas, 0), 0) = 0 THEN 'completo'
      WHEN GREATEST(ct.total - COALESCE(o.ocupadas, 0), 0)::float / ct.total <= 0.25 THEN 'baja'
      WHEN GREATEST(ct.total - COALESCE(o.ocupadas, 0), 0)::float / ct.total <= 0.6 THEN 'media'
      ELSE 'alta'
    END AS nivel
  FROM dias d
  CROSS JOIN capacidad_total ct
  LEFT JOIN ocupacion o ON o.fecha = d.fecha
  ORDER BY d.fecha;
$$;

GRANT EXECUTE ON FUNCTION disponibilidad_mes(INT, INT) TO anon, authenticated;


-- ── VALIDACIÓN DE CUPO EN EL SERVIDOR (evita doble reserva) ────
-- El frontend ya revalida disponibilidad antes de enviar, pero si
-- dos personas confirman la última mesa casi al mismo tiempo, esta
-- función es la que realmente decide: usa un lock por fecha+hora
-- para serializar los INSERT concurrentes de la misma franja.
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

DROP TRIGGER IF EXISTS trg_validar_capacidad ON reservas;
CREATE TRIGGER trg_validar_capacidad
  BEFORE INSERT ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION validar_capacidad_reserva();
