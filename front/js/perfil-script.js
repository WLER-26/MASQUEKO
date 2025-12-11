document.addEventListener('DOMContentLoaded', () => {
    // --- VARIÁVEIS GLOBAIS ---
    let currentUser = null;
    let displayedUser = null;
    let userPosts = [];
    let notificationSocket = null;
    
    // Variáveis para modais
    let tempPollData = null;
    let currentPostToShare = null;
    let myFriends = [];

    // --- SELETORES DO DOM ---
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
    
    // Modais
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

    // Modal de Denúncia (Verifique se adicionou o HTML na página de perfil, se não tiver, adicione igual da home)
    const reportModal = document.getElementById('reportModal'); 
    const closeReportModalBtn = document.getElementById('closeReportModalBtn'); 
    const reportForm = document.getElementById('reportForm'); 
    const reportTargetIdInput = document.getElementById('reportTargetIdInput'); 
    const reportReasonInput = document.getElementById('reportReasonInput');

    if (postMediaFile) postMediaFile.setAttribute('multiple', 'multiple');

    // --- AUTH ---
    auth.onAuthStateChanged(user => {
        if (user) {
            if (!user.emailVerified) {
                auth.signOut();
                window.location.href = '/pages/index.html';
                return;
            }
            fetchWithAuth('/auth/me').then(loggedInUser => {
                currentUser = loggedInUser;
                localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));
                loadPageData(); 
            });
            connectToNotificationSocket();
        } else {
            window.location.href = '/pages/index.html';
        }
    });

    // --- FUNÇÕES DE MODAL ---
    const closeAllModals = () => {
        if (editProfileModal) editProfileModal.classList.remove('show');
        if (editPostModal) editPostModal.classList.remove('show');
        if (sharePostModal) sharePostModal.classList.remove('show');
        if (pollModal) pollModal.classList.remove('show');
        if (repostModal) repostModal.classList.remove('show');
        if (reportModal) reportModal.classList.remove('show');
    };

    if (closeEditProfileModalBtn) closeEditProfileModalBtn.addEventListener('click', closeAllModals);
    if (closeEditPostModalBtn) closeEditPostModalBtn.addEventListener('click', closeAllModals);
    if (closeShareModalBtn) closeShareModalBtn.addEventListener('click', closeAllModals);
    if (closePollBtn) closePollBtn.addEventListener('click', closeAllModals);
    if (closeRepostModalBtn) closeRepostModalBtn.addEventListener('click', closeAllModals);
    if (closeReportModalBtn) closeReportModalBtn.addEventListener('click', closeAllModals);

    window.addEventListener('click', (e) => {
        if (e.target === editProfileModal || 
            e.target === editPostModal || 
            e.target === sharePostModal || 
            e.target === pollModal || 
            e.target === repostModal ||
            e.target === reportModal) {
            closeAllModals();
        }
    });

    // --- SOCKET ---
    const connectToNotificationSocket = async () => {
        if (notificationSocket && notificationSocket.connected) return;
        const token = await getToken();
        if (!token) return;
        notificationSocket = io(BASE_URL, { auth: { token } });
        notificationSocket.on('newMessage', () => {
            const dot = document.getElementById('notificationDot');
            if (dot) dot.style.display = 'block';
        });
    };

    // --- ENQUETES ---
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

    // --- RENDERIZAR CABEÇALHO DO PERFIL ---
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
        
        // Badges no Nome do Perfil
        const verifiedIcon = user.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; margin-left: 5px;" title="Verificado"></i>' : '';
        const sponsorIcon = user.isSponsor ? '<i class="fa-solid fa-crown" style="color: #fbbf24; margin-left: 5px;" title="Patrocinador VIP"></i>' : '';
        
        profileNameEl.innerHTML = `${user.name} ${verifiedIcon} ${sponsorIcon}`;
        
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
    
    // --- RENDERIZAR AÇÕES (BOTÕES DE AMIZADE/EDITAR) ---
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
    
    // --- RENDERIZAR FEED DO PERFIL ---
    const renderFeed = () => {
        feedContainer.innerHTML = '';
        if (userPosts.length === 0) { 
            feedContainer.innerHTML = `<p style="text-align:center; margin-top:20px;">${displayedUser._id === currentUser._id ? 'Você' : displayedUser.name} ainda não fez nenhuma postagem.</p>`; 
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
            
            // Badges no Post
            const userVerified = post.user.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; font-size: 0.8em; margin-left: 4px;" title="Verificado"></i>' : '';
            const userSponsor = post.user.isSponsor ? '<i class="fa-solid fa-crown" style="color: #fbbf24; font-size: 0.8em; margin-left: 4px;" title="Patrocinador VIP"></i>' : '';

            // Conteúdo (Repost ou Normal)
            let mainContentHtml = '';
            if (post.repostData) {
                const r = post.repostData;
                if(r.user) {
                    const rVerified = r.user.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; font-size: 0.8em; margin-left: 4px;" title="Verificado"></i>' : '';
                    const rSponsor = r.user.isSponsor ? '<i class="fa-solid fa-crown" style="color: #fbbf24; font-size: 0.8em; margin-left: 4px;" title="Patrocinador VIP"></i>' : '';
                    const rAvatar = getCleanImageUrl(r.user.avatar) || '/assets/profile-pic.png';
                    
                    mainContentHtml = `
                        <div class="post-content" style="margin-bottom:10px;">${formatPostContent(post.content)}</div>
                        <div class="repost-wrapper" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 8px; background: var(--surface-color);">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.9rem;">
                                <img src="${rAvatar}" style="width: 24px; height: 24px; border-radius: 50%;">
                                <span style="font-weight: 600;">${r.user.name} ${rVerified} ${rSponsor}</span>
                                <span style="color: var(--text-secondary);">• Post Original</span>
                            </div>
                            <div class="post-content">${formatPostContent(r.content)}</div>
                            ${r.poll ? getPollHtml(r.poll, r._id, currentUser._id) : ''}
                            ${getPostMediaHtml(r.mediaUrls || r.imageUrl, null)}
                        </div>
                    `;
                } else {
                    mainContentHtml = `<div class="post-content"><i>Conteúdo repostado indisponível</i></div>`;
                }
            } else {
                mainContentHtml = `
                    <div class="post-content">${formatPostContent(post.content)}</div>
                    ${post.poll ? getPollHtml(post.poll, post._id, currentUser._id) : ''}
                    ${getPostMediaHtml(post.mediaUrls || post.imageUrl, post.linkPreview)}
                `;
            }

            const likes = post.likes || []; 
            const dislikes = post.dislikes || [];
            const isLiked = likes.includes(currentUser._id);
            const isDisliked = dislikes.includes(currentUser._id);
            
            // CORREÇÃO: Variáveis definidas
            const likeClass = isLiked ? 'liked' : '';
            const dislikeClass = isDisliked ? 'disliked' : '';

            const isSaved = mySaved.includes(post._id); 
            const saveClass = isSaved ? 'active' : ''; 
            const saveIcon = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

            // Botões de Ação
            let postActionButtons = '';
            if (post.user._id === currentUser._id || currentUser.isAdmin) { 
                let editBtn = post.user._id === currentUser._id ? `<button class="post-action-btn" data-action="edit-post" title="Editar"><i class="fa-solid fa-pencil"></i></button>` : '';
                let deleteBtn = `<button class="post-action-btn" data-action="delete-post" title="Deletar"><i class="fa-solid fa-trash-can"></i></button>`;
                postActionButtons = `<div class="post-admin-actions">${editBtn}${deleteBtn}</div>`; 
            } else {
                postActionButtons = `
                    <div class="post-admin-actions">
                         <button class="post-action-btn btn-report" data-action="report-post" title="Denunciar"><i class="fa-solid fa-flag"></i></button>
                         <button class="save-btn ${saveClass}" data-action="toggle-save" title="Salvar"><i class="${saveIcon}"></i></button>
                    </div>`;
            }

            const commentsHtml = (post.comments || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(c => {
                const cVerified = (c.user && c.user.isVerified) ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; font-size: 0.8em; margin-left: 4px;" title="Verificado"></i>' : '';
                const cSponsor = (c.user && c.user.isSponsor) ? '<i class="fa-solid fa-crown" style="color: #fbbf24; font-size: 0.8em; margin-left: 4px;" title="Patrocinador"></i>' : '';
                return `<div class="comment"><img src="${getCleanImageUrl(c.user.avatar)}" class="comment-avatar"><div class="comment-body"><a href="/pages/perfil.html?id=${c.user._id}" class="comment-author-link"><span class="comment-author">${c.user.name} ${cVerified} ${cSponsor}</span></a><p class="comment-text">${formatPostContent(c.text)}</p></div></div>`;
            }).join('');

            let locationHtml = post.community ? `em <a href="/pages/community.html?id=${post.community._id}">c/${post.community.name}</a>` : `<span>(Global)</span>`;

            postElement.innerHTML = `
                <div class="post-card-content">
                    <div class="post-header">
                        <img src="${postAvatar}" alt="Avatar" class="post-avatar">
                        <div>
                            <span class="post-author"><a href="/pages/perfil.html?id=${post.user._id}">${post.user.name}</a> ${userVerified} ${userSponsor}</span>
                            ${post.repostData ? '<span style="font-size:0.75rem; color:var(--text-secondary); margin-left:5px;"><i class="fa-solid fa-retweet"></i> Repostou</span>' : ''}
                            <span class="post-meta">${locationHtml} • ${formatTimeAgo(post.createdAt)}</span>
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

    // --- LOAD PAGE DATA ---
    const loadPageData = async () => { 
        try { 
            currentUser = await fetchWithAuth('/auth/me'); 
            
            // Navbar Badge
            const navAvatarUrl = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png'; 
            navUserPic.src = navAvatarUrl; 
            const navVerified = currentUser.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; margin-left: 5px;"></i>' : '';
            const navSponsor = currentUser.isSponsor ? '<i class="fa-solid fa-crown" style="color: #fbbf24; margin-left: 5px;"></i>' : '';
            navUsername.innerHTML = `${currentUser.name} ${navVerified} ${navSponsor}`;
            
            const trendingTags = await fetchWithAuth('/posts/trending'); 
            const trendingContainer = document.getElementById('trendingListContainer'); 
            if(trendingContainer) { 
                trendingContainer.innerHTML = ''; 
                trendingTags.forEach(tagData => { 
                    const li = document.createElement('li'); li.className = 'trending-item'; 
                    li.innerHTML = `<a href="/pages/tag.html?tag=${tagData.tag}">#${tagData.tag}</a><span class="trending-count">${tagData.count} posts</span>`; 
                    trendingContainer.appendChild(li); 
                }); 
            } 
            
            const params = new URLSearchParams(window.location.search); 
            const profileUserId = params.get('id'); 
            const targetId = profileUserId || currentUser._id; 
            
            const profileData = await fetchWithAuth(`/users/${targetId}`); 
            
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
            
            // Comunidade Segura
            const safeCommunityId = (communityId && communityId !== "undefined") ? communityId : null;

            const newPostData = await fetchWithAuth('/posts', { 
                method: 'POST', 
                body: JSON.stringify({ content, communityId: safeCommunityId, mediaUrls, poll: tempPollData }), 
            }); 
            
            if (!userPosts) userPosts = [];
            userPosts.unshift(newPostData); 
            renderFeed(); 
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
    
    // --- CLICK DELEGATION ---
    feedContainer.addEventListener('click', async (e) => { 
        const btn = e.target.closest('button'); if (!btn || !btn.dataset.action) return; 
        
        // REPOST
        if (btn.dataset.action === 'repost') {
            const postCard = btn.closest('.post-card');
            const postId = postCard.dataset.postId;
            repostPostIdInput.value = postId;
            repostCommentInput.value = '';
            repostModal.classList.add('show');
            return;
        }

        // REPORT
        if (btn.dataset.action === 'report-post') {
            const postCard = btn.closest('.post-card');
            reportTargetIdInput.value = postCard.dataset.postId;
            reportModal.classList.add('show');
            return;
        }

        if (btn.dataset.action === 'share-post') { const postCard = btn.closest('.post-card'); const postId = postCard.dataset.postId; const post = userPosts.find(p => p._id === postId); openShareModal(post); return; }
        
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
        const postCard = e.target.closest('.post-card'); 
        const postId = postCard.dataset.postId; 
        const post = userPosts.find(p => p._id === postId);
        
        try { 
            if (action === 'like' || action === 'dislike') { 
                const updatedVotes = await fetchWithAuth(`/posts/${postId}/vote`, { method: 'PUT', body: JSON.stringify({ voteType: action }) }); 
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
                    showNotification('Deletado.'); 
                } 
            } 
        } catch (error) { showNotification(error.message, true); } 
    });

    // --- SUBMITS MODAIS ---
    repostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const postId = repostPostIdInput.value;
        const comment = repostCommentInput.value;
        const btn = repostForm.querySelector('button[type="submit"]');
        btn.disabled = true; 
        try {
            const repost = await fetchWithAuth(`/posts/${postId}/repost`, { method: 'POST', body: JSON.stringify({ content: comment }) });
            if (!userPosts.some(p => p._id === repost._id)) { userPosts.unshift(repost); renderFeed(); }
            repostModal.classList.remove('show');
            showNotification('Repostado com sucesso!');
        } catch (error) { showNotification('Erro ao repostar.', true); } finally { btn.disabled = false; }
    });

    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetId = reportTargetIdInput.value;
            const reason = reportReasonInput.value;
            const btn = reportForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            try {
                await fetchWithAuth('/reports', { method: 'POST', body: JSON.stringify({ targetId, reason, type: 'post' }) });
                showNotification('Denúncia enviada.');
                reportModal.classList.remove('show');
            } catch (error) { showNotification('Erro ao denunciar.', true); }
            finally { btn.disabled = false; }
        });
    }

    feedContainer.addEventListener('submit', async (e) => { e.preventDefault(); const form = e.target.closest('form'); if (!form || form.dataset.action !== 'submit-comment') return; const postCard = e.target.closest('.post-card'); const postId = postCard.dataset.postId; const textarea = form.querySelector('.comment-input'); const text = textarea.value; if (!text.trim()) return; try { const updatedComments = await fetchWithAuth(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) }); const postIndex = userPosts.findIndex(p => p._id === postId); userPosts[postIndex].comments = updatedComments; renderFeed(); textarea.value = ''; } catch (error) { showNotification(error.message, true); } });
    editProfileForm.addEventListener('submit', async (e) => { e.preventDefault(); const name = document.getElementById('editNameInput').value; const bio = document.getElementById('editBioInput').value; const tagsInput = document.getElementById('editTagsInput').value; const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0); let avatarUrl = document.getElementById('editAvatarInput').value; let bannerUrl = document.getElementById('editBannerInput').value; const avatarFile = editAvatarFile.files[0]; const bannerFile = editBannerFile.files[0]; const submitButton = editProfileForm.querySelector('button[type="submit"]'); submitButton.disabled = true; submitButton.textContent = 'Salvando...'; try { if (avatarFile) { const results = await uploadFileToStorage(avatarFile, 'avatars'); avatarUrl = Array.isArray(results) ? results[0] : results; } if (bannerFile) { const results = await uploadFileToStorage(bannerFile, 'banners'); bannerUrl = Array.isArray(results) ? results[0] : results; } const updatedUser = await fetchWithAuth('/users/profile', { method: 'PUT', body: JSON.stringify({ name, bio, avatar: avatarUrl, banner: bannerUrl, tags: tags }), }); currentUser = updatedUser; localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser)); loadPageData(); closeAllModals(); showNotification('Atualizado!'); } catch (error) { showNotification(error.message, true); } finally { submitButton.disabled = false; submitButton.textContent = 'Salvar'; } });
    editPostForm.addEventListener('submit', async (e) => { e.preventDefault(); const postId = editPostIdInput.value; const content = editPostContentInput.value; let imageUrl = editPostImageUrlInput.value; try { const updatedPost = await fetchWithAuth(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify({ content, imageUrl }), }); const postIndex = userPosts.findIndex(p => p._id === postId); userPosts[postIndex] = updatedPost; renderFeed(); closeAllModals(); showNotification('Atualizado!'); } catch (error) { showNotification(error.message, true); } });
    
    profileActionsContainer.addEventListener('click', async (e) => { const button = e.target.closest('button[data-action]'); if (!button) return; const action = button.dataset.action; const userId = button.dataset.userId; try { let result; let reloadPage = false; switch (action) { case 'add': result = await fetchWithAuth(`/users/${userId}/add`, { method: 'POST' }); reloadPage = true; break; case 'accept': result = await fetchWithAuth(`/users/${userId}/accept`, { method: 'PUT' }); reloadPage = true; break; case 'remove': result = await fetchWithAuth(`/users/${userId}/remove`, { method: 'DELETE' }); reloadPage = true; break; } showNotification(result.message); if(reloadPage) { currentUser = await fetchWithAuth('/auth/me'); localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser)); loadPageData(); } } catch (error) { showNotification(error.message, true); } });
    const openShareModal = async (post) => { currentPostToShare = post; sharePostModal.classList.add('show'); shareFriendList.innerHTML = '<p>Carregando...</p>'; try { if (myFriends.length === 0) { const userProfile = await fetchWithAuth('/auth/me'); const promises = userProfile.friends.map(fid => fetchWithAuth(`/users/${fid}`)); const friendsData = await Promise.all(promises); myFriends = friendsData.map(res => res.user); } renderFriendList(myFriends); } catch (error) { shareFriendList.innerHTML = '<p style="text-align: center;">Erro ao carregar amigos.</p>'; } };
    const renderFriendList = (friends) => { shareFriendList.innerHTML = ''; if (friends.length === 0) { shareFriendList.innerHTML = '<p style="text-align: center;">Você não tem amigos.</p>'; return; } friends.forEach(friend => { const avatar = getCleanImageUrl(friend.avatar) || '/assets/profile-pic.png'; const li = document.createElement('li'); li.className = 'share-user-item'; li.innerHTML = `<img src="${avatar}" class="share-avatar"><span class="share-name">${friend.name}</span><button class="share-btn-send" data-uid="${friend._id}">Enviar</button>`; li.querySelector('button').addEventListener('click', async (e) => { const btn = e.target; btn.textContent = '...'; btn.disabled = true; const commName = currentPostToShare.community ? currentPostToShare.community.name : 'Global'; const commId = currentPostToShare.community ? currentPostToShare.community._id : null; try { const sharedPostData = { _id: currentPostToShare._id, content: currentPostToShare.content, imageUrl: currentPostToShare.imageUrl, communityName: commName, authorName: currentPostToShare.user.name, communityId: commId }; await fetchWithAuth('/chat/message', { method: 'POST', body: JSON.stringify({ recipientId: friend._id, sharedPost: sharedPostData, text: '' }) }); btn.textContent = 'Enviado!'; setTimeout(() => { sharePostModal.classList.remove('show'); btn.textContent = 'Enviar'; btn.disabled = false; }, 800); } catch (error) { showNotification('Erro ao compartilhar.', true); btn.textContent = 'Erro'; } }); shareFriendList.appendChild(li); }); };
    shareSearchInput?.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); const filtered = myFriends.filter(f => f.name.toLowerCase().includes(term)); renderFriendList(filtered); });
    closeShareModalBtn?.addEventListener('click', () => sharePostModal.classList.remove('show'));

    logoutButton.addEventListener('click', logout); document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);
    setupMarkdownToolbar('postContentInput'); setupGlobalMentionLogic();
});