const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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
    food: "khaane",
    travel: "travel",
    fuel: "petrol/fuel",
    grocery: "grocery",
    shopping: "shopping",
    bills: "bills",
    health: "health",
    other: "other",
  };

  return categories[category] || category;
};

export const formatExpenseResponse = (amount, category) => {
  const categoryName = formatCategory(category);

  return `₹${amount} ${categoryName} ke expense mein save kar diya.`;
};

export const formatDateExpenseResponse = (date, amount) => {
  const formattedDate = formatDateForUser(date);

  return `${formattedDate} ko tumne ₹${amount} kharch kiye.`;
};