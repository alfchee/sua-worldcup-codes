const MANAGUA_TZ = "America/Managua";

const dateTimeFormatter = new Intl.DateTimeFormat("es-NI", {
  timeZone: MANAGUA_TZ,
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const longDateFormatter = new Intl.DateTimeFormat("es-NI", {
  timeZone: MANAGUA_TZ,
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatLongDate(value: string): string {
  return longDateFormatter.format(new Date(value));
}
