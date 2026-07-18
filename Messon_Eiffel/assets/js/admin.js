/* ============================================================
   Mesón Cafetería de Eiffel — Panel de Administración · Lógica

   ⚠️  AVISO DE SEGURIDAD — LEER ANTES DE PUBLICAR ESTE SITIO ⚠️
   ------------------------------------------------------------
   Mientras assets/js/config.js no tenga las claves reales de
   Supabase, este panel funciona en "modo demo": credenciales
   ADMIN/123456789 embebidas en este archivo y reservas guardadas
   en localStorage (solo en este navegador, no persisten de verdad
   ni se sincronizan entre dispositivos). Cualquiera que abra el
   código fuente puede ver esas credenciales de demo.

   En cuanto config.js tenga SUPABASE_URL/SUPABASE_ANON_KEY reales,
   este mismo archivo cambia automáticamente a modo real:
   autenticación con Supabase Auth y CRUD contra la tabla
   `reservas` (ver supabase/migrations/20260701000000_init_reservas.sql
   y 20260706000000_capacidad_disponibilidad.sql).
   ============================================================ */

'use strict';

// ── CONFIGURACIÓN ────────────────────────────────────────────
// Credenciales de DEMO — solo se usan si no hay Supabase configurado
const CREDENCIALES = { usuario: 'ADMIN', password: '123456789' };
const STORAGE_KEY  = 'meson_reservas';
const AUTH_KEY     = 'meson_admin_auth';
const FILAS_POR_PAGINA = 20;

// Misma regex práctica de email que usa el formulario público —
// mantenerla consistente evita que el panel acepte datos que la
// web pública rechazaría.
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Catálogo de franjas para agrupar la agenda del día (mismo orden
// que supabase/migrations/20260706000000_capacidad_disponibilidad.sql
// + 20260718000000_nuevo_horario.sql)
const HORAS_CATALOGO = [
  { grupo: 'Desayuno', horas: ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'] },
  { grupo: 'Comida',    horas: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'] },
  { grupo: 'Cena',      horas: ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30'] },
];

// ── CLIENTE DE SUPABASE (si config.js tiene claves reales) ────
const supabaseClient = (
  typeof SUPABASE_URL !== 'undefined' &&
  SUPABASE_URL && !SUPABASE_URL.includes('TU-PROYECTO') &&
  window.supabase
) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ── ESTADO ────────────────────────────────────────────────────
let reservas         = [];
let capacidadPorHora = {};   // { '13:00': 20, ... } — desde capacidad_horarios
let editingId        = null;
let pendingDeleteId   = null; // eliminación individual
let pendingBulkIds    = null; // eliminación en lote
let filtros           = { estado: '', fechaDesde: '', fechaHasta: '', texto: '' };
let orden             = { campo: 'created_at', direccion: 'desc' };
let paginaActual      = 1;
let seleccionadas     = new Set();
let vistaActual       = 'hoy'; // 'hoy' | 'todas'
let realtimeChannel   = null;

// ── UTILIDADES ────────────────────────────────────────────────
function generarId() {
  return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function formatFecha(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function hoy() {
  return new Date().toISOString().split('T')[0];
}

// Formatea una fecha local a YYYY-MM-DD sin desfases de zona horaria
// (a diferencia de toISOString, que convierte a UTC)
function fechaLocalISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

// Calcula { desde, hasta } para cada atajo de rango de fechas del panel
function calcularRangoPreset(preset) {
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);

  if (preset === 'hoy') {
    const iso = fechaLocalISO(ahora);
    return { desde: iso, hasta: iso };
  }
  if (preset === 'semana') {
    // Lunes a domingo de la semana actual
    const diaSemana = (ahora.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo
    const lunes = new Date(ahora);
    lunes.setDate(ahora.getDate() - diaSemana);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    return { desde: fechaLocalISO(lunes), hasta: fechaLocalISO(domingo) };
  }
  if (preset === 'mes') {
    const primero = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const ultimo  = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
    return { desde: fechaLocalISO(primero), hasta: fechaLocalISO(ultimo) };
  }
  if (preset === 'mesPasado') {
    const primero = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const ultimo  = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
    return { desde: fechaLocalISO(primero), hasta: fechaLocalISO(ultimo) };
  }
  // 'todo' → sin restricción
  return { desde: '', hasta: '' };
}

// Marca visualmente el atajo de rango activo (o ninguno, si se edita a mano)
function activarPreset(preset) {
  document.querySelectorAll('.preset-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.preset === preset);
  });
}

function desactivarPresets() {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// "personas" es TEXT en la base (admite el legado "9+" de antes de
// que el formulario público pidiera un número exacto). Para lo que
// necesitamos aquí (ordenar, detectar grupos grandes) lo tratamos
// como número, con "9+" cayendo a un valor razonable.
function personasNumero(valor) {
  if (valor === '9+') return 9;
  const n = parseInt(valor, 10);
  return Number.isFinite(n) ? n : 0;
}
function esGrupoGrande(valor) {
  return personasNumero(valor) > 8;
}

// Deriva enlaces de "llamar" y "WhatsApp" a partir del teléfono guardado.
// Contempla dos formatos reales en la tabla:
//   - Nuevo (con selector de prefijo): "+34 600000000"
//   - Legado (antes del selector, siempre España): "600000000"
function telefonoInfo(raw) {
  const texto = (raw || '').trim();
  const tienePrefijo = texto.startsWith('+');
  const soloDigitos  = texto.replace(/\D/g, '');
  const e164 = tienePrefijo ? soloDigitos : ('34' + soloDigitos);
  return {
    display: texto || '—',
    tel: '+' + e164,
    wa:  e164,
  };
}

const ESTADO_CFG = {
  pendiente:  { label: 'Pendiente',  css: 'badge--pendiente' },
  confirmada: { label: 'Confirmada', css: 'badge--confirmada' },
  cancelada:  { label: 'Cancelada',  css: 'badge--cancelada' },
};

// ── CARGA / GUARDADO ───────────────────────────────────────────
async function cargarReservas() {
  if (supabaseClient) {
    const [resReservas, resCapacidad] = await Promise.all([
      supabaseClient.from('reservas').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('capacidad_horarios').select('hora, capacidad_mesas'),
    ]);

    if (resReservas.error) {
      console.error('Error al cargar reservas de Supabase:', resReservas.error);
      reservas = [];
    } else {
      reservas = resReservas.data || [];
    }

    if (resCapacidad.error) {
      // No es crítico: la agenda simplemente no mostrará la barra de
      // ocupación, pero todo lo demás sigue funcionando.
      console.error('Error al cargar capacidad_horarios:', resCapacidad.error);
      capacidadPorHora = {};
    } else {
      capacidadPorHora = {};
      (resCapacidad.data || []).forEach(row => { capacidadPorHora[row.hora] = row.capacidad_mesas; });
    }
    return;
  }

  // Modo demo
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    reservas = raw ? JSON.parse(raw) : [];
  } catch {
    reservas = [];
  }
  // En demo asumimos 20 mesas por franja para poder enseñar la
  // barra de ocupación de la agenda sin necesitar Supabase.
  capacidadPorHora = {};
  HORAS_CATALOGO.forEach(g => g.horas.forEach(h => { capacidadPorHora[h] = 20; }));
}

function guardarReservas() {
  // Solo aplica en modo demo. En modo real cada función ya escribe
  // directamente en Supabase (ver agregarReserva/actualizarReserva/eliminarReserva).
  if (!supabaseClient) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
  }
}

// ── AUTENTICACIÓN ─────────────────────────────────────────────
async function estaLogueado() {
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    return !!data.session;
  }
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

async function login(usuario, password) {
  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: usuario,
      password,
    });
    return !error;
  }
  if (usuario === CREDENCIALES.usuario && password === CREDENCIALES.password) {
    sessionStorage.setItem(AUTH_KEY, '1');
    return true;
  }
  return false;
}

async function logout() {
  detenerRealtime();
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  } else {
    sessionStorage.removeItem(AUTH_KEY);
  }
  mostrarLogin();
}

