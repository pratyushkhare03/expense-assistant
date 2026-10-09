
import {
  getTotalExpense,
  getTodayExpense,
  getThisMonthExpense,
  getCategoryExpenses,
} from "../utils/expenseCalculations";

import {
  getTotalIncome,
  getThisMonthIncome,
} from "../utils/incomeCalculations";

const formatMoney = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const categoryIcons = {
  food: "🍜",
  travel: "🚕",
  fuel: "⛽",
  grocery: "🛒",
  shopping: "🛍️",
  bills: "🧾",
  health: "💊",
  entertainment: "🎬",
  education: "📚",
  rent: "🏠",
  other: "💸",
};

function Dashboard({ expenses = [], incomes = [] }) {
  const totalExpense = getTotalExpense(expenses);
  const todayExpense = getTodayExpense(expenses);
  const monthExpense = getThisMonthExpense(expenses);
  const categoryExpenses = getCategoryExpenses(expenses);

  const totalIncome = getTotalIncome(incomes);
  const monthIncome = getThisMonthIncome(incomes);

  const overallBalance = totalIncome - totalExpense;
  const monthBalance = monthIncome - monthExpense;

  const categoryEntries = Object.entries(categoryExpenses).sort(
    (a, b) => Number(b[1]) - Number(a[1])
  );

  const highestCategoryExpense = Math.max(
    0,
    ...categoryEntries.map(([, amount]) => Number(amount) || 0)
  );

  const expenseCount = expenses.length;
  const incomeCount = incomes.length;

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">
            YOUR MONEY AT A GLANCE
          </span>
          <h2>Financial Dashboard</h2>
          <p>Track your income, spending, and savings in one place.</p>
        </div>

        <div className="dashboard-live">
          <span className="dashboard-live-dot" />
          Live overview
        </div>
      </div>

      {/* Main balance card */}
      <div className="dashboard-balance-card">
        <div className="dashboard-balance-content">
          <span className="dashboard-card-label">
            <span className="dashboard-balance-icon">◈</span>
            Overall Balance
          </span>

          <h3
            className={
              overallBalance < 0
                ? "dashboard-balance-value negative"
                : "dashboard-balance-value"
            }
          >
            {formatMoney(overallBalance)}
          </h3>

          <p>
            {overallBalance >= 0
              ? "Your recorded income minus your recorded expenses."
              : "Your recorded expenses exceed your recorded income."}
          </p>
        </div>

        <div className="dashboard-balance-decoration">
          <span className="dashboard-orbit dashboard-orbit-one" />
          <span className="dashboard-orbit dashboard-orbit-two" />
          <span className="dashboard-orbit dashboard-orbit-three" />
          <span className="dashboard-orbit-center">₹</span>
        </div>

        <div className="dashboard-balance-footer">
          <span>
            <span className="dashboard-footer-dot income-dot" />
            Total income
            <strong>{formatMoney(totalIncome)}</strong>
          </span>

          <span>
            <span className="dashboard-footer-dot expense-dot" />
            Total expenses
            <strong>{formatMoney(totalExpense)}</strong>
          </span>
        </div>
      </div>

      {/* Overall statistics */}
      <div className="dashboard-section-heading">
        <div>
          <h3>Overall Summary</h3>
          <p>Your complete recorded financial activity</p>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <article className="dashboard-stat-card income-stat">
          <div className="dashboard-stat-top">
            <span className="dashboard-stat-icon">↗</span>
            <span className="dashboard-stat-tag">INCOME</span>
          </div>
          <p>Total Income</p>
          <h3>{formatMoney(totalIncome)}</h3>
          <span className="dashboard-stat-foot">
            {incomeCount} recorded {incomeCount === 1 ? "entry" : "entries"}
          </span>
        </article>

        <article className="dashboard-stat-card expense-stat">
          <div className="dashboard-stat-top">
            <span className="dashboard-stat-icon">↘</span>
            <span className="dashboard-stat-tag">EXPENSE</span>
          </div>
          <p>Total Expenses</p>
          <h3>{formatMoney(totalExpense)}</h3>
          <span className="dashboard-stat-foot">
            {expenseCount} recorded{" "}
            {expenseCount === 1 ? "entry" : "entries"}
          </span>
        </article>

        <article className="dashboard-stat-card today-stat">
          <div className="dashboard-stat-top">
            <span className="dashboard-stat-icon">◷</span>
            <span className="dashboard-stat-tag">TODAY</span>
          </div>
          <p>Today's Spending</p>
          <h3>{formatMoney(todayExpense)}</h3>
          <span className="dashboard-stat-foot">
            Your spending for today
          </span>
        </article>
      </div>

      {/* Monthly overview */}
      <div className="dashboard-section-heading">
        <div>
          <h3>This Month</h3>
          <p>A snapshot of your monthly finances</p>
        </div>
      </div>

      <div className="dashboard-month-grid">
        <article className="dashboard-month-card">
          <div className="dashboard-month-top">
            <span className="dashboard-month-icon month-income-icon">↗</span>
            <span>Money in</span>
          </div>
          <h3>{formatMoney(monthIncome)}</h3>
          <p>Monthly income</p>
          <div className="dashboard-mini-track">
            <span className="month-income-track" />
          </div>
        </article>

        <article className="dashboard-month-card">
          <div className="dashboard-month-top">
            <span className="dashboard-month-icon month-expense-icon">↘</span>
            <span>Money out</span>
          </div>
          <h3>{formatMoney(monthExpense)}</h3>
          <p>Monthly expenses</p>
          <div className="dashboard-mini-track">
            <span className="month-expense-track" />
          </div>
        </article>

        <article className="dashboard-month-card monthly-balance-card">
          <div className="dashboard-month-top">
            <span className="dashboard-month-icon month-balance-icon">◈</span>
            <span>Net balance</span>
          </div>
          <h3 className={monthBalance < 0 ? "negative" : ""}>
            {formatMoney(monthBalance)}
          </h3>
          <p>Monthly income minus expenses</p>
          <div className="dashboard-mini-track">
            <span
              className={
                monthBalance < 0
                  ? "month-negative-track"
                  : "month-balance-track"
              }
            />
          </div>
        </article>
      </div>

      {/* Category breakdown */}
      <div className="dashboard-section-heading">
        <div>
          <h3>Where Your Money Goes</h3>
          <p>Breakdown of expenses by category</p>
        </div>

        <span className="dashboard-category-count">
          {categoryEntries.length}{" "}
          {categoryEntries.length === 1 ? "category" : "categories"}
        </span>
      </div>

      <div className="dashboard-category-panel">
        {categoryEntries.length === 0 ? (
          <div className="dashboard-empty">
            <span className="dashboard-empty-icon">◌</span>
            <h4>No expenses yet</h4>
            <p>
              Your spending categories will appear here once you record
              an expense.
            </p>
          </div>
        ) : (
          <div className="dashboard-category-list">
            {categoryEntries.map(([category, amount]) => {
              const value = Number(amount) || 0;
              const percentage =
                highestCategoryExpense > 0
                  ? (value / highestCategoryExpense) * 100
                  : 0;

              return (
                <div className="dashboard-category-row" key={category}>
                  <div className="dashboard-category-icon">
                    {categoryIcons[String(category).toLowerCase()] || "💸"}
                  </div>

                  <div className="dashboard-category-details">
                    <div className="dashboard-category-info">
                      <span className="dashboard-category-name">
                        {String(category).charAt(0).toUpperCase() +
                          String(category).slice(1)}
                      </span>
                      <strong>{formatMoney(value)}</strong>
                    </div>

                    <div
                      className="dashboard-category-track"
                      role="progressbar"
                      aria-label={`${category} expense compared with the highest spending category`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(percentage)}
                    >
                      <span
                        style={{ width: `${percentage}%` }}
                        className="dashboard-category-fill"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="dashboard-disclaimer">
        Balance is calculated from the income and expenses recorded in your app.
        It may not represent your actual bank balance.
      </p>
    </section>
  );
}

export default Dashboard;

