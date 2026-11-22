import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { requireSessionUser } from "@/lib/auth-helpers";
import { lookupPassport, redeemPassport } from "@/lib/passports";
import { normalizeName, validatePassportCode } from "@/lib/phone";
import { RATE_LIMITS, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type {
  LookupPassportResponse,
  RedeemPassportResponse,
  SessionUser,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const NOT_FOUND_ERRORS = new Set([
  "Pasaporte no encontrado.",
  "No existe ningún pasaporte con ese código.",
]);

const CONFLICT_ERRORS = new Set([
  "Ingresa un código.",
  "El pasaporte está corrupto y no se puede canjear.",
  "Este pasaporte ya fue canjeado.",
  "Este pasaporte fue anulado.",
  "El pasaporte es válido, pero el canje aún no inicia. Revisa la fecha impresa en el cupón.",
  "La ventana de canje de este pasaporte ya finalizó.",
  "El pasaporte no se puede canjear.",
  "El nombre de la clienta no coincide con el registrado en el pasaporte.",
]);

function toDomainError(error: unknown): { message: string; status: number } {
  const message = error instanceof Error ? error.message : "";

  if (NOT_FOUND_ERRORS.has(message)) {
    return { message, status: 404 };
  }

  if (CONFLICT_ERRORS.has(message)) {
    return { message, status: 409 };
  }

  console.error("[redeem] Error interno:", error);

  return { message: "No se pudo procesar la solicitud. Intenta de nuevo.", status: 500 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(request: Request) {
  const sessionUser = await requireSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  const ip = getClientIp(request);
  const rate = checkRateLimit(
    `lookup:${ip}`,
    RATE_LIMITS.lookup.limit,
    RATE_LIMITS.lookup.windowMs,
  );

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const code = new URL(request.url).searchParams.get("code") ?? "";

  try {
    const result = await lookupPassport(code);

    const response: LookupPassportResponse = {
      passport: result.passport,
      canRedeem: result.canRedeem,
      reason: result.reason,
      now: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar el código. Intenta de nuevo." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sessionUser = await requireSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  const ip = getClientIp(request);
  const rate = checkRateLimit(
    `redeem:${ip}`,
    RATE_LIMITS.redeem.limit,
    RATE_LIMITS.redeem.windowMs,
  );

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos de canje. Espera un momento e intenta de nuevo." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;

  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const codeError = validatePassportCode(body.code);

  if (codeError) {
    return NextResponse.json({ error: codeError }, { status: 400 });
  }

  const code = (body.code as string).trim();

  try {
    const lookup = await lookupPassport(code);

    if (!lookup.passport) {
      await logAudit("passport_redeem_denied", sessionUser as SessionUser, code, {
        reason: lookup.reason,
      });

      return NextResponse.json(
        { error: lookup.reason ?? "Pasaporte no encontrado." },
        { status: 404 },
      );
    }

    // Verificación extra: el nombre que dicta la clienta debe coincidir con
    // el registrado al momento de la venta.
    if (typeof body.clientName === "string" && body.clientName.trim()) {
      if (normalizeName(body.clientName) !== normalizeName(lookup.passport.clientName)) {
        await logAudit("passport_redeem_denied", sessionUser as SessionUser, lookup.passport.id, {
          code: lookup.passport.code,
          reason: "name_mismatch",
        });

        return NextResponse.json(
          { error: "El nombre de la clienta no coincide con el registrado en el pasaporte." },
          { status: 409 },
        );
      }
    }

    const passport = await redeemPassport(code, sessionUser as SessionUser);

    await logAudit("passport_redeemed", sessionUser as SessionUser, passport.id, {
      code: passport.code,
      clientName: passport.clientName,
      discountPercent: passport.discountPercent,
    });

    const response: RedeemPassportResponse = {
      passport,
      now: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    const mapped = toDomainError(error);

    if (mapped.status === 409 || mapped.status === 404) {
      await logAudit("passport_redeem_denied", sessionUser as SessionUser, code, {
        reason: mapped.message,
      });
    }

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
