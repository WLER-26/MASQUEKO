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
    voteOnPoll // <-- NOVA IMPORTAÇÃO
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

// Rotas públicas (ou semi-públicas)
router.get('/', getAllPosts);
router.get('/tag/:tag', getPostsByTag);
router.get('/trending', getTrendingTags);

// Rotas privadas
router.get('/saved', protect, getSavedPosts);
router.put('/poll/vote', protect, voteOnPoll); // <-- NOVA ROTA DE VOTAÇÃO
router.post('/', protect, createPost);
router.put('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);
router.put('/:id/vote', protect, voteOnPost);
router.post('/:id/comments', protect, addComment);
router.put('/:postId/comments/:commentId/vote', protect, voteOnComment);

module.exports = router;