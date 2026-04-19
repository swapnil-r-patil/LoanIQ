const Tesseract = require('tesseract.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Levenshtein distance for fuzzy name matching
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Compute name similarity 0-100%.
 * Normalises both strings, strips extra spaces, lowercases.
 */
function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const clean = s => s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const ca = clean(a), cb = clean(b);
  if (ca === cb) return 100;
  const maxLen = Math.max(ca.length, cb.length);
  if (maxLen === 0) return 100;
  const dist = levenshtein(ca, cb);
  return Math.round((1 - dist / maxLen) * 100);
}

// ── OCR Core Logic ──────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract PAN card details from base64 image using Tesseract OCR.
 * Also performs name matching against the spoken transcript name.
 *
 * @param {string} base64Image  - base64 encoded image (with or without data URI prefix)
 * @param {string} spokenName   - name extracted from video transcript (for matching)
 * @returns {Promise<Object>}   - extracted PAN fields + quality + nameMatch score
 */
async function extractPanDetails(base64Image, spokenName = '') {
  try {
    if (!base64Image) {
      return { panNumber: null, panName: null, dob: null, error: 'No image provided' };
    }

    // Decode image
    const imageData = base64Image.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(imageData, 'base64');

    // Run Tesseract OCR with English + Hindi support
    const result = await Tesseract.recognize(buffer, 'eng+hin', {
      logger: () => {}, 
      cachePath: '/tmp'
    });

    let text = result.data.text || '';
    const confidence = result.data.confidence || 0;
    
    // ── TEXT CLEANING ────────────────────────────────────────────────────────
    // Remove common OCR noise characters that break regex
    text = text.replace(/[|\\\[\]{}~«»<>_]/g, ' ');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const upperText = text.toUpperCase();

    console.log('OCR Raw Text (Cleaned):', text.substring(0, 500));
    console.log('OCR Confidence:', confidence);

    const quality = scoreImageQuality(confidence, text);

    // ── ANCHOR-BASED EXTRACTION ──────────────────────────────────────────────
    let panNumber = null;
    let panName = null;
    let dob = null;

    // 1. Find PAN Number (Anchor: "PERMANENT ACCOUNT" or strict regex)
    const panMatch = upperText.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
    if (panMatch) {
      panNumber = panMatch[0];
    } else {
      // Look for the line that is 10 chars long or contains mostly caps+numbers
      for (const line of lines) {
        const cleanLine = line.replace(/\s/g, '').toUpperCase();
        if (cleanLine.length >= 10) {
          const m = cleanLine.match(/[A-Z0-9]{10}/);
          if (m) {
            // Try to repair it
            const p = m[0];
            const part1 = p.substring(0, 5).replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B');
            const part2 = p.substring(5, 9).replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');
            const part3 = p.substring(9, 10).replace(/0/g, 'O').replace(/1/g, 'I');
            const fixed = part1 + part2 + part3;
            if (/[A-Z]{5}[0-9]{4}[A-Z]/.test(fixed)) {
              panNumber = fixed;
              break;
            }
          }
        }
      }
    }

    // 2. Find Name (with Fuzzy spokenName matching)
    panName = extractNameFromOCR(text, spokenName);

    // 3. Find DOB (Anchor: "DATE OF BIRTH" or "DOB" or DD/MM/YYYY regex)
    const dobMatch = text.match(/\d{2}[/\-]\d{2}[/\-]\d{4}/);
    if (dobMatch) {
      dob = dobMatch[0];
    } else {
      // Look for any date-like string or fallback year
      const yearMatch = text.match(/\b(19[4-9]\d|200\d)\b/);
      if (yearMatch) dob = `01/01/${yearMatch[0]}`;
    }

    // ── REFINEMENT ────────────────────────────────────────────────────────────
    if (panNumber || panName) {
      const nameMatch = computeNameMatch(panName, spokenName);
      return {
        panNumber: panNumber || 'NOT_FOUND',
        panName: panName || 'NOT_FOUND',
        dob: dob || null,
        panIssue: null,
        quality,
        nameMatch,
        rawText: text.substring(0, 100)
      };
    }

    return {
      panNumber: 'NOT_FOUND',
      panName: 'NOT_FOUND',
      dob: null,
      panIssue: 'LOW_QUALITY',
      panIssueReason: 'Could not identify card structure. Please try again with better lighting.',
      quality,
      nameMatch: { score: 0, label: 'No Data', panName: null, spokenName }
    };

  } catch (error) {
    console.error('OCR Error:', error.message);
    return { panNumber: null, panName: null, dob: null, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-functions
// ─────────────────────────────────────────────────────────────────────────────

function scoreImageQuality(confidence, text) {
  // Base from OCR confidence
  let score = confidence;

  // Penalise very short extracted text (likely mostly blank/black image)
  if (text.replace(/\s/g, '').length < 20) score -= 30;

  // Bonus: found key PAN card markers
  const upper = text.toUpperCase();
  if (/INCOME[\s\-]*TAX/.test(upper)) score += 5;
  if (/PERMANENT\s*ACCOUNT/.test(upper)) score += 5;
  if (/[A-Z]{5}[0-9]{4}[A-Z]/.test(text)) score += 10;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label;
  if (score >= 70) label = 'Excellent';
  else if (score >= 50) label = 'Good';
  else if (score >= 30) label = 'Low';
  else label = 'Very Poor';

  return { score, label, confidence: Math.round(confidence) };
}

function extractNameFromOCR(text, spokenName = '') {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const upperSpoken = (spokenName || '').toUpperCase();

  // Production-Grade Keywords to avoid
  const noiseKeywords = [
    'INDIA', 'INCOME', 'TAX', 'DEPARTMENT', 'PERMANENT', 'ACCOUNT', 'NUMBER', 
    'SIGNATURE', 'GOVT', 'GOVERNMENT', 'NAME', 'FATHER', 'HUSBAND', 'DATE', 'BIRTH',
    'PHOTO', 'CARD', 'VALID', 'ONLY', 'NOT', 'VALID'
  ];

  const isNoise = (str) => noiseKeywords.some(kw => str.includes(kw));

  // Strategy 1: Explicit Label Match (Standard on many digital/new cards)
  const nameMatch = text.match(/(?:Name|NAME|नाम)\s*[\n:]\s*([A-Z][A-Z\s]{2,40})/);
  if (nameMatch) {
    const candidate = nameMatch[1].trim();
    if (!isNoise(candidate.toUpperCase())) return candidate;
  }

  // Strategy 2: Positional Anchor (Standard on physical PAN cards)
  // The Applicant's name is ALMOST ALWAYS the line directly above Father's Name
  const fatherIdx = lines.findIndex(l => /FATHER|FATHE|पिता|HUSB|HBS/.test(l.toUpperCase()));
  if (fatherIdx > 0) {
    const candidate = lines[fatherIdx - 1];
    if (/^[A-Z][A-Z\s]{2,40}$/.test(candidate.toUpperCase()) && !isNoise(candidate.toUpperCase())) {
      return candidate.trim();
    }
  }

  // Strategy 3: Fuzzy recovery using spoken name (Handles noisy webcam captures)
  if (upperSpoken && upperSpoken.length > 3) {
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (upperLine.length < 4 || isNoise(upperLine)) continue;
      const similarity = nameSimilarity(upperLine, upperSpoken);
      if (similarity > 55) return line;
    }
  }

  // Strategy 4: Top-Half Scan (Last resort for jumbled OCR)
  // Applicants names are usually in the top 40% of the card text
  const topHalf = lines.slice(0, Math.ceil(lines.length * 0.5));
  for (const line of topHalf) {
    const upperLine = line.toUpperCase();
    if (
      /^[A-Z][A-Z\s]{5,40}$/.test(upperLine) && 
      !isNoise(upperLine) &&
      !/^\d/.test(line)
    ) {
      return line;
    }
  }

  return null;
}

function computeNameMatch(panName, spokenName) {
  if (!panName || !spokenName) {
    return { score: 0, label: 'Not Available', panName: panName || null, spokenName: spokenName || null };
  }
  const score = nameSimilarity(panName, spokenName);
  let label;
  if (score >= 85) label = 'Exact Match';
  else if (score >= 65) label = 'Partial Match';
  else if (score >= 40) label = 'Weak Match';
  else label = 'Mismatch';

  return { score, label, panName, spokenName };
}

module.exports = { extractPanDetails, computeNameMatch };
