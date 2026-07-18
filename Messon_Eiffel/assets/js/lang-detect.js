/* ============================================================
   Mesón de Eiffel — Detección de idioma.
   Se incluye SIN defer/async, justo tras <meta charset>, en las
   15 páginas (es/en/fr) para poder redirigir antes de pintar nada.

   Reglas:
   - Primera visita nunca vista: si el navegador pide inglés o
     francés, redirige una sola vez a /en/... o /fr/... y recuerda
     la elección en localStorage.
   - Cualquier visita posterior (o cualquier cambio manual de idioma
     desde el pie de página) respeta lo que el usuario esté viendo:
     no hay redirecciones en bucle.
   ============================================================ */
(function () {
  'use strict';
  var KEY  = 'meson_lang';
  var path = window.location.pathname;
  var enFr = path.match(/^\/(en|fr)(\/|$)/);

  if (enFr) {
    try { localStorage.setItem(KEY, enFr[1]); } catch (e) {}
    return;
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}

  if (!saved) {
    var navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    var destino = navLang.indexOf('en') === 0 ? 'en' : (navLang.indexOf('fr') === 0 ? 'fr' : null);
    if (destino) {
      try { localStorage.setItem(KEY, destino); } catch (e) {}
      window.location.replace('/' + destino + path);
      return;
    }
  }

  try { localStorage.setItem(KEY, 'es'); } catch (e) {}
})();
