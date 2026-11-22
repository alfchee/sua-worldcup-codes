"use client";

import { useState } from "react";

import { formatDateTime } from "@/lib/dates";
import { getStatusLabel } from "@/lib/passport-view";
import type {
  LookupPassportResponse,
  PassportRecord,
  RedeemPassportResponse,
} from "@/lib/types";

interface RedeemPassportPanelProps {
  onRedeemed: (passport: PassportRecord) => void;
}

export function RedeemPassportPanel({ onRedeemed }: RedeemPassportPanelProps) {
  const [redeemCode, setRedeemCode] = useState("");
  const [verifyName, setVerifyName] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupPassportResponse | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
        body: JSON.stringify({
          code: lookupResult.passport.code,
          clientName: verifyName,
        }),
      });

      const payload = (await response.json()) as RedeemPassportResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo canjear el pasaporte.");
      }

      onRedeemed(payload.passport);
      setVerifyName("");
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

  return (
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
            maxLength={6}
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

        {errorMessage ? (
          <div className="mt-4 rounded-[1.5rem] border border-red-300/35 bg-red-500/15 px-5 py-4 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-[1.5rem] border border-emerald-300/25 bg-emerald-500/15 px-5 py-4 text-sm text-emerald-100">
            {successMessage}
          </div>
        ) : null}
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
              <>
                <label className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                  Nombre que dicta la clienta (verificación)
                </label>
                <input
                  type="text"
                  value={verifyName}
                  onChange={(event) => setVerifyName(event.target.value)}
                  className="rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-lg text-white outline-none placeholder:text-white/35 focus:border-amber-200/60"
                  placeholder="Debe coincidir con el registrado"
                  maxLength={80}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => void handleRedeem()}
                  disabled={isRedeeming || !verifyName.trim()}
                  className="rounded-2xl bg-emerald-400 px-6 py-5 text-sm font-black uppercase tracking-[0.25em] text-[#052e16] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRedeeming
                    ? "Canjeando..."
                    : `Confirmar canje (${lookupResult.passport.discountPercent}% de descuento)`}
                </button>
              </>
            ) : (
              <div className="rounded-[1.5rem] border border-amber-300/35 bg-amber-500/15 px-5 py-4 text-sm text-amber-100">
                {lookupResult.reason ?? "Este pasaporte no se puede canjear ahora."}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
