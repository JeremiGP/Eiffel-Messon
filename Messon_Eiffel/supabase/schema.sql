-- ============================================================
-- Mesón Cafetería de Eiffel — Esquema de base de datos
-- Plataforma: Supabase (PostgreSQL 14+)
--
-- NOTA: este archivo se conserva como referencia legible.
-- El origen de verdad que se despliega automáticamente es
-- supabase/migrations/20260701000000_init_reservas.sql
-- (mismo contenido, formato de migración de la CLI de Supabase).
-- ============================================================

-- Habilitar extensión pgcrypto (gen_random_uuid() nativo en PG 13+;
-- se declara por compatibilidad con entornos más antiguos)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ── TABLA PRINCIPAL DE RESERVAS ────────────────────────────────
CREATE TABLE IF NOT EXISTS reservas (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT        NOT NULL CHECK (char_length(trim(nombre))   > 0),
  telefono   TEXT        NOT NULL CHECK (char_length(trim(telefono)) > 0),
  email      TEXT            NULL CHECK (email IS NULL OR email LIKE '%@%'),
  fecha      DATE        NOT NULL,
  hora       TEXT        NOT NULL,
  personas   TEXT        NOT NULL,
  notas      TEXT            NULL,
  estado     TEXT        NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente', 'confirmada', 'cancelada')),
  idioma     TEXT        NOT NULL DEFAULT 'es'
                         CHECK (idioma IN ('es', 'en', 'fr')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── ÍNDICES ────────────────────────────────────────────────────
-- Búsquedas frecuentes por fecha y por estado
CREATE INDEX IF NOT EXISTS idx_reservas_fecha   ON reservas (fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_estado  ON reservas (estado);
-- Orden por defecto en el panel admin: más recientes primero
CREATE INDEX IF NOT EXISTS idx_reservas_created ON reservas (created_at DESC);


-- ── SEGURIDAD (RLS) ────────────────────────────────────────────
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- Política 1: cualquier visitante (anon) puede INSERTAR una reserva
-- → formulario público del sitio web
CREATE POLICY "public_insert_reserva"
  ON reservas
  FOR INSERT
  WITH CHECK (true);

-- Política 2: solo el admin autenticado puede LEER todas las reservas
-- auth.uid() IS NOT NULL es equivalente a auth.role() = 'authenticated'
-- pero más robusto frente a cambios futuros de Supabase
CREATE POLICY "admin_select_reservas"
  ON reservas
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Política 3: solo el admin autenticado puede ACTUALIZAR reservas
-- (cambiar estado, corregir datos)
CREATE POLICY "admin_update_reservas"
  ON reservas
  FOR UPDATE
  USING     (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Política 4: solo el admin autenticado puede ELIMINAR reservas
CREATE POLICY "admin_delete_reservas"
  ON reservas
  FOR DELETE
  USING (auth.uid() IS NOT NULL);


-- ── DISPONIBILIDAD POR FRANJA HORARIA ──────────────────────────
-- Ver supabase/migrations/20260706000000_capacidad_disponibilidad.sql
-- y supabase/migrations/20260718000000_nuevo_horario.sql
-- para el contenido completo (tabla capacidad_horarios + funciones
-- disponibilidad_dia / disponibilidad_mes + trigger anti doble-reserva).
-- Se resume aquí solo para que este archivo siga siendo legible
-- como referencia completa del esquema:
--   · capacidad_horarios(hora, capacidad_mesas) — aforo por franja
--     (desayuno desde 07:00, comida hasta 15:30, cena hasta 22:30)
--   · disponibilidad_dia(fecha)   → nivel de ocupación por hora
--     (devuelve 0 filas los miércoles: día de cierre semanal)
--   · disponibilidad_mes(anio,mes)→ nivel de ocupación por día (calendario)
--   · trigger trg_validar_capacidad — rechaza reservas en miércoles
--     (DIA_CERRADO) y revalida cupo en el servidor antes de cada
--     INSERT (con advisory lock para evitar carreras)


-- ── PRECIOS EDITABLES DESDE EL ADMIN ──────────────────────────
-- Ver supabase/migrations/20260719010000_precios_editables.sql
-- para el contenido completo (tabla precios + políticas RLS +
-- semilla con los 89 productos de la carta). Se resume aquí:
--   · precios(producto_id, categoria, nombre_ref, precio,
--     precio_media, precio_entera) — un precio único o un par
--     media/entera (solo tostadas), nunca ambos a la vez (CHECK)
--   · Lectura pública (la carta la necesita sin login), escritura
--     solo para el admin autenticado. Sin INSERT/DELETE: el panel
--     admin únicamente edita precios de productos ya sembrados.
--   · carta.js lee esta tabla al cargar y sustituye el precio del
--     HTML si hay un valor; si falla la consulta, no toca nada.


-- ── CIERRES TEMPORALES (VACACIONES) ───────────────────────────
-- Ver supabase/migrations/20260719020000_cierres_temporales.sql
-- para el contenido completo. Se resume aquí:
--   · cierres(fecha_inicio, fecha_fin, motivo) — el admin añade y
--     borra rangos de fechas cerradas desde la pestaña "Cierres".
--   · disponibilidad_dia / disponibilidad_mes excluyen esos rangos
--     (igual que ya excluían los miércoles) → el calendario público
--     de reservas los pinta como cerrados automáticamente.
--   · El trigger validar_capacidad_reserva rechaza cualquier
--     intento de reserva en esas fechas (código CERRADO_TEMPORAL),
--     como red de seguridad aunque el frontend fallara.
--   · Sin política de UPDATE a propósito: para cambiar un cierre se
--     borra y se crea de nuevo.


-- ── PASOS PARA LA CONEXIÓN (Fase 3 — pendiente) ───────────────
--
--  1. Crear proyecto en https://supabase.com
--  2. Ejecutar este script en SQL Editor > New query
--  3. Copiar URL y anon key en assets/js/config.js (nunca subir a Git)
--  4. Crear usuario admin en Authentication > Users > Invite user
--  5. Conectar formulario de index.html con:
--       supabase.from('reservas').insert([datos])
--  6. Sustituir localStorage del panel admin por:
--       supabase.from('reservas').select() / update() / delete()
