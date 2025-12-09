// Arquivo: back/utils/helpers.js
const { db, admin } = require('../config/firebaseConfig');
const https = require('https');
const http = require('http');

// --- REGRAS DE BADGES ---
const BADGE_RULES = [
    { id: 'post_1', name: 'Primeiros Passos', icon: '🌱', description: 'Fez a primeira postagem', type: 'posts', threshold: 1 },
    { id: 'post_5', name: 'Tagarela', icon: '🗣️', description: 'Fez 5 postagens', type: 'posts', threshold: 5 },
    { id: 'post_10', name: 'Criador de Conteúdo', icon: '✍️', description: 'Fez 10 postagens', type: 'posts', threshold: 10 },
    { id: 'like_1', name: 'Notado', icon: '👀', description: 'Recebeu o primeiro like', type: 'likes', threshold: 1 },
    { id: 'like_10', name: 'Pop Star', icon: '⭐', description: 'Recebeu 10 likes no total', type: 'likes', threshold: 10 },
    { id: 'like_50', name: 'Influencer', icon: '💎', description: 'Recebeu 50 likes no total', type: 'likes', threshold: 50 }
];

exports.fetchUserDetails = async (userId) => {
    if (!userId) return null;
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return null;
        const userData = userDoc.data();
        return {
            _id: userDoc.id,
            name: userData.name,
            avatar: userData.avatar,
        };
    } catch (error) {
        console.error(`Erro ao buscar usuário ${userId}:`, error);
        return null;
    }
};

exports.fetchCommunityDetails = async (communityId) => {
    if (!communityId) return null;
    try {
        const communityDoc = await db.collection('communities').doc(communityId).get();
        if (!communityDoc.exists) return null;
        const communityData = communityDoc.data();
        return {
            _id: communityDoc.id,
            name: communityData.name,
            description: communityData.description,
        };
    } catch (error) {
        console.error(`Erro ao buscar comunidade ${communityId}:`, error);
        return null;
    }
};

const createNotification = async (io, { recipientId, senderId, type, message, link }) => {
    if (recipientId === senderId && type !== 'badge') return; // Permite notificação de badge para si mesmo

    try {
        const notification = {
            recipientId, senderId, type, message, link, read: false, createdAt: new Date().toISOString()
        };
        const docRef = await db.collection('notifications').add(notification);
        const finalNotification = { _id: docRef.id, ...notification };
        if (io) io.to(recipientId).emit('new_notification', finalNotification);
        return finalNotification;
    } catch (error) { console.error("Erro notif:", error); return null; }
};
exports.createNotification = createNotification;

exports.getLinkPreview = (text) => {
    return new Promise((resolve) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return resolve(null);
        const targetUrl = match[0];
        const client = targetUrl.startsWith('https') ? https : http;
        client.get(targetUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { if (data.length < 100000) data += chunk; });
            res.on('end', () => {
                const getMeta = (prop) => {
                    const regex = new RegExp(`<meta (?:property|name)="${prop}" content="([^"]+)"`, 'i');
                    const m = data.match(regex); return m ? m[1] : null;
                };
                const title = getMeta('og:title') || getMeta('twitter:title') || (data.match(/<title>([^<]*)<\/title>/i) || [])[1];
                const description = getMeta('og:description') || getMeta('description');
                const image = getMeta('og:image') || getMeta('twitter:image');
                if (title) resolve({ url: targetUrl, title, description, image }); else resolve(null);
            });
        }).on('error', () => resolve(null));
    });
};

// --- NOVO: SISTEMA DE CONQUISTAS ---
exports.checkAndAwardBadges = async (io, userId) => {
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return;
        
        const userData = userDoc.data();
        const currentBadges = userData.badges || [];
        
        // 1. Calcular estatísticas atuais
        const postsSnapshot = await db.collection('posts').where('user._id', '==', userId).get();
        const postsCount = postsSnapshot.size;
        
        let likesCount = 0;
        postsSnapshot.forEach(doc => {
            likesCount += (doc.data().likes || []).length;
        });

        // 2. Verificar regras
        let newBadgesAwarded = false;
        const updatedBadges = [...currentBadges];

        for (const rule of BADGE_RULES) {
            // Se já tem o badge, pula
            if (updatedBadges.some(b => b.id === rule.id)) continue;

            let qualified = false;
            if (rule.type === 'posts' && postsCount >= rule.threshold) qualified = true;
            if (rule.type === 'likes' && likesCount >= rule.threshold) qualified = true;

            if (qualified) {
                const badgeToAdd = {
                    id: rule.id,
                    name: rule.name,
                    icon: rule.icon,
                    description: rule.description,
                    awardedAt: new Date().toISOString()
                };
                updatedBadges.push(badgeToAdd);
                newBadgesAwarded = true;

                // Notificar conquista
                await createNotification(io, {
                    recipientId: userId,
                    senderId: 'system', // Sistema
                    type: 'badge',
                    message: `Parabéns! Você desbloqueou a conquista: ${rule.icon} ${rule.name}`,
                    link: `/pages/perfil.html?id=${userId}`
                });
            }
        }

        // 3. Salvar se houve mudança
        if (newBadgesAwarded) {
            await userRef.update({ badges: updatedBadges });
            console.log(`🏆 Badges atualizados para usuário ${userId}`);
        }

    } catch (error) {
        console.error("Erro ao processar badges:", error);
    }
};