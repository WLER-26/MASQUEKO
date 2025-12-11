// Arquivo: back/controllers/communityController.js
const { db, admin } = require('../config/firebaseConfig');
const { fetchUserDetails, createNotification } = require('../utils/helpers');

// --- FUNÇÃO AUXILIAR: INJETAR DADOS ATUALIZADOS (VERIFICADO) ---
const populatePostUserData = async (posts) => {
    if (!posts || !Array.isArray(posts) || posts.length === 0) return [];
    
    try {
        const userIds = [...new Set(posts.map(p => p.user && p.user._id).filter(id => id))];
        if (userIds.length === 0) return posts;

        const userMap = {};
        const refs = userIds.map(id => db.collection('users').doc(id));
        
        if (refs.length > 0) {
            const snapshots = await db.getAll(...refs);
            snapshots.forEach(doc => {
                if (doc.exists) userMap[doc.id] = doc.data();
            });
        }

        return posts.map(post => {
            if (!post.user || !post.user._id) return post;
            const freshUser = userMap[post.user._id];
            if (freshUser) {
                return {
                    ...post,
                    user: {
                        ...post.user,
                        name: freshUser.name || post.user.name,
                        avatar: freshUser.avatar || post.user.avatar,
                        isVerified: !!freshUser.isVerified // Injeta o verificado
                    }
                };
            }
            return post;
        });
    } catch (e) {
        console.error("Erro ao popular usuários na comunidade:", e);
        return posts;
    }
};

exports.createCommunity = async (req, res) => {
    const { name, description, imageUrl, isPrivate, allowGlobalFeed } = req.body;
    const userId = req.user.id;

    if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });

    try {
        const userDetails = await fetchUserDetails(userId);
        const newCommunity = {
            name,
            description: description || '',
            imageUrl: imageUrl || null,
            isPrivate: !!isPrivate,
            allowGlobalFeed: isPrivate ? (!!allowGlobalFeed) : true,
            creator: { _id: userId, name: userDetails.name },
            members: [userId], 
            joinRequests: [],
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection('communities').add(newCommunity);
        res.status(201).json({ _id: docRef.id, ...newCommunity });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar comunidade' });
    }
};

exports.getAllCommunities = async (req, res) => {
    try {
        const snapshot = await db.collection('communities').get();
        const communities = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        res.json(communities);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar comunidades' });
    }
};

