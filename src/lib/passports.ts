import crypto from "node:crypto";

import {
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
  SessionUser,
  StorageMode,
} from "@/lib/types";

declare global {
  var __vipPassports: PassportStoreRecord[] | undefined;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
    id: record.id,
    code: record.code,
    type: record.type,
    typeLabel: PASSPORT_TYPES[record.type].label,
    discountPercent: record.discountPercent,
    clientName: record.clientName,
    clientPhone: record.clientPhone,
    status: record.status,
    purchasedAt: record.purchasedAt,
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    createdByUid: record.createdByUid,
    createdByEmail: record.createdByEmail,
    redeemedAt: record.redeemedAt,
    redeemedByEmail: record.redeemedByEmail,
    promoKey: record.promoKey,
  };
}

interface CreatePassportOptions {
  type: PassportTypeId;
  clientName: string;
  clientPhone: string;
  sessionUser: SessionUser | null;
}

function createRecord(options: {
  code: string;
  type: PassportTypeId;
  clientName: string;
  clientPhone: string;
  sessionUser: SessionUser | null;
}): PassportStoreRecord {
  const purchasedAt = new Date();

  return {
    id: crypto.randomUUID(),
    code: options.code,
    type: options.type,
    typeLabel: PASSPORT_TYPES[options.type].label,
    discountPercent: PASSPORT_TYPES[options.type].discountPercent,
    clientName: options.clientName,
    clientPhone: options.clientPhone,
    status: "purchased" as PassportStatus,
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
  type: string;
  discountPercent: number;
  clientName: string;
  clientPhone: string;
  status: string;
  purchasedAt: Date;
  validFrom: Date;
  validUntil: Date;
  createdByUid?: string | null;
  createdByEmail?: string | null;
  redeemedAt?: Date | null;
  redeemedByEmail?: string | null;
  promoKey?: string;
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

function fromFirebaseDocument(
  id: string,
  document: FirebasePassportDocument,
): PassportStoreRecord {
  const type: PassportTypeId = isPassportTypeId(document.type)
    ? document.type
    : "vip";

  return {
    id,
    code: document.code,
    type,
    typeLabel: PASSPORT_TYPES[type].label,
    discountPercent: document.discountPercent ?? PASSPORT_TYPES[type].discountPercent,
    clientName: document.clientName,
    clientPhone: document.clientPhone,
    status: (document.status as PassportStatus) ?? "purchased",
    purchasedAt: toDate(document.purchasedAt).toISOString(),
    validFrom: toDate(document.validFrom).toISOString(),
    validUntil: toDate(document.validUntil).toISOString(),
    createdByUid: document.createdByUid ?? null,
    createdByEmail: document.createdByEmail ?? null,
    redeemedAt: document.redeemedAt ? toDate(document.redeemedAt).toISOString() : null,
    redeemedByEmail: document.redeemedByEmail ?? null,
    promoKey: document.promoKey ?? getPromoKey(),
  };
}

function getRecordTypeStatus(now: Date, record: PassportStoreRecord): {
  canRedeem: boolean;
  reason: string | null;
} {
  if (record.status === "redeemed") {
    return { canRedeem: false, reason: "Este pasaporte ya fue canjeado." };
  }

  if (record.status === "void") {
    return { canRedeem: false, reason: "Este pasaporte fue anulado." };
  }

  if (now < REDEMPTION_WINDOW_START) {
    return {
      canRedeem: false,
      reason: "El canje inicia el 1 de diciembre. El pasaporte es válido, todavía no se puede usar.",
    };
  }

  if (now > REDEMPTION_WINDOW_END) {
    return {
      canRedeem: false,
      reason: "La ventana de canje finalizó el 31 de diciembre.",
    };
  }

  return { canRedeem: true, reason: null };
}

async function listFromFirebase(limit = HISTORY_LIMIT): Promise<PassportRecord[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("vipPassports")
    .where("promoKey", "==", getPromoKey())
    .orderBy("purchasedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((document) =>
    toPassportRecord(
      fromFirebaseDocument(document.id, document.data() as FirebasePassportDocument),
    ),
  );
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

async function createPassportInFirebase(
  options: CreatePassportOptions,
): Promise<PassportRecord> {
  const firestore = getFirebaseAdminFirestore();
  const passportsCollection = firestore.collection("vipPassports");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const record = createRecord({
      ...options,
      code: generatePassportCode(),
    });
    const duplicateSnapshot = await passportsCollection
      .where("code", "==", record.code)
      .limit(1)
      .get();

    if (!duplicateSnapshot.empty) {
      continue;
    }

    await passportsCollection.doc(record.id).set({
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
  }

  throw new Error("No se pudo generar un código único tras varios intentos.");
}

function createPassportInMemory(
  options: CreatePassportOptions,
): PassportRecord {
  const store = getMemoryStore();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generatePassportCode();

    if (store.some((record) => record.code === code)) {
      continue;
    }

    const record = createRecord({ ...options, code });
    store.unshift(record);

    return toPassportRecord(record);
  }

  throw new Error("No se pudo generar un código único tras varios intentos.");
}

export function isSaleWindowOpen(now = new Date()): boolean {
  return now >= SALE_WINDOW_START && now <= SALE_WINDOW_END;
}

export async function listPassports(limit = HISTORY_LIMIT): Promise<PassportRecord[]> {
  if (isFirebaseAdminConfigured()) {
    return listFromFirebase(limit);
  }

  return sortNewestFirst(getMemoryStore()).slice(0, limit).map(toPassportRecord);
}

export async function createPassport(options: {
  type: PassportTypeId;
  clientName: string;
  clientPhone: string;
  sessionUser: SessionUser | null;
}): Promise<PassportRecord> {
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
  const code = rawCode.trim().toUpperCase();

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

  const verdict = getRecordTypeStatus(now, record);

  return {
    passport: toPassportRecord(record),
    canRedeem: verdict.canRedeem,
    reason: verdict.reason,
  };
}

export async function redeemPassport(
  rawCode: string,
  sessionUser: SessionUser,
  now = new Date(),
): Promise<PassportRecord> {
  const code = rawCode.trim().toUpperCase();
  const lookup = await lookupPassport(code, now);

  if (!lookup.passport) {
    throw new Error(lookup.reason ?? "Pasaporte no encontrado.");
  }

  if (!lookup.canRedeem) {
    throw new Error(lookup.reason ?? "El pasaporte no se puede canjear.");
  }

  const redeemedAt = now.toISOString();
  const redeemedByEmail = sessionUser.email ?? sessionUser.uid;

  if (isFirebaseAdminConfigured()) {
    const record = await findByCodeInFirebase(code);

    if (!record) {
      throw new Error("Pasaporte no encontrado.");
    }

    await getFirebaseAdminFirestore()
      .collection("vipPassports")
      .doc(record.id)
      .update({
        status: "redeemed" satisfies PassportStatus,
        redeemedAt: new Date(redeemedAt),
        redeemedByEmail,
      });

    return toPassportRecord({
      ...record,
      status: "redeemed",
      redeemedAt,
      redeemedByEmail,
    });
  }

  const store = getMemoryStore();
  const index = store.findIndex((candidate) => candidate.code === code);

  if (index === -1) {
    throw new Error("Pasaporte no encontrado.");
  }

  store[index] = {
    ...store[index],
    status: "redeemed",
    redeemedAt,
    redeemedByEmail,
  };

  return toPassportRecord(store[index]);
}

export function getPassportStorageMode(): StorageMode {
  return getStorageMode();
}
