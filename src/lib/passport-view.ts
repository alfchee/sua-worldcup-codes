import { formatDateTime, formatLongDate } from "@/lib/dates";
import type { PassportRecord, PassportTypeId } from "@/lib/types";

/** Dimensiones del PNG del cupón (vertical 4:5, ideal para WhatsApp). */
export const TICKET_IMAGE_WIDTH = 1080;
export const TICKET_IMAGE_HEIGHT = 1350;

export const PASSPORT_ACCENTS: Record<PassportTypeId, { strong: string; badge: string }> = {
  blackend: {
    strong: "#f5c56b",
    badge: "#1c1408",
  },
  vip: {
    strong: "#b9e0c5",
    badge: "#0b1d12",
  },
};

export interface PassportView {
  accent: { strong: string; badge: string };
  statusLabel: string;
  validityRange: string;
  purchasedLabel: string;
  redeemedLabel: string | null;
  heading: string;
}

export function getStatusLabel(status: PassportRecord["status"]): string {
  if (status === "redeemed") {
    return "Canjeado";
  }

  if (status === "void") {
    return "Anulado";
  }

  return "Vendido";
}

/** Modelo de presentación compartido entre el PNG del servidor y el panel. */
export function getPassportView(passport: PassportRecord): PassportView {
  return {
    accent: PASSPORT_ACCENTS[passport.type] ?? PASSPORT_ACCENTS.vip,
    statusLabel: getStatusLabel(passport.status),
    validityRange: `del ${formatLongDate(passport.validFrom)} al ${formatLongDate(passport.validUntil)}`,
    purchasedLabel: formatDateTime(passport.purchasedAt),
    redeemedLabel: passport.redeemedAt
      ? `${formatDateTime(passport.redeemedAt)} · ${passport.redeemedByEmail ?? ""}`
      : null,
    heading: `${passport.typeLabel} · ${passport.discountPercent}%`,
  };
}
