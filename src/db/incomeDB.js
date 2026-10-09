
import { db } from "./database";

export const addIncome = async (income) => {
  return await db.income.add({
    ...income,
    amount: Number(income.amount),
    date: income.date || new Date().toLocaleDateString("en-CA"),
    createdAt: new Date(),
  });
};

export const getAllIncome = async () => {
  return await db.income.orderBy("date").reverse().toArray();
};

export const updateIncome = async (id, updates) => {
  return await db.income.update(id, {
    ...updates,
    amount: Number(updates.amount),
    updatedAt: new Date(),
  });
};

export const deleteIncome = async (id) => {
  return await db.income.delete(id);
};

export const getIncomeByDate = async (date) => {
  return await db.income.where("date").equals(date).toArray();
};