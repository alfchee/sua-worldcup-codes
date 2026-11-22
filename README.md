# Pasaportes VIP | Blackend Week | Súa Hair Salon

App **interna** del salón para la promoción `Blackend Week VIP + Pasaporte VIP`.

- El pasaporte es un cupón de descuento: **50%** (Pasaporte VIP Blackend) o **40%** (Pasaporte VIP).
- La venta ocurre del **23 al 28 de noviembre**: al registrar la venta se emite un cupón con código único.
- El cupón se genera como **imagen PNG** (1080×1350) con el código insertado, lista para descargar y **enviar por WhatsApp** a la clienta (botón que abre el chat con el mensaje prellenado).
- El canje en recepción es del **1 al 31 de diciembre**: el personal ingresa el código, consulta su estado y lo canjea. **Canje único**, registrado con fecha y cuenta del personal.
- Uso exclusivamente interno: la página pública `/` redirige a `/admin`.

## Rutas

- `/` redirige a `/admin`
- `/admin` panel interno (venta, canje e historial)
- `/api/admin/passports` listar y emitir pasaportes
- `/api/admin/passports/redeem` consultar y canjear un código
- `/api/admin/passports/[code]/image` imagen PNG del cupón con el código
- `/api/auth/session` creación, consulta y cierre de sesión

## Modelo de datos (Firestore)

Colección `vipPassports`: `code`, `type` (`blackend` | `vip`), `discountPercent`,
`clientName`, `clientPhone`, `status` (`purchased` | `redeemed` | `void`),
`purchasedAt`, `validFrom`, `validUntil`, `redeemedAt`, `redeemedByEmail`, `promoKey`.

## Ventanas de la promoción

Configurables por variables de entorno (ISO 8601 con zona `-06:00`):

- `PROMO_SALE_START` / `PROMO_SALE_END` — ventana de venta (23–28 nov).
- `PROMO_REDEMPTION_START` / `PROMO_REDEMPTION_END` — ventana de canje (1–31 dic).

Fuera de la ventana de venta la emisión se rechaza; fuera de la ventana de canje
el pasaporte se muestra como válido pero no canjeable.

## Envío por WhatsApp

1. Emite el pasaporte en la pestaña **Vender pasaporte**.
2. Pulsa **Descargar imagen** (PNG del cupón con el código).
3. Pulsa **Abrir WhatsApp**: se abre el chat con la clienta y el mensaje ya escrito; adjunta la imagen descargada.
4. Los teléfonos locales de 8 dígitos se envían como `+505…` automáticamente.

## Configuración Local

1. Instala dependencias: `npm install`
2. Copia el archivo de ejemplo: `cp .env.example .env.local` y complétalo.
3. Ejecuta el proyecto: `npm run dev`

Cuentas cuyo correo esté en `FIREBASE_ADMIN_EMAILS` son administradoras; las
demás entran como personal. Ambos roles pueden vender y canjear.

## Seguridad Para Hacer Push

- sí se sube `.env.example`
- no se sube `.env`, `.env.local` ni service accounts de Firebase
- el `.gitignore` ya protege estos archivos; revisa `git status --short` antes de push

## Validación

- `npm run lint`
- `npm run build`
