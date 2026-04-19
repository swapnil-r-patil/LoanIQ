/**
 * Credit Score Engine — v2.0
 * 
 * ════════════════════════════════════════════════════════
 *  SCORING FRAMEWORK
 * ════════════════════════════════════════════════════════
 *  Base Score: 500 (with valid PAN) / 200 (no PAN)
 * 
 *  Factor                          Max Points   Description
 *  ─────────────────────────────── ──────────   ──────────────────────────────
 *  1. PAN Verification              +60 pts     PAN number successfully extracted
 *  2. PAN Image Quality            +100 pts     Image clarity (0–100 quality score)
 *  3. Identity Name Match           +120 pts    PAN name vs. spoken name similarity
 *  4. Income Level                 +120 pts     Monthly salary bands
 *  5. Loan-to-Income Ratio          +80 pts     Affordability check (loan vs. income)
 *  6. Employment Stability          +60 pts     Salaried > Self-employed > Unknown
 *  7. Loan Purpose                  +40 pts     Risk category of purpose
 *  8. Liveness / Biometric          +80 pts     Real-person verification
 *
 *  Total potential additions:      +600 pts
 *  Maximum achievable:    500 + 500 = 1000  → clamped to 900
 *
 *  GRADE TABLE
 *  ┌─────────────┬────────────────┬────────────────────────────────┐
 *  │  Score      │  Grade         │  Outcome                       │
 *  ├─────────────┼────────────────┼────────────────────────────────┤
 *  │  751 – 900  │  Excellent     │  Auto-Approved                 │
 *  │  491 – 750  │  Fair          │  Pending – Admin Review        │
 *  │  0   – 490  │  Poor          │  Auto-Rejected                 │
 *  └─────────────┴────────────────┴────────────────────────────────┘
 * ════════════════════════════════════════════════════════
 */

// ── 1. Base Score ────────────────────────────────────────────────────────────
function getBaseScore(pan) {
  if (!pan) return 200; // No PAN → very low start
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(pan.toUpperCase())) return 200; // Invalid PAN format
  return 500; // Valid PAN structure → solid starting point
}

// ── 2. Income tier helper ────────────────────────────────────────────────────
function getIncomeTier(income) {
  if (income > 150000) return 'very-high';
  if (income > 75000)  return 'high';
  if (income > 40000)  return 'medium-high';
  if (income >= 20000) return 'medium';
  if (income >= 10000) return 'low';
  return 'very-low';
}

