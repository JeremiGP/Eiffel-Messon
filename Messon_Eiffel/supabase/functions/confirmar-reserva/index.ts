// ============================================================
// Mesón Cafetería de Eiffel — Edge Function: email de confirmación
// ------------------------------------------------------------
// Se invoca desde un Database Webhook de Supabase cada vez que se
// inserta una fila en `reservas`. Si la reserva trae email, envía
// un correo de "solicitud recibida" con Resend.
//
// Despliegue (ver README.md de esta carpeta):
//   supabase functions deploy confirmar-reserva --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=re_xxx WEBHOOK_SECRET=xxx
// ============================================================

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

// Remitente: el dominio debe estar verificado en Resend. Mientras el
// dominio no esté verificado, se puede definir el secret FROM_ADDRESS
// como "onboarding@resend.dev" (modo prueba: solo entrega al email del
// dueño de la cuenta de Resend).
const FROM = Deno.env.get('FROM_ADDRESS') ??
  'Mesón Cafetería de Eiffel <reservas@mesoncafeteriadeeiffel.es>';

interface ReservaRecord {
  nombre: string;
  email: string | null;
  fecha: string;    // YYYY-MM-DD
  hora: string;     // HH:MM
  personas: number;
  idioma?: string;  // 'es' | 'en' | 'fr' (migración 20260719000000; puede faltar en filas antiguas)
  token_gestion?: string; // UUID (migración 20260721000000); enlace de autogestión
}

type Idioma = 'es' | 'en' | 'fr';

function normalizarIdioma(v: string | undefined | null): Idioma {
  return v === 'en' || v === 'fr' ? v : 'es';
}

const LOCALES: Record<Idioma, string> = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR' };

// Página pública de autogestión (ver pages/gestionar.html), una por idioma
// (mismo patrón de carpetas que el resto del sitio: es en raíz, en/ y fr/).
const URL_GESTION: Record<Idioma, string> = {
  es: 'https://mesoncafeteriadeeiffel.es/pages/gestionar.html',
  en: 'https://mesoncafeteriadeeiffel.es/en/pages/gestionar.html',
  fr: 'https://mesoncafeteriadeeiffel.es/fr/pages/gestionar.html',
};

