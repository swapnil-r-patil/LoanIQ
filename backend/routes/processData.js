const express = require('express');
const router = express.Router();
const multer = require('multer');

const { parseTranscript } = require('../services/transcriptParser');
const { extractPanDetails } = require('../services/ocrService');
const {
  computeCreditScore,
  computeRiskScore,
  getDecision,
  getRiskLevel,
  getIncomeTier,
  computeLoanOffer,
} = require('../services/creditEngine');
const { generateExplanation } = require('../services/llmService');
const { saveReport } = require('../services/dbService');
const { estimateAgeReal } = require('../services/aiService');

// Use memory storage for uploaded files
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * POST /process-data
 * Main loan processing endpoint
 */
router.post('/process-data', async (req, res) => {
  try {
    const { transcript, panImage, userFaceImage, faceLandmarks, liveness, location, userId, faceAge } = req.body;

    console.log('\n📋 Processing loan application...');
    console.log('Transcript length:', transcript?.length || 0);
    console.log('PAN image provided:', !!panImage);
    if (panImage) {
      console.log('PAN Image Start:', panImage.substring(0, 100));
      console.log('PAN Image Length:', panImage.length);
    }
    console.log('Liveness:', liveness);
    console.log('Location:', location);
    console.log('User ID:', userId || 'guest');
    console.log('Face Age (Biometric):', faceAge);

    // ─── STEP 1: Parse Transcript ───────────────────────────────────────────
    const parsedData = parseTranscript(transcript || '');
    console.log('✅ Parsed data:', parsedData);

    const { name, income, jobType, loanPurpose, loanAmount, age: statedAge } = parsedData;

    // ─── STEP 2: PAN OCR ────────────────────────────────────────────────────
    let panDetails = { panNumber: null, panName: null, dob: null, panIssue: null, panIssueReason: null, quality: null, nameMatch: null };
    const spokenName = (name && name !== 'Unknown') ? name : '';
    console.log('👤 Spoken name for matching:', spokenName || '(not detected)');
    
    if (req.body.editedPanDetails) {
      console.log('✅ Using manually verified PAN details');
      const edited = typeof req.body.editedPanDetails === 'string' 
        ? JSON.parse(req.body.editedPanDetails) 
        : req.body.editedPanDetails;
      
      // We must recalculate the name match score to ensure security points are awarded
      const { computeNameMatch } = require('../services/ocrService');
      const nameMatch = computeNameMatch(edited.panName, spokenName);
      
      panDetails = {
        panNumber: edited.panNumber || 'NOT_FOUND',
        panName: edited.panName || 'NOT_FOUND',
        dob: edited.dob || null,
        panIssue: null,
        panIssueReason: null,
        quality: { score: 100, label: 'Manually Verified', confidence: 100 },
        nameMatch
      };
    } else if (panImage) {
      console.log('🔍 Running OCR...');
      panDetails = await extractPanDetails(panImage, spokenName);
      console.log('✅ PAN Details:', { ...panDetails, rawText: '[hidden]' });
    }

    // ─── STEP 2b: Age Logic ─────────────────────────────────────────────────
    let idAge = null;
    if (panDetails.dob) {
      const dobParts = panDetails.dob.split(/[\\/\-]/);
      const birthYear = parseInt(dobParts[dobParts.length - 1], 10);
      if (!isNaN(birthYear)) {
        idAge = new Date().getFullYear() - birthYear;
      }
    }
    const faceAgeNum = faceAge ? parseInt(faceAge, 10) : null;

    // ─── STEP 2c: REAL AI Age Inference ─────────────────────────────────────
    let realAiData = null;
    let aiModelConnected = true;
    try {
      const targetImage = userFaceImage || panImage;
      const landmarks = typeof faceLandmarks === 'string' ? JSON.parse(faceLandmarks) : faceLandmarks;
      if (targetImage) {
        const base64Data = targetImage.includes(',') ? targetImage.split(',')[1] : targetImage;
        const imageBuffer = Buffer.from(base64Data, 'base64');
        realAiData = await estimateAgeReal(imageBuffer, landmarks);
      } else {
        console.warn('⚠️ No image provided for AI Inference.');
        aiModelConnected = false;
      }
    } catch (e) {
      aiModelConnected = false;
      console.warn('Real AI Inference skipped:', e.message);
    }

    // ─── STEP 3: Credit Score ────────────────────────────────────────────────
    const livenessPass = liveness === 'true' || liveness === true;
    const { creditScore, adjustments } = computeCreditScore({
      pan: panDetails.panNumber,
      income,
      jobType,
      livenessPass,
      panQuality: panDetails.quality || null,
      nameMatch: panDetails.nameMatch || null,
      loanAmount: loanAmount || 0,
      loanPurpose: loanPurpose || 'personal',
      faceAge: faceAgeNum,
      statedAge,
      idAge,
    });
    console.log('✅ Credit Score:', creditScore);

    // ─── STEP 4: Risk Model ──────────────────────────────────────────────────
    const incomeTier = getIncomeTier(income);
    const { riskScore, components } = computeRiskScore({ creditScore, incomeTier, livenessPass, loanAmount: loanAmount || 0, income: income || 0 });
    const riskLevel = getRiskLevel(riskScore);
    console.log('✅ Risk:', riskLevel, riskScore);

    // ─── STEP 5: Decision ────────────────────────────────────────────────────
    const decision = getDecision(creditScore);
    console.log('✅ Decision:', decision);

    // ─── STEP 5b: Build Rejection Reasons ────────────────────────────────────
    const rejectionReasons = [];

    if (!panImage) {
      rejectionReasons.push({
        code: 'NO_PAN',
        title: 'PAN Card Not Provided',
        detail: 'You did not upload a PAN card. A valid PAN card is mandatory for loan processing. Your base credit score was set to the minimum (300).',
      });
    } else if (panDetails.panIssue) {
      const issueTitle =
        panDetails.panIssue === 'BLURRY'           ? 'Blurry / Low-Quality PAN Card Image' :
        panDetails.panIssue === 'NOT_PAN'          ? 'Invalid Document Uploaded' :
        panDetails.panIssue === 'FAKE_DETECTED'    ? 'Sample / Fake PAN Card Detected' :
        panDetails.panIssue === 'PDF_NOT_SUPPORTED'? 'PDF Format Not Supported' :
        'PAN Card Could Not Be Verified';
      rejectionReasons.push({ code: panDetails.panIssue, title: issueTitle, detail: panDetails.panIssueReason });
    }

    // Name mismatch check
    const nm = panDetails.nameMatch;
    if (nm && nm.panName && nm.spokenName && nm.score < 40) {
      rejectionReasons.push({
        code: 'NAME_MISMATCH',
        title: `Name Mismatch — PAN: "${nm.panName}" vs Stated: "${nm.spokenName}"`,
        detail: `The name on your PAN card (${nm.panName}) does not match the name you provided during the video interview (${nm.spokenName}). A similarity of only ${nm.score}% was detected. Please ensure you state your name exactly as it appears on your PAN card.`,
      });
    }

    if (!income || income <= 0) {
      rejectionReasons.push({
        code: 'NO_INCOME',
        title: 'Income Not Declared',
        detail: 'You did not state your monthly income during the video interview. Income information is required to assess loan eligibility.',
      });
    } else if (income < 15000) {
      rejectionReasons.push({
        code: 'LOW_INCOME',
        title: 'Income Below Minimum Threshold',
        detail: `Your stated income of ₹${income.toLocaleString('en-IN')}/month is below our minimum requirement of ₹15,000/month.`,
      });
    }

    if (jobType === 'unknown') {
      rejectionReasons.push({
        code: 'NO_JOB_TYPE',
        title: 'Employment Type Not Stated',
        detail: 'You did not mention whether you are salaried or self-employed. Please clearly state your employment type in the interview.',
      });
    }

    if (!livenessPass) {
      rejectionReasons.push({
        code: 'LIVENESS_FAIL',
        title: 'Biometric Liveness Check Failed',
        detail: 'You did not complete the live biometric check (head turns, smile, and 3 blinks). This check is required to verify you are a real person.',
      });
    }

    if (!loanAmount || loanAmount <= 0) {
      rejectionReasons.push({
        code: 'NO_LOAN_AMOUNT',
        title: 'Loan Amount Not Specified',
        detail: 'You did not mention the loan amount you need during the video interview.',
      });
    }

    if (!transcript || transcript.trim().length < 30) {
      rejectionReasons.push({
        code: 'NO_TRANSCRIPT',
        title: 'Interview Responses Missing or Invalid',
        detail: 'You did not answer the required interview questions. Saying random words (e.g., "hello hello") does not count as answering the questions. Please complete all 5 questions.',
      });
    }

    // Always include credit score reason when REJECTED
    if (decision === 'REJECTED') {
      if (creditScore <= 490) {
        rejectionReasons.push({
          code: 'LOW_CREDIT_SCORE',
          title: `Low Credit Score (${creditScore}/900)`,
          detail: `Your computed credit score of ${creditScore} falls in the Poor category (0–490). A minimum score of 491 is required for loan consideration. Improve your profile by providing valid PAN, stable income, and clear interview answers.`,
        });
      }
      // Catch-all: if no specific reason was found but still rejected
      if (rejectionReasons.length === 0) {
        rejectionReasons.push({
          code: 'GENERAL_REJECTION',
          title: 'Application Did Not Meet Criteria',
          detail: 'Your application did not meet one or more of our internal eligibility criteria. Please review your income, PAN card details, and interview answers, then reapply.',
        });
      }
    }

    // ─── STEP 6: Loan Offer ──────────────────────────────────────────────────
    const offer = computeLoanOffer({ decision, riskLevel, income, requestedAmount: loanAmount });

    // ─── STEP 7: LLM Explanation ─────────────────────────────────────────────
    console.log('🤖 Generating explanation...');
    const explanation = await generateExplanation({
      creditScore,
      riskLevel,
      decision,
      income,
      jobType,
      livenessPass,
      adjustments,
    });
    console.log('✅ Explanation generated');

    // ─── STEP 8: Build Report ────────────────────────────────────────────────
    console.log('🚀 Building report object...');
    const report = {
      customerDetails: {
        name: panDetails.panName || name,
        transcriptName: name,
        location: location ? JSON.parse(location || '{}') : null,
      },
      financialDetails: {
        income,
        incomeTier,
        jobType,
        loanPurpose,
        requestedAmount: loanAmount,
      },
      panDetails: {
        panNumber: panDetails.panNumber,
        panName: panDetails.panName || null,
        dob: panDetails.dob,
        panIssue: panDetails.panIssue || null,
        panIssueReason: panDetails.panIssueReason || null,
        quality: panDetails.quality || null,
        nameMatch: panDetails.nameMatch || null,
      },
      creditScore,
      adjustments,
      riskScore,
      riskComponents: components,
      riskLevel,
      ageAnalysis: {
        statedAge,
        idAge,
        faceAge: faceAgeNum,
        realAiAge: realAiData?.age || null,
        realAiConfidence: realAiData?.confidence || null,
        aiModelConnected
      },
      verification: {
        liveness: livenessPass,
        panVerified: !!panDetails.panNumber,
        ageVerified: idAge && statedAge ? Math.abs(idAge - statedAge) <= 2 : false,
        biometricAgeVerified: idAge && faceAgeNum ? Math.abs(idAge - faceAgeNum) <= 5 : false,
      },
      rejectionReasons,
      decision,
      offer,
      explanation,
      userId: userId || null,
    };
    console.log('✅ Report object built');

    // ─── STEP 9: Save to Firestore ───────────────────────────────────────────
    console.log('💾 Saving report to Firestore...');
    const docId = await saveReport(report);
    console.log('✅ Saved to Firestore with ID:', docId);

    // ─── STEP 10: Send Response ──────────────────────────────────────────────
    console.log('📤 Sending response to client...');
    return res.status(200).json({
      success: true,
      creditScore,
      riskLevel,
      decision,
      offer,
      report,
      docId,
    });
  } catch (error) {
    console.error('❌ /process-data error:', error);
    return res.status(500).json({
      success: false,
      error: 'Processing failed',
      message: error.message,
    });
  }
});

module.exports = router;
