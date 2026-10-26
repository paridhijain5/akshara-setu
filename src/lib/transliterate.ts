const VOWELS: Record<string, string> = {
  "ಅ": "a",
  "ಆ": "aa",
  "ಇ": "i",
  "ಈ": "ii",
  "ಉ": "u",
  "ಊ": "uu",
  "ಋ": "ru",
  "ೠ": "ru",
  "ಎ": "e",
  "ಏ": "ee",
  "ಐ": "ai",
  "ಒ": "o",
  "ಓ": "oo",
  "ಔ": "au",
};

const SIGNS: Record<string, string> = {
  "ಾ": "aa",
  "ಿ": "i",
  "ೀ": "ii",
  "ು": "u",
  "ೂ": "uu",
  "ೃ": "ru",
  "ೄ": "ru",
  "ೆ": "e",
  "ೇ": "ee",
  "ೈ": "ai",
  "ೊ": "o",
  "ೋ": "oo",
  "ೌ": "au",
};

const CONSONANTS: Record<string, string> = {
  "ಕ": "k",
  "ಖ": "kh",
  "ಗ": "g",
  "ಘ": "gh",
  "ಙ": "ng",
  "ಚ": "ch",
  "ಛ": "chh",
  "ಜ": "j",
  "ಝ": "jh",
  "ಞ": "ny",
  "ಟ": "t",
  "ಠ": "th",
  "ಡ": "d",
  "ಢ": "dh",
  "ಣ": "n",
  "ತ": "t",
  "ಥ": "th",
  "ದ": "d",
  "ಧ": "dh",
  "ನ": "n",
  "ಪ": "p",
  "ಫ": "ph",
  "ಬ": "b",
  "ಭ": "bh",
  "ಮ": "m",
  "ಯ": "y",
  "ರ": "r",
  "ಱ": "r",
  "ಲ": "l",
  "ಳ": "l",
  "ೞ": "l",
  "ವ": "v",
  "ಶ": "sh",
  "ಷ": "sh",
  "ಸ": "s",
  "ಹ": "h",
};

const DIGITS: Record<string, string> = {
  "೦": "0",
  "೧": "1",
  "೨": "2",
  "೩": "3",
  "೪": "4",
  "೫": "5",
  "೬": "6",
  "೭": "7",
  "೮": "8",
  "೯": "9",
};

const VIRAMA = "್";
const ANUSVARA = "ಂ";
const VISARGA = "ಃ";

/** Convert Kannada text to Latin letters (simple phonetic transliteration). */
export function transliterate(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";

    if (CONSONANTS[ch]) {
      out += CONSONANTS[ch];
      if (next === VIRAMA) {
        i++; // virama removes the inherent "a"
      } else if (SIGNS[next]) {
        out += SIGNS[next];
        i++;
      } else {
        out += "a";
      }
      continue;
    }
    if (VOWELS[ch]) {
      out += VOWELS[ch];
      continue;
    }
    if (ch === ANUSVARA) {
      out += "m";
      continue;
    }
    if (ch === VISARGA) {
      out += "h";
      continue;
    }
    if (ch === VIRAMA) {
      continue;
    }
    if (SIGNS[ch]) {
      out += SIGNS[ch];
      continue;
    }
    if (DIGITS[ch]) {
      out += DIGITS[ch];
      continue;
    }
    out += ch;
  }
  return out;
}

/** Convert Kannada numerals ೦-೯ to ASCII 0-9. */
export function convertKannadaDigits(text: string): string {
  return text.replace(/[೦-೯]/g, (d) => (d ? (DIGITS[d] ?? d) : ""));
}