// ── CRUD DE RESERVAS ──────────────────────────────────────────
async function agregarReserva(data) {
  const payload = {
    nombre:   data.nombre,
    telefono: data.telefono,
    email:    data.email || null,
    fecha:    data.fecha,
    hora:     data.hora,
    personas: data.personas,
    notas:    data.notas || null,
    estado:   data.estado || 'pendiente',
  };

  if (supabaseClient) {
    const { data: inserted, error } = await supabaseClient
      .from('reservas')
      .insert([payload])
      .select()
      .single();
    if (error) {
      console.error('Error al añadir reserva:', error);
      mostrarToast('No se pudo guardar la reserva.', 'error');
      return null;
    }
    reservas.unshift(inserted);
    return inserted;
  }

  const nueva = { id: generarId(), ...payload, created_at: new Date().toISOString() };
  reservas.unshift(nueva);
  guardarReservas();
  return nueva;
}

async function actualizarReserva(id, data) {
  if (supabaseClient) {
    const { error } = await supabaseClient.from('reservas').update(data).eq('id', id);
    if (error) {
      console.error('Error al actualizar reserva:', error);
      mostrarToast('No se pudo actualizar la reserva.', 'error');
      return false;
    }
    const idx = reservas.findIndex(r => r.id === id);
    if (idx !== -1) reservas[idx] = { ...reservas[idx], ...data };
    return true;
  }

  const idx = reservas.findIndex(r => r.id === id);
  if (idx === -1) return false;
  reservas[idx] = { ...reservas[idx], ...data };
  guardarReservas();
  return true;
}

async function eliminarReserva(id) {
  if (supabaseClient) {
    const { error } = await supabaseClient.from('reservas').delete().eq('id', id);
    if (error) {
      console.error('Error al eliminar reserva:', error);
      mostrarToast('No se pudo eliminar la reserva.', 'error');
      return false;
    }
    const idx = reservas.findIndex(r => r.id === id);
    if (idx !== -1) reservas.splice(idx, 1);
    return true;
  }

  const idx = reservas.findIndex(r => r.id === id);
  if (idx === -1) return false;
  reservas.splice(idx, 1);
  guardarReservas();
  return true;
}

async function cambiarEstado(id, nuevoEstado) {
  return actualizarReserva(id, { estado: nuevoEstado });
}

