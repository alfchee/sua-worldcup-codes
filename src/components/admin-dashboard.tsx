"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import type {
  AdminCouponsResponse,
  CouponRecord,
  PublishCouponResponse,
  SessionResponse,
  SessionUser,
  StorageMode,
} from "@/lib/types";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

interface AdminDashboardProps {
  firebaseAdminConfigured: boolean;
  firebaseClientConfigured: boolean;
  initialSessionUser: SessionUser | null;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-NI", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function getCouponStatus(expiresAt: string): "Activo" | "Expirado" {
  return Date.parse(expiresAt) > Date.now() ? "Activo" : "Expirado";
}

function getStorageModeLabel(storageMode: StorageMode): string {
  return storageMode === "firebase" ? "Firebase" : "Memoria";
}

function getRoleLabel(role: SessionUser["role"]): string {
  return role === "admin" ? "administrador" : "personal";
}

export function AdminDashboard({
  firebaseAdminConfigured,
  firebaseClientConfigured,
  initialSessionUser,
}: AdminDashboardProps) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(initialSessionUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>(
    firebaseAdminConfigured ? "firebase" : "memory",
  );
  const [isLoading, setIsLoading] = useState(Boolean(initialSessionUser));
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isFirebaseReady = firebaseClientConfigured && firebaseAdminConfigured;
  const canPublish = sessionUser?.role === "admin";

  const loadCoupons = useCallback(async () => {
    if (!sessionUser) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/coupons", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudo cargar el historial de cupones.");
      }

      const payload = (await response.json()) as AdminCouponsResponse;

      setCoupons(payload.coupons);
      setStorageMode(payload.storageMode);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ocurrió un error inesperado al cargar.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser) {
      return;
    }

    const initialLoad = window.setTimeout(() => {
      void loadCoupons();
    }, 0);

    return () => {
      window.clearTimeout(initialLoad);
    };
  }, [loadCoupons, sessionUser]);

  const activeCoupons = useMemo(
    () => coupons.filter((coupon) => getCouponStatus(coupon.expiresAt) === "Activo"),
    [coupons],
  );

  async function createServerSession(idToken: string): Promise<SessionUser> {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });

    const payload = (await response.json()) as SessionResponse & { error?: string };

    if (!response.ok || !payload.user) {
      throw new Error(payload.error ?? "No se pudo crear la sesión del servidor.");
    }

    return payload.user;
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const auth = getFirebaseClientAuth();
      const credential = await signInWithEmailAndPassword(auth, email, password);

      const session = await createServerSession(await credential.user.getIdToken(true));

      setSessionUser(session);
      setEmail("");
      setPassword("");
      setSuccessMessage("Sesión iniciada correctamente.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falló la autenticación con Firebase.",
      );
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handlePublish() {
    setIsPublishing(true);
    setErrorMessage("");
    setSuccessMessage("");

    if (!sessionUser || !canPublish) {
      setErrorMessage("Solo los administradores pueden publicar cupones.");
      setIsPublishing(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
      });

      const payload = (await response.json()) as PublishCouponResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo publicar el cupón.");
      }

      setCoupons((current) => [payload.coupon, ...current].slice(0, 12));
      setStorageMode(payload.storageMode);
      setSuccessMessage(`El cupón ${payload.coupon.code} ya está activo por 2 minutos.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo publicar el cupón.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(getFirebaseClientAuth());
    setSessionUser(null);
    setCoupons([]);
    setSuccessMessage("");
    setErrorMessage("");
  }

  return (
    <main className="min-h-screen bg-[#07180a] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
            Panel Administrativo
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[0.08em] text-white sm:text-5xl">
            Control De Cupones Por Gol
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
            Inicia sesión con Firebase Auth para acceder a las operaciones de cupones.
            Los administradores pueden publicar nuevos cupones de 5 caracteres por gol,
            mientras el personal puede revisar el historial para validación en tienda.
          </p>
        </section>

        {!firebaseClientConfigured || !firebaseAdminConfigured ? (
          <section className="rounded-[2rem] border border-amber-300/30 bg-amber-500/10 p-6 text-amber-100 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
            <h2 className="text-xl font-bold">Falta configuración de Firebase</h2>
            <p className="mt-3 text-sm leading-7 text-amber-100/85">
              Agrega la configuración web de Firebase y las credenciales de la cuenta de
              servicio de Firebase Admin en `.env.local` y Vercel antes de usar este panel.
            </p>
          </section>
        ) : null}

        {!sessionUser ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8">
            <h2 className="text-2xl font-bold">Ingreso Administrativo</h2>
            <p className="mt-3 text-sm leading-7 text-white/75">
              Inicia sesión con una cuenta existente de Firebase Auth por correo y
              contraseña. Las cuentas cuyo correo esté en `FIREBASE_ADMIN_EMAILS`
              se convierten automáticamente en administradores; las demás tendrán acceso
              de personal.
            </p>

            <form className="mt-6 flex flex-col gap-4 sm:max-w-md" onSubmit={handleEmailAuth}>
              <label className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                Correo
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-white/15 bg-black/20 px-4 py-4 text-lg text-white outline-none ring-0 placeholder:text-white/35 focus:border-emerald-300/60"
                placeholder="admin@sua.com"
                autoComplete="email"
              />
              <label className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-white/15 bg-black/20 px-4 py-4 text-lg text-white outline-none ring-0 placeholder:text-white/35 focus:border-emerald-300/60"
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
              />
              <button
                type="submit"
                className="rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-[#09270f] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  !isFirebaseReady
                  || !email.trim()
                  || !password.trim()
                  || isAuthenticating
                }
              >
                {isAuthenticating
                  ? "Autenticando..."
                  : "Continuar con correo"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                      Acciones En Vivo
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">Publicar cupón por gol</h2>
                    <p className="mt-2 text-sm text-white/65">
                      Sesión iniciada como {sessionUser.email ?? sessionUser.uid} ({getRoleLabel(sessionUser.role)})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    Cerrar sesión
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing || !canPublish}
                  className="mt-6 w-full rounded-[1.75rem] bg-emerald-400 px-6 py-6 text-lg font-black uppercase tracking-[0.25em] text-[#09270f] shadow-[0_22px_50px_rgba(16,185,129,0.35)] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPublishing
                    ? "Publicando..."
                    : canPublish
                      ? "Generar cupón en vivo"
                      : "El personal no puede publicar cupones"}
                </button>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] bg-white/6 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                      Activos ahora
                    </p>
                    <div className="mt-2 text-4xl font-black">{activeCoupons.length}</div>
                  </div>
                  <div className="rounded-[1.5rem] bg-white/6 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                      Modo de almacenamiento
                    </p>
                    <div className="mt-2 text-2xl font-black uppercase">{getStorageModeLabel(storageMode)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                  Recordatorio Para El Personal
                </p>
                <p className="mt-4 text-sm leading-7 text-white/75">
                  Los clientes solo pueden canjear un código válido en persona. El
                  personal debe usar este historial para confirmar que el código existió
                  durante el evento. Solo las cuentas administradoras pueden generar
                  nuevos códigos.
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                    Historial De Cupones
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">Códigos generados recientemente</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void loadCoupons()}
                  className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Actualizar
                </button>
              </div>

              <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-white/6 text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                    <tr>
                      <th className="px-4 py-4">Código</th>
                      <th className="px-4 py-4">Creado</th>
                      <th className="px-4 py-4">Vence</th>
                      <th className="px-4 py-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-black/10">
                    {coupons.map((coupon) => {
                      const status = getCouponStatus(coupon.expiresAt);

                      return (
                        <tr key={coupon.id}>
                          <td className="px-4 py-4 text-lg font-black uppercase tracking-[0.25em] text-emerald-200">
                            {coupon.code}
                          </td>
                          <td className="px-4 py-4 text-white/75">
                            {formatDateTime(coupon.createdAt)}
                          </td>
                          <td className="px-4 py-4 text-white/75">
                            {formatDateTime(coupon.expiresAt)}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                                status === "Activo"
                                  ? "bg-emerald-400/15 text-emerald-200"
                                  : "bg-white/8 text-white/60"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!isLoading && coupons.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-white/70" colSpan={4}>
                          Aún no se han generado cupones.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {errorMessage ? (
          <div className="rounded-[1.5rem] border border-red-300/35 bg-red-500/15 px-5 py-4 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-[1.5rem] border border-emerald-300/25 bg-emerald-500/15 px-5 py-4 text-sm text-emerald-100">
            {successMessage}
          </div>
        ) : null}
      </div>
    </main>
  );
}
