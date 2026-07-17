# Códigos De Gol | Súa Hair Salon

Sitio de cupones en vivo para `Súa Hair Salon` durante la final del evento mundialista.

- La página pública muestra todos los códigos activos.
- El panel `/admin` permite iniciar sesión con Firebase Auth.
- Las cuentas administradoras pueden publicar un nuevo código de 5 caracteres.
- Cada código dura 2 minutos desde su publicación.
- El historial queda almacenado para validación en tienda.

## Stack Actual

- `Next.js` con `TypeScript`
- `Firebase Firestore` para cupones e historial
- `Firebase Auth` para autenticación
- `Firebase Admin SDK` para sesiones seguras en el servidor
- `Tailwind CSS` para la interfaz

## Rutas

- `/` pantalla pública con diseño futbolero y confeti CSS
- `/admin` panel autenticado para administradores y personal
- `/api/public/coupons` feed público de cupones activos
- `/api/auth/session` creación, consulta y cierre de sesión
- `/api/admin/coupons` historial y publicación de cupones

## Configuración Local

1. Instala dependencias:

```bash
npm install
```

2. Copia el archivo de ejemplo:

```bash
cp .env.example .env.local
```

3. Completa en `.env.local`:

- configuración web de Firebase
- credenciales de Firebase Admin
- `FIREBASE_ADMIN_EMAILS` con los correos que deben ser administradores

4. Ejecuta el proyecto:

```bash
npm run dev
```

## Variables De Entorno

El archivo seguro para compartir en el repo es [`.env.example`](file:///home/alfchee/Workspace/own/worldcup-code/.env.example).

Los secretos reales deben vivir solo en:

- `.env.local`
- variables de entorno de Vercel

## Archivos De Firebase

Archivos relevantes para provisión y seguridad:

- [firestore.rules](file:///home/alfchee/Workspace/own/worldcup-code/firebase/firestore.rules)
- [firestore.indexes.json](file:///home/alfchee/Workspace/own/worldcup-code/firebase/firestore.indexes.json)
- [.env.example](file:///home/alfchee/Workspace/own/worldcup-code/.env.example)
- [IMPLEMENTATION_PLAN.md](file:///home/alfchee/Workspace/own/worldcup-code/IMPLEMENTATION_PLAN.md)

## Seguridad Para Hacer Push

Puedes hacer push del proyecto sin exponer secretos si mantienes esta regla:

- sí se sube `.env.example`
- no se sube `.env`
- no se sube `.env.local`
- no se suben archivos JSON de service account de Firebase
- no se sube `.vercel`

El `.gitignore` ya protege:

- `.env`
- `.env.local`
- `.env.*.local`
- `firebase-service-account*.json`
- `service-account*.json`
- `serviceAccountKey*.json`
- `.vercel`

Antes de hacer push, revisa:

```bash
git status --short
```

Y confirma que no aparezcan archivos como:

```text
.env
.env.local
firebase-service-account.json
service-account.json
```

## Checklist Antes De Subir

1. Verifica que `.env.local` no esté trackeado.
2. Usa solo valores placeholder en `.env.example`.
3. Revisa `git status --short`.
4. Asegúrate de que no haya claves privadas pegadas en `README`, código o commits.
5. Luego haz tu `git add`, `commit` y `push`.

## Validación

- `npm run lint`
- `npm run build`
