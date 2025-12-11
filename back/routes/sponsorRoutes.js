// Arquivo: back/routes/sponsorRoutes.js
const express = require('express');
const router = express.Router();
const { createSponsorshipRequest, getSponsorships, approveSponsorship } = require('../controllers/sponsorController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/', protect, createSponsorshipRequest);
router.get('/', protect, adminOnly, getSponsorships);
router.put('/:id', protect, adminOnly, approveSponsorship);

module.exports = router;