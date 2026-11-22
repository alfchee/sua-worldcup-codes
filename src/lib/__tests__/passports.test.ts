import { describe, expect, it } from "vitest";

import { isSaleWindowOpen } from "@/lib/passports";
import type { PassportStoreRecord } from "@/lib/types";
import { getRedeemability } from "@/lib/passports";

function buildRecord(overrides: Partial<PassportStoreRecord> = {}): PassportStoreRecord {
  return {
    id: "K7M2XQ",
    code: "K7M2XQ",
    type: "blackend",
    discountPercent: 50,
    clientName: "María José López",
    clientPhone: "88881234",
    status: "purchased",
    purchasedAt: "2026-11-25T12:00:00.000-06:00",
    validFrom: "2026-12-01T00:00:00.000-06:00",
    validUntil: "2026-12-31T23:59:59.999-06:00",
    createdByUid: "uid-1",
    createdByEmail: "staff@example.com",
    redeemedAt: null,
    redeemedByEmail: null,
    promoKey: "blackend-week-vip-2026",
    ...overrides,
  };
}

describe("isSaleWindowOpen", () => {
  it("abre dentro de la ventana de venta", () => {
    expect(isSaleWindowOpen(new Date("2026-11-25T12:00:00.000-06:00"))).toBe(true);
  });

  it("cierra fuera de la ventana de venta", () => {
    expect(isSaleWindowOpen(new Date("2026-11-22T12:00:00.000-06:00"))).toBe(false);
    expect(isSaleWindowOpen(new Date("2026-11-29T00:00:00.000-06:00"))).toBe(false);
  });

  it("incluye el último milisegundo del 28 de noviembre", () => {
    expect(isSaleWindowOpen(new Date("2026-11-28T23:59:59.999-06:00"))).toBe(true);
  });
});

describe("getRedeemability", () => {
  const inWindow = new Date("2026-12-15T12:00:00.000-06:00");

  it("permite canjear un pasaporte comprado dentro de su vigencia", () => {
    const verdict = getRedeemability(inWindow, buildRecord());

    expect(verdict).toEqual({ canRedeem: true, reason: null });
  });

  it("rechaza pasaportes ya canjeados o anulados", () => {
    expect(getRedeemability(inWindow, buildRecord({ status: "redeemed" })).canRedeem).toBe(false);
    expect(getRedeemability(inWindow, buildRecord({ status: "void" })).canRedeem).toBe(false);
  });

  it("evalúa contra las fechas del documento, no las globales", () => {
    const custom = buildRecord({
      validFrom: "2026-12-10T00:00:00.000-06:00",
      validUntil: "2026-12-20T23:59:59.999-06:00",
    });

    expect(getRedeemability(new Date("2026-12-05T12:00:00.000-06:00"), custom).canRedeem).toBe(false);
    expect(getRedeemability(new Date("2026-12-25T12:00:00.000-06:00"), custom).canRedeem).toBe(false);
    expect(getRedeemability(new Date("2026-12-15T12:00:00.000-06:00"), custom).canRedeem).toBe(true);
  });
});
