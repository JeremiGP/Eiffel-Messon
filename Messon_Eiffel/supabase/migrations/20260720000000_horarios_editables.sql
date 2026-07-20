-- ============================================================
-- Mesón Cafetería de Eiffel — Horarios/aforo editables desde el admin
-- ------------------------------------------------------------
-- capacidad_horarios ya existía (ver 20260706000000) y ya se podía
-- EDITAR el aforo de una franja existente desde el admin (política
-- admin_update_capacidad). Lo que faltaba era poder AÑADIR una franja
-- nueva o QUITAR una que ya no se use (p. ej. probar una franja de
-- tarde, o cerrar el desayuno de domingo) sin tocar SQL.
--
-- disponibilidad_dia / disponibilidad_mes / el trigger de validación
-- ya leen capacidad_horarios de forma genérica (no hay horas
-- hardcodeadas en esas funciones) → no hace falta tocarlas: en
-- cuanto se añade o borra una fila aquí, el calendario público y el
-- formulario de reserva lo reflejan solos.
-- ============================================================

CREATE POLICY "admin_insert_capacidad"
  ON capacidad_horarios
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "admin_delete_capacidad"
  ON capacidad_horarios
  FOR DELETE
  USING (auth.uid() IS NOT NULL);
