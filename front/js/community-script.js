// === Script para a Página de Comunidade Única (community.html) ===
document.addEventListener('DOMContentLoaded', () => {
    // Verificar Autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            loadPageData();
            connectToNotificationSocket();
        } else {
            window.location.href = '/pages/index.html';
        }
    });

    // --- SELETORES DO DOM ---
    const communityNameEl = document.getElementById('communityName');
    const communityDescEl = document.getElementById('communityDescription');
    const asideDescEl = document.getElementById('asideCommunityDescription');
    const feedContainer = document.getElementById('feedContainer');
    const postBoxCommunityName = document.getElementById('postBoxCommunityName');
    const logoutButton = document.getElementById('logoutButton');
    const navUsername = document.getElementById('navUsername');
    const navUserPic = document.getElementById('navUserPic');
    const createPostForm = document.getElementById('createPostForm');
    const postContentInput = document.getElementById('postContentInput');
    const postMediaFile = document.getElementById('postMediaFile');
    const communityIcon = document.getElementById('communityIcon');
    const joinBtn = document.getElementById('joinCommunityBtn');
    const communityPostBox = document.getElementById('communityPostBox');
    const feedDivider = document.getElementById('feedDivider');
    const accessDeniedMessage = document.getElementById('accessDeniedMessage');
    const adminRequestsContainer = document.getElementById('adminRequestsContainer');
    const requestsList = document.getElementById('requestsList');

    // Modais e seus botões
    const editPostModal = document.getElementById('editPostModal');
    const closeEditPostModalBtn = document.getElementById('closeEditPostModalBtn');
    const editPostForm = document.getElementById('editPostForm');
    const editPostIdInput = document.getElementById('editPostIdInput');
    const editPostContentInput = document.getElementById('editPostContentInput');
    const editPostImageUrlInput = document.getElementById('editPostImageUrlInput');

    const sharePostModal = document.getElementById('sharePostModal');
    const closeShareModalBtn = document.getElementById('closeShareModalBtn');
    const shareFriendList = document.getElementById('shareFriendList');
    const shareSearchInput = document.getElementById('shareSearchInput');

    const pollModal = document.getElementById('createPollModal');
    const openPollBtn = document.getElementById('openPollModalBtn');
    const closePollBtn = document.getElementById('closePollModalBtn');
    const addOptionBtn = document.getElementById('addPollOptionBtn');
    const confirmPollBtn = document.getElementById('confirmPollBtn');
    const pollOptionsList = document.getElementById('pollOptionsList');
    const pollPreviewArea = document.getElementById('pollPreviewArea');
    const removePollBtn = document.getElementById('removePollBtn');

    const repostModal = document.getElementById('repostModal');
    const closeRepostModalBtn = document.getElementById('closeRepostModalBtn');
    const repostForm = document.getElementById('repostForm');
    const repostPostIdInput = document.getElementById('repostPostIdInput');
    const repostCommentInput = document.getElementById('repostCommentInput');

    // Estado da Aplicação
    let tempPollData = null;
    let currentPostToShare = null;
    let myFriends = [];
    let currentCommunity = null;
    let communityPosts = [];
    let currentUser = null;
    let notificationSocket = null;

    // Pega ID da URL
    const params = new URLSearchParams(window.location.search);
    const communityId = params.get('id');

    if (!communityId) {
        showNotification('Erro: Comunidade não especificada.', true);
        setTimeout(() => window.location.href = '/pages/comunidades.html', 2000);
        return;
    }

    if (postMediaFile) postMediaFile.setAttribute('multiple', 'multiple');

    // --- FUNÇÕES DE MODAL ---
    const closeAllModals = () => {
        if (editPostModal) editPostModal.classList.remove('show');
        if (sharePostModal) sharePostModal.classList.remove('show');
        if (pollModal) pollModal.classList.remove('show');
        if (repostModal) repostModal.classList.remove('show');
    };

    if (closeEditPostModalBtn) closeEditPostModalBtn.addEventListener('click', closeAllModals);
    if (closeShareModalBtn) closeShareModalBtn.addEventListener('click', closeAllModals);
    if (closePollBtn) closePollBtn.addEventListener('click', closeAllModals);
    if (closeRepostModalBtn) closeRepostModalBtn.addEventListener('click', closeAllModals);

    window.addEventListener('click', (e) => {
        if (e.target === editPostModal || e.target === sharePostModal || e.target === pollModal || e.target === repostModal) {
            closeAllModals();
        }
    });

    // --- SOCKET IO ---
    const connectToNotificationSocket = async () => {
        if (notificationSocket && notificationSocket.connected) return;
        const token = await getToken();
        if (!token) return;
        notificationSocket = io(BASE_URL, { auth: { token } });
        notificationSocket.on('newMessage', () => {
            const dot = document.getElementById('notificationDot');
            if (dot) dot.style.display = 'block';
        });
        notificationSocket.on('new_post', (post) => {
            if (post.community && post.community._id === communityId) {
                // Evita duplicatas
                if (!communityPosts.some(p => p._id === post._id)) {
                    communityPosts.unshift(post);
                    renderFeed(communityPosts);
                }
            }
        });
    };

    // --- RENDERIZAÇÃO DA COMUNIDADE ---
    const renderCommunityDetails = (community) => {
        document.title = `c/${community.name} - MASQUEKO`;
        
        const lockIcon = community.isPrivate ? '<i class="fa-solid fa-lock" style="font-size: 0.6em; vertical-align: middle;"></i>' : '';
        communityNameEl.innerHTML = `c/${community.name} ${lockIcon}`;
        
        communityDescEl.textContent = community.description || 'Sem descrição.';
        asideDescEl.textContent = community.description || 'Sem descrição.';
        postBoxCommunityName.textContent = `c/${community.name}`;
        
        const imageUrl = getCleanImageUrl(community.imageUrl) || '/assets/logo-masqueko.png';
        communityIcon.src = imageUrl;

        // Stats
        const statsContainer = document.querySelector('.community-stats');
        statsContainer.innerHTML = `
            <div class="stat-item"><i class="fa-solid fa-user-group"></i> <strong>${(community.members || []).length}</strong> membros</div>
            ${community.isPrivate ? '<div class="stat-item"><i class="fa-solid fa-shield-halved"></i> Privada</div>' : '<div class="stat-item"><i class="fa-solid fa-globe"></i> Pública</div>'}
        `;

        if (!currentUser) return;

        const isMember = (community.members || []).includes(currentUser._id);
        const isPending = (community.joinRequests || []).includes(currentUser._id);
        const isCreator = community.creator._id === currentUser._id;

        // Botão Participar
        joinBtn.style.display = 'block';
        joinBtn.className = 'navbar-button';

        if (isMember) {
            if (isCreator) {
                joinBtn.innerHTML = '<i class="fa-solid fa-crown"></i> Criador';
                joinBtn.disabled = true;
                joinBtn.style.backgroundColor = '#fbbf24'; // Dourado
                joinBtn.style.color = '#000';
            } else {
                joinBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Sair';
                joinBtn.style.backgroundColor = '#ef4444';
            }
        } else if (isPending) {
            joinBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Pendente...';
            joinBtn.style.backgroundColor = '#9ca3af';
            joinBtn.disabled = true;
        } else {
            if (community.isPrivate) {
                joinBtn.innerHTML = '<i class="fa-solid fa-key"></i> Solicitar Entrada';
            } else {
                joinBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Participar';
            }
            joinBtn.style.backgroundColor = 'var(--primary-color)';
            joinBtn.disabled = false;
        }

        // Visibilidade do Feed
        if (!isMember) {
            communityPostBox.style.display = 'none';
            feedDivider.style.display = 'none';
        } else {
            communityPostBox.style.display = 'block';
            feedDivider.style.display = 'block';
        }

        if (community.isPrivate && !isMember && !isCreator) {
            feedContainer.style.display = 'none';
            accessDeniedMessage.style.display = 'block';
        } else {
            feedContainer.style.display = 'block';
            accessDeniedMessage.style.display = 'none';
        }

        // Painel Admin (se for o dono)
        if (isCreator && community.isPrivate) {
            loadJoinRequests();
        } else {
            adminRequestsContainer.style.display = 'none';
        }
    };

    const loadJoinRequests = async () => {
        try {
            const requests = await fetchWithAuth(`/communities/${communityId}/requests`);
            if (requests && requests.length > 0) {
                adminRequestsContainer.style.display = 'block';
                requestsList.innerHTML = '';
                requests.forEach(user => {
                    const avatar = getCleanImageUrl(user.avatar) || '/assets/profile-pic.png';
                    const item = document.createElement('div');
                    item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem;border-bottom:1px solid var(--border-color)';
                    item.innerHTML = `
                        <div style="display:flex;align-items:center;gap:10px;">
                            <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
                            <span style="font-weight:600;">${user.name}</span>
                        </div>
                        <div style="display:flex;gap:5px;">
                            <button class="accept-btn" data-uid="${user._id}" style="background:var(--primary-color);color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Aceitar</button>
                            <button class="reject-btn" data-uid="${user._id}" style="background:#ef4444;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Recusar</button>
                        </div>`;
                    requestsList.appendChild(item);
                });

                requestsList.querySelectorAll('.accept-btn').forEach(btn => 
                    btn.addEventListener('click', () => handleRequestAction(btn.dataset.uid, 'accept'))
                );
                requestsList.querySelectorAll('.reject-btn').forEach(btn => 
                    btn.addEventListener('click', () => handleRequestAction(btn.dataset.uid, 'reject'))
                );
            } else {
                adminRequestsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error("Erro ao carregar pedidos:", error);
        }
    };

    const handleRequestAction = async (userId, action) => {
        try {
            await fetchWithAuth(`/communities/${communityId}/requests`, { 
                method: 'PUT', 
                body: JSON.stringify({ userId, action }) 
            });
            showNotification(action === 'accept' ? 'Aceito!' : 'Recusado.');
            loadJoinRequests();
            if(action === 'accept') {
                // Recarrega dados para atualizar contagem
                const updatedCommunity = await fetchWithAuth(`/communities/${communityId}`);
                currentCommunity = updatedCommunity.community;
                renderCommunityDetails(currentCommunity);
            }
        } catch (error) {
            showNotification(error.message, true);
        }
    };

    // --- RENDERIZAÇÃO DO FEED (COM VERIFICADO) ---
    const renderFeed = (posts) => {
        feedContainer.innerHTML = '';
        if (!posts || posts.length === 0) {
            feedContainer.innerHTML = '<p class="user-list-placeholder">Ainda não há nenhuma postagem nesta comunidade.</p>';
            return;
        }

        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const mySaved = currentUser ? (currentUser.savedPosts || []) : [];

        posts.forEach(post => {
            if (!post || !post.user) return;

            const postElement = document.createElement('div');
            postElement.className = 'post-card card';
            postElement.dataset.postId = post._id;

            const postAvatar = getCleanImageUrl(post.user.avatar) || '/assets/profile-pic.png';

            // --- VERIFICADO NO POST PRINCIPAL ---
            const userVerified = post.user.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; font-size: 0.8em; margin-left: 4px;" title="Verificado"></i>' : '';

            // --- CONTEÚDO (NORMAL OU REPOST) ---
            let mainContentHtml = '';
            if (post.repostData) {
                const r = post.repostData;
                const rVerified = (r.user && r.user.isVerified) ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; font-size: 0.8em; margin-left: 4px;" title="Verificado"></i>' : '';
                const rAvatar = getCleanImageUrl(r.user.avatar) || '/assets/profile-pic.png';
                
                mainContentHtml = `
                    <div class="post-content" style="margin-bottom:10px;">${formatPostContent(post.content)}</div>
                    <div class="repost-wrapper" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 8px; background: var(--surface-color);">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.9rem;">
                            <img src="${rAvatar}" style="width: 24px; height: 24px; border-radius: 50%;">
                            <span style="font-weight: 600;">${r.user.name} ${rVerified}</span>
                            <span style="color: var(--text-secondary);">• Post Original</span>
                        </div>
                        <div class="post-content">${formatPostContent(r.content)}</div>
                        ${r.poll ? getPollHtml(r.poll, r._id, currentUser._id) : ''}
                        ${getPostMediaHtml(r.mediaUrls || r.imageUrl, null)}
                    </div>
                `;
            } else {
                mainContentHtml = `
                    <div class="post-content">${formatPostContent(post.content)}</div>
                    ${post.poll ? getPollHtml(post.poll, post._id, currentUser._id) : ''}
                    ${getPostMediaHtml(post.mediaUrls || post.imageUrl, post.linkPreview)}
                `;
            }

            const likes = post.likes || [];
            const dislikes = post.dislikes || [];
            const isLiked = currentUser && likes.includes(currentUser._id);
            const isDisliked = currentUser && dislikes.includes(currentUser._id);
            
            const likeClass = isLiked ? 'liked' : '';
            const dislikeClass = isDisliked ? 'disliked' : '';

            const isSaved = mySaved.includes(post._id);
            const saveClass = isSaved ? 'active' : '';
            const saveIcon = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

            let postActionButtons = '';
            if (currentUser && post.user._id === currentUser._id) {
                postActionButtons = `<div class="post-admin-actions"><button class="post-action-btn" data-action="edit-post"><i class="fa-solid fa-pencil"></i></button><button class="post-action-btn" data-action="delete-post"><i class="fa-solid fa-trash-can"></i></button></div>`;
            } else {
                postActionButtons = `<button class="save-btn ${saveClass}" data-action="toggle-save" title="Salvar"><i class="${saveIcon}"></i></button>`;
            }

            // Comentários
            const commentsHtml = (post.comments || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(c => {
                const cVerified = (c.user && c.user.isVerified) ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; font-size: 0.8em; margin-left: 4px;" title="Verificado"></i>' : '';
                return `<div class="comment"><img src="${getCleanImageUrl(c.user.avatar)}" class="comment-avatar"><div class="comment-body"><a href="/pages/perfil.html?id=${c.user._id}" class="comment-author-link"><span class="comment-author">${c.user.name} ${cVerified}</span></a><p class="comment-text">${formatPostContent(c.text)}</p></div></div>`;
            }).join('');

            postElement.innerHTML = `
                <div class="post-card-content">
                    <div class="post-header">
                        <img src="${postAvatar}" alt="Avatar" class="post-avatar">
                        <div>
                            <span class="post-author"><a href="/pages/perfil.html?id=${post.user._id}">${post.user.name}</a> ${userVerified}</span>
                            ${post.repostData ? '<span style="font-size:0.75rem; color:var(--text-secondary); margin-left:5px;"><i class="fa-solid fa-retweet"></i> Repostou</span>' : ''}
                            <span class="post-meta">${formatTimeAgo(post.createdAt)}</span>
                        </div>
                        ${postActionButtons}
                    </div>
                    ${mainContentHtml}
                </div>
                <div class="post-actions">
                    <div class="vote-buttons">
                        <button class="vote-btn upvote ${likeClass}" data-action="like"><i class="fa-solid fa-arrow-up"></i></button>
                        <span class="vote-count">${likes.length}</span>
                        <button class="vote-btn downvote ${dislikeClass}" data-action="dislike"><i class="fa-solid fa-arrow-down"></i></button>
                        <span class="vote-count">${dislikes.length}</span>
                    </div>
                    <button class="comment-button" data-action="toggle-comment"><i class="fa-regular fa-comment"></i> <span>${(post.comments || []).length} Comentários</span></button>
                    <button class="comment-button" data-action="repost" title="Repostar"><i class="fa-solid fa-retweet"></i></button>
                    <button class="comment-button" data-action="share-post"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
                <div class="comments-section" style="display: none;">
                    <form class="comment-form" data-action="submit-comment">
                        <textarea class="comment-input" placeholder="Escreva seu comentário..."></textarea>
                        <button type="submit">Enviar</button>
                    </form>
                    <div class="comments-list">${commentsHtml}</div>
                </div>`;
            
            feedContainer.appendChild(postElement);
        });
    };

    const loadPageData = async () => {
        try {
            const [user, communityData] = await Promise.all([
                fetchWithAuth('/auth/me'),
                fetchWithAuth(`/communities/${communityId}`)
            ]);

            currentUser = user;
            currentCommunity = communityData.community;
            communityPosts = communityData.posts;

            const avatarUrl = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png';
            
            // Verificado na Navbar
            const navVerified = currentUser.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; margin-left: 5px;"></i>' : '';
            navUsername.innerHTML = `${currentUser.name} ${navVerified}`;
            navUserPic.src = avatarUrl;

            renderCommunityDetails(currentCommunity);
            if (communityPosts) {
                renderFeed(communityPosts);
            }

        } catch (error) {
            if (error.message.includes('404')) {
                if (!currentUser) { logout(); return; }
                showNotification('Comunidade não encontrada.', true);
                setTimeout(() => { window.location.href = '/pages/comunidades.html'; }, 2000);
            } else {
                showNotification(error.message, true);
            }
        }
    };

    // --- ENQUETES (Event Listeners) ---
    if (openPollBtn) openPollBtn.addEventListener('click', () => pollModal.classList.add('show'));
    if (addOptionBtn) addOptionBtn.addEventListener('click', () => {
        if (pollOptionsList.children.length >= 5) return showNotification('Máximo de 5 opções.', true);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'poll-option-input';
        input.style = "width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;";
        input.placeholder = `Opção ${pollOptionsList.children.length + 1}`;
        pollOptionsList.appendChild(input);
    });
    if (confirmPollBtn) confirmPollBtn.addEventListener('click', () => {
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
    if (removePollBtn) removePollBtn.addEventListener('click', () => {
        tempPollData = null;
        pollPreviewArea.style.display = 'none';
        document.getElementById('pollQuestionInput').value = '';
        pollOptionsList.innerHTML = `<input type="text" class="poll-option-input" placeholder="Opção 1" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;"><input type="text" class="poll-option-input" placeholder="Opção 2" required style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;">`;
    });

    // --- CREATE POST ---
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = postContentInput.value;
        const files = postMediaFile.files;
        const urlInput = document.getElementById('postImageUrlInput').value.trim();
        const submitButton = createPostForm.querySelector('button[type="submit"]');

        if (!content.trim() && !tempPollData) { showNotification('Vazio.', true); return; }

        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        try {
            let mediaUrls = [];
            if (files.length > 0) {
                mediaUrls = await uploadFileToStorage(files, 'posts');
            } else if (urlInput) {
                mediaUrls = [urlInput];
            }

            // ID da comunidade sempre válido
            const safeCommunityId = (communityId && communityId !== "undefined") ? communityId : null;

            const newPostData = await fetchWithAuth('/posts', {
                method: 'POST',
                body: JSON.stringify({ content, communityId: safeCommunityId, mediaUrls, poll: tempPollData }),
            });

            if (!communityPosts) communityPosts = [];
            communityPosts.unshift(newPostData);
            renderFeed(communityPosts);
            createPostForm.reset();
            postMediaFile.value = "";
            document.getElementById('postImageUrlInput').value = "";
            removePollBtn.click();
            showNotification('Postado!');
        } catch (error) {
            showNotification(error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Publicar';
        }
    });

    // --- FEED ACTIONS ---
    feedContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.action) return;

        // REPOST
        if (btn.dataset.action === 'repost') {
            const postCard = btn.closest('.post-card');
            const postId = postCard.dataset.postId;
            repostPostIdInput.value = postId;
            repostCommentInput.value = '';
            repostModal.classList.add('show');
            return;
        }

        if (btn.dataset.action === 'share-post') {
            const postCard = btn.closest('.post-card');
            const postId = postCard.dataset.postId;
            const post = communityPosts.find(p => p._id === postId);
            openShareModal(post);
            return;
        }

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
                showNotification(response.isSaved ? 'Post salvo!' : 'Removido dos favoritos.');
            } catch (error) {
                btn.classList.toggle('active');
                icon.className = !wasActive ? 'fa-regular fa-bookmark' : 'fa-solid fa-bookmark';
                showNotification('Erro ao salvar.', true);
            }
            return;
        }

        const action = btn.dataset.action;
        const postCard = btn.closest('.post-card');
        const postId = postCard.dataset.postId;
        const post = communityPosts.find(p => p._id === postId);

        try {
            if (action === 'like' || action === 'dislike') {
                const updatedVotes = await fetchWithAuth(`/posts/${postId}/vote`, { method: 'PUT', body: JSON.stringify({ voteType: action }) });
                post.likes = updatedVotes.likes;
                post.dislikes = updatedVotes.dislikes;
                renderFeed(communityPosts);
            }
            if (action === 'toggle-comment') {
                const commentsSection = postCard.querySelector('.comments-section');
                commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
            }
            if (action === 'edit-post') {
                editPostIdInput.value = post._id;
                editPostContentInput.value = post.content;
                editPostImageUrlInput.value = getCleanImageUrl(post.imageUrl) || '';
                editPostModal.classList.add('show');
            }
            if (action === 'delete-post') {
                if (confirm('Deletar?')) {
                    await fetchWithAuth(`/posts/${postId}`, { method: 'DELETE' });
                    communityPosts = communityPosts.filter(p => p._id !== postId);
                    renderFeed(communityPosts);
                    showNotification('Deletado.');
                }
            }
        } catch (error) {
            showNotification(error.message, true);
        }
    });

    feedContainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target.closest('form');
        if (!form || form.dataset.action !== 'submit-comment') return;
        const postCard = e.target.closest('.post-card');
        const postId = postCard.dataset.postId;
        const textarea = form.querySelector('.comment-input');
        const text = textarea.value;
        if (!text.trim()) return;
        try {
            const updatedComments = await fetchWithAuth(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
            const postIndex = communityPosts.findIndex(p => p._id === postId);
            communityPosts[postIndex].comments = updatedComments;
            renderFeed(communityPosts);
            textarea.value = '';
        } catch (error) {
            showNotification(error.message, true);
        }
    });

    // SUBMIT REPOST
    repostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const postId = repostPostIdInput.value;
        const comment = repostCommentInput.value;
        const btn = repostForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const repost = await fetchWithAuth(`/posts/${postId}/repost`, { method: 'POST', body: JSON.stringify({ content: comment }) });
            if (!communityPosts.some(p => p._id === repost._id)) {
                communityPosts.unshift(repost);
                renderFeed(communityPosts);
            }
            repostModal.classList.remove('show');
            showNotification('Publicação repostada com sucesso!');
        } catch (error) {
            showNotification('Erro ao repostar.', true);
        } finally {
            btn.disabled = false;
        }
    });

    if (editPostModal) {
        const closePostModal = () => editPostModal.classList.remove('show');
        if (closeEditPostModalBtn) closeEditPostModalBtn.addEventListener('click', closePostModal);
        editPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const postId = editPostIdInput.value;
            const content = editPostContentInput.value;
            let imageUrl = editPostImageUrlInput.value;
            if (imageUrl && imageUrl.startsWith(BASE_URL)) {
                imageUrl = imageUrl.substring(BASE_URL.length + 1);
            }
            try {
                const updatedPost = await fetchWithAuth(`/posts/${postId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ content, imageUrl }),
                });
                const postIndex = communityPosts.findIndex(p => p._id === postId);
                communityPosts[postIndex] = updatedPost;
                renderFeed(communityPosts);
                closePostModal();
                showNotification('Atualizado!');
            } catch (error) {
                showNotification(error.message, true);
            }
        });
    }

    // --- COMPARTILHAR ---
    const openShareModal = async (post) => {
        currentPostToShare = post;
        sharePostModal.classList.add('show');
        shareFriendList.innerHTML = '<p>Carregando...</p>';
        try {
            if (myFriends.length === 0) {
                const userProfile = await fetchWithAuth('/auth/me');
                const promises = userProfile.friends.map(fid => fetchWithAuth(`/users/${fid}`));
                const friendsData = await Promise.all(promises);
                myFriends = friendsData.map(res => res.user);
            }
            renderFriendList(myFriends);
        } catch (error) {
            shareFriendList.innerHTML = '<p style="text-align: center;">Erro ao carregar amigos.</p>';
        }
    };

    const renderFriendList = (friends) => {
        shareFriendList.innerHTML = '';
        if (friends.length === 0) {
            shareFriendList.innerHTML = '<p style="text-align: center;">Você não tem amigos.</p>';
            return;
        }
        friends.forEach(friend => {
            const avatar = getCleanImageUrl(friend.avatar) || '/assets/profile-pic.png';
            const li = document.createElement('li');
            li.className = 'share-user-item';
            li.innerHTML = `<img src="${avatar}" class="share-avatar"><span class="share-name">${friend.name}</span><button class="share-btn-send" data-uid="${friend._id}">Enviar</button>`;
            li.querySelector('button').addEventListener('click', async (e) => {
                const btn = e.target;
                btn.textContent = '...';
                btn.disabled = true;
                const commName = currentPostToShare.community ? currentPostToShare.community.name : 'Global';
                const commId = currentPostToShare.community ? currentPostToShare.community._id : null;
                try {
                    const sharedPostData = { _id: currentPostToShare._id, content: currentPostToShare.content, imageUrl: currentPostToShare.imageUrl, communityName: commName, authorName: currentPostToShare.user.name, communityId: commId };
                    await fetchWithAuth('/chat/message', { method: 'POST', body: JSON.stringify({ recipientId: friend._id, sharedPost: sharedPostData, text: '' }) });
                    btn.textContent = 'Enviado!';
                    setTimeout(() => {
                        sharePostModal.classList.remove('show');
                        btn.textContent = 'Enviar';
                        btn.disabled = false;
                    }, 800);
                } catch (error) {
                    showNotification('Erro ao compartilhar.', true);
                    btn.textContent = 'Erro';
                }
            });
            shareFriendList.appendChild(li);
        });
    };

    shareSearchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = myFriends.filter(f => f.name.toLowerCase().includes(term));
        renderFriendList(filtered);
    });

    if(closeShareModalBtn) closeShareModalBtn.addEventListener('click', () => sharePostModal.classList.remove('show'));

    joinBtn.addEventListener('click', async () => {
        joinBtn.disabled = true;
        try {
            const response = await fetchWithAuth(`/communities/${communityId}/join`, { method: 'PUT' });
            showNotification(response.message);
            currentCommunity.members = response.members;
            currentCommunity.joinRequests = response.joinRequests;
            renderCommunityDetails(currentCommunity);
            if (response.status === 'joined' && currentCommunity.isPrivate) {
                loadPageData();
            }
        } catch (error) {
            showNotification(error.message, true);
        } finally {
            joinBtn.disabled = false;
        }
    });

    logoutButton.addEventListener('click', logout);
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);

    setupMarkdownToolbar('postContentInput');
});