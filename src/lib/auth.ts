import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  getAdminEmailAllowlist,
  getStaffEmailAllowlist,
  isStrictStaffAllowlistEnabled,
  isVerifiedEmailRequired,
} from "@/lib/config";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { SessionUser, UserRole } from "@/lib/types";

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  };
}

function getProviderList(token: DecodedIdToken): string[] {
  const identities = token.firebase.identities ?? {};
  const providers = Object.keys(identities);

  if (providers.length > 0) {
    return providers;
  }

  const signInProvider = token.firebase.sign_in_provider;

  return signInProvider ? [signInProvider] : [];
}

/**
 * Cierre por defecto: solo entran correos en las allowlists.
 * - admin: si el correo está en FIREBASE_ADMIN_EMAILS (siempre manda).
 * - staff: si está en FIREBASE_STAFF_EMAILS, o si esa lista no está
 *   configurada se mantiene el comportamiento heredado (cualquier cuenta
 *   entra como staff) con advertencia en logs.
 * El rol se deriva de las listas en cada sincronización: sacar a alguien de
 * la lista lo degrada de inmediato (sin admin "pegajoso").
 */
function resolveRole(normalizedEmail: string | null): UserRole {
  const adminEmails = getAdminEmailAllowlist();

  if (normalizedEmail && adminEmails.has(normalizedEmail)) {
    return "admin";
  }

  if (!isStrictStaffAllowlistEnabled()) {
    console.warn(
      "[auth] FIREBASE_STAFF_EMAILS no está configurado: cualquier cuenta Firebase entra como staff. Configúralo para cierre por defecto.",
    );

    return "staff";
  }

  if (normalizedEmail && getStaffEmailAllowlist().has(normalizedEmail)) {
    return "staff";
  }

  throw new Error(
    "Tu cuenta no está autorizada para el panel interno. Pide acceso al administrador.",
  );
}

function assertEmailVerified(token: DecodedIdToken): void {
  if (!isVerifiedEmailRequired()) {
    return;
  }

  if (token.firebase.sign_in_provider !== "password") {
    return;
  }

  if (token.email_verified !== true) {
    throw new Error(
      "Debes verificar tu correo antes de ingresar. Revisa tu bandeja y confirma el enlace de verificación.",
    );
  }
}

async function syncUserProfile(token: DecodedIdToken): Promise<SessionUser> {
  if (!token.email) {
    throw new Error("Tu cuenta no tiene correo asociado y no puede ingresar.");
  }

  assertEmailVerified(token);

  const firestore = getFirebaseAdminFirestore();
  const userRef = firestore.collection("users").doc(token.uid);
  const snapshot = await userRef.get();
  const normalizedEmail = token.email.toLowerCase();
  const role = resolveRole(normalizedEmail);
  const providers = getProviderList(token);

  const baseDocument = {
    uid: token.uid,
    email: token.email,
    displayName: token.name ?? null,
    providers,
    updatedAt: new Date(),
    disabled: false,
  };

  if (!snapshot.exists) {
    await userRef.set({
      ...baseDocument,
      role,
      createdAt: new Date(),
    });
  } else {
    // El rol se re-deriva siempre: una remoción de la allowlist degrada
    // al usuario en el siguiente login/refresh de sesión.
    await userRef.set(
      {
        ...baseDocument,
        role,
      },
      { merge: true },
    );
  }

  return {
    uid: token.uid,
    email: token.email,
    displayName: token.name ?? null,
    role,
    providers,
  };
}

export async function createSessionFromIdToken(idToken: string): Promise<SessionUser> {
  const auth = getFirebaseAdminAuth();
  const decodedToken = await auth.verifyIdToken(idToken);
  const sessionUser = await syncUserProfile(decodedToken);
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, getSessionCookieOptions());

  return sessionUser;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const decoded = await getFirebaseAdminAuth().verifySessionCookie(
        sessionCookie,
      );
      await getFirebaseAdminAuth().revokeRefreshTokens(decoded.uid);
    } catch {
      // La sesión ya es inválida o expiró: igual se limpia la cookie.
    }
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decodedToken = await getFirebaseAdminAuth().verifySessionCookie(
      sessionCookie,
      true,
    );

    return syncUserProfile(decodedToken);
  } catch {
    return null;
  }
}

export async function hasRole(requiredRole: UserRole): Promise<boolean> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return false;
  }

  if (requiredRole === "staff") {
    return sessionUser.role === "staff" || sessionUser.role === "admin";
  }

  return sessionUser.role === "admin";
}
