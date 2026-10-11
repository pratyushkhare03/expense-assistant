import { db } from "./database";

export const addExpense = async (expense) => {
  return await db.expenses.add({
    ...expense,
    createdAt: new Date(),
  });
};

export const getAllExpenses = async () => {
  return await db.expenses.orderBy("date").reverse().toArray();
};

/**
 * Deleting an expense also removes the person-ledger entry that mirrors it,
 * otherwise "total expense of <person>" would keep counting deleted spending.
 */
export const deleteExpense = async (id) => {
  return db.transaction("rw", db.expenses, db.personTransactions, async () => {
    await db.personTransactions.where("expenseId").equals(id).delete();
    return db.expenses.delete(id);
  });
};

export const getExpensesByDate = async (date) => {
  return await db.expenses
    .where("date")
    .equals(date)
    .toArray();
};

/**
 * Editing an expense's amount/date also updates its mirrored person-ledger
 * entry so both always agree.
 */
export const updateExpense = async (id, updates) => {
  return db.transaction("rw", db.expenses, db.personTransactions, async () => {
    const result = await db.expenses.update(id, {
      ...updates,
      updatedAt: new Date(),
    });

    const mirrored = {};
    if (updates.amount !== undefined) mirrored.amount = Number(updates.amount);
    if (updates.date !== undefined) mirrored.date = updates.date;

    if (Object.keys(mirrored).length) {
      await db.personTransactions
        .where("expenseId")
        .equals(id)
        .modify(mirrored);
    }

    return result;
  });
};
