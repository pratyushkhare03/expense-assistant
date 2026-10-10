const monthNames = [
  "जनवरी",
  "फ़रवरी",
  "मार्च",
  "अप्रैल",
  "मई",
  "जून",
  "जुलाई",
  "अगस्त",
  "सितंबर",
  "अक्टूबर",
  "नवंबर",
  "दिसंबर",
];

export const formatDateForUser = (dateString) => {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) {
    return dateString;
  }

  return `${day} ${monthNames[month - 1]}`;
};

export const formatCategory = (category) => {
  const categories = {
    food: "खाने-पीने",
    travel: "यात्रा",
    fuel: "ईंधन",
    grocery: "किराने",
    shopping: "शॉपिंग",
    bills: "बिल",
    health: "स्वास्थ्य",
    other: "अन्य",
  };

  return categories[category] || category;
};

export const formatExpenseResponse = (amount, category) => {
  const categoryName = formatCategory(category);

  return `₹${amount} का ${categoryName} से जुड़ा खर्च सेव कर दिया गया है।`;
};

export const formatDateExpenseResponse = (date, amount) => {
  const formattedDate = formatDateForUser(date);

  return `${formattedDate} को आपका कुल खर्च ₹${amount} था।`;
};