"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import type {
  AdminPassportsResponse,
  CreatePassportResponse,
  LookupPassportResponse,
  PassportRecord,
  PassportTypeId,
  RedeemPassportResponse,
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

type PanelTab = "vender" | "canjear" | "historial";

const PASSPORT_TYPE_OPTIONS: Array<{
  id: PassportTypeId;
  label: string;
  discount: number;
  detail: string;
}> = [
  {
    id: "blackend",
    label: "Pasaporte VIP Blackend",
    discount: 50,
    detail: "Descuento del 50% en servicios",
  },
  {
    id: "vip",
    label: "Pasaporte VIP",
    discount: 40,
    detail: "Descuento del 40% en servicios",
  },
];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-NI", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("es-NI", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getStorageModeLabel(storageMode: StorageMode): string {
  return storageMode === "firebase" ? "Firebase" : "Memoria (local)";
}

function getRoleLabel(role: SessionUser["role"]): string {
  return role === "admin" ? "administrador" : "personal";
}

/** Convierte un teléfono local nicaragüense (8 dígitos) a formato internacional para wa.me. */
function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length === 8) {
    return `505${digits}`;
  }

  return digits;
}

function buildWhatsAppLink(passport: PassportRecord): string {
  const phone = normalizePhoneForWhatsApp(passport.clientPhone);
  const message = [
    `¡Hola ${passport.clientName}! 🖤`,
    "",
    `Gracias por tu compra en la Blackend Week VIP de Súa Hair Salon.`,
    `Tu ${passport.typeLabel} con ${passport.discountPercent}% de descuento ya está activo.`,
    "",
    `Código de canje: ${passport.code}`,
    `Válido del ${formatLongDate(passport.validFrom)} al ${formatLongDate(passport.validUntil)}.`,
    "",
    "Te adjunto tu pasaporte en la imagen. Presenta este código al llegar al salón. ✨",
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getStatusLabel(status: PassportRecord["status"]): string {
  if (status === "redeemed") {
    return "Canjeado";
  }

  if (status === "void") {
    return "Anulado";
  }

  return "Vendido";
}

export function AdminDashboard({
  firebaseAdminConfigured,
  firebaseClientConfigured,
  initialSessionUser,
}: AdminDashboardProps) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(initialSessionUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<PanelTab>("vender");

  const [passports, setPassports] = useState<PassportRecord[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>(
    firebaseAdminConfigured ? "firebase" : "memory",
  );
  const [isLoading, setIsLoading] = useState(Boolean(initialSessionUser));
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedType, setSelectedType] = useState<PassportTypeId>("blackend");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [issuedPassport, setIssuedPassport] = useState<PassportRecord | null>(null);

  const [redeemCode, setRedeemCode] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupPassportResponse | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const isFirebaseReady = firebaseClientConfigured && firebaseAdminConfigured;

  const loadPassports = useCallback(async () => {
    if (!sessionUser) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/passports", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudo cargar el historial de pasaportes.");
      }

      const payload = (await response.json()) as AdminPassportsResponse;

      setPassports(payload.passports);
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
      void loadPassports();
    }, 0);

    return () => {
      window.clearTimeout(initialLoad);
    };
  }, [loadPassports, sessionUser]);

  const stats = useMemo(() => {
    const total = passports.length;
    const redeemed = passports.filter((passport) => passport.status === "redeemed").length;
    const pending = total - redeemed;
    const blackend = passports.filter((passport) => passport.type === "blackend").length;

    return { total, redeemed, pending, blackend, vip: total - blackend };
  }, [passports]);

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

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(getFirebaseClientAuth());
    setSessionUser(null);
    setPassports([]);
    setIssuedPassport(null);
    setLookupResult(null);
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleCreatePassport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/passports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: selectedType,
          clientName,
          clientPhone,
        }),
      });

      const payload = (await response.json()) as CreatePassportResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo emitir el pasaporte.");
      }

      setIssuedPassport(payload.passport);
      setStorageMode(payload.storageMode);
      setPassports((current) => [payload.passport, ...current]);
      setClientName("");
      setClientPhone("");
      setSuccessMessage(
        `Pasaporte ${payload.passport.code} emitido para ${payload.passport.clientName}. Descarga la imagen y envíala por WhatsApp.`,
      );
      setTab("vender");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo emitir el pasaporte.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLookingUp(true);
    setErrorMessage("");
    setSuccessMessage("");
    setLookupResult(null);

    try {
      const response = await fetch(
        `/api/admin/passports/redeem?code=${encodeURIComponent(redeemCode)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as LookupPassportResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo consultar el código.");
      }

      setLookupResult(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo consultar el código.",
      );
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleRedeem() {
    if (!lookupResult?.passport) {
      return;
    }

    setIsRedeeming(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/passports/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: lookupResult.passport.code }),
      });

      const payload = (await response.json()) as RedeemPassportResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo canjear el pasaporte.");
      }

      setPassports((current) =>
        current.map((passport) =>
          passport.id === payload.passport.id ? payload.passport : passport,
        ),
      );
      setLookupResult({
        passport: payload.passport,
        canRedeem: false,
        reason: "Este pasaporte ya fue canjeado.",
        now: payload.now,
      });
      setSuccessMessage(
        `Pasaporte ${payload.passport.code} canjeado correctamente (${payload.passport.discountPercent}% de descuento aplicado en caja).`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo canjear el pasaporte.",
      );
    } finally {
      setIsRedeeming(false);
    }
  }

  async function handleDownloadImage(passport: PassportRecord) {
    const response = await fetch(`/api/admin/passports/${passport.code}/image`);

    if (!response.ok) {
      setErrorMessage("No se pudo generar la imagen del pasaporte.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `pasaporte-${passport.code}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (!sessionUser) {
    return (
      <main className="min-h-screen bg-[#0d0b08] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <section className="rounded-[2rem] border border-amber-200/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200/80">
              Blackend Week VIP · Uso interno
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[0.04em] text-white sm:text-5xl">
              Pasaportes VIP · Súa Hair Salon
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
              Panel interno para vender Pasaportes VIP (50% y 40%), entregarlos por
              WhatsApp y canjearlos en recepción entre el 1 y el 31 de diciembre.
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

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur sm:p-8">
            <h2 className="text-2xl font-bold">Ingreso del personal</h2>
            <form className="mt-6 flex flex-col gap-4 sm:max-w-md" onSubmit={handleEmailAuth}>
              <label className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                Correo
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-lg text-white outline-none ring-0 placeholder:text-white/35 focus:border-amber-200/60"
                placeholder="personal@sua.com"
                autoComplete="email"
              />
              <label className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-lg text-white outline-none ring-0 placeholder:text-white/35 focus:border-amber-200/60"
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
              />
              <button
                type="submit"
                className="rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-[#241a05] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  !isFirebaseReady
                  || !email.trim()
                  || !password.trim()
                  || isAuthenticating
                }
              >
                {isAuthenticating ? "Autenticando..." : "Continuar con correo"}
              </button>
            </form>
          </section>

          {errorMessage ? (
            <div className="rounded-[1.5rem] border border-red-300/35 bg-red-500/15 px-5 py-4 text-sm text-red-100">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0b08] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200/80">
                Blackend Week VIP · Panel interno
              </p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                Pasaportes VIP · Súa Hair Salon
              </h1>
              <p className="mt-2 text-sm text-white/65">
                Sesión iniciada como {sessionUser.email ?? sessionUser.uid} ({getRoleLabel(sessionUser.role)}) ·
                Almacenamiento: {getStorageModeLabel(storageMode)}
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

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="rounded-[1.5rem] bg-white/6 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Emitidos</p>
              <div className="mt-2 text-3xl font-black">{stats.total}</div>
            </div>
            <div className="rounded-[1.5rem] bg-white/6 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Pendientes</p>
              <div className="mt-2 text-3xl font-black text-amber-200">{stats.pending}</div>
            </div>
            <div className="rounded-[1.5rem] bg-white/6 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Canjeados</p>
              <div className="mt-2 text-3xl font-black text-emerald-300">{stats.redeemed}</div>
            </div>
            <div className="rounded-[1.5rem] bg-white/6 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Tipo Blackend</p>
              <div className="mt-2 text-3xl font-black">{stats.blackend}</div>
            </div>
          </div>
        </section>

        <nav className="flex flex-wrap gap-3">
          {(
            [
              ["vender", "Vender pasaporte"],
              ["canjear", "Canjear en recepción"],
              ["historial", "Historial"],
            ] as Array<[PanelTab, string]>
          ).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setTab(tabId)}
              className={`rounded-full px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] transition ${
                tab === tabId
                  ? "bg-amber-300 text-[#241a05]"
                  : "border border-white/15 text-white/70 hover:border-white/30 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "vender" ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
              <h2 className="text-2xl font-bold">Emitir pasaporte por venta</h2>
              <p className="mt-2 text-sm text-white/65">
                Selecciona el tipo comprado, registra los datos de la clienta y genera el
                cupón con su código para enviarlo por WhatsApp.
              </p>

              <form className="mt-6 flex flex-col gap-5" onSubmit={handleCreatePassport}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PASSPORT_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedType(option.id)}
                      className={`rounded-[1.5rem] border p-5 text-left transition ${
                        selectedType === option.id
                          ? "border-amber-300 bg-amber-300/10"
                          : "border-white/15 bg-black/20 hover:border-white/30"
                      }`}
                    >
                      <div className="text-4xl font-black text-amber-200">
                        {option.discount}%
                      </div>
                      <div className="mt-2 text-sm font-bold">{option.label}</div>
                      <div className="mt-1 text-xs text-white/60">{option.detail}</div>
                    </button>
                  ))}
                </div>

                <label className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                  Nombre de la clienta
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-lg text-white outline-none placeholder:text-white/35 focus:border-amber-200/60"
                  placeholder="Ej. María José López"
                />

                <label className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                  WhatsApp de la clienta
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(event) => setClientPhone(event.target.value)}
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-lg text-white outline-none placeholder:text-white/35 focus:border-amber-200/60"
                  placeholder="Ej. 8888 1234 (o con lada internacional)"
                />

                <button
                  type="submit"
                  className="rounded-2xl bg-amber-300 px-6 py-5 text-sm font-black uppercase tracking-[0.25em] text-[#241a05] shadow-[0_22px_50px_rgba(252,211,77,0.2)] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!clientName.trim() || !clientPhone.trim() || isCreating}
                >
                  {isCreating ? "Emitiendo..." : "Emitir pasaporte y generar cupón"}
                </button>
              </form>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
              <h2 className="text-2xl font-bold">Cupón para enviar</h2>

              {!issuedPassport ? (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-6 py-12 text-center text-sm text-white/60">
                  Aún no hay un pasaporte emitido en esta sesión.
                  Al emitir uno verás aquí la imagen lista para enviar.
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-4">
                  <div className="overflow-hidden rounded-[1.5rem] border border-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/passports/${issuedPassport.code}/image`}
                      alt={`Pasaporte ${issuedPassport.code} para ${issuedPassport.clientName}`}
                      className="w-full"
                    />
                  </div>

                  <div className="rounded-[1.5rem] bg-white/6 p-4 text-sm text-white/80">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Código</span>
                      <span className="text-xl font-black tracking-[0.3em] text-amber-200">{issuedPassport.code}</span>
                    </div>
                    <div className="mt-2 text-white/70">
                      {issuedPassport.typeLabel} · {issuedPassport.discountPercent}% · {issuedPassport.clientName} · {issuedPassport.clientPhone}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleDownloadImage(issuedPassport)}
                      className="rounded-2xl bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.22em] text-[#241a05] transition hover:bg-white/85"
                    >
                      Descargar imagen
                    </button>
                    <a
                      href={buildWhatsAppLink(issuedPassport)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-2xl bg-emerald-400 px-5 py-4 text-center text-xs font-black uppercase tracking-[0.22em] text-[#052e16] transition hover:bg-emerald-300"
                    >
                      Abrir WhatsApp
                    </a>
                  </div>

                  <p className="text-xs leading-6 text-white/55">
                    Descarga la imagen y adjúntala en el chat de WhatsApp que se abre con el
                    mensaje ya escrito. En Nicaragua los números de 8 dígitos se envían como
                    +505 automáticamente.
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "canjear" ? (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
              <h2 className="text-2xl font-bold">Canje en recepción</h2>
              <p className="mt-2 text-sm text-white/65">
                Ingresa el código que muestra la clienta en su imagen del pasaporte.
                El canje es de un solo uso y queda registrado con tu cuenta.
              </p>

              <form className="mt-6 flex flex-col gap-4" onSubmit={handleLookup}>
                <input
                  type="text"
                  value={redeemCode}
                  onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-center text-2xl font-black uppercase tracking-[0.35em] text-white outline-none placeholder:text-white/25 focus:border-amber-200/60"
                  placeholder="ABC123"
                  maxLength={8}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-amber-300 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-[#241a05] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!redeemCode.trim() || isLookingUp}
                >
                  {isLookingUp ? "Consultando..." : "Consultar código"}
                </button>
              </form>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
              <h2 className="text-2xl font-bold">Resultado</h2>

              {!lookupResult ? (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-6 py-12 text-center text-sm text-white/60">
                  Consulta un código para ver el estado del pasaporte antes de canjearlo.
                </div>
              ) : !lookupResult.passport ? (
                <div className="mt-6 rounded-[1.5rem] border border-red-300/35 bg-red-500/15 px-5 py-6 text-sm text-red-100">
                  {lookupResult.reason ?? "No existe ningún pasaporte con ese código."}
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-4">
                  <div className="rounded-[1.5rem] bg-white/6 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-2xl font-black tracking-[0.3em] text-amber-200">
                        {lookupResult.passport.code}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                          lookupResult.passport.status === "redeemed"
                            ? "bg-emerald-400/15 text-emerald-200"
                            : "bg-amber-300/15 text-amber-100"
                        }`}
                      >
                        {getStatusLabel(lookupResult.passport.status)}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-white/80">
                      {lookupResult.passport.typeLabel} · {lookupResult.passport.discountPercent}% de descuento
                    </div>
                    <div className="mt-1 text-sm text-white/65">
                      Clienta: {lookupResult.passport.clientName} · Vendido el {formatDateTime(lookupResult.passport.purchasedAt)}
                    </div>
                    {lookupResult.passport.redeemedAt ? (
                      <div className="mt-1 text-sm text-white/65">
                        Canjeado el {formatDateTime(lookupResult.passport.redeemedAt)} por {lookupResult.passport.redeemedByEmail}
                      </div>
                    ) : null}
                  </div>

                  {lookupResult.canRedeem ? (
                    <button
                      type="button"
                      onClick={() => void handleRedeem()}
                      disabled={isRedeeming}
                      className="rounded-2xl bg-emerald-400 px-6 py-5 text-sm font-black uppercase tracking-[0.25em] text-[#052e16] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRedeeming
                        ? "Canjeando..."
                        : `Confirmar canje (${lookupResult.passport.discountPercent}% de descuento)`}
                    </button>
                  ) : (
                    <div className="rounded-[1.5rem] border border-amber-300/35 bg-amber-500/15 px-5 py-4 text-sm text-amber-100">
                      {lookupResult.reason ?? "Este pasaporte no se puede canjear ahora."}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "historial" ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                  Historial de pasaportes
                </p>
                <h2 className="mt-2 text-2xl font-bold">Cupones emitidos y canjeados</h2>
              </div>
              <button
                type="button"
                onClick={() => void loadPassports()}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Actualizar
              </button>
            </div>

            <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-white/6 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  <tr>
                    <th className="px-4 py-4">Código</th>
                    <th className="px-4 py-4">Tipo</th>
                    <th className="px-4 py-4">Clienta</th>
                    <th className="px-4 py-4">Vendido</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="px-4 py-4">Canje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-black/10">
                  {passports.map((passport) => (
                    <tr key={passport.id}>
                      <td className="px-4 py-4 text-base font-black uppercase tracking-[0.2em] text-amber-200">
                        {passport.code}
                      </td>
                      <td className="px-4 py-4 text-white/80">
                        {passport.typeLabel}
                        <span className="ml-2 rounded-full bg-white/8 px-2 py-0.5 text-xs font-bold">
                          {passport.discountPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/75">
                        {passport.clientName}
                        <div className="text-xs text-white/50">{passport.clientPhone}</div>
                      </td>
                      <td className="px-4 py-4 text-white/75">
                        {formatDateTime(passport.purchasedAt)}
                        <div className="text-xs text-white/50">por {passport.createdByEmail ?? "—"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                            passport.status === "redeemed"
                              ? "bg-emerald-400/15 text-emerald-200"
                              : passport.status === "void"
                                ? "bg-red-400/15 text-red-200"
                                : "bg-amber-300/15 text-amber-100"
                          }`}
                        >
                          {getStatusLabel(passport.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/75">
                        {passport.redeemedAt
                          ? `${formatDateTime(passport.redeemedAt)} · ${passport.redeemedByEmail ?? ""}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && passports.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-white/70" colSpan={6}>
                        Aún no se han emitido pasaportes.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

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