function formatFecha(iso: string, idioma: Idioma): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALES[idioma], {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// Textos por idioma. Mismo patrón que assets/js/i18n-strings.js: nombres de
// platos/marca en español, solo se traduce el texto de interfaz.
const TEXTOS: Record<Idioma, {
  asunto: (fechaHora: string, hora: string) => string;
  hola: (nombre: string) => string;
  recibido: string;
  fecha: string; hora: string; personas: string;
  confirmacion: string;
  llamar: string;
  gestionarBtn: string;
  gestionarSub: string;
}> = {
  es: {
    asunto: (fecha, hora) => `Solicitud de reserva recibida — ${fecha}, ${hora}`,
    hola: (nombre) => `Hola ${nombre},`,
    recibido: 'Hemos recibido tu solicitud de reserva:',
    fecha: 'Fecha', hora: 'Hora', personas: 'Personas',
    confirmacion: 'Te <strong>confirmaremos la disponibilidad por teléfono</strong> en breve. Si necesitas cambiar algo, llámanos al',
    llamar: '958 87 24 24',
    gestionarBtn: 'Gestionar mi reserva',
    gestionarSub: 'También puedes cambiar la fecha/hora o cancelar tú mismo desde este enlace, sin llamar:',
  },
  en: {
    asunto: (fecha, hora) => `Booking request received — ${fecha}, ${hora}`,
    hola: (nombre) => `Hi ${nombre},`,
    recibido: "We've received your booking request:",
    fecha: 'Date', hora: 'Time', personas: 'People',
    confirmacion: "We'll <strong>confirm availability by phone</strong> shortly. If you need to change anything, call us at",
    llamar: '+34 958 87 24 24',
    gestionarBtn: 'Manage my booking',
    gestionarSub: "You can also change the date/time or cancel it yourself from this link, no call needed:",
  },
  fr: {
    asunto: (fecha, hora) => `Demande de réservation reçue — ${fecha}, ${hora}`,
    hola: (nombre) => `Bonjour ${nombre},`,
    recibido: 'Nous avons bien reçu votre demande de réservation :',
    fecha: 'Date', hora: 'Heure', personas: 'Personnes',
    confirmacion: "Nous vous <strong>confirmerons la disponibilité par téléphone</strong> sous peu. Pour tout changement, appelez-nous au",
    llamar: '+34 958 87 24 24',
    gestionarBtn: 'Gérer ma réservation',
    gestionarSub: 'Vous pouvez aussi changer la date/l’heure ou annuler vous-même depuis ce lien, sans appeler :',
  },
};

function plantillaHtml(r: ReservaRecord, idioma: Idioma): string {
  const t = TEXTOS[idioma];
  const enlaceGestion = r.token_gestion ? `${URL_GESTION[idioma]}?t=${r.token_gestion}` : null;
  // Texto plano + HTML mínimo: máxima entregabilidad, sin imágenes remotas
  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1A110A">
    <h1 style="font-weight:normal;color:#5C3317">Mesón <em style="color:#B8833A">de Eiffel</em></h1>
    <p>${t.hola(r.nombre.split(' ')[0])}</p>
    <p>${t.recibido}</p>
    <table style="border-collapse:collapse;margin:1em 0">
      <tr><td style="padding:4px 12px 4px 0"><strong>${t.fecha}</strong></td><td>${formatFecha(r.fecha, idioma)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>${t.hora}</strong></td><td>${r.hora}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>${t.personas}</strong></td><td>${r.personas}</td></tr>
    </table>
    <p>${t.confirmacion} <a href="tel:+34958872424">${t.llamar}</a>.</p>
    ${enlaceGestion ? `
    <p style="margin-top:1.4em">${t.gestionarSub}</p>
    <p style="margin:0.6em 0 1.4em">
      <a href="${enlaceGestion}" style="display:inline-block;padding:10px 22px;background:#5C3317;color:#fff;text-decoration:none;border-radius:4px;font-family:Georgia,serif">${t.gestionarBtn}</a>
    </p>` : ''}
    <p style="color:#6B5C4E;font-size:0.9em">C/ Rio Mundo, Local 2 · 18600 Motril, Granada</p>
  </div>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // ── Autenticación del webhook ────────────────────────────
  // El Database Webhook debe mandar la cabecera x-webhook-secret
  // con el mismo valor que el secret WEBHOOK_SECRET. Evita que
  // cualquiera dispare emails llamando a la función directamente.
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('No autorizado', { status: 401 });
  }
  if (!RESEND_API_KEY) {
    return new Response('RESEND_API_KEY sin configurar', { status: 500 });
  }

  // Payload estándar de Database Webhooks: { type, table, record, ... }
  const payload = await req.json().catch(() => null);
  const r: ReservaRecord | undefined = payload?.record;

  if (payload?.type !== 'INSERT' || payload?.table !== 'reservas' || !r) {
    return new Response('Payload no reconocido', { status: 400 });
  }
  // Sin email no hay nada que enviar (el email es opcional en el formulario)
  if (!r.email) {
    return new Response(JSON.stringify({ enviado: false, motivo: 'sin email' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const idioma = normalizarIdioma(r.idioma);
  const t = TEXTOS[idioma];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [r.email],
      subject: t.asunto(formatFecha(r.fecha, idioma), r.hora),
      html: plantillaHtml(r, idioma),
    }),
  });

  if (!res.ok) {
    const detalle = await res.text();
    console.error('Resend devolvió error:', res.status, detalle);
    // 200 igualmente: el webhook no debe reintentar en bucle por un
    // email fallido — la reserva ya está guardada, que es lo crítico.
    return new Response(JSON.stringify({ enviado: false, motivo: 'error resend' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ enviado: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
