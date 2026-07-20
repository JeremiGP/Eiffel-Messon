// ============================================================
// Mesón Cafetería de Eiffel — Edge Function: recordatorio 24h antes
// ------------------------------------------------------------
// Se invoca desde un Cron Job de Supabase (pg_cron + pg_net) cada hora
// en punto. La propia función comprueba si son las 10:00 en Madrid
// antes de hacer nada: así el envío siempre es a las 10:00 locales,
// sin que el cambio de horario de verano/invierno (CET/CEST) lo
// desajuste — que es justo el problema de programar el cron
// directamente en UTC con una hora fija.
//
// A las 10:00 de Madrid, busca las reservas CONFIRMADAS de mañana con
// email y manda un recordatorio a cada una, reutilizando la misma
// cuenta de Resend que confirmar-reserva.
//
// Despliegue (ver README.md de esta carpeta):
//   supabase functions deploy recordatorio-reserva --no-verify-jwt
//   supabase secrets set CRON_SECRET=un-valor-largo-aleatorio
//   (RESEND_API_KEY y FROM_ADDRESS ya existen, los usa confirmar-reserva)
// ============================================================

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY');
const CRON_SECRET     = Deno.env.get('CRON_SECRET');
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo en
// toda edge function — no hace falta configurarlos a mano.
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const FROM = Deno.env.get('FROM_ADDRESS') ??
  'Mesón Cafetería de Eiffel <reservas@mesoncafeteriadeeiffel.es>';

// Hora local (0-23) de Madrid a la que se manda el recordatorio.
const HORA_ENVIO_MADRID = 10;

interface ReservaRecord {
  nombre: string;
  email: string | null;
  fecha: string;    // YYYY-MM-DD
  hora: string;      // HH:MM
  personas: number;
  idioma?: string;   // 'es' | 'en' | 'fr'
  token_gestion?: string; // UUID (migración 20260721000000); enlace de autogestión
}

type Idioma = 'es' | 'en' | 'fr';

function normalizarIdioma(v: string | undefined | null): Idioma {
  return v === 'en' || v === 'fr' ? v : 'es';
}

const LOCALES: Record<Idioma, string> = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR' };

// Dominio del sitio publicado. mesoncafeteriadeeiffel.es todavía apunta a
// la web antigua que este proyecto va a sustituir — no cambia hasta que
// el cliente lo apruebe. Hasta entonces, el sitio real vive en Netlify.
// Cuando llegue ese momento: supabase secrets set SITE_URL=https://mesoncafeteriadeeiffel.es
// (sin barra final) y no hace falta tocar este archivo.
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://eiffel-meson.netlify.app').replace(/\/$/, '');

// Misma página de autogestión que usa confirmar-reserva (ver pages/gestionar.html)
const URL_GESTION: Record<Idioma, string> = {
  es: `${SITE_URL}/pages/gestionar.html`,
  en: `${SITE_URL}/en/pages/gestionar.html`,
  fr: `${SITE_URL}/fr/pages/gestionar.html`,
};

