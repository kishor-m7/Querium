export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(",")),
  ].join("\n");
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: Array<Record<string, unknown>>, filename: string) {
  downloadBlob(toCsv(rows), filename, "text/csv;charset=utf-8");
}

export async function downloadElementPng(element: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  const background = getComputedStyle(document.body).backgroundColor;
  const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: background });
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "export"
  );
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof value === "object") return JSON.stringify(value);
  const asNumber = Number(value);
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(asNumber) &&
    /^-?\d+(\.\d+)?$/.test(value)
  ) {
    return Number.isInteger(asNumber)
      ? asNumber.toLocaleString()
      : asNumber.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}
