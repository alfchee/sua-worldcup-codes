import crypto from "node:crypto";

import {
  CODE_RETRY_ATTEMPTS,
  PASSPORT_CODE_LENGTH,
  PASSPORT_TYPES,
  REDEMPTION_WINDOW_END,
  REDEMPTION_WINDOW_START,
  SALE_WINDOW_END,
  SALE_WINDOW_START,
  HISTORY_LIMIT,
  getPromoKey,
  getStorageMode,
  isFirebaseAdminConfigured,
  isPassportTypeId,
} from "@/lib/config";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type {
  PassportRecord,
  PassportStatus,
  PassportStoreRecord,
  PassportTypeId,
  PromoWindows,
  SessionUser,
  StorageMode,
} from "@/lib/types";

declare global {
  var __vipPassports: PassportStoreRecord[] | undefined;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "purchased",
  "redeemed",
  "void",
]);

export function getPromoWindows(): PromoWindows {
  return {
    saleStart: SALE_WINDOW_START.toISOString(),
    saleEnd: SALE_WINDOW_END.toISOString(),
    redemptionStart: REDEMPTION_WINDOW_START.toISOString(),
    redemptionEnd: REDEMPTION_WINDOW_END.toISOString(),
  };
}

function getMemoryStore(): PassportStoreRecord[] {
  if (!globalThis.__vipPassports) {
    globalThis.__vipPassports = [];
  }

  return globalThis.__vipPassports;
}

function generatePassportCode(): string {
  const randomBytes = crypto.randomBytes(PASSPORT_CODE_LENGTH);
  let code = "";

  for (const byte of randomBytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }

  return code;
}

function toPassportRecord(record: PassportStoreRecord): PassportRecord {
  return {
    ...record,
    typeLabel: PASSPORT_TYPES[record.type].label,
  };
}

interface CreatePassportOptions {
  type: PassportTypeId;
  clientName: string;
  clientPhone: string;
  sessionUser: SessionUser | null;
}

function buildRecord(options: CreatePassportOptions & { code: string }): PassportStoreRecord {
  const purchasedAt = new Date();

  return {
    id: options.code,
    code: options.code,
    type: options.type,
    discountPercent: PASSPORT_TYPES[options.type].discountPercent,
    clientName: options.clientName,
    clientPhone: options.clientPhone,
    status: "purchased" satisfies PassportStatus,
    purchasedAt: purchasedAt.toISOString(),
    validFrom: REDEMPTION_WINDOW_START.toISOString(),
    validUntil: REDEMPTION_WINDOW_END.toISOString(),
    createdByUid: options.sessionUser?.uid ?? null,
    createdByEmail: options.sessionUser?.email ?? null,
    redeemedAt: null,
    redeemedByEmail: null,
    promoKey: getPromoKey(),
  };
}

function sortNewestFirst(records: PassportStoreRecord[]): PassportStoreRecord[] {
  return [...records].sort((left, right) =>
    right.purchasedAt.localeCompare(left.purchasedAt),
  );
}

type FirebasePassportDocument = {
  code: string;
  type: unknown;
  discountPercent: unknown;
  clientName: unknown;
  clientPhone: unknown;
  status: unknown;
  purchasedAt: unknown;
  validFrom: unknown;
  validUntil: unknown;
  createdByUid?: unknown;
  createdByEmail?: unknown;
  redeemedAt?: unknown;
  redeemedByEmail?: unknown;
  promoKey?: unknown;
};

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }

  return new Date(value as string | number);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Valida el documento crudo: estados/tipos corruptos no son canjeables. */
function fromFirebaseDocument(
  id: string,
  document: FirebasePassportDocument,
): PassportStoreRecord | null {
  const type: PassportTypeId = isPassportTypeId(document.type)
    ? document.type
    : "vip";
  const status: PassportStatus =
    typeof document.status === "string" && VALID_STATUSES.has(document.status)
      ? (document.status as PassportStatus)
      : "void";
  const code = asString(document.code);

  if (!code) {
    return null;
  }

  return {
    id,
    code,
    type,
    discountPercent:
      typeof document.discountPercent === "number"
        ? document.discountPercent
        : PASSPORT_TYPES[type].discountPercent,
    clientName: asString(document.clientName),
    clientPhone: asString(document.clientPhone),
    status,
    purchasedAt: toDate(document.purchasedAt).toISOString(),
    validFrom: toDate(document.validFrom).toISOString(),
    validUntil: toDate(document.validUntil).toISOString(),
    createdByUid: asNullableString(document.createdByUid),
    createdByEmail: asNullableString(document.createdByEmail),
    redeemedAt: document.redeemedAt ? toDate(document.redeemedAt).toISOString() : null,
    redeemedByEmail: asNullableString(document.redeemedByEmail),
    promoKey: asString(document.promoKey, getPromoKey()),
  };
}

