import {
  addDays,
  getDaysInMonth,
  getMonthNameHindi,
  parseISODate,
  startOfWeek,
  toISODate,
} from "./dateUtils";

/**
 * Date understanding for Hindi / Hinglish / English voice commands.
 *
 * Design notes
 * ------------
 * 1. Matching is TOKEN based, never substring based. The old parser used
 *    `includes("kal")`, which turned "Kalpana ko 100 diye" into "yesterday".
 * 2. Only the token(s) sitting right next to a month name / "तारीख" can become
 *    a day number. The old parser read "मैंने 200 रुपये पांच अक्टूबर" as day 200.
 * 3. Dates that have not happened yet are rolled back (expenses are about the
 *    past), e.g. "25 December" said in October means last December.
 * 4. Every result lists the token positions it consumed, so callers can strip
 *    the date words out of a description or a person name.
 */

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

const normalizeToken = (token = "") =>
  token
    .normalize("NFC")
    .toLowerCase()
    .replace(/[०-९]/g, (digit) => String(DEVANAGARI_DIGITS.indexOf(digit)))
    .replace(/\u093c/g, "") // nukta: फ़रवरी == फरवरी
    .replace(/[.,;:!?()[\]{}"'“”‘’।|]+/g, "")
    .trim();

const tokenize = (text = "") =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw, index) => ({ raw, norm: normalizeToken(raw), index }))
    .filter((token) => token.norm);

// ---------------------------------------------------------------------------
// Vocabulary (all entries are written WITHOUT nukta; input is normalised too)
// ---------------------------------------------------------------------------

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  जनवरी: 0, फरवरी: 1, मार्च: 2, अप्रैल: 3, मई: 4, जून: 5, जुलाई: 6,
  अगस्त: 7, सितंबर: 8, सितम्बर: 8, अक्टूबर: 9, अक्तूबर: 9, नवंबर: 10,
  नवम्बर: 10, दिसंबर: 11, दिसम्बर: 11,
  janvari: 0, farvari: 1, faravari: 1, agast: 7, agust: 7, sitambar: 8,
  sitamber: 8, aktubar: 9, aktoobar: 9, navambar: 10, navember: 10,
  disambar: 11, disember: 11,
};

// Abbreviations are only trusted when they sit next to a day number.
const MONTH_ABBREVIATIONS = {
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
  sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

// 0 = Sunday. Three-letter English forms are skipped: "sat", "mon", "wed" are
// ordinary words ("I sat", "wed") and would create phantom dates.
const WEEKDAYS = {
  sunday: 0, रविवार: 0, इतवार: 0, ravivar: 0, itvar: 0, itwar: 0,
  monday: 1, सोमवार: 1, somvar: 1, somwar: 1,
  tuesday: 2, tues: 2, मंगलवार: 2, mangalvar: 2, mangalwar: 2,
  wednesday: 3, बुधवार: 3, budhvar: 3, budhwar: 3,
  thursday: 4, thurs: 4, गुरुवार: 4, बृहस्पतिवार: 4, वीरवार: 4,
  guruvar: 4, guruwar: 4, brihaspativar: 4, veervar: 4,
  friday: 5, शुक्रवार: 5, shukravar: 5, shukrawar: 5,
  saturday: 6, शनिवार: 6, shanivar: 6, shaniwar: 6,
};

const SMALL_NUMBER_WORDS = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30,
  // Hinglish
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6,
  che: 6, chah: 6, saat: 7, aath: 8, nau: 9, das: 10, gyarah: 11, barah: 12,
  terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17, atharah: 18,
  unnis: 19, bees: 20, ikkis: 21, baais: 22, teis: 23, chaubis: 24,
  pachchis: 25, pachis: 25, chhabbis: 26, sattais: 27, atthais: 28,
  untis: 29, tees: 30, tis: 30, ikattis: 31, ikatis: 31,
  // Hindi ordinals commonly used with dates
  पहली: 1, पहला: 1, दूसरी: 2, तीसरी: 3, चौथी: 4, पांचवी: 5, छठी: 6,
  सातवी: 7, आठवी: 8, नौवी: 9, दसवी: 10,
  // Hindi cardinals 1-31
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7,
  आठ: 8, नौ: 9, दस: 10, ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14,
  पंद्रह: 15, पन्द्रह: 15, सोलह: 16, सत्रह: 17, अठारह: 18, उन्नीस: 19,
  बीस: 20, इक्कीस: 21, बाईस: 22, तेईस: 23, चौबीस: 24, पच्चीस: 25,
  छब्बीस: 26, सत्ताईस: 27, अट्ठाईस: 28, उनतीस: 29, तीस: 30, इकतीस: 31,
};