// ── FILTRADO + ORDEN ──────────────────────────────────────────
function getFiltradas() {
  const filtradas = reservas.filter(r => {
    if (filtros.estado && r.estado !== filtros.estado) return false;
    if (filtros.fechaDesde && r.fecha < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && r.fecha > filtros.fechaHasta) return false;
    if (filtros.texto) {
      const q = filtros.texto.toLowerCase();
      const coincide =
        r.nombre.toLowerCase().includes(q) ||
        r.telefono.includes(q) ||
        (r.email || '').toLowerCase().includes(q);
      if (!coincide) return false;
    }
    return true;
  });

  const { campo, direccion } = orden;
  const signo = direccion === 'asc' ? 1 : -1;
  filtradas.sort((a, b) => {
    let va = a[campo] ?? '';
    let vb = b[campo] ?? '';
    if (campo === 'fecha') {
      // "fecha" + "hora" combinadas para que el orden por fecha
      // también sea cronológico dentro del mismo día
      va = `${a.fecha} ${a.hora}`;
      vb = `${b.fecha} ${b.hora}`;
    }
    if (va < vb) return -1 * signo;
    if (va > vb) return  1 * signo;
    return 0;
  });

  return filtradas;
}

function getPaginaActual(filtradas) {
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;
  const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
  return {
    filas: filtradas.slice(inicio, inicio + FILAS_POR_PAGINA),
    totalPaginas,
  };
}

// ── VISTAS ────────────────────────────────────────────────────
function mostrarLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('dashboardSection').classList.add('hidden');
}

async function mostrarDashboard() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
  await recargarTodo();
  iniciarRealtime();
}

async function recargarTodo(mostrarSpinner) {
  const btnRefrescar = document.getElementById('btn-refrescar');
  if (mostrarSpinner && btnRefrescar) btnRefrescar.classList.add('is-loading');
  await cargarReservas();
  renderTodo();
  if (mostrarSpinner && btnRefrescar) btnRefrescar.classList.remove('is-loading');
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────
function renderTodo() {
  renderStats();
  if (vistaActual === 'hoy') {
    renderAgendaHoy();
  } else {
    renderTabla();
  }
}

function renderStats() {
  document.getElementById('stat-total').textContent      = reservas.length;
  document.getElementById('stat-pendientes').textContent  = reservas.filter(r => r.estado === 'pendiente').length;
  document.getElementById('stat-confirmadas').textContent = reservas.filter(r => r.estado === 'confirmada').length;
  document.getElementById('stat-canceladas').textContent = reservas.filter(r => r.estado === 'cancelada').length;

  // Ocupación de hoy = reservas activas de hoy / capacidad total del día
  const capacidadTotal = Object.values(capacidadPorHora).reduce((a, b) => a + b, 0);
  const ocupadasHoy = reservas.filter(r => r.fecha === hoy() && r.estado !== 'cancelada').length;
  const elOcupacion = document.getElementById('stat-ocupacion');
  if (capacidadTotal > 0) {
    const pct = Math.round((ocupadasHoy / capacidadTotal) * 100);
    elOcupacion.textContent = `${pct}%`;
  } else {
    elOcupacion.textContent = '—';
  }
}

// ── AGENDA DE HOY ──────────────────────────────────────────────
function nivelOcupacion(ocupadas, capacidad) {
  if (!capacidad) return 'alta';
  const libres = Math.max(capacidad - ocupadas, 0);
  const ratio = libres / capacidad;
  if (libres === 0) return 'completo';
  if (ratio <= 0.25) return 'baja';
  if (ratio <= 0.6)  return 'media';
  return 'alta';
}

function renderAgendaHoy() {
  const cont = document.getElementById('agendaContenido');
  const fechaLbl = document.getElementById('agendaFechaHoy');
  const hoyStr = hoy();

  const fechaFormateada = new Date(hoyStr + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  fechaLbl.textContent = fechaFormateada;

  const reservasHoy = reservas.filter(r => r.fecha === hoyStr);

  if (reservasHoy.length === 0) {
    cont.innerHTML = '<p class="agenda-vacio">No hay reservas para hoy.</p>';
    return;
  }

  let html = '';
  HORAS_CATALOGO.forEach(grupo => {
    const slotsConReservas = grupo.horas.filter(h => reservasHoy.some(r => r.hora === h));
    if (slotsConReservas.length === 0) return;

    html += `<div class="agenda-grupo"><div class="agenda-grupo-titulo">${grupo.grupo}</div>`;

    slotsConReservas.forEach(hora => {
      const delSlot   = reservasHoy.filter(r => r.hora === hora);
      const activas   = delSlot.filter(r => r.estado !== 'cancelada');
      const capacidad = capacidadPorHora[hora] || 0;
      const nivel     = nivelOcupacion(activas.length, capacidad);

      html += `
        <div class="agenda-slot">
          <div class="agenda-slot-header">
            <span class="agenda-slot-hora">${hora}</span>
            ${capacidad ? `
              <div class="ocupacion-bar">
                <div class="ocupacion-bar-fill nivel-${nivel}" style="width:${Math.min(100, (activas.length / capacidad) * 100)}%"></div>
              </div>
              <span class="agenda-slot-cupo">${activas.length}/${capacidad} mesas</span>
            ` : ''}
          </div>`;

      // Ordenadas por hora de creación para que el host vea el orden real de llegada de reservas
      delSlot
        .slice()
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
        .forEach(r => { html += renderAgendaCard(r); });

      html += `</div>`;
    });

    html += `</div>`;
  });

  cont.innerHTML = html;
}

function renderAgendaCard(r) {
  const cfg = ESTADO_CFG[r.estado] || ESTADO_CFG.pendiente;
  const tel = telefonoInfo(r.telefono);
  const grande = esGrupoGrande(r.personas) ? '<span class="badge-grande">Grupo grande</span>' : '';
  const notas = r.notas ? `
    <span class="notas-flag" title="${escHtml(r.notas)}">
      <svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 4 21h16a2 2 0 0 0 1.89-2.96L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
    </span>` : '';
  const opacidad = r.estado === 'cancelada' ? 'style="opacity:.55"' : '';

  const btnConfirmar = r.estado !== 'confirmada' ? `
    <button class="act-btn act-confirm" title="Confirmar" data-accion="confirmar" data-id="${r.id}">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    </button>` : '';
  const btnCancelar = r.estado !== 'cancelada' ? `
    <button class="act-btn act-cancel" title="Marcar cancelada" data-accion="cancelar" data-id="${r.id}">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>` : '';

  return `
    <div class="agenda-card" ${opacidad}>
      <div class="agenda-card-main">
        <div class="agenda-card-nombre">${escHtml(r.nombre)}</div>
        <div class="agenda-card-meta">${escHtml(r.personas)} pers. · <span class="badge ${cfg.css}">${cfg.label}</span></div>
      </div>
      <div class="agenda-card-badges">
        ${grande}
        ${notas}
        <div class="contact-links">
          <a class="contact-btn contact-btn--call" href="tel:${tel.tel}" title="Llamar">
            <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.28h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.72 16.92z"/></svg>
          </a>
          <a class="contact-btn contact-btn--wa" href="https://wa.me/${tel.wa}" target="_blank" rel="noopener" title="WhatsApp">
            <svg viewBox="0 0 32 32"><path d="M16 2C8.3 2 2 8.3 2 16c0 2.5.7 4.9 1.9 7L2 30l7.2-1.9c2 1.1 4.3 1.7 6.8 1.7 7.7 0 14-6.3 14-14S23.7 2 16 2zm0 25.3c-2.2 0-4.3-.6-6.1-1.7l-.4-.3-4.3 1.1 1.2-4.2-.3-.4C4.9 20 4.2 18 4.2 16 4.2 9.5 9.5 4.2 16 4.2S27.8 9.5 27.8 16 22.5 27.3 16 27.3zm6.4-8.4c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.7.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.3 2.4 3.6 5.8 5.1.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 2-.8 2.2-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.6-.4z"/></svg>
          </a>
        </div>
      </div>
      <div class="agenda-card-acciones">
        <button class="act-btn act-edit" title="Editar" data-accion="editar" data-id="${r.id}">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        ${btnConfirmar}
        ${btnCancelar}
        <button class="act-btn act-delete" title="Eliminar" data-accion="eliminar" data-id="${r.id}">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`;
}

// Delegación de eventos para los botones de acción rápida (editar,
// confirmar, cancelar, eliminar), tanto en la agenda como en la
// tabla — un único listener en document en vez de re-enganchar
// listeners cada vez que se re-renderiza el HTML.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;
  const { accion, id } = btn.dataset;
  if (accion === 'editar')    abrirModal(id);
  if (accion === 'confirmar') cambioRapidoEstado(id, 'confirmada');
  if (accion === 'cancelar')  cambioRapidoEstado(id, 'cancelada');
  if (accion === 'eliminar')  confirmarEliminacion(id);
});

