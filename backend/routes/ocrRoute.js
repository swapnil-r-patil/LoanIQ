const express = require('express');
const router = express.Router();
const { extractPanDetails } = require('../services/ocrService');

router.post('/', async (req, res) => {
  try {
    const { panImage, spokenName } = req.body;
    
    if (!panImage) {
      return res.status(400).json({ error: 'PAN image is required' });
    }

    console.log('🔍 Running immediate OCR extraction...');
    const panDetails = await extractPanDetails(panImage, spokenName || '');
    
    res.json(panDetails);
  } catch (error) {
    console.error('Error in OCR route:', error);
    res.status(500).json({ error: 'Failed to process OCR' });
  }
});

module.exports = router;
