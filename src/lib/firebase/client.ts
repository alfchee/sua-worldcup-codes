"use client";

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  FacebookAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  getAuth,
} from "firebase/auth";

import type { AuthProviderId } from "@/lib/types";

let cachedFirebaseApp: FirebaseApp | null = null;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function getFirebaseClientApp(): FirebaseApp {
  if (cachedFirebaseApp) {
    return cachedFirebaseApp;
  }

  cachedFirebaseApp = getApps().length > 0
    ? getApp()
    : initializeApp(getFirebaseConfig());

  return cachedFirebaseApp;
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp());
}

export function createFirebaseAuthProvider(providerId: AuthProviderId) {
  switch (providerId) {
    case "google":
      return new GoogleAuthProvider();
    case "github":
      return new GithubAuthProvider();
    case "facebook":
      return new FacebookAuthProvider();
    case "microsoft":
      return new OAuthProvider("microsoft.com");
    case "apple":
      return new OAuthProvider("apple.com");
  }
}
