/* ============================================================
   Mesón de Eiffel — Reservas · Wizard "Pasos Dorados".
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Textos según idioma (ver assets/js/i18n-strings.js, cargado
  //    antes que este script) ────────────────────────────────
  const T = window.MESON_I18N || {};

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

  // ── Catálogo fijo de franjas (debe coincidir con
  //    supabase/migrations/20260706000000_capacidad_disponibilidad.sql
  //    + 20260718000000_nuevo_horario.sql) ──
  const HORAS_CATALOGO = [
    { grupo: T.grupoDesayuno || 'Desayuno', horas: ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'] },
    { grupo: T.grupoComida   || 'Comida',    horas: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'] },
    { grupo: T.grupoCena     || 'Cena',      horas: ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30'] },
  ];

  // Día semanal de cierre (0=Dom … 3=Mié). El restaurante cierra los
  // miércoles: se deshabilita en el calendario y, además, la base de
  // datos lo rechaza (trigger validar_capacidad_reserva).
  const DIA_CERRADO = 3;
  const CAPACIDAD_DEMO = 20; // usado solo en modo demo (sin Supabase)

  // Prefijo por defecto España (+34) primero; el resto ordenado por
  // relevancia para la clientela habitual del Mesón (Europa, Magreb,
  // Latinoamérica) y grandes bloques internacionales al final.
  const PREFIJOS_PAIS = T.prefijos || [
    { code: '+34',  pais: 'España' },
    { code: '+351', pais: 'Portugal' },
    { code: '+33',  pais: 'Francia' },
    { code: '+44',  pais: 'Reino Unido' },
    { code: '+49',  pais: 'Alemania' },
    { code: '+39',  pais: 'Italia' },
    { code: '+31',  pais: 'Países Bajos' },
    { code: '+32',  pais: 'Bélgica' },
    { code: '+41',  pais: 'Suiza' },
    { code: '+43',  pais: 'Austria' },
    { code: '+353', pais: 'Irlanda' },
    { code: '+352', pais: 'Luxemburgo' },
    { code: '+45',  pais: 'Dinamarca' },
    { code: '+46',  pais: 'Suecia' },
    { code: '+47',  pais: 'Noruega' },
    { code: '+358', pais: 'Finlandia' },
    { code: '+48',  pais: 'Polonia' },
    { code: '+30',  pais: 'Grecia' },
    { code: '+212', pais: 'Marruecos' },
    { code: '+213', pais: 'Argelia' },
    { code: '+1',   pais: 'EE. UU. / Canadá' },
    { code: '+52',  pais: 'México' },
    { code: '+54',  pais: 'Argentina' },
    { code: '+55',  pais: 'Brasil' },
    { code: '+56',  pais: 'Chile' },
    { code: '+57',  pais: 'Colombia' },
    { code: '+51',  pais: 'Perú' },
    { code: '+58',  pais: 'Venezuela' },
    { code: '+593', pais: 'Ecuador' },
    { code: '+591', pais: 'Bolivia' },
    { code: '+598', pais: 'Uruguay' },
    { code: '+506', pais: 'Costa Rica' },
    { code: '+507', pais: 'Panamá' },
    { code: '+53',  pais: 'Cuba' },
    { code: '+86',  pais: 'China' },
    { code: '+81',  pais: 'Japón' },
    { code: '+7',   pais: 'Rusia' },
  ];

  // Regex de email práctica y robusta (misma familia que usan los
  // navegadores para validar <input type="email">): exige un dominio
  // con al menos un punto y una etiqueta final alfanumérica válida,
  // sin puntos dobles ni empezar/terminar en guión.
  const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

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

  const fechaInput = document.getElementById('fecha'); // hidden, lo rellena el calendario
  const horaInput  = document.getElementById('hora');  // hidden, lo rellena el selector de pills
  const telInput   = document.getElementById('telefono');

  // Formatea una fecha local a YYYY-MM-DD sin desfases de zona horaria
  // (toISOString convierte a UTC: entre las 00:00 y la 01:00/02:00 hora
  // española devolvería el día ANTERIOR — mismo helper que usa admin.js)
  function fechaLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }

  const hoyDate = new Date();
  hoyDate.setHours(0, 0, 0, 0);
  const hoyStr = fechaLocalISO(hoyDate);

  // ════════════════════════════════════════════════════════
  // CALENDARIO — pinta disponibilidad por día (color = nivel)
  // ════════════════════════════════════════════════════════
  let calAnio = hoyDate.getFullYear();
  let calMes  = hoyDate.getMonth() + 1; // 1-12
  let fechaSeleccionada = null;

  const calGrid     = document.getElementById('calGrid');
  const calMesLabel = document.getElementById('calMesLabel');
  const calPrevBtn   = document.getElementById('calPrev');
  const calNextBtn   = document.getElementById('calNext');

  const MES_NOMBRES = T.mesNombres || ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Trae el nivel de ocupación de cada día del mes. Si no hay Supabase
  // configurado, se simula "buena disponibilidad" todos los días (modo demo).
  async function fetchDisponibilidadMes(anio, mes) {
    if (!supabaseClient) {
      const dias = new Date(anio, mes, 0).getDate();
      const mapa = {};
      for (let d = 1; d <= dias; d++) {
        const key = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        mapa[key] = 'alta';
      }
      return mapa;
    }

    const { data, error } = await supabaseClient.rpc('disponibilidad_mes', { p_anio: anio, p_mes: mes });
    if (error) {
      console.error('Error al cargar disponibilidad del mes:', error);
      return {};
    }
    const mapa = {};
    (data || []).forEach(fila => { mapa[fila.fecha] = fila.nivel; });
    return mapa;
  }

  // Token anti-carrera: si el usuario navega rápido entre meses, solo la
  // última petición pendiente puede pintar el grid (las respuestas lentas
  // de meses anteriores se descartan en vez de sobrescribir la vista).
  let calRenderToken = 0;

  async function renderCalendario() {
    const token = ++calRenderToken;
    calMesLabel.textContent = `${MES_NOMBRES[calMes - 1]} ${calAnio}`;
    calGrid.innerHTML = `<p class="cal-cargando">${T.cargandoDisponibilidad || 'Cargando disponibilidad…'}</p>`;

    // No dejar navegar a meses anteriores al actual
    const esMesActual = calAnio === hoyDate.getFullYear() && calMes === hoyDate.getMonth() + 1;
    calPrevBtn.disabled = esMesActual;

    const nivelPorDia = await fetchDisponibilidadMes(calAnio, calMes);
    if (token !== calRenderToken) return; // llegó tarde: hay un render más nuevo

    const primerDiaSemana = (new Date(calAnio, calMes - 1, 1).getDay() + 6) % 7; // 0=Lunes
    const totalDias       = new Date(calAnio, calMes, 0).getDate();

    let html = '';
    for (let i = 0; i < primerDiaSemana; i++) html += '<span class="cal-hueco"></span>';

    for (let d = 1; d <= totalDias; d++) {
      const key    = `${calAnio}-${String(calMes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const fecha  = new Date(calAnio, calMes - 1, d);
      const esPasado = fecha < hoyDate;
      const esCerrado = fecha.getDay() === DIA_CERRADO; // miércoles: cerrado
      const nivel  = nivelPorDia[key] || 'alta';
      const completo = nivel === 'completo';
      const deshabilitado = esPasado || completo || esCerrado;

      // aria-label completa (día + mes + año + estado) para lectores de pantalla
      const fechaBase = T.fechaLabel
        ? T.fechaLabel(d, MES_NOMBRES[calMes - 1], calAnio)
        : `${d} de ${MES_NOMBRES[calMes - 1]} de ${calAnio}`;
      const etiqueta = `${fechaBase}${esCerrado ? (T.sufijoCerrado || ', cerrado') : completo ? (T.sufijoCompleto || ', completo') : ''}`;

      html += `
        <button type="button" class="cal-day ${deshabilitado ? 'cal-day--disabled' : ''} ${key === fechaSeleccionada ? 'cal-day--sel' : ''}"
                data-fecha="${key}" ${deshabilitado ? 'disabled' : ''}
                aria-label="${etiqueta}" aria-pressed="${key === fechaSeleccionada}">
          ${d}
          ${!esPasado && !esCerrado ? `<span class="cal-dot nivel-${nivel}"></span>` : ''}
        </button>`;
    }

    calGrid.innerHTML = html;

    calGrid.querySelectorAll('.cal-day:not(.cal-day--disabled)').forEach(btn => {
      btn.addEventListener('click', () => seleccionarFecha(btn.dataset.fecha));
    });
  }

  function seleccionarFecha(fecha) {
    fechaSeleccionada = fecha;
    fechaInput.value  = fecha;
    limpiarError('fecha');

    calGrid.querySelectorAll('.cal-day').forEach(btn => {
      const sel = btn.dataset.fecha === fecha;
      btn.classList.toggle('cal-day--sel', sel);
      btn.setAttribute('aria-pressed', String(sel));
    });

    // Cambiar de día invalida la hora que tuviera elegida antes
    horaInput.value = '';
    renderHoras(fecha);
  }

  calPrevBtn.addEventListener('click', () => {
    calMes--;
    if (calMes < 1) { calMes = 12; calAnio--; }
    renderCalendario();
  });
  calNextBtn.addEventListener('click', () => {
    calMes++;
    if (calMes > 12) { calMes = 1; calAnio++; }
    renderCalendario();
  });

  renderCalendario();

  // ════════════════════════════════════════════════════════
  // HORAS — pills con disponibilidad real de la fecha elegida
  // ════════════════════════════════════════════════════════
  const horasPillsEl = document.getElementById('horasPills');
  const horasVacioEl = document.getElementById('horasVacio');

  // Trae disponibles/nivel por hora para una fecha. En modo demo,
  // todas las franjas están abiertas salvo las que ya pasaron (si es hoy).
  async function fetchDisponibilidadDia(fecha) {
    const esHoy = fecha === hoyStr;
    const ahora = new Date();
    const minActual = ahora.getHours() * 60 + ahora.getMinutes();

    const yaPaso = (hora) => {
      const [h, m] = hora.split(':').map(Number);
      return esHoy && (h * 60 + m) <= minActual + 30; // margen de 30 min
    };

    if (!supabaseClient) {
      const mapa = {};
      HORAS_CATALOGO.forEach(grupo => grupo.horas.forEach(hora => {
        mapa[hora] = yaPaso(hora)
          ? { disponibles: 0, nivel: 'completo' }
          : { disponibles: CAPACIDAD_DEMO, nivel: 'alta' };
      }));
      return mapa;
    }

    const { data, error } = await supabaseClient.rpc('disponibilidad_dia', { p_fecha: fecha });
    if (error) {
      console.error('Error al cargar disponibilidad del día:', error);
      return {};
    }
    const mapa = {};
    (data || []).forEach(fila => {
      mapa[fila.hora] = {
        disponibles: yaPaso(fila.hora) ? 0 : fila.disponibles,
        nivel:       yaPaso(fila.hora) ? 'completo' : fila.nivel,
      };
    });
    return mapa;
  }

  // Mismo patrón anti-carrera que el calendario, para clicks rápidos
  // entre días distintos.
  let horasRenderToken = 0;

  async function renderHoras(fecha) {
    const token = ++horasRenderToken;
    horasVacioEl.style.display = 'none';
    horasPillsEl.innerHTML = `<p class="cal-cargando">${T.cargandoHoras || 'Cargando horas…'}</p>`;

    const disponibilidad = await fetchDisponibilidadDia(fecha);
    if (token !== horasRenderToken) return; // respuesta obsoleta

    let html = '';
    HORAS_CATALOGO.forEach(grupo => {
      html += `<div class="horas-grupo-label">${grupo.grupo}</div><div class="horas-grupo">`;
      grupo.horas.forEach(hora => {
        const info = disponibilidad[hora] || { disponibles: 0, nivel: 'completo' };
        const sinCupo = info.disponibles <= 0;
        const sinMesasAria = T.sinMesasAria || ', sin mesas disponibles';
        const mesasLibresAria = T.mesasLibresAria ? T.mesasLibresAria(info.disponibles) : `, ${info.disponibles} mesas libres`;
        const sinMesasTitle = T.sinMesasTitle || 'Sin mesas disponibles';
        const mesasLibresTitle = T.mesasLibresTitle ? T.mesasLibresTitle(info.disponibles) : `${info.disponibles} mesas libres`;
        html += `
          <button type="button" class="hora-pill nivel-${info.nivel} ${sinCupo ? 'hora-pill--disabled' : ''}"
                  data-hora="${hora}" ${sinCupo ? 'disabled' : ''} aria-pressed="false"
                  aria-label="${hora}${sinCupo ? sinMesasAria : mesasLibresAria}"
                  title="${sinCupo ? sinMesasTitle : mesasLibresTitle}">
            ${hora}
          </button>`;
      });
      html += '</div>';
    });

    horasPillsEl.innerHTML = html;

    horasPillsEl.querySelectorAll('.hora-pill:not(.hora-pill--disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        horasPillsEl.querySelectorAll('.hora-pill').forEach(b => {
          b.classList.remove('hora-pill--sel');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('hora-pill--sel');
        btn.setAttribute('aria-pressed', 'true');
        horaInput.value = btn.dataset.hora;
        limpiarError('hora');
      });
    });
  }

  // ── Selector de prefijo de país ───────────────────────────
  const prefijoSelect = document.getElementById('prefijo');
  if (prefijoSelect) {
    // Solo el número — cada quien sabe de dónde es su propio prefijo.
    // El país queda como title (tooltip) para no perder del todo el
    // contexto por accesibilidad, sin mostrarlo en el texto visible.
    prefijoSelect.innerHTML = PREFIJOS_PAIS.map(p =>
      `<option value="${p.code}" title="${p.pais}">${p.code}</option>`
    ).join('');
  }

  // España tiene móviles/fijos de exactamente 9 dígitos; para el resto
  // de prefijos no tenemos una regla fija por país, así que se acepta
  // un rango razonable (6-14 dígitos) en vez de inventar una longitud.
  function maxDigitosTelefono() {
    return prefijoSelect && prefijoSelect.value === '+34' ? 9 : 14;
  }

  // ── Filtro campo teléfono — solo dígitos, según el prefijo ────
  if (telInput) {
    telInput.setAttribute('maxlength', String(maxDigitosTelefono()));

    telInput.addEventListener('input', () => {
      const limpio = telInput.value.replace(/\D/g, '').slice(0, maxDigitosTelefono());
      if (limpio !== telInput.value) telInput.value = limpio;
    });

    telInput.addEventListener('keydown', (e) => {
      const permitidas = ['Backspace','Delete','ArrowLeft','ArrowRight',
                          'Tab','Home','End','Enter'];
      if (permitidas.includes(e.key)) return;
      if (!/\d/.test(e.key)) e.preventDefault();
    });
  }

  if (prefijoSelect) {
    prefijoSelect.addEventListener('change', () => {
      telInput.setAttribute('maxlength', String(maxDigitosTelefono()));
      // Si al cambiar de país el número ya no encaja, se recorta en
      // vez de dejar un valor que la validación rechazaría en silencio.
      telInput.value = telInput.value.slice(0, maxDigitosTelefono());
      limpiarError('telefono');
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
    // Reset de posición al cambiar de paso, dejando hueco para el
    // nav fijo (scrollIntoView metía la card debajo del menú)
    const card = document.querySelector('.reserva-card');
    if (card) {
      const navH = document.getElementById('nav')?.offsetHeight || 70;
      const top  = card.getBoundingClientRect().top + window.scrollY - navH - 12;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }
  }

  // ── Validaciones por paso ─────────────────────────────────
  function validarPaso1() {
    limpiarError('fecha');
    limpiarError('hora');
    limpiarErrorGrupo('personasSelector');

    let ok = true;
    if (!fechaInput.value) {
      mostrarErrorBloque('calendarioWrap', 'fecha', T.errFecha || 'Elige una fecha para tu reserva.');
      ok = false;
    }
    if (!horaInput.value) {
      mostrarErrorBloque('horasWrap', 'hora', T.errHora || 'Elige una hora disponible.');
      ok = false;
    }
    if (!document.getElementById('personas').value) {
      mostrarErrorGrupo('personasSelector', T.errPersonas || 'Selecciona cuántas personas venís.');
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

    if (!nombre)    { mostrarError('nombre', T.errNombre || 'Escribe tu nombre.'); ok = false; }
    if (!apellidos) { mostrarError('apellidos', T.errApellidos || 'Escribe tus apellidos.'); ok = false; }

    const esEspana = prefijoSelect && prefijoSelect.value === '+34';
    if (!telefono) {
      mostrarError('telefono', T.errTelVacio || 'Escribe un teléfono de contacto.'); ok = false;
    } else if (esEspana && telefono.length !== 9) {
      mostrarError('telefono', T.errTelEspana || 'El teléfono en España debe tener 9 dígitos.'); ok = false;
    } else if (!esEspana && telefono.length < 6) {
      mostrarError('telefono', T.errTelIncompleto || 'Ese número parece incompleto.'); ok = false;
    }

    // Email: si se escribe algo, debe tener formato de correo real
    // (dominio con punto y extensión válida), no cualquier texto con @.
    if (email && !EMAIL_RE.test(email)) {
      mostrarError('email', T.errEmail || 'Revisa el formato del email (algo@dominio.com).');
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

  // Igual que mostrarError, pero para el calendario/horas (que ya no son
  // inputs visibles: el input real es hidden, así que el mensaje se
  // engancha a su contenedor visual en vez del input mismo).
  function mostrarErrorBloque(contenedorId, hiddenId, mensaje) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    contenedor.style.outline = '2px solid rgba(184,80,50,0.55)';
    contenedor.style.borderRadius = '8px';

    let errorEl = document.getElementById(hiddenId + '-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.id = hiddenId + '-error';
      errorEl.className = 'field-error';
      errorEl.setAttribute('role', 'alert');
      contenedor.insertAdjacentElement('afterend', errorEl);
    }
    errorEl.textContent = mensaje;
  }

  function limpiarError(id) {
    const el = document.getElementById(id);
    if (el) {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
      el.style.borderColor = '';
      el.style.boxShadow   = '';
    }
    const errorEl = document.getElementById(id + '-error');
    if (errorEl) errorEl.remove();

    // Si el error estaba enganchado a un bloque visual (calendario/horas),
    // también le sacamos el outline rojo.
    ['calendarioWrap', 'horasWrap'].forEach(cid => {
      const c = document.getElementById(cid);
      if (c) { c.style.outline = ''; c.style.borderRadius = ''; }
    });
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

  // ── Selector de personas (con opción personalizable "Más de 8") ──
  const personasBtns    = document.querySelectorAll('.persona-btn');
  const personasInput   = document.getElementById('personas');
  const personaMasBtn   = document.getElementById('personaMasBtn');
  const personasCustom  = document.getElementById('personasCustom');

  personasBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      personasBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      limpiarErrorGrupo('personasSelector');

      if (btn === personaMasBtn) {
        // Opción personalizable: mostrar input numérico en vez de
        // fijar un valor de golpe — el usuario escribe el nº exacto.
        personasCustom.style.display = 'block';
        personasCustom.value = '';
        personasInput.value = '';
        personasCustom.focus();
      } else {
        personasCustom.style.display = 'none';
        personasInput.value = btn.dataset.n;
      }
    });
  });

  personasCustom.addEventListener('input', () => {
    // Solo dígitos, y como mínimo 9 (para eso está el botón "Más de 8")
    const limpio = personasCustom.value.replace(/\D/g, '');
    if (limpio !== personasCustom.value) personasCustom.value = limpio;
    const n = parseInt(limpio, 10);
    personasInput.value = (n && n >= 1) ? String(n) : '';
    limpiarErrorGrupo('personasSelector');
  });

  // ── Limpiar error en cuanto el usuario corrige el campo ───
  ['nombre', 'apellidos', 'telefono', 'email'].forEach(id => {
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
    btnSubmit.textContent = T.enviando || 'Enviando…';
    btnSubmit.disabled    = true;
    if (formError) formError.style.display = 'none';

    const datos = {
      nombre:   `${document.getElementById('nombre').value.trim()} ${document.getElementById('apellidos').value.trim()}`.trim(),
      telefono: `${prefijoSelect ? prefijoSelect.value : '+34'} ${document.getElementById('telefono').value.trim()}`.trim(),
      email:    document.getElementById('email').value.trim() || null,
      fecha:    fechaInput.value,
      hora:     horaInput.value,
      // La columna `personas` es INT en la base (migración 20260710120000)
      personas: parseInt(document.getElementById('personas').value, 10),
      notas:    document.getElementById('notas').value.trim() || null,
      // Idioma de la página desde la que reserva (migración 20260719000000):
      // la Edge Function confirmar-reserva lo usa para mandar el email de
      // confirmación en español, inglés o francés según corresponda.
      idioma:   window.MESON_LANG || 'es',
    };

    if (supabaseClient) {
      // ── Revalidar cupo justo antes de enviar ──────────────
      // Cubre el caso típico: el usuario dejó el formulario abierto
      // un rato y esa hora se llenó mientras tanto con otra reserva.
      const disponibilidadActual = await fetchDisponibilidadDia(datos.fecha);
      const infoHora = disponibilidadActual[datos.hora];
      if (!infoHora || infoHora.disponibles <= 0) {
        btnSubmit.textContent = T.solicitarReserva || 'Solicitar reserva';
        btnSubmit.disabled    = false;
        if (formError) {
          formError.textContent = T.errSinCupo || 'Uy, esa hora se acaba de completar. Elegí otra franja disponible.';
          formError.style.display = 'block';
        }
        goToStep(1);
        renderHoras(datos.fecha);
        horaInput.value = '';
        return;
      }

      // ── Modo real: guarda la reserva en Supabase ──────────
      const { error } = await supabaseClient.from('reservas').insert([datos]);
      if (error) {
        console.error('Error al guardar la reserva:', error);
        btnSubmit.textContent = T.solicitarReserva || 'Solicitar reserva';
        btnSubmit.disabled    = false;

        // Códigos que manda la base de datos:
        // - SIN_DISPONIBILIDAD: alguien se adelantó con la última mesa
        //   (dos reservas casi simultáneas para la misma franja).
        // - DIA_CERRADO: la fecha cae en día de cierre semanal (miércoles).
        // - DEMASIADAS_SOLICITUDES: rate limiting anti-spam del trigger
        //   trg_limitar_reservas (demasiadas reservas desde la misma IP).
        const sinCupo     = error.message && error.message.includes('SIN_DISPONIBILIDAD');
        const diaCerrado  = error.message && error.message.includes('DIA_CERRADO');
        const rateLimited = error.message && error.message.includes('DEMASIADAS_SOLICITUDES');
        if (formError) {
          formError.textContent = sinCupo
            ? (T.errSinCupo || 'Uy, esa hora se acaba de completar. Elegí otra franja disponible.')
            : diaCerrado
              ? (T.errDiaCerrado || 'Ese día el restaurante está cerrado (cerramos los miércoles). Elige otra fecha.')
              : rateLimited
                ? (T.errRateLimit || 'Hemos recibido varias solicitudes desde tu conexión. Llámanos al 958 87 24 24 y te atendemos al momento.')
                : (T.errGenerico || 'No se pudo enviar la reserva. Inténtalo de nuevo o llámanos al 958 87 24 24.');
          formError.style.display = 'block';
        }
        if (sinCupo || diaCerrado) {
          goToStep(1);
          renderHoras(datos.fecha);
          horaInput.value = '';
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
