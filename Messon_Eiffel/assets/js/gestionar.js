/* ============================================================
   Mesón de Eiffel — Gestionar mi reserva (autogestión por token).
   Ver supabase/migrations/20260721000000_autogestion_reservas.sql
   para las funciones RPC que usa esta página:
     reserva_por_token / cancelar_reserva_token / modificar_reserva_token
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const T = window.MESON_I18N || {};

  const supabaseClient = (
    typeof SUPABASE_URL !== 'undefined' &&
    SUPABASE_URL && !SUPABASE_URL.includes('TU-PROYECTO') &&
    window.supabase
  ) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  // Mismo catálogo fijo de franjas que reservas.js (el formulario público
  // de reservar usa esta misma lista de horas).
  const HORAS_CATALOGO = [
    { grupo: T.grupoDesayuno || 'Desayuno', horas: ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'] },
    { grupo: T.grupoComida   || 'Comida',    horas: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'] },
    { grupo: T.grupoCena     || 'Cena',      horas: ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30'] },
  ];

  function fechaLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }

  const hoyDate = new Date();
  hoyDate.setHours(0, 0, 0, 0);
  const hoyStr = fechaLocalISO(hoyDate);

  function formatFecha(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const lang = document.documentElement.getAttribute('lang') || 'es';
    return new Date(y, m - 1, d).toLocaleDateString(lang, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // ── Referencias ──────────────────────────────────────────
  const elCargando   = document.getElementById('gestionCargando');
  const elError       = document.getElementById('gestionError');
  const elErrorMsg     = document.getElementById('gestionErrorMsg');
  const elDetalle     = document.getElementById('gestionDetalle');
  const elCancelada   = document.getElementById('gestionCancelada');

  const elEstadoEyebrow = document.getElementById('gEstadoEyebrow');
  const elNombre       = document.getElementById('gNombre');
  const elFechaTxt      = document.getElementById('gFechaTxt');
  const elHoraTxt       = document.getElementById('gHoraTxt');
  const elPersonasTxt   = document.getElementById('gPersonasTxt');
  const elNotasTxt      = document.getElementById('gNotasTxt');

  const elAcciones     = document.getElementById('gestionAcciones');
  const btnCambiar     = document.getElementById('btnCambiar');
  const btnCancelar    = document.getElementById('btnCancelar');
  const elOkMsg         = document.getElementById('gestionOkMsg');
  const elAccionError   = document.getElementById('gestionAccionError');

  const formCambiar    = document.getElementById('gestionFormCambiar');
  const gFecha         = document.getElementById('gFecha');
  const gHora          = document.getElementById('gHora');
  const gPersonas      = document.getElementById('gPersonas');
  const btnGuardar     = document.getElementById('gGuardarBtn');
  const btnCancelarEd  = document.getElementById('gCancelarEdicion');

  const formConfirmCancelar = document.getElementById('gestionConfirmCancelar');
  const btnConfirmSi   = document.getElementById('gConfirmSiBtn');
  const btnConfirmNo   = document.getElementById('gConfirmNoBtn');

  // Texto original de los botones (viene ya traducido del HTML de cada
  // idioma) — se guarda para poder restaurarlo tras mostrar "Guardando…"/
  // "Cancelando…" sin tener que traducirlo de nuevo aquí.
  const txtGuardarOriginal = btnGuardar.textContent;
  const txtConfirmSiOriginal = btnConfirmSi.textContent;

  let reservaActual = null; // { id, nombre, fecha, hora, personas, estado, notas }

  function mostrarSolo(el) {
    [elCargando, elError, elDetalle, elCancelada].forEach(e => {
      if (e) e.style.display = e === el ? '' : 'none';
    });
  }

  function limpiarMensajes() {
    if (elOkMsg) { elOkMsg.style.display = 'none'; elOkMsg.textContent = ''; }
    if (elAccionError) { elAccionError.style.display = 'none'; elAccionError.textContent = ''; }
  }

  function mensajePorCodigo(codigo) {
    if (!codigo) return T.gErrGenerico || 'No se pudo completar la operación.';
    if (codigo.includes('YA_CANCELADA'))       return null; // se gestiona con la vista de cancelada
    if (codigo.includes('NO_ENCONTRADA'))      return T.gErrNoEncontrada || 'No hemos encontrado esa reserva.';
    if (codigo.includes('FECHA_PASADA'))       return T.gErrFechaPasada || 'Esa reserva ya pasó.';
    if (codigo.includes('PERSONAS_INVALIDAS')) return T.gErrPersonasInvalidas || 'Número de personas no válido.';
    if (codigo.includes('DIA_CERRADO'))        return T.errDiaCerrado || 'Ese día el restaurante está cerrado.';
    if (codigo.includes('CERRADO_TEMPORAL'))   return T.errCerradoTemporal || 'El restaurante permanece cerrado esas fechas.';
    if (codigo.includes('SIN_DISPONIBILIDAD')) return T.errSinCupo || 'Esa hora no tiene disponibilidad.';
    return T.gErrGenerico || 'No se pudo completar la operación.';
  }

  // ════════════════════════════════════════════════════════
  // Cargar la reserva a partir del token de la URL
  // ════════════════════════════════════════════════════════
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');

  async function cargarReserva() {
    if (!token || !supabaseClient) {
      if (elErrorMsg) elErrorMsg.textContent = T.gErrNoEncontrada || 'No hemos encontrado esa reserva.';
      mostrarSolo(elError);
      return;
    }

    const { data, error } = await supabaseClient.rpc('reserva_por_token', { p_token: token });
    if (error || !data || !data.length) {
      if (elErrorMsg) elErrorMsg.textContent = T.gErrNoEncontrada || 'No hemos encontrado esa reserva.';
      mostrarSolo(elError);
      return;
    }

    reservaActual = data[0];

    if (reservaActual.estado === 'cancelada') {
      mostrarSolo(elCancelada);
      return;
    }

    pintarDetalle();
    mostrarSolo(elDetalle);
  }

  function pintarDetalle() {
    if (!reservaActual) return;
    elEstadoEyebrow.textContent = reservaActual.estado === 'confirmada'
      ? (T.gEstadoConfirmada || 'Reserva confirmada')
      : (T.gEstadoPendiente || 'Pendiente de confirmar');
    elNombre.textContent     = reservaActual.nombre;
    elFechaTxt.textContent    = formatFecha(reservaActual.fecha);
    elHoraTxt.textContent     = reservaActual.hora;
    elPersonasTxt.textContent = T.gPersonasLabel ? T.gPersonasLabel(reservaActual.personas) : reservaActual.personas;

    if (reservaActual.notas) {
      elNotasTxt.textContent = reservaActual.notas;
      elNotasTxt.style.display = '';
    } else if (elNotasTxt) {
      elNotasTxt.style.display = 'none';
    }

    formCambiar.style.display = 'none';
    formConfirmCancelar.style.display = 'none';
    elAcciones.style.display = '';
    limpiarMensajes();
  }

  cargarReserva();

  // ════════════════════════════════════════════════════════
  // CAMBIAR FECHA / HORA / PERSONAS
  // ════════════════════════════════════════════════════════
  async function fetchDisponibilidadDia(fecha) {
    const esHoy = fecha === hoyStr;
    const ahora = new Date();
    const minActual = ahora.getHours() * 60 + ahora.getMinutes();
    const yaPaso = (hora) => {
      const [h, m] = hora.split(':').map(Number);
      return esHoy && (h * 60 + m) <= minActual + 30;
    };

    const { data, error } = await supabaseClient.rpc('disponibilidad_dia', { p_fecha: fecha });
    if (error) {
      console.error('Error al cargar disponibilidad del día:', error);
      return {};
    }
    const mapa = {};
    (data || []).forEach(fila => {
      mapa[fila.hora] = { disponibles: yaPaso(fila.hora) ? 0 : fila.disponibles };
    });
    return mapa;
  }

  async function renderHoraSelect(fecha) {
    gHora.innerHTML = `<option value="">…</option>`;
    const disponibilidad = await fetchDisponibilidadDia(fecha);
    const esFechaOriginal = fecha === reservaActual.fecha;

    let html = '';
    HORAS_CATALOGO.forEach(grupo => {
      html += `<optgroup label="${grupo.grupo}">`;
      grupo.horas.forEach(hora => {
        const info = disponibilidad[hora] || { disponibles: 0 };
        // La hora actual de la reserva sigue siendo válida en su propia
        // fecha aunque salga "sin cupo" en el cálculo del cliente: el
        // servidor excluye la propia fila al contar (ver migración
        // 20260721000000), así que no la deshabilitamos aquí.
        const esHoraActual = esFechaOriginal && hora === reservaActual.hora;
        const sinCupo = info.disponibles <= 0 && !esHoraActual;
        html += `<option value="${hora}" ${sinCupo ? 'disabled' : ''}>${hora}${sinCupo ? ' — ' + (T.sinMesasTitle || 'Sin mesas disponibles') : ''}</option>`;
      });
      html += '</optgroup>';
    });
    gHora.innerHTML = html;
    gHora.value = esFechaOriginal ? reservaActual.hora : '';
  }

  btnCambiar.addEventListener('click', () => {
    limpiarMensajes();
    elAcciones.style.display = 'none';
    formConfirmCancelar.style.display = 'none';
    formCambiar.style.display = '';

    gFecha.min = hoyStr;
    gFecha.value = reservaActual.fecha;
    gPersonas.value = reservaActual.personas;
    renderHoraSelect(reservaActual.fecha);
  });

  gFecha.addEventListener('change', () => {
    if (gFecha.value) renderHoraSelect(gFecha.value);
  });

  btnCancelarEd.addEventListener('click', () => {
    formCambiar.style.display = 'none';
    elAcciones.style.display = '';
  });

  btnGuardar.addEventListener('click', async () => {
    limpiarMensajes();
    if (!gFecha.value || !gHora.value || !gPersonas.value) {
      elAccionError.textContent = T.gErrGenerico || 'Revisa los datos e inténtalo de nuevo.';
      elAccionError.style.display = '';
      return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = T.gGuardando || 'Guardando…';

    const { data, error } = await supabaseClient.rpc('modificar_reserva_token', {
      p_token: token,
      p_fecha: gFecha.value,
      p_hora: gHora.value,
      p_personas: parseInt(gPersonas.value, 10),
    });

    btnGuardar.disabled = false;
    btnGuardar.textContent = txtGuardarOriginal;

    const resultado = data && data[0];
    if (error || !resultado || !resultado.ok) {
      const codigo = resultado ? resultado.mensaje : (error ? error.message : '');
      elAccionError.textContent = mensajePorCodigo(codigo) || (T.gErrGenerico || 'No se pudo completar la operación.');
      elAccionError.style.display = '';
      return;
    }

    // Refrescar con los datos ya actualizados
    reservaActual.fecha    = gFecha.value;
    reservaActual.hora     = gHora.value;
    reservaActual.personas = parseInt(gPersonas.value, 10);
    pintarDetalle();
    elOkMsg.textContent = T.gOkCambiada || '¡Listo! Hemos actualizado tu reserva.';
    elOkMsg.style.display = '';
  });

  // ════════════════════════════════════════════════════════
  // CANCELAR
  // ════════════════════════════════════════════════════════
  btnCancelar.addEventListener('click', () => {
    limpiarMensajes();
    elAcciones.style.display = 'none';
    formCambiar.style.display = 'none';
    formConfirmCancelar.style.display = '';
  });

  btnConfirmNo.addEventListener('click', () => {
    formConfirmCancelar.style.display = 'none';
    elAcciones.style.display = '';
  });

  btnConfirmSi.addEventListener('click', async () => {
    btnConfirmSi.disabled = true;
    btnConfirmSi.textContent = T.gCancelando || 'Cancelando…';

    const { data, error } = await supabaseClient.rpc('cancelar_reserva_token', { p_token: token });

    const resultado = data && data[0];
    if (error || !resultado || !resultado.ok) {
      btnConfirmSi.disabled = false;
      btnConfirmSi.textContent = txtConfirmSiOriginal;
      const codigo = resultado ? resultado.mensaje : (error ? error.message : '');
      elAccionError.textContent = mensajePorCodigo(codigo) || (T.gErrGenerico || 'No se pudo completar la operación.');
      elAccionError.style.display = '';
      formConfirmCancelar.style.display = 'none';
      elAcciones.style.display = '';
      return;
    }

    mostrarSolo(elCancelada);
  });

});
