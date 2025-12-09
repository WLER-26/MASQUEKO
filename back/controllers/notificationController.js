// Arquivo: back/controllers/notificationController.js
const { db } = require('../config/firebaseConfig');

// @desc    Obter notificações do usuário
// @route   GET /api/notifications
// @access  Private
exports.getUserNotifications = async (req, res) => {
    try {
        const snapshot = await db.collection('notifications')
            .where('recipientId', '==', req.user.id)
            .orderBy('createdAt', 'desc')
            .limit(20) // Pega as últimas 20
            .get();

        const notifications = snapshot.docs.map(doc => ({
            _id: doc.id,
            ...doc.data()
        }));

        res.json(notifications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar notificações' });
    }
};

// @desc    Marcar notificação como lida
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
    try {
        const notifRef = db.collection('notifications').doc(req.params.id);
        const doc = await notifRef.get();

        if (!doc.exists) return res.status(404).json({ message: 'Notificação não encontrada' });
        if (doc.data().recipientId !== req.user.id) return res.status(403).json({ message: 'Não autorizado' });

        await notifRef.update({ read: true });
        res.json({ message: 'Marcada como lida' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
};