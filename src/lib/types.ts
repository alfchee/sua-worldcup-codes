export type StorageMode = "memory" | "firebase";
export type UserRole = "admin" | "staff";
export type AuthProviderId =
  | "google"
  | "github"
  | "facebook"
  | "microsoft"
  | "apple";

export type PassportTypeId = "blackend" | "vip";
export type PassportStatus = "purchased" | "redeemed" | "void";

export interface PassportRecord {
  id: string;
  code: string;
  type: PassportTypeId;
  typeLabel: string;
  discountPercent: number;
  clientName: string;
  clientPhone: string;
  status: PassportStatus;
  purchasedAt: string;
  validFrom: string;
  validUntil: string;
  createdByUid: string | null;
  createdByEmail: string | null;
  redeemedAt: string | null;
  redeemedByEmail: string | null;
  promoKey: string;
}

// Representación interna de la capa de almacenamiento; la forma coincide con PassportRecord.
export type PassportStoreRecord = PassportRecord;

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  providers: string[];
}

export interface AdminPassportsResponse {
  passports: PassportRecord[];
  storageMode: StorageMode;
  sessionUser: SessionUser;
  now: string;
}

export interface CreatePassportResponse {
  passport: PassportRecord;
  storageMode: StorageMode;
}

export interface LookupPassportResponse {
  passport: PassportRecord | null;
  canRedeem: boolean;
  reason: string | null;
  now: string;
}

export interface RedeemPassportResponse {
  passport: PassportRecord;
  now: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user: SessionUser | null;
}

export interface RedemptionWindowInfo {
  saleStart: string;
  saleEnd: string;
  redemptionStart: string;
  redemptionEnd: string;
  now: string;
}
