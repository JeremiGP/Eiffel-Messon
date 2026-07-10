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
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function plantillaHtml(r: ReservaRecord): string {
  // Texto plano + HTML mínimo: máxima entregabilidad, sin imágenes remotas
  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1A110A">
    <h1 style="font-weight:normal;color:#5C3317">Mesón <em style="color:#B8833A">de Eiffel</em></h1>
    <p>Hola ${r.nombre.split(' ')[0]},</p>
    <p>Hemos recibido tu solicitud de reserva:</p>
    <table style="border-collapse:collapse;margin:1em 0">
      <tr><td style="padding:4px 12px 4px 0"><strong>Fecha</strong></td><td>${formatFecha(r.fecha)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>Hora</strong></td><td>${r.hora}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>Personas</strong></td><td>${r.personas}</td></tr>
    </table>
    <p>Te <strong>confirmaremos la disponibilidad por teléfono</strong> en breve.
       Si necesitas cambiar algo, llámanos al <a href="tel:+34958872424">958 87 24 24</a>.</p>
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

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [r.email],
      subject: `Solicitud de reserva recibida — ${formatFecha(r.fecha)}, ${r.hora}`,
      html: plantillaHtml(r),
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
