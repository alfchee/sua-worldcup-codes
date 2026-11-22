import type { AuthProviderId, PassportTypeId, StorageMode } from "@/lib/types";

export const SESSION_COOKIE_NAME =
  process.env.FIREBASE_SESSION_COOKIE_NAME?.trim() || "vip-passports-session";
export const PASSPORT_CODE_LENGTH = 6;
/** Intentos de generación ante colisión de código. */
export const CODE_RETRY_ATTEMPTS = 8;
export const HISTORY_LIMIT = 50;
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
export const DEFAULT_PROMO_KEY = "blackend-week-vip-2026";

/**
 * Ventana de venta: los pasaportes solo pueden emitirse en este rango.
 * Ventana de canje: solo pueden usarse en el salón dentro de este rango.
 * Ambas se pueden sobrescribir con variables de entorno (ISO 8601 con zona).
 * Los límites de fin son inclusivos hasta el último milisegundo del día.
 */
export const SALE_WINDOW_START = getEnvDate(
  process.env.PROMO_SALE_START,
  "2026-11-23T00:00:00.000-06:00",
);
export const SALE_WINDOW_END = getEnvDate(
  process.env.PROMO_SALE_END,
  "2026-11-28T23:59:59.999-06:00",
);
export const REDEMPTION_WINDOW_START = getEnvDate(
  process.env.PROMO_REDEMPTION_START,
  "2026-12-01T00:00:00.000-06:00",
);
export const REDEMPTION_WINDOW_END = getEnvDate(
  process.env.PROMO_REDEMPTION_END,
  "2026-12-31T23:59:59.999-06:00",
);

export interface PassportTypeInfo {
  label: string;
  discountPercent: number;
  detail: string;
}

export const PASSPORT_TYPES: Record<PassportTypeId, PassportTypeInfo> = {
  blackend: {
    label: "Pasaporte VIP Blackend",
    discountPercent: 50,
    detail: "Descuento del 50% en servicios",
  },
  vip: {
    label: "Pasaporte VIP",
    discountPercent: 40,
    detail: "Descuento del 40% en servicios",
  },
};

function getEnvDate(rawValue: string | undefined, fallback: string): Date {
  const parsed = parseEnvDate(rawValue) ?? new Date(fallback);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

/**
 * Acepta ISO 8601 con zona (obligatoria según docs). Si el valor no trae
 * zona (`Z` o `±hh:mm`), se interpreta como hora de Managua (-06:00) para
 * no desplazar la ventana 6h por el parseo UTC por defecto de `Date`.
 */
function parseEnvDate(rawValue: string | undefined): Date | null {
  const value = rawValue?.trim();

  if (!value) {
    return null;
  }

  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
    return new Date(value);
  }

  console.warn(
    `[config] La variable de fecha "${value}" no incluye zona horaria; se interpreta como America/Managua (-06:00).`,
  );

  return new Date(`${value}-06:00`);
}

export function isPassportTypeId(value: unknown): value is PassportTypeId {
  return value === "blackend" || value === "vip";
}

export function getPromoKey(): string {
  return process.env.PROMO_KEY?.trim() || DEFAULT_PROMO_KEY;
}

function getEmailAllowlist(rawValue: string | undefined): Set<string> {
  if (!rawValue?.trim()) {
    return new Set();
  }

  return new Set(
    rawValue
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
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
  return getEmailAllowlist(process.env.FIREBASE_ADMIN_EMAILS);
}

/**
 * Correos del personal autorizado. Si está vacía (sin configurar) se mantiene
 * el comportamiento heredado (cualquier cuenta Firebase entra como staff)
 * y se registra una advertencia; configúrala para cierre por defecto.
 */
export function getStaffEmailAllowlist(): Set<string> {
  return getEmailAllowlist(process.env.FIREBASE_STAFF_EMAILS);
}

export function isStrictStaffAllowlistEnabled(): boolean {
  return getStaffEmailAllowlist().size > 0;
}

/** Exige correo verificado en el proveedor email/password (desactivable por env). */
export function isVerifiedEmailRequired(): boolean {
  return process.env.FIREBASE_ALLOW_UNVERIFIED_EMAILS?.trim().toLowerCase() !== "true";
}
