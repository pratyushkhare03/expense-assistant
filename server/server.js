const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const app = express();
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.get("/", (_req, res) => {
  res.json({ message: "Expense Assistant AI Server is running" });
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["expense", "income", "query", "person_transaction", "person_query", "unknown"] },
    amount: { type: "NUMBER", nullable: true },
    category: { type: "STRING", enum: ["food", "travel", "fuel", "grocery", "shopping", "bills", "health", "other"], nullable: true },
    source: { type: "STRING", enum: ["salary", "family", "freelance", "business", "investment", "other"], nullable: true },
    description: { type: "STRING", nullable: true },
    intent: { type: "STRING", enum: ["record_expense", "record_income", "today_expense", "yesterday_expense", "day_before_yesterday_expense", "month_expense", "total_expense", "category_expense", "date_expense", "total_income", "month_income", "total_balance", "month_balance", "record_person_transaction", "person_ledger", "unknown"], nullable: true },
    date: { type: "STRING", nullable: true },
    personName: { type: "STRING", nullable: true },
    transactionType: { type: "STRING", enum: ["given", "received", "loan_given", "loan_repayment", "expense"], nullable: true },
    metric: { type: "STRING", enum: ["given", "received", "expense", "loan_outstanding"], nullable: true },
  },
  required: ["type", "amount", "category", "source", "description", "intent", "date", "personName", "transactionType", "metric"],
};

app.post("/api/parse", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 2000) {
      return res.status(400).json({ success: false, message: "Please provide a command under 2000 characters." });
    }
    if (!ai) {
      return res.status(503).json({ success: false, message: "AI service is not configured." });
    }

    const prompt = `You are the Hindi-first financial command parser for a personal expense tracker. Interpret ONLY this exact user utterance. It may be Hindi, Hinglish, or English. Understand natural wording and transliteration, but never invent missing amounts, names, dates, or facts. Return only JSON matching the schema.

USER UTTERANCE: ${JSON.stringify(text)}

INTENT RULES:
- Expense: user spent/paid money for goods/services (e.g. "आज 250 रुपये खाने पर खर्च किए", "I spent 100 on tea"). type=expense, intent=record_expense, positive numeric amount required, category from supported categories. petrol/diesel/CNG=fuel; auto/bus/train/taxi=travel; chai/tea/food=food.
- Income: money the user received/earned (e.g. "मुझे 12000 रुपये सैलरी मिली", "I received 500 from freelance work"). type=income, intent=record_income, source salary/family/freelance/business/investment/other.
- Queries: use type=query and amount=null. Supported intents: today_expense, yesterday_expense, day_before_yesterday_expense, month_expense, total_expense, category_expense, date_expense, total_income, month_income, total_balance, month_balance. For category_expense fill category. For a specific date, use YYYY-MM-DD and current year if year is omitted; if date is ambiguous, use unknown rather than guessing.
- Person transaction: examples "100 rupay Shubh ko diya" -> type=person_transaction, transactionType=given; "Shubh ne 100 rupaye diye" -> received; "Rahul ko 500 rupaye udhaar diye" -> loan_given; "Amit ne 200 rupaye udhaar wapas kiye" -> loan_repayment; "50 rupay Pragati ne kharch kiye" -> expense. Set personName and positive amount. Loan given is NOT ordinary expense; loan repayment is NOT ordinary income.
- Person queries: "Shubh ko kitne paise diye?" -> type=person_query, metric=given. For outstanding loans use metric=loan_outstanding; received from person use received; person-related spending use expense. Set personName and amount=null.
- Do not classify a question about spending as a new expense. Do not confuse "mujhe paise mile" (income) with an expense. If required information for recording a transaction is absent or the utterance is not understood, use type=unknown.
- Always preserve the actual amount as spoken. Hindi number words must be interpreted carefully. No amount -> null.
- Descriptions should be concise and based only on the user's words. Keep category and source in their exact allowed enum.
- Use natural interpretation, but do not return an answer to a financial query; return the structured intent for the app to calculate from the user's saved records.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema },
    });

    const data = JSON.parse(response.text);
    const validTypes = ["expense", "income", "query", "person_transaction", "person_query", "unknown"];
    if (!validTypes.includes(data.type)) data.type = "unknown";
    if (["expense", "income", "person_transaction"].includes(data.type) && (!Number.isFinite(data.amount) || data.amount <= 0)) {
      data.type = "unknown";
      data.amount = null;
      data.intent = "unknown";
    }
    if (["person_transaction", "person_query"].includes(data.type) && !String(data.personName || "").trim()) {
      data.type = "unknown";
      data.intent = "unknown";
    }
    if (data.type === "person_transaction" && !["given", "received", "loan_given", "loan_repayment", "expense"].includes(data.transactionType)) {
      data.type = "unknown";
      data.intent = "unknown";
      data.amount = null;
    }
    if (data.type === "income" && !["salary", "family", "freelance", "business", "investment", "other"].includes(data.source)) data.source = "other";
    if (data.type === "expense" && !["food", "travel", "fuel", "grocery", "shopping", "bills", "health", "other"].includes(data.category)) data.category = "other";
    res.json({ success: true, data });
  } catch (error) {
    console.error("Gemini parsing error:", error.message);
    res.status(500).json({ success: false, message: "The voice command could not be understood right now." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
