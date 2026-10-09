import { useEffect, useState } from "react";

import { getAllExpenses } from "./db/expenseDB";
import { getAllIncome } from "./db/incomeDB";
import { answerExpenseQuery } from "./utils/expenseQuery";

import BackupRestore from "./components/BackupRestore";
import VoiceInput from "./components/VoiceInput";
import Dashboard from "./components/Dashboard";
import ExpenseHistory from "./components/ExpenseHistory";
import IncomeManager from "./components/IncomeManager";
import LocalTestPanel from "./components/LocalTestPanel";

import "./utils/testHindiNumbers";
import "./index.css";

const navigation = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "expenses", label: "Expenses", icon: "▤" },
  { id: "income", label: "Income", icon: "↗" },
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "backup", label: "Backup & Restore", icon: "⇧" },
  { id: "developer", label: "Parser Lab", icon: "⌘" },
];

const pageTitles = {
  home: "Home",
  expenses: "Expense History",
  income: "Income Manager",
  dashboard: "Financial Overview",
  backup: "Backup & Restore",
  developer: "Developer Tools",
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

  const testQuery = () => {
    const answer = answerExpenseQuery("aaj kitna kharch hua", expenses);
    console.log(answer);
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

      case "developer":
        return (
          <section className="workspace-panel">
            <div className="workspace-heading">
              <span className="workspace-eyebrow">DEVELOPER AREA</span>
              <h2>Parser Lab</h2>
              <p>Test and debug your local expense parser.</p>
            </div>

            <button
              className="secondary-button"
              onClick={testQuery}
            >
              Test expense query
            </button>

            <LocalTestPanel />
          </section>
        );

      case "home":
      default:
        return (
          <section className="voice-home">
            <div className="voice-home-copy">
              <span className="voice-home-eyebrow">
                YOUR PERSONAL FINANCE ASSISTANT
              </span>

              <h2>
                Your money.
                <br />
                <span>Your words.</span>
              </h2>

              <p>
                Track spending, record income, and ask questions.
                Just speak naturally.
              </p>
            </div>

            <button
              type="button"
              className="home-mic-button"
              aria-label="Open voice assistant"
              onClick={() => setVoiceModalOpen(true)}
            >
              <span className="home-mic-halo home-mic-halo-one" />
              <span className="home-mic-halo home-mic-halo-two" />

              <span className="home-mic-core">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 18v3" />
                  <path d="M9 21h6" />
                </svg>
              </span>
            </button>

            <div className="voice-home-prompt">
              <span className="voice-home-prompt-dot" />
              Tap the microphone to start speaking
            </div>

            <div className="voice-home-example">
              <span className="voice-example-label">TRY SAYING</span>
              <p>“I spent ₹250 on food today.”</p>
            </div>
          </section>
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
          >
            <span>🎙</span>
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
                <span className="voice-modal-eyebrow">VOICE ASSISTANT</span>
                <h2 id="voice-modal-title">I'm listening</h2>
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
              <VoiceInput
                expenses={expenses}
                onExpenseAdded={loadData}
              />
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