// ── 3. Main credit score computation ─────────────────────────────────────────
function computeCreditScore({ pan, income, jobType, livenessPass, panQuality, nameMatch, loanAmount, loanPurpose }) {
  let score = getBaseScore(pan);
  const adjustments = [];

  // ── Factor 1: PAN Verification (+0 to +60) ───────────────────────────────
  if (!pan) {
    adjustments.push({ factor: 'PAN card not provided — base score reduced to 200', delta: 0 });
  } else {
    score += 60;
    adjustments.push({ factor: 'PAN card verified (number extracted)', delta: +60 });
  }

  // ── Factor 2: PAN Image Quality (+0 to +100 / -80) ───────────────────────
  if (pan && panQuality) {
    if (panQuality.score >= 80) {
      score += 100;
      adjustments.push({ factor: `PAN image quality: ${panQuality.label} (${panQuality.score}/100) — excellent scan`, delta: +100 });
    } else if (panQuality.score >= 60) {
      score += 50;
      adjustments.push({ factor: `PAN image quality: ${panQuality.label} (${panQuality.score}/100) — good scan`, delta: +50 });
    } else if (panQuality.score >= 40) {
      adjustments.push({ factor: `PAN image quality: ${panQuality.label} (${panQuality.score}/100) — acceptable`, delta: 0 });
    } else if (panQuality.score >= 20) {
      score -= 40;
      adjustments.push({ factor: `PAN image quality: ${panQuality.label} (${panQuality.score}/100) — poor scan`, delta: -40 });
    } else {
      score -= 80;
      adjustments.push({ factor: `PAN image quality: ${panQuality.label} (${panQuality.score}/100) — blurry or fake`, delta: -80 });
    }
  }

  // ── Factor 3: Identity Name Match (+120 / -20) ─────────────────────
  if (nameMatch && nameMatch.panName && nameMatch.spokenName) {
    if (nameMatch.score >= 90) {
      score += 120;
      adjustments.push({ factor: `Identity match: ${nameMatch.label} (${nameMatch.score}%) — exact`, delta: +120 });
    } else {
      score -= 20;
      adjustments.push({ factor: `Identity match: ${nameMatch.label} (${nameMatch.score}%) — similarity issues`, delta: -20 });
    }
  } else if (pan && !nameMatch?.panName) {
    score -= 10;
    adjustments.push({ factor: 'Name could not be read from PAN card', delta: -10 });
  }

  // ── Factor 4: Income Level (+0 to +120 / -60) ───────────────────────────
  const annualIncome = (income || 0) * 12;
  if (!income || income <= 0) {
    score -= 60;
    adjustments.push({ factor: 'Income not declared in interview', delta: -60 });
  } else if (income > 150000) {
    score += 120;
    adjustments.push({ factor: `Excellent income (₹${income.toLocaleString('en-IN')}/mo)`, delta: +120 });
  } else if (income > 75000) {
    score += 100;
    adjustments.push({ factor: `High income (₹${income.toLocaleString('en-IN')}/mo)`, delta: +100 });
  } else if (income > 40000) {
    score += 75;
    adjustments.push({ factor: `Good income (₹${income.toLocaleString('en-IN')}/mo)`, delta: +75 });
  } else if (income >= 20000) {
    score += 50;
    adjustments.push({ factor: `Moderate income (₹${income.toLocaleString('en-IN')}/mo)`, delta: +50 });
  } else if (income >= 10000) {
    score += 20;
    adjustments.push({ factor: `Low income (₹${income.toLocaleString('en-IN')}/mo)`, delta: +20 });
  } else {
    score -= 40;
    adjustments.push({ factor: `Very low income (₹${income.toLocaleString('en-IN')}/mo) — below minimum`, delta: -40 });
  }

  // ── Factor 5: Loan-to-Annual-Income Ratio (+0 to +80 / -40) ─────────────
  if (loanAmount && loanAmount > 0 && income && income > 0) {
    const loanToIncomeRatio = loanAmount / annualIncome;
    if (loanToIncomeRatio <= 2) {
      score += 80;
      adjustments.push({ factor: `Loan-to-income ratio: ${loanToIncomeRatio.toFixed(1)}x annual — excellent affordability`, delta: +80 });
    } else if (loanToIncomeRatio <= 4) {
      score += 60;
      adjustments.push({ factor: `Loan-to-income ratio: ${loanToIncomeRatio.toFixed(1)}x annual — good affordability`, delta: +60 });
    } else if (loanToIncomeRatio <= 6) {
      score += 35;
      adjustments.push({ factor: `Loan-to-income ratio: ${loanToIncomeRatio.toFixed(1)}x annual — fair affordability`, delta: +35 });
    } else if (loanToIncomeRatio <= 9) {
      score += 10;
      adjustments.push({ factor: `Loan-to-income ratio: ${loanToIncomeRatio.toFixed(1)}x annual — stretched`, delta: +10 });
    } else {
      score -= 40;
      adjustments.push({ factor: `Loan-to-income ratio: ${loanToIncomeRatio.toFixed(1)}x annual — high debt risk`, delta: -40 });
    }
  } else if (!loanAmount || loanAmount <= 0) {
    score -= 20;
    adjustments.push({ factor: 'Loan amount not specified in interview', delta: -20 });
  }

  // ── Factor 6: Employment Stability (+0 to +60 / -50) ────────────────────
  if (jobType === 'salaried') {
    score += 60;
    adjustments.push({ factor: 'Salaried employment — stable income source', delta: +60 });
  } else if (jobType === 'self-employed') {
    score += 35;
    adjustments.push({ factor: 'Self-employed / business — independent income source', delta: +35 });
  } else {
    score -= 50;
    adjustments.push({ factor: 'Employment type not stated in interview', delta: -50 });
  }

  // ── Factor 7: Loan Purpose Risk (+0 to +40) ──────────────────────────────
  const purposeLower = (loanPurpose || '').toLowerCase();
  if (/home|house|ghar|property|flat|apartment/.test(purposeLower)) {
    score += 40;
    adjustments.push({ factor: 'Loan purpose: Home/Housing — low-risk purpose', delta: +40 });
  } else if (/education|study|shiksha|college|school|padhai/.test(purposeLower)) {
    score += 38;
    adjustments.push({ factor: 'Loan purpose: Education — productive use', delta: +38 });
  } else if (/medical|health|hospital|ilaj|treatment/.test(purposeLower)) {
    score += 35;
    adjustments.push({ factor: 'Loan purpose: Medical — essential use', delta: +35 });
  } else if (/business|startup|enterprise|vyapar/.test(purposeLower)) {
    score += 30;
    adjustments.push({ factor: 'Loan purpose: Business — moderate risk', delta: +30 });
  } else if (/car|vehicle|gaadi|gadi|bike|auto/.test(purposeLower)) {
    score += 20;
    adjustments.push({ factor: 'Loan purpose: Vehicle — asset backed', delta: +20 });
  } else if (/marriage|wedding|shaadi|vivah|lagna|byah/.test(purposeLower)) {
    score += 10;
    adjustments.push({ factor: 'Loan purpose: Marriage/Event — higher risk', delta: +10 });
  } else if (loanPurpose && loanPurpose !== 'personal') {
    score += 15;
    adjustments.push({ factor: `Loan purpose: ${loanPurpose} — general use`, delta: +15 });
  } else {
    adjustments.push({ factor: 'Loan purpose not specified or personal (default)', delta: 0 });
  }

  // ── Factor 8: Liveness / Biometric (+80 / -80) ──────────────────────────
  if (livenessPass) {
    score += 80;
    adjustments.push({ factor: 'Biometric liveness check passed', delta: +80 });
  } else {
    score -= 80;
    adjustments.push({ factor: 'Biometric liveness check FAILED — required for approval', delta: -80 });
  }

  // ── Clamp to valid range 0–900 ────────────────────────────────────────────
  score = Math.max(0, Math.min(900, score));

  return { creditScore: Math.round(score), adjustments };
}

