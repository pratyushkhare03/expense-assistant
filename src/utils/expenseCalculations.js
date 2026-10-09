import { getLocalDate } from "./dateUtils";


export const getTotalExpense = (expenses) => {
  return expenses.reduce((total, expense) => {
    return total + Number(expense.amount);
  }, 0);
};

export const getTodayExpense = (expenses) => {
  const today = getLocalDate();

  return expenses
    .filter((expense) => expense.date === today)
    .reduce((total, expense) => {
      return total + Number(expense.amount);
    }, 0);
};

export const getThisMonthExpense = (expenses) => {
  const now = new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return expenses
    .filter((expense) => {
      const expenseDate = new Date(expense.date);

      return (
        expenseDate.getFullYear() === currentYear &&
        expenseDate.getMonth() === currentMonth
      );
    })
    .reduce((total, expense) => {
      return total + Number(expense.amount);
    }, 0);
};

export const getCategoryExpenses = (expenses) => {
  const categoryTotals = {};

  expenses.forEach((expense) => {
    const category = expense.category;

    if (!categoryTotals[category]) {
      categoryTotals[category] = 0;
    }

    categoryTotals[category] += Number(expense.amount);
  });

  return categoryTotals;
};

export const getExpenseByDate = (expenses, date) => {
  return expenses
    .filter((expense) => expense.date === date)
    .reduce((total, expense) => {
      return total + Number(expense.amount);
    }, 0);
};