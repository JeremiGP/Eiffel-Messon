/* ============================================================
   Mesón Cafetería de Eiffel — Intro overlay (solo index.html)
   Antes vivía como <script> inline en index.html; se extrae a
   archivo propio para poder servir una Content-Security-Policy
   estricta sin 'unsafe-inline' en script-src.
   ============================================================ */

(function () {
  var overlay = document.getElementById('introOverlay');
  var btn     = document.getElementById('introBtn');
  if (!overlay || !btn) return;

  // Visita ya registrada en esta sesión → ocultar sin ninguna animación
  if (sessionStorage.getItem('intro_visto')) {
    overlay.classList.add('oculto');
    return;
  }

  // Mientras la intro está visible, la página de detrás NO debe
  // poder deslizarse (evita entrar "desubicado" a mitad de página)
  document.body.classList.add('intro-bloqueada');

  btn.addEventListener('click', function () {
    sessionStorage.setItem('intro_visto', '1');

    // Reset de posición: al entrar, la página empieza arriba del todo
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Fase 1: contenido se desvanece (0 → 0.38s)
    // Fase 2: cortina sube (0.2s → 1.1s)
    overlay.classList.add('saliendo');

    // Tras completarse la animación de la cortina → retirar del DOM
    setTimeout(function () {
      overlay.classList.add('oculto');
      document.body.classList.remove('intro-bloqueada');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 1150);
  });
})();
