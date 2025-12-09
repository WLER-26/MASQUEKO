// Arquivo: back/controllers/postController.js
const { db, admin } = require('../config/firebaseConfig');
const { fetchUserDetails, createNotification, getLinkPreview, checkAndAwardBadges } = require('../utils/helpers');

const hashtagRegex = /#(\w+)/g;

// --- FUNÇÃO AUXILIAR DE MENÇÕES ---
const processMentions = async (text, io, senderId, resourceId, resourceType) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const matches = [...text.matchAll(mentionRegex)];
    const mentionedIds = [...new Set(matches.map(m => m[2]))];

    if (mentionedIds.length === 0) return;

    try {
        const sender = await fetchUserDetails(senderId);
        for (const recipientId of mentionedIds) {
            if (recipientId !== senderId) {
                await createNotification(io, {
                    recipientId: recipientId, senderId: senderId, type: 'mention',
                    message: `${sender.name} mencionou você em um ${resourceType === 'post' ? 'post' : 'comentário'}`,
                    link: `/pages/home.html`
                });
            }
        }
    } catch (error) { console.error("Erro menções:", error); }
};

exports.createPost = async (req, res) => {
    // ADICIONADO: 'poll' na desestruturação
    const { content, communityId, imageUrl, mediaUrls, poll } = req.body;
    const userId = req.user.id;
    
    if (!content && !imageUrl && (!mediaUrls || mediaUrls.length === 0) && !poll) {
        return res.status(400).json({ message: 'Conteúdo é obrigatório' });
    }

    try {
        const userDetails = await fetchUserDetails(userId);
        const tags = (content.match(hashtagRegex) || []).map(tag => tag.substring(1).toLowerCase());
        
        let communityData = null;
        let isGlobalVisible = true; 

        if (communityId) {
            const doc = await db.collection('communities').doc(communityId).get();
            if (!doc.exists) return res.status(404).json({ message: 'Comunidade não encontrada' });
            communityData = doc.data();
            if (!(communityData.members || []).includes(userId)) return res.status(403).json({ message: 'Não membro' });
            isGlobalVisible = !communityData.isPrivate || !!communityData.allowGlobalFeed;
        }

        const linkPreview = await getLinkPreview(content);
        let finalMedia = mediaUrls || [];
        if (imageUrl && finalMedia.length === 0) finalMedia = [imageUrl];

        // --- LÓGICA DA ENQUETE (NOVO) ---
        let postPoll = null;
        if (poll && poll.options && poll.options.length >= 2) {
            postPoll = {
                question: poll.question,
                options: poll.options.map(opt => ({ text: opt, votes: [] })), // Array de IDs
                totalVotes: 0
            };
        }

        const newPost = {
            content,
            community: communityId ? { _id: communityId, name: communityData.name } : null, 
            user: { _id: userId, name: userDetails.name, avatar: userDetails.avatar },
            mediaUrls: finalMedia,
            imageUrl: finalMedia[0] || null,
            poll: postPoll, // Salva a enquete
            linkPreview: linkPreview || null,
            likes: [], dislikes: [], comments: [], tags: tags, isGlobalVisible: isGlobalVisible,
            createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection('posts').add(newPost);
        const postResponse = { _id: docRef.id, ...newPost };

        if (req.io) {
            if (isGlobalVisible) req.io.to('global_feed').emit('global_new_post', postResponse);
            if (communityId) {
                req.io.to(`community_${communityId}`).emit('community_notification', { type: 'post', message: `Novo post`, author: userDetails.name, postId: docRef.id });
                req.io.to(`community_${communityId}`).emit('new_post', postResponse);
            }
            checkAndAwardBadges(req.io, userId);
            processMentions(content, req.io, userId, docRef.id, 'post');
        }
        res.status(201).json(postResponse);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.getAllPosts = async (req, res) => {
    try {
        const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) return res.json([]);
        const posts = [];
        snapshot.docs.forEach(doc => { const data = doc.data(); if (data.isGlobalVisible !== false) posts.push({ _id: doc.id, ...data }); });
        res.json(posts);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.getSavedPosts = async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.id).get();
        const savedIds = userDoc.data().savedPosts || [];

        if (savedIds.length === 0) return res.json([]);

        const promises = savedIds.map(id => db.collection('posts').doc(id).get());
        const docs = await Promise.all(promises);

        const posts = docs
            .filter(doc => doc.exists)
            .map(doc => ({ _id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(posts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar salvos' });
    }
};

exports.voteOnPost = async (req, res) => {
    const { voteType } = req.body; const userId = req.user.id;
    const postRef = db.collection('posts').doc(req.params.id);
    try {
        const doc = await postRef.get(); if (!doc.exists) return res.status(404).json({ message: 'Post não encontrado' });
        const data = doc.data(); const FieldValue = admin.firestore.FieldValue;
        if (voteType === 'like') {
            if ((data.likes || []).includes(userId)) await postRef.update({ likes: FieldValue.arrayRemove(userId) });
            else { 
                await postRef.update({ likes: FieldValue.arrayUnion(userId), dislikes: FieldValue.arrayRemove(userId) });
                if (data.user._id !== userId) {
                    const u = await fetchUserDetails(userId);
                    await createNotification(req.io, { recipientId: data.user._id, senderId: userId, type: 'like', message: `${u.name} curtiu seu post`, link: '/pages/home.html' });
                    if (req.io) checkAndAwardBadges(req.io, data.user._id);
                }
            }
        } else {
            if ((data.dislikes || []).includes(userId)) await postRef.update({ dislikes: FieldValue.arrayRemove(userId) });
            else await postRef.update({ dislikes: FieldValue.arrayUnion(userId), likes: FieldValue.arrayRemove(userId) });
        }
        res.json({ likes: (await postRef.get()).data().likes, dislikes: (await postRef.get()).data().dislikes });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

// --- NOVA FUNÇÃO: VOTAR NA ENQUETE ---
exports.voteOnPoll = async (req, res) => {
    const { postId, optionIndex } = req.body;
    const userId = req.user.id;

    try {
        const postRef = db.collection('posts').doc(postId);
        
        await db.runTransaction(async (t) => {
            const doc = await t.get(postRef);
            if (!doc.exists) throw new Error("Post não encontrado");
            
            const data = doc.data();
            if (!data.poll) throw new Error("Este post não tem enquete");

            let poll = data.poll;
            const idx = parseInt(optionIndex);

            // Remove voto anterior do usuário em qualquer opção
            poll.options.forEach(opt => {
                const userIndex = opt.votes.indexOf(userId);
                if (userIndex > -1) {
                    opt.votes.splice(userIndex, 1);
                    poll.totalVotes--;
                }
            });

            // Adiciona novo voto
            if (!poll.options[idx].votes.includes(userId)) {
                poll.options[idx].votes.push(userId);
                poll.totalVotes++;
            }

            t.update(postRef, { poll: poll });
        });

        const updatedDoc = await postRef.get();
        res.json(updatedDoc.data().poll);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

exports.addComment = async (req, res) => {
    const { text, parentId } = req.body; if (!text) return res.status(400).json({message:'Texto obrigatório'});
    try {
        const postRef = db.collection('posts').doc(req.params.id);
        const postDoc = await postRef.get(); if (!postDoc.exists) return res.status(404).json({message:'404'});
        const u = await fetchUserDetails(req.user.id);
        
        const comment = { 
            _id: Date.now().toString(), 
            text, 
            user: { _id: req.user.id, name: u.name, avatar: u.avatar }, 
            parentId: parentId || null, 
            likes: [], 
            dislikes: [],
            createdAt: new Date().toISOString() 
        };
        
        await postRef.update({ comments: admin.firestore.FieldValue.arrayUnion(comment) });
        
        if (parentId) {
            const pC = (postDoc.data().comments||[]).find(c=>c._id===parentId);
            if (pC && pC.user._id !== req.user.id) await createNotification(req.io, { recipientId: pC.user._id, senderId: req.user.id, type: 'reply', message: `${u.name} respondeu você`, link: '/pages/home.html' });
        } else if (postDoc.data().user._id !== req.user.id) {
            await createNotification(req.io, { recipientId: postDoc.data().user._id, senderId: req.user.id, type: 'comment', message: `${u.name} comentou seu post`, link: '/pages/home.html' });
        }
        if (req.io) processMentions(text, req.io, req.user.id, req.params.id, 'comment');
        res.status(201).json((await postRef.get()).data().comments);
    } catch (error) { console.error(error); res.status(500).json({message:'Erro'}); }
};

exports.voteOnComment = async (req, res) => {
    const { postId, commentId } = req.params; const { voteType } = req.body; const userId = req.user.id;
    try {
        const postRef = db.collection('posts').doc(postId);
        const postDoc = await postRef.get();
        if (!postDoc.exists) return res.status(404).json({ message: 'Post não encontrado' });
        let comments = postDoc.data().comments || [];
        const commentIndex = comments.findIndex(c => c._id === commentId);
        if (commentIndex === -1) return res.status(404).json({ message: 'Comentário não encontrado' });
        let comment = comments[commentIndex];
        if (!comment.likes) comment.likes = []; if (!comment.dislikes) comment.dislikes = [];
        if (voteType === 'like') {
            if (comment.likes.includes(userId)) comment.likes = comment.likes.filter(id => id !== userId);
            else { comment.likes.push(userId); comment.dislikes = comment.dislikes.filter(id => id !== userId);
                if (comment.user._id !== userId) { const u = await fetchUserDetails(userId); await createNotification(req.io, { recipientId: comment.user._id, senderId: userId, type: 'like_comment', message: `${u.name} curtiu seu comentário`, link: '/pages/home.html' }); }
            }
        } else if (voteType === 'dislike') {
            if (comment.dislikes.includes(userId)) comment.dislikes = comment.dislikes.filter(id => id !== userId);
            else { comment.dislikes.push(userId); comment.likes = comment.likes.filter(id => id !== userId); }
        }
        comments[commentIndex] = comment;
        await postRef.update({ comments });
        res.json(comments);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Erro no servidor' }); }
};

exports.deletePost = async (req, res) => {
    try { const doc = await db.collection('posts').doc(req.params.id).get(); if(!doc.exists) return res.status(404).json({}); if(doc.data().user._id!==req.user.id) return res.status(401).json({}); await doc.ref.delete(); res.json({message:'Ok'}); } catch(e){res.status(500).json({});}
};
exports.updatePost = async (req, res) => {
    try { const ref = db.collection('posts').doc(req.params.id); const doc = await ref.get(); if(!doc.exists) return res.status(404).json({}); if(doc.data().user._id!==req.user.id) return res.status(401).json({}); const mediaUrls = req.body.mediaUrls || doc.data().mediaUrls; await ref.update({ content: req.body.content, mediaUrls }); res.json({ _id: doc.id, ...doc.data(), mediaUrls }); } catch(e){res.status(500).json({});}
};
exports.getPostsByTag = async (req, res) => {
    try { const snap = await db.collection('posts').where('tags', 'array-contains', req.params.tag.toLowerCase()).orderBy('createdAt', 'desc').get(); const p=[]; snap.forEach(d=>{if(d.data().isGlobalVisible!==false)p.push({_id:d.id,...d.data()})}); res.json(p); } catch(e){res.status(500).json({});}
};
exports.getTrendingTags = async (req, res) => {
    try { const d = new Date(); d.setDate(d.getDate()-2); const s = await db.collection('posts').where('createdAt','>=',d.toISOString()).get(); const m = new Map(); s.forEach(doc=>{ if(doc.data().isGlobalVisible!==false) (doc.data().tags||[]).forEach(t=>m.set(t,(m.get(t)||0)+1))}); res.json(Array.from(m).sort((a,b)=>b[1]-a[1]).slice(0,5).map(i=>({tag:i[0],count:i[1]}))); } catch(e){res.status(500).json({});}
};