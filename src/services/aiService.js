import { parseHindiNumber } from "../utils/hindiNumberParser";
import { parseDateQuery } from "../utils/dateParser";

const detectCategory = (text) => {
  const lower = text.toLowerCase();

  if (
    lower.includes("चाय") ||
    lower.includes("खाना") ||
    lower.includes("खाने") ||
    lower.includes("नाश्ता") ||
    lower.includes("दूध") ||
    lower.includes("समोसा") ||
    lower.includes("food") ||
    lower.includes("tea") ||
    lower.includes("coffee")
  ) {
    return "food";
  }

  if (
    lower.includes("पेट्रोल") ||
    lower.includes("डीजल") ||
    lower.includes("fuel")
  ) {
    return "fuel";
  }

  
if (
  lower.includes("किराना") ||
  lower.includes("किराने") ||
  lower.includes("किराने का") ||
  lower.includes("सब्जी") ||
  lower.includes("सब्ज़ी") ||
  lower.includes("सब्जियों") ||
  lower.includes("राशन") ||
  lower.includes("grocery") ||
  lower.includes("groceries")
) {
  return "grocery";
}

  if (
    lower.includes("कपड़े") ||
    lower.includes("शॉपिंग") ||
    lower.includes("shopping")
  ) {
    return "shopping";
  }

  if (
    lower.includes("बिल") ||
    lower.includes("बिजली") ||
    lower.includes("रिचार्ज") ||
    lower.includes("bill") ||
    lower.includes("recharge")
  ) {
    return "bills";
  }

  if (
    lower.includes("ऑटो") ||
    lower.includes("बस") ||
    lower.includes("ट्रेन") ||
    lower.includes("टैक्सी") ||
    lower.includes("travel") ||
    lower.includes("auto") ||
    lower.includes("taxi")
  ) {
    return "travel";
  }

  if (
    lower.includes("दवा") ||
    lower.includes("अस्पताल") ||
    lower.includes("मेडिसिन") ||
    lower.includes("medicine")
  ) {
    return "health";
  }

  return "other";
};

const cleanPersonName = (name = "") =>
  name
    .trim()
    .replace(/^[,.\s]+|[,.\s?!]+$/g, "")
    .replace(/\s+/g, " ");

const extractPersonName = (text) => {
  const patterns = [
    // "100 rupay xyz ko diya"
    /(?:रुपये?|रुपए|रुपया|rupees?|rupay|rs\.?)\s+(.+?)\s+को(?=\s|$)/i,

    // "50 rupay xyz ne kharch kiye"
    /(?:रुपये?|रुपए|रुपया|rupees?|rupay|rs\.?)\s+(.+?)\s+ने(?=\s|$)/i,

    // "Rahul ko 500 rupaye udhaar diye"
    /^(.+?)\s+को(?=\s|$)/i,

    /^(.+?)\s+(?:पर|पे|par|pe)(?=\s|$)/i,

    // "Amit ne 200 rupaye udhaar wapas kiye"
    /^(.+?)\s+ने(?=\s|$)/i,

    // "Shubh ko kitne paise diye?"
    /^(.+?)\s+को\s+(?:कितने|कितना|कितनी|kitne|kitna|kitni|how much)(?=\s|$)/i,

    // "Rahul ka kitna udhaar baaki hai?"
    /^(.+?)\s+का\s+/i,
    /^(.+?)\s+की\s+/i,
    /^(.+?)\s+के\s+/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const name = match[1]
        .trim()
        .replace(/^[,.\s]+|[,.\s?!]+$/g, "")
        .replace(/\s+/g, " ");

      if (
        name &&
        !/^(मैंने|मैं|mujhe|maine|mere|my|kitna|kitne|kitni|how much)$/i.test(name)
      ) {
        return name;
      }
    }
  }

  return null;
};


