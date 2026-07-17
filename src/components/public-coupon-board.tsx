"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfettiBurst } from "@/components/confetti-burst";
import { PUBLIC_POLL_INTERVAL_MS } from "@/lib/config";
import type { CouponRecord, PublicCouponsResponse, StorageMode } from "@/lib/types";

function formatCountdown(expiresAt: string, nowMs: number): string {
  const remainingMs = Math.max(0, Date.parse(expiresAt) - nowMs);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function formatTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("es-NI", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function getStorageModeLabel(storageMode: StorageMode): string {
  return storageMode === "firebase" ? "Firebase" : "Memoria";
}

export function PublicCouponBoard() {
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const [storageMode, setStorageMode] = useState<StorageMode>("memory");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const refreshCoupons = useCallback(async () => {
    try {
      const response = await fetch("/api/public/coupons", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudieron cargar los cupones activos.");
      }

      const payload = (await response.json()) as PublicCouponsResponse;

      setCoupons(payload.coupons);
      setNowIso(payload.now);
      setStorageMode(payload.storageMode);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ocurrió un error inesperado al cargar.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refreshCoupons();
    }, 0);

    const poller = window.setInterval(() => {
      void refreshCoupons();
    }, PUBLIC_POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(poller);
    };
  }, [refreshCoupons]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 1_000);

    return () => {
      window.clearInterval(ticker);
    };
  }, []);

  const visibleCoupons = useMemo(() => {
    const nowMs = Date.parse(nowIso);

    return coupons.filter((coupon) => Date.parse(coupon.expiresAt) > nowMs);
  }, [coupons, nowIso]);

  const featuredCoupon = visibleCoupons[0] ?? null;
  const overflowCoupons = visibleCoupons.slice(1);
  const nowMs = Date.parse(nowIso);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#0d3d0f] text-white">
      <div className="pitch-background absolute inset-0" />
      <div className="pitch-glow absolute inset-0" />
      <div className="goal-frame absolute left-1/2 top-8 h-36 w-[min(84vw,22rem)] -translate-x-1/2" />
      <ConfettiBurst />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
          <span>Final del Día Mundialista</span>
          <span>{visibleCoupons.length} código(s) activo(s)</span>
        </div>

        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
          <div className="mb-6 rounded-full border border-white/35 bg-white/90 px-8 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div className="text-[2rem] font-medium italic leading-none text-[#232323] sm:text-[2.4rem]">
              Súa
            </div>
            <div className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.4em] text-[#232323]/75">
              Hair Salon
            </div>
          </div>

          <div className="mb-2 text-[clamp(4rem,17vw,9rem)] font-black uppercase leading-none tracking-[0.08em] text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)]">
            GOL
          </div>
          <div className="mb-6 text-[clamp(2.5rem,9vw,4.75rem)] font-black uppercase leading-none tracking-[0.12em] text-white/95">
            Código
          </div>

          <div className="glass-panel w-full max-w-xl rounded-[2rem] px-5 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.35)] sm:px-8 sm:py-8">
            {featuredCoupon ? (
              <>
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.4em] text-white/80">
                  Código Más Reciente
                </div>
                <div className="rounded-[1.5rem] bg-white px-4 py-6 text-[clamp(2.8rem,11vw,5rem)] font-black uppercase tracking-[0.35em] text-[#185c1e] shadow-inner">
                  {featuredCoupon.code}
                </div>
                <div className="mt-4 flex items-center justify-center gap-3 text-sm text-white/85">
                  <span className="rounded-full bg-white/10 px-4 py-2 font-semibold">
                    Vence en {formatCountdown(featuredCoupon.expiresAt, nowMs)}
                  </span>
                  <span className="rounded-full bg-white/10 px-4 py-2 font-semibold">
                    Publicado {formatTimeLabel(featuredCoupon.createdAt)}
                  </span>
                </div>
                <p className="mt-5 text-sm leading-6 text-white/80">
                  Muestra cualquier código aún válido al personal en persona. Cada
                  cliente solo puede canjear un cupón.
                </p>
              </>
            ) : (
              <>
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.4em] text-white/80">
                  Esperando El Próximo Gol
                </div>
                <div className="rounded-[1.5rem] border border-dashed border-white/35 bg-white/8 px-4 py-10 text-xl font-semibold uppercase tracking-[0.28em] text-white/80">
                  {isLoading ? "Cargando..." : "No hay códigos activos en este momento"}
                </div>
                <p className="mt-5 text-sm leading-6 text-white/80">
                  Mantente en esta pantalla. Un nuevo código aparecerá automáticamente
                  cuando el administrador publique el próximo cupón por gol.
                </p>
              </>
            )}
          </div>

          {overflowCoupons.length > 0 ? (
            <div className="mt-8 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overflowCoupons.map((coupon) => (
                <article
                  key={coupon.id}
                  className="glass-panel rounded-[1.5rem] px-5 py-5 text-left shadow-[0_18px_40px_rgba(0,0,0,0.25)]"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
                    Aún Vigente
                  </div>
                  <div className="mt-3 text-3xl font-black uppercase tracking-[0.2em] text-white">
                    {coupon.code}
                  </div>
                  <div className="mt-4 text-sm text-white/80">
                    Vence en {formatCountdown(coupon.expiresAt, nowMs)}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-6 rounded-full border border-red-300/40 bg-red-500/20 px-4 py-2 text-sm text-red-100">
              {errorMessage}
            </div>
          ) : null}
        </section>

        <footer className="mt-8 text-center text-xs font-medium uppercase tracking-[0.24em] text-white/60">
          Modo de almacenamiento: {getStorageModeLabel(storageMode)}
        </footer>
      </div>
    </main>
  );
}
