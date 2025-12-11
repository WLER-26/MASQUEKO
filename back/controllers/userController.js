// Arquivo: back/controllers/userController.js
const { db, admin } = require('../config/firebaseConfig');
const { fetchUserDetails, createNotification } = require('../utils/helpers');

const FieldValue = admin.firestore.FieldValue;

// --- FUNÇÃO AUXILIAR PARA POPULAR VERIFICADO ---
const populatePostUserData = async (posts) => {
    if (!posts || posts.length === 0) return [];
    const userIds = [...new Set(posts.map(p => p.user._id))];
    const userMap = {};
    try {
        const refs = userIds.map(id => db.collection('users').doc(id));
        if (refs.length > 0) {
            const snapshots = await db.getAll(...refs);
            snapshots.forEach(doc => { if (doc.exists) userMap[doc.id] = doc.data(); });
        }
    } catch (e) {}
    return posts.map(post => {
        const freshUser = userMap[post.user._id];
        if (freshUser) {
            return { ...post, user: { ...post.user, name: freshUser.name, avatar: freshUser.avatar, isVerified: !!freshUser.isVerified } };
        }
        return post;
    });
};

exports.getUserProfile = async (req, res) => {
    try {
        const userRef = db.collection('users').doc(req.params.id);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).json({ message: 'Usuário não encontrado' });
        
        const user = userDoc.data();
        
        // CORREÇÃO: Removemos orderBy para evitar erro de índice e filtramos no backend
        const postsSnapshot = await db.collection('posts').where('user._id', '==', req.params.id).get();
        
        let posts = postsSnapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        
        // Ordenação em memória (JavaScript)
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Popula com dados frescos (Verificado)
        posts = await populatePostUserData(posts);

        res.json({ user, posts });
    } catch (error) { 
        console.error("Erro getUserProfile:", error); 
        res.status(500).json({ message: 'Erro no servidor' }); 
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const userRef = db.collection('users').doc(req.user.id);
        const user = (await userRef.get()).data();
        const updatedData = {
            name: req.body.name || user.name,
            bio: req.body.bio || user.bio,
            avatar: req.body.avatar || user.avatar,
            banner: req.body.banner !== undefined ? req.body.banner : (user.banner || null),
            tags: req.body.tags || user.tags || []
        };
        await userRef.update(updatedData);
        res.json({ _id: req.user.id, email: user.email, ...updatedData });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.searchUsers = async (req, res) => {
    const { search, tag } = req.query;
    try {
        let users = [];
        if (tag) {
            const snapshot = await db.collection('users').where('tags', 'array-contains', tag).get();
            users = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
            if (search) { const searchLower = search.toLowerCase(); users = users.filter(u => u.name.toLowerCase().includes(searchLower)); }
        } else if (search) {
            const snapshot = await db.collection('users').where('name', '>=', search).where('name', '<=', search + '\uf8ff').get();
            users = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        } else { return res.json([]); }
        const filteredUsers = users.filter(user => user._id !== req.user.id);
        res.json(filteredUsers);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.sendFriendRequest = async (req, res) => {
    try {
        const userToAddRef = db.collection('users').doc(req.params.id);
        const userToAddDoc = await userToAddRef.get();
        const currentUserRef = db.collection('users').doc(req.user.id);
        const currentUserData = (await currentUserRef.get()).data();
        if (!userToAddDoc.exists) return res.status(404).json({ message: 'Usuário não encontrado' });
        const userToAddData = userToAddDoc.data();
        if (userToAddData.friendRequests.includes(req.user.id)) return res.status(400).json({ message: 'Pedido já enviado' });
        if (userToAddData.friends.includes(req.user.id)) return res.status(400).json({ message: 'Já são amigos' });
        await userToAddRef.update({ friendRequests: FieldValue.arrayUnion(req.user.id) });
        await createNotification(req.io, { recipientId: req.params.id, senderId: req.user.id, type: 'friend_request', message: `${currentUserData.name} enviou um pedido de amizade.`, link: `/pages/amigos.html` });
        res.json({ message: 'Pedido de amizade enviado' });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.acceptFriendRequest = async (req, res) => {
    const userToAcceptId = req.params.id; const currentUserId = req.user.id;
    try {
        const userToAcceptRef = db.collection('users').doc(userToAcceptId); const currentUserRef = db.collection('users').doc(currentUserId);
        const currentUserDoc = await currentUserRef.get(); const currentUserData = currentUserDoc.data();
        if (!currentUserData.friendRequests.includes(userToAcceptId)) return res.status(400).json({ message: 'Pedido não encontrado' });
        await db.runTransaction(async (transaction) => {
            transaction.update(currentUserRef, { friends: FieldValue.arrayUnion(userToAcceptId), friendRequests: FieldValue.arrayRemove(userToAcceptId) });
            transaction.update(userToAcceptRef, { friends: FieldValue.arrayUnion(currentUserId) });
        });
        await createNotification(req.io, { recipientId: userToAcceptId, senderId: currentUserId, type: 'friend_accept', message: `${currentUserData.name} aceitou seu pedido de amizade!`, link: `/pages/perfil.html?id=${currentUserId}` });
        res.json({ message: 'Pedido de amizade aceite' });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.removeOrDeclineFriend = async (req, res) => {
    const userToRemoveId = req.params.id; const currentUserId = req.user.id;
    try {
        const userToRemoveRef = db.collection('users').doc(userToRemoveId); const currentUserRef = db.collection('users').doc(currentUserId);
        await db.runTransaction(async (transaction) => {
            transaction.update(currentUserRef, { friends: FieldValue.arrayRemove(userToRemoveId), friendRequests: FieldValue.arrayRemove(userToRemoveId) });
            transaction.update(userToRemoveRef, { friends: FieldValue.arrayRemove(currentUserId), friendRequests: FieldValue.arrayRemove(currentUserId) });
        });
        res.json({ message: 'Usuário removido/recusado' });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.toggleSavePost = async (req, res) => {
    const postId = req.params.postId; const userId = req.user.id;
    try {
        const userRef = db.collection('users').doc(userId); const userDoc = await userRef.get(); const savedPosts = userDoc.data().savedPosts || [];
        let isSaved = false;
        if (savedPosts.includes(postId)) { await userRef.update({ savedPosts: FieldValue.arrayRemove(postId) }); isSaved = false; } 
        else { await userRef.update({ savedPosts: FieldValue.arrayUnion(postId) }); isSaved = true; }
        const updatedDoc = await userRef.get(); res.json({ isSaved, savedPosts: updatedDoc.data().savedPosts || [] });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro ao salvar post' }); }
};

exports.getAllUsers = async (req, res) => { try { const snapshot = await db.collection('users').get(); const users = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() })); res.json(users); } catch (error) { res.status(500).json({ message: 'Erro ao buscar usuários' }); } };
exports.toggleVerified = async (req, res) => { try { const userId = req.params.id; const userRef = db.collection('users').doc(userId); const userDoc = await userRef.get(); if (!userDoc.exists) return res.status(404).json({ message: 'Usuário não existe' }); const currentStatus = userDoc.data().isVerified || false; await userRef.update({ isVerified: !currentStatus }); res.json({ message: `Status alterado`, isVerified: !currentStatus }); } catch (error) { res.status(500).json({ message: 'Erro ao atualizar verificado' }); } };