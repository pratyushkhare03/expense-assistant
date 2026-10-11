
import { db } from "../db/database";

export const exportBackup = async () => {
  const backup = {
    app: "ExpenseAssistant",
    version: 2,
    exportedAt: new Date().toISOString(),
    expenses: await db.expenses.toArray(),
    income: await db.income.toArray(),
    settings: await db.settings.toArray(),
    // Person ledger: without these a restore silently lost every person's
    // history (and "total expense for <person>" went back to zero).
    people: await db.people.toArray(),
    personTransactions: await db.personTransactions.toArray(),
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `expense-backup-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  link.click();
  URL.revokeObjectURL(url);
};

export const importBackup = async (file) => {
  const text = await file.text();
  const backup = JSON.parse(text);

  if (
    backup?.app !== "ExpenseAssistant" ||
    !Array.isArray(backup.expenses) ||
    !Array.isArray(backup.income) ||
    !Array.isArray(backup.settings)
  ) {
    throw new Error("Invalid Expense Assistant backup file.");
  }

  // Backups made before version 2 have no person ledger; accept them.
  const people = Array.isArray(backup.people) ? backup.people : [];
  const personTransactions = Array.isArray(backup.personTransactions)
    ? backup.personTransactions
    : [];

  await db.transaction(
    "rw",
    db.expenses,
    db.income,
    db.settings,
    db.people,
    db.personTransactions,
    async () => {
      await db.expenses.clear();
      await db.income.clear();
      await db.settings.clear();
      await db.people.clear();
      await db.personTransactions.clear();

      await db.expenses.bulkPut(backup.expenses);
      await db.income.bulkPut(backup.income);
      await db.settings.bulkPut(backup.settings);
      await db.people.bulkPut(people);
      await db.personTransactions.bulkPut(personTransactions);
    }
  );
};