export interface RedeemVerdict {
  canRedeem: boolean;
  reason: string | null;
}

/**
 * El gate se evalúa contra las fechas propias del documento (las que ve la
 * clienta en su cupón), no contra las globales de entorno: si las ventanas se
 * reconfiguran tras la emisión, el pasaporte sigue honrando lo impreso.
 */
export function getRedeemability(now: Date, record: PassportStoreRecord): RedeemVerdict {
  if (record.status === "redeemed") {
    return { canRedeem: false, reason: "Este pasaporte ya fue canjeado." };
  }

  if (record.status === "void") {
    return { canRedeem: false, reason: "Este pasaporte fue anulado." };
  }

  const validFrom = new Date(record.validFrom);
  const validUntil = new Date(record.validUntil);

  if (now < validFrom) {
    return {
      canRedeem: false,
      reason: "El pasaporte es válido, pero el canje aún no inicia. Revisa la fecha impresa en el cupón.",
    };
  }

  if (now > validUntil) {
    return {
      canRedeem: false,
      reason: "La ventana de canje de este pasaporte ya finalizó.",
    };
  }

  return { canRedeem: true, reason: null };
}

async function listFromFirebase(limit = HISTORY_LIMIT): Promise<{
  passports: PassportRecord[];
  truncated: boolean;
}> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("vipPassports")
    .where("promoKey", "==", getPromoKey())
    .orderBy("purchasedAt", "desc")
    .limit(limit + 1)
    .get();

  const records = snapshot.docs
    .map((document) =>
      fromFirebaseDocument(document.id, document.data() as FirebasePassportDocument),
    )
    .filter((record): record is PassportStoreRecord => record !== null);

  return {
    passports: records.slice(0, limit).map(toPassportRecord),
    truncated: records.length > limit,
  };
}

async function findByCodeInFirebase(code: string): Promise<PassportStoreRecord | null> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("vipPassports")
    .where("code", "==", code)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const document = snapshot.docs[0];

  return fromFirebaseDocument(document.id, document.data() as FirebasePassportDocument);
}

/**
 * Unicidad atómica: el código ES el ID del documento y se usa `create()`,
 * que falla si ya existe. Sin check-then-set: dos creates concurrentes con
 * el mismo código no pueden duplicarlo.
 */