// ── TABLA (VISTA "TODAS") ──────────────────────────────────────
function renderTabla() {
  const filtradas = getFiltradas();
  const { filas, totalPaginas } = getPaginaActual(filtradas);
  const tbody = document.getElementById('reservas-tbody');

  actualizarIndicadoresOrden();

  if (filas.length === 0) {
    const hayFiltros = filtros.estado || filtros.fechaDesde || filtros.fechaHasta || filtros.texto;
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="15" y2="17"/>
          </svg>
          <p>${hayFiltros
            ? 'No hay reservas que coincidan con los filtros aplicados.'
            : 'Aún no hay reservas registradas.'
          }</p>
          ${!hayFiltros
            ? '<button class="btn-add-empty" onclick="abrirModal()">Añadir primera reserva</button>'
            : ''
          }
        </td>
      </tr>`;
    actualizarPaginacion(1, 1);
    return;
  }

  tbody.innerHTML = filas.map(r => {
    const cfg = ESTADO_CFG[r.estado] || ESTADO_CFG.pendiente;
    const tel = telefonoInfo(r.telefono);
    const grande = esGrupoGrande(r.personas) ? '<span class="badge-grande">Grande</span>' : '';
    const notas = r.notas ? `
      <span class="notas-flag" title="${escHtml(r.notas)}">
        <svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 4 21h16a2 2 0 0 0 1.89-2.96L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
      </span>` : '';

    const btnConfirmar = r.estado !== 'confirmada' ? `
      <button class="act-btn act-confirm" title="Confirmar" data-accion="confirmar" data-id="${r.id}">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </button>` : '';

    const btnCancelar = r.estado !== 'cancelada' ? `
      <button class="act-btn act-cancel" title="Marcar cancelada" data-accion="cancelar" data-id="${r.id}">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>` : '';

    return `
      <tr>
        <td class="td-check"><input type="checkbox" class="row-check" data-id="${r.id}" ${seleccionadas.has(r.id) ? 'checked' : ''} aria-label="Seleccionar reserva de ${escHtml(r.nombre)}"></td>
        <td class="td-nombre">${escHtml(r.nombre)} ${notas} ${grande}</td>
        <td>
          <div class="contact-links">
            <span>${escHtml(tel.display)}</span>
            <a class="contact-btn contact-btn--call" href="tel:${tel.tel}" title="Llamar"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.28h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.72 16.92z"/></svg></a>
            <a class="contact-btn contact-btn--wa" href="https://wa.me/${tel.wa}" target="_blank" rel="noopener" title="WhatsApp"><svg viewBox="0 0 32 32"><path d="M16 2C8.3 2 2 8.3 2 16c0 2.5.7 4.9 1.9 7L2 30l7.2-1.9c2 1.1 4.3 1.7 6.8 1.7 7.7 0 14-6.3 14-14S23.7 2 16 2zm0 25.3c-2.2 0-4.3-.6-6.1-1.7l-.4-.3-4.3 1.1 1.2-4.2-.3-.4C4.9 20 4.2 18 4.2 16 4.2 9.5 9.5 4.2 16 4.2S27.8 9.5 27.8 16 22.5 27.3 16 27.3zm6.4-8.4c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.7.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.3 2.4 3.6 5.8 5.1.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 2-.8 2.2-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.6-.4z"/></svg></a>
          </div>
        </td>
        <td class="td-email col-email">${r.email ? escHtml(r.email) : '<span class="nd">—</span>'}</td>
        <td>${formatFecha(r.fecha)}</td>
        <td>${escHtml(r.hora)}</td>
        <td class="td-personas col-personas">${escHtml(r.personas)}</td>
        <td><span class="badge ${cfg.css}">${cfg.label}</span></td>
        <td class="td-actions">
          <button class="act-btn act-edit" title="Editar" data-accion="editar" data-id="${r.id}">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ${btnConfirmar}
          ${btnCancelar}
          <button class="act-btn act-delete" title="Eliminar" data-accion="eliminar" data-id="${r.id}">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.row-check').forEach(chk => {
    chk.addEventListener('change', () => {
      if (chk.checked) seleccionadas.add(chk.dataset.id);
      else seleccionadas.delete(chk.dataset.id);
      actualizarBulkBar();
    });
  });

  actualizarPaginacion(paginaActual, totalPaginas);
}

