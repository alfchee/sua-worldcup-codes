"use client";

import { useEffect, useMemo, useState } from "react";

import { PASSPORT_TYPES } from "@/lib/config";
import { formatLongDate } from "@/lib/dates";
import { normalizePhoneForWhatsApp } from "@/lib/phone";
import type {
  CreatePassportResponse,
  PassportRecord,
  PassportTypeId,
  PromoWindows,
} from "@/lib/types";

interface SellPassportPanelProps {
  windows: PromoWindows | null;
  onIssued: (passport: PassportRecord, storageMode: CreatePassportResponse["storageMode"]) => void;
}

const TYPE_OPTIONS = (Object.keys(PASSPORT_TYPES) as PassportTypeId[]).map((id) => ({
  id,
  ...PASSPORT_TYPES[id],
}));

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

export function SellPassportPanel({ windows, onIssued }: SellPassportPanelProps) {
  const [selectedType, setSelectedType] = useState<PassportTypeId>("blackend");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [issuedPassport, setIssuedPassport] = useState<PassportRecord | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Una sola descarga renderiza el PNG: el preview y el botón de descarga
  // comparten el mismo blob en vez de pedir la imagen dos veces.
  const imageUrl = useMemo(
    () => (imageBlob ? URL.createObjectURL(imageBlob) : null),
    [imageBlob],
  );

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

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
      setImageBlob(null);
      onIssued(payload.passport, payload.storageMode);
      setClientName("");
      setClientPhone("");
      setSuccessMessage(
        `Pasaporte ${payload.passport.code} emitido para ${payload.passport.clientName}. Descarga la imagen y envíala por WhatsApp.`,
      );

      setIsImageLoading(true);

      try {
        const imageResponse = await fetch(
          `/api/admin/passports/${payload.passport.code}/image`,
        );

        if (!imageResponse.ok) {
          throw new Error();
        }

        setImageBlob(await imageResponse.blob());
      } catch {
        setErrorMessage(
          "El pasaporte se emitió, pero no se pudo generar su imagen. Recarga e intenta descargar desde el historial.",
        );
      } finally {
        setIsImageLoading(false);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo emitir el pasaporte.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleDownloadImage() {
    if (!imageBlob || !issuedPassport) {
      return;
    }

    const url = URL.createObjectURL(imageBlob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `pasaporte-${issuedPassport.code}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const saleRange = windows
    ? `del ${formatLongDate(windows.saleStart)} al ${formatLongDate(windows.saleEnd)}`
    : "23–28 de noviembre";

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
        <h2 className="text-2xl font-bold">Emitir pasaporte por venta</h2>
        <p className="mt-2 text-sm text-white/65">
          Selecciona el tipo comprado, registra los datos de la clienta y genera el
          cupón con su código para enviarlo por WhatsApp. Ventana de venta {saleRange}.
        </p>

        <form className="mt-6 flex flex-col gap-5" onSubmit={handleCreatePassport}>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPE_OPTIONS.map((option) => (
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
                  {option.discountPercent}%
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
            maxLength={80}
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
            maxLength={25}
          />

          <button
            type="submit"
            className="rounded-2xl bg-amber-300 px-6 py-5 text-sm font-black uppercase tracking-[0.25em] text-[#241a05] shadow-[0_22px_50px_rgba(252,211,77,0.2)] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!clientName.trim() || !clientPhone.trim() || isCreating}
          >
            {isCreating ? "Emitiendo..." : "Emitir pasaporte y generar cupón"}
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
        <h2 className="text-2xl font-bold">Cupón para enviar</h2>

        {!issuedPassport ? (
          <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-6 py-12 text-center text-sm text-white/60">
            Aún no hay un pasaporte emitido en esta sesión.
            Al emitir uno verás aquí la imagen lista para enviar.
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <div className="overflow-hidden rounded-[1.5rem] border border-white/15">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={`Pasaporte ${issuedPassport.code} para ${issuedPassport.clientName}`}
                  className="w-full"
                />
              ) : (
                <div className="px-6 py-12 text-center text-sm text-white/60">
                  {isImageLoading ? "Generando imagen del cupón..." : "Imagen no disponible."}
                </div>
              )}
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
                onClick={handleDownloadImage}
                disabled={!imageBlob}
                className="rounded-2xl bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.22em] text-[#241a05] transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60"
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
  );
}
