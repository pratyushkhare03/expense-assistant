
import { useState } from "react";
import {
  addIncome,
  updateIncome,
  deleteIncome,
} from "../db/incomeDB";
import { getLocalDate } from "../utils/dateUtils";

const initialForm = {
  amount: "",
  source: "family",
  description: "",
  date: getLocalDate(),
  paymentMethod: "other",
};

const sourceLabels = {
  salary: "Salary",
  family: "Family / Pocket Money",
  freelance: "Freelance",
  business: "Business",
  investment: "Investment",
  other: "Other",
};

const sourceIcons = {
  salary: "💼",
  family: "🏠",
  freelance: "💻",
  business: "🏪",
  investment: "📈",
  other: "💰",
};

const paymentLabels = {
  other: "Other",
  cash: "Cash",
  upi: "UPI",
  bank: "Bank Transfer",
};

function IncomeManager({ incomes = [], onIncomeChanged }) {
  const [form, setForm] = useState({ ...initialForm });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const totalIncome = incomes.reduce(
    (total, income) => total + (Number(income.amount) || 0),
    0
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const resetForm = () => {
    setForm({ ...initialForm, date: getLocalDate() });
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Please enter a valid amount.");
      return;
    }

    if (!form.date) {
      setMessage("Please select a date.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const income = {
        ...form,
        amount,
        description: form.description.trim(),
      };

      if (editingId !== null) {
        await updateIncome(editingId, income);
        setMessage("Income updated successfully.");
      } else {
        await addIncome(income);
        setMessage("Income added successfully.");
      }

      resetForm();
      await onIncomeChanged?.();
    } catch (error) {
      console.error(error);
      setMessage("Unable to save income. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (income) => {
    setEditingId(income.id);
    setForm({
      amount: String(income.amount),
      source: income.source || "other",
      description: income.description || "",
      date: income.date || getLocalDate(),
      paymentMethod: income.paymentMethod || "other",
    });
    setMessage("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this income record?")) return;

    try {
      await deleteIncome(id);

      if (editingId === id) {
        resetForm();
      }

      setMessage("Income deleted successfully.");
      await onIncomeChanged?.();
    } catch (error) {
      console.error(error);
      setMessage("Unable to delete income.");
    }
  };

  const cancelEdit = () => {
    resetForm();
    setMessage("");
  };

  return (
    <section className="income-manager">
      <div className="income-header">
        <div>
          <span className="income-eyebrow">MONEY IN</span>
          <h2>Income Manager</h2>
          <p className="income-subtitle">
            Keep track of every rupee you receive.
          </p>
        </div>

        <div className="income-header-icon" aria-hidden="true">
          ↗
        </div>
      </div>

      <div className="income-summary-card">
        <div className="income-summary-icon" aria-hidden="true">
          ₹
        </div>
        <div>
          <span>Total recorded income</span>
          <strong>
            ₹{totalIncome.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </strong>
          <small>
            {incomes.length} {incomes.length === 1 ? "record" : "records"}
          </small>
        </div>
        <span className="income-summary-trend">↗</span>
      </div>

      <div className="income-form-card">
        <div className="income-section-heading">
          <div>
            <span className="income-step">
              {editingId !== null ? "EDIT RECORD" : "NEW TRANSACTION"}
            </span>
            <h3>{editingId !== null ? "Update income" : "Add income"}</h3>
          </div>

          <span className="income-form-symbol" aria-hidden="true">
            {editingId !== null ? "✎" : "+"}
          </span>
        </div>

        <form className="income-form" onSubmit={handleSubmit}>
          <label className="income-field income-amount-field">
            <span>Amount <span className="income-required">*</span></span>
            <div className="income-amount-input">
              <span aria-hidden="true">₹</span>
              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                placeholder="2,000"
                required
              />
            </div>
          </label>

          <label className="income-field">
            <span>Income source</span>
            <select
              name="source"
              value={form.source}
              onChange={handleChange}
            >
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {sourceIcons[value]} {label}
                </option>
              ))}
            </select>
          </label>

          <label className="income-field">
            <span>Description</span>
            <input
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="e.g. Money received from family"
            />
          </label>

          <div className="income-form-row">
            <label className="income-field">
              <span>Date <span className="income-required">*</span></span>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
              />
            </label>

            <label className="income-field">
              <span>Payment method</span>
              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleChange}
              >
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="income-form-actions">
            <button
              type="submit"
              className="income-submit-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "✓  Update Income"
                  : "+  Save Income"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="income-cancel-button"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {message && (
          <p className="income-message" role="status">
            <span aria-hidden="true">✦</span>
            {message}
          </p>
        )}
      </div>

      <div className="income-history">
        <div className="income-history-heading">
          <div>
            <span className="income-eyebrow">YOUR TRANSACTIONS</span>
            <h3>Income History</h3>
          </div>
          <span className="income-count">{incomes.length}</span>
        </div>

        {incomes.length === 0 ? (
          <div className="income-empty">
            <span aria-hidden="true">◈</span>
            <h4>No income yet</h4>
            <p>Your saved income records will appear here.</p>
          </div>
        ) : (
          <div className="income-list">
            {[...incomes]
              .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
              .map((income) => (
                <article key={income.id} className="income-item">
                  <div className="income-item-icon" aria-hidden="true">
                    {sourceIcons[income.source] || "💰"}
                  </div>

                  <div className="income-item-details">
                    <h4>
                      {sourceLabels[income.source] ||
                        income.source ||
                        "Other"}
                    </h4>

                    <p>
                      {income.description || "Income received"}
                    </p>

                    <div className="income-item-meta">
                      <span>{income.date || "No date"}</span>
                      <span>
                        {paymentLabels[income.paymentMethod] || "Other"}
                      </span>
                    </div>
                  </div>

                  <div className="income-item-right">
                    <strong>
                      +₹{Number(income.amount).toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </strong>

                    <div className="income-item-actions">
                      <button
                        type="button"
                        className="income-edit-button"
                        onClick={() => handleEdit(income)}
                        aria-label={`Edit income ${income.amount}`}
                        disabled={saving}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="income-delete-button"
                        onClick={() => handleDelete(income.id)}
                        aria-label={`Delete income ${income.amount}`}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default IncomeManager;