const ENGLISH_TENS = { twenty: 20, thirty: 30 };

const TODAY_WORDS = ["आज", "aaj", "today"];
const YESTERDAY_WORDS = ["कल", "kal", "yesterday", "बीते कल"];
const DAY_BEFORE_WORDS = [
  "परसों", "परसो", "parso", "parson", "day before yesterday",
];
const THREE_DAYS_AGO_WORDS = ["नरसों", "नरसो", "narso", "narson"];

const DAY_UNIT_WORDS = ["दिन", "din", "days", "day"];
const AGO_WORDS = ["पहले", "pehle", "pahle", "ago"];
const TARIKH_WORDS = ["तारीख", "तारिख", "tarikh", "tareekh"];
const CURRENCY_WORDS = [
  "रुपये", "रुपए", "रुपया", "रुपयों", "rupees", "rupee", "rupaye", "rupay",
  "rs", "inr", "₹",
];
const PAST_MARKERS = [
  "पिछले", "पिछली", "पिछला", "बीते", "बीती", "last", "pichle", "pichhle",
  "pichli", "previous",
];
const THIS_MARKERS = ["इस", "this", "is", "iss", "ye", "yeh"];

const WEEK_WORDS = ["हफ्ते", "हफ्ता", "सप्ताह", "week", "hafte", "hafta"];
const MONTH_WORDS = ["महीने", "महीना", "माह", "month", "mahine", "mahina"];
const YEAR_WORDS = ["साल", "वर्ष", "year", "saal", "varsh"];

