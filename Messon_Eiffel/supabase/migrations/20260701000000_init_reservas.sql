-- ============================================================
-- Mesón Cafetería de Eiffel — Esquema de base de datos
-- Migración inicial: tabla de reservas + políticas RLS
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
