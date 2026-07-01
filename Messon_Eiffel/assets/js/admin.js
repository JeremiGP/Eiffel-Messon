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
   `reservas` (ver supabase/migrations/20260701000000_init_reservas.sql).

   Para pasar a modo real hace falta además:
     1. Crear el usuario admin en el dashboard de Supabase:
        Authentication → Users → Add user (con email + contraseña).
     2. Iniciar sesión en el panel con ese email y esa contraseña.
   ============================================================ */

'use strict';

// ── CONFIGURACIÓN ─────────────────────────────────────────────
// Credenciales de DEMO — solo se usan si no hay Supabase configurado
const CREDENCIALES = { usuario: 'ADMIN', password: '123456789' };
const STORAGE_KEY  = 'meson_reservas';
const AUTH_KEY     = 'meson_admin_auth';

// ── CLIENTE DE SUPABASE (si config.js tiene claves reales) ────
const supabaseClient = (
  typeof SUPABASE_URL !== 'undefined' &&
  SUPABASE_URL && !SUPABASE_URL.includes('TU-PROYECTO') &&
  window.supabase
) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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

// ── CARGA / GUARDADO ───────────────────────────────────────────
async function cargarReservas() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('reservas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error al cargar reservas de Supabase:', error);
      reservas = [];
      return;
    }
    reservas = data || [];
    return;
  }
  // Modo demo
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    reservas = raw ? JSON.parse(raw) : [];
  } catch {
    reservas = [];
  }
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

async function mostrarDashboard() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
  await cargarReservas();
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
async function cambioRapidoEstado(id, nuevoEstado) {
  if (await cambiarEstado(id, nuevoEstado)) {
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

async function ejecutarEliminacion() {
  if (pendingDeleteId && await eliminarReserva(pendingDeleteId)) {
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
document.addEventListener('DOMContentLoaded', async () => {

  // ── LOGIN ──
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const usuario  = document.getElementById('login-usuario').value.trim();
    const password = document.getElementById('login-password').value;
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
  document.getElementById('reserva-form').addEventListener('submit', async e => {
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
  if (await estaLogueado()) {
    await mostrarDashboard();
  } else {
    mostrarLogin();
  }
});