async function createPassportInFirebase(
  options: CreatePassportOptions,
): Promise<PassportRecord> {
  const firestore = getFirebaseAdminFirestore();

  for (let attempt = 0; attempt < CODE_RETRY_ATTEMPTS; attempt += 1) {
    const record = buildRecord({ ...options, code: generatePassportCode() });
    const documentRef = firestore.collection("vipPassports").doc(record.code);

    try {
      await documentRef.create({
        code: record.code,
        type: record.type,
        discountPercent: record.discountPercent,
        clientName: record.clientName,
        clientPhone: record.clientPhone,
        status: record.status,
        purchasedAt: new Date(record.purchasedAt),
        validFrom: new Date(record.validFrom),
        validUntil: new Date(record.validUntil),
        createdByUid: record.createdByUid,
        createdByEmail: record.createdByEmail,
        redeemedAt: null,
        redeemedByEmail: null,
        promoKey: record.promoKey,
      });

      return toPassportRecord(record);
    } catch (error) {
      const code = (error as { code?: number })?.code;

      if (code === 6) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("No se pudo generar un código único tras varios intentos.");
}

function createPassportInMemory(options: CreatePassportOptions): PassportRecord {
  const store = getMemoryStore();

  for (let attempt = 0; attempt < CODE_RETRY_ATTEMPTS; attempt += 1) {
    const code = generatePassportCode();

    if (store.some((record) => record.code === code)) {
      continue;
    }

    const record = buildRecord({ ...options, code });
    store.unshift(record);

    return toPassportRecord(record);
  }

  throw new Error("No se pudo generar un código único tras varios intentos.");
}

export function isSaleWindowOpen(now = new Date()): boolean {
  return now >= SALE_WINDOW_START && now <= SALE_WINDOW_END;
}

export async function listPassports(limit = HISTORY_LIMIT): Promise<{
  passports: PassportRecord[];
  truncated: boolean;
}> {
  if (isFirebaseAdminConfigured()) {
    return listFromFirebase(limit);
  }

  const sorted = sortNewestFirst(getMemoryStore());

  return {
    passports: sorted.slice(0, limit).map(toPassportRecord),
    truncated: sorted.length > limit,
  };
}

export async function createPassport(options: CreatePassportOptions): Promise<PassportRecord> {
  if (isFirebaseAdminConfigured()) {
    return createPassportInFirebase(options);
  }

  return createPassportInMemory(options);
}

export async function lookupPassport(
  rawCode: string,
  now = new Date(),
): Promise<{
  passport: PassportRecord | null;
  canRedeem: boolean;
  reason: string | null;
}> {
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";

  if (!code) {
    return { passport: null, canRedeem: false, reason: "Ingresa un código." };
  }

  const record = isFirebaseAdminConfigured()
    ? await findByCodeInFirebase(code)
    : getMemoryStore().find((candidate) => candidate.code === code) ?? null;

  if (!record) {
    return {
      passport: null,
      canRedeem: false,
      reason: "No existe ningún pasaporte con ese código.",
    };
  }

  const verdict = getRedeemability(now, record);

  return {
    passport: toPassportRecord(record),
    canRedeem: verdict.canRedeem,
    reason: verdict.reason,
  };
}

function toStoreUpdate(
  record: PassportStoreRecord,
  redeemedAt: string,
  redeemedByEmail: string,
): PassportStoreRecord {
  return {
    ...record,
    status: "redeemed",
    redeemedAt,
    redeemedByEmail,
  };
}

/**
 * Canje atómico de un solo uso: la lectura, la validación de estado/ventana
 * y la escritura ocurren dentro de una transacción Firestore, así que dos
 * canjes concurrentes no pueden marcar el mismo código.
 */
async function redeemPassportInFirebase(
  code: string,
  sessionUser: SessionUser,
  now: Date,
): Promise<PassportRecord> {
  const firestore = getFirebaseAdminFirestore();
  const redeemedAt = now.toISOString();
  const redeemedByEmail = sessionUser.email ?? sessionUser.uid;

  const updated = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(
      firestore.collection("vipPassports").where("code", "==", code).limit(1),
    );

    if (snapshot.empty) {
      throw new Error("Pasaporte no encontrado.");
    }

    const document = snapshot.docs[0];
    const record = fromFirebaseDocument(
      document.id,
      document.data() as FirebasePassportDocument,
    );

    if (!record) {
      throw new Error("El pasaporte está corrupto y no se puede canjear.");
    }

    const verdict = getRedeemability(now, record);

    if (!verdict.canRedeem) {
      throw new Error(verdict.reason ?? "El pasaporte no se puede canjear.");
    }

    transaction.update(document.ref, {
      status: "redeemed" satisfies PassportStatus,
      redeemedAt: new Date(redeemedAt),
      redeemedByEmail,
    });

    return toStoreUpdate(record, redeemedAt, redeemedByEmail);
  });

  return toPassportRecord(updated);
}

function redeemPassportInMemory(
  code: string,
  sessionUser: SessionUser,
  now: Date,
): PassportRecord {
  const store = getMemoryStore();
  const index = store.findIndex((candidate) => candidate.code === code);

  if (index === -1) {
    throw new Error("Pasaporte no encontrado.");
  }

  // Re-validación inmediatamente antes de escribir: sin awaits entre la
  // lectura y la escritura no hay interleaving posible.
  const current = store[index];
  const verdict = getRedeemability(now, current);

  if (!verdict.canRedeem) {
    throw new Error(verdict.reason ?? "El pasaporte no se puede canjear.");
  }

  const redeemedAt = now.toISOString();
  const redeemedByEmail = sessionUser.email ?? sessionUser.uid;

  store[index] = toStoreUpdate(current, redeemedAt, redeemedByEmail);

  return toPassportRecord(store[index]);
}

export async function redeemPassport(
  rawCode: string,
  sessionUser: SessionUser,
  now = new Date(),
): Promise<PassportRecord> {
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";

  if (!code) {
    throw new Error("Ingresa un código.");
  }

  if (isFirebaseAdminConfigured()) {
    return redeemPassportInFirebase(code, sessionUser, now);
  }

  return redeemPassportInMemory(code, sessionUser, now);
}

export function getPassportStorageMode(): StorageMode {
  return getStorageMode();
}
