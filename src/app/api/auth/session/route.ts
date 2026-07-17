import { NextResponse } from "next/server";

import { clearSessionCookie, createSessionFromIdToken, getSessionUser } from "@/lib/auth";
import { isFirebaseAdminConfigured } from "@/lib/config";
import type { SessionResponse } from "@/lib/types";

interface SessionRequestPayload {
  idToken?: string;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const response: SessionResponse = {
    authenticated: false,
    user: null,
  };

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(response);
  }

  const user = await getSessionUser();

  return NextResponse.json({
    authenticated: Boolean(user),
    user,
  } satisfies SessionResponse);
}

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Firebase Admin no está configurado." },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as SessionRequestPayload;
  const idToken = payload.idToken?.trim() ?? "";

  if (!idToken) {
    return NextResponse.json(
      { error: "Falta el ID token de Firebase." },
      { status: 400 },
    );
  }

  try {
    const user = await createSessionFromIdToken(idToken);

    return NextResponse.json({
      authenticated: true,
      user,
    } satisfies SessionResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la sesión de Firebase.",
      },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  await clearSessionCookie();

  return NextResponse.json({
    authenticated: false,
    user: null,
  } satisfies SessionResponse);
}
