// Arquivo: back/routes/postRoutes.js
const express = require('express');
const router = express.Router();
const {
    createPost,
    getAllPosts,
    voteOnPost, 
    addComment,
    deletePost,
    updatePost,
    getPostsByTag,
    getTrendingTags,
    voteOnComment,
    getSavedPosts,
    voteOnPoll,
    getPostById,
    repostPost // <-- IMPORTADO
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', getAllPosts);
router.get('/tag/:tag', getPostsByTag);
router.get('/trending', getTrendingTags);

router.get('/saved', protect, getSavedPosts);
router.get('/:id', getPostById);

router.put('/poll/vote', protect, voteOnPoll);
router.post('/', protect, createPost);
router.post('/:id/repost', protect, repostPost); // <-- NOVA ROTA
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.put('/:id/vote', protect, voteOnPost);
router.post('/:id/comments', protect, addComment);
router.put('/:postId/comments/:commentId/vote', protect, voteOnComment);

module.exports = router;