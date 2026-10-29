export const SECTIONS = [
  {
    key: "produce",
    label: "Fruit & veg",
    words: [
      "apple", "pineapple", "banana", "orange", "lemon", "lime", "grape", "grapefruit", "berry", "strawberry",
      "blueberry", "raspberry",
      "tomato", "potato", "onion", "garlic", "carrot", "cucumber", "pepper", "lettuce", "salad", "spinach",
      "avocado", "mushroom", "broccoli", "cauliflower", "cabbage", "herb", "parsley", "dill", "basil",
      "ginger", "zucchini", "courgette", "eggplant", "aubergine", "pear", "melon", "peach", "plum", "kiwi",
    ],
  },
  {
    key: "bakery",
    label: "Bakery",
    words: ["bread", "baguette", "bun", "croissant", "bagel", "tortilla", "wrap", "cake", "muffin", "pita", "donut", "dough"],
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
      "wrapping paper", "tea towel",
    ],
  },
  {
    key: "personal",
    label: "Personal care",
    words: [
      "shampoo", "conditioner", "toothpaste", "toothbrush", "deodorant", "razor", "lotion", "sunscreen",
      "tissue", "soap", "vitamin", "medicine", "plaster", "cod liver oil",
    ],
  },
  { key: "other", label: "Other", words: [] },
];

export const DEFAULT_SECTION = "other";

const sectionsByKey = new Map(SECTIONS.map((section) => [section.key, section]));
const fallbackSection = SECTIONS.find((section) => section.key === DEFAULT_SECTION) ?? SECTIONS[0];

// These describe how something is kept rather than what it is, so they decide the section wherever they appear.
const STORAGE_WORDS = new Set(["frozen", "canned", "tinned"]);

// A keyword matches whole words, plus plurals ("tomatoes", "berries").
function keywordPattern(word) {
  const stem = word.endsWith("y") ? `${word.slice(0, -1)}(?:y|ies)` : `${word}(?:s|es)?`;
  return new RegExp(`(?<!\\p{L})${stem}(?!\\p{L})`, "gu");
}

const keywords = SECTIONS.flatMap((section) =>
  section.words.map((word) => ({ word, key: section.key, pattern: keywordPattern(word) })),
);

export function sectionLabel(key) {
  return (sectionsByKey.get(key) ?? fallbackSection).label;
}

export function isKnownSection(key) {
  return sectionsByKey.has(key);
}

// The keyword nearest the end of the name wins, as that's usually what the item is ("peppermint tea", "chicken
// soup"). When two end in the same place the longer one wins ("peanut butter" over "butter").
export function guessSection(name) {
  const text = name.toLocaleLowerCase();
  let best = { key: DEFAULT_SECTION, rank: [-1, -1, -1] };
  for (const { word, key, pattern } of keywords) {
    for (const match of text.matchAll(pattern)) {
      const rank = [STORAGE_WORDS.has(word) ? 1 : 0, match.index + match[0].length, word.length];
      if (outranks(rank, best.rank)) best = { key, rank };
    }
  }
  return best.key;
}

function outranks(a, b) {
  const index = a.findIndex((value, i) => value !== b[i]);
  return index !== -1 && a[index] > b[index];
}

export function orderedSections(savedOrder = []) {
  const known = savedOrder.filter(isKnownSection);
  const missing = SECTIONS.map((section) => section.key).filter((key) => !known.includes(key));
  return [...new Set([...known, ...missing])];
}