// ── Risk Score ────────────────────────────────────────────────────────────────
function computeRiskScore({ creditScore, incomeTier, livenessPass, loanAmount, income }) {
  // Income Score (0–100)
  const incomeScoreMap = {
    'very-high': 100,
    'high': 88,
    'medium-high': 72,
    'medium': 58,
    'low': 35,
    'very-low': 15,
  };
  const incomeScore = incomeScoreMap[incomeTier] || 50;

  // Verification Score (0–100)
  const verificationScore = livenessPass ? 90 : 15;

  // Affordability Score (0–100) — based on loan/income ratio
  let affordabilityScore = 70; // default
  if (loanAmount && income && income > 0) {
    const annualIncome = income * 12;
    const ratio = loanAmount / annualIncome;
    if (ratio <= 2) affordabilityScore = 95;
    else if (ratio <= 4) affordabilityScore = 80;
    else if (ratio <= 6) affordabilityScore = 65;
    else if (ratio <= 9) affordabilityScore = 45;
    else affordabilityScore = 20;
  }

  // Weighted composite: credit(35%) + income(25%) + verification(20%) + affordability(20%)
  const riskScore =
    (creditScore / 9) * 0.35 +   // normalise to 0–100
    incomeScore * 0.25 +
    verificationScore * 0.20 +
    affordabilityScore * 0.20;

  return {
    riskScore: Math.min(100, Math.round(riskScore)),
    components: { incomeScore, verificationScore, behaviorScore: affordabilityScore },
  };
}

// ── Decision ──────────────────────────────────────────────────────────────────
function getDecision(creditScore) {
  if (creditScore >= 751) return 'APPROVED';
  if (creditScore >= 491) return 'CONDITIONAL';
  return 'REJECTED';
}

// ── Risk Level ────────────────────────────────────────────────────────────────
function getRiskLevel(riskScore) {
  if (riskScore >= 72) return 'LOW';
  if (riskScore >= 50) return 'MEDIUM';
  return 'HIGH';
}

// ── Loan Offer ────────────────────────────────────────────────────────────────
function computeLoanOffer({ decision, riskLevel, income, requestedAmount }) {
  if (decision === 'REJECTED') return null;

  // Cap: 60× monthly income (5 years of salary)
  const maxByIncome = (income || 0) * 60;

  // Offer up to requested, but no more than the income-based cap
  const offeredAmount = Math.min(requestedAmount || maxByIncome, maxByIncome);

  let interestMin, interestMax;
  if (riskLevel === 'LOW') {
    interestMin = 8.5;
    interestMax = 10.5;
  } else if (riskLevel === 'MEDIUM') {
    interestMin = 11;
    interestMax = 13.5;
  } else {
    interestMin = 14;
    interestMax = 17;
  }

  const interestRate = interestMin + Math.random() * (interestMax - interestMin);
  const tenure = 60; // 5 years default
  const monthlyRate = interestRate / 100 / 12;
  const emi = Math.round(
    (offeredAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
      (Math.pow(1 + monthlyRate, tenure) - 1)
  );

  return {
    offeredAmount: Math.round(offeredAmount),
    maxAmount: Math.round(maxByIncome),
    interestRate: parseFloat(interestRate.toFixed(2)),
    tenure,
    emi,
    processingFee: Math.round(offeredAmount * 0.01),
  };
}

module.exports = {
  computeCreditScore,
  computeRiskScore,
  getDecision,
  getRiskLevel,
  getIncomeTier,
  computeLoanOffer,
};
