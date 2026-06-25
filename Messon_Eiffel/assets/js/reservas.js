/* ============================================================
   Mesón Cafetería de Eiffel — Lógica del Formulario de Reservas
   Incluir solo en reservas.html
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── FECHA MÍNIMA (hoy) ──────────────────────────────────────
  const fechaInput = document.getElementById('fecha');
  if (fechaInput) {
    fechaInput.setAttribute('min', new Date().toISOString().split('T')[0]);
  }

  // ── FORMULARIO DE RESERVA ───────────────────────────────────
  const reservaForm = document.getElementById('reservaForm');
  if (reservaForm) {
    reservaForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = this.querySelector('.form-submit');
      btn.textContent = 'Enviando…';
      btn.disabled = true;

      // TODO (Fase 3): Conectar con Supabase
      // const datos = {
      //   nombre:   this.querySelector('[name="nombre"]').value,
      //   telefono: this.querySelector('[name="telefono"]').value,
      //   email:    this.querySelector('[name="email"]').value,
      //   fecha:    this.querySelector('[name="fecha"]').value,
      //   hora:     this.querySelector('[name="hora"]').value,
      //   personas: this.querySelector('[name="personas"]').value,
      //   notas:    this.querySelector('[name="notas"]').value,
      // };
      // const { error } = await supabase.from('reservas').insert([datos]);

      // Simulación mientras no hay backend
      setTimeout(() => {
        btn.textContent = 'Reserva enviada — te confirmamos pronto';
        btn.style.background = '#2d7a4f';
        btn.disabled = false;
      }, 800);
    });
  }

});
