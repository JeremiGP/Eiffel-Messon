/* ============================================================
   Mesón Cafetería de Eiffel — Panel de Administración · Lógica

   ⚠️  AVISO DE SEGURIDAD — LEER ANTES DE PUBLICAR ESTE SITIO ⚠️
   ------------------------------------------------------------
   Este panel usa credenciales de DEMO embebidas en el JavaScript
   del cliente y guarda las reservas en localStorage (solo en
   este navegador). Cualquiera que abra el código fuente puede
   ver el usuario y la contraseña, y los datos no se sincronizan
   entre dispositivos ni persisten de verdad.

   NO USAR EN PRODUCCIÓN TAL CUAL. Antes de publicar:
     1. Sustituir CREDENCIALES + login manual por Supabase Auth
        (o el proveedor de auth que se use).
     2. Sustituir cargarReservas()/guardarReservas() (localStorage)
        por llamadas reales a supabase.from('reservas')...
     3. Conectar también el formulario público (reservas.js) a la
        misma tabla — hoy solo simula el envío.
   Ver supabase/schema.sql para el esquema y las políticas RLS
   ya preparadas para este flujo.
   ============================================================ */

'use strict';

// ── CONFIGURACIÓN ─────────────────────────────────────────────
// TODO: credenciales de DEMO — sustituir por autenticación real (ver aviso arriba)
const CREDENCIALES = { usuario: 'ADMIN', password: '123456789' };
const STORAGE_KEY  = 'meson_reservas';
const AUTH_KEY     = 'meson_admin_auth';

// ── ESTADO ────────────────────────────────────────────────────
let reservas        = [];
let editingId       = null;
let pendingDeleteId = null;
let filtros         = { estado: '', fecha: '', texto: '' };

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

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ESTADO_CFG = {
  pendiente:  { label: 'Pendiente',  css: 'badge--pendiente' },
  confirmada: { label: 'Confirmada', css: 'badge--confirmada' },
  cancelada:  { label: 'Cancelada',  css: 'badge--cancelada' },
};

// ── STORAGE ───────────────────────────────────────────────────
function cargarReservas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    reservas = raw ? JSON.parse(raw) : [];
  } catch {
    reservas = [];
  }
}

function guardarReservas() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas));
}

// ── AUTENTICACIÓN ─────────────────────────────────────────────
function estaLogueado() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

function login(usuario, password) {
  if (usuario === CREDENCIALES.usuario && password === CREDENCIALES.password) {
    sessionStorage.setItem(AUTH_KEY, '1');
    return true;
  }
  return false;
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  mostrarLogin();
}

// ── CRUD DE RESERVAS ──────────────────────────────────────────
function agregarReserva(data) {
  const nueva = {
    id:         generarId(),
    nombre:     data.nombre,
    telefono:   data.telefono,
    email:      data.email || '',
    fecha:      data.fecha,
    hora:       data.hora,
    personas:   data.personas,
    notas:      data.notas || '',
    estado:     data.estado || 'pendiente',
    created_at: new Date().toISOString(),
  };
  reservas.unshift(nueva);
  guardarReservas();
  return nueva;
}

function actualizarReserva(id, data) {
  const idx = reservas.findIndex(r => r.id === id);
  if (idx === -1) return false;
  reservas[idx] = { ...reservas[idx], ...data };
  guardarReservas();
  return true;
}

function eliminarReserva(id) {
  const idx = reservas.findIndex(r => r.id === id);
  if (idx === -1) return false;
  reservas.splice(idx, 1);
  guardarReservas();
  return true;
}

function cambiarEstado(id, nuevoEstado) {
  return actualizarReserva(id, { estado: nuevoEstado });
}

// ── FILTRADO ──────────────────────────────────────────────────
function getFiltradas() {
  return reservas.filter(r => {
    if (filtros.estado && r.estado !== filtros.estado) return false;
    if (filtros.fecha  && r.fecha  !== filtros.fecha)  return false;
    if (filtros.texto) {
      const q = filtros.texto.toLowerCase();
      if (!r.nombre.toLowerCase().includes(q) && !r.telefono.includes(q)) return false;
    }
    return true;
  });
}

// ── VISTAS ────────────────────────────────────────────────────
function mostrarLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('dashboardSection').classList.add('hidden');
}

function mostrarDashboard() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
  cargarReservas();
  render();
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────
function render() {
  renderStats();
  renderTabla();
}

function renderStats() {
  document.getElementById('stat-total').textContent      = reservas.length;
  document.getElementById('stat-pendientes').textContent  = reservas.filter(r => r.estado === 'pendiente').length;
  document.getElementById('stat-confirmadas').textContent = reservas.filter(r => r.estado === 'confirmada').length;
  document.getElementById('stat-canceladas').textContent  = reservas.filter(r => r.estado === 'cancelada').length;
}

