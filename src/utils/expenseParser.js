export const parseExpenseText = (text) => {
  const lowerText = text.toLowerCase();

  // Find amount
  const amountMatch = lowerText.match(
    /(?:₹|rs\.?|rupees?|inr)?\s*(\d+(?:\.\d+)?)/i
  );

  if (!amountMatch) {
    return null;
  }

  const amount = Number(amountMatch[1]);

  // Detect category
  let category = "other";

  if (
    lowerText.includes("food") ||
    lowerText.includes("tea") ||
    lowerText.includes("chai") ||
    lowerText.includes("coffee") ||
    lowerText.includes("lunch") ||
    lowerText.includes("dinner") ||
    lowerText.includes("breakfast")
  ) {
    category = "food";
  } else if (
    lowerText.includes("travel") ||
    lowerText.includes("auto") ||
    lowerText.includes("uber") ||
    lowerText.includes("ola") ||
    lowerText.includes("bus") ||
    lowerText.includes("train")
  ) {
    category = "travel";
  } else if (
    lowerText.includes("fuel") ||
    lowerText.includes("petrol") ||
    lowerText.includes("diesel")
  ) {
    category = "fuel";
  } else if (
    lowerText.includes("grocery") ||
    lowerText.includes("vegetables") ||
    lowerText.includes("milk")
  ) {
    category = "grocery";
  } else if (
    lowerText.includes("shopping") ||
    lowerText.includes("clothes")
  ) {
    category = "shopping";
  } else if (
    lowerText.includes("bill") ||
    lowerText.includes("electricity") ||
    lowerText.includes("recharge")
  ) {
    category = "bills";
  }

  return {
    amount,
    category,
    description: text,
  };
};