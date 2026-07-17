import crypto from "node:crypto";

import {
  COUPON_CODE_LENGTH,
  COUPON_TTL_MS,
  HISTORY_LIMIT,
  getEventKey,
  getStorageMode,
  isFirebaseAdminConfigured,
} from "@/lib/config";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { CouponRecord, CouponStoreRecord, SessionUser, StorageMode } from "@/lib/types";

declare global {
  var __worldCupCoupons: CouponStoreRecord[] | undefined;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getMemoryStore(): CouponStoreRecord[] {
  if (!globalThis.__worldCupCoupons) {
    globalThis.__worldCupCoupons = [];
  }

  return globalThis.__worldCupCoupons;
}

function toCouponRecord(record: CouponStoreRecord): CouponRecord {
  return {
    id: record.id,
    code: record.code,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

function generateCouponCode(): string {
  const randomBytes = crypto.randomBytes(COUPON_CODE_LENGTH);
  let code = "";

  for (const byte of randomBytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }

  return code;
}

function createRecordForCode(code: string): CouponStoreRecord {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + COUPON_TTL_MS);

  return {
    id: crypto.randomUUID(),
    code,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    createdByUid: null,
    createdByEmail: null,
    eventKey: getEventKey(),
  };
}

function sortNewestFirst(records: CouponStoreRecord[]): CouponStoreRecord[] {
  return [...records].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function fromFirebaseDocument(
  id: string,
  document: {
    code: string;
    createdAt: Date;
    expiresAt: Date;
    createdByUid?: string | null;
    createdByEmail?: string | null;
    eventKey?: string;
  },
): CouponStoreRecord {
  return {
    id,
    code: document.code,
    createdAt: document.createdAt.toISOString(),
    expiresAt: document.expiresAt.toISOString(),
    createdByUid: document.createdByUid ?? null,
    createdByEmail: document.createdByEmail ?? null,
    eventKey: document.eventKey ?? getEventKey(),
  };
}

async function listRecentFromFirebase(limit = HISTORY_LIMIT): Promise<CouponRecord[]> {
  const snapshot = await getFirebaseAdminFirestore()
    .collection("couponCodes")
    .where("eventKey", "==", getEventKey())
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((document) =>
    toCouponRecord(
      fromFirebaseDocument(document.id, {
        code: document.get("code") as string,
        createdAt: (document.get("createdAt") as { toDate: () => Date }).toDate(),
        expiresAt: (document.get("expiresAt") as { toDate: () => Date }).toDate(),
        createdByUid: (document.get("createdByUid") as string | null | undefined) ?? null,
        createdByEmail:
          (document.get("createdByEmail") as string | null | undefined) ?? null,
        eventKey: (document.get("eventKey") as string | undefined) ?? getEventKey(),
      }),
    ),
  );
}

async function listActiveFromFirebase(nowIso: string): Promise<CouponRecord[]> {
  const recentCoupons = await listRecentFromFirebase(HISTORY_LIMIT * 4);

  return recentCoupons.filter((record) => record.expiresAt > nowIso);
}

async function createCouponInFirebase(sessionUser: SessionUser): Promise<CouponRecord> {
  const firestore = getFirebaseAdminFirestore();
  const couponsCollection = firestore.collection("couponCodes");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const record = createRecordForCode(generateCouponCode());
    const duplicateSnapshot = await couponsCollection
      .where("code", "==", record.code)
      .limit(1)
      .get();

    if (!duplicateSnapshot.empty) {
      continue;
    }

    const documentRef = couponsCollection.doc(record.id);

    await documentRef.set({
      code: record.code,
      createdAt: new Date(record.createdAt),
      expiresAt: new Date(record.expiresAt),
      createdByUid: sessionUser.uid,
      createdByEmail: sessionUser.email,
      eventKey: getEventKey(),
    });

    return toCouponRecord(record);
  }

  throw new Error("No se pudo generar un código de cupón único tras varios intentos.");
}

async function createCouponInMemory(): Promise<CouponRecord> {
  const store = getMemoryStore();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateCouponCode();

    if (store.some((record) => record.code === code)) {
      continue;
    }

    const record = createRecordForCode(code);
    store.unshift(record);

    return toCouponRecord(record);
  }

  throw new Error("No se pudo generar un código de cupón único tras varios intentos.");
}

export async function listRecentCoupons(limit = HISTORY_LIMIT): Promise<CouponRecord[]> {
  if (isFirebaseAdminConfigured()) {
    return listRecentFromFirebase(limit);
  }

  return sortNewestFirst(getMemoryStore()).slice(0, limit).map(toCouponRecord);
}

export async function listActiveCoupons(now = new Date()): Promise<CouponRecord[]> {
  const nowIso = now.toISOString();

  if (isFirebaseAdminConfigured()) {
    return listActiveFromFirebase(nowIso);
  }

  return sortNewestFirst(getMemoryStore())
    .filter((record) => record.expiresAt > nowIso)
    .map(toCouponRecord);
}

export async function createCoupon(sessionUser: SessionUser): Promise<CouponRecord> {
  if (isFirebaseAdminConfigured()) {
    return createCouponInFirebase(sessionUser);
  }

  return createCouponInMemory();
}

export function getCouponStorageMode(): StorageMode {
  return getStorageMode();
}
