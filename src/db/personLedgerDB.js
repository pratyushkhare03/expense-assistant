
import { db } from "./database";

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
  date = new Date().toISOString().slice(0, 10),
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
        date,
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
 * Summarize a person's money history.
 *
 * "given" and "received" are general transfers.
 * Loan balance is calculated separately.
 */
export const getPersonSummary = async (personId) => {
  const transactions = await getPersonTransactions(personId);

  const summary = {
    totalGiven: 0,
    totalReceived: 0,
    totalLoansGiven: 0,
    totalLoanRepayments: 0,
    totalExpenses: 0,
    loanOutstanding: 0,
    transactionCount: transactions.length,
  };

  for (const transaction of transactions) {
    const amount = Number(transaction.amount) || 0;

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

      case "expense":
        summary.totalExpenses += amount;
        break;
    }
  }

  summary.loanOutstanding = Math.max(
    0,
    summary.totalLoansGiven - summary.totalLoanRepayments
  );

  return summary;
};

/**
 * Delete one person's transaction.
 */
export const deletePersonTransaction = async (transactionId) => {
  return db.personTransactions.delete(transactionId);
};