function actualizarIndicadoresOrden() {
  document.querySelectorAll('.th-sort').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === orden.campo) {
      th.classList.add(orden.direccion === 'asc' ? 'sort-asc' : 'sort-desc');
      // aria-sort: anuncia la columna y dirección de orden activas
      th.setAttribute('aria-sort', orden.direccion === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('aria-sort');
    }
  });
}

function actualizarPaginacion(actual, total) {
  document.getElementById('pag-info').textContent = `Página ${actual} de ${total}`;
  document.getElementById('pag-prev').disabled = actual <= 1;
  document.getElementById('pag-next').disabled = actual >= total;
}

// ── SELECCIÓN Y ACCIONES EN LOTE ───────────────────────────────
function actualizarBulkBar() {
  const bar = document.getElementById('bulkBar');
  const count = seleccionadas.size;
  document.getElementById('bulkCount').textContent =
    count === 1 ? '1 reserva seleccionada' : `${count} reservas seleccionadas`;
  bar.classList.toggle('hidden', count === 0);

  const checkAll = document.getElementById('check-all');
  const visibles = Array.from(document.querySelectorAll('.row-check'));
  checkAll.checked = visibles.length > 0 && visibles.every(c => c.checked);
}

async function ejecutarAccionEnLote(nuevoEstado) {
  const ids = Array.from(seleccionadas);
  await Promise.all(ids.map(id => cambiarEstado(id, nuevoEstado)));
  seleccionadas.clear();
  renderTodo();
  actualizarBulkBar();
  mostrarToast(`${ids.length} reserva(s) actualizada(s).`);
}

// ── VISTAS: TABS HOY / TODAS ────────────────────────────────────
function cambiarVista(nueva) {
  vistaActual = nueva;
  document.getElementById('tab-hoy').classList.toggle('active', nueva === 'hoy');
  document.getElementById('tab-todas').classList.toggle('active', nueva === 'todas');
  document.getElementById('tab-hoy').setAttribute('aria-selected', String(nueva === 'hoy'));
  document.getElementById('tab-todas').setAttribute('aria-selected', String(nueva === 'todas'));
  document.getElementById('vista-hoy').classList.toggle('hidden', nueva !== 'hoy');
  document.getElementById('vista-todas').classList.toggle('hidden', nueva !== 'todas');
  renderTodo();
}

// ── MODAL DE RESERVA ──────────────────────────────────────────
function abrirModal(id = null) {
  editingId = id;
  const modal = document.getElementById('modal');
  const titulo = document.getElementById('modal-title');
  const form   = document.getElementById('reserva-form');

  form.reset();
  limpiarErroresModal();

  if (id) {
    const r = reservas.find(r => r.id === id);
    if (!r) return;
    titulo.textContent    = 'Editar reserva';
    form.nombre.value     = r.nombre;
    form.telefono.value   = r.telefono;
    form.email.value      = r.email || '';
    form.fecha.value      = r.fecha;
    form.hora.value       = r.hora;
    form.personas.value   = r.personas;
    form.notas.value      = r.notas || '';
    form.estado.value     = r.estado;
  } else {
    titulo.textContent  = 'Nueva reserva';
    form.fecha.value    = hoy();
    form.estado.value   = 'pendiente';
  }

  modal.classList.remove('hidden');
  requestAnimationFrame(() => {
    modal.classList.add('open');
    form.nombre.focus();
  });
  actualizarDisponibilidadHint();
}

function cerrarModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('open');
  setTimeout(() => { modal.classList.add('hidden'); editingId = null; }, 300);
}

