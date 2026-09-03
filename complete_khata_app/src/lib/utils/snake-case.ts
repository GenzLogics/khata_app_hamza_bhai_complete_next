const SKIP_STRING_CONVERSION = new Set([
  "phone",
  "invoice_number",
  "item_name",
  "description",
  "notes",
  "heading",
  "sub_heading",
  "investor_name",
  "name",
  "email",
  "unit_type",
]);

export function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = convertValue(obj[key], snakeKey);
  }
  return result;
}

function convertValue(value: unknown, snakeKey?: string): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return safeDate(value);
  if (Array.isArray(value)) return value.map((item) => convertValue(item, snakeKey));
  if (typeof value === "object") return toSnakeCase(value as Record<string, unknown>);
  if (typeof value === "string" && snakeKey && !SKIP_STRING_CONVERSION.has(snakeKey)) {
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
  }
  return value;
}

export function safeDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatDateOnly(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
