-- ============================================================
-- Mesón Cafetería de Eiffel — Recordatorio 24h antes (extensiones)
-- ------------------------------------------------------------
-- Habilita pg_cron (programar tareas periódicas) y pg_net (hacer
-- peticiones HTTP desde SQL), necesarias para que un Cron Job llame
-- cada hora a la edge function recordatorio-reserva.
--
-- El propio "cron.schedule(...)" que programa la llamada NO está en
-- esta migración a propósito: lleva el secret CRON_SECRET en texto y
-- ese valor no debe quedar guardado en el repositorio. Se ejecuta una
-- sola vez a mano desde el SQL Editor — ver el paso 3 de
-- supabase/functions/recordatorio-reserva/README.md.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
