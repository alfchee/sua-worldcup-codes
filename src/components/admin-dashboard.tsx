"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { HISTORY_LIMIT } from "@/lib/config";
import { formatLongDate } from "@/lib/dates";
import type {
  AdminPassportsResponse,
  PassportRecord,
  SessionResponse,
  SessionUser,
  StorageMode,
} from "@/lib/types";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import { PassportsHistoryPanel } from "@/components/passports-history-panel";
import { RedeemPassportPanel } from "@/components/redeem-passport-panel";
import { SellPassportPanel } from "@/components/sell-passport-panel";

interface AdminDashboardProps {
  firebaseAdminConfigured: boolean;
  firebaseClientConfigured: boolean;
  initialSessionUser: SessionUser | null;
}

type PanelTab = "vender" | "canjear" | "historial";

function getStorageModeLabel(storageMode: StorageMode): string {
  return storageMode === "firebase" ? "Firebase" : "Memoria (local)";
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
  const [tab, setTab] = useState<PanelTab>("vender");

  const [passports, setPassports] = useState<PassportRecord[]>([]);
  const [windows, setWindows] = useState<AdminPassportsResponse["windows"] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>(
    firebaseAdminConfigured ? "firebase" : "memory",
  );
  const [isLoading, setIsLoading] = useState(Boolean(initialSessionUser));
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
      setWindows(payload.windows);
      setTruncated(payload.truncated);
      setAuthMessage("");
    } catch (error) {
      setAuthMessage(
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

  const saleRangeLabel = windows
    ? `Venta ${formatLongDate(windows.saleStart)} – ${formatLongDate(windows.saleEnd)} · Canje ${formatLongDate(windows.redemptionStart)} – ${formatLongDate(windows.redemptionEnd)}`
    : "Venta 23–28 de noviembre · Canje 1–31 de diciembre";

  function handleIssued(passport: PassportRecord, mode: StorageMode) {
    setPassports((current) => [passport, ...current].slice(0, HISTORY_LIMIT));
    setStorageMode(mode);
    setTab("vender");
  }

  function handleRedeemed(passport: PassportRecord) {
    setPassports((current) =>
      current.map((candidate) =>
        candidate.id === passport.id ? passport : candidate,
      ),
    );
  }

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
    setAuthMessage("");
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
      setAuthMessage(
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
    setWindows(null);
    setSuccessMessage("");
    setAuthMessage("");
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

          {authMessage ? (
            <div className="rounded-[1.5rem] border border-red-300/35 bg-red-500/15 px-5 py-4 text-sm text-red-100">
              {authMessage}
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
              <p className="mt-1 text-xs text-white/55">{saleRangeLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Cerrar sesión
            </button>
          </div>

          {storageMode === "memory" ? (
            <div className="mt-4 rounded-[1.5rem] border border-amber-300/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
              Modo memoria local (desarrollo): los pasaportes no se comparten entre
              instancias ni persisten. Configura Firebase Admin para producción; el canje
              único solo es exigible con Firebase.
            </div>
          ) : null}

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
          <SellPassportPanel windows={windows} onIssued={handleIssued} />
        ) : null}

        {tab === "canjear" ? (
          <RedeemPassportPanel onRedeemed={handleRedeemed} />
        ) : null}

        {tab === "historial" ? (
          <PassportsHistoryPanel
            passports={passports}
            isLoading={isLoading}
            truncated={truncated}
            onRefresh={() => void loadPassports()}
          />
        ) : null}

        {authMessage ? (
          <div className="rounded-[1.5rem] border border-red-300/35 bg-red-500/15 px-5 py-4 text-sm text-red-100">
            {authMessage}
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
