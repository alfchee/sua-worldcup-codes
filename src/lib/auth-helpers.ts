import "server-only";

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

/** Resuelve el usuario de sesión o devuelve la respuesta 401 lista para retornar. */
export async function requireSessionUser(): Promise<SessionUser | NextResponse> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return sessionUser;
}