const parsePersonCommand = (text) => {
  const lower = text.toLowerCase().trim();
  const amount = parseHindiNumber(text);

  const asksQuestion =
    /कितना|कितनी|कितने|बताओ|बताना|बता दो|kitna|kitni|kitne|batao|how much|how many|कितना बाकी|कितना बकाया/i.test(
      lower
    );

  const mentionsPerson =
    /\bको\b|\bने\b|\bसे\b|\bका\b|\bकी\b|\bके\b/.test(text) ||
    /\bko\b|\bne\b|\bse\b|\bka\b|\bki\b|\bke\b/i.test(text);

  if (!mentionsPerson) {
    return null;
  }

  const personName = extractPersonName(text);

  if (!personName) {
    return null;
  }

  // Person-specific questions must be detected before generic questions.
  if (asksQuestion) {
    let metric = "given";

    if (
      /उधार|उधार|बकाया|बाकी|loan|outstanding|due/i.test(lower)
    ) {
      metric = "loan_outstanding";
    } else if (
      /मुझसे|मुझे मिले|मिले थे|मिला था|प्राप्त|received|from\b|se kitne paise mile/i.test(
        lower
      )
    ) {
      metric = "received";
    } else if (
  /खर्च|खर्चे|खर्चा|खर्च हुए|खर्च हुआ|spent|expense/i.test(lower)
) {
  metric = "expense";
}

    return {
      type: "person_query",
      personName,
      metric,
      intent: "person_ledger",
    };
  }

  if (amount === null || amount <= 0) {
    return null;
  }

  // Loan repayment: "Amit ne 200 rupaye udhaar wapas kiye"
  if (
    /उधार.*(वापस|लौटा|चुका|चुकाया)|loan.*(repaid|returned|paid back)|udhaar.*(wapas|lautaya)|wapas.*udhaar/i.test(
      lower
    )
  ) {
    return {
      type: "person_transaction",
      personName,
      amount,
      transactionType: "loan_repayment",
      intent: "record_person_transaction",
    };
  }

  // Loan given: "Rahul ko 500 rupaye udhaar diye"
  if (
    /उधार|उधार|loan|udhaar/i.test(lower) &&
    /(दिया|दिए|दी|दे दिए|दिया था|दिए थे|diye|diya|de diye|lent|gave)/i.test(
      lower
    )
  ) {
    return {
      type: "person_transaction",
      personName,
      amount,
      transactionType: "loan_given",
      intent: "record_person_transaction",
    };
  }

  // Person-associated expense: "50 rupay Pragati ne kharch kiye"
  if (
    /खर्च|खर्चे|खर्चा|spent|expense|खरीदा|खरीदी/i.test(lower)
  ) {
    return {
      type: "person_transaction",
      personName,
      amount,
      transactionType: "expense",
      intent: "record_person_transaction",
    };
  }

  // Money given: "100 rupay Shubh ko diya"
  // "10 rupaye Shivam ko diye" = person-associated expense
if (
  /(?:^|\s)(?:को|ko)(?=\s|$|[?!,.])/iu.test(text) &&
  /(दिया|दिए|दी|दे दिए|diya|diye|de diye|gave|paid|transfer)/i.test(
    lower
  )
) {
  return {
    type: "person_transaction",
    personName,
    amount,
    transactionType: "expense",
    category: detectCategory(text),
    intent: "record_person_transaction",
  };
}

  // Money received: "Shubh ne 100 rupaye diye"
  if (
  /(?:^|\s)(?:ने|ne)(?=\s|$|[?!,.])/iu.test(text) &&
  /(दिया|दिए|दी|मिले|मिला|मिली|received|mila|mili|diye|diya)/i.test(
    lower
  )
) {
  return {
    type: "person_transaction",
    personName,
    amount,
    transactionType: "received",
    intent: "record_person_transaction",
  };
}

  return null;
};

const detectIncomeSource = (text) => {
  const lower = text.toLowerCase();

  if (
    lower.includes("salary") ||
    lower.includes("सैलरी") ||
    lower.includes("वेतन")
  ) {
    return "salary";
  }

  if (
    lower.includes("freelance") ||
    lower.includes("फ्रीलांस")
  ) {
    return "freelance";
  }

  if (
    lower.includes("business") ||
    lower.includes("बिजनेस") ||
    lower.includes("व्यापार")
  ) {
    return "business";
  }

  if (
    lower.includes("investment") ||
    lower.includes("निवेश")
  ) {
    return "investment";
  }

  if (
    lower.includes("पापा") ||
    lower.includes("पिता") ||
    lower.includes("मम्मी") ||
    lower.includes("मां") ||
    lower.includes("माँ") ||
    lower.includes("मिले") ||
    lower.includes("मिला") ||
    lower.includes("मिली") ||
    lower.includes("received")
  ) {
    return "family";
  }

  return "other";
};

const isIncomeStatement = (text) => {
  const lower = text.toLowerCase();

  // Expense-related statements must not become income.
  const expenseWords = [
    "खर्च",
    "खरीदा",
    "खरीदी",
    "दिया",
    "दिए",
    "paid",
    "spent",
    "expense",
  ];

  if (expenseWords.some((word) => lower.includes(word))) {
    return false;
  }

  const incomePatterns = [
    "मिले",
    "मिला",
    "मिली",
    "प्राप्त हुए",
    "प्राप्त हुआ",
    "सैलरी",
    "वेतन",
    "salary",
    "freelance",
    "फ्रीलांस",
    "business income",
    "investment income",
    "received",
    "income",
    "कमाई हुई",
  ];

  return incomePatterns.some((pattern) =>
    lower.includes(pattern)
  );
};

