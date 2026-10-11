import { parseHindiNumber, isHindiNumberWord } from "../utils/hindiNumberParser";
import {
  parseDateExpression,
  stripDateFromText,
} from "../utils/dateParser";
import { getLocalDate, isValidISODate } from "../utils/dateUtils";
import { findKnownPersonInText } from "../utils/personUtils";

const detectCategory = (text) => {
  const lower = text.toLowerCase();

  if (
    lower.includes("चाय") ||
    lower.includes("खाना") ||
    lower.includes("खाने") ||
    lower.includes("नाश्ता") ||
    lower.includes("दूध") ||
    lower.includes("समोसा") ||
    lower.includes("food") ||
    lower.includes("tea") ||
    lower.includes("coffee")
  ) {
    return "food";
  }

  if (
    lower.includes("पेट्रोल") ||
    lower.includes("डीजल") ||
    lower.includes("fuel")
  ) {
    return "fuel";
  }

  
if (
  lower.includes("किराना") ||
  lower.includes("किराने") ||
  lower.includes("किराने का") ||
  lower.includes("सब्जी") ||
  lower.includes("सब्ज़ी") ||
  lower.includes("सब्जियों") ||
  lower.includes("राशन") ||
  lower.includes("grocery") ||
  lower.includes("groceries")
) {
  return "grocery";
}

  if (
    lower.includes("कपड़े") ||
    lower.includes("शॉपिंग") ||
    lower.includes("shopping")
  ) {
    return "shopping";
  }

  if (
    lower.includes("बिल") ||
    lower.includes("बिजली") ||
    lower.includes("रिचार्ज") ||
    lower.includes("bill") ||
    lower.includes("recharge")
  ) {
    return "bills";
  }

  if (
    lower.includes("ऑटो") ||
    lower.includes("बस") ||
    lower.includes("ट्रेन") ||
    lower.includes("टैक्सी") ||
    lower.includes("travel") ||
    lower.includes("auto") ||
    lower.includes("taxi")
  ) {
    return "travel";
  }

  if (
    lower.includes("दवा") ||
    lower.includes("अस्पताल") ||
    lower.includes("मेडिसिन") ||
    lower.includes("medicine")
  ) {
    return "health";
  }

  return "other";
};

// ---------------------------------------------------------------------------
// Person commands
// ---------------------------------------------------------------------------

// Words that can never be (part of) a person's name. Without this guard the
// old parser treated "इस महीने का खर्च" as a query about a person called
// "इस महीने" and "चाय पर 50 रुपये खर्च किए" as spending on a person "चाय".
const NON_NAME_WORDS = new Set(
  `kitna kitne kitni how much many what total kul tot expense expenses kharch
  kharcha income balance paise paisa rupaye rupay rupees rupee rs mera meri
  mere my me mujhe maine main mene hum humne tumne aap is iss ye yeh the a an
  of for on to by from and or all sab saare sara pura mahine mahina saal
  hafte hafta aaj kal parso today yesterday week month year hua hue hai tha
  batao bata do diya diye gaya gayi udhaar loan
  कितना कितने कितनी कुल टोटल खर्च खर्चा खर्चे पैसे पैसा रुपये रुपए रुपया
  मेरा मेरी मेरे मुझे मैंने मैं हम हमने तुमने आप इस ये यह महीने महीना साल
  हफ्ते हफ्ता आज कल परसों सब सारे पूरा हुआ हुए है था बताओ बता दो दिया
  दिए उधार इनकम बैलेंस क्या`
    .split(/\s+/)
    .filter(Boolean)
);

const CATEGORY_WORDS = new Set(
  `chai tea coffee food lunch dinner breakfast milk fuel petrol diesel cng
  grocery groceries vegetables shopping clothes bill bills electricity
  recharge auto taxi bus train travel medicine medicines doctor
  चाय खाना खाने नाश्ता दूध समोसा पेट्रोल डीजल किराना किराने सब्जी सब्ज़ी
  सब्जियों राशन कपड़े शॉपिंग बिल बिजली रिचार्ज ऑटो बस ट्रेन टैक्सी दवा
  दवाई अस्पताल मेडिसिन`
    .split(/\s+/)
    .filter(Boolean)
);

