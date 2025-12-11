document.addEventListener('DOMContentLoaded', () => {
    // --- VARIÁVEIS GLOBAIS ---
    let currentUser = null;
    let allPosts = [];
    let isLoading = false;
    let hasMorePosts = true;
    let lastPostTime = null;
    let lastPostId = null;
    const POSTS_PER_PAGE = 5;
    
    // Variáveis temporárias para modais
    let tempPollData = null;
    let currentPostToShare = null;
    let myFriends = [];
    let selectedPlanId = null;

    // --- SELETORES DO DOM ---
    const navUsername = document.getElementById('navUsername');
    const navUserPic = document.getElementById('navUserPic');
    const feedContainer = document.getElementById('feedContainer');
    const createPostForm = document.getElementById('createPostForm');
    const postContentInput = document.getElementById('postContentInput');
    const postCommunitySelect = document.getElementById('postCommunitySelect');
    const postMediaFile = document.getElementById('postMediaFile');
    const logoutButton = document.getElementById('logoutButton');
    
    // Modais e Botões
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

    const reportModal = document.getElementById('reportModal');
    const closeReportModalBtn = document.getElementById('closeReportModalBtn');
    const reportForm = document.getElementById('reportForm');
    const reportTargetIdInput = document.getElementById('reportTargetIdInput');
    const reportReasonInput = document.getElementById('reportReasonInput');

    const sponsorModal = document.getElementById('sponsorModal');
    const closeSponsorModalBtn = document.getElementById('closeSponsorModalBtn');
    const openSponsorModalBtn = document.getElementById('openSponsorModalBtn');
    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');

    if (postMediaFile) postMediaFile.setAttribute('multiple', 'multiple');

    // --- VERIFICAÇÃO DE AUTENTICAÇÃO ---
    auth.onAuthStateChanged(user => {
        if (user) {
            if (!user.emailVerified) {
                auth.signOut();
                window.location.href = '/pages/index.html';
                return;
            }
            loadInitialData();
            setupFeedListener();
            setupGlobalMentionLogic();
        } else {
            window.location.href = '/pages/index.html';
        }
    });

    // --- FUNÇÕES DE MODAL (ABRIR/FECHAR) ---
    const closeAllModals = () => {
        if (editPostModal) editPostModal.classList.remove('show');
        if (sharePostModal) sharePostModal.classList.remove('show');
        if (pollModal) pollModal.classList.remove('show');
        if (repostModal) repostModal.classList.remove('show');
        if (reportModal) reportModal.classList.remove('show');
        if (sponsorModal) sponsorModal.classList.remove('show');
    };

    if (closeEditPostModalBtn) closeEditPostModalBtn.addEventListener('click', closeAllModals);
    if (closeShareModalBtn) closeShareModalBtn.addEventListener('click', closeAllModals);
    if (closePollBtn) closePollBtn.addEventListener('click', closeAllModals);
    if (closeRepostModalBtn) closeRepostModalBtn.addEventListener('click', closeAllModals);
    if (closeReportModalBtn) closeReportModalBtn.addEventListener('click', closeAllModals);
    if (closeSponsorModalBtn) closeSponsorModalBtn.addEventListener('click', closeAllModals);

    window.addEventListener('click', (e) => {
        if (e.target === editPostModal ||
            e.target === sharePostModal ||
            e.target === pollModal ||
            e.target === repostModal ||
            e.target === reportModal ||
            e.target === sponsorModal) {
            closeAllModals();
        }
    });

    // --- INFINITE SCROLL ---
    const setupInfiniteScroll = () => {
        if (document.getElementById('feed-sentry')) return;

        const sentry = document.createElement('div');
        sentry.id = 'feed-sentry';
        sentry.style.height = '60px';
        sentry.style.textAlign = 'center';
        sentry.style.padding = '20px';
        sentry.innerHTML = '<span style="color: var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Carregando mais...</span>';

        feedContainer.parentNode.appendChild(sentry);

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMorePosts && !isLoading) {
                loadMorePosts();
            }
        }, { root: null, rootMargin: '200px', threshold: 0.1 });

        observer.observe(sentry);
        window.feedSentry = sentry;
    };

    // --- CARREGAMENTO INICIAL DE DADOS ---
    const loadInitialData = async () => {
        feedContainer.innerHTML = '';
        renderSkeletonFeed();

        try {
            currentUser = await fetchWithAuth('/auth/me');
            localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));

            // Configura Navbar (Nome + Badges)
            const navVerified = currentUser.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; margin-left: 5px;"></i>' : '';
            const navSponsor = currentUser.isSponsor ? '<i class="fa-solid fa-crown" style="color: #fbbf24; margin-left: 5px;"></i>' : '';
            navUsername.innerHTML = `${currentUser.name} ${navVerified} ${navSponsor}`;
            navUserPic.src = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png';

            // Carrega Trending
            const trendingTags = await fetchWithAuth('/posts/trending');
            renderTrendingTags(trendingTags);

            // Carrega Comunidades no Select
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

            // Verifica se há um post específico na URL (Deep Linking)
            const params = new URLSearchParams(window.location.search);
            const targetPostId = params.get('postId');

            if (targetPostId) {
                try {
                    const targetPost = await fetchWithAuth(`/posts/${targetPostId}`);
                    if (targetPost && !targetPost.message) {
                        allPosts.push(targetPost);
                        renderPosts([targetPost]);
                        // Destacar e rolar até o post
                        setTimeout(() => {
                            const el = document.querySelector(`.post-card[data-post-id="${targetPostId}"]`);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.style.border = "2px solid var(--primary-color)";
                                el.style.transition = "all 0.5s ease";
                                setTimeout(() => el.style.borderColor = "var(--border-color)", 2000);
                            }
                        }, 800);
                    }
                } catch (e) {
                    console.error("Post específico não encontrado:", e);
                    showNotification("Postagem não encontrada ou indisponível.", true);
                }
            }

            setupInfiniteScroll();
            loadMorePosts(true);

        } catch (e) {
            console.error("Erro init:", e);
            feedContainer.innerHTML = '<p style="text-align:center">Erro ao carregar. Tente recarregar a página.</p>';
        }
    };

    // --- CARREGAR MAIS POSTS (PAGINAÇÃO) ---
    const loadMorePosts = async (isInitial = false) => {
        if (isLoading || (!hasMorePosts && !isInitial)) return;
        isLoading = true;

        try {
            let url = `/posts?limit=${POSTS_PER_PAGE}`;
            if (lastPostTime && !isInitial) {
                url += `&lastCreatedAt=${encodeURIComponent(lastPostTime)}`;
            }

            const newPosts = await fetchWithAuth(url);

            if (isInitial && allPosts.length === 0) {
                feedContainer.innerHTML = '';
                allPosts = [];
            } else if (isInitial && allPosts.length > 0) {
                // Remove skeletons se já tiver posts carregados (ex: deep link)
                document.querySelectorAll('.skeleton').forEach(s => s.closest('.post-card')?.remove());
            }

            if (newPosts.length < POSTS_PER_PAGE) {
                hasMorePosts = false;
                if (window.feedSentry) window.feedSentry.innerHTML = '<small style="color: var(--text-secondary);">Você chegou ao fim.</small>';
            }

            if (newPosts.length > 0) {
                const lastPost = newPosts[newPosts.length - 1];
                lastPostTime = lastPost.createdAt;
                lastPostId = lastPost._id;

                const uniquePosts = newPosts.filter(p => !allPosts.some(existing => existing._id === p._id));
                allPosts.push(...uniquePosts);

                renderPosts(uniquePosts);
            } else if (isInitial && allPosts.length === 0) {
                feedContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">Ainda não há postagens.</p>';
                if (window.feedSentry) window.feedSentry.style.display = 'none';
            }

        } catch (error) {
            console.error("Erro feed:", error);
            showNotification('Erro ao carregar feed.', true);
        } finally {
            isLoading = false;
        }
    };

    // --- LISTENER DO SOCKET (TEMPO REAL) ---
    const setupFeedListener = () => {
        setTimeout(() => {
            if (window.globalSocket) {
                window.globalSocket.on('global_new_post', (post) => {
                    if (!allPosts.some(p => p._id === post._id)) {
                        allPosts.unshift(post);
                        renderPosts([post], true);
                    }
                });
            }
        }, 1000);
    };

    // --- RENDERIZAÇÃO DOS POSTS ---
    const renderPosts = (posts, prepend = false) => {
        const mySaved = currentUser.savedPosts || [];
        const fragment = document.createDocumentFragment();

        posts.forEach(post => {
            try {
                if (!post || !post.user) return;

                const postElement = document.createElement('div');
                postElement.className = 'post-card card';
                postElement.dataset.postId = post._id;

                const postAvatar = getCleanImageUrl(post.user.avatar) || '/assets/profile-pic.png';

                // Badges do Autor
                const userVerified = post.user.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; font-size: 0.8em; margin-left: 4px;" title="Verificado"></i>' : '';
                const userSponsor = post.user.isSponsor ? '<i class="fa-solid fa-crown" style="color: #fbbf24; font-size: 0.8em; margin-left: 4px;" title="Patrocinador VIP"></i>' : '';

                // Lógica de Conteúdo (Repost ou Normal)
                let mainContentHtml = '';
                if (post.repostData) {
                    const r = post.repostData;
                    if (r.user) {
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

                // Definição de Variáveis de Estado (CORRIGIDO)
                const likes = post.likes || [];
                const dislikes = post.dislikes || [];
                const isLiked = likes.includes(currentUser._id);
                const isDisliked = dislikes.includes(currentUser._id);
                
                const likeClass = isLiked ? 'liked' : '';
                const dislikeClass = isDisliked ? 'disliked' : '';

                const isSaved = mySaved.includes(post._id);
                const saveClass = isSaved ? 'active' : '';
                const saveIcon = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

                // Botões de Ação do Topo (Admin/Owner)
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

                const commentTree = buildCommentTree(post.comments || []);
                const commentsHtml = commentTree.map(c => renderCommentHTML(c, 0, post._id)).join('');

                let locationHtml = post.community ? `em <a href="/pages/community.html?id=${post.community._id}">c/${post.community.name}</a>` : `<span><i class="fa-solid fa-earth-americas"></i> No Perfil</span>`;

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
                        <div class="reply-preview" style="display:none; background: var(--primary-extralight); padding: 5px 10px; border-radius: 5px; margin-bottom: 5px; font-size: 0.85rem; color: var(--primary-dark); align-items: center; justify-content: space-between;">
                            <span>Respondendo a <b id="replyingToName"></b></span>
                            <button id="cancelReplyBtn" style="background:none; border:none; cursor:pointer; color: #ef4444;"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <form class="comment-form" data-action="submit-comment">
                            <input type="hidden" name="parentId" value="">
                            <textarea class="comment-input mention-enabled" placeholder="Escreva seu comentário..."></textarea>
                            <button type="submit">Enviar</button>
                        </form>
                        <div class="comments-list">${commentsHtml}</div>
                    </div>`;

                fragment.appendChild(postElement);
            } catch (e) {
                console.warn("Erro ao renderizar um post individual (ignorado):", e);
            }
        });

        if (prepend) {
            feedContainer.prepend(fragment);
        } else {
            feedContainer.appendChild(fragment);
        }
    };

    // --- FUNÇÕES AUXILIARES ---
    const renderSkeletonFeed = () => {
        feedContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            feedContainer.innerHTML += `
            <div class="post-card card">
                <div class="post-card-content">
                    <div class="post-header" style="margin-bottom: 15px;">
                        <div class="skeleton skeleton-avatar"></div>
                        <div style="flex: 1; margin-left: 10px;">
                            <div class="skeleton skeleton-text short"></div>
                            <div class="skeleton skeleton-text short" style="width: 30%"></div>
                        </div>
                    </div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-image"></div>
                </div>
            </div>`;
        }
    };

    const buildCommentTree = (comments) => {
        const commentMap = {};
        const roots = [];
        comments.forEach(c => { commentMap[c._id] = { ...c, children: [] }; });
        comments.forEach(c => {
            if (c.parentId && commentMap[c.parentId]) {
                commentMap[c.parentId].children.push(commentMap[c._id]);
            } else {
                roots.push(commentMap[c._id]);
            }
        });
        const sortComments = (list) => list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const processChildren = (list) => {
            sortComments(list);
            list.forEach(c => processChildren(c.children));
        };
        processChildren(roots);
        return roots;
    };

    const renderCommentHTML = (comment, level = 0, postId) => {
        const avatar = getCleanImageUrl(comment.user.avatar) || '/assets/profile-pic.png';
        const margin = level * 30;
        const likes = comment.likes || [];
        const dislikes = comment.dislikes || [];
        const isLiked = likes.includes(currentUser._id) ? 'liked' : '';
        const isDisliked = dislikes.includes(currentUser._id) ? 'disliked' : '';
        
        // Badges em Comentários
        const cVerified = (comment.user && comment.user.isVerified) ? '<i class="fa-solid fa-circle-check" style="color: #7c3aed; font-size: 0.8em; margin-left: 4px;" title="Verificado"></i>' : '';
        const cSponsor = (comment.user && comment.user.isSponsor) ? '<i class="fa-solid fa-crown" style="color: #fbbf24; font-size: 0.8em; margin-left: 4px;" title="Patrocinador"></i>' : '';

        let childrenHtml = '';
        if (comment.children && comment.children.length > 0) {
            childrenHtml = comment.children.map(c => renderCommentHTML(c, level + 1, postId)).join('');
        }
        const formattedText = formatPostContent(comment.text);
        return `
        <div class="comment" style="margin-left: ${margin}px; border-left: ${level > 0 ? '2px solid var(--border-color)' : 'none'}; padding-left: ${level > 0 ? '10px' : '0'};">
            <img src="${avatar}" class="comment-avatar">
            <div class="comment-body">
                <div style="display: flex; justify-content: space-between;">
                    <a href="/pages/perfil.html?id=${comment.user._id}" class="comment-author-link">
                        <span class="comment-author">${comment.user.name} ${cVerified} ${cSponsor}</span>
                    </a>
                    <small style="color: var(--text-secondary); font-size: 0.75rem;">${formatTimeAgo(comment.createdAt)}</small>
                </div>
                <p class="comment-text">${formattedText}</p>
                <div class="comment-actions">
                    <button class="comment-vote-btn ${isLiked}" data-action="like-comment" data-post-id="${postId}" data-comment-id="${comment._id}"><i class="fa-solid fa-thumbs-up"></i> ${likes.length}</button>
                    <button class="comment-vote-btn ${isDisliked}" data-action="dislike-comment" data-post-id="${postId}" data-comment-id="${comment._id}"><i class="fa-solid fa-thumbs-down"></i> ${dislikes.length}</button>
                    <button class="reply-btn" data-comment-id="${comment._id}" data-username="${comment.user.name}" style="background:none; border:none; color: var(--primary-color); cursor: pointer; font-weight: 600;">Responder</button>
                </div>
            </div>
        </div>${childrenHtml}`;
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

    // --- CRIAÇÃO DE POST ---
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = postContentInput.value;
        const communityId = postCommunitySelect.value || null;
        const files = postMediaFile.files;
        const urlInput = document.getElementById('postImageUrlInput').value.trim();
        const btn = createPostForm.querySelector('button[type="submit"]');

        if (!content.trim() && !tempPollData) {
            showNotification('Vazio.', true);
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            let mediaUrls = [];
            if (files.length > 0) {
                mediaUrls = await uploadFileToStorage(files, 'posts');
            } else if (urlInput) {
                mediaUrls = [urlInput];
            }

            const newPost = await fetchWithAuth('/posts', {
                method: 'POST',
                body: JSON.stringify({ content, communityId, mediaUrls, poll: tempPollData })
            });

            if (!allPosts.some(p => p._id === newPost._id)) {
                allPosts.unshift(newPost);
                renderPosts([newPost], true);
            }
            createPostForm.reset();
            postCommunitySelect.value = "";
            postMediaFile.value = "";
            document.getElementById('postImageUrlInput').value = "";
            removePollBtn.click();
            showNotification('Criado!');
        } catch (e) {
            showNotification(e.message, true);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Publicar';
        }
    });

    // --- AÇÕES NO FEED ---
    feedContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        // DENÚNCIA
        if (btn.dataset.action === 'report-post') {
            const postCard = btn.closest('.post-card');
            reportTargetIdInput.value = postCard.dataset.postId;
            reportModal.classList.add('show');
            return;
        }

        // REPOST
        if (btn.dataset.action === 'repost') {
            const postCard = btn.closest('.post-card');
            const postId = postCard.dataset.postId;
            repostPostIdInput.value = postId;
            repostCommentInput.value = '';
            repostModal.classList.add('show');
            return;
        }

        // SAVE
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

        // LIKE/DISLIKE/REPLY COMMENTS
        if (btn.dataset.action === 'like-comment' || btn.dataset.action === 'dislike-comment') {
            const postId = btn.dataset.postId;
            const commentId = btn.dataset.commentId;
            const type = btn.dataset.action === 'like-comment' ? 'like' : 'dislike';
            try {
                const updatedComments = await fetchWithAuth(`/posts/${postId}/comments/${commentId}/vote`, { method: 'PUT', body: JSON.stringify({ voteType: type }) });
                const postIndex = allPosts.findIndex(p => p._id === postId);
                allPosts[postIndex].comments = updatedComments;
                const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
                if (postCard) {
                    const commentTree = buildCommentTree(updatedComments);
                    postCard.querySelector('.comments-list').innerHTML = commentTree.map(c => renderCommentHTML(c, 0, postId)).join('');
                }
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
        if (btn.id === 'cancelReplyBtn') {
            const postCard = btn.closest('.post-card');
            postCard.querySelector('.reply-preview').style.display = 'none';
            postCard.querySelector('.comment-form input[name="parentId"]').value = '';
            postCard.querySelector('textarea').value = '';
            return;
        }

        if (!btn.dataset.action) return;
        const action = btn.dataset.action;
        const postCard = btn.closest('.post-card');
        const postId = postCard.dataset.postId;
        const post = allPosts.find(p => p._id === postId);

        try {
            if (action === 'share-post') openShareModal(post);
            if (action === 'like' || action === 'dislike') {
                const updatedVotes = await fetchWithAuth(`/posts/${postId}/vote`, { method: 'PUT', body: JSON.stringify({ voteType: action }) });
                post.likes = updatedVotes.likes;
                post.dislikes = updatedVotes.dislikes;
                
                // Atualiza visualmente
                const voteBtns = postCard.querySelector('.vote-buttons');
                const isLiked = post.likes.includes(currentUser._id);
                const isDisliked = post.dislikes.includes(currentUser._id);
                voteBtns.innerHTML = `
                    <button class="vote-btn upvote ${isLiked ? 'liked' : ''}" data-action="like"><i class="fa-solid fa-arrow-up"></i></button>
                    <span class="vote-count">${post.likes.length}</span>
                    <button class="vote-btn downvote ${isDisliked ? 'disliked' : ''}" data-action="dislike"><i class="fa-solid fa-arrow-down"></i></button>
                    <span class="vote-count">${post.dislikes.length}</span>`;
            }
            if (action === 'toggle-comment') {
                const section = postCard.querySelector('.comments-section');
                section.style.display = section.style.display === 'none' ? 'block' : 'none';
            }
            if (action === 'edit-post') {
                editPostIdInput.value = post._id;
                editPostContentInput.value = post.content;
                editPostImageUrlInput.value = getCleanImageUrl(post.imageUrl) || '';
                editPostModal.classList.add('show');
            }
            if (action === 'delete-post') {
                if (confirm('Tem certeza?')) {
                    await fetchWithAuth(`/posts/${postId}`, { method: 'DELETE' });
                    allPosts = allPosts.filter(p => p._id !== postId);
                    postCard.remove();
                    showNotification('Postagem deletada.');
                }
            }
        } catch (error) {
            showNotification(error.message, true);
        }
    });

    // --- SUBMITS DOS MODAIS ---
    if(reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetId = reportTargetIdInput.value;
            const reason = reportReasonInput.value;
            const btn = reportForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Enviando...';
            try {
                await fetchWithAuth('/reports', { method: 'POST', body: JSON.stringify({ targetId, reason, type: 'post' }) });
                showNotification('Denúncia enviada. Obrigado!');
                reportModal.classList.remove('show');
            } catch (error) { showNotification('Erro ao enviar denúncia.', true); }
            finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-flag"></i> Enviar Denúncia'; }
        });
    }

    repostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const postId = repostPostIdInput.value;
        const comment = repostCommentInput.value;
        const btn = repostForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
        try {
            const repost = await fetchWithAuth(`/posts/${postId}/repost`, { method: 'POST', body: JSON.stringify({ content: comment }) });
            if (!allPosts.some(p => p._id === repost._id)) { allPosts.unshift(repost); renderPosts([repost], true); }
            repostModal.classList.remove('show');
            showNotification('Repostado com sucesso!');
        } catch (error) { showNotification('Erro ao repostar.', true); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-retweet"></i> Repostar'; }
    });

    editPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const postId = editPostIdInput.value;
        const content = editPostContentInput.value;
        let imageUrl = editPostImageUrlInput.value;
        if (imageUrl && imageUrl.startsWith(BASE_URL)) imageUrl = imageUrl.substring(BASE_URL.length + 1);
        try {
            const updatedPost = await fetchWithAuth(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify({ content, imageUrl }), });
            const postIndex = allPosts.findIndex(p => p._id === postId);
            allPosts[postIndex] = updatedPost;
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if(postCard) postCard.querySelector('.post-content').innerHTML = formatPostContent(content);
            editPostModal.classList.remove('show');
            showNotification('Atualizado!');
        } catch (error) { showNotification(error.message, true); }
    });

    feedContainer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target.closest('form');
        if (!form || form.dataset.action !== 'submit-comment') return;
        const postCard = e.target.closest('.post-card');
        const postId = postCard.dataset.postId;
        const textarea = form.querySelector('.comment-input');
        const parentInput = form.querySelector('input[name="parentId"]');
        const text = textarea.value;
        const parentId = parentInput.value || null;
        if (!text.trim()) return;
        try {
            const updatedComments = await fetchWithAuth(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text, parentId }) });
            const postIndex = allPosts.findIndex(p => p._id === postId);
            allPosts[postIndex].comments = updatedComments;
            const commentTree = buildCommentTree(updatedComments);
            postCard.querySelector('.comments-list').innerHTML = commentTree.map(c => renderCommentHTML(c, 0, postId)).join('');
            textarea.value = '';
            parentInput.value = '';
            const preview = postCard.querySelector('.reply-preview');
            if (preview) preview.style.display = 'none';
        } catch (error) { showNotification(error.message, true); }
    });

    // --- PATROCÍNIO (CORRIGIDO COM QR CODE) ---
    if(openSponsorModalBtn) openSponsorModalBtn.addEventListener('click', () => sponsorModal.classList.add('show'));
    if(closeSponsorModalBtn) closeSponsorModalBtn.addEventListener('click', closeAllModals);
    
    window.selectPlan = (id) => {
        selectedPlanId = id;
        document.getElementById('sponsorStep1').style.display = 'none';
        document.getElementById('sponsorStep2').style.display = 'block';

        // LÓGICA DO QR CODE:
        const qrImage = document.getElementById('sponsorQrCode');
        const qrCodes = {
            '1': '/assets/qrcode_5.png',
            '2': '/assets/qrcode_10.png',
            '3': '/assets/qrcode_15.png'
        };
        // Tenta carregar a imagem específica, senão usa placeholder se falhar
        qrImage.src = qrCodes[id] || '/assets/logo-masqueko.png';
        qrImage.onerror = () => { qrImage.src = '/assets/logo-masqueko.png'; }; // Fallback
    };

    window.resetSponsorModal = () => {
        document.getElementById('sponsorStep1').style.display = 'grid';
        document.getElementById('sponsorStep2').style.display = 'none';
    };

    if(confirmPaymentBtn) confirmPaymentBtn.addEventListener('click', async () => {
        if(!selectedPlanId) return;
        confirmPaymentBtn.disabled = true;
        try {
            await fetchWithAuth('/sponsors', { method: 'POST', body: JSON.stringify({ planId: selectedPlanId }) });
            showNotification('Pedido enviado! Aguarde aprovação.');
            sponsorModal.classList.remove('show');
            resetSponsorModal();
        } catch(e) { showNotification(e.message, true); }
        confirmPaymentBtn.disabled = false;
    });

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
        } catch (error) { shareFriendList.innerHTML = '<p style="text-align: center;">Erro ao carregar amigos.</p>'; }
    };
    const renderFriendList = (friends) => {
        shareFriendList.innerHTML = '';
        if (friends.length === 0) { shareFriendList.innerHTML = '<p style="text-align: center;">Você não tem amigos.</p>'; return; }
        friends.forEach(friend => {
            const avatar = getCleanImageUrl(friend.avatar) || '/assets/profile-pic.png';
            const li = document.createElement('li');
            li.className = 'share-user-item';
            li.innerHTML = `<img src="${avatar}" class="share-avatar"><span class="share-name">${friend.name}</span><button class="share-btn-send" data-uid="${friend._id}">Enviar</button>`;
            li.querySelector('button').addEventListener('click', async (e) => {
                const btn = e.target; btn.textContent = '...'; btn.disabled = true;
                const commName = currentPostToShare.community ? currentPostToShare.community.name : 'Global';
                const commId = currentPostToShare.community ? currentPostToShare.community._id : null;
                try {
                    const sharedPostData = { _id: currentPostToShare._id, content: currentPostToShare.content, imageUrl: currentPostToShare.imageUrl, communityName: commName, authorName: currentPostToShare.user.name, communityId: commId };
                    await fetchWithAuth('/chat/message', { method: 'POST', body: JSON.stringify({ recipientId: friend._id, sharedPost: sharedPostData, text: '' }) });
                    btn.textContent = 'Enviado!'; setTimeout(() => { sharePostModal.classList.remove('show'); btn.textContent = 'Enviar'; btn.disabled = false; }, 800);
                } catch (error) { showNotification('Erro ao compartilhar.', true); btn.textContent = 'Erro'; }
            });
            shareFriendList.appendChild(li);
        });
    };
    shareSearchInput?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = myFriends.filter(f => f.name.toLowerCase().includes(term));
        renderFriendList(filtered);
    });

    const renderTrendingTags = (tags) => {
        const container = document.getElementById('trendingListContainer');
        if (container && tags) {
            container.innerHTML = '';
            tags.forEach(tagData => {
                container.innerHTML += `<li class="trending-item"><a href="/pages/tag.html?tag=${tagData.tag}">#${tagData.tag}</a><span class="trending-count">${tagData.count} posts</span></li>`;
            });
        }
    };

    logoutButton.addEventListener('click', logout);
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);

    setupMarkdownToolbar('postContentInput');
    setupGlobalMentionLogic();
});