// ── VALIDACIÓN DEL MODAL (consistente con el formulario público) ──
function limpiarErroresModal() {
  ['f-telefono', 'f-email', 'f-personas'].forEach(id => {
    const el = document.getElementById(id);
    const err = document.getElementById(id + '-error');
    if (el) el.style.borderColor = '';
    if (err) err.remove();
  });
}

function marcarErrorModal(id, mensaje) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'rgb(192,57,43)';
  let err = document.getElementById(id + '-error');
  if (!err) {
    err = document.createElement('p');
    err.id = id + '-error';
    err.className = 'field-error';
    err.style.color = 'var(--rojo)';
    err.style.fontSize = '0.72rem';
    err.style.marginTop = '-0.6rem';
    el.insertAdjacentElement('afterend', err);
  }
  err.textContent = mensaje;
}

function validarFormularioModal() {
  limpiarErroresModal();
  const form = document.getElementById('reserva-form');
  let ok = true;

  const telefono = form.telefono.value.trim();
  const digitos = telefono.replace(/\D/g, '');
  if (!telefono) {
    marcarErrorModal('f-telefono', 'El teléfono es obligatorio.'); ok = false;
  } else if (digitos.length < 6) {
    marcarErrorModal('f-telefono', 'Ese número parece incompleto.'); ok = false;
  }

  const email = form.email.value.trim();
  if (email && !EMAIL_RE.test(email)) {
    marcarErrorModal('f-email', 'Revisa el formato del email.'); ok = false;
  }

  const personas = form.personas.value.trim();
  const nPersonas = parseInt(personas, 10);
  if (!personas) {
    marcarErrorModal('f-personas', 'Indica el número de personas.'); ok = false;
  } else if (!/^\d+$/.test(personas)) {
    marcarErrorModal('f-personas', 'Escribe solo el número de personas.'); ok = false;
  } else if (nPersonas < 1 || nPersonas > 80) {
    // Mismo rango que el CHECK reservas_personas_rango de la base
    marcarErrorModal('f-personas', 'El número debe estar entre 1 y 80.'); ok = false;
  }

  return ok;
}

// Muestra cuántas mesas quedan libres para la fecha/hora elegidas en
// el modal, calculado con los datos ya cargados en memoria (no hace
// falta otra llamada a Supabase). Ayuda a no reservar por encima del
// aforo real cuando se añade una reserva a mano.
function actualizarDisponibilidadHint() {
  const hintEl = document.getElementById('disponibilidadHint');
  if (!hintEl) return;
  const fecha = document.getElementById('f-fecha').value;
  const hora  = document.getElementById('f-hora').value;

  if (!fecha || !hora) { hintEl.textContent = ''; hintEl.className = 'disponibilidad-hint'; return; }

  const capacidad = capacidadPorHora[hora];
  if (!capacidad) { hintEl.textContent = ''; hintEl.className = 'disponibilidad-hint'; return; }

  const ocupadas = reservas.filter(r =>
    r.fecha === fecha && r.hora === hora && r.estado !== 'cancelada' && r.id !== editingId
  ).length;
  const libres = Math.max(capacidad - ocupadas, 0);

  hintEl.textContent = libres > 0
    ? `Quedan ${libres} de ${capacidad} mesas para esa hora.`
    : `Sin mesas libres a esa hora (${ocupadas}/${capacidad}) — se puede guardar igual, pero revisa el aforo.`;
  hintEl.className = 'disponibilidad-hint ' + (libres === 0 ? 'full' : libres <= capacidad * 0.25 ? 'warn' : 'ok');
}

// ── CAMBIO RÁPIDO DE ESTADO ───────────────────────────────────
async function cambioRapidoEstado(id, nuevoEstado) {
  if (await cambiarEstado(id, nuevoEstado)) {
    renderTodo();
    mostrarToast(`Reserva marcada como ${ESTADO_CFG[nuevoEstado].label.toLowerCase()}.`);
  }
}

// ── MODAL CONFIRMAR ELIMINACIÓN (individual o en lote) ────────
function confirmarEliminacion(id) {
  const r = reservas.find(r => r.id === id);
  if (!r) return;
  pendingDeleteId = id;
  pendingBulkIds  = null;
  document.getElementById('confirm-title').textContent = 'Eliminar reserva';
  document.getElementById('confirm-text').innerHTML =
    `¿Seguro que quieres eliminar la reserva de <strong id="confirm-nombre">${escHtml(r.nombre)}</strong>? Esta acción no se puede deshacer.`;
  abrirConfirmModal();
}

function confirmarEliminacionLote(ids) {
  pendingBulkIds  = ids;
  pendingDeleteId = null;
  document.getElementById('confirm-title').textContent = 'Eliminar reservas';
  document.getElementById('confirm-text').innerHTML =
    `¿Seguro que quieres eliminar <strong>${ids.length}</strong> reserva(s)? Esta acción no se puede deshacer.`;
  abrirConfirmModal();
}

function abrirConfirmModal() {
  const confirmModal = document.getElementById('confirmModal');
  confirmModal.classList.remove('hidden');
  requestAnimationFrame(() => confirmModal.classList.add('open'));
}

function cerrarConfirmModal() {
  const confirmModal = document.getElementById('confirmModal');
  confirmModal.classList.remove('open');
  setTimeout(() => {
    confirmModal.classList.add('hidden');
    pendingDeleteId = null;
    pendingBulkIds  = null;
  }, 300);
}