const FILLER_PREFIX = /^(?:मैंने|मैं|हमने|हम|maine|main|mene|humne|hum|मुझे|mujhe)$/iu;
const CURRENCY_TOKEN = /^(?:रुपये?|रुपए|रुपया|रुपयों|rupees?|rupaye?|rupay|rs\.?|₹|inr)$/iu;

const isAmountToken = (token) =>
  /^\d[\d,]*(?:\.\d+)?$/.test(token) ||
  CURRENCY_TOKEN.test(token) ||
  isHindiNumberWord(token);

const isLikelyPersonName = (name) => {
  if (!name) return false;

  const tokens = name.split(/\s+/);
  if (tokens.length > 3) return false;
  if (/\d/.test(name)) return false;

  const lowered = tokens.map((token) => token.toLowerCase());
  if (lowered.some((token) => NON_NAME_WORDS.has(token))) return false;

  // "चाय", "petrol", "recharge" ... are things, not people. (Whole-word match:
  // a substring test would reject names like "बसंत" because it contains "बस".)
  if (lowered.some((token) => CATEGORY_WORDS.has(token))) return false;

  return true;
};

const POSTPOSITION_PATTERNS = [
  ["ko", /^(.+?)\s+(?:को|ko)(?=\s|$|[?!,.।])/iu],
  ["ne", /^(.+?)\s+(?:ने|ne)(?=\s|$|[?!,.।])/iu],
  ["par", /^(.+?)\s+(?:पर|पे|par|pe)(?=\s|$|[?!,.।])/iu],
  ["se", /^(.+?)\s+(?:से|se)(?=\s|$|[?!,.।])/iu],
  ["ka", /^(.+?)\s+(?:का|की|के|ka|ki|ke)(?=\s|$|[?!,.।])/iu],
];

const cleanCandidate = (value = "") => {
  const tokens = value
    .trim()
    .replace(/^[,.\s]+|[,:\s?!।]+$/gu, "")
    .split(/\s+/)
    .filter(Boolean);

  // Drop leading "मैंने", amounts and currency words: "10 rupaye Shivam" -> "Shivam"
  while (
    tokens.length &&
    (FILLER_PREFIX.test(tokens[0]) || isAmountToken(tokens[0]))
  ) {
    tokens.shift();
  }

  // Keep at most a two-word name ("Shivam Kumar") if extra words crept in.
  return tokens.slice(-2).join(" ");
};

/**
 * Hindi/Hinglish: the words before को/ने/पर/से/का are the person.
 * Returns { name, kind } where kind is the postposition that matched.
 */
const extractPersonName = (text) => {
  for (const [kind, pattern] of POSTPOSITION_PATTERNS) {
    const match = text.trim().match(pattern);
    if (!match?.[1]) continue;

    const name = cleanCandidate(match[1]);
    if (isLikelyPersonName(name)) return { name, kind };
  }
  return null;
};

