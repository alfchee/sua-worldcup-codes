import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  getAdminEmailAllowlist,
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

async function syncUserProfile(token: DecodedIdToken): Promise<SessionUser> {
  const firestore = getFirebaseAdminFirestore();
  const userRef = firestore.collection("users").doc(token.uid);
  const snapshot = await userRef.get();
  const adminEmails = getAdminEmailAllowlist();
  const normalizedEmail = token.email?.toLowerCase() ?? null;
  const derivedRole: UserRole =
    normalizedEmail && adminEmails.has(normalizedEmail) ? "admin" : "staff";
  const providers = getProviderList(token);

  const baseDocument = {
    uid: token.uid,
    email: token.email ?? null,
    displayName: token.name ?? null,
    providers,
    updatedAt: new Date(),
    disabled: false,
  };

  if (!snapshot.exists) {
    await userRef.set({
      ...baseDocument,
      role: derivedRole,
      createdAt: new Date(),
    });

    return {
      uid: token.uid,
      email: token.email ?? null,
      displayName: token.name ?? null,
      role: derivedRole,
      providers,
    };
  }

  const currentData = snapshot.data() as { role?: UserRole } | undefined;
  const currentRole = currentData?.role ?? derivedRole;
  const nextRole = currentRole === "admin" || derivedRole === "admin"
    ? "admin"
    : "staff";

  await userRef.set(
    {
      ...baseDocument,
      role: nextRole,
    },
    { merge: true },
  );

  return {
    uid: token.uid,
    email: token.email ?? null,
    displayName: token.name ?? null,
    role: nextRole,
    providers,
  };
}

export async function createSessionFromIdToken(idToken: string): Promise<SessionUser> {
  const auth = getFirebaseAdminAuth();
  const decodedToken = await auth.verifyIdToken(idToken);
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, getSessionCookieOptions());

  return syncUserProfile(decodedToken);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();

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
