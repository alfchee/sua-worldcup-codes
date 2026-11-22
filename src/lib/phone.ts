/** Prefijo internacional de Nicaragua para números locales de 8 dígitos. */
export const NI_COUNTRY_PREFIX = "505";
/** Largo de un número local nicaragüense (8 dígitos). */
export const NI_LOCAL_LENGTH = 8;
/** Largo máximo de un número internacional E.164 (15 dígitos). */
export const MAX_PHONE_DIGITS = 15;

/** Largo del nombre de clienta: mínimo 3, máximo 80 caracteres. */
export const CLIENT_NAME_MIN_LENGTH = 3;
export const CLIENT_NAME_MAX_LENGTH = 80;

/** Caracteres permitidos en el nombre: letras (con tildes), espacios y signos básicos. */
const CLIENT_NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;

export function getPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Convierte un teléfono a formato internacional para `wa.me`.
 * - `00...` (marcación internacional) → quita el prefijo y re-evalúa.
 * - troncal `0` inicial (ej. `088881234`) → quita el cero.
 * - 8 dígitos → número local nicaragüense, antepone 505.
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  let digits = getPhoneDigits(phone);

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (
    digits.startsWith("0")
    && digits.length === NI_LOCAL_LENGTH + 1
    && !digits.startsWith("00")
  ) {
    digits = digits.slice(1);
  }

  if (digits.length === NI_LOCAL_LENGTH) {
    return `${NI_COUNTRY_PREFIX}${digits}`;
  }

  return digits;
}

export function validateClientName(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") {
    return "El nombre de la clienta es obligatorio.";
  }

  const value = rawValue.trim();

  if (value.length < CLIENT_NAME_MIN_LENGTH) {
    return "Ingresa el nombre de la clienta (mínimo 3 caracteres).";
  }

  if (value.length > CLIENT_NAME_MAX_LENGTH) {
    return "El nombre de la clienta no puede superar 80 caracteres.";
  }

  if (!CLIENT_NAME_PATTERN.test(value)) {
    return "El nombre de la clienta contiene caracteres no permitidos.";
  }

  return null;
}

export function validateClientPhone(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") {
    return "El número de WhatsApp de la clienta es obligatorio.";
  }

  const digits = getPhoneDigits(rawValue);

  if (digits.length < NI_LOCAL_LENGTH) {
    return "Ingresa un número de WhatsApp válido para la clienta.";
  }

  if (digits.length > MAX_PHONE_DIGITS) {
    return "El número de WhatsApp no puede superar 15 dígitos.";
  }

  return null;
}

export function validatePassportCode(rawValue: unknown): string | null {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return "Ingresa un código.";
  }

  return null;
}

/** Normaliza un nombre para compararlo (verificación al canjear). */
export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
