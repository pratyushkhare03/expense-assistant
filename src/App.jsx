import { useEffect, useState } from "react";

import { getAllExpenses } from "./db/expenseDB";
import { getAllIncome } from "./db/incomeDB";

import BackupRestore from "./components/BackupRestore";
import VoiceInput from "./components/VoiceInput";
import Dashboard from "./components/Dashboard";
import ExpenseHistory from "./components/ExpenseHistory";
import IncomeManager from "./components/IncomeManager";

import "./index.css";

const navigation = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "expenses", label: "Expenses", icon: "▤" },
  { id: "income", label: "Income", icon: "↗" },
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "backup", label: "Backup & Restore", icon: "⇧" },
];

const pageTitles = {
  home: "Home",
  expenses: "Expense History",
  income: "Income Manager",
  dashboard: "Financial Overview",
  backup: "Backup & Restore",
};

function App() {
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [activePage, setActivePage] = useState("home");
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadData = async () => {
    try {
      const [expenseData, incomeData] = await Promise.all([
        getAllExpenses(),
        getAllIncome(),
      ]);

      setExpenses(expenseData);
      setIncomes(incomeData);
    } catch (error) {
      console.error("Error loading financial data:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!voiceModalOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setVoiceModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [voiceModalOpen]);

  const navigateTo = (page) => {
    setActivePage(page);
    setSidebarOpen(false);

    if (page !== "home") {
      setVoiceModalOpen(false);
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case "expenses":
        return (
          <ExpenseHistory
            expenses={expenses}
            onExpenseDeleted={loadData}
          />
        );

      case "income":
        return (
          <IncomeManager
            incomes={incomes}
            onIncomeChanged={loadData}
          />
        );

      case "dashboard":
        return (
          <Dashboard
            expenses={expenses}
            incomes={incomes}
          />
        );

      case "backup":
        return <BackupRestore onRestore={loadData} />;

      case "home":
      default:
        return (
          <div className="home-overview">
            <section className="voice-home">
              <div className="voice-home-copy">
                <span className="voice-home-eyebrow">YOUR PERSONAL FINANCE ASSISTANT</span>
                <h2>Know your money.<br /><span>Own your tomorrow.</span></h2>
                <p>Track spending, record income, and ask questions in natural Hindi or English. Tap <strong>Ask AI</strong> in the top-right corner to speak.</p>
              </div>
              <div className="home-quick-prompts" aria-label="Example voice commands">
                <span>“आज मैंने 250 रुपये खाने पर खर्च किए”</span>
                <span>“इस महीने कितना खर्च हुआ?”</span>
                <span>“मुझे 12000 रुपये सैलरी मिली”</span>
              </div>
            </section>
            <Dashboard expenses={expenses} incomes={incomes} />
          </div>
        );
    }
  };

  return (
    <div className="finance-app">
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <button
          type="button"
          className="app-brand"
          onClick={() => navigateTo("home")}
        >
          <span className="app-brand-icon">₹</span>
          <span className="app-brand-text">
            <strong>Expense AI</strong>
            <small>PERSONAL FINANCE</small>
          </span>
        </button>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-nav-item ${
                activePage === item.id ? "active" : ""
              }`}
              onClick={() => navigateTo(item.id)}
              aria-current={activePage === item.id ? "page" : undefined}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
              {activePage === item.id && (
                <span className="sidebar-active-indicator" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <button
          type="button"
          className="sidebar-voice-shortcut"
          onClick={() => {
            setActivePage("home");
            setSidebarOpen(false);
            setVoiceModalOpen(true);
          }}
        >
          <span className="sidebar-voice-icon">🎙</span>
          <span>
            <strong>Ask your assistant</strong>
            <small>Speak to record or ask</small>
          </span>
        </button>

        <div className="sidebar-footer">
          <span className="sidebar-footer-dot" />
          Your data stays on this device
        </div>
      </aside>

      <div className="app-main">
        <header className="workspace-topbar">
          <div className="workspace-topbar-left">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <span className="topbar-overline">EXPENSE AI</span>
              <h1>{pageTitles[activePage]}</h1>
            </div>
          </div>

          <button
            type="button"
            className="topbar-mic-shortcut"
            onClick={() => setVoiceModalOpen(true)}
            aria-label="Open Hindi voice assistant"
            title="Ask your AI assistant"
          >
            <span aria-hidden="true">🎙</span>
            <span className="topbar-mic-label">Ask AI</span>
          </button>
        </header>

        <main className={`workspace-content page-${activePage}`}>
          {renderPage()}
        </main>

        <footer className="workspace-footer">
          <span>Made for simpler money management</span>
          <span>
            <span className="sidebar-footer-dot" />
            Local-first finance
          </span>
        </footer>
      </div>

      {voiceModalOpen && (
        <div
          className="voice-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setVoiceModalOpen(false);
            }
          }}
        >
          <section
            className="voice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-modal-title"
          >
            <div className="voice-modal-header">
              <div>
                <span className="voice-modal-eyebrow">GEMINI-POWERED VOICE</span>
                <h2 id="voice-modal-title">आपका AI सहायक</h2>
              </div>

              <button
                type="button"
                className="voice-modal-close"
                aria-label="Close voice assistant"
                onClick={() => setVoiceModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="voice-modal-body">
              <VoiceInput onExpenseAdded={loadData} />
            </div>

            <p className="voice-modal-hint">
              Speak naturally to record transactions or ask about your money.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;