const LINKING_WORDS = ["of", "का", "की", "ka", "ki"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizedCache = new Map();
const normalizeList = (words) => {
  if (!normalizedCache.has(words)) {
    normalizedCache.set(words, words.map(normalizeToken));
  }
  return normalizedCache.get(words);
};

const matchesWord = (token, words) =>
  Boolean(token) && normalizeList(words).includes(token.norm);

/** Finds a (multi-word) phrase. Returns [startPos, endPos] or null. */
const findPhrase = (tokens, phrases) => {
  for (const phrase of phrases) {
    const parts = phrase.split(" ").map(normalizeToken);
    for (let i = 0; i + parts.length <= tokens.length; i += 1) {
      if (parts.every((part, offset) => tokens[i + offset].norm === part)) {
        return [i, i + parts.length - 1];
      }
    }
  }
  return null;
};

const positions = ([from, to]) => {
  const list = [];
  for (let i = from; i <= to; i += 1) list.push(i);
  return list;
};

/** Number from one token: "5", "5th", "पांच", "twenty", "ikkis" ... */
const smallNumberFromToken = (token) => {
  if (!token) return null;

  const numeric = /^(\d{1,2})(?:st|nd|rd|th|वीं|वां|वी)?$/.exec(token.norm);
  if (numeric) return Number(numeric[1]);

  const word = SMALL_NUMBER_WORDS[token.norm];
  return word === undefined ? null : word;
};

/** Reads a day number ending at position `end`, e.g. "twenty five". */
const dayEndingAt = (tokens, end) => {
  const value = smallNumberFromToken(tokens[end]);
  if (value === null) return null;

  const previous = tokens[end - 1];
  if (previous && ENGLISH_TENS[previous.norm] && value >= 1 && value <= 9) {
    return { day: ENGLISH_TENS[previous.norm] + value, start: end - 1 };
  }

  return { day: value, start: end };
};

const monthFromToken = (token, { allowAbbreviation = false } = {}) => {
  if (!token) return undefined;
  if (MONTHS[token.norm] !== undefined) return MONTHS[token.norm];
  if (allowAbbreviation && MONTH_ABBREVIATIONS[token.norm] !== undefined) {
    return MONTH_ABBREVIATIONS[token.norm];
  }
  return undefined;
};

const yearFromToken = (token) =>
  token && /^(19|20)\d{2}$/.test(token.norm) ? Number(token.norm) : null;

const buildResult = ({ kind, date, start, end, label, consumed }) => ({
  kind,
  date: kind === "day" ? date : null,
  start: start ?? date,
  end: end ?? date,
  label: label ?? null,
  consumed: [...new Set(consumed)].sort((a, b) => a - b),
});

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Turns day/month(/year) into a Date. Without an explicit year the most recent
 * past occurrence is used, so "25 December" said in October is last year.
 */
const resolveDate = (day, month, year, now) => {
  const today = startOfDay(now);

  const attempt = (candidateYear) => {
    if (day < 1 || month < 0 || month > 11) return null;
    if (day > getDaysInMonth(candidateYear, month)) return null;
    return new Date(candidateYear, month, day);
  };

  if (year) return attempt(year);

  let candidate = attempt(today.getFullYear());
  if (candidate && candidate > today) {
    // 29 Feb may only exist in an earlier leap year.
    candidate =
      attempt(today.getFullYear() - 1) || attempt(today.getFullYear() - 4);
  }
  return candidate;
};

const dayResult = (date, label, consumed) =>
  buildResult({ kind: "day", date: toISODate(date), label, consumed });

const monthRange = (year, month, consumed, now) => {
  const label =
    year === now.getFullYear()
      ? getMonthNameHindi(month)
      : `${getMonthNameHindi(month)} ${year}`;

  return buildResult({
    kind: "range",
    start: toISODate(new Date(year, month, 1)),
    end: toISODate(new Date(year, month, getDaysInMonth(year, month))),
    label,
    consumed,
  });
};

// ---------------------------------------------------------------------------
// Detectors (tried in priority order)
// ---------------------------------------------------------------------------

const detectNumericDate = (tokens, now) => {
  for (let i = 0; i < tokens.length; i += 1) {
    const norm = tokens[i].norm;

    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(norm);
    if (iso) {
      const date = parseISODate(
        `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
      );
      if (date) return dayResult(date, null, [i]);
    }

    // Indian order: dd/mm/yyyy, dd-mm-yy, dd/mm
    const slash = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(norm);
    if (slash) {
      let year = slash[3] ? Number(slash[3]) : null;
      if (year !== null && year < 100) year += 2000;

      const date = resolveDate(Number(slash[1]), Number(slash[2]) - 1, year, now);
      if (date) return dayResult(date, null, [i]);
    }
  }
  return null;
};

const INVALID_DATE = Object.freeze({ invalid: true });

const detectNamedMonthDate = (tokens, now) => {
  for (let i = 0; i < tokens.length; i += 1) {
    const month = monthFromToken(tokens[i], { allowAbbreviation: true });
    if (month === undefined) continue;

    // "5 october [2025]", "5th of october", "पांच अक्टूबर को"
    let dayPos = i - 1;
    if (tokens[dayPos] && matchesWord(tokens[dayPos], LINKING_WORDS)) dayPos -= 1;
    const before = dayPos >= 0 ? dayEndingAt(tokens, dayPos) : null;

    if (before && before.day >= 1 && before.day <= 31) {
      const consumed = [i];
      for (let k = before.start; k <= dayPos; k += 1) consumed.push(k);

      let year = null;
      if (yearFromToken(tokens[i + 1])) {
        year = yearFromToken(tokens[i + 1]);
        consumed.push(i + 1);
      }

      const date = resolveDate(before.day, month, year, now);
      if (date) return dayResult(date, null, consumed);

      // e.g. "31 February": say "no valid date" instead of falling back to
      // the whole month, which would silently answer the wrong question.
      return INVALID_DATE;
    }

    // "october 5 [2025]" / "अक्टूबर की 5 तारीख"; a currency word after the
    // number means it is an amount, not a day.
    let afterPos = i + 1;
    if (tokens[afterPos] && matchesWord(tokens[afterPos], LINKING_WORDS)) {
      afterPos += 1;
    }
    const afterDay = smallNumberFromToken(tokens[afterPos]);
    if (
      afterDay !== null &&
      afterDay >= 1 &&
      afterDay <= 31 &&
      !matchesWord(tokens[afterPos + 1], CURRENCY_WORDS)
    ) {
      const consumed = [i];
      for (let k = i + 1; k <= afterPos; k += 1) consumed.push(k);
      if (matchesWord(tokens[afterPos + 1], TARIKH_WORDS)) {
        consumed.push(afterPos + 1);
      }

      let year = null;
      if (yearFromToken(tokens[afterPos + 1])) {
        year = yearFromToken(tokens[afterPos + 1]);
        consumed.push(afterPos + 1);
      }

      const date = resolveDate(afterDay, month, year, now);
      if (date) return dayResult(date, null, consumed);
    }
  }
  return null;
};

const detectDayOfMonth = (tokens, now) => {
  // "5 तारीख को" -> the 5th of this month (or last month if still in future)
  for (let i = 1; i < tokens.length; i += 1) {
    if (!matchesWord(tokens[i], TARIKH_WORDS)) continue;

    const parsed = dayEndingAt(tokens, i - 1);
    if (!parsed || parsed.day < 1 || parsed.day > 31) continue;

    const today = startOfDay(now);
    let year = today.getFullYear();
    let month = today.getMonth();

    for (let tries = 0; tries < 12; tries += 1) {
      if (parsed.day <= getDaysInMonth(year, month)) {
        const candidate = new Date(year, month, parsed.day);
        if (candidate <= today) {
          const consumed = [i];
          for (let k = parsed.start; k < i; k += 1) consumed.push(k);
          return dayResult(candidate, null, consumed);
        }
      }
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }
  }
  return null;
};

const detectRelativeDays = (tokens, now) => {
  // "3 din pehle", "पांच दिन पहले", "10 days ago"
  for (let i = 0; i < tokens.length - 2; i += 1) {
    if (!matchesWord(tokens[i + 1], DAY_UNIT_WORDS)) continue;
    if (!matchesWord(tokens[i + 2], AGO_WORDS)) continue;

    const parsed = dayEndingAt(tokens, i);
    if (!parsed) continue;

    const consumed = [];
    for (let k = parsed.start; k <= i + 2; k += 1) consumed.push(k);
    return dayResult(addDays(now, -parsed.day), null, consumed);
  }

  // "last 7 days" / "पिछले 7 दिन" / "pichle 7 din"
  for (let i = 0; i < tokens.length - 2; i += 1) {
    if (!matchesWord(tokens[i], PAST_MARKERS)) continue;
    if (!matchesWord(tokens[i + 2], DAY_UNIT_WORDS)) continue;

    const parsed = dayEndingAt(tokens, i + 1);
    if (!parsed || parsed.day < 1) continue;

    return buildResult({
      kind: "range",
      start: toISODate(addDays(now, -(parsed.day - 1))),
      end: toISODate(now),
      label: `पिछले ${parsed.day} दिन`,
      consumed: [i, i + 1, i + 2],
    });
  }

  return null;
};

const detectPeriods = (tokens, now) => {
  const today = startOfDay(now);

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const isPast = matchesWord(tokens[i], PAST_MARKERS);
    const isThis = matchesWord(tokens[i], THIS_MARKERS);
    if (!isPast && !isThis) continue;

    const unit = tokens[i + 1];
    const consumed = [i, i + 1];

    if (matchesWord(unit, WEEK_WORDS)) {
      const thisWeekStart = startOfWeek(today);
      if (isThis) {
        return buildResult({
          kind: "range",
          start: toISODate(thisWeekStart),
          end: toISODate(today),
          label: "इस हफ्ते",
          consumed,
        });
      }
      return buildResult({
        kind: "range",
        start: toISODate(addDays(thisWeekStart, -7)),
        end: toISODate(addDays(thisWeekStart, -1)),
        label: "पिछले हफ्ते",
        consumed,
      });
    }

    if (matchesWord(unit, MONTH_WORDS)) {
      const target = isThis
        ? new Date(today.getFullYear(), today.getMonth(), 1)
        : new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const result = monthRange(target.getFullYear(), target.getMonth(), consumed, now);
      result.label = isThis ? "इस महीने" : "पिछले महीने";
      return result;
    }

    if (matchesWord(unit, YEAR_WORDS)) {
      const year = isThis ? today.getFullYear() : today.getFullYear() - 1;
      return buildResult({
        kind: "range",
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        label: isThis ? "इस साल" : "पिछले साल",
        consumed,
      });
    }
  }
  return null;
};

const detectWeekday = (tokens, now) => {
  const today = startOfDay(now);

  for (let i = 0; i < tokens.length; i += 1) {
    const weekday = WEEKDAYS[tokens[i].norm];
    if (weekday === undefined) continue;

    const consumed = [i];
    const hasPastMarker = i > 0 && matchesWord(tokens[i - 1], PAST_MARKERS);
    if (hasPastMarker) consumed.push(i - 1);

    let diff = (today.getDay() - weekday + 7) % 7;
    if (hasPastMarker && diff === 0) diff = 7;

    return dayResult(addDays(today, -diff), null, consumed);
  }
  return null;
};

const detectRelativeWords = (tokens, now) => {
  const dayBefore = findPhrase(tokens, DAY_BEFORE_WORDS);
  if (dayBefore) return dayResult(addDays(now, -2), "परसों", positions(dayBefore));

  const threeAgo = findPhrase(tokens, THREE_DAYS_AGO_WORDS);
  if (threeAgo) return dayResult(addDays(now, -3), "नरसों", positions(threeAgo));

  const yesterday = findPhrase(tokens, YESTERDAY_WORDS);
  if (yesterday) return dayResult(addDays(now, -1), "कल", positions(yesterday));

  const today = findPhrase(tokens, TODAY_WORDS);
  if (today) return dayResult(now, "आज", positions(today));

  return null;
};

const detectMonthOnly = (tokens, now) => {
  const today = startOfDay(now);

  for (let i = 0; i < tokens.length; i += 1) {
    const month = monthFromToken(tokens[i]);
    if (month === undefined) continue;

    // English "may" is also a verb: require a month-like context.
    if (tokens[i].norm === "may") {
      const prev = tokens[i - 1]?.norm;
      const next = tokens[i + 1]?.norm;
      const contextual =
        ["in", "of", "for", "during", "last", "this"].includes(prev) ||
        ["ka", "ke", "ki", "mein", "me", "expense", "expenses", "spending"].includes(next);
      if (!contextual) continue;
    }

    const consumed = [i];
    const explicitYear = yearFromToken(tokens[i + 1]);
    if (explicitYear) consumed.push(i + 1);

    const year =
      explicitYear ??
      (month > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear());

    return monthRange(year, month, consumed, now);
  }
  return null;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Understands the date part of a spoken/typed command.
 *
 * Returns null when no date is present, otherwise
 *   { kind: "day" | "range", date, start, end, label, consumed }
 *
 * `date` is set only for kind "day". `start`/`end` are always set (equal for a
 * single day) so every caller can filter with the same inclusive range.
 */
export const parseDateExpression = (text, now = new Date()) => {
  if (!text || !String(text).trim()) return null;

  const tokens = tokenize(String(text));
  if (!tokens.length) return null;

  // Explicit dates win over relative words ("आज 5 अक्टूबर" -> 5 October).
  const detectors = [
    detectNumericDate,
    detectNamedMonthDate,
    detectDayOfMonth,
    detectRelativeDays,
    detectPeriods,
    detectWeekday,
    detectRelativeWords,
    detectMonthOnly,
  ];

  for (const detect of detectors) {
    const result = detect(tokens, now);
    if (result === INVALID_DATE) return null;
    if (result) return result;
  }

  return null;
};

/**
 * Backwards compatible helper: YYYY-MM-DD for a single-day expression, null
 * for everything else (including ranges).
 */
export const parseDateQuery = (text, now = new Date()) => {
  const result = parseDateExpression(text, now);
  return result?.kind === "day" ? result.date : null;
};

/** The text with the recognised date words removed. */
export const stripDateFromText = (text, now = new Date()) => {
  const result = parseDateExpression(text, now);
  if (!result) return text;

  const rawTokens = String(text).split(/\s+/).filter(Boolean);
  const tokens = tokenize(String(text));
  const dropped = new Set(result.consumed.map((pos) => tokens[pos]?.index));

  // Also drop the postposition that belonged to the date ("5 अक्टूबर को").
  const lastPos = result.consumed[result.consumed.length - 1];
  const following = tokens[lastPos + 1];
  if (following && ["को", "ko", "on", "में", "mein", "me"].includes(following.norm)) {
    dropped.add(following.index);
  }

  return rawTokens.filter((_, index) => !dropped.has(index)).join(" ");
};
