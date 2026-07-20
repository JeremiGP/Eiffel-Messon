-- ============================================================
-- Mesón Cafetería de Eiffel — Autogestión de reservas (cliente)
-- ------------------------------------------------------------
-- Hasta ahora, cambiar o cancelar una reserva solo se podía hacer
-- llamando por teléfono (o pidiéndoselo al admin). Esta migración
-- deja que el propio cliente lo haga desde un enlace único que
-- recibe al reservar (pantalla de confirmación + email), sin
-- necesidad de crear una cuenta:
--   · reservas.token_gestion — UUID aleatorio por reserva, es la
--     "contraseña" del enlace (nadie puede adivinarlo ni enumerar
--     reservas ajenas).
--   · reserva_por_token(token)      — consulta de solo lectura.
--   · cancelar_reserva_token(token) — cancela (no se puede deshacer).
--   · modificar_reserva_token(...)  — cambia fecha/hora/personas,
--     reutilizando las MISMAS validaciones que ya protegen el
--     formulario público (miércoles cerrado, cierres temporales,
--     aforo) porque el trigger validar_capacidad_reserva pasa a
--     disparar también en UPDATE, no solo en INSERT.
-- Todo vía funciones SECURITY DEFINER: la tabla `reservas` sigue
-- sin SELECT/UPDATE público directo, solo estas puertas concretas.
-- ============================================================

-- ── TOKEN DE GESTIÓN ───────────────────────────────────────────
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS token_gestion UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE reservas
  ADD CONSTRAINT reservas_token_gestion_key UNIQUE (token_gestion);


-- ── TRIGGER DE VALIDACIÓN: ahora también en UPDATE de fecha/hora ──
-- Misma función que en 20260719020000_cierres_temporales.sql, con
-- dos cambios:
--   1) el conteo de aforo excluye la propia fila cuando es un UPDATE
--      (si no, una reserva ya existente en un horario completo se
--      contaría a sí misma como "una mesa ocupada más" y bloquearía
--      cualquier cambio, incluso uno que no toca fecha/hora real).
--   2) el trigger se registra también para UPDATE OF fecha, hora
--      (antes solo INSERT) — cubre tanto la autogestión del cliente
--      como cualquier cambio de fecha/hora que haga el admin.
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
  WHERE fecha = NEW.fecha AND hora = NEW.hora AND estado <> 'cancelada'
    AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

  IF v_ocupadas >= v_capacidad THEN
    RAISE EXCEPTION 'SIN_DISPONIBILIDAD: no quedan mesas para % a las %', NEW.fecha, NEW.hora
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_capacidad ON reservas;
CREATE TRIGGER trg_validar_capacidad
  BEFORE INSERT OR UPDATE OF fecha, hora ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION validar_capacidad_reserva();


-- ── CONSULTA: ver mi reserva por token ─────────────────────────
-- Solo devuelve lo necesario para que el cliente vea/gestione su
-- reserva; no expone teléfono/email de vuelta (ya los conoce él).
CREATE OR REPLACE FUNCTION reserva_por_token(p_token UUID)
RETURNS TABLE (
  id       UUID,
  nombre   TEXT,
  fecha    DATE,
  hora     TEXT,
  personas INT,
  estado   TEXT,
  notas    TEXT,
  idioma   TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nombre, fecha, hora, personas, estado, notas, idioma
  FROM reservas
  WHERE token_gestion = p_token;
$$;

GRANT EXECUTE ON FUNCTION reserva_por_token(UUID) TO anon, authenticated;


-- ── CANCELAR mi reserva por token ──────────────────────────────
CREATE OR REPLACE FUNCTION cancelar_reserva_token(p_token UUID)
RETURNS TABLE (ok BOOLEAN, mensaje TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     UUID;
  v_estado TEXT;
  v_fecha  DATE;
BEGIN
  SELECT id, estado, fecha INTO v_id, v_estado, v_fecha
  FROM reservas WHERE token_gestion = p_token;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, 'NO_ENCONTRADA'::TEXT;
    RETURN;
  END IF;
  IF v_estado = 'cancelada' THEN
    RETURN QUERY SELECT false, 'YA_CANCELADA'::TEXT;
    RETURN;
  END IF;
  IF v_fecha < CURRENT_DATE THEN
    RETURN QUERY SELECT false, 'FECHA_PASADA'::TEXT;
    RETURN;
  END IF;

  UPDATE reservas SET estado = 'cancelada' WHERE id = v_id;
  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION cancelar_reserva_token(UUID) TO anon, authenticated;


-- ── MODIFICAR (fecha/hora/personas) mi reserva por token ───────
-- Reutiliza el trigger validar_capacidad_reserva (miércoles, cierres
-- temporales, aforo): si el cambio no es válido, el UPDATE de dentro
-- lanza la misma excepción con prefijo (DIA_CERRADO / CERRADO_TEMPORAL
-- / SIN_DISPONIBILIDAD) que ya entiende el frontend, y aquí se
-- devuelve tal cual en `mensaje` para que gestionar.js la traduzca
-- igual que ya hace reservas.js con los mismos códigos.
CREATE OR REPLACE FUNCTION modificar_reserva_token(
  p_token UUID, p_fecha DATE, p_hora TEXT, p_personas INT
)
RETURNS TABLE (ok BOOLEAN, mensaje TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     UUID;
  v_estado TEXT;
  v_fecha  DATE;
BEGIN
  SELECT id, estado, fecha INTO v_id, v_estado, v_fecha
  FROM reservas WHERE token_gestion = p_token;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, 'NO_ENCONTRADA'::TEXT;
    RETURN;
  END IF;
  IF v_estado = 'cancelada' THEN
    RETURN QUERY SELECT false, 'YA_CANCELADA'::TEXT;
    RETURN;
  END IF;
  IF v_fecha < CURRENT_DATE THEN
    RETURN QUERY SELECT false, 'FECHA_PASADA'::TEXT;
    RETURN;
  END IF;
  IF p_personas IS NULL OR p_personas < 1 OR p_personas > 80 THEN
    RETURN QUERY SELECT false, 'PERSONAS_INVALIDAS'::TEXT;
    RETURN;
  END IF;

  BEGIN
    UPDATE reservas
       SET fecha = p_fecha, hora = p_hora, personas = p_personas
     WHERE id = v_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM::TEXT;
    RETURN;
  END;

  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION modificar_reserva_token(UUID, DATE, TEXT, INT) TO anon, authenticated;
