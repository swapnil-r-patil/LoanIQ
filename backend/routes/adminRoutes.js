const express = require('express');
const router = express.Router();
const { 
  getApplications, 
  registerAdmin, 
  loginAdmin, 
  streamApplications,
  softDeleteApplication,
  restoreApplication,
  permanentDeleteApplication,
  emptyTrash,
  getDeletedApplications,
  cleanupExpiredApplications,
  updateApplicationDecision,
} = require('../services/dbService');

/**
 * GET /admin/applications/stream
 * Server-Sent Events (SSE) endpoint for real-time applications dashboard
 */
router.get('/applications/stream', (req, res) => {
  // 1. Setup headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // 2. Initial heartbeat so browser knows it's connected
  res.write('data: {"type":"connected"}\n\n');

  // 3. Start Firestore live stream
  const unsubscribe = streamApplications((data) => {
    // Every time Firestore updates, broadcast it to this connected client
    res.write(`data: ${JSON.stringify({ type: 'update', data })}\n\n`);
  });

  // 4. Cleanup when client closes the browser tab
  req.on('close', () => {
    if (unsubscribe) unsubscribe();
    res.end();
  });
});

/**
 * POST /admin/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });
    
    const result = await registerAdmin(username, password);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * POST /admin/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });
    
    const result = await loginAdmin(username, password);
    if (!result.success) return res.status(401).json(result);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * GET /admin/applications
 * Fetch all loan applications from Firestore
 */
router.get('/applications', async (req, res) => {

  try {
    const apps = await getApplications();
    return res.status(200).json({
      success: true,
      count: apps.length,
      data: apps
    });
  } catch (error) {
    console.error('❌ /admin/applications error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch applications',
      message: error.message,
    });
  }
});

/**
 * PATCH /admin/applications/:id/decision
 * Admin approves or rejects a CONDITIONAL application
 */
router.patch('/applications/:id/decision', async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Decision must be APPROVED or REJECTED' });
    }
    const result = await updateApplicationDecision(req.params.id, decision);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/applications/:id
 * Soft delete
 */
router.delete('/applications/:id', async (req, res) => {
  try {
    const result = await softDeleteApplication(req.params.id);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /admin/trash
 */
router.get('/trash', async (req, res) => {
  try {
    // Run cleanup on fetch too
    await cleanupExpiredApplications();
    const apps = await getDeletedApplications();
    return res.status(200).json({ success: true, count: apps.length, data: apps });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /admin/trash/:id/restore
 */
router.post('/trash/:id/restore', async (req, res) => {
  try {
    const result = await restoreApplication(req.params.id);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/trash/:id
 * Permanent delete
 */
router.delete('/trash/:id', async (req, res) => {
  try {
    const result = await permanentDeleteApplication(req.params.id);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/trash
 * Empty trash (Delete all)
 */
router.delete('/trash', async (req, res) => {
  try {
    const result = await emptyTrash();
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
