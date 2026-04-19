/**
 * nlpMatcher.ts  —  v4 (Robust Real-World NLP)
 *
 * Lightweight rule-based NLP engine for detecting answered loan interview questions.
 * Supports English, Hindi (Devanagari + Roman), and Marathi (Devanagari + Roman).
 *
 * Key design decisions:
 *  - Sentences are split ONLY on periods / । / semicolons — NOT commas, because Indian
 *    number formatting uses commas (e.g., 2,00,000) and splitting on them would destroy numbers.
 *  - Income and Amount questions require BOTH a domain keyword AND a number in the same sentence.
 *  - Name requires the intro phrase FOLLOWED by at least one non-whitespace word.
 *  - A proximity-window fallback catches cases where the keyword and number are in adjacent clauses.
 *  - Purpose detection uses both specific keywords AND generic "loan for <topic>" patterns.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasKeyword(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some(w => lower.includes(w.toLowerCase()));
}

function hasPattern(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/**
 * Split on sentence boundaries ONLY — NOT on commas.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[.।;?!]+|\b(?:and|but|aur|ani|so|then)\b|और|आणि|तसेच|परंतु/i)
    .map(s => s.trim())
    .filter(s => s.length > 2);
}

/**
 * Proximity check: does a keyword appear within ~120 chars of a number?
 */
function proximityMatch(text: string, keywords: string[], numberPattern: RegExp): boolean {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + kw.length + 60);
    const window = text.slice(start, end);
    if (numberPattern.test(window)) return true;
  }
  return false;
}

// ─── Numeric Patterns ─────────────────────────────────────────────────────────

const BARE_NUMBER_RE = /(?:₹|rs\.?\s*)?\d[\d,]+/i;

const DENOMINATION_RE =
  /\d+\s*(?:lakh|lac|lakhs|thousand|crore|हजार|लाख|करोड़|कोटी)/i;

const SPOKEN_NUMBERS = [
  'thousand', 'lakh', 'lac', 'crore', 'hundred',
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'हजार', 'लाख', 'करोड़', 'सौ',
  'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे',
  'कोटी', 'शंभर',
  'वीस', 'चाळीस', 'पन्नास', 'ऐंशी', 'नव्वद',
];

function hasNumericValue(text: string): boolean {
  return (
    hasPattern(text, BARE_NUMBER_RE) ||
    hasPattern(text, DENOMINATION_RE) ||
    hasKeyword(text, SPOKEN_NUMBERS)
  );
}

// ─── Q1: NAME ────────────────────────────────────────────────────────────────

function matchName(text: string): boolean {
  const namePatterns = [
    // English
    /my name is[\s,.]+\S+/i,
    /my name'?s[\s,.]+\S+/i,
    /\bi am[\s,.]+[A-Z]\S*/,
    /this is[\s,.]+\S+/i,
    /call me[\s,.]+\S+/i,
    /myself[\s,.]+\S+/i,
    /name[\s,.]+is[\s,.]+\S+/i,
    /i'?m[\s,.]+[A-Z]\S+/,
    // Hindi Devanagari
    /मेरा नाम[\s,.]+\S+/,
    /मेरा नाम है[\s,.]+\S+/,
    /मैं हूं[\s,.]+\S+/,
    /मैं हूँ[\s,.]+\S+/,
    /नाम है[\s,.]+\S+/,
    /मेरा नाम[\s,.]*\S+/,
    // Hindi Roman
    /mera naam[\s,.]+\S+/i,
    /main hun[\s,.]+\S+/i,
    /naam hai[\s,.]+\S+/i,
    // Marathi Devanagari
    /माझे नाव[\s,.]+\S+/,
    /माझं नाव[\s,.]+\S+/,
    /माझे पूर्ण नाव[\s,.]+\S+/,
    /नाव आहे[\s,.]+\S+/,
    /मी आहे[\s,.]+\S+/,
    /माझे नाव[\s,.]*\S+/,
    // Marathi Roman
    /maze nav[\s,.]+\S+/i,
    /majhe nav[\s,.]+\S+/i,
    /nav aahe[\s,.]+\S+/i,
  ];

  return namePatterns.some(p => p.test(text));
}

// ─── Q2: INCOME ──────────────────────────────────────────────────────────────

function matchIncome(text: string): boolean {
  const incomeWords = [
    // English
    'income', 'salary', 'earning', 'earn', 'wages', 'per month', 'monthly',
    'make per month', 'take home', 'package', 'ctc',
    // Hindi Devanagari
    'आय', 'तनख्वाह', 'वेतन', 'कमाई', 'तनखाह',
    // Hindi Roman
    'aay', 'tankhwa', 'vetan', 'kamaai', 'tankhah',
    // Marathi Devanagari
    'उत्पन्न', 'पगार', 'महिन्याला', 'महिना',
    // Marathi Roman
    'utpann', 'pagar', 'mahina',
  ];

  const sentenceMatch = splitSentences(text).some(s =>
    hasKeyword(s, incomeWords) && hasNumericValue(s)
  );
  if (sentenceMatch) return true;

  const COMBINED_NUMBER_RE = /(?:₹|rs\.?\s*)?\d[,\d]+|\d+\s*(?:lakh|lac|thousand|crore|हजार|लाख|करोड़|कोटी)/i;
  return proximityMatch(text, incomeWords, COMBINED_NUMBER_RE);
}

