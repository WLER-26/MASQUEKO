// === Script Completo para a Página de Perfil (perfil.html) ===
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            if (!user.emailVerified) { auth.signOut(); window.location.href = '/pages/index.html'; return; }
            fetchWithAuth('/auth/me').then(loggedInUser => {
                currentUser = loggedInUser;
                localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));
                loadPageData(); 
            });
            connectToNotificationSocket();
        } else { window.location.href = '/pages/index.html'; }
    });

    const profilePicture = document.getElementById('profilePicture');
    const profileHeaderContainer = document.getElementById('profileHeaderContainer');
    const profileNameEl = document.getElementById('profileName');
    const profileBioEl = document.getElementById('profileBio');
    const profileTagsContainer = document.getElementById('profileTagsContainer');
    const profileBadgesContainer = document.getElementById('profileBadgesContainer');
    const navUsername = document.getElementById('navUsername');
    const navUserPic = document.getElementById('navUserPic');
    const feedContainer = document.getElementById('feedContainer');
    const createPostContainer = document.getElementById('createPostContainer');
    const postDivider = document.getElementById('postDivider');
    const createPostForm = document.getElementById('createPostForm');
    const postContentInput = document.getElementById('postContentInput');
    const postCommunitySelect = document.getElementById('postCommunitySelect');
    const postMediaFile = document.getElementById('postMediaFile'); 
    const logoutButton = document.getElementById('logoutButton');
    const profileActionsContainer = document.getElementById('profileActionsContainer');
    
    const editProfileModal = document.getElementById('editProfileModal');
    const closeEditProfileModalBtn = document.getElementById('closeEditProfileModalBtn');
    const editProfileForm = document.getElementById('editProfileForm');
    const editAvatarFile = document.getElementById('editAvatarFile');
    const editBannerFile = document.getElementById('editBannerFile');
    const editPostModal = document.getElementById('editPostModal');
    const closeEditPostModalBtn = document.getElementById('closeEditPostModalBtn');
    const editPostForm = document.getElementById('editPostForm');
    const editPostIdInput = document.getElementById('editPostIdInput');
    const editPostContentInput = document.getElementById('editPostContentInput');
    const editPostImageUrlInput = document.getElementById('editPostImageUrlInput'); 

    let currentUser = null; 
    let displayedUser = null;
    let userPosts = [];
    let notificationSocket = null;

    if (postMediaFile) postMediaFile.setAttribute('multiple', 'multiple');

    const connectToNotificationSocket = async () => {
        if (notificationSocket && notificationSocket.connected) return;
        const token = await getToken(); if (!token) return;
        notificationSocket = io(BASE_URL, { auth: { token } });
        notificationSocket.on('newMessage', () => {
            const dot = document.getElementById('notificationDot');
            if (dot) dot.style.display = 'block';
        });
    };

    const renderProfile = (user) => {
        const avatarUrl = getCleanImageUrl(user.avatar) || '/assets/profile-pic.png';
        profilePicture.src = avatarUrl;
        
        profileHeaderContainer.innerHTML = ''; 
        if (user.banner) {
            const bannerUrl = getCleanImageUrl(user.banner);
            if (bannerUrl) {
                const bannerImg = document.createElement('img');
                bannerImg.src = bannerUrl;
                bannerImg.className = 'profile-banner-img';
                bannerImg.onerror = () => { bannerImg.style.display = 'none'; };
                profileHeaderContainer.appendChild(bannerImg);
            }
        } 
        
        profileNameEl.textContent = user.name;
        profileBioEl.textContent = user.bio;
        
        profileTagsContainer.innerHTML = '';
        if (user.tags && Array.isArray(user.tags)) {
            user.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'profile-tag';
                span.textContent = tag;
                profileTagsContainer.appendChild(span);
            });
        }

        profileBadgesContainer.innerHTML = '';
        if (user.badges && Array.isArray(user.badges) && user.badges.length > 0) {
            user.badges.forEach(badge => {
                const span = document.createElement('span');
                span.className = 'badge-item';
                span.innerHTML = badge.icon;
                span.title = `${badge.name}: ${badge.description}`;
                profileBadgesContainer.appendChild(span);
            });
        } else {
            profileBadgesContainer.style.display = 'none';
        }

        document.title = `${user.name} - MASQUEKO`;
        document.getElementById('editNameInput').value = user.name;
        document.getElementById('editBioInput').value = user.bio;
        document.getElementById('editTagsInput').value = (user.tags || []).join(', ');
    };
    
    const renderProfileActions = (profileUserId) => {
        profileActionsContainer.innerHTML = ''; 
        if (profileUserId === currentUser._id) {
            createPostContainer.style.display = 'block';
            postDivider.style.display = 'block';
            const editButton = document.createElement('button');
            editButton.id = 'openEditProfileModalBtn';
            editButton.innerHTML = '<i class="fa-solid fa-pencil"></i> Editar Perfil';
            editButton.addEventListener('click', () => editProfileModal.classList.add('show'));
            profileActionsContainer.appendChild(editButton);
        } else {
            createPostContainer.style.display = 'none';
            postDivider.style.display = 'none';
            let actionButton = document.createElement('button');
            if (currentUser.friends.includes(profileUserId)) {
                actionButton.innerHTML = '<i class="fa-solid fa-user-minus"></i> Remover Amigo';
                actionButton.className = 'danger';
                actionButton.dataset.action = 'remove';
            } else if (currentUser.friendRequests.includes(profileUserId)) {
                actionButton.innerHTML = '<i class="fa-solid fa-check"></i> Aceitar Pedido';
                actionButton.dataset.action = 'accept';
            } else if (displayedUser.friendRequests && displayedUser.friendRequests.includes(currentUser._id)) {
                actionButton.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Pedido Enviado';
                actionButton.disabled = true;
            } else {
                actionButton.innerHTML = '<i class="fa-solid fa-user-plus"></i> Adicionar Amigo';
                actionButton.dataset.action = 'add';
            }
            actionButton.dataset.userId = profileUserId;
            profileActionsContainer.appendChild(actionButton);
        }
    };
    
    const renderFeed = () => {
        feedContainer.innerHTML = '';
        if (userPosts.length === 0) {
            feedContainer.innerHTML = `<p>${displayedUser._id === currentUser._id ? 'Você' : displayedUser.name} ainda não fez nenhuma postagem.</p>`;
            return;
        }
        userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const mySaved = currentUser.savedPosts || [];

        userPosts.forEach(post => {
            if (!post || !post.user) return; 
            const postElement = document.createElement('div');
            postElement.className = 'post-card card';
            postElement.dataset.postId = post._id; 

            const postAvatar = getCleanImageUrl(post.user.avatar) || '/assets/profile-pic.png';
            const postMediaHtml = getPostMediaHtml(post.mediaUrls || post.imageUrl, post.linkPreview);

            const likes = post.likes || [];
            const dislikes = post.dislikes || [];
            const currentUserId = currentUser ? currentUser._id : null;
            const isLiked = currentUserId && likes.includes(currentUserId);
            const isDisliked = currentUserId && dislikes.includes(currentUserId);
            const likeClass = isLiked ? 'liked' : '';
            const dislikeClass = isDisliked ? 'disliked' : '';
            
            // Botão Salvar
            const isSaved = mySaved.includes(post._id);
            const saveClass = isSaved ? 'active' : '';
            const saveIcon = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

            let postActionButtons = '';
            if (currentUserId && post.user._id === currentUserId) {
                postActionButtons = `
                    <div class="post-admin-actions">
                        <button class="post-action-btn" data-action="edit-post"><i class="fa-solid fa-pencil"></i></button>
                        <button class="post-action-btn" data-action="delete-post"><i class="fa-solid fa-trash-can"></i></button>
                    </div>`;
            } else {
                postActionButtons = `<button class="save-btn ${saveClass}" data-action="toggle-save" title="Salvar"><i class="${saveIcon}"></i></button>`;
            }

            const commentsHtml = (post.comments || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(c => {
                return `
                <div class="comment">
                    <img src="${getCleanImageUrl(c.user.avatar)}" class="comment-avatar">
                    <div class="comment-body">
                        <a href="/pages/perfil.html?id=${c.user._id}" class="comment-author-link"><span class="comment-author">${c.user.name}</span></a>
                        <p class="comment-text">${formatPostContent(c.text)}</p>
                    </div>
                </div>
            `;
            }).join('');

            let locationHtml = post.community ? `em <a href="/pages/community.html?id=${post.community._id}">c/${post.community.name}</a>` : `<span>(Global)</span>`;

            postElement.innerHTML = `
                <div class="post-card-content">
                    <div class="post-header">
                        <img src="${postAvatar}" alt="Avatar" class="post-avatar">
                        <div style="flex-grow: 1;">
                            <span class="post-author"><a href="/pages/perfil.html?id=${post.user._id}">${post.user.name}</a></span>
                            <span class="post-meta">${locationHtml} • ${formatTimeAgo(post.createdAt)}</span>
                        </div>
                        ${postActionButtons}
                    </div>
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
                    <button class="comment-button" data-action="toggle-comment">
                        <i class="fa-regular fa-comment"></i> <span>${(post.comments || []).length} Comentários</span>
                    </button>
                </div>
                <div class="comments-section" style="display: none;">
                    <form class="comment-form" data-action="submit-comment">
                        <textarea class="comment-input mention-enabled" placeholder="Escreva seu comentário..."></textarea>
                        <button type="submit">Enviar</button>
                    </form>
                    <div class="comments-list">${commentsHtml}</div>
                </div>
            `;
            feedContainer.appendChild(postElement);
        });
    };

    const loadPageData = async () => {
        try {
            const navAvatarUrl = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png';
            navUserPic.src = navAvatarUrl;
            navUsername.textContent = currentUser.name;

            const trendingTags = await fetchWithAuth('/posts/trending');
            const trendingContainer = document.getElementById('trendingListContainer');
            if(trendingContainer) {
                trendingContainer.innerHTML = '';
                trendingTags.forEach(tagData => {
                    const li = document.createElement('li');
                    li.className = 'trending-item';
                    li.innerHTML = `<a href="/pages/tag.html?tag=${tagData.tag}">#${tagData.tag}</a><span class="trending-count">${tagData.count} posts</span>`;
                    trendingContainer.appendChild(li);
                });
            }

            const params = new URLSearchParams(window.location.search);
            const profileUserId = params.get('id');

            let profileData;
            if (profileUserId && profileUserId !== currentUser._id) {
                profileData = await fetchWithAuth(`/users/${profileUserId}`);
            } else {
                const postsData = await fetchWithAuth('/posts');
                profileData = {
                    user: currentUser,
                    posts: postsData.filter(post => post.user._id === currentUser._id)
                };
            }
            
            displayedUser = profileData.user;
            userPosts = profileData.posts;

            if (displayedUser._id === currentUser._id) {
                const communities = await fetchWithAuth('/communities');
                postCommunitySelect.innerHTML = '<option value="" selected>Publicar no seu Perfil (Global)</option>';
                communities.forEach(community => {
                    if (community.members && community.members.includes(currentUser._id)) {
                        const option = document.createElement('option');
                        option.value = community._id;
                        option.textContent = `c/${community.name}`;
                        postCommunitySelect.appendChild(option);
                    }
                });
            }

            renderProfile(displayedUser);
            renderProfileActions(displayedUser._id);
            renderFeed();

        } catch (error) {
            showNotification(error.message, true);
            feedContainer.innerHTML = '<p>Erro ao carregar o perfil.</p>';
        }
    };

    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = postContentInput.value;
        const communityId = postCommunitySelect.value || null;
        const files = postMediaFile.files;
        const urlInput = document.getElementById('postImageUrlInput').value.trim();

        if (!content.trim()) { showNotification('Vazio.', true); return; }
        const submitButton = createPostForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        try {
            let mediaUrls = [];
            if (files.length > 0) {
                mediaUrls = await uploadFileToStorage(files, 'posts');
            } else if (urlInput) {
                mediaUrls = [urlInput];
            }

            const newPostData = await fetchWithAuth('/posts', {
                method: 'POST',
                body: JSON.stringify({ content, communityId, mediaUrls }),
            });
            
            userPosts.unshift(newPostData);
            renderFeed();
            createPostForm.reset();
            postCommunitySelect.value = "";
            postMediaFile.value = "";
            document.getElementById('postImageUrlInput').value = "";
            showNotification('Postado!');
        } catch (error) { showNotification(error.message, true); } 
        finally { submitButton.disabled = false; submitButton.textContent = 'Publicar'; }
    });
    
    feedContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        // Lógica de Salvar Post
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

        const action = btn.dataset.action;
        const postCard = btn.closest('.post-card');
        const postId = postCard.dataset.postId;
        const post = userPosts.find(p => p._id === postId);

        try {
            if (action === 'like' || action === 'dislike') {
                const updatedVotes = await fetchWithAuth(`/posts/${postId}/vote`, { 
                    method: 'PUT',
                    body: JSON.stringify({ voteType: action })
                });
                post.likes = updatedVotes.likes;
                post.dislikes = updatedVotes.dislikes;
                renderFeed(); 
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
                    userPosts = userPosts.filter(p => p._id !== postId);
                    renderFeed();
                    showNotification('Deletada.');
                }
            }
        } catch (error) { showNotification(error.message, true); }
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
            const updatedComments = await fetchWithAuth(`/posts/${postId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            const postIndex = userPosts.findIndex(p => p._id === postId);
            userPosts[postIndex].comments = updatedComments;
            renderFeed(); 
            textarea.value = '';
        } catch (error) { showNotification(error.message, true); }
    });

    // Profile Edit Logic (mantida)
    const closeProfileModal = () => editProfileModal.classList.remove('show');
    closeEditProfileModalBtn?.addEventListener('click', closeProfileModal);
    window.addEventListener('click', (e) => { if (e.target === editProfileModal) closeProfileModal(); });

    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editNameInput').value;
        const bio = document.getElementById('editBioInput').value;
        const tagsInput = document.getElementById('editTagsInput').value;
        const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        
        let avatarUrl = document.getElementById('editAvatarInput').value;
        let bannerUrl = document.getElementById('editBannerInput').value;
        const avatarFile = editAvatarFile.files[0];
        const bannerFile = editBannerFile.files[0];
        
        const submitButton = editProfileForm.querySelector('button[type="submit"]');
        submitButton.disabled = true; submitButton.textContent = 'Salvando...';

        try {
            if (avatarFile) {
                const results = await uploadFileToStorage(avatarFile, 'avatars');
                avatarUrl = Array.isArray(results) ? results[0] : results;
            }
            if (bannerFile) {
                const results = await uploadFileToStorage(bannerFile, 'banners');
                bannerUrl = Array.isArray(results) ? results[0] : results;
            }

            const updatedUser = await fetchWithAuth('/users/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, bio, avatar: avatarUrl, banner: bannerUrl, tags: tags }),
            });
            currentUser = updatedUser;
            localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));
            loadPageData();
            closeProfileModal();
            showNotification('Atualizado!');
        } catch (error) { showNotification(error.message, true); } 
        finally { submitButton.disabled = false; submitButton.textContent = 'Salvar'; }
    });
    
    const closePostModal = () => editPostModal.classList.remove('show');
    closeEditPostModalBtn?.addEventListener('click', closePostModal);
    window.addEventListener('click', (e) => { if (e.target === editPostModal) closePostModal(); });

    editPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const postId = editPostIdInput.value;
        const content = editPostContentInput.value;
        let imageUrl = editPostImageUrlInput.value; 
        try {
            const updatedPost = await fetchWithAuth(`/posts/${postId}`, {
                method: 'PUT',
                body: JSON.stringify({ content, imageUrl }),
            });
            const postIndex = userPosts.findIndex(p => p._id === postId);
            userPosts[postIndex] = updatedPost;
            renderFeed();
            closePostModal();
            showNotification('Atualizado!');
        } catch (error) { showNotification(error.message, true); }
    });
    
    profileActionsContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        const userId = button.dataset.userId;
        try {
            let result; let reloadPage = false;
            switch (action) {
                case 'add': result = await fetchWithAuth(`/users/${userId}/add`, { method: 'POST' }); reloadPage = true; break;
                case 'accept': result = await fetchWithAuth(`/users/${userId}/accept`, { method: 'PUT' }); reloadPage = true; break;
                case 'remove': result = await fetchWithAuth(`/users/${userId}/remove`, { method: 'DELETE' }); reloadPage = true; break;
            }
            showNotification(result.message);
            if(reloadPage) {
                currentUser = await fetchWithAuth('/auth/me');
                localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));
                loadPageData(); 
            }
        } catch (error) { showNotification(error.message, true); }
    });

    logoutButton.addEventListener('click', logout);
    // ADICIONADO: Listener do botão Sair Mobile
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);

    // === INICIALIZAR FERRAMENTAS ===
    setupMarkdownToolbar('postContentInput');
    setupGlobalMentionLogic();
});