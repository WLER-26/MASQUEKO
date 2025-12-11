// Arquivo: back/controllers/reportController.js
const { db, admin } = require('../config/firebaseConfig');

// Criar nova denúncia (Usuário)
exports.createReport = async (req, res) => {
    const { targetId, type, reason } = req.body; // targetId: ID do post/comentário
    const userId = req.user.id;

    if (!targetId || !reason) {
        return res.status(400).json({ message: 'Dados incompletos.' });
    }

    try {
        await db.collection('reports').add({
            reporterId: userId,
            targetId,
            type: type || 'post', // 'post' ou 'user'
            reason,
            status: 'pending', // pending, resolved, dismissed
            createdAt: new Date().toISOString()
        });
        res.status(201).json({ message: 'Denúncia enviada. Obrigado por ajudar a comunidade.' });
    } catch (error) {
        console.error("Erro ao denunciar:", error);
        res.status(500).json({ message: 'Erro ao processar denúncia.' });
    }
};

// Listar denúncias pendentes (Admin)
exports.getReports = async (req, res) => {
    try {
        // CORREÇÃO: Removemos o orderBy do banco para evitar o erro de índice (Index Missing)
        const snapshot = await db.collection('reports')
            .where('status', '==', 'pending')
            .get();

        const reports = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
        
        // Ordenamos em memória (JavaScript) do mais recente para o mais antigo
        reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(reports);
    } catch (error) {
        console.error("Erro ao buscar denúncias:", error);
        res.status(500).json({ message: 'Erro ao buscar denúncias.' });
    }
};

// Resolver denúncia (Admin)
exports.resolveReport = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'resolved' (resolvido/apagado) ou 'dismissed' (ignorado)

    try {
        await db.collection('reports').doc(id).update({ status });
        res.json({ message: 'Denúncia atualizada.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar.' });
    }
};