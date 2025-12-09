// Arquivo: back/controllers/chatController.js
const { db } = require('../config/firebaseConfig');
const { fetchUserDetails } = require('../utils/helpers');

// @desc    Obter conversas do usuário
// @route   GET /api/chat
// @access  Private
exports.getConversations = async (req, res) => {
    const currentUserId = req.user.id;
    try {
        const sentSnapshot = await db.collection('messages').where('senderId', '==', currentUserId).get();
        const receivedSnapshot = await db.collection('messages').where('recipientId', '==', currentUserId).get();

        const userIds = new Set();
        sentSnapshot.docs.forEach(doc => userIds.add(doc.data().recipientId));
        receivedSnapshot.docs.forEach(doc => userIds.add(doc.data().senderId));
        userIds.delete(currentUserId);

        const userPromises = Array.from(userIds).map(userId => fetchUserDetails(userId));
        const users = (await Promise.all(userPromises)).filter(Boolean);

        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Obter histórico de mensagens com um usuário
// @route   GET /api/chat/:userId
// @access  Private
exports.getMessages = async (req, res) => {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    try {
        const sentQuery = db.collection('messages').where('senderId', '==', currentUserId).where('recipientId', '==', otherUserId);
        const receivedQuery = db.collection('messages').where('senderId', '==', otherUserId).where('recipientId', '==', currentUserId);

        const [sentSnapshot, receivedSnapshot] = await Promise.all([sentQuery.get(), receivedQuery.get()]);

        const messages = [];
        sentSnapshot.docs.forEach(doc => messages.push({ _id: doc.id, ...doc.data() }));
        receivedSnapshot.docs.forEach(doc => messages.push({ _id: doc.id, ...doc.data() }));

        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};

// @desc    Enviar mensagem (Texto, Áudio ou Post)
// @route   POST /api/chat/message
// @access  Private
exports.sendMessage = async (req, res) => {
    const { recipientId, text, audioUrl, sharedPost } = req.body;
    const senderId = req.user.id;

    if (!recipientId) return res.status(400).json({ message: 'Destinatário obrigatório' });

    const messageData = {
        senderId,
        recipientId,
        text: text || '',
        audioUrl: audioUrl || null,
        sharedPost: sharedPost || null, // Novo campo para o post compartilhado
        createdAt: new Date().toISOString(),
    };

    try {
        const docRef = await db.collection('messages').add(messageData);
        const newMessage = { _id: docRef.id, ...messageData };

        // Usa o Socket injetado para notificar em tempo real
        if (req.io) {
            req.io.to(recipientId).emit('new_message_notification', newMessage);
            req.io.to(recipientId).emit('newMessage', newMessage);
            req.io.to(senderId).emit('newMessage', newMessage);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        res.status(500).json({ message: 'Erro ao enviar mensagem' });
    }
};