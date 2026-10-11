
import { db } from "./database";
import { getLocalDate } from "../utils/dateUtils";
import {
  findMatchingPeople,
  personNameKey,
  summarizePerson,
  summarizePersonExpenses,
} from "../utils/personUtils";

const normalizeName = (name) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Find an existing person or create a new one.
 */
export const getOrCreatePerson = async (name) => {
  const cleanName = name.trim().replace(/\s+/g, " ");

  if (!cleanName) {
    throw new Error("Person name is required.");
  }

  const normalizedName = normalizeName(cleanName);

  return db.transaction("rw", db.people, async () => {
    const existing = await db.people
      .where("normalizedName")
      .equals(normalizedName)
      .first();

    if (existing) {
      return existing;
    }

    // "शिवम", "Shivam" and "Shiwam" are one person, not three. Re-use the
    // existing record instead of splitting the person's expenses across
    // several spellings. (A bare first name never merges into a full name
    // here; that is only done when *querying*.)
    const similar = findMatchingPeople(await db.people.toArray(), cleanName);
    if (similar.people.length && similar.matchType !== "first-name") {
      return similar.people[0];
    }

    const id = await db.people.add({
      name: cleanName,
      normalizedName,
      createdAt: new Date(),
    });

    return db.people.get(id);
  });
};

/**
 * Save a transaction against a person.
 *
 * Supported types:
 * given          = money given
 * received       = money received
 * loan_given     = loan given
 * loan_repayment = loan repayment received
 * expense        = expense associated with a person
 */
export const addPersonTransaction = async ({
  personName,
  amount,
  type,
  description = "",
  date,
  expenseId = null,
}) => {
  const validTypes = [
    "given",
    "received",
    "loan_given",
    "loan_repayment",
    "expense",
  ];

  const numericAmount = Number(amount);

  if (!personName?.trim()) {
    throw new Error("Person name is required.");
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }

  if (!validTypes.includes(type)) {
    throw new Error("Invalid person transaction type.");
  }

  return db.transaction(
    "rw",
    db.people,
    db.personTransactions,
    async () => {
      const person = await getOrCreatePerson(personName);

      return db.personTransactions.add({
        personId: person.id,
        personName: person.name,
        type,
        amount: numericAmount,
        description,
        // Local calendar date (toISOString() is UTC and can be a day off).
        date: date || getLocalDate(),
        expenseId,
        createdAt: new Date(),
      });
    }
  );
};

/**
 * Return all people, alphabetically.
 */
export const getAllPeople = async () => {
  return db.people.orderBy("name").toArray();
};

/**
 * Return one person's transaction history.
 */
export const getPersonTransactions = async (personId) => {
  return db.personTransactions
    .where("personId")
    .equals(personId)
    .toArray()
    .then((transactions) =>
      transactions.sort((a, b) => {
        const dateComparison = b.date.localeCompare(a.date);

        return dateComparison ||
          new Date(b.createdAt) - new Date(a.createdAt);
      })
    );
};

/**
 * Summarize a person's money history (optionally inside a date range).
 *
 * "given" and "received" are general transfers; loan balance is calculated
 * separately; "totalExpenses" is the single definition of person spending.
 */
export const getPersonSummary = async (personId, range = {}) => {
  const transactions = await getPersonTransactions(personId);
  return summarizePerson(transactions, range);
};

/**
 * Delete one person's transaction.
 */
export const deletePersonTransaction = async (transactionId) => {
  return db.personTransactions.delete(transactionId);
};


/**
 * Records spending on/with a person: the expense (so Home, Dashboard and
 * Expense History include it) AND the person-ledger entry, atomically and
 * linked by `expenseId`. Either both are saved or neither is.
 */
export const addPersonExpense = async ({
  personName,
  amount,
  category = "other",
  description = "",
  date,
  paymentMethod = "other",
}) => {
  const numericAmount = Number(amount);

  if (!personName?.trim()) throw new Error("Person name is required.");
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }

  const when = date || getLocalDate();

  return db.transaction(
    "rw",
    db.expenses,
    db.people,
    db.personTransactions,
    async () => {
      const person = await getOrCreatePerson(personName);

      const expenseId = await db.expenses.add({
        amount: numericAmount,
        category,
        description,
        paymentMethod,
        date: when,
        personId: person.id,
        personName: person.name,
        createdAt: new Date(),
      });

      const transactionId = await db.personTransactions.add({
        personId: person.id,
        personName: person.name,
        type: "expense",
        amount: numericAmount,
        description,
        date: when,
        expenseId,
        createdAt: new Date(),
      });

      return { person, expenseId, transactionId };
    }
  );
};

/**
 * Everything about a person, looked up by *spoken name*, optionally inside a
 * date range.
 *
 * Every person record the name resolves to is combined, so all spellings
 * ("शिवम" / "Shivam") and every individual entry end up in one total, which
 * is exactly "total expense for <person> = sum of all their expenses".
 *
 * Returns { found, people, matchType, summary }.
 */
export const getPersonReport = async (personName, range = {}) => {
  const { people, matchType } = findMatchingPeople(
    await getAllPeople(),
    personName
  );

  if (!people.length) {
    return { found: false, people: [], matchType: null, summary: summarizePerson([]) };
  }

  const transactions = [];
  for (const person of people) {
    transactions.push(...(await getPersonTransactions(person.id)));
  }

  return {
    found: true,
    people,
    matchType,
    summary: summarizePerson(transactions, range),
  };
};

/** Convenience wrapper: { found, total, count, people, matchType }. */
export const getPersonExpenseReport = async (personName, range = {}) => {
  const report = await getPersonReport(personName, range);
  return {
    found: report.found,
    people: report.people,
    matchType: report.matchType,
    total: report.summary.totalExpenses,
    count: report.summary.expenseCount,
  };
};

export { personNameKey };
