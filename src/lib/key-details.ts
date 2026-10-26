import { convertKannadaDigits } from "./transliterate";

export type KeyDetailKind = "Date" | "Phone" | "Amount" | "Number";
export type KeyDetail = { kind: KeyDetailKind; value: string };

export function extractKeyDetails(rawText: string): KeyDetail[] {
  const text = convertKannadaDigits(rawText);
  const found: KeyDetail[] = [];
  const seen = new Set<string>();

  const add = (kind: KeyDetailKind, value: string) => {
    const v = value.trim();
    if (!v) return;
    const key = `${kind}:${v}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ kind, value: v });
  };

  // Dates: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  for (const m of text.matchAll(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g)) {
    add("Date", m[0]);
  }
  // Standalone years (1800-2099)
  for (const m of text.matchAll(/\b(18|19|20)\d{2}\b/g)) {
    add("Date", m[0]);
  }
  // Phone numbers: 10-digit mobiles, optionally with +91 or 0 prefix
  for (const m of text.matchAll(/(?:\+91[\s-]?|0)?\b[6-9]\d{9}\b/g)) {
    add("Phone", m[0].replace(/[\s-]/g, ""));
  }
  // Rupee amounts: ₹1,234.56 or 250 ರೂ
  for (const m of text.matchAll(/₹\s?\d[\d,]*(?:\.\d+)?/g)) {
    add("Amount", m[0].replace(/\s+/g, " "));
  }
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?\s?ರೂ(ಪಾಯಿ)?/g)) {
    add("Amount", m[0].trim());
  }
  // Kannada numerals (already converted for detection, keep raw Kannada form as value)
  for (const m of rawText.matchAll(/[೦-೯][೦-೯.,]*[೦-೯]|[೦-೯]/g)) {
    add("Number", m[0]);
  }

  return found;
}
