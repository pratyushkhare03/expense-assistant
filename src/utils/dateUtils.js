const pad = (value) => String(value).padStart(2, "0");

/** Format a Date as YYYY-MM-DD using the *local* calendar (not UTC). */
export const toISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Parse YYYY-MM-DD into a local Date at midnight. Returns null if invalid. */
export const parseISODate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);

  // Rejects rollovers such as 2026-02-31.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const isValidISODate = (value) => parseISODate(value) !== null;

export const getLocalDate = (now = new Date()) => toISODate(now);

export const addDays = (date, days) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
};

export const getDateOffset = (days, now = new Date()) =>
  toISODate(addDays(now, days));

/** Last calendar day of a month (month is 0-based). */
export const getDaysInMonth = (year, month) =>
  new Date(year, month + 1, 0).getDate();

/** Monday-based start of week. */
export const startOfWeek = (date) => {
  const offset = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
};

export const isDateInRange = (dateString, start, end) =>
  Boolean(dateString) &&
  (!start || dateString >= start) &&
  (!end || dateString <= end);

const MONTH_NAMES_HI = [
  "जनवरी",
  "फ़रवरी",
  "मार्च",
  "अप्रैल",
  "मई",
  "जून",
  "जुलाई",
  "अगस्त",
  "सितंबर",
  "अक्टूबर",
  "नवंबर",
  "दिसंबर",
];

export const getMonthNameHindi = (monthIndex) => MONTH_NAMES_HI[monthIndex];

/** "5 अक्टूबर" (adds the year when it is not the current year). */
export const formatDateHindi = (dateString, now = new Date()) => {
  const date = parseISODate(dateString);
  if (!date) return dateString || "";

  const base = `${date.getDate()} ${MONTH_NAMES_HI[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear()
    ? base
    : `${base} ${date.getFullYear()}`;
};
