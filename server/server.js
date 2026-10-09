const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Expense Assistant AI Server is running",
  });
});

app.post("/api/parse", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid text is required",
      });
    }

    const prompt = `
You are a strict expense parser.

Your ONLY job is to extract information from the user's EXACT input text.

You MUST NOT invent, assume, guess, or add information that is not present in the input.

USER INPUT:
"${text}"

RULES:

1. If the input describes spending money:
   type = "expense"
   intent = "record_expense"

2. Extract the EXACT numeric amount from the input.
   Example:
   "300 rupaye petrol mein lage"
   amount MUST be 300.

3. NEVER change the amount.
   NEVER use an amount from another example.
   NEVER invent an amount.

4. Extract the item/service from the user's input.
   Example:
   "300 rupaye petrol mein lage"
   description MUST be "petrol".

5. Determine category ONLY from the actual words in the input.

Categories:
- food: tea, chai, coffee, samosa, lunch, dinner, breakfast, food, restaurant, etc.
- travel: auto, taxi, uber, ola, bus, train, travel, etc.
- fuel: petrol, diesel, fuel, CNG, etc.
- grocery: grocery, vegetables, milk, fruits, etc.
- shopping: clothes, shoes, shopping, etc.
- bills: electricity, recharge, internet bill, mobile bill, etc.
- health: medicine, doctor, hospital, medical, etc.
- other: if no category can be determined.

6. If the input contains "petrol", category MUST be "fuel".
7. If the input contains "auto", category MUST be "travel".
8. If the input contains "chai", "tea", or "samosa", category MUST be "food".

9. If an amount is NOT present:
   amount = null.
   NEVER invent an amount.

10. If the input is not an expense or understandable query:
   type = "unknown"
   intent = "unknown"

11. For expense input:
   category MUST NOT be null.
   Use "other" if necessary.

12. Return ONLY the JSON requested by the response schema.

QUERY RULES:

If the user is asking about their expenses, type MUST be "query".

Use these intents:

- today_expense
  Examples:
  "Aaj kitna kharch hua?"
  "How much did I spend today?"
  "Aaj ka expense kitna hai?"

- month_expense
  Examples:
  "Is mahine kitna kharch hua?"
  "How much did I spend this month?"

- total_expense
  Examples:
  "Ab tak total kitna kharch hua?"
  "What is my total expense?"

- category_expense
  Examples:
  "Food par kitna kharch hua?"
  "Petrol par kitna gaya?"
  "How much did I spend on travel?"

For category_expense:
category MUST contain the relevant category.

Examples:

"Food par kitna kharch hua?"
→ type: query
→ category: food
→ intent: category_expense

"Petrol par kitna gaya?"
→ type: query
→ category: fuel
→ intent: category_expense

"Auto par kitna kharch hua?"
→ type: query
→ category: travel
→ intent: category_expense

"Shopping par kitna kharch hua?"
→ type: query
→ category: shopping
→ intent: category_expense

Date query intents:

- yesterday_expense
- day_before_yesterday_expense

Examples:

"Kal kitna kharch hua?"
→ type: query
→ intent: yesterday_expense

"Parso kitna kharch hua?"
→ type: query
→ intent: day_before_yesterday_expense

For a specific date query:

"1 October ko kitna kharch hua?"
→ type: query
→ intent: date_expense
→ date: "2026-10-01"

Users may use ordinal date formats such as:
"1st October"
"2nd October"
"3rd October"
"4th October"
"5th October"

Treat ordinal suffixes (st, nd, rd, th) as part of the date and return the correct date in YYYY-MM-DD format.

Examples:
"1st October ko kitna kharch hua?"
→ type: query
→ intent: date_expense
→ date: "2026-10-01"

"2nd October ko kitna kharch hua?"
→ type: query
→ intent: date_expense
→ date: "2026-10-02"

"3rd October ko kitna kharch hua?"
→ type: query
→ intent: date_expense
→ date: "2026-10-03"

"5th October ko kitna kharch hua?"
→ type: query
→ intent: date_expense
→ date: "2026-10-05"

"5 October ko kitna kharch hua?"
→ type: query
→ intent: date_expense
→ date: "2026-10-05"

Return the date in YYYY-MM-DD format.

Use the current year when the user mentions a date without a year.
Do not invent a date.

For queries:
amount MUST be null.
description can contain the original question.

Do not use information from previous requests.
Do not use information from examples to answer the current request.
Process ONLY this exact input.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,

      config: {
        responseMimeType: "application/json",

        responseSchema: {
  type: "OBJECT",
  properties: {
    type: {
      type: "STRING",
      enum: ["expense", "query", "unknown"],
    },

    amount: {
      type: "NUMBER",
      nullable: true,
    },


    category: {
      type: "STRING",
      enum: [
        "food",
        "travel",
        "fuel",
        "grocery",
        "shopping",
        "bills",
        "health",
        "other",
      ],
      nullable: true,
    },

    description: {
      type: "STRING",
      nullable: true,
    },

    intent: {
      type: "STRING",
      enum: [
        "record_expense",
        "today_expense",
        "month_expense",
        "total_expense",
        "category_expense",
        "unknown",
        "yesterday_expense",
        "day_before_yesterday_expense",
        "date_expense",
      ],
      nullable: true,
    },

    
    date: {
  type: "STRING",
  nullable: true,
},
  },

  required: [
    "type",
    "amount",
    "category",
    "description",
    "intent",
    "date",
  ],
},
      },
    });

    const result = JSON.parse(response.text);

    console.log("Input:", text);
    console.log("Gemini result:", result);

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("Gemini error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to process the request",
    });
  }
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});