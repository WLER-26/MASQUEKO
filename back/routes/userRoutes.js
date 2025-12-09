const express = require('express');
const router = express.Router();
const {
    getUserProfile,
    updateUserProfile,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    removeOrDeclineFriend,
    toggleSavePost // <-- NOVO
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Rotas protegidas
router.route('/').get(protect, searchUsers);
router.route('/profile').put(protect, updateUserProfile);
router.route('/:id').get(getUserProfile);
router.route('/:id/add').post(protect, sendFriendRequest);
router.route('/:id/accept').put(protect, acceptFriendRequest);
router.route('/:id/remove').delete(protect, removeOrDeclineFriend);

// Nova rota de salvar post
router.route('/save/:postId').put(protect, toggleSavePost);

module.exports = router;