// ─── Q3: JOB TYPE ────────────────────────────────────────────────────────────

function matchJobType(text: string): boolean {
  const keywords = [
    // English — salaried
    'salaried', 'employee', 'employed', 'office job', 'work for a company',
    'government job', 'govt job', 'private job', 'job',
    // English — self-employed
    'self-employed', 'self employed', 'own business', 'freelancer', 'freelance',
    'business owner', 'entrepreneur', 'consultant',
    // Hindi Devanagari — salaried
    'नौकरी', 'नौकरीपेशा', 'कर्मचारी', 'काम करता हूं', 'काम करती हूं',
    // Hindi Devanagari — self-employed
    'व्यवसाय', 'स्व-नियोजित', 'खुद का काम', 'दुकानदार',
    // Hindi Roman
    'naukri', 'naukar', 'naukaridaar', 'vyavasay', 'kaam karta',
    // Marathi Devanagari — salaried
    'नोकरी', 'नोकरदार', 'कर्मचारी', 'काम करतो', 'काम करते',
    // Marathi Devanagari — self-employed
    'स्वयंरोजगार', 'व्यवसाय', 'स्वतःचा व्यवसाय', 'दुकान',
    // Marathi Roman
    'nokari', 'nokaridaar', 'swayamrojgar', 'kaam karto', 'kaam karte',
  ];
  return hasKeyword(text, keywords);
}

// ─── Q4: PURPOSE ─────────────────────────────────────────────────────────────

/**
 * Detects loan purpose.
 * Strategy 1: Generic "loan for X" / "need loan for X" pattern catches ANY stated purpose,
 *             including uncommon ones like "PC setup", "gym equipment", etc.
 * Strategy 2: Specific category keywords as a broad fallback net.
 */
function matchPurpose(text: string): boolean {
  const lower = text.toLowerCase();

  // ── Strategy 1: Generic patterns — "loan for [anything]" ─────────────────
  // Catches: "I need loan for my PC setup", "need a loan for home renovation", etc.
  if (/\b(?:loan|borrow|finance|financing|funds?)\s+(?:for|to|towards?)\s+\w+/i.test(lower)) return true;
  if (/\b(?:need|want|require|looking for|applying for|apply)\s+(?:a\s+)?(?:loan|money|funds?)\s+(?:for|to|towards?)\s+\w+/i.test(lower)) return true;
  if (/\b(?:purpose|reason)\s+(?:of|for|is)\s+(?:(?:this|the|my)\s+)?(?:loan\s+)?(?:is\s+)?\w+/i.test(lower)) return true;
  // "loan is for", "it's for", "this loan is for"
  if (/\b(?:this\s+)?loan\s+is\s+(?:for|to)\s+\w+/i.test(lower)) return true;
  // "taking loan for", "getting a loan for"
  if (/\b(?:taking|getting|availing)\s+(?:a\s+)?(?:loan|credit)\s+(?:for|to)\s+\w+/i.test(lower)) return true;

  // ── Strategy 2: Specific purpose category keywords ────────────────────────
  const keywords = [
    // Housing
    'home loan', 'house', 'flat', 'property', 'apartment', 'rent',
    'renovation', 'construction', 'building', 'plot', 'land', 'home',
    // Vehicle
    'car', 'vehicle', 'bike', 'two-wheeler', 'scooter', 'motorcycle',
    'auto', 'electric vehicle', ' ev ',
    // Education
    'education', 'study', 'college', 'school', 'fees', 'tuition', 'course',
    'degree', 'admission', 'university', 'coaching',
    // Medical
    'medical', 'hospital', 'health', 'treatment', 'surgery', 'medicine',
    'doctor', 'operation', 'dental', 'clinic',
    // Marriage / Events
    'marriage', 'wedding', 'shaadi', 'event', 'function', 'ceremony',
    // Travel
    'travel', 'trip', 'vacation', 'tour', 'holiday', 'abroad', 'flight',
    // Business / Work
    'business', 'shop', 'startup', 'office', 'inventory',
    'equipment', 'machinery', 'raw material', 'working capital',
    // Electronics / Gadgets / Tech — KEY ADDITIONS
    'pc', ' pc ', 'computer', 'laptop', 'desktop', 'setup', 'gaming',
    'gadget', 'phone', 'mobile', 'tablet', 'electronics', 'device',
    'technology', 'software', 'hardware', 'server', 'camera', 'monitor',
    'printer', 'keyboard', 'headphone', 'speaker', 'smartwatch',
    // Furniture / Home goods
    'furniture', 'appliance', 'refrigerator', 'washing machine', ' ac ',
    'air conditioner', ' tv ', 'television', 'sofa', 'bed', 'kitchen',
    // Personal / Other
    'personal loan', 'personal', 'debt', 'consolidation', 'emergency',
    'agriculture', 'farm', 'crop', 'seeds', 'irrigation',
    // Hindi Devanagari
    'घर', 'मकान', 'फ्लैट', 'संपत्ति',
    'गाड़ी', 'वाहन', 'बाइक',
    'पढ़ाई', 'शिक्षा', 'कॉलेज', 'फीस',
    'इलाज', 'अस्पताल', 'ऑपरेशन', 'दवाई',
    'शादी', 'विवाह',
    'यात्रा', 'सफर', 'टूर',
    'व्यवसाय', 'दुकान',
    'कंप्यूटर', 'लैपटॉप', 'मोबाइल', 'गैजेट',
    'व्यक्तिगत',
    // Hindi Roman
    'ghar', 'makan', 'gaadi', 'padhai', 'shiksha', 'ilaaj', 'shadi', 'yatra',
    // Marathi Devanagari
    'फ्लॅट', 'मालमत्ता',
    'गाडी',
    'शिक्षण', 'महाविद्यालय', 'फी',
    'आरोग्य', 'रुग्णालय', 'उपचार', 'औषध',
    'लग्न',
    'प्रवास',
    'संगणक', 'लॅपटॉप',
    'वैयक्तिक',
    // Marathi Roman
    'shikshan', 'lagna', 'pravas', 'arogya',
  ];

  return hasKeyword(lower, keywords);
}

