// Quote every field containing a comma, quote, or newline; double up any
// embedded quotes. Good enough for register exports — small, predictable
// tabular data, not user-authored free text with pathological content.
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCsvField(String(cell))).join(","),
  );
  // CRLF + BOM: Excel-friendly on Windows, which is who actually opens these.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(csv: string, fileName: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
