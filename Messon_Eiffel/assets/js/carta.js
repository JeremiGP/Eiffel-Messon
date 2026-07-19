/* ============================================================
   Mesón Cafetería de Eiffel — Lógica de la Carta (sidebar/tabs)
   Incluir solo en carta.html
   Patrón ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const T = window.MESON_I18N || {};
  const sidebarBtns = Array.from(document.querySelectorAll('.sidebar-btn'));
  const cartaPanels = document.querySelectorAll('.carta-panel');

  // ── PRECIOS EN VIVO (tabla `precios`, editable desde el admin) ──
  // Mismo patrón que reservas.js: si no hay config.js con claves
  // reales, esto simplemente no hace nada y la carta se queda con
  // los precios escritos en el HTML — el sitio nunca se rompe por
  // no tener Supabase configurado.
  (function cargarPreciosEnVivo() {
    const supabaseClient = (
      typeof SUPABASE_URL !== 'undefined' &&
      SUPABASE_URL && !SUPABASE_URL.includes('TU-PROYECTO') &&
      window.supabase
    ) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

    if (!supabaseClient) return;

    const fmt = (n) => {
      const num = Number(n);
      if (Number.isNaN(num)) return null;
      return num.toFixed(2).replace('.', ',') + ' €';
    };

    supabaseClient
      .from('precios')
      .select('producto_id, precio, precio_media, precio_entera')
      .then(({ data, error }) => {
        if (error || !data) return; // fallo de red/consulta → se queda el precio del HTML
        data.forEach((fila) => {
          if (fila.precio !== null) {
            const texto = fmt(fila.precio);
            const el = document.querySelector(`[data-precio-id="${fila.producto_id}"]`);
            if (el && texto) el.textContent = texto;
          }
          if (fila.precio_media !== null) {
            const texto = fmt(fila.precio_media);
            const el = document.querySelector(`[data-precio-id="${fila.producto_id}-media"]`);
            if (el && texto) el.textContent = texto;
          }
          if (fila.precio_entera !== null) {
            const texto = fmt(fila.precio_entera);
            const el = document.querySelector(`[data-precio-id="${fila.producto_id}-entera"]`);
            if (el && texto) el.textContent = texto;
          }
        });
      })
      .catch(() => { /* sin conexión: se queda el precio del HTML */ });
  })();

  if (!sidebarBtns.length) return;

  // ── DRAWER DE CATEGORÍAS (solo <900px) ─────────────────────
  const drawerToggle = document.getElementById('drawerToggle');
  const sidebar      = document.getElementById('cartaSidebar');
  const backdrop     = document.getElementById('cartaBackdrop');

  function setDrawer(open) {
    if (!drawerToggle || !sidebar || !backdrop) return;
    sidebar.classList.toggle('open', open);
    drawerToggle.classList.toggle('open', open);
    backdrop.classList.toggle('visible', open);
    document.body.classList.toggle('drawer-abierto', open);
    drawerToggle.setAttribute('aria-expanded', String(open));
    drawerToggle.setAttribute('aria-label', open ? (T.drawerCerrar || 'Cerrar categorías') : (T.drawerAbrir || 'Abrir categorías'));
  }

  if (drawerToggle && sidebar && backdrop) {
    // Flechita: abre / minimiza
    drawerToggle.addEventListener('click', () => {
      setDrawer(!sidebar.classList.contains('open'));
    });
    // Tocar fuera: cierra
    backdrop.addEventListener('click', () => setDrawer(false));
    // Escape: cierra
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        setDrawer(false);
        drawerToggle.focus();
      }
    });
    // Si se pasa a escritorio con el drawer abierto, limpiar estado
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) setDrawer(false);
    });
  }

  // ── SELECTOR INICIAL DE APARTADOS (solo <900px) ─────────────
  // Cada visita a la carta empieza con la pantalla de tarjetas.
  // La flechita del drawer no aparece hasta elegir un apartado.
  const selector = document.getElementById('cartaSelector');

  function cerrarSelector() {
    if (!selector) return;
    selector.classList.add('oculto');
    document.body.classList.remove('selector-abierto');
    document.body.classList.add('carta-iniciada'); // ← habilita la flechita
  }

  if (selector) {
    if (window.innerWidth <= 900) {
      // Bloquear el scroll de fondo mientras se elige
      document.body.classList.add('selector-abierto');
    } else {
      // Escritorio: el selector no participa
      selector.classList.add('oculto');
      document.body.classList.add('carta-iniciada');
    }

    selector.querySelectorAll('.selector-card').forEach(card => {
      card.addEventListener('click', () => {
        cerrarSelector();
        const btn = sidebarBtns.find(b => b.dataset.panel === card.dataset.panel);
        if (btn) activar(btn);
        // Entrar directamente arriba del contenido, sin animación
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      });
    });

    // Si la ventana pasa a escritorio, retirar el selector
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900 && !selector.classList.contains('oculto')) {
        cerrarSelector();
      }
    });
  }

  function activar(btn, { moverFoco = false } = {}) {
    const target = btn.dataset.panel;

    sidebarBtns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('tabindex', '-1');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    btn.setAttribute('tabindex', '0');
    if (moverFoco) btn.focus();

    cartaPanels.forEach(p => p.classList.remove('active'));
    const activePanel = document.getElementById('panel-' + target);
    if (activePanel) activePanel.classList.add('active');

    // Al elegir categoría en móvil: minimizar el drawer
    if (window.innerWidth <= 900) setDrawer(false);

    // Reset de posición: al cambiar de sección, subir al inicio del
    // contenido (en TODAS las resoluciones — antes solo en móvil, y en
    // escritorio el usuario quedaba "perdido" a mitad de la lista).
    const layout = document.querySelector('.carta-layout');
    if (layout) {
      const navH = document.getElementById('nav')?.offsetHeight || 70;
      const top  = layout.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }
  }

  sidebarBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => activar(btn));

    // Navegación por teclado (flechas ← → ↑ ↓, Home, End) — patrón ARIA tabs
    btn.addEventListener('keydown', (e) => {
      let nextIndex = null;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (i + 1) % sidebarBtns.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (i - 1 + sidebarBtns.length) % sidebarBtns.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = sidebarBtns.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      activar(sidebarBtns[nextIndex], { moverFoco: true });
    });
  });

});
