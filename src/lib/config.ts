import type { AuthProviderId, StorageMode } from "@/lib/types";

export const SESSION_COOKIE_NAME =
  process.env.FIREBASE_SESSION_COOKIE_NAME?.trim() || "worldcup-session";
export const COUPON_CODE_LENGTH = 5;
export const COUPON_TTL_MS = 2 * 60 * 1000;
export const PUBLIC_POLL_INTERVAL_MS = 5_000;
export const HISTORY_LIMIT = 12;
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
export const DEFAULT_EVENT_KEY = "world-cup-day-finale-2026";

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

export function getEventKey(): string {
  return process.env.EVENT_KEY?.trim() || DEFAULT_EVENT_KEY;
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
