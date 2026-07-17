import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { isFirebaseAdminConfigured } from "@/lib/config";

function getPrivateKey(): string {
  return (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

function initializeFirebaseAdminApp() {
  if (!isFirebaseAdminConfigured()) {
    throw new Error(
      "Firebase Admin no está configurado. Define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.",
    );
  }

  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export function getFirebaseAdminAuth() {
  return getAuth(initializeFirebaseAdminApp());
}

export function getFirebaseAdminFirestore() {
  return getFirestore(initializeFirebaseAdminApp());
}
