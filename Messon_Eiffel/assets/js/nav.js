/* ============================================================
   Mesón Cafetería de Eiffel — Nav + Scroll Reveal
   Incluir en TODAS las páginas
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── NAV SCROLL ──────────────────────────────────────────────
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 80);
    });
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
