/* ============================================================
   Mesón Cafetería de Eiffel — JavaScript principal
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── NAV SCROLL ──────────────────────────────────────────────
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 80);
  });

  // ── MENÚ MÓVIL ──────────────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    // Cerrar menú al hacer clic en un enlace
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

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

  // ── SUB-TABS (Para compartir / Brasas / etc.) ───────────────
  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById('sub-' + tab.dataset.sub);
      if (target) target.classList.add('active');
    });
  });

  // ── FECHA MÍNIMA EN FORMULARIO ──────────────────────────────
  const fechaInput = document.getElementById('fecha');
  if (fechaInput) {
    fechaInput.setAttribute('min', new Date().toISOString().split('T')[0]);
  }

  // ── FORMULARIO DE RESERVA ───────────────────────────────────
  const reservaForm = document.getElementById('reservaForm');
  if (reservaForm) {
    reservaForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = this.querySelector('.form-submit');
      btn.textContent = 'Enviando…';
      btn.disabled = true;

      // TODO: Conectar con Supabase
      // const datos = {
      //   nombre:   this.querySelector('#nombre').value,
      //   telefono: this.querySelector('#telefono').value,
      //   email:    this.querySelector('#email').value,
      //   fecha:    this.querySelector('#fecha').value,
      //   hora:     this.querySelector('#hora').value,
      //   personas: this.querySelector('#personas').value,
      //   notas:    this.querySelector('#notas').value,
      // };
      // await supabase.from('reservas').insert([datos]);

      // Simulación mientras no hay backend:
      setTimeout(() => {
        btn.textContent = '✓ Reserva enviada — te confirmamos pronto';
        btn.style.background = '#2d7a4f';
      }, 800);
    });
  }

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
