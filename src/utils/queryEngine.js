import {
  addDays,
  formatDateHindi,
  getDaysInMonth,
  isDateInRange,
  toISODate,
} from "./dateUtils";

/**
 * Answers spoken financial questions from saved records.
 *
 * Every question is reduced to a *period* (inclusive start/end, or none for
 * "all time") plus an optional category, and all totals use the same filter.
 * Previously each intent had its own ad-hoc code, so combinations like
 * "पिछले महीने खाने पर कितना खर्च" or "5 अक्टूबर को कुल कितना" ignored the date.
 */

const CATEGORY_NAMES = {
  food: "खाने-पीने",
  travel: "यात्रा",
  fuel: "ईंधन",
  grocery: "किराने",
  shopping: "शॉपिंग",
  bills: "बिल",
  health: "स्वास्थ्य",
  other: "अन्य",
};

const round = (value) => Math.round(value * 100) / 100;

const sum = (rows, predicate = () => true) =>
  round(
    rows.reduce(
      (total, row) => (predicate(row) ? total + (Number(row.amount) || 0) : total),
      0
    )
  );

const currentMonthPeriod = (now) => ({
  start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
  end: toISODate(
    new Date(now.getFullYear(), now.getMonth(), getDaysInMonth(now.getFullYear(), now.getMonth()))
  ),
  label: "इस महीने",
});

/**
 * Period for a parsed command. An explicit date/range found in the sentence
 * always wins over the period implied by the intent name.
 */
export const resolvePeriod = (data = {}, now = new Date()) => {
  if (data.dateRange?.start && data.dateRange?.end) {
    return {
      start: data.dateRange.start,
      end: data.dateRange.end,
      label: data.dateRange.label || "इस अवधि में",
    };
  }

  if (data.date) {
    return {
      start: data.date,
      end: data.date,
      label: describeDay(data.date, now),
    };
  }

  switch (data.intent) {
    case "today_expense":
      return { start: toISODate(now), end: toISODate(now), label: "आज" };
    case "yesterday_expense": {
      const day = toISODate(addDays(now, -1));
      return { start: day, end: day, label: "कल" };
    }
    case "day_before_yesterday_expense": {
      const day = toISODate(addDays(now, -2));
      return { start: day, end: day, label: "परसों" };
    }
    case "month_expense":
    case "month_income":
    case "month_balance":
      return currentMonthPeriod(now);
    default:
      return null; // all time
  }
};

const describeDay = (isoDate, now) => {
  const today = toISODate(now);
  if (isoDate === today) return "आज";
  if (isoDate === toISODate(addDays(now, -1))) return "कल";
  if (isoDate === toISODate(addDays(now, -2))) return "परसों";
  return formatDateHindi(isoDate, now);
};

const inPeriod = (row, period) =>
  !period || isDateInRange(row.date, period.start, period.end);

const money = (value) => `₹${value}`;

/**
 * Computes the spoken answer for a `query` command. Returns a Hindi string.
 */
export const answerQuery = ({ data, expenses = [], incomes = [], now = new Date() }) => {
  const period = resolvePeriod(data, now);
  const when = period ? `${period.label} ` : "अब तक ";

  const periodExpenses = expenses.filter((row) => inPeriod(row, period));
  const periodIncomes = incomes.filter((row) => inPeriod(row, period));

  switch (data.intent) {
    case "today_expense":
    case "yesterday_expense":
    case "day_before_yesterday_expense":
    case "month_expense":
    case "total_expense":
    case "date_expense": {
      const category = data.category && data.category !== "other" ? data.category : null;
      const amount = sum(periodExpenses, (row) => !category || row.category === category);
      const subject = category ? `${CATEGORY_NAMES[category]} पर ` : "";
      const tense = period && period.end < toISODate(now) ? "था" : "है";

      if (data.intent === "date_expense" && period?.start === period?.end && amount === 0) {
        return `${when}${subject}आपका कोई खर्च दर्ज नहीं है।`;
      }
      return `${when}${subject}आपका कुल खर्च ${money(amount)} ${tense}।`;
    }

    case "category_expense": {
      const category = data.category || "other";
      const amount = sum(periodExpenses, (row) => (row.category || "other") === category);
      return `${when}${CATEGORY_NAMES[category] || "इस श्रेणी"} पर आपका कुल खर्च ${money(amount)} है।`;
    }

    case "total_income":
    case "month_income":
      return `${when}आपकी कुल आय ${money(sum(periodIncomes))} है।`;

    case "total_balance":
    case "month_balance": {
      const balance = round(sum(periodIncomes) - sum(periodExpenses));
      return period
        ? `${period.label} दर्ज आय और खर्च के अनुसार बैलेंस ${money(balance)} है।`
        : `आपकी दर्ज आय और खर्च के अनुसार कुल बैलेंस ${money(balance)} है।`;
    }

    default:
      return "माफ़ कीजिए, मैं आपका सवाल समझ नहीं पाया। कृपया दूसरे तरीके से पूछें।";
  }
};

/**
 * Spoken date for a confirmation, e.g. "कल (10 अक्टूबर)" or "5 अक्टूबर".
 * Empty when the record is for today (nothing to announce).
 */
export const describeRecordDate = (isoDate, now = new Date()) => {
  if (!isoDate || isoDate === toISODate(now)) return "";

  const label = describeDay(isoDate, now);
  const formatted = formatDateHindi(isoDate, now);
  return label === formatted ? label : `${label} (${formatted})`;
};

export { CATEGORY_NAMES };
