/**
 * Person-name helpers.
 *
 * Speech recognition (hi-IN) returns names in Devanagari ("शिवम"), the AI
 * backend may return Latin ("Shivam"), and people type variants ("Shiwam").
 * Before this module each spelling became a separate person, so "total expense
 * of Shivam" only summed one of them. Everything here exists so that all
 * spellings of one name resolve to the same person(s).
 */

// ---------------------------------------------------------------------------
// Devanagari -> Latin (just enough for names)
// ---------------------------------------------------------------------------

const CONSONANTS = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j",
  झ: "jh", ञ: "n", ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t",
  थ: "th", द: "d", ध: "dh", न: "n", प: "p", फ: "f", ब: "b", भ: "bh",
  म: "m", य: "y", र: "r", ल: "l", ळ: "l", व: "v", श: "sh", ष: "sh",
  स: "s", ह: "h",
};

const INDEPENDENT_VOWELS = {
  अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ऋ: "ri", ए: "e",
  ऐ: "ai", ओ: "o", औ: "au", ऑ: "o",
};

const MATRAS = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e",
  "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o",
};

const HALANT = "्";
const NASALS = new Set(["ं", "ँ"]);
const NUKTA = "\u093c";

const transliterateWord = (word) => {
  const chars = [...word];
  let output = "";

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];

    if (CONSONANTS[char]) {
      output += CONSONANTS[char];
      const next = chars[i + 1];

      if (next === HALANT) {
        i += 1; // conjunct: no vowel
      } else if (MATRAS[next]) {
        output += MATRAS[next];
        i += 1;
      } else if (i + 1 < chars.length && !NASALS.has(next)) {
        output += "a"; // inherent vowel (dropped at the end of a word)
      }
    } else if (INDEPENDENT_VOWELS[char]) {
      output += INDEPENDENT_VOWELS[char];
    } else if (NASALS.has(char)) {
      output += "n";
    } else if (/[a-z0-9]/i.test(char)) {
      output += char.toLowerCase();
    }
  }

  return output;
};

const normalizeLatin = (word) =>
  word
    .toLowerCase()
    .replace(/ph/g, "f")
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/q|ck/g, "k")
    .replace(/x/g, "ks")
    .replace(/aa+/g, "a")
    .replace(/ee+|ii+/g, "i")
    .replace(/oo+|uu+/g, "u")
    .replace(/(.)\1+/g, "$1") // collapse doubled letters
    .replace(/h$/, ""); // "shubh" == "shub"

/** Comparable key for a single name token. */
export const nameTokenKey = (token = "") => {
  const cleaned = token
    .normalize("NFC")
    .replace(new RegExp(NUKTA, "g"), "")
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");

  return normalizeLatin(transliterateWord(cleaned));
};

const splitName = (name = "") =>
  name
    .normalize("NFC")
    .replace(/[,.;:!?()"'“”‘’।]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Comparable key for a whole name: "Shivam  Kumar" / "शिवम कुमार" -> "shivam kumar" */
export const personNameKey = (name = "") =>
  splitName(name).map(nameTokenKey).filter(Boolean).join(" ");

const levenshtein = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
};

// One-letter slips ("ramdas"/"ramadas") are tolerated only for long tokens.
// Short names are NOT fuzzed: Amit/Amita or Sumit/Sunit are different people.
const tokensMatch = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 6 && levenshtein(a, b) <= 1;
};

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Finds the people a spoken name refers to.
 *
 * Tiers (the first tier with a hit wins):
 *   "exact"      same name after normalisation
 *   "fuzzy"      same name allowing a one-letter slip in long tokens
 *   "first-name" the query is just the first name of one or more people
 *
 * Every person in the winning tier is returned so totals can be summed.
 */
export const findMatchingPeople = (people = [], queryName = "") => {
  const queryTokens = splitName(queryName).map(nameTokenKey).filter(Boolean);
  if (!queryTokens.length) return { people: [], matchType: null };

  const entries = people.map((person) => ({
    person,
    tokens: splitName(person.name).map(nameTokenKey).filter(Boolean),
  }));

  const exact = entries.filter(
    ({ tokens }) =>
      tokens.length === queryTokens.length &&
      tokens.every((token, i) => token === queryTokens[i])
  );
  if (exact.length) {
    return { people: exact.map((e) => e.person), matchType: "exact" };
  }

  const fuzzy = entries.filter(
    ({ tokens }) =>
      tokens.length === queryTokens.length &&
      tokens.every((token, i) => tokensMatch(token, queryTokens[i]))
  );
  if (fuzzy.length) {
    return { people: fuzzy.map((e) => e.person), matchType: "fuzzy" };
  }

  if (queryTokens.length === 1) {
    const firstName = entries.filter(
      ({ tokens }) => tokens.length > 1 && tokensMatch(tokens[0], queryTokens[0])
    );
    if (firstName.length) {
      return { people: firstName.map((e) => e.person), matchType: "first-name" };
    }
  }

  return { people: [], matchType: null };
};

