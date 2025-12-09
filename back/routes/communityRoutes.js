const express = require('express');
const router = express.Router();
const {
    createCommunity,
    getAllCommunities,
    getCommunityDetails,
    joinOrLeaveCommunity,
    updateCommunity,
    deleteCommunity,
    getJoinRequests,      // <-- NOVO
    respondToJoinRequest  // <-- NOVO
} = require('../controllers/communityController');
const { protect } = require('../middleware/authMiddleware');

// Rotas públicas (Visualização)
router.get('/', getAllCommunities);
router.get('/:id', getCommunityDetails);

// Rotas privadas (Ações)
router.post('/', protect, createCommunity);
router.put('/:id/join', protect, joinOrLeaveCommunity);
router.put('/:id', protect, updateCommunity);
router.delete('/:id', protect, deleteCommunity);

// Novas rotas para gestão de membros
router.get('/:id/requests', protect, getJoinRequests);
router.put('/:id/requests', protect, respondToJoinRequest);

module.exports = router;