exports.getCommunity = async (req, res) => {
    try {
        const communityDoc = await db.collection('communities').doc(req.params.id).get();
        if (!communityDoc.exists) return res.status(404).json({ message: 'Comunidade não encontrada' });
        
        const community = { _id: communityDoc.id, ...communityDoc.data() };
        
        // Busca posts e remove orderBy que exige índice
        const postsSnapshot = await db.collection('posts')
            .where('community._id', '==', req.params.id)
            .get();
            
        let posts = postsSnapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        
        // Ordena em memória
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // INJETA O VERIFICADO
        posts = await populatePostUserData(posts);

        res.json({ community, posts });
    } catch (error) {
        console.error("Erro getCommunity:", error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

exports.joinCommunity = async (req, res) => {
    const communityId = req.params.id;
    const userId = req.user.id;

    try {
        const commRef = db.collection('communities').doc(communityId);
        const commDoc = await commRef.get();
        
        if (!commDoc.exists) return res.status(404).json({ message: 'Comunidade não encontrada' });
        const data = commDoc.data();

        // Se já é membro, SAI
        if (data.members && data.members.includes(userId)) {
            if (data.creator._id === userId) return res.status(400).json({ message: 'O criador não pode sair.' });

            await commRef.update({
                members: admin.firestore.FieldValue.arrayRemove(userId)
            });
            return res.json({ 
                message: 'Você saiu da comunidade.', 
                status: 'left',
                members: data.members.filter(id => id !== userId),
                joinRequests: data.joinRequests 
            });
        }

        // Se é privada, pendente
        if (data.isPrivate) {
            if (data.joinRequests && data.joinRequests.includes(userId)) {
                return res.status(400).json({ message: 'Solicitação já enviada.' });
            }
            await commRef.update({
                joinRequests: admin.firestore.FieldValue.arrayUnion(userId)
            });
            return res.json({ 
                message: 'Solicitação enviada!', 
                status: 'pending',
                members: data.members,
                joinRequests: [...(data.joinRequests || []), userId]
            });
        }

        // Se é pública, entra
        await commRef.update({
            members: admin.firestore.FieldValue.arrayUnion(userId)
        });

        return res.json({ 
            message: 'Bem-vindo à comunidade!', 
            status: 'joined',
            members: [...(data.members || []), userId],
            joinRequests: data.joinRequests 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao entrar/sair' });
    }
};

exports.handleJoinRequest = async (req, res) => {
    const communityId = req.params.id;
    const { userId, action } = req.body; 
    const currentUserId = req.user.id;

    try {
        const commRef = db.collection('communities').doc(communityId);
        const commDoc = await commRef.get();
        
        if (!commDoc.exists) return res.status(404).json({ message: 'Comunidade 404' });
        const data = commDoc.data();

        if (data.creator._id !== currentUserId) {
            return res.status(403).json({ message: 'Apenas o dono pode gerenciar.' });
        }

        if (action === 'accept') {
            await commRef.update({
                members: admin.firestore.FieldValue.arrayUnion(userId),
                joinRequests: admin.firestore.FieldValue.arrayRemove(userId)
            });
            // Notifica
            const u = await fetchUserDetails(userId);
            if(u) {
                // Aqui poderia enviar notificação se houver socket
            }
        } else {
            await commRef.update({
                joinRequests: admin.firestore.FieldValue.arrayRemove(userId)
            });
        }

        res.json({ message: `Solicitação ${action === 'accept' ? 'aceita' : 'recusada'}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao processar pedido' });
    }
};

exports.getCommunityRequests = async (req, res) => {
    try {
        const commDoc = await db.collection('communities').doc(req.params.id).get();
        if (!commDoc.exists) return res.status(404).json({ message: '404' });
        const data = commDoc.data();

        if (data.creator._id !== req.user.id) return res.status(403).json({ message: 'Proibido' });

        const requestIds = data.joinRequests || [];
        if (requestIds.length === 0) return res.json([]);

        const refs = requestIds.map(id => db.collection('users').doc(id));
        const snapshots = await db.getAll(...refs);
        const users = snapshots.map(doc => ({ _id: doc.id, ...doc.data() }));

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Erro' });
    }
};

exports.updateCommunity = async (req, res) => {
    const { name, description, imageUrl, isPrivate, allowGlobalFeed } = req.body;
    const communityId = req.params.id;
    const userId = req.user.id;

    try {
        const communityRef = db.collection('communities').doc(communityId);
        const communityDoc = await communityRef.get();

        if (!communityDoc.exists) return res.status(404).json({ message: 'Comunidade não encontrada' });
        
        if (communityDoc.data().creator._id !== userId) {
            return res.status(401).json({ message: 'Não autorizado.' });
        }

        const updatedData = {
            name: name || communityDoc.data().name,
            description: description || communityDoc.data().description,
            imageUrl: imageUrl || communityDoc.data().imageUrl,
            isPrivate: isPrivate !== undefined ? isPrivate : communityDoc.data().isPrivate,
            allowGlobalFeed: allowGlobalFeed !== undefined ? allowGlobalFeed : communityDoc.data().allowGlobalFeed
        };

        await communityRef.update(updatedData);
        res.json({ _id: communityId, ...communityDoc.data(), ...updatedData });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

exports.deleteCommunity = async (req, res) => {
    const communityId = req.params.id;
    const userId = req.user.id;

    try {
        const communityRef = db.collection('communities').doc(communityId);
        const communityDoc = await communityRef.get();

        if (!communityDoc.exists) return res.status(404).json({ message: 'Comunidade não encontrada' });

        if (communityDoc.data().creator._id !== userId) {
            return res.status(401).json({ message: 'Não autorizado.' });
        }

        // Deleta posts da comunidade
        const postsQuery = db.collection('posts').where('community._id', '==', communityId);
        const postsSnapshot = await postsQuery.get();
        if (!postsSnapshot.empty) {
            const batch = db.batch();
            postsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        await communityRef.delete();
        res.json({ message: 'Comunidade deletada' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};