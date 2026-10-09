
export const getTotalIncome = (incomes = []) => {
  return incomes.reduce(
    (total, income) => total + Number(income.amount || 0),
    0
  );
};

export const getThisMonthIncome = (incomes = []) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return incomes
    .filter((income) => {
      const [year, month] = income.date.split("-").map(Number);

      return (
        year === currentYear &&
        month === currentMonth + 1
      );
    })
    .reduce(
      (total, income) => total + Number(income.amount || 0),
      0
    );
};