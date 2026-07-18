-- ============================================================
-- Mesón Cafetería de Eiffel — Idioma de la reserva
-- ------------------------------------------------------------
-- El sitio ahora tiene versión en español, inglés y francés
-- (ver commit "Sitio multi-idioma"). Guardamos en qué idioma
-- hizo la reserva el cliente para poder enviarle el email de
-- confirmación (Edge Function confirmar-reserva) en su idioma.
-- ============================================================

ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS idioma TEXT NOT NULL DEFAULT 'es'
    CHECK (idioma IN ('es', 'en', 'fr'));

COMMENT ON COLUMN reservas.idioma IS
  'Idioma de la página desde la que se hizo la reserva (es/en/fr). Usado por la Edge Function confirmar-reserva para elegir la plantilla del email.';