function formatFecha(iso: string, idioma: Idioma): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALES[idioma], {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// Mismo patrón de textos por idioma que confirmar-reserva/index.ts.
const TEXTOS: Record<Idioma, {
  asunto: (fecha: string) => string;
  hola: (nombre: string) => string;
  cuerpo: string;
  fecha: string; hora: string; personas: string;
  cambiar: string;
  llamar: string;
  gestionarBtn: string;
}> = {
  es: {
    asunto: (fecha) => `Recordatorio: tu reserva es mañana, ${fecha}`,
    hola: (nombre) => `Hola ${nombre},`,
    cuerpo: 'Te recordamos tu reserva de mañana:',
    fecha: 'Fecha', hora: 'Hora', personas: 'Personas',
    cambiar: 'Si necesitas cambiar algo o cancelar, hazlo tú mismo desde aquí, o llámanos al',
    llamar: '958 87 24 24',
    gestionarBtn: 'Gestionar mi reserva',
  },
  en: {
    asunto: (fecha) => `Reminder: your booking is tomorrow, ${fecha}`,
    hola: (nombre) => `Hi ${nombre},`,
    cuerpo: "Here's a reminder of your booking tomorrow:",
    fecha: 'Date', hora: 'Time', personas: 'People',
    cambiar: 'If you need to change or cancel anything, do it yourself here, or call us at',
    llamar: '+34 958 87 24 24',
    gestionarBtn: 'Manage my booking',
  },
  fr: {
    asunto: (fecha) => `Rappel : votre réservation est demain, ${fecha}`,
    hola: (nombre) => `Bonjour ${nombre},`,
    cuerpo: 'Petit rappel de votre réservation de demain :',
    fecha: 'Date', hora: 'Heure', personas: 'Personnes',
    cambiar: 'Pour tout changement ou annulation, faites-le vous-même ici, ou appelez-nous au',
    llamar: '+34 958 87 24 24',
    gestionarBtn: 'Gérer ma réservation',
  },
};

function plantillaHtml(r: ReservaRecord, idioma: Idioma): string {
  const t = TEXTOS[idioma];
  const enlaceGestion = r.token_gestion ? `${URL_GESTION[idioma]}?t=${r.token_gestion}` : null;
  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1A110A">
    <h1 style="font-weight:normal;color:#5C3317">Mesón <em style="color:#B8833A">de Eiffel</em></h1>
    <p>${t.hola(r.nombre.split(' ')[0])}</p>
    <p>${t.cuerpo}</p>
    <table style="border-collapse:collapse;margin:1em 0">
      <tr><td style="padding:4px 12px 4px 0"><strong>${t.fecha}</strong></td><td>${formatFecha(r.fecha, idioma)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>${t.hora}</strong></td><td>${r.hora}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>${t.personas}</strong></td><td>${r.personas}</td></tr>
    </table>
    <p>${t.cambiar} <a href="tel:+34958872424">${t.llamar}</a>.</p>
    ${enlaceGestion ? `
    <p style="margin:0.6em 0 1.4em">
      <a href="${enlaceGestion}" style="display:inline-block;padding:10px 22px;background:#5C3317;color:#fff;text-decoration:none;border-radius:4px;font-family:Georgia,serif">${t.gestionarBtn}</a>
    </p>` : ''}
    <p style="color:#6B5C4E;font-size:0.9em">C/ Rio Mundo, Local 2 · 18600 Motril, Granada</p>
  </div>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // ── Autenticación del cron ────────────────────────────────
  // El Cron Job manda la cabecera x-cron-secret con el mismo valor que
  // el secret CRON_SECRET, para que nadie más pueda disparar envíos
  // masivos llamando a la función directamente.
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('No autorizado', { status: 401 });
  }
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response('Faltan variables de entorno', { status: 500 });
  }

  // El cron corre cada hora en punto; esta función solo actúa si son
  // las HORA_ENVIO_MADRID en punto en hora LOCAL de Madrid — así el
  // recordatorio siempre sale a la misma hora del día para el cliente,
  // sin que el cambio de horario de verano/invierno lo desajuste (algo
  // que sí pasaría si se fijara una hora concreta en UTC en el cron).
  const horaMadrid = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false,
    }).format(new Date())
  );
  if (horaMadrid !== HORA_ENVIO_MADRID) {
    return new Response(JSON.stringify({ ejecutado: false, motivo: `no toca (${horaMadrid}h en Madrid)` }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // "Mañana" en fecha de Madrid, no en UTC del servidor — importante
  // porque cerca de medianoche UTC y hora local de Madrid pueden caer
  // en días distintos.
  const hoyMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()); // YYYY-MM-DD
  const [y, m, d] = hoyMadrid.split('-').map(Number);
  const manana = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  // Consulta directa a PostgREST con la service role key: bypassa RLS
  // (reservas solo es legible por el admin autenticado normalmente),
  // pero la key nunca sale de este entorno de servidor.
  const url = `${SUPABASE_URL}/rest/v1/reservas`
    + `?select=nombre,email,fecha,hora,personas,idioma,token_gestion`
    + `&fecha=eq.${manana}&estado=eq.confirmada&email=not.is.null`;

  const resReservas = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!resReservas.ok) {
    const detalle = await resReservas.text();
    console.error('Error al consultar reservas de mañana:', resReservas.status, detalle);
    return new Response('Error al consultar reservas', { status: 500 });
  }

  const reservasManana: ReservaRecord[] = await resReservas.json();
  let enviados = 0;
  let fallidos = 0;

  for (const r of reservasManana) {
    if (!r.email) continue;
    const idioma = normalizarIdioma(r.idioma);
    const t = TEXTOS[idioma];

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [r.email],
        subject: t.asunto(formatFecha(r.fecha, idioma)),
        html: plantillaHtml(r, idioma),
      }),
    });

    if (res.ok) {
      enviados++;
    } else {
      fallidos++;
      console.error('Resend devolvió error para', r.email, res.status, await res.text());
    }
  }

  return new Response(JSON.stringify({
    ejecutado: true, fecha: manana, total: reservasManana.length, enviados, fallidos,
  }), { headers: { 'Content-Type': 'application/json' } });
});
