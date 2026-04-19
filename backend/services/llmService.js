const OpenAI = require('openai');

let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Generate a human-readable explanation of the loan decision using OpenAI
 * @param {Object} params
 * @returns {string} Explanation text
 */
async function generateExplanation({ creditScore, riskLevel, decision, income, jobType, livenessPass, adjustments }) {
  const client = getOpenAIClient();

  if (!client) {
    // Fallback rule-based explanation
    return generateFallbackExplanation({ creditScore, riskLevel, decision, income, jobType, livenessPass });
  }

  try {
    const prompt = `You are a loan officer AI. Generate a concise, professional 2-3 sentence explanation for the following loan assessment:

Credit Score: ${creditScore}/900
Risk Level: ${riskLevel}
Decision: ${decision}
Monthly Income: ₹${income.toLocaleString('en-IN')}
Employment Type: ${jobType}
Liveness Verification: ${livenessPass ? 'Passed' : 'Failed'}
Score Adjustments: ${adjustments.map(a => `${a.factor} (${a.delta > 0 ? '+' : ''}${a.delta})`).join(', ')}

Write a warm, professional explanation (2-3 sentences) that explains why this decision was made. Start directly with the explanation.`;

    const openaiPromise = client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout')), 5000)
    );

    const response = await Promise.race([openaiPromise, timeoutPromise]);

    return response.choices[0]?.message?.content?.trim() || generateFallbackExplanation({ creditScore, riskLevel, decision, income, jobType, livenessPass });
  } catch (error) {
    console.warn('OpenAI call failed, using fallback:', error.message);
    return generateFallbackExplanation({ creditScore, riskLevel, decision, income, jobType, livenessPass });
  }
}

function generateFallbackExplanation({ creditScore, riskLevel, decision, income, jobType, livenessPass }) {
  const incomeStr = `₹${(income || 0).toLocaleString('en-IN')}`;

  if (decision === 'APPROVED') {
    return `Your loan application has been approved based on your strong credit score of ${creditScore} and ${riskLevel.toLowerCase()} risk profile. Your ${jobType} employment with a monthly income of ${incomeStr} demonstrates financial stability. ${livenessPass ? 'Successful identity verification further strengthened your application.' : ''}`;
  } else if (decision === 'CONDITIONAL') {
    return `Your application is conditionally approved with a credit score of ${creditScore}. While your income of ${incomeStr} is adequate, additional verification may be required. Please provide supporting documents to complete the process.`;
  } else {
    return `Unfortunately, your application was not approved at this time. Your credit score of ${creditScore} and risk assessment indicate a ${riskLevel.toLowerCase()} risk level. ${!livenessPass ? 'Identity verification could not be confirmed. ' : ''}We encourage you to reapply after improving your financial profile.`;
  }
}

module.exports = { generateExplanation };
