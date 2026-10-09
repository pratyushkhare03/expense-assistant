export const parserTestCases = [
  {
    input: "मैंने चाय पर पचास रुपये खर्च किए",
    expectedAmount: 50,
    expectedCategory: "food",
  },
  {
    input: "मैंने पेट्रोल पर पांच सौ रुपये खर्च किए",
    expectedAmount: 500,
    expectedCategory: "fuel",
  },
  {
    input: "ऑटो में एक सौ बीस रुपये खर्च किए",
    expectedAmount: 120,
    expectedCategory: "travel",
  },
  {
    input: "मैंने किराने पर दो सौ पचास रुपये खर्च किए",
    expectedAmount: 250,
    expectedCategory: "grocery",
  },
  {
    input: "मैंने चाय पर ढाई सौ रुपये खर्च किए",
    expectedAmount: 250,
    expectedCategory: "food",
  },
];