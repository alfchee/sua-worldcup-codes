# Pasaportes VIP | Blackend Week | Súa Hair Salon

App **interna** del salón para la promoción `Blackend Week VIP + Pasaporte VIP`.

- El pasaporte es un cupón de descuento: **50%** (Pasaporte VIP Blackend) o **40%** (Pasaporte VIP).
- La venta ocurre del **23 al 28 de noviembre**: al registrar la venta se emite un cupón con código único.
- El cupón se genera como **imagen PNG** (1080×1350) con el código insertado, lista para descargar y **enviar por WhatsApp** a la clienta (botón que abre el chat con el mensaje prellenado).
- El canje en recepción es del **1 al 31 de diciembre**: el personal ingresa el código, verifica el nombre que dicta la clienta, y lo canjea. **Canje único atómico** (transacción Firestore), registrado con fecha y cuenta del personal, con auditoría en `auditLogs`.
- Uso exclusivamente interno: la página pública `/` redirige a `/admin`.

## Rutas

- `/` redirige a `/admin`
- `/admin` panel interno (venta, canje e historial)
- `/api/admin/passports` listar y emitir pasaportes
- `/api/admin/passports/redeem` consultar y canjear un código
- `/api/admin/passports/[code]/image` imagen PNG del cupón con el código
- `/api/auth/session` creación, consulta y cierre de sesión (el logout revoca los tokens en servidor)

## Modelo de datos (Firestore)

Colección `vipPassports` (el código **es** el ID del documento, lo que garantiza
unicidad atómica con `create()`): `code`, `type` (`blackend` | `vip`),
`discountPercent`, `clientName`, `clientPhone`, `status` (`purchased` | `redeemed` | `void`),
`purchasedAt`, `validFrom`, `validUntil`, `redeemedAt`, `redeemedByEmail`, `promoKey`.
(`typeLabel` no se almacena: se deriva de `PASSPORT_TYPES` al leer.)

Colección `auditLogs`: `passport_created`, `passport_redeemed`, `passport_redeem_denied`.

## Ventanas de la promoción

Configurables por variables de entorno (ISO 8601 con zona `-06:00`; valores sin
zona se interpretan como hora de Managua):

- `PROMO_SALE_START` / `PROMO_SALE_END` — venta (23–28 nov, fin inclusivo al milisegundo).
- `PROMO_REDEMPTION_START` / `PROMO_REDEMPTION_END` — canje (1–31 dic).

El panel muestra las ventanas vigentes (vienen en el API) y el historial indica
si está truncado a los 50 más recientes (`HISTORY_LIMIT`).

El gate de canje se evalúa contra las fechas **del documento** (las impresas en
el cupón), no contra las variables globales: reconfigurar las ventanas no altera
pasaportes ya emitidos.

## Acceso y seguridad

- Solo entran correos en allowlists: `FIREBASE_ADMIN_EMAILS` (admin) y
  `FIREBASE_STAFF_EMAILS` (personal). Sin `FIREBASE_STAFF_EMAILS` se mantiene el
  modo heredado (cualquier cuenta entra como staff) con advertencia en logs.
- El rol se re-deriva en cada sesión: remover un correo de la lista lo degrada
  de inmediato. El proveedor email/password exige correo verificado (desactivable
  con `FIREBASE_ALLOW_UNVERIFIED_EMAILS=true`).
- Desactiva el registro público en la consola de Firebase (Authentication →
  sign-in method) para cierre completo.
- Reglas Firestore: `vipPassports` bloqueado a clientes (`allow ... if false`);
  todo pasa por el Admin SDK con verificación de rol en servidor.
- Rate-limit por IP en consulta/canje/imagen (30/10/30 por minuto) y verificación
  de nombre de la clienta al confirmar el canje.

## Envío por WhatsApp

1. Emite el pasaporte en la pestaña **Vender pasaporte**.
2. La imagen se genera una sola vez y se reutiliza para vista previa y descarga.
3. Pulsa **Abrir WhatsApp**: se abre el chat de la clienta con el mensaje ya escrito; adjunta la imagen descargada.
4. Los teléfonos locales de 8 dígitos se envían como `+505…` automáticamente
   (también se manejan prefijos `00` y troncal `0`).

## Configuración Local

1. Instala dependencias: `npm install`
2. Copia el ejemplo: `cp .env.example .env.local` y complétalo (incluye
   `FIREBASE_STAFF_EMAILS` y las ventanas `PROMO_*`).
3. Ejecuta: `npm run dev`

Sin Firebase Admin configurado la app usa memoria local (banner visible en el
panel): los datos no se comparten entre instancias y el canje único no es
exigible — solo para desarrollo.

## Validación

- `npm run lint`
- `npm test` (17 pruebas: teléfonos, validación, ventanas y gate de canje)
- `npm run build`

## Seguridad Para Hacer Push

- sí se sube `.env.example`
- no se sube `.env`, `.env.local` ni service accounts de Firebase
- el `.gitignore` ya protege estos archivos; revisa `git status --short` antes de push
