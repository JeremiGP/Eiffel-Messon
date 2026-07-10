/* ============================================================
   Mesón Cafetería de Eiffel — Nav + Scroll Reveal
   Incluir en TODAS las páginas.
   ============================================================ */

// ── RESET DE SCROLL ───────────────────────────────────────────
// El navegador restaura la posición de scroll anterior al navegar
// o volver atrás → el usuario "aparece" abajo. Lo desactivamos y
// forzamos que cada vista empiece SIEMPRE arriba del todo.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
// behavior:'instant' evita que scroll-behavior:smooth anime el reset
window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

// También al restaurar desde la caché de atrás/adelante (bfcache)
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
});

document.addEventListener('DOMContentLoaded', () => {

  // ── NAV SCROLL ──────────────────────────────────────────────
  const nav = document.getElementById('nav');
  if (nav) {
    // passive: el listener nunca hace preventDefault → el navegador puede
    // hacer scroll sin esperar al JS (mejor rendimiento de scroll)
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 80);
    }, { passive: true });
  }

  // ── MENÚ MÓVIL ──────────────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    const setOpen = (open) => {
      navLinks.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };
    navToggle.addEventListener('click', () => {
      setOpen(!navLinks.classList.contains('open'));
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => setOpen(false));
    });
    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        setOpen(false);
        navToggle.focus();
      }
    });
  }

  // ── ACTIVE LINK (marca la página actual en el nav) ──────────
  const currentFile = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === currentFile) {
      a.classList.add('active');
      // aria-current: los lectores de pantalla anuncian "página actual"
      a.setAttribute('aria-current', 'page');
    }
  });

  // ── SCROLL REVEAL ───────────────────────────────────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.07 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

});