/**
 * Looks for any saved person's name inside a sentence. This is far more
 * reliable than guessing a name from word order, because it can never turn
 * "चाय" or "इस महीने" into a person.
 *
 * Returns { name, people } (name = the words as spoken) or null.
 */
export const findKnownPersonInText = (text = "", people = []) => {
  if (!people.length) return null;

  const words = splitName(text);
  const wordKeys = words.map(nameTokenKey);
  let best = null;

  for (let length = 4; length >= 1; length -= 1) {
    for (let start = 0; start + length <= words.length; start += 1) {
      const spoken = words.slice(start, start + length).join(" ");
      if (wordKeys.slice(start, start + length).some((key) => key.length < 3)) {
        continue;
      }

      const match = findMatchingPeople(people, spoken);
      if (!match.people.length) continue;

      // Prefer longer matches, then better tiers.
      const rank = length * 10 + (match.matchType === "exact" ? 2 : match.matchType === "fuzzy" ? 1 : 0);
      if (!best || rank > best.rank) {
        best = { rank, name: spoken, people: match.people, start, length };
      }
    }
    if (best) break; // longest window that matched is the answer
  }

  return best
    ? { name: best.name, people: best.people, start: best.start, length: best.length }
    : null;
};

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/**
 * Does this ledger entry count as spending on/with the person?
 *
 *  - "expense": spending recorded against the person
 *  - "given"  : older versions saved "Shivam ko paise diye" as `given`; they
 *               were already counted as person expenses, so they still are
 *
 * Loans and loan repayments are deliberately excluded, they are not spending.
 */
export const isPersonExpense = (transaction) =>
  transaction?.type === "expense" || transaction?.type === "given";

/** Sums every expense-type entry (optionally inside a date range). */
export const summarizePersonExpenses = (transactions = [], range = {}) => {
  const { start, end } = range;
  let total = 0;
  let count = 0;

  for (const transaction of transactions) {
    if (!isPersonExpense(transaction)) continue;
    if (start && (transaction.date || "") < start) continue;
    if (end && (transaction.date || "") > end) continue;

    total += Number(transaction.amount) || 0;
    count += 1;
  }

  // Avoid 0.1 + 0.2 style artefacts in spoken answers.
  return { total: Math.round(total * 100) / 100, count };
};

const emptySummary = () => ({
  totalGiven: 0,
  totalReceived: 0,
  totalLoansGiven: 0,
  totalLoanRepayments: 0,
  totalExpenses: 0,
  expenseCount: 0,
  loanOutstanding: 0,
  transactionCount: 0,
});

const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * One summary for a list of ledger entries (possibly from several person
 * records that are the same human). `range` filters by date, except the loan
 * balance, which is always all-time because a balance has no "period".
 */
export const summarizePerson = (transactions = [], range = {}) => {
  const summary = emptySummary();
  const { start, end } = range;
  let loansGiven = 0;
  let repayments = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount) || 0;

    if (transaction.type === "loan_given") loansGiven += amount;
    if (transaction.type === "loan_repayment") repayments += amount;

    const date = transaction.date || "";
    if ((start && date < start) || (end && date > end)) continue;

    summary.transactionCount += 1;

    switch (transaction.type) {
      case "given":
        summary.totalGiven += amount;
        break;
      case "received":
        summary.totalReceived += amount;
        break;
      case "loan_given":
        summary.totalLoansGiven += amount;
        break;
      case "loan_repayment":
        summary.totalLoanRepayments += amount;
        break;
      default:
        break;
    }
  }

  const expenses = summarizePersonExpenses(transactions, range);
  summary.totalExpenses = expenses.total;
  summary.expenseCount = expenses.count;
  summary.loanOutstanding = roundMoney(Math.max(0, loansGiven - repayments));

  for (const key of ["totalGiven", "totalReceived", "totalLoansGiven", "totalLoanRepayments"]) {
    summary[key] = roundMoney(summary[key]);
  }

  return summary;
};
