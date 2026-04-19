const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  applicantLogin,
  upgradeApplicant,
  getUserLoans,
} = require('../services/dbService');

/**
 * POST /api/user/register
 * Register a new portal user
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }
    const result = await registerUser(name, email, password);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/login
 * Login a portal user with email + password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const result = await loginUser(email, password);
    if (!result.success) {
      return res.status(401).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/applicant-login
 * Auto-creates/retrieves a user account from their loan application result
 */
router.post('/applicant-login', async (req, res) => {
  try {
    const { name, panNumber, docId } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    const result = await applicantLogin(name, panNumber, docId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/user/upgrade
 * Upgrade a guest applicant into a fully registered user
 */
router.post('/upgrade', async (req, res) => {
  try {
    const { userId, email, password } = req.body;
    if (!userId || !email || !password) {
      return res.status(400).json({ success: false, error: 'UserId, email, and password are required' });
    }
    const result = await upgradeApplicant(userId, email, password);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/user/my-loans/:userId
 * Get all loan applications associated with a user ID
 */
router.get('/my-loans/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const loans = await getUserLoans(userId);
    return res.status(200).json({ success: true, loans });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
