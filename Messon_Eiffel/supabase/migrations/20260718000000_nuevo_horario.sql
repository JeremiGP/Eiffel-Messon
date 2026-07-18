-- ============================================================
-- Mesón Cafetería de Eiffel — Nuevo horario (julio 2026)
--
-- Cambios de negocio:
--   · Apertura a las 07:00 (antes 08:00) → nuevas franjas de
--     desayuno 07:00, 07:30 y 08:00.
--   · Cierre a las 23:30 (antes 00:00) → la última franja de
--     cena reservable sigue siendo 22:30 (sin cambios).
--   · Miércoles CERRADO → el frontend lo deshabilita en el
--     calendario y, como red de seguridad, aquí se rechaza a
--     nivel de base de datos y las funciones de disponibilidad
--     no devuelven franjas para ese día.
-- ============================================================

-- ── NUEVAS FRANJAS DE DESAYUNO ────────────────────────────────
INSERT INTO capacidad_horarios (hora, capacidad_mesas) VALUES
  ('07:00', 20), ('07:30', 20), ('08:00', 20)
ON CONFLICT (hora) DO NOTHING;


-- ── DISPONIBILIDAD POR DÍA: sin franjas los miércoles ─────────
-- EXTRACT(ISODOW): 1 = lunes … 3 = miércoles … 7 = domingo.
-- Si la fecha cae en miércoles, la función devuelve 0 filas y el
-- frontend no pinta ninguna hora disponible.
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
  ORDER BY ch.hora;
$$;


-- ── VALIDACIÓN EN SERVIDOR: rechazar reservas en miércoles ────
-- Misma función que en 20260706000000, añadiendo el chequeo de
-- día de cierre ANTES del control de aforo.
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
  -- Día de cierre semanal (miércoles): ninguna reserva es válida,
  -- aunque el frontend fallara o alguien llamara a la API a mano.
  IF EXTRACT(ISODOW FROM NEW.fecha) = 3 THEN
    RAISE EXCEPTION 'DIA_CERRADO: el restaurante cierra los miércoles (%)', NEW.fecha
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
