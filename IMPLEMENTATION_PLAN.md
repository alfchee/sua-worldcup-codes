# ARCHIVED — World Cup Goal Codes plan (superseded)

> Este documento describía la app original de **Códigos De Gol del Mundial**
> (códigos de 5 caracteres, TTL de 2 minutos, página pública con confeti,
> `EVENT_KEY=world-cup-day-finale-2026`).
>
> Esa app fue reemplazada por el **sistema interno de Pasaportes VIP de
> Blackend Week**. La documentación vigente está en [`README.md`](./README.md).
> Este archivo se conserva solo como referencia histórica; **no lo uses para
> implementar ni configurar nada** (las colecciones, variables y flujos que
> describe ya no existen en el código).

Resumen del sistema actual (detalle en `README.md`):

- App interna (`/` → `/admin`): venta, entrega por WhatsApp y canje en recepción.
- Colección Firestore `vipPassports` (código de 6 caracteres, tipo
  `blackend` 50% / `vip` 40%, canje único con auditoría en `auditLogs`).
- Ventanas configurables: venta (`PROMO_SALE_*`) y canje (`PROMO_REDEMPTION_*`).
- Acceso por allowlists: `FIREBASE_ADMIN_EMAILS` (admin) y
  `FIREBASE_STAFF_EMAILS` (personal); rol re-derivado en cada sesión.
- Colección `vipPassports` bloqueada a clientes en reglas Firestore: todas las
  operaciones pasan por el Admin SDK con verificación de rol en servidor.
