/**
 * Transcript Parser
 * Extracts structured loan application data from speech transcript
 * Supports English, Hindi (transliterated), and Marathi (transliterated)
 */

/**
 * Parse transcript text to extract loan application fields
 * @param {string} transcript - Raw speech transcript
 * @returns {Object} Parsed fields
 */
function parseTranscript(transcript) {
  const text = transcript || '';
  const lower = text.toLowerCase();

  // Extract name - comprehensive multilingual patterns
  let name = extractName(text);

  // Extract income - look for numbers near income/salary/earn
  let incomeRaw = extractField(text, [
    /(?:income|salary|earn(?:ing)?s?|kamai|aay|tankha|vetan|pagaar|mahinaa?)[^\d]*([\d,]+)/i,
    /([\d,]+)\s*(?:per month|monthly|a month|mahine|mahina|har mahine|pratyek mahina)/i,
    /(?:rupees?|rs\.?|₹|rupaiya|rupaye)\s*([\d,]+)/i,
    /([\d,]+)\s*(?:rupees?|rs|rupaiya|rupaye)/i,
    /(?:i (?:get|make|earn|receive))\s*(?:around|about|nearly|approximately)?\s*(?:rupees?|rs\.?|₹)?\s*([\d,]+)/i,
    /(?:mujhe|milta|milte|milti)\s*(?:hai)?\s*([\d,]+)/i,
    /(?:mala|miltat|milte)\s*([\d,]+)/i,
  ]);
  const income = parseIndianNumber(incomeRaw);

  // Extract job type - multilingual
  let jobType = 'unknown';
  if (/self[- ]?employ|business|freelan|own(?:\s+a)?\s+business|vyapar|vyapaar|khud ka|apna kaam|swatacha|udyog/i.test(lower)) {
    jobType = 'self-employed';
  } else if (/salaried|employ|office|job|work(?:ing)? (?:at|for|in)|naukri|nokari|kaam|service|company|private|government|sarkari|IT|software/i.test(lower)) {
    jobType = 'salaried';
  }

  // Extract loan purpose - multilingual
  let loanPurpose = extractField(text, [
    /(?:loan (?:is )?for|purpose[:\s]+|need(?:ing)? (?:it )?for|want (?:to|a loan) for|ke liye|kaaran|sathi)\s+([A-Za-z\s]{3,40})(?:\.|,|$)/i,
    /(?:home|car|education|medical|business|personal|travel|marriage|wedding|ghar|gaadi|shiksha|padhai|ilaj|shaadi|byah|vivah|lagna|gadi)[^a-z]/i,
  ]);
  if (!loanPurpose) {
    const purposeMatch = lower.match(/\b(home|car|vehicle|education|medical|health|business|personal|travel|marriage|wedding|house|ghar|gaadi|gadi|shiksha|padhai|ilaj|shaadi|byah|vivah|lagna)\b/);
    if (purposeMatch) loanPurpose = purposeMatch[1];
  }

  // Extract loan amount - multilingual
  let loanAmountRaw = extractField(text, [
    /(?:loan|borrow|need|want|require|chahiye|chahte|pahije|hava)[^\d]*([\d,]+)/i,
    /([\d,]+)\s*(?:lakh|lakhs?|lac|crore|karod)/i,
    /(?:amount|rashi|rakam)\s*(?:of|ka|chi)?\s*(?:rupees?|rs\.?|₹)?\s*([\d,]+)/i,
  ]);
  let loanAmount = parseIndianNumber(loanAmountRaw);
  // Convert lakh/crore
  if (/lakh|lac/i.test(text) && loanAmount < 1000) loanAmount = loanAmount * 100000;
  if (/crore|karod/i.test(text) && loanAmount < 100) loanAmount = loanAmount * 10000000;

  // Extract age - look for age/old/umar near a number
  let ageRaw = extractField(text, [
    /(?:age|u[m]?ar|vaya|vays)[^\d]*([\d]+)/i,
    /([\d]+)\s*(?:years|yrs|saal|varsh|vayas)/i,
    /(?:i am|mai|mee)\s*([\d]+)\s*(?:years|saal|varsh)/i,
  ]);
  const age = parseInt(ageRaw, 10) || null;

  return {
    name: name || 'Unknown',
    income: income || 0,
    jobType,
    loanPurpose: loanPurpose || 'personal',
    loanAmount: loanAmount || 0,
    age: age,
  };
}

