import { parseHindiNumber } from "./hindiNumberParser";

const tests = [
  ["पचास", 50],
  ["एक सौ पच्चीस", 125],
  ["दो सौ पचास", 250],
  ["पांच सौ", 500],
  ["एक हजार", 1000],
  ["एक हजार दो सौ पचास", 1250],
  ["ढाई सौ", 250],
  ["डेढ़ सौ", 150],
];

tests.forEach(([input, expected]) => {
  const result = parseHindiNumber(input);

  console.log(
    input,
    "=>",
    result,
    result === expected ? "✅ PASS" : `❌ EXPECTED ${expected}`
  );
});