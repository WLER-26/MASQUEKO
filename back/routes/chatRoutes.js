// Arquivo: back/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

// Rotas protegidas
router.route('/').get(protect, getConversations);
router.route('/message').post(protect, sendMessage); // <-- NOVA ROTA
router.route('/:userId').get(protect, getMessages);

module.exports = router;