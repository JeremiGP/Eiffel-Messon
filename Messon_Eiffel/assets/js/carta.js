/* ============================================================
   Mesón Cafetería de Eiffel — Lógica de la Carta (sidebar/tabs)
   Incluir solo en carta.html
   Patrón ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const sidebarBtns = Array.from(document.querySelectorAll('.sidebar-btn'));
  const cartaPanels = document.querySelectorAll('.carta-panel');

  if (!sidebarBtns.length) return;

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

    // En móvil: llevar el contenido a la vista
    if (window.innerWidth <= 900) {
      document.querySelector('.carta-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