async function ejecutarEliminacion() {
  if (pendingBulkIds && pendingBulkIds.length) {
    await Promise.all(pendingBulkIds.map(id => eliminarReserva(id)));
    seleccionadas.clear();
    renderTodo();
    actualizarBulkBar();
    mostrarToast('Reservas eliminadas.');
  } else if (pendingDeleteId) {
    if (await eliminarReserva(pendingDeleteId)) {
      renderTodo();
      mostrarToast('Reserva eliminada.');
    }
  }
  cerrarConfirmModal();
}

// ── EXPORTAR CSV ───────────────────────────────────────────────
// Construye el CSV (cabecera + filas) a partir de un array de reservas
function construirCSV(filas) {
  const cabecera = ['Nombre', 'Teléfono', 'Email', 'Fecha', 'Hora', 'Personas', 'Estado', 'Notas', 'Creada'];
  // Escapado CSV correcto: envolver en comillas y duplicar comillas internas
  const csvCampo = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;

  const filasCsv = filas.map(r => [
    r.nombre, r.telefono, r.email || '', r.fecha, r.hora, r.personas,
    ESTADO_CFG[r.estado]?.label || r.estado, r.notas || '', r.created_at || '',
  ].map(csvCampo).join(','));

  return [cabecera.map(csvCampo).join(','), ...filasCsv].join('\r\n');
}

// Dispara la descarga de un string CSV ya construido
function descargarCSV(csv, nombreArchivo) {
  // BOM para que Excel detecte UTF-8 y no rompa las tildes/ñ
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Exporta solo lo que se ve ahora mismo (respeta filtros/rango de fechas)
function exportarCSV() {
  const filas = getFiltradas();
  if (filas.length === 0) {
    mostrarToast('No hay reservas que exportar con los filtros actuales.', 'error');
    return;
  }
  const sufijoRango = (filtros.fechaDesde || filtros.fechaHasta)
    ? `_${filtros.fechaDesde || 'inicio'}_a_${filtros.fechaHasta || 'hoy'}`
    : '';
  descargarCSV(construirCSV(filas), `reservas_meson_eiffel${sufijoRango}.csv`);
}

// Exporta el histórico completo, ignorando cualquier filtro o rango activo
function exportarTodoCSV() {
  if (reservas.length === 0) {
    mostrarToast('No hay reservas registradas todavía.', 'error');
    return;
  }
  descargarCSV(construirCSV(reservas), `reservas_meson_eiffel_TODO_${hoy()}.csv`);
}

// ── REALTIME (mejor esfuerzo: si falla, el botón Actualizar sigue funcionando) ──
function iniciarRealtime() {
  if (!supabaseClient) return;
  try {
    realtimeChannel = supabaseClient
      .channel('admin-reservas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, async () => {
        await cargarReservas();
        renderTodo();
      })
      .subscribe((status) => {
        actualizarIndicadorRealtime(status === 'SUBSCRIBED');
      });
  } catch (e) {
    console.warn('No se pudo activar la actualización en vivo:', e);
    actualizarIndicadorRealtime(false);
  }
}

