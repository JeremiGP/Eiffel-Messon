# Edge Function · recordatorio-reserva

Envía un email de "recordatorio, tu reserva es mañana" a cada cliente con una reserva **confirmada** (con email) para el día siguiente. Se dispara solo, cada día a las **10:00 hora de Madrid**, sin intervención manual.

⚠️ **Usa la misma cuenta de Resend que `confirmar-reserva`.** Mientras el dominio `mesoncafeteriadeeiffel.es` no esté verificado en Resend, los emails reales solo llegan a la bandeja del dueño de la cuenta de Resend (modo prueba) — verificar el dominio es un paso pendiente fuera de este repositorio (añadir los registros DNS que indica Resend).

## Cómo funciona (para que no dependa de recordar activarlo cada día)

Un **Cron Job de Supabase** (pg_cron + pg_net) llama a esta función **cada hora, en punto**. La función en sí comprueba si son las 10:00 en horario de Madrid antes de hacer nada — si no lo son, responde y no envía nada. Así el recordatorio siempre sale a la misma hora local, sin que el cambio de horario de verano/invierno (CET/CEST) lo desajuste, que es lo que pasaría si el cron llamara directamente a una hora fija en UTC.

## Despliegue (una sola vez)

1. **Desplegar la función** (desde `Messon_Eiffel/`):

   ```bash
   supabase functions deploy recordatorio-reserva --no-verify-jwt
   supabase secrets set CRON_SECRET=un-valor-largo-aleatorio
   ```

   (`RESEND_API_KEY` y `FROM_ADDRESS` ya existen como secrets — los usa `confirmar-reserva`.)

2. **Habilitar las extensiones** `pg_cron` y `pg_net` — ver `supabase/migrations/20260720010000_recordatorio_cron.sql` (se aplica igual que el resto de migraciones).

3. **Programar el Cron Job** (SQL Editor, una sola vez — **no** se guarda en ningún archivo del repositorio porque lleva el secret en texto):

   ```sql
   select cron.schedule(
     'recordatorio-reservas-cada-hora',
     '0 * * * *',   -- cada hora en punto; la función decide si actúa
     $$
     select net.http_post(
       url     := 'https://hahefxzzqplleunayqjp.supabase.co/functions/v1/recordatorio-reserva',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'EL-MISMO-VALOR-DE-CRON_SECRET'),
       body    := jsonb_build_object('trigger', 'cron')
     );
     $$
   );
   ```

   Sustituye `EL-MISMO-VALOR-DE-CRON_SECRET` por el valor real que se usó en el paso 1.

## Comprobar que funciona

- Invocar la función a mano (Dashboard → Edge Functions → recordatorio-reserva → botón de invocar, o `curl` con el header `x-cron-secret`) devuelve `{"ejecutado": false, "motivo": "no toca (Xh en Madrid)"}` si no son las 10:00 en Madrid — es la respuesta esperada casi siempre.
- Para probar el envío real sin esperar a las 10:00, cambiar temporalmente `HORA_ENVIO_MADRID` en `index.ts` a la hora actual, desplegar, invocar, y devolver el valor a `10` y volver a desplegar.
- `select * from cron.job_run_details order by start_time desc limit 20;` muestra el historial de ejecuciones del cron.

## Notas

- Reutiliza `RESEND_API_KEY` y `FROM_ADDRESS` de `confirmar-reserva` — no hace falta configurarlos otra vez.
- Solo manda recordatorio a reservas con `estado = 'confirmada'` (las pendientes o canceladas no reciben nada).
- Si Resend falla para un cliente concreto, el resto se sigue procesando; el fallo queda en los logs de la función (`fallidos` en la respuesta).
- **Enlace de "gestionar mi reserva" en el email**: usa el secret `SITE_URL` (por defecto `https://eiffel-meson.netlify.app`, el dominio real mientras `mesoncafeteriadeeiffel.es` siga apuntando a la web antigua). Cuando el cliente apruebe el cambio de dominio: `supabase secrets set SITE_URL=https://mesoncafeteriadeeiffel.es` (sin barra final, mismo secret que usa `confirmar-reserva`) — no hace falta tocar el código. **Ojo**: si cambias este secret, también hay que actualizar la constante `SITE_URL_GESTION` en `assets/js/admin.js`, que no puede leer secrets de Supabase.
