/* ============================================================
   Mesón de Eiffel — Reservas · Wizard "Pasos Dorados"
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Cliente de Supabase ───────────────────────────────────
  // Si assets/js/config.js tiene claves reales, se usa Supabase
  // de verdad. Si no existe o sigue con los valores de ejemplo,
  // la reserva se simula igual que antes — el sitio nunca se
  // rompe por no tener Supabase configurado todavía.
  const supabaseClient = (
    typeof SUPABASE_URL !== 'undefined' &&
    SUPABASE_URL && !SUPABASE_URL.includes('TU-PROYECTO') &&
    window.supabase
  ) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
    limpiarError('fecha');
    limpiarError('hora');
    limpiarErrorGrupo('personasSelector');

    let ok = true;
    if (!fechaInput.value) {
      mostrarError('fecha', 'Elige una fecha para tu reserva.');
      ok = false;
    }
    if (!horaSelect.value) {
      mostrarError('hora', 'Elige una hora disponible.');
      ok = false;
    }
    if (!document.getElementById('personas').value) {
      mostrarErrorGrupo('personasSelector', 'Selecciona cuántas personas venís.');
      ok = false;
    }
    return ok;
  }

  function validarPaso2() {
    limpiarError('nombre');
    limpiarError('apellidos');
    limpiarError('telefono');
    limpiarError('email');

    const nombre    = document.getElementById('nombre').value.trim();
    const apellidos = document.getElementById('apellidos').value.trim();
    const telefono  = telInput.value.trim();
    const email     = document.getElementById('email').value.trim();
    let ok = true;

    if (!nombre)    { mostrarError('nombre', 'Escribe tu nombre.'); ok = false; }
    if (!apellidos) { mostrarError('apellidos', 'Escribe tus apellidos.'); ok = false; }

    if (!telefono) {
      mostrarError('telefono', 'Escribe un teléfono de contacto.'); ok = false;
    } else if (telefono.length < 9) {
      mostrarError('telefono', 'El teléfono debe tener 9 dígitos.'); ok = false;
    }

    // Email: si se escribe algo, debe tener formato válido (algo@dominio.ext)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      mostrarError('email', 'Revisa el formato del email (algo@dominio.com).');
      ok = false;
    }

    return ok;
  }

  // ── Errores accesibles: texto visible + aria-invalid/aria-describedby ──
  function mostrarError(id, mensaje) {
    const el = document.getElementById(id);
    if (!el) return;

    el.setAttribute('aria-invalid', 'true');
    el.style.borderColor = 'rgba(184,80,50,0.7)';
    el.style.boxShadow   = '0 0 0 3px rgba(184,80,50,0.1)';

    let errorEl = document.getElementById(id + '-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.id = id + '-error';
      errorEl.className = 'field-error';
      errorEl.setAttribute('role', 'alert');
      el.insertAdjacentElement('afterend', errorEl);
    }
    errorEl.textContent = mensaje;
    el.setAttribute('aria-describedby', errorEl.id);
    el.focus();
  }

  function limpiarError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
    el.style.borderColor = '';
    el.style.boxShadow   = '';
    const errorEl = document.getElementById(id + '-error');
    if (errorEl) errorEl.remove();
  }

  // ── Igual que arriba, pero para el grupo de botones "personas" ──────
  function mostrarErrorGrupo(groupId, mensaje) {
    const grupo = document.getElementById(groupId);
    if (!grupo) return;
    grupo.style.outline = '2px solid rgba(184,80,50,0.55)';
    grupo.style.borderRadius = '8px';

    let errorEl = document.getElementById(groupId + '-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.id = groupId + '-error';
      errorEl.className = 'field-error';
      errorEl.setAttribute('role', 'alert');
      grupo.insertAdjacentElement('afterend', errorEl);
    }
    errorEl.textContent = mensaje;
  }

  function limpiarErrorGrupo(groupId) {
    const grupo = document.getElementById(groupId);
    if (!grupo) return;
    grupo.style.outline = '';
    grupo.style.borderRadius = '';
    const errorEl = document.getElementById(groupId + '-error');
    if (errorEl) errorEl.remove();
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
      limpiarErrorGrupo('personasSelector');
    });
  });

  // ── Limpiar error en cuanto el usuario corrige el campo ───
  ['fecha', 'hora', 'nombre', 'apellidos', 'telefono', 'email'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => limpiarError(id));
    el.addEventListener('change', () => limpiarError(id));
  });

  // ── Submit ────────────────────────────────────────────────
  const form      = document.getElementById('reservaForm');
  const formError = document.getElementById('formError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btnSubmit = form.querySelector('.btn-submit');
    btnSubmit.textContent = 'Enviando…';
    btnSubmit.disabled    = true;
    if (formError) formError.style.display = 'none';

    const datos = {
      nombre:   `${document.getElementById('nombre').value.trim()} ${document.getElementById('apellidos').value.trim()}`.trim(),
      telefono: document.getElementById('telefono').value.trim(),
      email:    document.getElementById('email').value.trim() || null,
      fecha:    document.getElementById('fecha').value,
      hora:     document.getElementById('hora').value,
      personas: document.getElementById('personas').value,
      notas:    document.getElementById('notas').value.trim() || null,
    };

    if (supabaseClient) {
      // ── Modo real: guarda la reserva en Supabase ──────────
      const { error } = await supabaseClient.from('reservas').insert([datos]);
      if (error) {
        console.error('Error al guardar la reserva:', error);
        btnSubmit.textContent = 'Solicitar reserva';
        btnSubmit.disabled    = false;
        if (formError) {
          formError.textContent = 'No se pudo enviar la reserva. Inténtalo de nuevo o llámanos al 958 87 24 24.';
          formError.style.display = 'block';
        }
        return;
      }
    } else {
      // ── Modo demo: sin Supabase configurado, se simula el envío ──
      await new Promise(resolve => setTimeout(resolve, 900));
    }

    form.style.display = 'none';
    document.querySelector('.steps-track').style.display = 'none';
    document.getElementById('confirmado').classList.add('active');
  });

});
