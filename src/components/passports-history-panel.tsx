"use client";

import { formatDateTime } from "@/lib/dates";
import { getPassportView } from "@/lib/passport-view";
import type { PassportRecord } from "@/lib/types";

interface PassportsHistoryPanelProps {
  passports: PassportRecord[];
  isLoading: boolean;
  truncated: boolean;
  onRefresh: () => void;
}

export function PassportsHistoryPanel({
  passports,
  isLoading,
  truncated,
  onRefresh,
}: PassportsHistoryPanelProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
            Historial de pasaportes
          </p>
          <h2 className="mt-2 text-2xl font-bold">Cupones emitidos y canjeados</h2>
          {truncated ? (
            <p className="mt-1 text-xs text-white/55">
              Se muestran los {passports.length} más recientes. Hay más registros en la base de datos.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRefresh}
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
            {passports.map((passport) => {
              const view = getPassportView(passport);

              return (
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
                      {view.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-white/75">
                    {view.redeemedLabel ?? "—"}
                  </td>
                </tr>
              );
            })}
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
  );
}
