-- ============================================================
-- Mesón Cafetería de Eiffel — Endurecimiento de `reservas`
-- Migración: límites de longitud + rate limiting anónimo +
--            personas TEXT → INT
--
-- Aplicar con: supabase db push   (o supabase migration up)
--
-- Contexto: la política RLS "public_insert_reserva" permite
-- INSERT anónimo ilimitado (necesario para el formulario público),
-- y las columnas TEXT no tenían tope de longitud. Esta migración
-- acota ambos vectores de abuso sin tocar el flujo normal.
-- ============================================================


-- ── 1 · LÍMITES DE LONGITUD ───────────────────────────────────
-- NOT VALID: no exige revalidar filas históricas, pero sí aplica
-- a todos los INSERT/UPDATE nuevos (que es lo que importa aquí).
ALTER TABLE reservas
  ADD CONSTRAINT reservas_nombre_len
    CHECK (char_length(nombre) <= 160) NOT VALID;
ALTER TABLE reservas
  ADD CONSTRAINT reservas_telefono_len
    CHECK (char_length(telefono) <= 25) NOT VALID;
ALTER TABLE reservas
  ADD CONSTRAINT reservas_email_len
    CHECK (email IS NULL OR char_length(email) <= 254) NOT VALID;
ALTER TABLE reservas
  ADD CONSTRAINT reservas_notas_len
    CHECK (notas IS NULL OR char_length(notas) <= 1000) NOT VALID;


-- ── 2 · personas: TEXT → INT ──────────────────────────────────
-- El valor legado "9+" (de antes de que el formulario pidiera el
-- número exacto) se consolida como 9. Cualquier otro resto no
-- numérico se sanea antes del cambio de tipo.
UPDATE reservas SET personas = '9'
 WHERE personas = '9+';
UPDATE reservas SET personas = NULLIF(regexp_replace(personas, '\D', '', 'g'), '')
 WHERE personas ~ '\D';
UPDATE reservas SET personas = '1'
 WHERE personas IS NULL OR personas = '';

ALTER TABLE reservas
  ALTER COLUMN personas TYPE INT USING personas::int;

ALTER TABLE reservas
  ADD CONSTRAINT reservas_personas_rango
    CHECK (personas BETWEEN 1 AND 80) NOT VALID;


-- ── 3 · RATE LIMITING PARA INSERTS ANÓNIMOS ───────────────────
-- La IP del visitante llega en la cabecera x-forwarded-for que
-- PostgREST expone vía request.headers. Se guarda SOLO un hash
-- SHA-256 (pseudonimizado, RGPD) para poder contar reservas
-- recientes de la misma conexión. El personal autenticado (panel
-- admin) queda exento.
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_reservas_ip_hash
  ON reservas (ip_hash, created_at DESC);

CREATE OR REPLACE FUNCTION limitar_reservas_anonimas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers     JSON;
  v_ip          TEXT;
  v_ultima_hora INT;
  v_ultimo_dia  INT;
BEGIN
  -- El admin autenticado no tiene límite (cargas masivas, teléfono…)
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Sin contexto HTTP (SQL Editor, tests, seeds) → no aplicar límite
  v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  v_ip := trim(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1));
  IF v_ip = '' THEN
    RETURN NEW;
  END IF;

  -- pgcrypto vive en el esquema `extensions` en Supabase: hay que
  -- cualificarlo porque esta función fija search_path = public
  NEW.ip_hash := encode(extensions.digest(v_ip, 'sha256'::text), 'hex');

  SELECT COUNT(*) INTO v_ultima_hora
    FROM reservas
   WHERE ip_hash = NEW.ip_hash
     AND created_at > now() - INTERVAL '1 hour';

  SELECT COUNT(*) INTO v_ultimo_dia
    FROM reservas
   WHERE ip_hash = NEW.ip_hash
     AND created_at > now() - INTERVAL '24 hours';

  -- Umbrales generosos para uso legítimo (una familia reservando
  -- varias mesas) pero que cortan el spam automatizado.
  IF v_ultima_hora >= 4 OR v_ultimo_dia >= 10 THEN
    RAISE EXCEPTION 'DEMASIADAS_SOLICITUDES: límite de reservas alcanzado desde esta conexión'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Los triggers BEFORE se ejecutan en orden alfabético:
-- trg_limitar_reservas corre ANTES que trg_validar_capacidad
-- (primero el corte barato por spam, después el conteo de aforo).
DROP TRIGGER IF EXISTS trg_limitar_reservas ON reservas;
CREATE TRIGGER trg_limitar_reservas
  BEFORE INSERT ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION limitar_reservas_anonimas();


-- ── 4 · RETENCIÓN (RGPD) ──────────────────────────────────────
-- El hash de IP solo sirve para el rate limiting inmediato: esta
-- función lo borra de reservas antiguas. Ejecutar periódicamente
-- (pg_cron: SELECT cron.schedule('anonimizar', '0 4 * * *',
--  'SELECT anonimizar_ip_reservas()');) o a mano de vez en cuando.
CREATE OR REPLACE FUNCTION anonimizar_ip_reservas()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH limpiadas AS (
    UPDATE reservas
       SET ip_hash = NULL
     WHERE ip_hash IS NOT NULL
       AND created_at < now() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT COALESCE(COUNT(*), 0)::int FROM limpiadas;
$$;

-- Solo ejecutable por roles de servicio/admin (no anon)
REVOKE EXECUTE ON FUNCTION anonimizar_ip_reservas() FROM anon;
