// === Script para a Página de Comunidade Única (community.html) ===
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => { if (user) { loadPageData(); connectToNotificationSocket(); } else { window.location.href = '/pages/index.html'; } });

    const communityNameEl = document.getElementById('communityName'); const communityDescEl = document.getElementById('communityDescription'); const asideDescEl = document.getElementById('asideCommunityDescription'); const feedContainer = document.getElementById('feedContainer'); const postBoxCommunityName = document.getElementById('postBoxCommunityName'); const logoutButton = document.getElementById('logoutButton'); const navUsername = document.getElementById('navUsername'); const navUserPic = document.getElementById('navUserPic'); const createPostForm = document.getElementById('createPostForm'); const postContentInput = document.getElementById('postContentInput'); const postMediaFile = document.getElementById('postMediaFile'); const communityIcon = document.getElementById('communityIcon'); const joinBtn = document.getElementById('joinCommunityBtn'); const communityPostBox = document.getElementById('communityPostBox'); const feedDivider = document.getElementById('feedDivider'); const accessDeniedMessage = document.getElementById('accessDeniedMessage'); const adminRequestsContainer = document.getElementById('adminRequestsContainer'); const requestsList = document.getElementById('requestsList'); const editPostModal = document.getElementById('editPostModal'); const closeEditPostModalBtn = document.getElementById('closeEditPostModalBtn'); const editPostForm = document.getElementById('editPostForm'); const editPostIdInput = document.getElementById('editPostIdInput'); const editPostContentInput = document.getElementById('editPostContentInput'); const editPostImageUrlInput = document.getElementById('editPostImageUrlInput');
    const params = new URLSearchParams(window.location.search); const communityId = params.get('id'); if (!communityId) { showNotification('Erro', true); return; }
    let currentCommunity = null; let communityPosts = []; let currentUser = null; let notificationSocket = null;
    if (postMediaFile) postMediaFile.setAttribute('multiple', 'multiple');

    const connectToNotificationSocket = async () => { if (notificationSocket && notificationSocket.connected) return; const token = await getToken(); if (!token) return; notificationSocket = io(BASE_URL, { auth: { token } }); notificationSocket.on('newMessage', () => { const dot = document.getElementById('notificationDot'); if (dot) dot.style.display = 'block'; }); notificationSocket.on('new_post', (post) => { if (post.community._id === communityId && !communityPosts.some(p => p._id === post._id)) { communityPosts.unshift(post); renderFeed(communityPosts); } }); };
    const renderCommunityDetails = (community) => { document.title = `c/${community.name} - MASQUEKO`; const lockIcon = community.isPrivate ? '<i class="fa-solid fa-lock" style="font-size: 0.6em; vertical-align: middle;"></i>' : ''; communityNameEl.innerHTML = `c/${community.name} ${lockIcon}`; communityDescEl.textContent = community.description; asideDescEl.textContent = community.description; postBoxCommunityName.textContent = `c/${community.name}`; const imageUrl = getCleanImageUrl(community.imageUrl) || '/assets/logo-masqueko.png'; communityIcon.src = imageUrl; const statsContainer = document.querySelector('.community-stats'); statsContainer.innerHTML = `<div class="stat-item"><i class="fa-solid fa-user-group"></i> <strong>${community.members.length}</strong> membros</div>${community.isPrivate ? '<div class="stat-item"><i class="fa-solid fa-shield-halved"></i> Privada</div>' : '<div class="stat-item"><i class="fa-solid fa-globe"></i> Pública</div>'}`; if (!currentUser) return; const isMember = community.members.includes(currentUser._id); const isPending = (community.joinRequests || []).includes(currentUser._id); joinBtn.style.display = 'block'; joinBtn.className = 'navbar-button'; if (isMember) { joinBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Sair'; joinBtn.style.backgroundColor = '#ef4444'; } else if (isPending) { joinBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Pendente...'; joinBtn.style.backgroundColor = '#9ca3af'; } else { if (community.isPrivate) { joinBtn.innerHTML = '<i class="fa-solid fa-key"></i> Solicitar Entrada'; } else { joinBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Participar'; } joinBtn.style.backgroundColor = 'var(--primary-color)'; } if (!isMember) { communityPostBox.style.display = 'none'; feedDivider.style.display = 'none'; } else { communityPostBox.style.display = 'block'; feedDivider.style.display = 'block'; } if (community.isPrivate && !isMember && community.creator._id !== currentUser._id) { feedContainer.style.display = 'none'; accessDeniedMessage.style.display = 'block'; } else { feedContainer.style.display = 'block'; accessDeniedMessage.style.display = 'none'; } if (community.creator._id === currentUser._id && community.isPrivate) { loadJoinRequests(); } };
    const loadJoinRequests = async () => { try { const requests = await fetchWithAuth(`/communities/${communityId}/requests`); if (requests.length > 0) { adminRequestsContainer.style.display = 'block'; requestsList.innerHTML = ''; requests.forEach(user => { const avatar = getCleanImageUrl(user.avatar) || '/assets/profile-pic.png'; const item = document.createElement('div'); item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem;border-bottom:1px solid var(--border-color)'; item.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><img src="${avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"><span style="font-weight:600;">${user.name}</span></div><div style="display:flex;gap:5px;"><button class="accept-btn" data-uid="${user._id}" style="background:var(--primary-color);color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Aceitar</button><button class="reject-btn" data-uid="${user._id}" style="background:#ef4444;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Recusar</button></div>`; requestsList.appendChild(item); }); requestsList.querySelectorAll('.accept-btn').forEach(btn => btn.addEventListener('click', () => handleRequestAction(btn.dataset.uid, 'accept'))); requestsList.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', () => handleRequestAction(btn.dataset.uid, 'reject'))); } else { adminRequestsContainer.style.display = 'none'; } } catch (error) { console.error("Erro ao carregar pedidos:", error); } };
    const handleRequestAction = async (userId, action) => { try { await fetchWithAuth(`/communities/${communityId}/requests`, { method: 'PUT', body: JSON.stringify({ userId, action }) }); showNotification(action === 'accept' ? 'Aceito!' : 'Recusado.'); loadJoinRequests(); if(action === 'accept') loadPageData(); } catch (error) { showNotification(error.message, true); } };

    const renderFeed = (posts) => {
        feedContainer.innerHTML = '';
        if (!posts || posts.length === 0) { feedContainer.innerHTML = '<p class="user-list-placeholder">Ainda não há nenhuma postagem nesta comunidade.</p>'; return; }
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const mySaved = currentUser ? (currentUser.savedPosts || []) : [];

        posts.forEach(post => {
            if (!post || !post.user) return; 
            const postElement = document.createElement('div'); postElement.className = 'post-card card'; postElement.dataset.postId = post._id;
            const postAvatar = getCleanImageUrl(post.user.avatar) || '/assets/profile-pic.png'; const postMediaHtml = getPostMediaHtml(post.mediaUrls || post.imageUrl, post.linkPreview);
            
            const likes = post.likes || [];
            const dislikes = post.dislikes || [];
            const isLiked = currentUser && likes.includes(currentUser._id); 
            const isDisliked = currentUser && dislikes.includes(currentUser._id);
            const likeClass = isLiked ? 'liked' : '';
            const dislikeClass = isDisliked ? 'disliked' : '';

            // Botão Salvar (e Admin)
            const isSaved = mySaved.includes(post._id);
            const saveClass = isSaved ? 'active' : '';
            const saveIcon = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

            let postActionButtons = ''; 
            if (currentUser && post.user._id === currentUser._id) { 
                postActionButtons = `<div class="post-admin-actions"><button class="post-action-btn" data-action="edit-post"><i class="fa-solid fa-pencil"></i></button><button class="post-action-btn" data-action="delete-post"><i class="fa-solid fa-trash-can"></i></button></div>`; 
            } else {
                postActionButtons = `<button class="save-btn ${saveClass}" data-action="toggle-save" title="Salvar"><i class="${saveIcon}"></i></button>`;
            }
            
            const commentsHtml = (post.comments || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(c => {
                return `<div class="comment"><img src="${getCleanImageUrl(c.user.avatar)}" class="comment-avatar"><div class="comment-body"><a href="/pages/perfil.html?id=${c.user._id}" class="comment-author-link"><span class="comment-author">${c.user.name}</span></a><p class="comment-text">${formatPostContent(c.text)}</p></div></div>`;
            }).join('');

            postElement.innerHTML = `
                <div class="post-card-content">
                    <div class="post-header"><img src="${postAvatar}" alt="Avatar" class="post-avatar"><div><span class="post-author"><a href="/pages/perfil.html?id=${post.user._id}">${post.user.name}</a></span><span class="post-meta">${formatTimeAgo(post.createdAt)}</span></div>${postActionButtons}</div>
                    <div class="post-content">${formatPostContent(post.content)}</div>
                    ${postMediaHtml}
                </div>
                <div class="post-actions">
                    <div class="vote-buttons">
                        <button class="vote-btn upvote ${likeClass}" data-action="like"><i class="fa-solid fa-arrow-up"></i></button>
                        <span class="vote-count">${likes.length}</span>
                        <button class="vote-btn downvote ${dislikeClass}" data-action="dislike"><i class="fa-solid fa-arrow-down"></i></button>
                        <span class="vote-count">${dislikes.length}</span>
                    </div>
                    <button class="comment-button" data-action="toggle-comment"><i class="fa-regular fa-comment"></i> <span>${(post.comments || []).length} Comentários</span></button>
                </div>
                <div class="comments-section" style="display: none;"><form class="comment-form" data-action="submit-comment"><textarea class="comment-input" placeholder="Escreva seu comentário..."></textarea><button type="submit">Enviar</button></form><div class="comments-list">${commentsHtml}</div></div>`;
            feedContainer.appendChild(postElement);
        });
    };

    const loadPageData = async () => { try { const [user, communityData] = await Promise.all([fetchWithAuth('/auth/me'), fetchWithAuth(`/communities/${communityId}`)]); currentUser = user; currentCommunity = communityData.community; communityPosts = communityData.posts; const avatarUrl = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png'; navUsername.textContent = user.name; navUserPic.src = avatarUrl; renderCommunityDetails(currentCommunity); if (communityPosts) { renderFeed(communityPosts); } } catch (error) { if (error.message.includes('404')) { if (!currentUser) { logout(); return; } showNotification('Comunidade não encontrada.', true); setTimeout(() => { window.location.href = '/pages/comunidades.html'; }, 2000); } else { showNotification(error.message, true); } } };
    joinBtn.addEventListener('click', async () => { joinBtn.disabled = true; try { const response = await fetchWithAuth(`/communities/${communityId}/join`, { method: 'PUT' }); showNotification(response.message); currentCommunity.members = response.members; currentCommunity.joinRequests = response.joinRequests; renderCommunityDetails(currentCommunity); if (response.status === 'joined' && currentCommunity.isPrivate) { loadPageData(); } } catch (error) { showNotification(error.message, true); } finally { joinBtn.disabled = false; } });
    createPostForm.addEventListener('submit', async (e) => { e.preventDefault(); const content = postContentInput.value; const files = postMediaFile.files; const urlInput = document.getElementById('postImageUrlInput').value.trim(); const submitButton = createPostForm.querySelector('button[type="submit"]'); if (!content.trim()) { showNotification('Vazio.', true); return; } submitButton.disabled = true; submitButton.textContent = 'Enviando...'; try { let mediaUrls = []; if (files.length > 0) { mediaUrls = await uploadFileToStorage(files, 'posts'); } else if (urlInput) { mediaUrls = [urlInput]; } const newPostData = await fetchWithAuth('/posts', { method: 'POST', body: JSON.stringify({ content, communityId, mediaUrls }), }); if (!communityPosts) communityPosts = []; communityPosts.unshift(newPostData); renderFeed(communityPosts); createPostForm.reset(); postMediaFile.value = ""; document.getElementById('postImageUrlInput').value = ""; showNotification('Postado!'); } catch (error) { showNotification(error.message, true); } finally { submitButton.disabled = false; submitButton.textContent = 'Publicar'; } });
    
    feedContainer.addEventListener('click', async (e) => { 
        const btn = e.target.closest('button'); 
        if (!btn || !btn.dataset.action) return; 
        const action = btn.dataset.action; 
        const postCard = e.target.closest('.post-card'); 
        const postId = postCard.dataset.postId; 
        const post = communityPosts.find(p => p._id === postId); 
        if (action === 'edit-post' && !editPostModal) { showNotification('Erro modal.', true); return; } 
        
        try { 
            // Lógica de Salvar Post
            if (action === 'toggle-save') {
                const icon = btn.querySelector('i');
                const wasActive = btn.classList.contains('active');
                btn.classList.toggle('active');
                icon.className = wasActive ? 'fa-regular fa-bookmark' : 'fa-solid fa-bookmark';
                try {
                    const response = await fetchWithAuth(`/users/save/${postId}`, { method: 'PUT' });
                    currentUser.savedPosts = response.savedPosts;
                    showNotification(response.isSaved ? 'Post salvo!' : 'Removido dos favoritos.');
                } catch (error) {
                    btn.classList.toggle('active');
                    icon.className = !wasActive ? 'fa-regular fa-bookmark' : 'fa-solid fa-bookmark';
                    showNotification('Erro ao salvar.', true);
                }
                return;
            }

            if (action === 'like' || action === 'dislike') { const updatedVotes = await fetchWithAuth(`/posts/${postId}/vote`, { method: 'PUT', body: JSON.stringify({ voteType: action }) }); post.likes = updatedVotes.likes; post.dislikes = updatedVotes.dislikes; renderFeed(communityPosts); } 
            if (action === 'toggle-comment') { const commentsSection = postCard.querySelector('.comments-section'); commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none'; } 
            if (action === 'edit-post') { editPostIdInput.value = post._id; editPostContentInput.value = post.content; editPostImageUrlInput.value = getCleanImageUrl(post.imageUrl) || ''; editPostModal.classList.add('show'); } 
            if (action === 'delete-post') { if (confirm('Deletar?')) { await fetchWithAuth(`/posts/${postId}`, { method: 'DELETE' }); communityPosts = communityPosts.filter(p => p._id !== postId); renderFeed(communityPosts); showNotification('Deletado.'); } } 
        } catch (error) { showNotification(error.message, true); } 
    });
    
    feedContainer.addEventListener('submit', async (e) => { e.preventDefault(); const form = e.target.closest('form'); if (!form || form.dataset.action !== 'submit-comment') return; const postCard = e.target.closest('.post-card'); const postId = postCard.dataset.postId; const textarea = form.querySelector('.comment-input'); const text = textarea.value; if (!text.trim()) return; try { const updatedComments = await fetchWithAuth(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) }); const postIndex = communityPosts.findIndex(p => p._id === postId); communityPosts[postIndex].comments = updatedComments; renderFeed(communityPosts); textarea.value = ''; } catch (error) { showNotification(error.message, true); } });
    if (editPostModal) { const closePostModal = () => editPostModal.classList.remove('show'); closeEditPostModalBtn?.addEventListener('click', closePostModal); window.addEventListener('click', (e) => { if (e.target === editPostModal) closePostModal(); }); editPostForm.addEventListener('submit', async (e) => { e.preventDefault(); const postId = editPostIdInput.value; const content = editPostContentInput.value; let imageUrl = editPostImageUrlInput.value; if (imageUrl && imageUrl.startsWith(BASE_URL)) { imageUrl = imageUrl.substring(BASE_URL.length + 1); } try { const updatedPost = await fetchWithAuth(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify({ content, imageUrl }), }); const postIndex = communityPosts.findIndex(p => p._id === postId); communityPosts[postIndex] = updatedPost; renderFeed(communityPosts); closePostModal(); showNotification('Atualizado!'); } catch (error) { showNotification(error.message, true); } }); }
    logoutButton.addEventListener('click', logout);

    // === INICIALIZAR FERRAMENTAS ===
    setupMarkdownToolbar('postContentInput');
});