/**
 * Extract name from transcript - comprehensive, multilingual
 * Handles English, Hindi (transliterated), Marathi (transliterated)
 */
function extractName(text) {
  if (!text) return null;

  // ── English patterns ──────────────────────────────────────────────────────
  const enPatterns = [
    // "my name is Swapnil Sharma" / "my name is Swapnil"
    /my\s+name\s+is\s+([A-Za-z][A-Za-z\s]{1,35}?)(?:\s*[.,]|\s+and\s|\s+my\s|\s+I\s|\s+i\s|$)/i,
    // "I am Swapnil" / "I'm Swapnil"
    /I(?:'m|\s+am)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
    // "name: Swapnil" / "name Swapnil"
    /name\s*[:]\s*([A-Za-z][A-Za-z\s]{2,30})/i,
    // "this is Swapnil speaking" / "this is Swapnil"
    /this\s+is\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
    // "call me Swapnil"
    /call\s+me\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
  ];

  // ── Hindi (transliterated) patterns ───────────────────────────────────────
  const hiPatterns = [
    // "mera naam Swapnil hai" / "mera naam Swapnil"
    /mera\s+naam\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+hai|\s*[.,]|\s+aur\s|\s+meri\s|\s+mera\s|$)/i,
    // "mai Swapnil hun" / "main Swapnil hoon"
    /mai[n]?\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*(?:hu[n]?|hoo[n]?)?/i,
    // "naam hai Swapnil"
    /naam\s+(?:hai\s+)?([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*[.,]|\s+(?:hai|aur|mera|meri)|$)/i,
    // "ji mera naam" style
    /(?:ji|haan|ha)\s+(?:mera\s+)?naam\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+hai|\s*[.,]|$)/i,
  ];

  // ── Marathi (transliterated) patterns ─────────────────────────────────────
  const mrPatterns = [
    // "majhe naav Swapnil aahe" / "mazhe naav Swapnil"
    /ma[jz]h?e?\s+na[av]+\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s+(?:aahe|ahe)|\s*[.,]|\s+(?:ani|aani|majhe|mazhe)|$)/i,
    // "mi Swapnil" / "mee Swapnil"
    /m[ie]{1,2}\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*(?:aahe|ahe)?/i,
    // "naav aahe Swapnil"
    /na[av]+\s+(?:aahe|ahe)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*[.,]|$)/i,
  ];

  const allPatterns = [...enPatterns, ...hiPatterns, ...mrPatterns];

  for (const pattern of allPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      // Clean up trailing stop words that might have been captured
      let prevName;
      do {
        prevName = name;
        name = name.replace(/\s+(hai|hoon|hun|aahe|ahe|and|my|i|am|is|the|sir|madam|please|thank|you|ok|okay|a|an|of|for|want|need|require|from|living|in|doing)$/i, '').trim();
      } while (name !== prevName);

      // Validate it looks like a name (at least 2 chars, not a number)
      if (name.length >= 2 && !/^\d/.test(name)) {
        return name;
      }
    }
  }

  // ── Fallback: Find any capitalized word pair that looks like a name ────────
  const capMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/);
  if (capMatch && capMatch[1].length >= 3) {
    const candidate = capMatch[1].trim();
    // Reject common English words that aren't names
    const stopWords = ['The', 'And', 'But', 'For', 'Not', 'You', 'All', 'Can', 'Her', 'Was', 'One', 'Our', 'Out'];
    if (!stopWords.includes(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractField(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
    if (match && match[0]) return match[0].trim();
  }
  return null;
}

function parseIndianNumber(str) {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

module.exports = { parseTranscript };
