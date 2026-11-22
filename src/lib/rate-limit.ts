interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Limiter en memoria por clave (IP + ruta). Suficiente como defensa básica
 * contra fuerza bruta en una app interna de bajo tráfico; en despliegues
 * multi-instancia cada instancia lleva su propio conteo.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });

    if (buckets.size > 5000) {
      for (const [storedKey, stored] of buckets) {
        if (stored.resetAt <= now) {
          buckets.delete(storedKey);
        }

        if (buckets.size <= 4000) {
          break;
        }
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;

  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Límites por ruta sensible (ventana de 1 minuto). */
export const RATE_LIMITS = {
  lookup: { limit: 30, windowMs: 60_000 },
  image: { limit: 30, windowMs: 60_000 },
  redeem: { limit: 10, windowMs: 60_000 },
} as const;
