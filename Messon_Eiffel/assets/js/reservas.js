/* ============================================================
   Mesón de Eiffel — Reservas · Wizard "Pasos Dorados"
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Referencias ──────────────────────────────────────────
  let currentStep = 1;

  const stepItems  = [
    document.getElementById('si-1'),
    document.getElementById('si-2'),
    document.getElementById('si-3'),
  ];
  const stepLines  = [
    document.getElementById('sl-1'),
    document.getElementById('sl-2'),
  ];
  const stepPanels = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3'),
  ];

  const fechaInput = document.getElementById('fecha');
  const horaSelect = document.getElementById('hora');
  const telInput   = document.getElementById('telefono');

  // ── Fecha mínima: hoy ────────────────────────────────────
  const hoy = new Date().toISOString().split('T')[0];
  if (fechaInput) fechaInput.setAttribute('min', hoy);

  // ── Horas disponibles según el día ───────────────────────
  // Horario: Desayuno 8:30-12:00 · Comida 13:00-15:30 · Cena 20:00-22:30
  // Si se elige hoy, se deshabilitan las horas ya pasadas
  function actualizarHoras() {
    const esHoy = fechaInput.value === hoy;
    const ahora = new Date();
    const minActual = ahora.getHours() * 60 + ahora.getMinutes();

    Array.from(horaSelect.options).forEach(opt => {
      if (!opt.value) return; // placeholder
      const [h, m] = opt.value.split(':').map(Number);
      const minOpcion = h * 60 + m;
      // Deshabilitar si es hoy y la hora ya pasó (con margen de 30 min)
      opt.disabled = esHoy && minOpcion <= minActual + 30;
    });

    // Si la hora seleccionada quedó deshabilitada, limpiar selección
    if (horaSelect.value) {
      const sel = horaSelect.querySelector(`option[value="${horaSelect.value}"]`);
      if (sel && sel.disabled) horaSelect.value = '';
    }
  }

  if (fechaInput) {
    fechaInput.addEventListener('change', actualizarHoras);
    // Ejecutar al cargar si ya hay fecha
    if (fechaInput.value) actualizarHoras();
  }

  // ── Filtro campo teléfono — solo dígitos, máx 9 ──────────
  if (telInput) {
    telInput.addEventListener('input', () => {
      const limpio = telInput.value.replace(/\D/g, '').slice(0, 9);
      if (limpio !== telInput.value) telInput.value = limpio;
    });

    telInput.addEventListener('keydown', (e) => {
      const permitidas = ['Backspace','Delete','ArrowLeft','ArrowRight',
                          'Tab','Home','End','Enter'];
      if (permitidas.includes(e.key)) return;
      if (!/\d/.test(e.key)) e.preventDefault();
    });
  }

  // ── Navegación entre pasos ───────────────────────────────
  function goToStep(n) {
    stepPanels.forEach((p, i) => p.classList.toggle('active', i + 1 === n));

    stepItems.forEach((item, i) => {
      item.classList.remove('active', 'done');
      if (i + 1 === n) item.classList.add('active');
      if (i + 1 < n)  item.classList.add('done');
    });

    stepLines.forEach((line, i) => {
      line.classList.toggle('done', i + 1 < n);
    });

    currentStep = n;
    document.querySelector('.reserva-card')
      .scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Validaciones por paso ─────────────────────────────────
  function validarPaso1() {
    if (!fechaInput.value) {
      resaltarError('fecha'); return false;
    }
    if (!horaSelect.value) {
      resaltarError('hora'); return false;
    }
    if (!document.getElementById('personas').value) {
      const sel = document.getElementById('personasSelector');
      sel.style.outline = '2px solid rgba(184,80,50,0.55)';
      sel.style.borderRadius = '8px';
      setTimeout(() => { sel.style.outline = ''; sel.style.borderRadius = ''; }, 2000);
      return false;
    }
    return true;
  }

  function validarPaso2() {
    const nombre    = document.getElementById('nombre').value.trim();
    const apellidos = document.getElementById('apellidos').value.trim();
    const telefono  = telInput.value.trim();
    const email     = document.getElementById('email').value.trim();

    if (!nombre)             { resaltarError('nombre');    return false; }
    if (!apellidos)          { resaltarError('apellidos'); return false; }
    if (!telefono)           { resaltarError('telefono');  return false; }
    if (telefono.length < 9) { resaltarError('telefono');  return false; }

    // Email: si se escribe algo, debe tener formato válido (algo@dominio.ext)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      resaltarError('email'); return false;
    }

    return true;
  }

  function resaltarError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = 'rgba(184,80,50,0.7)';
    el.style.boxShadow   = '0 0 0 3px rgba(184,80,50,0.1)';
    el.focus();
    setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 2000);
  }

  // ── Botones siguiente / volver ────────────────────────────
  document.getElementById('next-1').addEventListener('click', () => {
    if (validarPaso1()) goToStep(2);
  });
  document.getElementById('next-2').addEventListener('click', () => {
    if (validarPaso2()) goToStep(3);
  });
  document.getElementById('prev-2').addEventListener('click', () => goToStep(1));
  document.getElementById('prev-3').addEventListener('click', () => goToStep(2));

  // ── Selector de personas ──────────────────────────────────
  const personasBtns  = document.querySelectorAll('.persona-btn');
  const personasInput = document.getElementById('personas');

  personasBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      personasBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      personasInput.value = btn.dataset.n;
    });
  });

  // ── Submit ────────────────────────────────────────────────
  const form = document.getElementById('reservaForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btnSubmit = form.querySelector('.btn-submit');
    btnSubmit.textContent = 'Enviando…';
    btnSubmit.disabled    = true;

    // TODO (Fase 3): Conectar con Supabase
    // const datos = {
    //   nombre:    form.querySelector('[name="nombre"]').value,
    //   apellidos: form.querySelector('[name="apellidos"]').value,
    //   telefono:  form.querySelector('[name="telefono"]').value,
    //   email:     form.querySelector('[name="email"]').value,
    //   fecha:     form.querySelector('[name="fecha"]').value,
    //   hora:      form.querySelector('[name="hora"]').value,
    //   personas:  form.querySelector('[name="personas"]').value,
    //   notas:     form.querySelector('[name="notas"]').value,
    // };
    // const { error } = await supabase.from('reservas').insert([datos]);

    setTimeout(() => {
      form.style.display = 'none';
      document.querySelector('.steps-track').style.display = 'none';
      document.getElementById('confirmado').classList.add('active');
    }, 900);
  });

});
