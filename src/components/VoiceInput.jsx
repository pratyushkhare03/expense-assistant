import { useState } from "react";
import { addExpense } from "../db/expenseDB";
import { getLocalDate, getDateOffset } from "../utils/dateUtils";
import { parseWithBackend } from "../services/aiService";
import { extractDescription } from "../utils/descriptionParser";
import { addIncome } from "../db/incomeDB";

import { getAllIncome } from "../db/incomeDB";

import {
  getTotalIncome,
  getThisMonthIncome,
} from "../utils/incomeCalculations";

import {
  addPersonTransaction,
  getAllPeople,
  getPersonSummary,
} from "../db/personLedgerDB";

import {
  getTotalExpense,
  getTodayExpense,
  getThisMonthExpense,
  getCategoryExpenses,
  getExpenseByDate,
} from "../utils/expenseCalculations";

import {
  formatDateExpenseResponse,
  formatExpenseResponse,
} from "../utils/responseFormatter";

function VoiceInput({ expenses, onExpenseAdded }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");

  const loadIncomes = async () => {
  return await getAllIncome();
};

const handlePersonCommand = async (data, spokenText) => {
  if (data.type === "person_transaction") {
    const transactionType = data.transactionType;

    await addPersonTransaction({
      personName: data.personName,
      amount: data.amount,
      type: transactionType,
      description: spokenText,
      date: getLocalDate(),
    });

    // An expense linked to a person must also count in the
    // app's existing expense totals and dashboard.
    if (transactionType === "expense") {
      await addExpense({
        amount: data.amount,
        category: "other",
        description: `${spokenText} (Person: ${data.personName})`,
        paymentMethod: "other",
        date: getLocalDate(),
      });

      await onExpenseAdded?.();
    }

    const confirmations = {
      given: `₹${data.amount} ${data.personName} ko diye gaye. Ledger update ho gaya.`,
      received: `₹${data.amount} ${data.personName} se mile hue record ho gaye.`,
      loan_given: `${data.personName} ko ₹${data.amount} udhaar diye gaye. Yeh normal expense mein nahi joda gaya.`,
      loan_repayment: `${data.personName} se ₹${data.amount} udhaar wapas mile. Loan ledger update ho gaya.`,
      expense: `${data.personName} se related ₹${data.amount} ka expense save ho gaya.`,
    };

    const answer =
      confirmations[transactionType] ||
      "Person transaction save ho gaya.";

    setMessage(answer);
    speak(answer);
    return true;
  }

  if (data.type === "person_query") {
    const people = await getAllPeople();
    const normalizedName = data.personName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    const person = people.find(
      (item) => item.normalizedName === normalizedName
    );

    if (!person) {
      const answer = `${data.personName} ka ledger abhi nahi mila. Pehle unka transaction record karo.`;
      setMessage(answer);
      speak(answer);
      return true;
    }

    const summary = await getPersonSummary(person.id);
    let answer;

    switch (data.metric) {
      case "loan_outstanding":
        answer = `${person.name} ka baaki udhaar ₹${summary.loanOutstanding} hai.`;
        break;

      case "received":
        answer =
          `${person.name} se total ₹${
            summary.totalReceived + summary.totalLoanRepayments
          } receive hue hain.`;
        break;

      case "expense":
        answer = `${person.name} se related total expense ₹${summary.totalExpenses} hai.`;
        break;

      default:
        answer =
          `Tumne ${person.name} ko total ₹${
            summary.totalGiven + summary.totalLoansGiven
          } diye hain, jisme ₹${summary.totalLoansGiven} udhaar ke roop mein diye gaye.`;
    }

    setMessage(answer);
    speak(answer);
    return true;
  }

  return false;
};

  const speak = (text) => {
    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "hi-IN";
    speech.rate = 1;
    speech.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setMessage("");
    };

    recognition.onresult = async (event) => {
      const spokenText = event.results[0][0].transcript;

      setText(spokenText);

      try {
        const response = await parseWithBackend(spokenText);

        console.log("Voice transcript:", spokenText);
console.log("Parser result:", response);
console.log("Detected intent:", response.data?.intent);
        console.log("Local parser response:", response);

        if (!response.success) {
          setMessage("AI response nahi mila.");
          speak("AI response nahi mila.");
          return;
        }

        const data = response.data;

        // Person transactions and person-specific queries
// must be handled before the generic query/income/expense paths.
const handledPersonCommand = await handlePersonCommand(
  data,
  spokenText
);

if (handledPersonCommand) {
  return;
}

        // =========================
        // QUERY HANDLING
        // =========================

        if (data.type === "query") {
          let answer = "";

          switch (data.intent) {
            case "today_expense": {
              const amount = getTodayExpense(expenses);

              answer = `Aaj tumne ₹${amount} kharch kiye.`;
              break;
            }

            case "month_expense": {
              const amount = getThisMonthExpense(expenses);

              answer = `Is mahine tumne ₹${amount} kharch kiye.`;
              break;
            }

            case "total_expense": {
              const amount = getTotalExpense(expenses);

              answer = `Ab tak tumne ₹${amount} kharch kiye hain.`;
              break;
            }

            case "category_expense": {
              const categoryTotals = getCategoryExpenses(expenses);

              const category = data.category || "other";
              const amount = categoryTotals[category] || 0;

              answer = `${category} par tumne ₹${amount} kharch kiye hain.`;
              break;
            }

            case "yesterday_expense": {
              const date = getDateOffset(-1);
              const amount = getExpenseByDate(expenses, date);

              answer = `Kal tumne ₹${amount} kharch kiye.`;
              break;
            }

            case "day_before_yesterday_expense": {
              const date = getDateOffset(-2);
              const amount = getExpenseByDate(expenses, date);

              answer = `Parso tumne ₹${amount} kharch kiye.`;
              break;
            }

            case "date_expense": {
              const amount = getExpenseByDate(expenses, data.date);

              answer = formatDateExpenseResponse(data.date, amount);
              break;
            }

            
case "total_income": {
  const incomes = await loadIncomes();
  const amount = getTotalIncome(incomes);

  answer = `Ab tak tumhari total income ₹${amount} hai.`;
  break;
}

case "month_income": {
  const incomes = await loadIncomes();
  const amount = getThisMonthIncome(incomes);

  answer = `Is mahine tumhari income ₹${amount} hai.`;
  break;
}

case "total_balance": {
  const incomes = await loadIncomes();
  const totalIncome = getTotalIncome(incomes);
  const totalExpense = getTotalExpense(expenses);
  const balance = totalIncome - totalExpense;

  answer = `Tumhara overall balance ₹${balance} hai.`;
  break;
}

case "month_balance": {
  const incomes = await loadIncomes();
  const monthIncome = getThisMonthIncome(incomes);
  const monthExpense = getThisMonthExpense(expenses);
  const balance = monthIncome - monthExpense;

  answer = `Is mahine ka balance ₹${balance} hai.`;
  break;
}

            default: {
              answer = "Sorry, main tumhara question samajh nahi paaya.";
            }
          }

          setMessage(answer);
          speak(answer);

          return;
        }

        
        // =========================
        // INCOME HANDLING
        // =========================

        if (data.type === "income") {
          if (
            typeof data.amount !== "number" ||
            !Number.isFinite(data.amount) ||
            data.amount <= 0
          ) {
            const question = "Kitne rupaye mile?";
            setMessage(question);
            speak(question);
            return;
          }

          const allowedSources = [
            "salary",
            "family",
            "freelance",
            "business",
            "investment",
            "other",
          ];

          const source = allowedSources.includes(data.source)
            ? data.source
            : "other";

          const income = {
            amount: data.amount,
            source,
            description: spokenText,
            paymentMethod: "other",
            date: getLocalDate(),
          };

          await addIncome(income);

          const confirmation =
            `₹${data.amount} ki income save ho gayi. ` +
            `Source: ${source}.`;

          setMessage(confirmation);
          speak(confirmation);

          // App.jsx se milne wala callback
          // expenses aur income dono reload karta hai.
          await onExpenseAdded?.();

          return;
        }

        // =========================
        // EXPENSE HANDLING
        // =========================

        if (data.type === "expense") {
          // Amount validation
          if (
            typeof data.amount !== "number" ||
            !Number.isFinite(data.amount) ||
            data.amount <= 0
          ) {
            const question = "Kitne rupaye kharch hue?";

            setMessage(question);
            speak(question);

            return;
          }

          // Category validation
          const allowedCategories = [
            "food",
            "travel",
            "fuel",
            "grocery",
            "shopping",
            "bills",
            "health",
            "other",
          ];

          const category = allowedCategories.includes(data.category)
            ? data.category
            : "other";

          // Create expense
          const expense = {
            amount: data.amount,
            category,
            description: extractDescription(spokenText, category),
            paymentMethod: "other",
            date: getLocalDate(),
          };

          await addExpense(expense);

          const confirmation = formatExpenseResponse(
  data.amount,
  category
);

          setMessage(confirmation);
          speak(confirmation);

          onExpenseAdded();

          return;
        }

        // =========================
        // UNKNOWN INPUT
        // =========================

        const unknownMessage =
          "Sorry, main aapki baat samajh nahi paaya.";

        setMessage(unknownMessage);
        speak(unknownMessage);
      } catch (error) {
        console.error("AI parsing error:", error);

        const errorMessage =
          "Data process nahi ho paya. Please dobara try karo.";

        setMessage(errorMessage);
        speak(errorMessage);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      setListening(false);
      setMessage("Aapki awaaz samajh nahi aayi.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  
  return (
    <div className="voice-assistant">
      <div className="voice-heading">
        <div>
          <span className="voice-eyebrow">YOUR AI COMPANION</span>
          <h2>Voice Assistant</h2>
          <p className="voice-subtitle">
            Speak naturally. I'll take care of your finances.
          </p>
        </div>

        <span className={`voice-status ${listening ? "is-listening" : ""}`}>
          <span className="voice-status-dot" />
          {listening ? "Listening" : "Ready"}
        </span>
      </div>

      <div className={`voice-orb-area ${listening ? "is-listening" : ""}`}>
        <div className="voice-orb-rings" aria-hidden="true">
          <span className="voice-ring ring-one" />
          <span className="voice-ring ring-two" />
          <span className="voice-ring ring-three" />
        </div>

        <button
          type="button"
          className={`voice-mic-button ${listening ? "is-listening" : ""}`}
          onClick={startListening}
          disabled={listening}
          aria-label={listening ? "Listening to your voice" : "Start voice assistant"}
        >
          <span className="voice-orb-glow" />
          <span className="voice-mic-icon" aria-hidden="true">
            {listening ? "〰" : "🎙"}
          </span>
          <span className="voice-orb-shine" />
        </button>

        {listening && (
          <div className="voice-particles" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <p className="voice-instruction">
        {listening
          ? "I'm listening… speak now"
          : "Tap the microphone to start speaking"}
      </p>

      <div className="voice-transcript">
        <span className="transcript-label">YOU SAID</span>
        <p>{text || "Try: मैंने चाय पर पचास रुपये खर्च किए"}</p>
      </div>

      {message && (
        <div className="voice-response" role="status" aria-live="polite">
          <span className="response-icon">✦</span>
          <p>{message}</p>
        </div>
      )}

      <button
        type="button"
        className="voice-test-button"
        onClick={() => setText("मैंने चाय पर पचास रुपये खर्च किए")}
      >
        <span aria-hidden="true">🧪</span>
        Test Hindi Expense
      </button>
    </div>
  );
}

export default VoiceInput;