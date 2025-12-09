// Arquivo: back/controllers/communityController.js
const { db, admin } = require('../config/firebaseConfig');
const { fetchUserDetails } = require('../utils/helpers');

// @desc    Criar uma nova comunidade
// @route   POST /api/communities
// @access  Private
exports.createCommunity = async (req, res) => {
    const { name, description, imageUrl, isPrivate, allowGlobalFeed } = req.body;
    const creatorId = req.user.id;

    if (!name || !description) {
        return res.status(400).json({ message: 'Nome e descrição são obrigatórios' });
    }

    try {
        const communityRef = db.collection('communities');
        const snapshot = await communityRef.where('name', '==', name).get();

        if (!snapshot.empty) {
            return res.status(400).json({ message: 'Uma comunidade com este nome já existe' });
        }

        const newCommunity = {
            name,
            description,
            creator: creatorId,
            members: [creatorId], // O criador é o primeiro membro
            joinRequests: [], // Lista de usuários pedindo para entrar
            isPrivate: !!isPrivate, // Booleano (true se privada)
            // Se for privada, respeita a escolha do dono. Se for pública, é sempre true.
            allowGlobalFeed: !!isPrivate ? (!!allowGlobalFeed) : true, 
            imageUrl: imageUrl || 'assets/logo-masqueko.png', 
            createdAt: new Date().toISOString(),
        };

        const docRef = await communityRef.add(newCommunity);

        res.status(201).json({ id: docRef.id, ...newCommunity });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Listar todas as comunidades
// @route   GET /api/communities
// @access  Public
exports.getAllCommunities = async (req, res) => {
    try {
        const snapshot = await db.collection('communities').get();
        if (snapshot.empty) {
            return res.json([]);
        }

        const communities = await Promise.all(snapshot.docs.map(async (doc) => {
            const communityData = doc.data();
            const creatorDetails = await fetchUserDetails(communityData.creator);
            
            return {
                _id: doc.id, 
                ...communityData,
                creator: creatorDetails,
            };
        }));
        
        res.json(communities);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Obter detalhes de uma comunidade e seus posts
// @route   GET /api/communities/:id
// @access  Public (mas com restrição de conteúdo se privada)
exports.getCommunityDetails = async (req, res) => {
    try {
        const communityRef = db.collection('communities').doc(req.params.id);
        const communityDoc = await communityRef.get();

        if (!communityDoc.exists) {
            return res.status(404).json({ message: 'Comunidade não encontrada' });
        }

        const communityData = communityDoc.data();
        
        const creatorDetails = await fetchUserDetails(communityData.creator);
        const community = {
            _id: communityDoc.id,
            ...communityData,
            creator: creatorDetails
        };

        const postsSnapshot = await db.collection('posts')
            .where('community._id', '==', req.params.id)
            .orderBy('createdAt', 'desc')
            .get();

        const posts = await Promise.all(postsSnapshot.docs.map(async (doc) => {
            const postData = doc.data();
            const userDetails = await fetchUserDetails(postData.user._id);

            return {
                _id: doc.id,
                ...postData,
                user: userDetails || postData.user, 
            };
        }));

        res.json({ community, posts });
    } catch (error)
    {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Entrar, Sair ou Solicitar Entrada
// @route   PUT /api/communities/:id/join
// @access  Private
exports.joinOrLeaveCommunity = async (req, res) => {
    try {
        const communityRef = db.collection('communities').doc(req.params.id);
        const communityDoc = await communityRef.get();

        if (!communityDoc.exists) {
            return res.status(404).json({ message: 'Comunidade não encontrada' });
        }

        const userId = req.user.id;
        const communityData = communityDoc.data();
        
        const isMember = communityData.members.includes(userId);
        const isPending = (communityData.joinRequests || []).includes(userId);

        if (isMember) {
            // Sair da comunidade
            await communityRef.update({
                members: admin.firestore.FieldValue.arrayRemove(userId)
            });
            const updatedDoc = await communityRef.get();
            return res.json({ 
                message: 'Você saiu da comunidade', 
                status: 'left',
                members: updatedDoc.data().members,
                joinRequests: updatedDoc.data().joinRequests 
            });
        } 
        
        if (isPending) {
            // Cancelar solicitação
            await communityRef.update({
                joinRequests: admin.firestore.FieldValue.arrayRemove(userId)
            });
            const updatedDoc = await communityRef.get();
            return res.json({ 
                message: 'Solicitação cancelada', 
                status: 'cancelled',
                members: updatedDoc.data().members,
                joinRequests: updatedDoc.data().joinRequests 
            });
        }

        // Tentar entrar
        if (communityData.isPrivate) {
            // Comunidade Privada: Adiciona aos pedidos
            await communityRef.update({
                joinRequests: admin.firestore.FieldValue.arrayUnion(userId)
            });
            const updatedDoc = await communityRef.get();
            return res.json({ 
                message: 'Solicitação enviada ao administrador', 
                status: 'pending',
                members: updatedDoc.data().members,
                joinRequests: updatedDoc.data().joinRequests 
            });
        } else {
            // Comunidade Pública: Entra direto
            await communityRef.update({
                members: admin.firestore.FieldValue.arrayUnion(userId)
            });
            const updatedDoc = await communityRef.get();
            return res.json({ 
                message: 'Você entrou na comunidade', 
                status: 'joined',
                members: updatedDoc.data().members,
                joinRequests: updatedDoc.data().joinRequests 
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Obter solicitações de entrada (Apenas Admin)
// @route   GET /api/communities/:id/requests
// @access  Private
exports.getJoinRequests = async (req, res) => {
    try {
        const communityRef = db.collection('communities').doc(req.params.id);
        const communityDoc = await communityRef.get();

        if (!communityDoc.exists) return res.status(404).json({ message: 'Não encontrada' });
        
        // Verifica se é o dono
        if (communityDoc.data().creator !== req.user.id) {
            return res.status(401).json({ message: 'Apenas o criador pode ver solicitações.' });
        }

        const requestIds = communityDoc.data().joinRequests || [];
        
        // Busca detalhes dos usuários
        const userPromises = requestIds.map(uid => fetchUserDetails(uid));
        const users = (await Promise.all(userPromises)).filter(Boolean);

        res.json(users);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Responder a solicitação (Aceitar/Recusar)
// @route   PUT /api/communities/:id/requests
// @access  Private
exports.respondToJoinRequest = async (req, res) => {
    const { userId, action } = req.body; // action: 'accept' ou 'reject'
    const communityId = req.params.id;

    try {
        const communityRef = db.collection('communities').doc(communityId);
        const communityDoc = await communityRef.get();

        if (!communityDoc.exists) return res.status(404).json({ message: 'Não encontrada' });
        if (communityDoc.data().creator !== req.user.id) {
            return res.status(401).json({ message: 'Apenas o criador pode gerenciar membros.' });
        }

        if (action === 'accept') {
            await communityRef.update({
                members: admin.firestore.FieldValue.arrayUnion(userId),
                joinRequests: admin.firestore.FieldValue.arrayRemove(userId)
            });
            res.json({ message: 'Solicitação aceita!' });
        } else if (action === 'reject') {
            await communityRef.update({
                joinRequests: admin.firestore.FieldValue.arrayRemove(userId)
            });
            res.json({ message: 'Solicitação recusada.' });
        } else {
            res.status(400).json({ message: 'Ação inválida' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Atualizar uma comunidade
// @route   PUT /api/communities/:id
// @access  Private
exports.updateCommunity = async (req, res) => {
    const { name, description, imageUrl, isPrivate, allowGlobalFeed } = req.body;
    const communityId = req.params.id;
    const userId = req.user.id;

    try {
        const communityRef = db.collection('communities').doc(communityId);
        const communityDoc = await communityRef.get();

        if (!communityDoc.exists) {
            return res.status(404).json({ message: 'Comunidade não encontrada' });
        }

        const communityData = communityDoc.data();
        if (communityData.creator !== userId) {
            return res.status(401).json({ message: 'Não autorizado. Apenas o criador pode editar.' });
        }

        // Verifica se o nome mudou e se já existe
        if (name && name !== communityData.name) {
            const snapshot = await db.collection('communities').where('name', '==', name).get();
            if (!snapshot.empty) {
                return res.status(400).json({ message: 'Uma comunidade com este nome já existe' });
            }
        }

        // Lógica de atualização:
        // Se isPrivate for definido, usamos ele. Se não, mantemos o antigo.
        const newIsPrivate = isPrivate !== undefined ? isPrivate : (communityData.isPrivate || false);
        
        // Se allowGlobalFeed for definido e for privada, usamos. Se não, e virou pública, força true.
        let newAllowGlobal = allowGlobalFeed;
        if (newIsPrivate === false) {
            newAllowGlobal = true; // Comunidades públicas sempre aparecem
        } else if (allowGlobalFeed === undefined) {
            // Se não mudou o checkbox mas continua privada, mantém o valor antigo
            newAllowGlobal = communityData.allowGlobalFeed;
        }

        const updatedData = {
            name: name || communityData.name,
            description: description || communityData.description,
            imageUrl: imageUrl !== undefined ? imageUrl : communityData.imageUrl,
            isPrivate: newIsPrivate,
            allowGlobalFeed: !!newAllowGlobal
        };

        await communityRef.update(updatedData);
        res.json({ _id: communityId, ...communityData, ...updatedData });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Deletar uma comunidade
// @route   DELETE /api/communities/:id
// @access  Private
exports.deleteCommunity = async (req, res) => {
    const communityId = req.params.id;
    const userId = req.user.id;

    try {
        const communityRef = db.collection('communities').doc(communityId);
        const communityDoc = await communityRef.get();

        if (!communityDoc.exists) {
            return res.status(404).json({ message: 'Comunidade não encontrada' });
        }

        if (communityDoc.data().creator !== userId) {
            return res.status(401).json({ message: 'Não autorizado. Apenas o criador pode deletar.' });
        }

        const postsQuery = db.collection('posts').where('community._id', '==', communityId);
        const postsSnapshot = await postsQuery.get();

        if (!postsSnapshot.empty) {
            const batch = db.batch();
            postsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        await communityRef.delete();
        res.json({ message: 'Comunidade e seus posts foram deletados' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};