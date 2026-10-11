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
  const [processing, setProcessing] = useState(false);
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
        category: data.category || "other",
        personName: data.personName,
        description: `${spokenText} (Person: ${data.personName})`,
        paymentMethod: "other",
        date: getLocalDate(),
      });

      await onExpenseAdded?.();
    }

    const confirmations = {
      given: `₹${data.amount} ${data.personName} को दे दिए गए हैं। हिसाब अपडेट कर दिया गया है।`,
      received: `₹${data.amount} ${data.personName} से मिलने का रिकॉर्ड सेव हो गया है।`,
      loan_given: `${data.personName} को ₹${data.amount} उधार दिए गए हैं। इसे सामान्य खर्च में नहीं जोड़ा गया है।`,
      loan_repayment: `${data.personName} से ₹${data.amount} उधार वापस मिलने का रिकॉर्ड अपडेट हो गया है।`,
      expense: `${data.personName} से संबंधित ₹${data.amount} का खर्च सेव हो गया है।`,
    };

    const answer =
      confirmations[transactionType] ||
      "व्यक्ति से जुड़ा लेन-देन सेव हो गया है।";

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
      const answer = `${data.personName} का हिसाब नहीं मिला। पहले उनका कोई लेन-देन रिकॉर्ड करें।`;
      setMessage(answer);
      speak(answer);
      return true;
    }

    const summary = await getPersonSummary(person.id);
    let answer;

    switch (data.metric) {
      case "loan_outstanding":
        answer = `${person.name} का बाकी उधार ₹${summary.loanOutstanding} है।`;
        break;

      case "received":
        answer =
          `${person.name} से कुल ₹${
            summary.totalReceived + summary.totalLoanRepayments
          } प्राप्त हुए हैं।`;
        break;

      case "expense":
        answer = `${person.name} से संबंधित कुल खर्च ₹${summary.totalExpenses} है।`;
        break;

      default:
        answer =
          `आपने ${person.name} को कुल ₹${
            summary.totalGiven + summary.totalLoansGiven
          } दिए हैं, जिनमें से ₹${summary.totalLoansGiven} उधार के रूप में दिए गए हैं।`;
    }

    setMessage(answer);
    speak(answer);
    return true;
  }

  return false;
};

  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;

    const speech = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const hindiVoices = voices.filter((voice) =>
      /^hi(-|_)?in$/i.test(voice.lang) || /^hi\b/i.test(voice.lang)
    );
    // Prefer a Hindi/India voice; available voices depend on the user's device.
    const preferredVoice =
      hindiVoices.find((voice) => /google.*hindi|hindi.*google/i.test(voice.name)) ||
      hindiVoices.find((voice) => /india|hindi/i.test(voice.name)) ||
      hindiVoices[0];

    if (preferredVoice) speech.voice = preferredVoice;
    speech.lang = preferredVoice?.lang || "hi-IN";
    speech.rate = 0.94;
    speech.pitch = 1.02;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("इस ब्राउज़र में आवाज़ पहचानने की सुविधा उपलब्ध नहीं है। कृपया Chrome या किसी समर्थित ब्राउज़र का उपयोग करें।");
      return;
    }

    const recognition = new SpeechRecognition();

    window.speechSynthesis?.cancel?.();
    setProcessing(false);
    recognition.lang = "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setProcessing(false);
      setMessage("");
    };

    recognition.onresult = async (event) => {
      const spokenText = event.results[0][0].transcript;

      setText(spokenText);
      setProcessing(true);

      try {
        const response = await parseWithBackend(spokenText);

        if (!response.success) {
          setMessage("AI से जवाब नहीं मिल पाया। कृपया दोबारा कोशिश करें।");
          speak("ए आई से जवाब नहीं मिल पाया। कृपया दोबारा कोशिश करें।");
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

              answer = `आज आपका कुल खर्च ₹${amount} है।`;
              break;
            }

            case "month_expense": {
              const amount = getThisMonthExpense(expenses);

              answer = `इस महीने आपका कुल खर्च ₹${amount} है।`;
              break;
            }

            case "total_expense": {
              const amount = getTotalExpense(expenses);

              answer = `अब तक आपका कुल खर्च ₹${amount} है।`;
              break;
            }

            case "category_expense": {
              const categoryTotals = getCategoryExpenses(expenses);

              const category = data.category || "other";
              const amount = categoryTotals[category] || 0;

              const categoryNames = {
                food: "खाने-पीने", travel: "यात्रा", fuel: "ईंधन",
                grocery: "किराने", shopping: "शॉपिंग", bills: "बिल",
                health: "स्वास्थ्य", other: "अन्य",
              };
              answer = `${categoryNames[category] || "इस श्रेणी"} पर आपका कुल खर्च ₹${amount} है।`;
              break;
            }

            case "yesterday_expense": {
              const date = getDateOffset(-1);
              const amount = getExpenseByDate(expenses, date);

              answer = `कल आपका कुल खर्च ₹${amount} था।`;
              break;
            }

            case "day_before_yesterday_expense": {
              const date = getDateOffset(-2);
              const amount = getExpenseByDate(expenses, date);

              answer = `परसों आपका कुल खर्च ₹${amount} था।`;
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

  answer = `अब तक आपकी कुल आय ₹${amount} है।`;
  break;
}

case "month_income": {
  const incomes = await loadIncomes();
  const amount = getThisMonthIncome(incomes);

  answer = `इस महीने आपकी कुल आय ₹${amount} है।`;
  break;
}

case "total_balance": {
  const incomes = await loadIncomes();
  const totalIncome = getTotalIncome(incomes);
  const totalExpense = getTotalExpense(expenses);
  const balance = totalIncome - totalExpense;

  answer = `आपकी दर्ज आय और खर्च के अनुसार कुल बैलेंस ₹${balance} है।`;
  break;
}

case "month_balance": {
  const incomes = await loadIncomes();
  const monthIncome = getThisMonthIncome(incomes);
  const monthExpense = getThisMonthExpense(expenses);
  const balance = monthIncome - monthExpense;

  answer = `इस महीने दर्ज आय और खर्च के अनुसार बैलेंस ₹${balance} है।`;
  break;
}

            default: {
              answer = "माफ़ कीजिए, मैं आपका सवाल समझ नहीं पाया। कृपया दूसरे तरीके से पूछें।";
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
            const question = "कितने रुपये मिले थे?";
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

          const sourceNames = {
            salary: "वेतन", family: "परिवार", freelance: "फ्रीलांस काम",
            business: "व्यवसाय", investment: "निवेश", other: "अन्य",
          };
          const confirmation =
            `₹${data.amount} की आय सेव हो गई है। स्रोत: ${sourceNames[source] || "अन्य"}।`;

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
            const question = "कितने रुपये खर्च हुए थे?";

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
          "माफ़ कीजिए, मैं आपकी बात समझ नहीं पाया। कृपया फिर से बोलें।";

        setMessage(unknownMessage);
        speak(unknownMessage);
      } catch (error) {
        console.error("AI parsing error:", error);

        const errorMessage =
          "आपकी जानकारी सेव नहीं हो पाई। कृपया दोबारा कोशिश करें।";

        setMessage(errorMessage);
        speak(errorMessage);
      } finally {
        setProcessing(false);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);

      setListening(false);
      setProcessing(false);
      setMessage("माफ़ कीजिए, आपकी बात साफ़ सुनाई नहीं दी। कृपया फिर से बोलें।");
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
          <span className="voice-eyebrow">आपका निजी वित्तीय सहायक</span>
          <h2>बोलिए, मैं सुन रहा हूँ</h2>
          <p className="voice-subtitle">
            हिंदी में खर्च दर्ज करें, आय जोड़ें या अपने पैसों से जुड़े सवाल पूछें।
          </p>
        </div>

        <span className={`voice-status ${listening ? "is-listening" : ""}`}>
          <span className="voice-status-dot" />
          {listening ? "सुन रहा हूँ" : processing ? "समझ रहा हूँ" : "तैयार हूँ"}
        </span>
      </div>

      <div className={`voice-orb-area ${listening ? "is-listening" : ""} ${processing ? "is-processing" : ""}`}>
        <div className="voice-orb-rings" aria-hidden="true">
          <span className="voice-ring ring-one" />
          <span className="voice-ring ring-two" />
          <span className="voice-ring ring-three" />
        </div>

        <button
          type="button"
          className={`voice-mic-button ${listening ? "is-listening" : ""} ${processing ? "is-processing" : ""}`}
          onClick={startListening}
          disabled={listening || processing}
          aria-label={listening ? "Listening to your voice" : processing ? "Understanding your command" : "Start voice assistant"}
        >
          <span className="voice-orb-glow" />
          <span className="voice-mic-icon" aria-hidden="true">
            {listening ? "〰" : processing ? "✦" : "🎙"}
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
          ? "बोलिए, मैं सुन रहा हूँ…"
          : processing
            ? "आपकी बात समझी जा रही है…"
            : "माइक दबाएँ और हिंदी में बोलें"}
      </p>

      <div className="voice-transcript">
        <span className="transcript-label">आपने कहा</span>
        <p>{text || "उदाहरण: मैंने चाय पर पचास रुपये खर्च किए"}</p>
      </div>

      {message && (
        <div className="voice-response" role="status" aria-live="polite">
          <span className="response-icon">✦</span>
          <p>{message}</p>
        </div>
      )}


    </div>
  );
}

export default VoiceInput;