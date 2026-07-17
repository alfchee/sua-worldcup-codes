export type StorageMode = "memory" | "firebase";
export type UserRole = "admin" | "staff";
export type AuthProviderId =
  | "google"
  | "github"
  | "facebook"
  | "microsoft"
  | "apple";

export interface CouponRecord {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
}

export interface CouponStoreRecord {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  createdByUid: string | null;
  createdByEmail: string | null;
  eventKey: string;
}

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  providers: string[];
}

export interface PublicCouponsResponse {
  now: string;
  coupons: CouponRecord[];
  storageMode: StorageMode;
}

export interface AdminCouponsResponse {
  coupons: CouponRecord[];
  storageMode: StorageMode;
  sessionUser: SessionUser;
}

export interface PublishCouponResponse {
  coupon: CouponRecord;
  storageMode: StorageMode;
}

export interface SessionResponse {
  authenticated: boolean;
  user: SessionUser | null;
}
