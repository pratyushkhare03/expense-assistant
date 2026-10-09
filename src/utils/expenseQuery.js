import {
  getTotalExpense,
  getTodayExpense,
  getThisMonthExpense,
  getCategoryExpenses,
} from "./expenseCalculations";

export const answerExpenseQuery = (text, expenses) => {
  const query = text.toLowerCase();

  if (
    query.includes("today") ||
    query.includes("aaj")
  ) {
    const amount = getTodayExpense(expenses);

    return `Aaj tumne ₹${amount} kharch kiye.`;
  }

  if (
    query.includes("this month") ||
    query.includes("is month") ||
    query.includes("iss month") ||
    query.includes("is mahine") ||
    query.includes("iss mahine")
  ) {
    const amount = getThisMonthExpense(expenses);

    return `Is mahine tumne ₹${amount} kharch kiye.`;
  }

  if (
    query.includes("total") ||
    query.includes("overall") ||
    query.includes("ab tak")
  ) {
    const amount = getTotalExpense(expenses);

    return `Tumhara total expense ₹${amount} hai.`;
  }

  const categoryExpenses = getCategoryExpenses(expenses);

  const categories = Object.keys(categoryExpenses);

  for (const category of categories) {
    if (query.includes(category)) {
      const amount = categoryExpenses[category];

      return `${category} par tumne ₹${amount} kharch kiye hain.`;
    }
  }

  return "Sorry, main tumhara question samajh nahi paaya.";
};