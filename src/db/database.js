import Dexie from "dexie";
import { personNameKey } from "../utils/personUtils";

export const db = new Dexie("ExpenseAssistantDB");

db.version(1).stores({
  expenses: "++id, date, category, amount",
  income: "++id, date, source, amount",
  settings: "key",
});

// Additive migration: existing expenses and income are preserved.
db.version(2).stores({
  expenses: "++id, date, category, amount",
  income: "++id, date, source, amount",
  settings: "key",
  people: "++id, &normalizedName, name, createdAt",
  personTransactions:
    "++id, personId, personName, type, date, amount, createdAt",
});

// v3: links an expense to its person-ledger entry (`expenseId`) so editing or
// deleting the expense keeps the person's total correct, and indexes
// `personId` on expenses.
db.version(3)
  .stores({
    expenses: "++id, date, category, amount, personId",
    income: "++id, date, source, amount",
    settings: "key",
    people: "++id, &normalizedName, name, createdAt",
    personTransactions:
      "++id, personId, personName, type, date, amount, createdAt, expenseId",
  })
  .upgrade(async (tx) => {
    // Best-effort backfill for person expenses saved by older versions: each
    // expense carrying a personName is paired with the matching unlinked
    // ledger entry (same person, amount and date).
    const expenses = await tx.table("expenses").toArray();
    const ledger = await tx.table("personTransactions").toArray();
    const claimed = new Set();

    for (const expense of expenses) {
      if (!expense.personName) continue;
      const key = personNameKey(expense.personName);

      const match = ledger.find(
        (entry) =>
          !claimed.has(entry.id) &&
          !entry.expenseId &&
          entry.type === "expense" &&
          entry.date === expense.date &&
          Number(entry.amount) === Number(expense.amount) &&
          personNameKey(entry.personName) === key
      );

      if (match) {
        claimed.add(match.id);
        await tx
          .table("personTransactions")
          .update(match.id, { expenseId: expense.id });
        await tx
          .table("expenses")
          .update(expense.id, { personId: match.personId });
      }
    }
  });

export default db;
