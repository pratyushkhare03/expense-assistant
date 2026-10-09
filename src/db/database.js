import Dexie from "dexie";

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

export default db;