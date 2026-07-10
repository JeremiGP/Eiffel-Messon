# Email para el proveedor del dominio (virtualhostingdigital.com)

Copia y pega esto en un correo a tu proveedor de hosting (quien gestiona
`mesoncafeteriadeeiffel.es`, nameservers ns5/ns6.virtualhostingdigital.com).

---

**Asunto:** Alta de registros DNS en mesoncafeteriadeeiffel.es

Hola,

Soy el titular del dominio **mesoncafeteriadeeiffel.es**. Necesito que añadáis
los siguientes registros DNS a la zona del dominio (son para poder enviar
emails transaccionales verificados con DKIM/SPF a través de Resend):

| Tipo | Nombre (host) | Valor / Contenido | TTL | Prioridad |
|------|---------------|-------------------|-----|-----------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDGd0azTwVzLsGIMzJzZqZREBMW4+OJGsd/xib5qpI7mwu/VjqejbR2BVXZU2i9Lx/uUDFakRkMFnwjbjD/01LnYyo1oeT6wmyGrRDcb7VFyEqf8Dc+PxLx3DLdzdxRd+1bFU/GgBbzxXk31BfSgz4kFCw6PrVopMU3xKvV5YqU7wIDAQAB` | Auto | — |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | Auto | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | Auto | — |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | Auto | — |

*(Los nombres son relativos al dominio: `resend._domainkey` =
`resend._domainkey.mesoncafeteriadeeiffel.es`, etc.)*

**Además** — y esto es lo más importante — quiero que el dominio apunte a mi
web nueva alojada en Netlify. Por favor, actualizad también:

| Tipo | Nombre (host) | Valor |
|------|---------------|-------|
| A | `@` (raíz) | `75.2.60.5` |
| CNAME | `www` | `eiffel-meson.netlify.app` |

*(Sustituyen al registro A actual que apunta a 151.80.29.14.)*

Si en lugar de editar los registros preferís cederme el acceso al panel de
gestión DNS del dominio, también me sirve.

Gracias,

---

## Después de que el hosting confirme (checklist para ti)

1. En **Netlify** → proyecto `eiffel-meson` → Domain management → Add custom
   domain → `mesoncafeteriadeeiffel.es` (y `www.mesoncafeteriadeeiffel.es`).
   Netlify emitirá el certificado SSL solo, unos minutos después del cambio DNS.
2. En **Resend** → Domains → mesoncafeteriadeeiffel.es → botón
   **"I've added the records"** / Verify. Cuando pase a "Verified":
3. En **Supabase** → Edge Functions → Secrets: borrar el secret `FROM_ADDRESS`
   (o ponerlo a `Mesón Cafetería de Eiffel <reservas@mesoncafeteriadeeiffel.es>`)
   para dejar de usar el remitente de prueba.
