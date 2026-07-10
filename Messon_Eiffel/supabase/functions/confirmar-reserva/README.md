# Edge Function · confirmar-reserva

Envía un email de "solicitud recibida" al cliente cuando entra una reserva nueva con email. La función está lista; **requiere una cuenta de [Resend](https://resend.com) (gratis hasta 3.000 emails/mes) y estos pasos una sola vez**:

## Despliegue

1. **Resend**: crear cuenta → verificar el dominio `mesoncafeteriadeeiffel.es` (añadir los registros DNS que indica) → crear una API key.

2. **Desplegar la función** (desde `Messon_Eiffel/`):

   ```bash
   supabase functions deploy confirmar-reserva --no-verify-jwt
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx WEBHOOK_SECRET=un-valor-largo-aleatorio
   ```

3. **Database Webhook** (Dashboard → Database → Webhooks → Create):
   - Table: `reservas` · Events: `INSERT`
   - Type: Supabase Edge Function → `confirmar-reserva`
   - HTTP Headers: añadir `x-webhook-secret` = el mismo valor de `WEBHOOK_SECRET`

## Notas

- Sin email en la reserva → la función no hace nada (el campo es opcional).
- Si Resend falla, la función responde 200 igualmente: la reserva ya está guardada y no queremos reintentos en bucle; el error queda en los logs de la función.
- El remitente está en `index.ts` (`FROM`) — cambiarlo si se usa otro dominio.
