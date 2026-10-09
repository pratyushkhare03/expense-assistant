export const extractDescription = (text, category) => {
  let description = text.trim();

  // Remove common expense phrases
  description = description
    .replace(
      /मैंने|maine|मैंने\s+|maine\s+/gi,
      ""
    )
    .replace(
      /पर|में|के लिए|ke liye|par|mein/gi,
      " "
    )
    .replace(
      /खर्च\s*(किए|किया|हुए|हुआ)?/gi,
      " "
    )
    .replace(
      /खर्च\s*कर\s*दिए/gi,
      " "
    )
    .replace(
      /रुपये|रुपए|रुपया|rs\.?|inr|₹/gi,
      " "
    )
    .replace(/\d+(?:\.\d+)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove Hindi number words
  const numberWords =
    "शून्य एक दो तीन चार पांच पाँच छह छः सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह पन्द्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस चालीस पचास साठ सत्तर अस्सी नब्बे सौ हजार हज़ार लाख करोड़";

  const numberRegex = new RegExp(
    `\\b(${numberWords.split(" ").join("|")})\\b`,
    "gi"
  );

  description = description
    .replace(numberRegex, " ")
    .replace(/\s+/g, " ")
    .trim();

  return description || category;
};