function detenerRealtime() {
  if (realtimeChannel && supabaseClient) {
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function actualizarIndicadorRealtime(activo) {
  const dot = document.getElementById('realtimeDot');
  if (!dot) return;
  dot.hidden = false;
  dot.classList.toggle('off', !activo);
  dot.title = activo
    ? 'Actualización en vivo activa'
    : 'Actualización en vivo no disponible — usa el botón Actualizar';
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer = null;
function mostrarToast(msg, tipo = 'success') {
  const toast = document.getElementById('toast');
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className   = `toast toast--${tipo} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ── INICIALIZACIÓN ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // ── LOGIN ──
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const usuario  = document.getElementById('login-usuario').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errEl    = document.getElementById('login-error');
    const btn      = document.querySelector('.login-btn');

    btn.disabled = true;
    const ok = await login(usuario, password);
    btn.disabled = false;

    if (ok) {
      errEl.classList.add('hidden');
      await mostrarDashboard();
    } else {
      errEl.textContent = 'Usuario o contraseña incorrectos.';
      errEl.classList.remove('hidden');
      document.getElementById('login-password').value = '';
      document.getElementById('login-password').focus();
    }
  });

  // ── LOGOUT ──
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm('¿Cerrar sesión?')) await logout();
  });

  // ── ACTUALIZAR MANUAL ──
  document.getElementById('btn-refrescar').addEventListener('click', () => recargarTodo(true));

  // ── TABS DE VISTA ──
  document.getElementById('tab-hoy').addEventListener('click', () => cambiarVista('hoy'));
  document.getElementById('tab-todas').addEventListener('click', () => cambiarVista('todas'));

  // ── IMPRIMIR AGENDA ──
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

  // ── FILTROS ──
  document.getElementById('filtro-estado').addEventListener('change', e => {
    filtros.estado = e.target.value; paginaActual = 1; renderTabla();
  });
  document.getElementById('filtro-fecha-desde').addEventListener('change', e => {
    filtros.fechaDesde = e.target.value;
    desactivarPresets();
    paginaActual = 1; renderTabla();
  });
  document.getElementById('filtro-fecha-hasta').addEventListener('change', e => {
    filtros.fechaHasta = e.target.value;
    desactivarPresets();
    paginaActual = 1; renderTabla();
  });
  document.getElementById('filtro-texto').addEventListener('input', e => {
    filtros.texto = e.target.value.trim(); paginaActual = 1; renderTabla();
  });
  document.getElementById('btn-limpiar').addEventListener('click', () => {
    filtros = { estado: '', fechaDesde: '', fechaHasta: '', texto: '' };
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-fecha-desde').value = '';
    document.getElementById('filtro-fecha-hasta').value = '';
    document.getElementById('filtro-texto').value  = '';
    activarPreset('todo');
    paginaActual = 1;
    renderTabla();
  });

  // ── ATAJOS DE RANGO (Hoy / Esta semana / Este mes / Mes pasado / Todo) ──
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const { desde, hasta } = calcularRangoPreset(btn.dataset.preset);
      filtros.fechaDesde = desde;
      filtros.fechaHasta = hasta;
      document.getElementById('filtro-fecha-desde').value = desde;
      document.getElementById('filtro-fecha-hasta').value = hasta;
      activarPreset(btn.dataset.preset);
      paginaActual = 1;
      renderTabla();
    });
  });

  // ── ORDENAR COLUMNAS (click y teclado, son <th> con role="button") ──
  function alternarOrden(th) {
    const campo = th.dataset.sort;
    if (orden.campo === campo) {
      orden.direccion = orden.direccion === 'asc' ? 'desc' : 'asc';
    } else {
      orden.campo = campo; orden.direccion = 'asc';
    }
    renderTabla();
  }
  document.querySelectorAll('.th-sort').forEach(th => {
    th.addEventListener('click', () => alternarOrden(th));
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarOrden(th); }
    });
  });

  // ── PAGINACIÓN ──
  document.getElementById('pag-prev').addEventListener('click', () => {
    if (paginaActual > 1) { paginaActual--; renderTabla(); }
  });
  document.getElementById('pag-next').addEventListener('click', () => {
    paginaActual++; renderTabla();
  });

  // ── SELECCIÓN EN LOTE ──
  document.getElementById('check-all').addEventListener('change', (e) => {
    document.querySelectorAll('.row-check').forEach(chk => {
      chk.checked = e.target.checked;
      if (e.target.checked) seleccionadas.add(chk.dataset.id);
      else seleccionadas.delete(chk.dataset.id);
    });
    actualizarBulkBar();
  });
  document.getElementById('bulk-confirmar').addEventListener('click', () => ejecutarAccionEnLote('confirmada'));
  document.getElementById('bulk-cancelar').addEventListener('click',  () => ejecutarAccionEnLote('cancelada'));
  document.getElementById('bulk-eliminar').addEventListener('click', () => {
    if (seleccionadas.size) confirmarEliminacionLote(Array.from(seleccionadas));
  });
  document.getElementById('bulk-limpiar').addEventListener('click', () => {
    seleccionadas.clear();
    document.querySelectorAll('.row-check').forEach(chk => { chk.checked = false; });
    actualizarBulkBar();
  });

  // ── EXPORTAR CSV ──
  document.getElementById('btn-exportar').addEventListener('click', exportarCSV);
  document.getElementById('btn-exportar-todo').addEventListener('click', exportarTodoCSV);

  // ── NUEVA RESERVA ──
  document.getElementById('btn-nueva').addEventListener('click', () => abrirModal());

  // ── HINT DE DISPONIBILIDAD EN VIVO ──
  document.getElementById('f-fecha').addEventListener('change', actualizarDisponibilidadHint);
  document.getElementById('f-hora').addEventListener('change', actualizarDisponibilidadHint);

  // ── FORMULARIO SUBMIT ──
  document.getElementById('reserva-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validarFormularioModal()) return;

    const form = e.target;
    const data = {
      nombre:   form.nombre.value.trim(),
      telefono: form.telefono.value.trim(),
      email:    form.email.value.trim(),
      fecha:    form.fecha.value,
      hora:     form.hora.value,
      // La columna `personas` es INT en la base (migración 20260710120000)
      personas: parseInt(form.personas.value.trim(), 10),
      notas:    form.notas.value.trim(),
      estado:   form.estado.value,
    };

    const btnGuardar = form.querySelector('.btn-guardar');
    btnGuardar.disabled = true;

    if (editingId) {
      if (await actualizarReserva(editingId, data)) {
        mostrarToast('Reserva actualizada correctamente.');
      }
    } else {
      if (await agregarReserva(data)) {
        mostrarToast('Reserva añadida correctamente.');
      }
    }

    btnGuardar.disabled = false;
    cerrarModal();
    renderTodo();
  });

  // ── CIERRE DE MODALES ──
  document.getElementById('modal-close').addEventListener('click', cerrarModal);
  document.getElementById('btn-cancelar-form').addEventListener('click', cerrarModal);
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) cerrarModal();
  });

  document.getElementById('btn-cancelar-delete').addEventListener('click', cerrarConfirmModal);
  document.getElementById('btn-confirmar-delete').addEventListener('click', ejecutarEliminacion);
  document.getElementById('confirmModal').addEventListener('click', e => {
    if (e.target === document.getElementById('confirmModal')) cerrarConfirmModal();
  });

  // ── ESCAPE CIERRA CUALQUIER MODAL ABIERTO ──
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modal').classList.contains('open')) cerrarModal();
    if (document.getElementById('confirmModal').classList.contains('open')) cerrarConfirmModal();
  });

  // ── ARRANQUE ──
  if (await estaLogueado()) {
    await mostrarDashboard();
  } else {
    mostrarLogin();
  }
});
