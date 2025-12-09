// Arquivo: back/controllers/userController.js
const { db, admin } = require('../config/firebaseConfig');
const { fetchUserDetails, createNotification } = require('../utils/helpers');

exports.getUserProfile = async (req, res) => {
    try {
        const userRef = db.collection('users').doc(req.params.id);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).json({ message: 'Usuário não encontrado' });
        const user = userDoc.data();
        const postsSnapshot = await db.collection('posts').where('user._id', '==', req.params.id).orderBy('createdAt', 'desc').get();
        const posts = postsSnapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        res.json({ user, posts });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
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

// === ATUALIZADO: BUSCA AVANÇADA (NOME E TAG) ===
exports.searchUsers = async (req, res) => {
    const { search, tag } = req.query;

    try {
        let users = [];
        
        if (tag) {
            // Se tiver TAG, prioriza a busca exata pela tag no array 'tags'
            const snapshot = await db.collection('users').where('tags', 'array-contains', tag).get();
            users = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
            
            // Se tiver NOME também, filtra os resultados da tag pelo nome (em memória)
            if (search) {
                const searchLower = search.toLowerCase();
                users = users.filter(u => u.name.toLowerCase().includes(searchLower));
            }
        } else if (search) {
            // Se tiver só NOME, faz a busca padrão por prefixo
            const snapshot = await db.collection('users')
                .where('name', '>=', search)
                .where('name', '<=', search + '\uf8ff')
                .get();
            users = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        } else {
            return res.json([]); // Sem filtros
        }

        // Remove o próprio usuário da lista
        const filteredUsers = users.filter(user => user._id !== req.user.id);
        
        res.json(filteredUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

const FieldValue = admin.firestore.FieldValue;

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

        // --- NOTIFICAÇÃO ---
        await createNotification(req.io, {
            recipientId: req.params.id,
            senderId: req.user.id,
            type: 'friend_request',
            message: `${currentUserData.name} enviou um pedido de amizade.`,
            link: `/pages/amigos.html`
        });

        res.json({ message: 'Pedido de amizade enviado' });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.acceptFriendRequest = async (req, res) => {
    const userToAcceptId = req.params.id;
    const currentUserId = req.user.id;

    try {
        const userToAcceptRef = db.collection('users').doc(userToAcceptId);
        const currentUserRef = db.collection('users').doc(currentUserId);
        const currentUserDoc = await currentUserRef.get();
        const currentUserData = currentUserDoc.data();

        if (!currentUserData.friendRequests.includes(userToAcceptId)) return res.status(400).json({ message: 'Pedido não encontrado' });

        await db.runTransaction(async (transaction) => {
            transaction.update(currentUserRef, {
                friends: FieldValue.arrayUnion(userToAcceptId),
                friendRequests: FieldValue.arrayRemove(userToAcceptId) 
            });
            transaction.update(userToAcceptRef, {
                friends: FieldValue.arrayUnion(currentUserId)
            });
        });

        await createNotification(req.io, {
            recipientId: userToAcceptId,
            senderId: currentUserId,
            type: 'friend_accept',
            message: `${currentUserData.name} aceitou seu pedido de amizade!`,
            link: `/pages/perfil.html?id=${currentUserId}`
        });

        res.json({ message: 'Pedido de amizade aceite' });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.removeOrDeclineFriend = async (req, res) => {
    const userToRemoveId = req.params.id;
    const currentUserId = req.user.id;
    try {
        const userToRemoveRef = db.collection('users').doc(userToRemoveId);
        const currentUserRef = db.collection('users').doc(currentUserId);
        await db.runTransaction(async (transaction) => {
            transaction.update(currentUserRef, { friends: FieldValue.arrayRemove(userToRemoveId), friendRequests: FieldValue.arrayRemove(userToRemoveId) });
            transaction.update(userToRemoveRef, { friends: FieldValue.arrayRemove(currentUserId), friendRequests: FieldValue.arrayRemove(currentUserId) });
        });
        res.json({ message: 'Usuário removido/recusado' });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.toggleSavePost = async (req, res) => {
    const postId = req.params.postId;
    const userId = req.user.id;

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const savedPosts = userDoc.data().savedPosts || [];

        let isSaved = false;

        if (savedPosts.includes(postId)) {
            await userRef.update({ savedPosts: FieldValue.arrayRemove(postId) });
            isSaved = false;
        } else {
            await userRef.update({ savedPosts: FieldValue.arrayUnion(postId) });
            isSaved = true;
        }

        const updatedDoc = await userRef.get();
        res.json({ isSaved, savedPosts: updatedDoc.data().savedPosts || [] });

    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro ao salvar post' }); }
};