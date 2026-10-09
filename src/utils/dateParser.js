import { parseHindiNumber } from "./hindiNumberParser";
import { getLocalDate, getDateOffset } from "./dateUtils";

const months = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,

  जनवरी: 0,
  फरवरी: 1,
  मार्च: 2,
  अप्रैल: 3,
  मई: 4,
  जून: 5,
  जुलाई: 6,
  अगस्त: 7,
  सितंबर: 8,
  सितम्बर: 8,
  अक्टूबर: 9,
  नवंबर: 10,
  नवम्बर: 10,
  दिसंबर: 11,
  दिसम्बर: 11,
};

const createDate = (day, month) => {
  const year = new Date().getFullYear();

  const date = new Date(year, month, day);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
};

export const parseDateQuery = (text) => {
  const normalized = text.toLowerCase().trim();

  // Today
  if (
    normalized.includes("आज") ||
    normalized.includes("aaj")
  ) {
    return getLocalDate();
  }

  // Day before yesterday
  if (
    normalized.includes("परसों") ||
    normalized.includes("परसो") ||
    normalized.includes("parso")
  ) {
    return getDateOffset(-2);
  }

  // Yesterday
  if (
    normalized.includes("कल") ||
    normalized.includes("kal")
  ) {
    return getDateOffset(-1);
  }

  // -----------------------------
  // English date
  // -----------------------------

  const englishMatch = normalized.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)/
  );

  if (englishMatch) {
    const day = Number(englishMatch[1]);
    const month = months[englishMatch[2]];

    return createDate(day, month);
  }

  // -----------------------------
  // Hindi date
  // -----------------------------

  const hindiMatch = normalized.match(
    /(.+?)\s+(जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|नवंबर|नवम्बर|दिसंबर|दिसम्बर)/
  );

  if (hindiMatch) {
    const dayText = hindiMatch[1].trim();
    const monthText = hindiMatch[2];

    const day = parseHindiNumber(dayText);
    const month = months[monthText];

    if (day && month !== undefined) {
      return createDate(day, month);
    }
  }

  return null;
};