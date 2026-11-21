// Client-safe CSV writing (RFC 4180) for exports.

/** One cell. Values starting with = + - @ are prefixed so spreadsheets don't run them as formulas. */
export function csvCell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A whole table, with a byte-order mark so Excel opens UTF-8 (accents, emoji) correctly. */
export function toCsvTable(headers: string[], rows: (string | number | null | undefined)[][]) {
  return "﻿" + [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-z0-9._-]/gi, "-")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