// ─── Q5: LOAN AMOUNT ─────────────────────────────────────────────────────────

/**
 * STRICT — SENTENCE-ONLY (NO proximity fallback).
 * Both the need/amount keyword AND a numeric value must be in the EXACT same sentence.
 *
 * ✅ "I need 5 lakh"         → need keyword + number in same sentence
 * ✅ "I need 2,00,000 loan"  → need keyword + number in same sentence
 * ❌ "Need loan for my car" → has need keyword but NO number → stays red
 */
function matchAmount(text: string): boolean {
  const needWords = [
    // English — must be combined with a number
    'i need', 'i want', 'i require', 'loan amount', 'amount of loan', 'loan of',
    'need a loan of', 'want a loan of', 'require a loan of', 'borrow',
    'sanctioned amount', 'approve', 'disburse', 'requesting',
    // Hindi Devanagari
    'लोन चाहिए', 'लोन राशि', 'राशि चाहिए', 'रकम चाहिए',
    'मुझे',
    // Hindi Roman
    'chahiye', 'chahta hun', 'chahti hun', 'loan chahiye', 'mujhe',
    // Marathi Devanagari
    'हवे आहे', 'लोन रक्कम', 'रक्कम हवी', 'घ्यायची',
    'मला',
    // Marathi Roman
    'mala', 'havi aahe', 'rukam havi', 'ghyaychi',
  ];

  // STRICT: sentence-level only — both must be in the SAME sentence
  return splitSentences(text).some(sentence =>
    hasKeyword(sentence, needWords) && hasNumericValue(sentence)
  );
}

// ─── Q6: AGE ─────────────────────────────────────────────────────────────────

function matchAge(text: string): boolean {
  const ageWords = [
    'age', 'old', 'years old', 'saal', 'varsh', 'umar', 'vayas', 'vaya',
    'उम्र', 'वर्ष', 'साल', 'वय', 'वयाचे',
  ];
  return splitSentences(text).some(sentence =>
    hasKeyword(sentence, ageWords) && hasNumericValue(sentence)
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type QuestionId = 'name' | 'income' | 'jobType' | 'purpose' | 'amount' | 'age';

const MATCHERS: Record<QuestionId, (text: string) => boolean> = {
  name:    matchName,
  income:  matchIncome,
  jobType: matchJobType,
  purpose: matchPurpose,
  amount:  matchAmount,
  age:     matchAge,
};

/**
 * Returns the list of answered question IDs based on the accumulated transcript.
 * Works for English, Hindi (Devanagari + Roman), and Marathi (Devanagari + Roman).
 */
export function detectAnsweredQuestions(transcript: string): QuestionId[] {
  if (!transcript || transcript.trim().length < 2) return [];
  return (Object.keys(MATCHERS) as QuestionId[]).filter(id => MATCHERS[id](transcript));
}

export function isQuestionAnswered(id: QuestionId, transcript: string): boolean {
  return MATCHERS[id]?.(transcript) ?? false;
}
