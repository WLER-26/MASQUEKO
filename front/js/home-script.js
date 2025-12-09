document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            if (!user.emailVerified) { auth.signOut(); window.location.href = '/pages/index.html'; return; }
            loadPageData(); setupFeedListener(); setupGlobalMentionLogic();
        } else { window.location.href = '/pages/index.html'; }
    });

    const navUsername = document.getElementById('navUsername'); const navUserPic = document.getElementById('navUserPic'); const feedContainer = document.getElementById('feedContainer'); const createPostForm = document.getElementById('createPostForm'); const postContentInput = document.getElementById('postContentInput'); const postCommunitySelect = document.getElementById('postCommunitySelect'); const postMediaFile = document.getElementById('postMediaFile'); const logoutButton = document.getElementById('logoutButton');
    const editPostModal = document.getElementById('editPostModal'); const closeEditPostModalBtn = document.getElementById('closeEditPostModalBtn'); const editPostForm = document.getElementById('editPostForm'); const editPostIdInput = document.getElementById('editPostIdInput'); const editPostContentInput = document.getElementById('editPostContentInput'); const editPostImageUrlInput = document.getElementById('editPostImageUrlInput'); 
    const sharePostModal = document.getElementById('sharePostModal'); const closeShareModalBtn = document.getElementById('closeShareModalBtn'); const shareFriendList = document.getElementById('shareFriendList'); const shareSearchInput = document.getElementById('shareSearchInput');
    
    // --- VARIÁVEIS ENQUETE ---
    const pollModal = document.getElementById('createPollModal');
    const openPollBtn = document.getElementById('openPollModalBtn');
    const closePollBtn = document.getElementById('closePollModalBtn');
    const addOptionBtn = document.getElementById('addPollOptionBtn');
    const confirmPollBtn = document.getElementById('confirmPollBtn');
    const pollOptionsList = document.getElementById('pollOptionsList');
    const pollPreviewArea = document.getElementById('pollPreviewArea');
    const removePollBtn = document.getElementById('removePollBtn');
    let tempPollData = null;

    let currentPostToShare = null; let currentUser = null; let allPosts = []; let myFriends = []; 

    if (postMediaFile) postMediaFile.setAttribute('multiple', 'multiple');

    const setupFeedListener = () => { setTimeout(() => { if (window.globalSocket) { window.globalSocket.on('global_new_post', (post) => { if (!allPosts.some(p => p._id === post._id)) { allPosts.unshift(post); renderFeed(); } }); } }, 1000); };
    const renderSkeletonFeed = () => { feedContainer.innerHTML = ''; for (let i = 0; i < 3; i++) { feedContainer.innerHTML += `<div class="post-card card"><div class="post-card-content"><div class="post-header" style="margin-bottom: 15px;"><div class="skeleton skeleton-avatar"></div><div style="flex: 1; margin-left: 10px;"><div class="skeleton skeleton-text short"></div><div class="skeleton skeleton-text short" style="width: 30%"></div></div></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-image"></div></div></div>`; } };

    const buildCommentTree = (comments) => { const commentMap = {}; const roots = []; comments.forEach(c => { commentMap[c._id] = { ...c, children: [] }; }); comments.forEach(c => { if (c.parentId && commentMap[c.parentId]) { commentMap[c.parentId].children.push(commentMap[c._id]); } else { roots.push(commentMap[c._id]); } }); const sortComments = (list) => list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); const processChildren = (list) => { sortComments(list); list.forEach(c => processChildren(c.children)); }; processChildren(roots); return roots; };

    const renderCommentHTML = (comment, level = 0, postId) => {
        const avatar = getCleanImageUrl(comment.user.avatar) || '/assets/profile-pic.png';
        const margin = level * 30; 
        const likes = comment.likes || [];
        const dislikes = comment.dislikes || [];
        const isLiked = likes.includes(currentUser._id) ? 'liked' : '';
        const isDisliked = dislikes.includes(currentUser._id) ? 'disliked' : '';
        let childrenHtml = '';
        if (comment.children && comment.children.length > 0) {
            childrenHtml = comment.children.map(c => renderCommentHTML(c, level + 1, postId)).join('');
        }
        const formattedText = formatPostContent(comment.text);
        return `<div class="comment" style="margin-left: ${margin}px; border-left: ${level > 0 ? '2px solid var(--border-color)' : 'none'}; padding-left: ${level > 0 ? '10px' : '0'};"><img src="${avatar}" class="comment-avatar"><div class="comment-body"><div style="display: flex; justify-content: space-between;"><a href="/pages/perfil.html?id=${comment.user._id}" class="comment-author-link"><span class="comment-author">${comment.user.name}</span></a><small style="color: var(--text-secondary); font-size: 0.75rem;">${formatTimeAgo(comment.createdAt)}</small></div><p class="comment-text">${formattedText}</p><div class="comment-actions"><button class="comment-vote-btn ${isLiked}" data-action="like-comment" data-post-id="${postId}" data-comment-id="${comment._id}"><i class="fa-solid fa-thumbs-up"></i> ${likes.length}</button><button class="comment-vote-btn ${isDisliked}" data-action="dislike-comment" data-post-id="${postId}" data-comment-id="${comment._id}"><i class="fa-solid fa-thumbs-down"></i> ${dislikes.length}</button><button class="reply-btn" data-comment-id="${comment._id}" data-username="${comment.user.name}" style="background:none; border:none; color: var(--primary-color); cursor: pointer; font-weight: 600;">Responder</button></div></div></div>${childrenHtml}`;
    };

    // --- LÓGICA DA ENQUETE ---
    openPollBtn?.addEventListener('click', () => pollModal.classList.add('show'));
    closePollBtn?.addEventListener('click', () => pollModal.classList.remove('show'));
    window.addEventListener('click', (e) => { if (e.target === pollModal) pollModal.classList.remove('show'); });

    addOptionBtn?.addEventListener('click', () => {
        if (pollOptionsList.children.length >= 5) return showNotification('Máximo de 5 opções.', true);
        const input = document.createElement('input');
        input.type = 'text'; input.className = 'poll-option-input';
        input.style = "width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;";
        input.placeholder = `Opção ${pollOptionsList.children.length + 1}`;
        pollOptionsList.appendChild(input);
    });

    confirmPollBtn?.addEventListener('click', () => {
        const question = document.getElementById('pollQuestionInput').value.trim();
        const inputs = document.querySelectorAll('.poll-option-input');
        const options = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
        if (!question) return showNotification('Digite a pergunta.', true);
        if (options.length < 2) return showNotification('Mínimo de 2 opções.', true);
        tempPollData = { question, options };
        pollPreviewArea.style.display = 'block';
        document.getElementById('pollPreviewQuestion').textContent = question;
        pollModal.classList.remove('show');
    });

    removePollBtn?.addEventListener('click', () => {
        tempPollData = null;
        pollPreviewArea.style.display = 'none';
        document.getElementById('pollQuestionInput').value = '';
        pollOptionsList.innerHTML = `<input type="text" class="poll-option-input" placeholder="Opção 1" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;"><input type="text" class="poll-option-input" placeholder="Opção 2" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;">`;
    });

    const renderFeed = () => {
        feedContainer.innerHTML = '';
        if (allPosts.length === 0) { feedContainer.innerHTML = `<p style="text-align:center; padding: 2rem;">Ainda não há postagens.</p>`; return; }
        allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const mySaved = currentUser.savedPosts || [];

        allPosts.forEach(post => {
            if (!post || !post.user) return; 
            const postElement = document.createElement('div'); postElement.className = 'post-card card'; postElement.dataset.postId = post._id; 
            const postAvatar = getCleanImageUrl(post.user.avatar) || '/assets/profile-pic.png';
            const postMediaHtml = getPostMediaHtml(post.mediaUrls || post.imageUrl, post.linkPreview);
            const pollHtml = post.poll ? getPollHtml(post.poll, post._id, currentUser._id) : ''; 
            
            const likes = post.likes || [];
            const dislikes = post.dislikes || [];
            const isLiked = likes.includes(currentUser._id); 
            const isDisliked = dislikes.includes(currentUser._id);
            const likeClass = isLiked ? 'liked' : '';
            const dislikeClass = isDisliked ? 'disliked' : '';

            const isSaved = mySaved.includes(post._id);
            const saveClass = isSaved ? 'active' : '';
            const saveIcon = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

            let postActionButtons = '';
            if (post.user._id === currentUser._id) { 
                postActionButtons = `<div class="post-admin-actions"><button class="post-action-btn" data-action="edit-post"><i class="fa-solid fa-pencil"></i></button><button class="post-action-btn" data-action="delete-post"><i class="fa-solid fa-trash-can"></i></button></div>`; 
            } else {
                postActionButtons = `<button class="save-btn ${saveClass}" data-action="toggle-save" title="Salvar"><i class="${saveIcon}"></i></button>`;
            }
            
            const commentTree = buildCommentTree(post.comments || []);
            const commentsHtml = commentTree.map(c => renderCommentHTML(c, 0, post._id)).join(''); 
            
            let locationHtml = post.community ? `em <a href="/pages/community.html?id=${post.community._id}">c/${post.community.name}</a>` : `<span><i class="fa-solid fa-earth-americas"></i> No Perfil</span>`;
            
            postElement.innerHTML = `
                <div class="post-card-content">
                    <div class="post-header"><img src="${postAvatar}" alt="Avatar" class="post-avatar"><div><span class="post-author"><a href="/pages/perfil.html?id=${post.user._id}">${post.user.name}</a></span><span class="post-meta">${locationHtml} • ${formatTimeAgo(post.createdAt)}</span></div>${postActionButtons}</div>
                    <div class="post-content">${formatPostContent(post.content)}</div>
                    ${pollHtml}
                    ${postMediaHtml}
                </div>
                <div class="post-actions">
                    <div class="vote-buttons">
                        <button class="vote-btn upvote ${likeClass}" data-action="like"><i class="fa-solid fa-arrow-up"></i></button>
                        <span class="vote-count">${likes.length}</span>
                        <button class="vote-btn downvote ${dislikeClass}" data-action="dislike"><i class="fa-solid fa-arrow-down"></i></button>
                        <span class="vote-count">${dislikes.length}</span>
                    </div>
                    <button class="comment-button" data-action="toggle-comment"><i class="fa-regular fa-comment"></i> <span>${(post.comments || []).length}</span></button>
                    <button class="comment-button" data-action="share-post"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
                <div class="comments-section" style="display: none;">
                    <div class="reply-preview" style="display:none; background: var(--primary-extralight); padding: 5px 10px; border-radius: 5px; margin-bottom: 5px; font-size: 0.85rem; color: var(--primary-dark); align-items: center; justify-content: space-between;"><span>Respondendo a <b id="replyingToName"></b></span><button id="cancelReplyBtn" style="background:none; border:none; cursor:pointer; color: #ef4444;"><i class="fa-solid fa-xmark"></i></button></div>
                    <form class="comment-form" data-action="submit-comment"><input type="hidden" name="parentId" value=""><textarea class="comment-input mention-enabled" placeholder="Escreva seu comentário..."></textarea><button type="submit">Enviar</button></form>
                    <div class="comments-list">${commentsHtml}</div>
                </div>`;
            feedContainer.appendChild(postElement);
        });
    };

    createPostForm.addEventListener('submit', async (e) => { e.preventDefault(); const content = postContentInput.value; const communityId = postCommunitySelect.value || null; const files = postMediaFile.files; const urlInput = document.getElementById('postImageUrlInput').value.trim(); if (!content.trim() && !tempPollData) { showNotification('Vazio.', true); return; } const btn = createPostForm.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = '...'; try { let mediaUrls = []; if (files.length > 0) { mediaUrls = await uploadFileToStorage(files, 'posts'); } else if (urlInput) { mediaUrls = [urlInput]; } const newPost = await fetchWithAuth('/posts', { method: 'POST', body: JSON.stringify({ content, communityId, mediaUrls, poll: tempPollData }) }); if (!allPosts.some(p => p._id === newPost._id)) allPosts.unshift(newPost); renderFeed(); createPostForm.reset(); postCommunitySelect.value = ""; postMediaFile.value = ""; document.getElementById('postImageUrlInput').value = ""; removePollBtn.click(); showNotification('Criado!'); } catch (e) { showNotification(e.message, true); } finally { btn.disabled = false; btn.textContent = 'Publicar'; } });

    feedContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.dataset.action === 'toggle-save') {
            const postCard = btn.closest('.post-card');
            const postId = postCard.dataset.postId;
            const icon = btn.querySelector('i');
            const wasActive = btn.classList.contains('active');
            btn.classList.toggle('active');
            icon.className = wasActive ? 'fa-regular fa-bookmark' : 'fa-solid fa-bookmark';
            try {
                const response = await fetchWithAuth(`/users/save/${postId}`, { method: 'PUT' });
                currentUser.savedPosts = response.savedPosts;
                localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));
                showNotification(response.isSaved ? 'Post salvo!' : 'Removido dos favoritos.');
            } catch (error) {
                btn.classList.toggle('active');
                icon.className = !wasActive ? 'fa-regular fa-bookmark' : 'fa-solid fa-bookmark';
                showNotification('Erro ao salvar.', true);
            }
            return;
        }

        if (btn.dataset.action === 'like-comment' || btn.dataset.action === 'dislike-comment') {
            const postId = btn.dataset.postId;
            const commentId = btn.dataset.commentId;
            const type = btn.dataset.action === 'like-comment' ? 'like' : 'dislike';
            try {
                const updatedComments = await fetchWithAuth(`/posts/${postId}/comments/${commentId}/vote`, {
                    method: 'PUT',
                    body: JSON.stringify({ voteType: type })
                });
                const postIndex = allPosts.findIndex(p => p._id === postId);
                allPosts[postIndex].comments = updatedComments;
                renderFeed();
            } catch (error) { showNotification(error.message, true); }
            return;
        }

        if (btn.classList.contains('reply-btn')) { 
            const postCard = btn.closest('.post-card'); 
            const section = postCard.querySelector('.comments-section'); 
            const form = postCard.querySelector('.comment-form'); 
            const preview = postCard.querySelector('.reply-preview'); 
            section.style.display = 'block'; 
            form.querySelector('input[name="parentId"]').value = btn.dataset.commentId; 
            const textArea = form.querySelector('textarea');
            textArea.value = `@[${btn.dataset.username}](${btn.closest('.comment-body').querySelector('.comment-author-link').getAttribute('href').split('=')[1]}) `;
            postCard.querySelector('#replyingToName').textContent = btn.dataset.username; 
            preview.style.display = 'flex'; 
            textArea.focus(); 
            return; 
        }
        if (btn.id === 'cancelReplyBtn') { const postCard = btn.closest('.post-card'); postCard.querySelector('.reply-preview').style.display = 'none'; postCard.querySelector('.comment-form input[name="parentId"]').value = ''; postCard.querySelector('textarea').value = ''; return; }
        
        if (!btn.dataset.action) return;
        const action = btn.dataset.action;
        const postCard = btn.closest('.post-card');
        const postId = postCard.dataset.postId;
        const post = allPosts.find(p => p._id === postId);

        try {
            if (action === 'share-post') openShareModal(post);
            if (action === 'like' || action === 'dislike') { 
                const updatedVotes = await fetchWithAuth(`/posts/${postId}/vote`, { method: 'PUT', body: JSON.stringify({ voteType: action }) }); 
                post.likes = updatedVotes.likes; post.dislikes = updatedVotes.dislikes; 
                renderFeed(); 
            }
            if (action === 'toggle-comment') { const section = postCard.querySelector('.comments-section'); section.style.display = section.style.display === 'none' ? 'block' : 'none'; }
            if (action === 'edit-post') { editPostIdInput.value = post._id; editPostContentInput.value = post.content; editPostImageUrlInput.value = getCleanImageUrl(post.imageUrl) || ''; editPostModal.classList.add('show'); }
            if (action === 'delete-post') { if (confirm('Deletar?')) { await fetchWithAuth(`/posts/${postId}`, { method: 'DELETE' }); allPosts = allPosts.filter(p => p._id !== postId); renderFeed(); showNotification('Postagem deletada.'); } }
        } catch (error) { showNotification(error.message, true); }
    });

    feedContainer.addEventListener('submit', async (e) => { e.preventDefault(); const form = e.target.closest('form'); if (!form || form.dataset.action !== 'submit-comment') return; const postCard = e.target.closest('.post-card'); const postId = postCard.dataset.postId; const textarea = form.querySelector('.comment-input'); const parentInput = form.querySelector('input[name="parentId"]'); const text = textarea.value; const parentId = parentInput.value || null; if (!text.trim()) return; try { const updatedComments = await fetchWithAuth(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text, parentId }) }); const postIndex = allPosts.findIndex(p => p._id === postId); allPosts[postIndex].comments = updatedComments; renderFeed(); textarea.value = ''; parentInput.value = ''; const preview = postCard.querySelector('.reply-preview'); if (preview) preview.style.display = 'none'; } catch (error) { showNotification(error.message, true); } });
    const loadPageData = async () => { renderSkeletonFeed(); const user = await fetchWithAuth('/auth/me'); currentUser = user; localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser)); navUsername.textContent = currentUser.name; navUserPic.src = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png'; const trendingTags = await fetchWithAuth('/posts/trending'); renderTrendingTags(trendingTags); allPosts = await fetchWithAuth('/posts'); const communities = await fetchWithAuth('/communities'); postCommunitySelect.innerHTML = '<option value="" selected>Publicar no seu Perfil (Global)</option>'; communities.forEach(community => { if (community.members && community.members.includes(currentUser._id)) { const option = document.createElement('option'); option.value = community._id; option.textContent = `c/${community.name}`; postCommunitySelect.appendChild(option); } }); renderFeed(); };
    const openShareModal = async (post) => { currentPostToShare = post; sharePostModal.classList.add('show'); shareFriendList.innerHTML = '<p>Carregando...</p>'; try { if (myFriends.length === 0) { const userProfile = await fetchWithAuth('/auth/me'); const promises = userProfile.friends.map(fid => fetchWithAuth(`/users/${fid}`)); const friendsData = await Promise.all(promises); myFriends = friendsData.map(res => res.user); } renderFriendList(myFriends); } catch (error) { shareFriendList.innerHTML = '<p style="text-align: center;">Erro ao carregar amigos.</p>'; } };
    const renderFriendList = (friends) => { shareFriendList.innerHTML = ''; if (friends.length === 0) { shareFriendList.innerHTML = '<p style="text-align: center;">Você não tem amigos.</p>'; return; } friends.forEach(friend => { const avatar = getCleanImageUrl(friend.avatar) || '/assets/profile-pic.png'; const li = document.createElement('li'); li.className = 'share-user-item'; li.innerHTML = `<img src="${avatar}" class="share-avatar"><span class="share-name">${friend.name}</span><button class="share-btn-send" data-uid="${friend._id}">Enviar</button>`; li.querySelector('button').addEventListener('click', async (e) => { const btn = e.target; btn.textContent = '...'; btn.disabled = true; const commName = currentPostToShare.community ? currentPostToShare.community.name : 'Global'; const commId = currentPostToShare.community ? currentPostToShare.community._id : null; try { const sharedPostData = { _id: currentPostToShare._id, content: currentPostToShare.content, imageUrl: currentPostToShare.imageUrl, communityName: commName, authorName: currentPostToShare.user.name, communityId: commId }; await fetchWithAuth('/chat/message', { method: 'POST', body: JSON.stringify({ recipientId: friend._id, sharedPost: sharedPostData, text: '' }) }); btn.textContent = 'Enviado!'; setTimeout(() => { sharePostModal.classList.remove('show'); btn.textContent = 'Enviar'; btn.disabled = false; }, 800); } catch (error) { showNotification('Erro ao compartilhar.', true); btn.textContent = 'Erro'; } }); shareFriendList.appendChild(li); }); };
    shareSearchInput?.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); const filtered = myFriends.filter(f => f.name.toLowerCase().includes(term)); renderFriendList(filtered); });
    const renderTrendingTags = (tags) => { const container = document.getElementById('trendingListContainer'); if(container && tags) { container.innerHTML = ''; tags.forEach(tagData => { container.innerHTML += `<li class="trending-item"><a href="/pages/tag.html?tag=${tagData.tag}">#${tagData.tag}</a><span class="trending-count">${tagData.count} posts</span></li>`; }); } };
    const closePostModal = () => editPostModal.classList.remove('show'); closeEditPostModalBtn?.addEventListener('click', closePostModal); window.addEventListener('click', (e) => { if (e.target === editPostModal) closePostModal(); }); editPostForm.addEventListener('submit', async (e) => { e.preventDefault(); const postId = editPostIdInput.value; const content = editPostContentInput.value; let imageUrl = editPostImageUrlInput.value; if (imageUrl && imageUrl.startsWith(BASE_URL)) { imageUrl = imageUrl.substring(BASE_URL.length + 1); } try { const updatedPost = await fetchWithAuth(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify({ content, imageUrl }), }); const postIndex = allPosts.findIndex(p => p._id === postId); allPosts[postIndex] = updatedPost; renderFeed(); closePostModal(); showNotification('Atualizado!'); } catch (error) { showNotification(error.message, true); } });
    logoutButton.addEventListener('click', logout);

    // ADICIONADO: Botão de Sair Mobile
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);

    // === INICIALIZAR FERRAMENTAS ===
    setupMarkdownToolbar('postContentInput');
    setupGlobalMentionLogic();
});