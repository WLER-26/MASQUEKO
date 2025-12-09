// Arquivo: back/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Esta rota agora cria o *perfil* do usuário no Firestore
// Ela deve ser chamada *após* o cadastro no Firebase Auth (frontend)
// Usamos 'protect' para garantir que só o usuário autenticado crie seu próprio perfil
router.post('/register', protect, register);

// Esta rota é obsoleta
router.post('/login', login);

// Esta rota continua 100% funcional
router.get('/me', protect, getMe);

module.exports = router;