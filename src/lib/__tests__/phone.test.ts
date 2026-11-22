import { describe, expect, it } from "vitest";

import {
  MAX_PHONE_DIGITS,
  NI_COUNTRY_PREFIX,
  getPhoneDigits,
  normalizeName,
  normalizePhoneForWhatsApp,
  validateClientName,
  validateClientPhone,
  validatePassportCode,
} from "@/lib/phone";

describe("normalizePhoneForWhatsApp", () => {
  it("antepone 505 a números locales de 8 dígitos", () => {
    expect(normalizePhoneForWhatsApp("8888 1234")).toBe("50588881234");
    expect(normalizePhoneForWhatsApp("88881234")).toBe("50588881234");
  });

  it("respeta números ya internacionales", () => {
    expect(normalizePhoneForWhatsApp("+505 8888 1234")).toBe("50588881234");
    expect(normalizePhoneForWhatsApp("1 202 555 0134")).toBe("12025550134");
  });

  it("maneja prefijo 00 re-evaluando el resto", () => {
    expect(normalizePhoneForWhatsApp("0088881234")).toBe(`${NI_COUNTRY_PREFIX}88881234`);
    expect(normalizePhoneForWhatsApp("00505 8888 1234")).toBe("50588881234");
  });

  it("quita el cero troncal inicial", () => {
    expect(normalizePhoneForWhatsApp("088881234")).toBe("50588881234");
  });
});

describe("validateClientPhone", () => {
  it("acepta locales e internacionales válidos", () => {
    expect(validateClientPhone("88881234")).toBeNull();
    expect(validateClientPhone("+505 8888 1234")).toBeNull();
  });

  it("rechaza no-strings, muy cortos y muy largos", () => {
    expect(validateClientPhone(88881234)).not.toBeNull();
    expect(validateClientPhone("123")).not.toBeNull();
    expect(validateClientPhone(`+${"1".repeat(MAX_PHONE_DIGITS + 1)}`)).not.toBeNull();
  });
});

describe("validateClientName", () => {
  it("acepta nombres con tildes y espacios", () => {
    expect(validateClientName("María José López")).toBeNull();
  });

  it("rechaza no-strings, cortos, largos y con símbolos", () => {
    expect(validateClientName(123)).not.toBeNull();
    expect(validateClientName("Al")).not.toBeNull();
    expect(validateClientName("A".repeat(81))).not.toBeNull();
    expect(validateClientName("María <hack>")).not.toBeNull();
  });
});

describe("validatePassportCode", () => {
  it("exige un código no vacío", () => {
    expect(validatePassportCode("K7M2XQ")).toBeNull();
    expect(validatePassportCode("  ")).not.toBeNull();
    expect(validatePassportCode(123)).not.toBeNull();
  });
});

describe("normalizeName", () => {
  it("colapsa espacios e ignora mayúsculas para la verificación", () => {
    expect(normalizeName("  María   JOSÉ  López ")).toBe("maría josé lópez");
  });
});

describe("getPhoneDigits", () => {
  it("extrae solo dígitos", () => {
    expect(getPhoneDigits("+505 8888-1234")).toBe("50588881234");
  });
});
