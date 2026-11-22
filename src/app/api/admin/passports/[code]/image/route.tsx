import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth-helpers";
import { formatLongDate } from "@/lib/dates";
import { lookupPassport } from "@/lib/passports";
import {
  PASSPORT_ACCENTS,
  TICKET_IMAGE_HEIGHT,
  TICKET_IMAGE_WIDTH,
} from "@/lib/passport-view";
import { RATE_LIMITS, checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { PassportRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return formatLongDate(iso);
}

function Ticket({ passport }: { passport: PassportRecord }) {
  const accent = PASSPORT_ACCENTS[passport.type] ?? PASSPORT_ACCENTS.vip;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "64px 72px 56px",
        backgroundColor: "#0b0a08",
        backgroundImage: "linear-gradient(160deg, #171310 0%, #0b0a08 55%, #131007 100%)",
        color: "#f7f3ea",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 26,
            letterSpacing: 12,
            color: "#c9b98a",
            textTransform: "uppercase",
          }}
        >
          {"SÚA HAIR SALON"}
        </div>
        <div
          style={{
            marginTop: 18,
            padding: "14px 38px",
            borderRadius: 999,
            border: `2px solid ${accent.strong}`,
            color: accent.badge,
            backgroundColor: accent.strong,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          {passport.typeLabel}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: 200,
            lineHeight: 1,
            fontWeight: 900,
            color: accent.strong,
            textTransform: "uppercase",
          }}
        >
          {`${passport.discountPercent}%`}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 42,
            letterSpacing: 14,
            color: "#efe7d6",
            textTransform: "uppercase",
          }}
        >
          {"DE DESCUENTO"}
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 28,
            color: "#b7ab8f",
            letterSpacing: 4,
          }}
        >
          {"Blackend Week VIP"}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            padding: "30px 0",
            borderTop: "2px dashed rgba(201,185,138,0.45)",
            borderBottom: "2px dashed rgba(201,185,138,0.45)",
          }}
        >
          <div style={{ fontSize: 22, letterSpacing: 10, color: "#c9b98a", textTransform: "uppercase" }}>
            {"CÓDIGO DE CANJE"}
          </div>
          <div
            style={{ marginTop: 14, fontSize: 86, fontWeight: 800, letterSpacing: 22, color: "#fdfaf2" }}
          >
            {passport.code}
          </div>
        </div>

        <div
          style={{
            marginTop: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 30, color: "#f1e9d8" }}>
            {passport.clientName}
          </div>
          <div style={{ marginTop: 12, fontSize: 22, color: "#a99f8a" }}>
            {`Canjeable del ${formatDate(passport.validFrom)} al ${formatDate(passport.validUntil)}`}
          </div>
          <div style={{ marginTop: 12, fontSize: 20, color: "#8f8672", letterSpacing: 2 }}>
            {"Presenta este código en Súa Hair Salon · Canje único"}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const sessionUser = await requireSessionUser();

  if (sessionUser instanceof NextResponse) {
    return sessionUser;
  }

  const ip = getClientIp(request);
  const rate = checkRateLimit(
    `image:${ip}`,
    RATE_LIMITS.image.limit,
    RATE_LIMITS.image.windowMs,
  );

  if (!rate.allowed) {
    return new Response("Demasiadas solicitudes. Espera un momento.", {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }

  let lookup: Awaited<ReturnType<typeof lookupPassport>>;

  try {
    lookup = await lookupPassport(code);
  } catch {
    return new Response("No se pudo generar la imagen del pasaporte.", { status: 500 });
  }

  if (!lookup.passport) {
    return new Response("Pasaporte no encontrado.", { status: 404 });
  }

  try {
    return new ImageResponse(<Ticket passport={lookup.passport} />, {
      width: TICKET_IMAGE_WIDTH,
      height: TICKET_IMAGE_HEIGHT,
      headers: {
        // El contenido por código es inmutable (los datos impresos no cambian
        // con el estado), pero contiene PII: solo caché privada del navegador.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("No se pudo generar la imagen del pasaporte.", { status: 500 });
  }
}