function renderTabla() {
  const filtradas = getFiltradas();
  const tbody     = document.getElementById('reservas-tbody');

  if (filtradas.length === 0) {
    const hayFiltros = filtros.estado || filtros.fecha || filtros.texto;
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
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
    return;
  }

  tbody.innerHTML = filtradas.map(r => {
    const cfg = ESTADO_CFG[r.estado] || ESTADO_CFG.pendiente;

    const btnConfirmar = r.estado !== 'confirmada' ? `
      <button class="act-btn act-confirm" title="Confirmar" onclick="cambioRapidoEstado('${r.id}', 'confirmada')">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </button>` : '';

    const btnCancelar = r.estado !== 'cancelada' ? `
      <button class="act-btn act-cancel" title="Marcar cancelada" onclick="cambioRapidoEstado('${r.id}', 'cancelada')">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>` : '';

    return `
      <tr>
        <td class="td-nombre">${escHtml(r.nombre)}</td>
        <td>${escHtml(r.telefono)}</td>
        <td class="td-email">${r.email ? escHtml(r.email) : '<span class="nd">—</span>'}</td>
        <td>${formatFecha(r.fecha)}</td>
        <td>${escHtml(r.hora)}</td>
        <td class="td-personas">${escHtml(r.personas)}</td>
        <td><span class="badge ${cfg.css}">${cfg.label}</span></td>
        <td class="td-actions">
          <button class="act-btn act-edit" title="Editar" onclick="abrirModal('${r.id}')">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ${btnConfirmar}
          ${btnCancelar}
          <button class="act-btn act-delete" title="Eliminar" onclick="confirmarEliminacion('${r.id}')">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');
}

// ── MODAL DE RESERVA ──────────────────────────────────────────
function abrirModal(id = null) {
  editingId = id;
  const modal = document.getElementById('modal');
  const titulo = document.getElementById('modal-title');
  const form   = document.getElementById('reserva-form');

  form.reset();

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
  requestAnimationFrame(() => modal.classList.add('open'));
}

function cerrarModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('open');
  setTimeout(() => { modal.classList.add('hidden'); editingId = null; }, 300);
}

// ── CAMBIO RÁPIDO DE ESTADO ───────────────────────────────────
function cambioRapidoEstado(id, nuevoEstado) {
  if (cambiarEstado(id, nuevoEstado)) {
    render();
    mostrarToast(`Reserva marcada como ${ESTADO_CFG[nuevoEstado].label.toLowerCase()}.`);
  }
}

// ── MODAL CONFIRMAR ELIMINACIÓN ───────────────────────────────
function confirmarEliminacion(id) {
  const r = reservas.find(r => r.id === id);
  if (!r) return;
  pendingDeleteId = id;
  document.getElementById('confirm-nombre').textContent = r.nombre;
  const confirmModal = document.getElementById('confirmModal');
  confirmModal.classList.remove('hidden');
  requestAnimationFrame(() => confirmModal.classList.add('open'));
}

function cerrarConfirmModal() {
  const confirmModal = document.getElementById('confirmModal');
  confirmModal.classList.remove('open');
  setTimeout(() => { confirmModal.classList.add('hidden'); pendingDeleteId = null; }, 300);
}

function ejecutarEliminacion() {
  if (pendingDeleteId && eliminarReserva(pendingDeleteId)) {
    render();
    mostrarToast('Reserva eliminada.');
  }
  cerrarConfirmModal();
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
document.addEventListener('DOMContentLoaded', () => {

  // ── LOGIN ──
  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const usuario  = document.getElementById('login-usuario').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');

    if (login(usuario, password)) {
      errEl.classList.add('hidden');
      mostrarDashboard();
    } else {
      errEl.textContent = 'Usuario o contraseña incorrectos.';
      errEl.classList.remove('hidden');
      document.getElementById('login-password').value = '';
      document.getElementById('login-password').focus();
    }
  });

  // ── LOGOUT ──
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) logout();
  });

  // ── FILTROS ──
  document.getElementById('filtro-estado').addEventListener('change', e => {
    filtros.estado = e.target.value;
    renderTabla();
  });
  document.getElementById('filtro-fecha').addEventListener('change', e => {
    filtros.fecha = e.target.value;
    renderTabla();
  });
  document.getElementById('filtro-texto').addEventListener('input', e => {
    filtros.texto = e.target.value.trim();
    renderTabla();
  });
  document.getElementById('btn-limpiar').addEventListener('click', () => {
    filtros = { estado: '', fecha: '', texto: '' };
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-fecha').value  = '';
    document.getElementById('filtro-texto').value  = '';
    renderTabla();
  });

  // ── NUEVA RESERVA ──
  document.getElementById('btn-nueva').addEventListener('click', () => abrirModal());

  // ── FORMULARIO SUBMIT ──
  document.getElementById('reserva-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const data = {
      nombre:   form.nombre.value.trim(),
      telefono: form.telefono.value.trim(),
      email:    form.email.value.trim(),
      fecha:    form.fecha.value,
      hora:     form.hora.value,
      personas: form.personas.value,
      notas:    form.notas.value.trim(),
      estado:   form.estado.value,
    };

    if (editingId) {
      actualizarReserva(editingId, data);
      mostrarToast('Reserva actualizada correctamente.');
    } else {
      agregarReserva(data);
      mostrarToast('Reserva añadida correctamente.');
    }

    cerrarModal();
    render();
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

  // ── ARRANQUE ──
  if (estaLogueado()) {
    mostrarDashboard();
  } else {
    mostrarLogin();
  }
});
