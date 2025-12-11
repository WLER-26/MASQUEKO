// Arquivo: back/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { createReport, getReports, resolveReport } = require('../controllers/reportController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Rota para criar denúncia (Qualquer usuário logado)
router.post('/', protect, createReport);

// Rotas para ver e resolver denúncias (Apenas Admin)
router.get('/', protect, adminOnly, getReports);
router.put('/:id', protect, adminOnly, resolveReport);

module.exports = router;