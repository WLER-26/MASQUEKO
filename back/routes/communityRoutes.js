// Arquivo: back/routes/communityRoutes.js
const express = require('express');
const router = express.Router();
const {
    createCommunity,
    getAllCommunities,
    getCommunity,       // Nome corrigido (era getCommunityDetails)
    joinCommunity,      // Nome corrigido (era joinOrLeaveCommunity)
    updateCommunity,
    deleteCommunity,
    getCommunityRequests, // Nome corrigido (era getJoinRequests)
    handleJoinRequest     // Nome corrigido (era respondToJoinRequest)
} = require('../controllers/communityController');
const { protect } = require('../middleware/authMiddleware');

// Rotas públicas (Visualização)
router.get('/', getAllCommunities);
router.get('/:id', getCommunity);

// Rotas privadas (Ações)
router.post('/', protect, createCommunity);
router.put('/:id/join', protect, joinCommunity);
router.put('/:id', protect, updateCommunity);
router.delete('/:id', protect, deleteCommunity);

// Novas rotas para gestão de membros
router.get('/:id/requests', protect, getCommunityRequests);
router.put('/:id/requests', protect, handleJoinRequest);

module.exports = router;