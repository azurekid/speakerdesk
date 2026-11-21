// Client- and server-safe date formatting. Event dates are stored as UTC midnight (date-only).

const DATE_FMT = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** Dates are stored as UTC midnight (date-only), so always format in UTC. */
export function formatDate(d: Date | null | undefined) {
  return d ? DATE_FMT.format(d) : "-";
}
export function formatDateRange(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start) return "Dates to be announced";
  if (!end || end.getTime() === start.getTime()) return formatDate(start);
  return `${new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(start)} – ${formatDate(end)}`;
}
