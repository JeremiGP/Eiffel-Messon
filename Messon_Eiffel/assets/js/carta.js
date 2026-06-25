/* ============================================================
   Mesón Cafetería de Eiffel — Lógica de la Carta
   Incluir solo en carta.html
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── TABS PRINCIPALES (Desayunos / Comidas) ──────────────────
  document.querySelectorAll('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.main-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById('main-' + tab.dataset.main);
      if (target) target.classList.add('active');
    });
  });

  // ── SUB-TABS (Para compartir / Con dos huevos / Brasas / Dulces) ─
  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById('sub-' + tab.dataset.sub);
      if (target) target.classList.add('active');
    });
  });

});
