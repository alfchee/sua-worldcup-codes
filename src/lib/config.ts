import type { AuthProviderId, PassportTypeId, StorageMode } from "@/lib/types";

export const SESSION_COOKIE_NAME =
  process.env.FIREBASE_SESSION_COOKIE_NAME?.trim() || "worldcup-session";
export const PASSPORT_CODE_LENGTH = 6;
export const HISTORY_LIMIT = 50;
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
export const DEFAULT_PROMO_KEY = "blackend-week-vip-2026";

/**
 * Ventana de venta: los pasaportes solo pueden emitirse en este rango.
 * Ventana de canje: solo pueden usarse en el salón dentro de este rango.
 * Ambas se pueden sobrescribir con variables de entorno (ISO 8601 con zona).
 */
export const SALE_WINDOW_START = getEnvDate(
  process.env.PROMO_SALE_START,
  "2026-11-23T00:00:00-06:00",
);
export const SALE_WINDOW_END = getEnvDate(
  process.env.PROMO_SALE_END,
  "2026-11-28T23:59:59-06:00",
);
export const REDEMPTION_WINDOW_START = getEnvDate(
  process.env.PROMO_REDEMPTION_START,
  "2026-12-01T00:00:00-06:00",
);
export const REDEMPTION_WINDOW_END = getEnvDate(
  process.env.PROMO_REDEMPTION_END,
  "2026-12-31T23:59:59-06:00",
);

export const PASSPORT_TYPES: Record<
  PassportTypeId,
  { label: string; shortLabel: string; discountPercent: number }
> = {
  blackend: {
    label: "Pasaporte VIP Blackend",
    shortLabel: "BLACKEND VIP",
    discountPercent: 50,
  },
  vip: {
    label: "Pasaporte VIP",
    shortLabel: "VIP",
    discountPercent: 40,
  },
};

function getEnvDate(rawValue: string | undefined, fallback: string): Date {
  const parsed = rawValue ? new Date(rawValue) : new Date(fallback);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

export function isPassportTypeId(value: unknown): value is PassportTypeId {
  return value === "blackend" || value === "vip";
}

export function getPassportType(typeId: PassportTypeId) {
  return PASSPORT_TYPES[typeId];
}

export function getPromoKey(): string {
  return process.env.PROMO_KEY?.trim() || DEFAULT_PROMO_KEY;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isFirebaseClientConfigured(): boolean {
  return (
    hasValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
    && hasValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
    && hasValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
    && hasValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)
  );
}

export function isFirebaseAdminConfigured(): boolean {
  return (
    hasValue(process.env.FIREBASE_PROJECT_ID)
    && hasValue(process.env.FIREBASE_CLIENT_EMAIL)
    && hasValue(process.env.FIREBASE_PRIVATE_KEY)
  );
}

export function isFirebaseConfigured(): boolean {
  return isFirebaseClientConfigured() && isFirebaseAdminConfigured();
}

export function getStorageMode(): StorageMode {
  return isFirebaseAdminConfigured() ? "firebase" : "memory";
}

export function getConfiguredAuthProviders(): AuthProviderId[] {
  const rawValue = process.env.NEXT_PUBLIC_FIREBASE_AUTH_PROVIDERS?.trim();

  if (!rawValue) {
    return ["google"];
  }

  const supportedProviders = new Set<AuthProviderId>([
    "google",
    "github",
    "facebook",
    "microsoft",
    "apple",
  ]);

  return rawValue
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is AuthProviderId =>
      supportedProviders.has(value as AuthProviderId),
    );
}

export function getAdminEmailAllowlist(): Set<string> {
  const rawValue = process.env.FIREBASE_ADMIN_EMAILS?.trim();

  if (!rawValue) {
    return new Set();
  }

  return new Set(
    rawValue
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}
