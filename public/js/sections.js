export const SECTIONS = [
  {
    key: "produce",
    label: "Fruit & veg",
    words: [
      "apple", "pineapple", "banana", "orange", "lemon", "lime", "grape", "berr", "strawberr", "blueberr",
      "tomato", "potato", "onion", "garlic", "carrot", "cucumber", "pepper", "lettuce", "salad", "spinach",
      "avocado", "mushroom", "broccoli", "cauliflower", "cabbage", "herb", "parsley", "dill", "basil",
      "ginger", "zucchini", "courgette", "eggplant", "aubergine", "pear", "melon", "peach", "plum", "kiwi",
    ],
  },
  {
    key: "bakery",
    label: "Bakery",
    words: ["bread", "baguette", "bun", "croissant", "bagel", "tortilla", "wrap", "cake", "muffin", "pita", "donut"],
  },
  {
    key: "dairy",
    label: "Dairy & eggs",
    words: [
      "milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "egg", "kefir", "curd", "mozzarella",
      "parmesan", "feta", "cottage", "sour cream",
    ],
  },
  {
    key: "meat",
    label: "Meat & fish",
    words: [
      "chicken", "beef", "pork", "lamb", "turkey", "mince", "sausage", "bacon", "ham", "salami", "fish",
      "salmon", "tuna", "shrimp", "prawn", "cod", "steak",
    ],
  },
  {
    key: "frozen",
    label: "Frozen",
    words: ["frozen", "ice cream", "pizza", "fries", "ice"],
  },
  {
    key: "pantry",
    label: "Pantry",
    words: [
      "pasta", "spaghetti", "rice", "flour", "sugar", "salt", "oil", "vinegar", "sauce", "ketchup", "mayo",
      "mustard", "bean", "lentil", "chickpea", "cereal", "oat", "honey", "jam", "spice", "stock", "soup",
      "noodle", "coffee", "tea", "peanut butter", "canned", "tinned",
    ],
  },
  {
    key: "snacks",
    label: "Snacks",
    words: ["chips", "crisps", "chocolate", "biscuit", "cookie", "cracker", "nuts", "popcorn", "candy", "sweets"],
  },
  {
    key: "drinks",
    label: "Drinks",
    words: [
      "water", "juice", "orange juice", "apple juice", "soda", "cola", "beer", "wine", "lemonade", "sparkling",
      "coconut water",
    ],
  },
  {
    key: "household",
    label: "Household",
    words: [
      "toilet paper", "paper towel", "kitchen roll", "detergent", "dish soap", "washing", "sponge", "bin bag",
      "trash bag", "foil", "cling film", "battery", "batteries", "bulb", "cleaner", "bleach", "napkin",
    ],
  },
  {
    key: "personal",
    label: "Personal care",
    words: [
      "shampoo", "conditioner", "toothpaste", "toothbrush", "deodorant", "razor", "lotion", "sunscreen",
      "tissue", "soap", "vitamin", "medicine", "plaster",
    ],
  },
  { key: "other", label: "Other", words: [] },
];

export const DEFAULT_SECTION = "other";

const sectionsByKey = new Map(SECTIONS.map((section) => [section.key, section]));
const fallbackSection = SECTIONS.find((section) => section.key === DEFAULT_SECTION) ?? SECTIONS[0];

const keywords = SECTIONS
  .flatMap((section) => section.words.map((word) => ({ word, key: section.key })))
  .sort((a, b) => b.word.length - a.word.length);

export function sectionLabel(key) {
  return (sectionsByKey.get(key) ?? fallbackSection).label;
}

export function isKnownSection(key) {
  return sectionsByKey.has(key);
}

export function guessSection(name) {
  const text = name.toLocaleLowerCase();
  const match = keywords.find(({ word }) => new RegExp(`(^|[^\\p{L}])${word}`, "u").test(text));
  return match?.key ?? DEFAULT_SECTION;
}

export function orderedSections(savedOrder = []) {
  const known = savedOrder.filter(isKnownSection);
  const missing = SECTIONS.map((section) => section.key).filter((key) => !known.includes(key));
  return [...new Set([...known, ...missing])];
}
