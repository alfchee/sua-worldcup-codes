import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { lookupPassport, redeemPassport } from "@/lib/passports";
import type {
  LookupPassportResponse,
  RedeemPassportResponse,
  SessionUser,
} from "@/lib/types";

export const dynamic = "force-dynamic";

async function ensureSessionUser(): Promise<SessionUser | NextResponse> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return sessionUser;
}

export async function GET(request: Request) {
  const sessionUser = await ensureSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  const code = new URL(request.url).searchParams.get("code") ?? "";
  const result = await lookupPassport(code);

  const response: LookupPassportResponse = {
    passport: result.passport,
    canRedeem: result.canRedeem,
    reason: result.reason,
    now: new Date().toISOString(),
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const sessionUser = await ensureSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  let body: { code?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const code = body.code?.trim() ?? "";

  if (!code) {
    return NextResponse.json({ error: "Ingresa un código." }, { status: 400 });
  }

  try {
    const passport = await redeemPassport(code, sessionUser);

    const response: RedeemPassportResponse = {
      passport,
      now: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo canjear el pasaporte.",
      },
      { status: 409 },
    );
  }
}