/** English queries: "total expense of Shivam", "Shivam's expenses", "spent on Rahul". */
const extractEnglishPersonName = (text) => {
  const possessive = text.match(/([\p{L}]+(?:\s+[\p{L}]+)?)['’]s\b/u);
  if (possessive) {
    const name = cleanCandidate(possessive[1]);
    if (isLikelyPersonName(name)) return name;
  }

  const prepositional = text.match(
    /\b(?:of|for|on|to|with)\s+([\p{L}]+(?:\s+[\p{L}]+)?)\s*(?:[?!.,]|$)/iu
  );
  if (prepositional) {
    const name = cleanCandidate(prepositional[1]);
    if (isLikelyPersonName(name)) return name;
  }

  return null;
};

const HARD_QUESTION =
  /कितना|कितनी|कितने|बताओ|बताना|बता दो|बताइए|kitna|kitni|kitne|batao|bataiye|bata do|how much|how many|what is|what's|\?/i;

const SOFT_QUERY =
  /कुल|टोटल|हिसाब|total|hisab|hisaab|summary|खर्च|खर्चा|खर्चे|एक्सपेंस|एक्सपेन्स|kharch|kharcha|expense|spent|spending/i;

const detectPersonMetric = (lower) => {
  if (/उधार|बकाया|बाकी|loan|outstanding|\bdue\b|udhaar|baki|bakaya/i.test(lower)) {
    return "loan_outstanding";
  }

  if (/मुझसे|मुझे मिले|मिले थे|मिला था|प्राप्त|received|mujhse|mile the|mila tha/i.test(lower)) {
    return "received";
  }

  if (/खर्च|खर्चे|खर्चा|एक्सपेंस|एक्सपेन्स|kharch|kharcha|spent|spend|spending|expense|हिसाब|hisab|total|कुल|टोटल/i.test(lower)) {
    return "expense";
  }

  return "given";
};

const parsePersonCommand = (text, { knownPeople = [], now = new Date() } = {}) => {
  // Date words must not leak into the amount ("5 अक्टूबर" is not ₹5) or the
  // person name ("कल" is not a person).
  const dateExpr = parseDateExpression(text, now);
  const bare = dateExpr ? stripDateFromText(text, now) : text;
  const lower = bare.toLowerCase().trim();
  const amount = parseHindiNumber(bare);

  const asksQuestion =
    HARD_QUESTION.test(lower) || (SOFT_QUERY.test(lower) && amount === null);

  // 1. Best evidence: a saved person's name appears in the sentence.
  const known = findKnownPersonInText(bare, knownPeople);

  let personName = known ? known.name : null;
  let kind = null;

  // 2. Otherwise infer the name from Hindi postpositions.
  if (!personName) {
    const extracted = extractPersonName(bare);
    if (extracted) {
      personName = extracted.name;
      kind = extracted.kind;
    }
  }

  // 3. English phrasing for questions.
  if (!personName && asksQuestion) {
    personName = extractEnglishPersonName(bare);
  }

  if (!personName) return null;

  const dateFields = {
    date: dateExpr?.kind === "day" ? dateExpr.date : null,
    dateRange:
      dateExpr?.kind === "range"
        ? { start: dateExpr.start, end: dateExpr.end, label: dateExpr.label }
        : null,
  };

  // Person-specific questions must be detected before generic questions.
  if (asksQuestion) {
    return {
      type: "person_query",
      personName,
      metric: detectPersonMetric(lower),
      intent: "person_ledger",
      ...dateFields,
    };
  }

  if (amount === null || amount <= 0) return null;

  // "par / pe / se / ka" are ambiguous ("pen par 10 rupaye" is an item, not a
  // person). Unknown names are only accepted for the clear "ko" and "ne".
  if (!known && kind && !["ko", "ne"].includes(kind)) return null;

  const record = (transactionType, extra = {}) => ({
    type: "person_transaction",
    personName,
    amount,
    transactionType,
    intent: "record_person_transaction",
    // A range ("is mahine") makes no sense for one record; only a day does.
    date: dateFields.date,
    dateRange: null,
    ...extra,
  });

  // Loan repayment: "Amit ne 200 rupaye udhaar wapas kiye"
  if (
    /उधार.*(वापस|लौटा|चुका|चुकाया)|loan.*(repaid|returned|paid back)|udhaar.*(wapas|lautaya)|wapas.*udhaar/i.test(lower)
  ) {
    return record("loan_repayment");
  }

  // Loan given: "Rahul ko 500 rupaye udhaar diye"
  if (
    /उधार|loan|udhaar/i.test(lower) &&
    /(दिया|दिए|दी|दे दिए|दिया था|दिए थे|diye|diya|de diye|lent|gave)/i.test(lower)
  ) {
    return record("loan_given");
  }

  // Person-associated expense: "50 rupay Pragati ne kharch kiye"
  if (
    /खर्च|खर्चे|खर्चा|kharch|kharcha|spent|expense|खरीदा|खरीदी|kharida|kharidi/i.test(lower)
  ) {
    return record("expense", { category: detectCategory(bare) });
  }

  // "10 rupaye Shivam ko diye" counts as spending linked to Shivam.
  if (
    /(?:^|\s)(?:को|ko)(?=\s|$|[?!,.])/iu.test(bare) &&
    /(दिया|दिए|दी|दे दिए|diya|diye|de diye|gave|paid|transfer)/i.test(lower)
  ) {
    return record("expense", { category: detectCategory(bare) });
  }

  // Money received: "Shubh ne 100 rupaye diye" / "Shubh se 100 rupaye mile"
  if (
    (/(?:^|\s)ने(?=\s|$|[?!,.])/u.test(bare) || /(?:^|\s)ne(?=\s|$|[?!,.])/i.test(bare)) &&
    /(दिया|दिए|दी|मिले|मिला|मिली|received|mila|mili|diye|diya)/i.test(lower)
  ) {
    return record("received");
  }

  if (
    known &&
    /(?:^|\s)(?:से|se)(?=\s|$|[?!,.])/iu.test(bare) &&
    /(मिले|मिला|मिली|mile|mila|mili|received)/i.test(lower)
  ) {
    return record("received");
  }

  return null;
};

const detectIncomeSource = (text) => {
  const lower = text.toLowerCase();

  if (
    lower.includes("salary") ||
    lower.includes("सैलरी") ||
    lower.includes("वेतन")
  ) {
    return "salary";
  }

  if (
    lower.includes("freelance") ||
    lower.includes("फ्रीलांस")
  ) {
    return "freelance";
  }

  if (
    lower.includes("business") ||
    lower.includes("बिजनेस") ||
    lower.includes("व्यापार")
  ) {
    return "business";
  }

  if (
    lower.includes("investment") ||
    lower.includes("निवेश")
  ) {
    return "investment";
  }

  if (
    lower.includes("पापा") ||
    lower.includes("पिता") ||
    lower.includes("मम्मी") ||
    lower.includes("मां") ||
    lower.includes("माँ") ||
    lower.includes("मिले") ||
    lower.includes("मिला") ||
    lower.includes("मिली") ||
    lower.includes("received")
  ) {
    return "family";
  }

  return "other";
};

const isIncomeStatement = (text) => {
  const lower = text.toLowerCase();

  // Expense-related statements must not become income.
  const expenseWords = [
    "खर्च",
    "खरीदा",
    "खरीदी",
    "दिया",
    "दिए",
    "paid",
    "spent",
    "expense",
  ];

  if (expenseWords.some((word) => lower.includes(word))) {
    return false;
  }

  const incomePatterns = [
    "मिले",
    "मिला",
    "मिली",
    "प्राप्त हुए",
    "प्राप्त हुआ",
    "सैलरी",
    "वेतन",
    "salary",
    "freelance",
    "फ्रीलांस",
    "business income",
    "investment income",
    "received",
    "income",
    "कमाई हुई",
  ];

  return incomePatterns.some((pattern) =>
    lower.includes(pattern)
  );
};

const isQuery = (text) => {
  const lower = text.toLowerCase().trim();

  // Explicit question patterns
  const questionPatterns = [
    "कितना खर्च",
    "कितने खर्च",
    "कितना खर्ज",
    "कितना पैसा",
    "कितनी रकम",
    "kitna kharch",
    "kitne kharch",
    "how much",
    "total expense",
    "expense kitna",
    
"कुल income",
"कुल इनकम",
"कितनी income",
"कितनी इनकम",
"इस महीने income",
"इस महीने इनकम",
"कितने पैसे बचे",
"कितना balance",
"कितना बैलेंस",
"कुल balance",
"कुल बैलेंस",
"इस महीने कितने पैसे बचे",
"monthly balance",
"total income",
"total balance",
"how much income",

"saved overall",
"how much have i saved",
"how much money have i saved",
"my savings",
"total savings",
"overall savings",
"money left",
"how much money is left",
"kitne paise bache",
"kitna paisa bacha",
"meri bachat",
"kul bachat",
  ];

  if (questionPatterns.some((pattern) => lower.includes(pattern))) {
    return true;
  }

  // Other clear question patterns
  const questionWords = [
    "कितना",
    "कितनी",
    "कितने",
    "बताओ",
    "batao",
    "how much",
    "how many",
  ];

  return questionWords.some((word) => lower.includes(word));
};


const detectQueryIntent = (text, now = new Date()) => {
  const lower = text.toLowerCase().trim();

  // 1. Monthly balance — check first
  if (
    lower.includes("monthly balance") ||
    lower.includes("month balance") ||
    lower.includes("इस महीने कितने पैसे बचे") ||
    lower.includes("इस महीने कितना बैलेंस") ||
    lower.includes("इस महीने का बैलेंस") ||
    lower.includes("इस महीने का balance")
  ) {
    return "month_balance";
  }


  // Savings and balance queries
  if (
    lower.includes("saved overall") ||
    lower.includes("how much have i saved") ||
    lower.includes("how much money have i saved") ||
    lower.includes("my savings") ||
    lower.includes("total savings") ||
    lower.includes("overall savings") ||
    lower.includes("money left") ||
    lower.includes("how much money is left") ||
    lower.includes("kitne paise bache") ||
    lower.includes("kitna paisa bacha") ||
    lower.includes("meri bachat") ||
    lower.includes("kul bachat")
  ) {
    return "total_balance";
  }
// Total balance — check before income and expense rules
if (
  lower.includes("total balance") ||
  lower.includes("overall balance") ||
  lower.includes("balance") ||
  lower.includes("बैलेंस") ||
  lower.includes("बचे") ||
  lower.includes("शेष राशि") ||
  lower.includes("कुल बचत") ||
  lower.includes("टोटल बैलेंस") ||
lower.includes("कुल बैलेंस") ||
lower.includes("कितना बैलेंस")
) {
  return "total_balance";
}



  // 3. Monthly income
  if (
    lower.includes("monthly income") ||
    lower.includes("month income") ||
    lower.includes("this month income") ||
    lower.includes("इस महीने income") ||
    lower.includes("इस महीने इनकम") ||
    lower.includes("इस महीने की इनकम") ||
    lower.includes("इस महीने कितनी कमाई") ||
    lower.includes("इस महीने की कमाई")
  ) {
    return "month_income";
  }

  // 4. Total income — Hindi and English
  if (
    lower.includes("income") ||
    lower.includes("इनकम") ||
    lower.includes("कमाई") ||
    lower.includes("आमदनी") ||
    lower.includes("वेतन") ||
    lower.includes("salary") ||
    lower.includes("सैलरी")
  ) {
    return "total_income";
  }

  // 5. Any explicit date or period: "आज", "कल", "5 अक्टूबर", "पिछले हफ्ते",
  //    "सितंबर में"... Checked BEFORE "कुल/total" so that
  //    "5 अक्टूबर को कुल कितना खर्च हुआ" is answered for that date.
  if (parseDateExpression(text, now)) {
    return "date_expense";
  }

  // 8. Monthly expense
  if (
    lower.includes("इस महीने") ||
    lower.includes("इस माह") ||
    lower.includes("iss mahine") ||
    lower.includes("is mahine") ||
    lower.includes("this month")
  ) {
    return "month_expense";
  }

  // 9. Total expense
  if (
    lower.includes("कुल") ||
    lower.includes("अब तक") ||
    lower.includes("टोटल") ||
    lower.includes("total") ||
    lower.includes("overall")
  ) {
    return "total_expense";
  }

  // 11. Category expense
  const category = detectCategory(text);
  if (category !== "other") {
    return "category_expense";
  }

  return "unknown";
};


const todayISO = (now) => getLocalDate(now);

/** Accepts a model-supplied date only if it is a real, non-future ISO date. */
const sanitizeModelDate = (value, now) => {
  if (typeof value !== "string" || !isValidISODate(value)) return null;
  if (value > todayISO(now)) return null;
  if (value < "2000-01-01") return null;
  return value;
};

/**
 * Attaches the date the user actually spoke. The local parser is
 * deterministic, so it wins over whatever the language model guessed.
 */
const withDate = (result, dateExpr, now) => {
  if (!result?.success || !result.data) return result;

  const data = { ...result.data };

  if (dateExpr?.kind === "day") {
    data.date = dateExpr.date;
    data.dateRange = null;
  } else if (dateExpr?.kind === "range") {
    data.date = null;
    data.dateRange = {
      start: dateExpr.start,
      end: dateExpr.end,
      label: dateExpr.label,
    };
  } else {
    data.date = sanitizeModelDate(data.date, now);
    data.dateRange = data.dateRange ?? null;
  }

  // A date or period only makes sense for a query, or a record on one day.
  const isRecord = ["expense", "income", "person_transaction"].includes(data.type);
  if (isRecord) data.dateRange = null;

  // "5 अक्टूबर को कितना खर्च हुआ" is a date question even if the model said
  // "total_expense". Keep income/balance intents; they use the same period.
  if (
    data.type === "query" &&
    (data.date || data.dateRange) &&
    ["total_expense", "category_expense", "unknown", "today_expense",
     "yesterday_expense", "day_before_yesterday_expense", "month_expense",
     "date_expense"].includes(data.intent)
  ) {
    data.intent = data.category && data.category !== "other" && data.intent === "category_expense"
      ? "category_expense"
      : "date_expense";
  }

  return { ...result, data };
};

const unknownResult = (text) => ({
  success: true,
  data: {
    type: "unknown",
    amount: null,
    category: null,
    description: text,
    intent: "unknown",
    date: null,
    dateRange: null,
  },
});

const parseWithGemini = async (text, now) => {
  try {
    const API_BASE_URL =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

    const response = await fetch(`${API_BASE_URL}/api/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // The model cannot know the user's "today" (or timezone) by itself.
      body: JSON.stringify({ text, today: todayISO(now) }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.message || "Invalid Gemini response");
    }

    const data = result.data;

    // Accept the full set of commands understood by the voice assistant.
    if (![
      "expense", "income", "query", "person_transaction", "person_query", "unknown",
    ].includes(data.type)) {
      throw new Error("Invalid response type");
    }

    const validIntents = [
      "record_expense",
      "today_expense",
      "yesterday_expense",
      "day_before_yesterday_expense",
      "month_expense",
      "total_expense",
      "category_expense",
      "date_expense",
      "total_income",
      "month_income",
      "total_balance",
      "month_balance",
      "record_income",
      "record_person_transaction",
      "person_ledger",
      "unknown",
    ];

    if (!validIntents.includes(data.intent)) {
      data.intent = "unknown";
    }

    // Never save a transaction without a valid positive amount.
    if (
      ["expense", "income", "person_transaction"].includes(data.type) &&
      (!Number.isFinite(data.amount) || data.amount <= 0)
    ) {
      return unknownResult(text);
    }

    // Only allow categories supported by the application.
    const validCategories = [
      "food", "travel", "fuel", "grocery", "shopping", "bills", "health", "other",
    ];

    if (
      ["expense", "person_transaction"].includes(data.type) &&
      !validCategories.includes(data.category)
    ) {
      data.category = "other";
    }

    return {
      success: true,
      data: {
        ...data,
        amount: ["query", "person_query"].includes(data.type) ? null : data.amount,
        description: data.description ?? text,
        date: data.date ?? null,
      },
    };
  } catch (error) {
    console.error("Gemini fallback failed:", error.message);

    // Keep the app usable if the backend is offline.
    return unknownResult(text);
  }
};

/**
 * Parses one spoken command.
 *
 * options.knownPeople  saved people (lets "Shivam ka total kharch" and
 *                      "शिवम" / "Shiwam" resolve to the right person)
 * options.now          injectable clock (tests)
 */
export const parseWithBackend = async (text, options = {}) => {
  const now = options.now ?? new Date();
  const knownPeople = options.knownPeople ?? [];
  const dateExpr = parseDateExpression(text, now);

  // Person-ledger commands are parsed locally first. This keeps named-person
  // transactions and queries deterministic instead of letting the model file
  // them under an ordinary "other" expense.
  const personCommand = parsePersonCommand(text, { knownPeople, now });
  if (personCommand) {
    return withDate(
      {
        success: true,
        data: { ...personCommand, description: text },
      },
      dateExpr,
      now
    );
  }

  // Date questions are deterministic too: "1 October ko kitna kharch hua?"
  if (isQuery(text) && dateExpr) {
    const dateQuery = await parseLocally(text, { knownPeople, now });
    if (dateQuery.success && dateQuery.data?.type === "query") {
      return withDate(dateQuery, dateExpr, now);
    }
  }

  // Everything else goes through Gemini first, with local parsing as fallback.
  const aiResult = await parseWithGemini(text, now);
  if (aiResult.success && aiResult.data?.type !== "unknown") {
    return withDate(aiResult, dateExpr, now);
  }

  const localResult = await parseLocally(text, { knownPeople, now });
  if (localResult.success && localResult.data?.type !== "unknown") {
    return withDate(localResult, dateExpr, now);
  }
  return aiResult;
};

export const parseLocally = async (text, options = {}) => {
  const now = options.now ?? new Date();
  const knownPeople = options.knownPeople ?? [];

  if (!text || !text.trim()) {
    return unknownResult(null);
  }

  const dateExpr = parseDateExpression(text, now);
  // Remove date words before reading amounts: "5 अक्टूबर को चाय पर 20 रुपये"
  // must be ₹20, not ₹5.
  const bare = dateExpr ? stripDateFromText(text, now) : text;

  // 1. Person commands first, before generic question detection.
  const personCommand = parsePersonCommand(text, { knownPeople, now });

  if (personCommand) {
    return withDate(
      { success: true, data: { ...personCommand, description: text } },
      dateExpr,
      now
    );
  }

  // 2. General queries.
  if (isQuery(text)) {
    const intent = detectQueryIntent(text, now);
    const category = detectCategory(bare);

    return withDate(
      {
        success: true,
        data: {
          type: "query",
          amount: null,
          category: category !== "other" ? category : null,
          description: null,
          intent,
          date: null,
        },
      },
      dateExpr,
      now
    );
  }

  // 3. Income detection.
  if (isIncomeStatement(bare)) {
    const amount = parseHindiNumber(bare);

    if (amount !== null && amount > 0) {
      return withDate(
        {
          success: true,
          data: {
            type: "income",
            amount,
            source: detectIncomeSource(text),
            description: text,
            intent: "record_income",
            date: null,
          },
        },
        dateExpr,
        now
      );
    }
  }

  // 4. Ordinary expense detection.
  const amount = parseHindiNumber(bare);

  if (amount === null || amount <= 0) {
    return unknownResult(text);
  }

  return withDate(
    {
      success: true,
      data: {
        type: "expense",
        amount,
        category: detectCategory(bare),
        description: text,
        intent: "record_expense",
        date: null,
      },
    },
    dateExpr,
    now
  );
};
