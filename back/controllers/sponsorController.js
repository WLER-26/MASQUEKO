// Arquivo: back/controllers/sponsorController.js
const { db, admin } = require('../config/firebaseConfig');
const { createNotification } = require('../utils/helpers');

const PLANS = {
    '1': { months: 1, price: 5, name: '1 Mês' },
    '2': { months: 2, price: 10, name: '2 Meses' },
    '3': { months: 3, price: 15, name: '3 Meses' }
};

exports.createSponsorshipRequest = async (req, res) => {
    const { planId } = req.body;
    const userId = req.user.id;

    if (!PLANS[planId]) return res.status(400).json({ message: 'Plano inválido.' });

    try {
        const pending = await db.collection('sponsorships')
            .where('userId', '==', userId)
            .where('status', '==', 'pending')
            .get();

        if (!pending.empty) return res.status(400).json({ message: 'Você já tem um pedido em análise.' });

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        await db.collection('sponsorships').add({
            userId,
            userName: userData.name,
            userEmail: userData.email,
            planId,
            planName: PLANS[planId].name,
            amount: PLANS[planId].price,
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        res.status(201).json({ message: 'Pedido enviado! Aguarde aprovação.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao processar pedido.' });
    }
};

exports.getSponsorships = async (req, res) => {
    try {
        const snapshot = await db.collection('sponsorships').where('status', '==', 'pending').get();
        const requests = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        res.json(requests);
    } catch (error) { res.status(500).json({ message: 'Erro ao buscar pedidos.' }); }
};

exports.approveSponsorship = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'approve' | 'reject'

    try {
        const requestRef = db.collection('sponsorships').doc(id);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) return res.status(404).json({ message: 'Pedido 404' });
        
        const data = requestDoc.data();

        if (action === 'reject') {
            await requestRef.update({ status: 'rejected' });
            return res.json({ message: 'Recusado.' });
        }

        const months = PLANS[data.planId].months;
        const now = new Date();
        const expireDate = new Date(now.setMonth(now.getMonth() + months));

        // Atualiza usuário com a flag de Patrocinador
        await db.collection('users').doc(data.userId).update({
            isSponsor: true,
            sponsorExpiresAt: expireDate.toISOString()
        });

        await requestRef.update({ status: 'approved', approvedAt: new Date().toISOString() });

        if (req.io) {
            await createNotification(req.io, {
                recipientId: data.userId,
                senderId: req.user.id,
                type: 'system',
                message: 'Seu patrocínio foi aprovado! Badge Dourado liberado 👑',
                link: '/pages/perfil.html'
            });
        }
        res.json({ message: 'Aprovado com sucesso!' });
    } catch (error) { res.status(500).json({ message: 'Erro.' }); }
};