const isQuery = (text) => {
  const lower = text.toLowerCase().trim();

  // Explicit question patterns
  const questionPatterns = [
    "कितना खर्च",
    "कितने खर्च",
    "कितना खर्ज",
    "कितना पैसा",
    "कितनी रकम",
    "kitna kharch",
    "kitne kharch",
    "how much",
    "total expense",
    "expense kitna",
    
"कुल income",
"कुल इनकम",
"कितनी income",
"कितनी इनकम",
"इस महीने income",
"इस महीने इनकम",
"कितने पैसे बचे",
"कितना balance",
"कितना बैलेंस",
"कुल balance",
"कुल बैलेंस",
"इस महीने कितने पैसे बचे",
"monthly balance",
"total income",
"total balance",
"how much income",

"saved overall",
"how much have i saved",
"how much money have i saved",
"my savings",
"total savings",
"overall savings",
"money left",
"how much money is left",
"kitne paise bache",
"kitna paisa bacha",
"meri bachat",
"kul bachat",
  ];

  if (questionPatterns.some((pattern) => lower.includes(pattern))) {
    return true;
  }

  // Other clear question patterns
  const questionWords = [
    "कितना",
    "कितनी",
    "कितने",
    "बताओ",
    "batao",
    "how much",
    "how many",
  ];

  return questionWords.some((word) => lower.includes(word));
};


const detectQueryIntent = (text) => {
  const lower = text.toLowerCase().trim();

  // 1. Monthly balance — check first
  if (
    lower.includes("monthly balance") ||
    lower.includes("month balance") ||
    lower.includes("इस महीने कितने पैसे बचे") ||
    lower.includes("इस महीने कितना बैलेंस") ||
    lower.includes("इस महीने का बैलेंस") ||
    lower.includes("इस महीने का balance")
  ) {
    return "month_balance";
  }


  // Savings and balance queries
  if (
    lower.includes("saved overall") ||
    lower.includes("how much have i saved") ||
    lower.includes("how much money have i saved") ||
    lower.includes("my savings") ||
    lower.includes("total savings") ||
    lower.includes("overall savings") ||
    lower.includes("money left") ||
    lower.includes("how much money is left") ||
    lower.includes("kitne paise bache") ||
    lower.includes("kitna paisa bacha") ||
    lower.includes("meri bachat") ||
    lower.includes("kul bachat")
  ) {
    return "total_balance";
  }
// Total balance — check before income and expense rules
if (
  lower.includes("total balance") ||
  lower.includes("overall balance") ||
  lower.includes("balance") ||
  lower.includes("बैलेंस") ||
  lower.includes("बचे") ||
  lower.includes("शेष राशि") ||
  lower.includes("कुल बचत") ||
  lower.includes("टोटल बैलेंस") ||
lower.includes("कुल बैलेंस") ||
lower.includes("कितना बैलेंस")
) {
  return "total_balance";
}



  // 3. Monthly income
  if (
    lower.includes("monthly income") ||
    lower.includes("month income") ||
    lower.includes("this month income") ||
    lower.includes("इस महीने income") ||
    lower.includes("इस महीने इनकम") ||
    lower.includes("इस महीने की इनकम") ||
    lower.includes("इस महीने कितनी कमाई") ||
    lower.includes("इस महीने की कमाई")
  ) {
    return "month_income";
  }

  // 4. Total income — Hindi and English
  if (
    lower.includes("income") ||
    lower.includes("इनकम") ||
    lower.includes("कमाई") ||
    lower.includes("आमदनी") ||
    lower.includes("वेतन") ||
    lower.includes("salary") ||
    lower.includes("सैलरी")
  ) {
    return "total_income";
  }

  // 5. Today's expense
  if (
    lower.includes("आज") ||
    lower.includes("aaj") ||
    lower.includes("today")
  ) {
    return "today_expense";
  }

  // 6. Day before yesterday
  if (
    lower.includes("परसों") ||
    lower.includes("परसो") ||
    lower.includes("parso") ||
    lower.includes("day before yesterday")
  ) {
    return "day_before_yesterday_expense";
  }

  // 7. Yesterday
  if (
    lower.includes("कल") ||
    lower.includes("kal") ||
    lower.includes("yesterday")
  ) {
    return "yesterday_expense";
  }

  // 8. Monthly expense
  if (
    lower.includes("इस महीने") ||
    lower.includes("इस माह") ||
    lower.includes("iss mahine") ||
    lower.includes("is mahine") ||
    lower.includes("this month")
  ) {
    return "month_expense";
  }

  // 9. Total expense
  if (
    lower.includes("कुल") ||
    lower.includes("अब तक") ||
    lower.includes("टोटल") ||
    lower.includes("total") ||
    lower.includes("overall")
  ) {
    return "total_expense";
  }

  // 10. Specific date expense
  const date = parseDateQuery(text);
  if (date) {
    return "date_expense";
  }

  // 11. Category expense
  const category = detectCategory(text);
  if (category !== "other") {
    return "category_expense";
  }

  return "unknown";
};


