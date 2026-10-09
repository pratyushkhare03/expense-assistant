
import { useState } from "react";
import { deleteExpense, updateExpense } from "../db/expenseDB";

const categories = [
  "food",
  "travel",
  "fuel",
  "grocery",
  "shopping",
  "bills",
  "health",
  "other",
];

const categoryIcons = {
  food: "🍜",
  travel: "🚕",
  fuel: "⛽",
  grocery: "🛒",
  shopping: "🛍️",
  bills: "🧾",
  health: "💊",
  other: "💸",
};

const paymentMethods = ["cash", "upi", "card", "bank", "other"];

function ExpenseHistory({ expenses = [], onExpenseDeleted }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const totalExpense = expenses.reduce(
    (total, expense) => total + (Number(expense.amount) || 0),
    0
  );

  const handleDelete = async (id) => {
    if (deletingId !== null || saving) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this expense?"
    );

    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      setMessage("");

      await deleteExpense(id);

      if (editingId === id) {
        setEditingId(null);
        setForm({});
      }

      await onExpenseDeleted?.();
      setMessage("Expense deleted successfully.");
    } catch (error) {
      console.error("Delete failed:", error);
      setMessage("Could not delete the expense. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      amount: String(expense.amount),
      category: expense.category || "other",
      description: expense.description || "",
      date: expense.date || "",
      paymentMethod: expense.paymentMethod || "other",
    });
    setMessage("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSave = async (id) => {
    if (saving) return;

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Please enter a valid amount greater than zero.");
      return;
    }

    if (!form.date || !form.category) {
      setMessage("Please select a date and category.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await updateExpense(id, {
        ...form,
        amount,
      });

      await onExpenseDeleted?.();
      setEditingId(null);
      setForm({});
      setMessage("Expense updated successfully.");
    } catch (error) {
      console.error("Update failed:", error);
      setMessage("Could not update the expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({});
    setMessage("");
  };

  const sortedExpenses = [...expenses].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );

  return (
    <section className="expense-history">
      <div className="expense-history-header">
        <div>
          <span className="expense-eyebrow">MONEY OUT</span>
          <h2>Expense History</h2>
          <p className="expense-subtitle">
            Review and manage your spending.
          </p>
        </div>

        <div className="expense-header-icon" aria-hidden="true">
          ↘
        </div>
      </div>

      <div className="expense-summary-card">
        <div className="expense-summary-icon" aria-hidden="true">
          ₹
        </div>

        <div className="expense-summary-details">
          <span>Total recorded expenses</span>
          <strong>
            ₹{totalExpense.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </strong>
          <small>
            {expenses.length}{" "}
            {expenses.length === 1 ? "transaction" : "transactions"}
          </small>
        </div>

        <span className="expense-summary-arrow" aria-hidden="true">
          ↘
        </span>
      </div>

      {message && (
        <div className="expense-message" role="status">
          <span aria-hidden="true">✦</span>
          {message}
        </div>
      )}

      <div className="expense-history-list-section">
        <div className="expense-list-heading">
          <h3>Your transactions</h3>
          <span className="expense-count">{expenses.length}</span>
        </div>

        {expenses.length === 0 ? (
          <div className="expense-empty">
            <span aria-hidden="true">◈</span>
            <h4>No expenses yet</h4>
            <p>Your recorded expenses will appear here.</p>
          </div>
        ) : (
          <div className="expense-history-list">
            {sortedExpenses.map((expense) => {
              const isEditing = editingId === expense.id;
              const isDeleting = deletingId === expense.id;

              return (
                <article
                  key={expense.id}
                  className={`expense-history-item ${
                    isEditing ? "expense-item-editing" : ""
                  }`}
                >
                  {isEditing ? (
                    <div className="expense-edit-form">
                      <div className="expense-edit-heading">
                        <div>
                          <span className="expense-eyebrow">
                            EDIT TRANSACTION
                          </span>
                          <h4>Update expense</h4>
                        </div>

                        <span className="expense-edit-symbol">✎</span>
                      </div>

                      <label className="expense-field">
                        <span>Amount (₹)</span>
                        <input
                          type="number"
                          name="amount"
                          min="0.01"
                          step="0.01"
                          value={form.amount}
                          onChange={handleChange}
                          required
                        />
                      </label>

                      <label className="expense-field">
                        <span>Category</span>
                        <select
                          name="category"
                          value={form.category}
                          onChange={handleChange}
                          required
                        >
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {categoryIcons[category]}{" "}
                              {category.charAt(0).toUpperCase() +
                                category.slice(1)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="expense-field">
                        <span>Description</span>
                        <input
                          type="text"
                          name="description"
                          value={form.description}
                          onChange={handleChange}
                          placeholder="What did you spend on?"
                        />
                      </label>

                      <div className="expense-edit-row">
                        <label className="expense-field">
                          <span>Date</span>
                          <input
                            type="date"
                            name="date"
                            value={form.date}
                            onChange={handleChange}
                            required
                          />
                        </label>

                        <label className="expense-field">
                          <span>Payment method</span>
                          <select
                            name="paymentMethod"
                            value={form.paymentMethod}
                            onChange={handleChange}
                          >
                            {paymentMethods.map((method) => (
                              <option key={method} value={method}>
                                {method.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="expense-edit-actions">
                        <button
                          type="button"
                          className="expense-save-button"
                          onClick={() => handleSave(expense.id)}
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "✓ Save Changes"}
                        </button>

                        <button
                          type="button"
                          className="expense-cancel-button"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="expense-item-icon" aria-hidden="true">
                        {categoryIcons[expense.category] || "💸"}
                      </div>

                      <div className="expense-item-details">
                        <h4>
                          {expense.category
                            ? expense.category.charAt(0).toUpperCase() +
                              expense.category.slice(1)
                            : "Other"}
                        </h4>

                        <p>
                          {expense.description || "Expense recorded"}
                        </p>

                        <div className="expense-item-meta">
                          <span>{expense.date || "No date"}</span>
                          <span>
                            {(expense.paymentMethod || "other").toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="expense-item-right">
                        <strong>
                          −₹{Number(expense.amount).toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}
                        </strong>

                        <div className="expense-item-actions">
                          <button
                            type="button"
                            className="expense-edit-button"
                            onClick={() => handleEdit(expense)}
                            disabled={saving || deletingId !== null}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="expense-delete-button"
                            onClick={() => handleDelete(expense.id)}
                            disabled={saving || deletingId !== null}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default ExpenseHistory;