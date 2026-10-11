import { useState } from "react";
import { addExpense, getAllExpenses } from "../db/expenseDB";
import { getLocalDate } from "../utils/dateUtils";
import { parseWithBackend } from "../services/aiService";
import { extractDescription } from "../utils/descriptionParser";
import { addIncome, getAllIncome } from "../db/incomeDB";

import {
  addPersonExpense,
  addPersonTransaction,
  getAllPeople,
  getPersonReport,
} from "../db/personLedgerDB";

import {
  answerQuery,
  describeRecordDate,
  resolvePeriod,
} from "../utils/queryEngine";

import { formatExpenseResponse } from "../utils/responseFormatter";

const ALLOWED_CATEGORIES = [
  "food",
  "travel",
  "fuel",
  "grocery",
  "shopping",
  "bills",
  "health",
  "other",
];

const ALLOWED_INCOME_SOURCES = [
  "salary",
  "family",
  "freelance",
  "business",
  "investment",
  "other",
];

function VoiceInput({ onExpenseAdded }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const reply = (answer) => {
    setMessage(answer);
    speak(answer);
  };

  // ---------------------------------------------------------------------
  // Person commands
  // ---------------------------------------------------------------------

  const handlePersonCommand = async (data, spokenText) => {
    if (data.type === "person_transaction") {
      const transactionType = data.transactionType;
      // The date the user actually spoke ("कल", "5 अक्टूबर"...), else today.
      const recordDate = data.date || getLocalDate();
      const dateNote = describeRecordDate(recordDate);
      const dateSuffix = dateNote ? ` तारीख: ${dateNote}।` : "";

      if (transactionType === "expense") {
        // One atomic write: the expense (so Home/Dashboard/History count it)
        // and the person-ledger entry, linked so edits/deletes stay in sync.
        await addPersonExpense({
          personName: data.personName,
          amount: data.amount,
          category: data.category || "other",
          description: `${extractDescription(spokenText, data.category || "other")} (Person: ${data.personName})`,
          date: recordDate,
        });

        await onExpenseAdded?.();
      } else {
        await addPersonTransaction({
          personName: data.personName,
          amount: data.amount,
          type: transactionType,
          description: spokenText,
          date: recordDate,
        });
      }

      const confirmations = {
        given: `₹${data.amount} ${data.personName} को दे दिए गए हैं। हिसाब अपडेट कर दिया गया है।`,
        received: `₹${data.amount} ${data.personName} से मिलने का रिकॉर्ड सेव हो गया है।`,
        loan_given: `${data.personName} को ₹${data.amount} उधार दिए गए हैं। इसे सामान्य खर्च में नहीं जोड़ा गया है।`,
        loan_repayment: `${data.personName} से ₹${data.amount} उधार वापस मिलने का रिकॉर्ड अपडेट हो गया है।`,
        expense: `${data.personName} से संबंधित ₹${data.amount} का खर्च सेव हो गया है।`,
      };

      reply(
        (confirmations[transactionType] ||
          "व्यक्ति से जुड़ा लेन-देन सेव हो गया है।") + dateSuffix
      );
      return true;
    }

    if (data.type === "person_query") {
      const period = resolvePeriod(data);
      const range = period ? { start: period.start, end: period.end } : {};
      const when = period ? `${period.label} ` : "";

      // Combines every saved record of this person (all spellings) and sums
      // every entry: this is the "total expense for <person>" answer.
      const report = await getPersonReport(data.personName, range);

      if (!report.found) {
        reply(
          `${data.personName} का हिसाब नहीं मिला। पहले उनका कोई लेन-देन रिकॉर्ड करें।`
        );
        return true;
      }

      const { summary } = report;
      const name = report.people[0].name;
      let answer;

      switch (data.metric) {
        case "loan_outstanding":
          answer = `${name} का बाकी उधार ₹${summary.loanOutstanding} है।`;
          break;

        case "received":
          answer = `${when}${name} से कुल ₹${
            summary.totalReceived + summary.totalLoanRepayments
          } प्राप्त हुए हैं।`;
          break;

        case "expense":
          answer =
            summary.expenseCount === 0
              ? `${when}${name} से संबंधित कोई खर्च दर्ज नहीं है।`
              : `${when}${name} से संबंधित कुल खर्च ₹${summary.totalExpenses} है (${summary.expenseCount} एंट्री)।`;
          break;

        default: {
          // "ko ... diye" entries are saved as person expenses, so they count
          // as money given along with loans.
          const given = summary.totalExpenses + summary.totalLoansGiven;
          answer = `${when}आपने ${name} को कुल ₹${given} दिए हैं, जिनमें से ₹${summary.totalLoansGiven} उधार के रूप में दिए गए हैं।`;
        }
      }

      reply(answer);
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
        // Saved people let the parser recognise "शिवम का कुल खर्च" as a
        // question about Shivam rather than guessing a name from word order.
        const knownPeople = await getAllPeople();
        const response = await parseWithBackend(spokenText, { knownPeople });

        if (!response.success) {
          reply("AI से जवाब नहीं मिल पाया। कृपया दोबारा कोशिश करें।");
          return;
        }

        const data = response.data;

        // Person transactions and person-specific queries must be handled
        // before the generic query/income/expense paths.
        if (await handlePersonCommand(data, spokenText)) {
          return;
        }

        // =========================
        // QUERY HANDLING
        // =========================

        if (data.type === "query") {
          // Read fresh records so an answer never misses something that was
          // just saved (the `expenses` prop can be a render behind).
          const [allExpenses, allIncomes] = await Promise.all([
            getAllExpenses(),
            getAllIncome(),
          ]);

          reply(
            answerQuery({
              data,
              expenses: allExpenses,
              incomes: allIncomes,
            })
          );
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
            reply("कितने रुपये मिले थे?");
            return;
          }

          const source = ALLOWED_INCOME_SOURCES.includes(data.source)
            ? data.source
            : "other";

          const recordDate = data.date || getLocalDate();

          await addIncome({
            amount: data.amount,
            source,
            description: spokenText,
            paymentMethod: "other",
            date: recordDate,
          });

          const sourceNames = {
            salary: "वेतन", family: "परिवार", freelance: "फ्रीलांस काम",
            business: "व्यवसाय", investment: "निवेश", other: "अन्य",
          };
          const dateNote = describeRecordDate(recordDate);

          reply(
            `₹${data.amount} की आय सेव हो गई है। स्रोत: ${sourceNames[source] || "अन्य"}।` +
              (dateNote ? ` तारीख: ${dateNote}।` : "")
          );

          // expenses aur income dono reload karta hai.
          await onExpenseAdded?.();
          return;
        }

        // =========================
        // EXPENSE HANDLING
        // =========================

        if (data.type === "expense") {
          if (
            typeof data.amount !== "number" ||
            !Number.isFinite(data.amount) ||
            data.amount <= 0
          ) {
            reply("कितने रुपये खर्च हुए थे?");
            return;
          }

          const category = ALLOWED_CATEGORIES.includes(data.category)
            ? data.category
            : "other";

          // "कल", "5 अक्टूबर", "सोमवार को"... else today.
          const recordDate = data.date || getLocalDate();

          await addExpense({
            amount: data.amount,
            category,
            description: extractDescription(spokenText, category),
            paymentMethod: "other",
            date: recordDate,
          });

          reply(
            formatExpenseResponse(
              data.amount,
              category,
              describeRecordDate(recordDate)
            )
          );

          await onExpenseAdded?.();
          return;
        }

        // =========================
        // UNKNOWN INPUT
        // =========================

        reply("माफ़ कीजिए, मैं आपकी बात समझ नहीं पाया। कृपया फिर से बोलें।");
      } catch (error) {
        console.error("AI parsing error:", error);
        reply("आपकी जानकारी सेव नहीं हो पाई। कृपया दोबारा कोशिश करें।");
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