const parseWithGemini = async (text) => {
  try {
    const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const response = await fetch(`${API_BASE_URL}/api/parse`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text }),
});

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.message || "Invalid Gemini response");
    }

    const data = result.data;

    // Accept the full set of commands understood by the voice assistant.
    if (!["expense", "income", "query", "person_transaction", "person_query", "unknown"].includes(data.type)) {
      throw new Error("Invalid response type");
    }

    const validIntents = [
      "record_expense",
      "today_expense",
      "yesterday_expense",
      "day_before_yesterday_expense",
      "month_expense",
      "total_expense",
      "category_expense",
      "date_expense",
      "total_income",
      "month_income",
      "total_balance",
      "month_balance",
      "record_income",
      "record_person_transaction",
      "person_ledger",
      "unknown",
    ];

    if (!validIntents.includes(data.intent)) {
      data.intent = "unknown";
    }

    // Never save a transaction without a valid positive amount.
    if (
      ["expense", "income", "person_transaction"].includes(data.type) &&
      (!Number.isFinite(data.amount) || data.amount <= 0)
    ) {
      return {
        success: true,
        data: {
          type: "unknown",
          amount: null,
          category: null,
          description: text,
          intent: "unknown",
          date: null,
        },
      };
    }

    // Only allow categories supported by the application.
    const validCategories = [
      "food",
      "travel",
      "fuel",
      "grocery",
      "shopping",
      "bills",
      "health",
      "other",
    ];

    if (
      ["expense", "person_transaction"].includes(data.type) &&
      !validCategories.includes(data.category)
    ) {
      data.category = "other";
    }

    return {
      success: true,
      data: {
        ...data,
        amount: ["query", "person_query"].includes(data.type) ? null : data.amount,
        description: data.description ?? text,
        date: data.date ?? null,
      },
    };
  } catch (error) {
    console.error("Gemini fallback failed:", error.message);

    // Keep the app usable if the backend is offline.
    return {
      success: true,
      data: {
        type: "unknown",
        amount: null,
        category: null,
        description: text,
        intent: "unknown",
        date: null,
      },
    };
  }
};

export const parseWithBackend = async (text) => {
  // Send every spoken command to Gemini first so natural Hindi/Hinglish is
  // interpreted consistently. The local parser is a resilience fallback.
  const aiResult = await parseWithGemini(text);
  if (aiResult.success && aiResult.data?.type !== "unknown") return aiResult;

  const localResult = await parseLocally(text);
  if (localResult.success && localResult.data?.type !== "unknown") return localResult;
  return aiResult;
};


const parseLocally = async (text) => {
  if (!text || !text.trim()) {
    return {
      success: true,
      data: {
        type: "unknown",
        amount: null,
        category: null,
        description: null,
        intent: "unknown",
        date: null,
      },
    };
  }

  // 1. Person commands first, before generic question detection.
  const personCommand = parsePersonCommand(text);

  if (personCommand) {
    return {
      success: true,
      data: {
        ...personCommand,
        description: text,
        date: null,
      },
    };
  }

  // 2. Existing general queries.
  if (isQuery(text)) {
    const intent = detectQueryIntent(text);
    const date =
      intent === "date_expense" ? parseDateQuery(text) : null;
    const category = detectCategory(text);

    return {
      success: true,
      data: {
        type: "query",
        amount: null,
        category:
          intent === "category_expense" ? category : null,
        description: null,
        intent,
        date,
      },
    };
  }

  // 3. Existing income detection.
  if (isIncomeStatement(text)) {
    const amount = parseHindiNumber(text);

    if (amount !== null && amount > 0) {
      return {
        success: true,
        data: {
          type: "income",
          amount,
          source: detectIncomeSource(text),
          description: text,
          intent: "record_income",
          date: null,
        },
      };
    }
  }

  // 4. Existing ordinary expense detection.
  const amount = parseHindiNumber(text);

  if (amount === null || amount <= 0) {
    return {
      success: true,
      data: {
        type: "unknown",
        amount: null,
        category: null,
        description: text,
        intent: "unknown",
        date: null,
      },
    };
  }

  return {
    success: true,
    data: {
      type: "expense",
      amount,
      category: detectCategory(text),
      description: text,
      intent: "record_expense",
      date: null,
    },
  };
};