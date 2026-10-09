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

export const deleteExpense = async (id) => {
  return await db.expenses.delete(id);
};

export const getExpensesByDate = async (date) => {
  return await db.expenses
    .where("date")
    .equals(date)
    .toArray();
};


export const updateExpense = async (id, updates) => {
  return await db.expenses.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
};