// Arquivo: back/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
    getUserProfile,
    updateUserProfile,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    removeOrDeclineFriend,
    toggleSavePost,
    getAllUsers, // <-- NOVO
    toggleVerified // <-- NOVO
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/authMiddleware'); // <-- adminOnly necessário

// Rotas protegidas
router.route('/').get(protect, searchUsers);
router.route('/profile').put(protect, updateUserProfile);
router.route('/:id').get(getUserProfile);
router.route('/:id/add').post(protect, sendFriendRequest);
router.route('/:id/accept').put(protect, acceptFriendRequest);
router.route('/:id/remove').delete(protect, removeOrDeclineFriend);

router.route('/save/:postId').put(protect, toggleSavePost);

// ROTAS ADMIN
router.get('/admin/list', protect, adminOnly, getAllUsers);
router.put('/admin/verify/:id', protect, adminOnly, toggleVerified);

module.exports = router;