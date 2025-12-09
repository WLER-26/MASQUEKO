// === Script para a Página de Hashtag (tag.html) ===
document.addEventListener('DOMContentLoaded', () => {
    
    let currentUser = null;
    let taggedPosts = []; 

    const feedContainer = document.getElementById('feedContainer');
    const logoutButton = document.getElementById('logoutButton');
    const navUsername = document.getElementById('navUsername');
    const navUserPic = document.getElementById('navUserPic');
    const headerEl = document.querySelector('.tag-header span');

    auth.onAuthStateChanged(user => {
        if (user) {
            loadPageData();
            connectToNotificationSocket();
        } else {
            window.location.href = '/pages/index.html';
        }
    });

    let notificationSocket = null;
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
    
    const loadPageData = async () => {
        try {
            currentUser = await fetchWithAuth('/auth/me');
            
            const avatarUrl = currentUser.avatar.startsWith('http') 
                ? currentUser.avatar 
                : `${BASE_URL}/${currentUser.avatar}`;
            navUsername.textContent = currentUser.name;
            navUserPic.src = avatarUrl;

            const params = new URLSearchParams(window.location.search);
            const tag = params.get('tag');

            if (!tag) {
                feedContainer.innerHTML = '<p>Nenhuma tag especificada.</p>';
                return;
            }

            document.title = `Posts com #${tag} - MASQUEKO`;
            headerEl.textContent = `#${tag}`;

            taggedPosts = await fetchWithAuth(`/posts/tag/${tag}`);
            
            renderFeed(taggedPosts);

        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('404')) {
                logout();
                return;
            }
            showNotification(error.message, true);
            feedContainer.innerHTML = '<p>Erro ao carregar os posts.</p>';
        }
    };

    const renderFeed = (posts) => {
        feedContainer.innerHTML = '';
        if (posts.length === 0) {
            feedContainer.innerHTML = `<p>Nenhum post encontrado com esta hashtag.</p>`;
            return;
        }
        
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        posts.forEach(post => {
            // CORREÇÃO: Permitir post sem comunidade
            if (!post || !post.user) return; 

            const postElement = document.createElement('div');
            postElement.className = 'post-card card';
            postElement.dataset.postId = post._id; 

            const postAvatar = post.user.avatar.startsWith('http') 
                ? post.user.avatar 
                : `${BASE_URL}/${post.user.avatar}`;
            
            let postMediaHtml = '';
            if (post.imageUrl) {
                const mediaUrl = post.imageUrl.startsWith('http') 
                    ? post.imageUrl 
                    : `${BASE_URL}/${post.imageUrl}`;

                 if (mediaUrl.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
                    postMediaHtml = `<div class="post-image-container"><video controls class="post-video" style="width: 100%; max-height: 500px; border-radius: var(--border-radius-md);"><source src="${mediaUrl}" type="video/mp4">Seu navegador não suporta vídeos.</video></div>`;
                 } else {
                    postMediaHtml = `<div class="post-image-container"><img src="${mediaUrl}" alt="Imagem do post" class="post-image"></div>`;
                 }
            }

            const isLiked = currentUser && (post.likes || []).includes(currentUser._id);
            const isDisliked = currentUser && (post.dislikes || []).includes(currentUser._id);
            const likeClass = isLiked ? 'liked' : '';
            const dislikeClass = isDisliked ? 'disliked' : '';
            const likeIcon = 'fa-solid fa-arrow-up';
            const dislikeIcon = 'fa-solid fa-arrow-down';

            const postActionButtons = ''; 

            const commentsHtml = (post.comments || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(comment => {
                if (!comment || !comment.user) return '';
                const commentAvatar = comment.user.avatar.startsWith('http') 
                    ? comment.user.avatar 
                    : `${BASE_URL}/${comment.user.avatar}`;
                return `
                <div class="comment">
                    <img src="${commentAvatar}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body">
                        <a href="/pages/perfil.html?id=${comment.user._id}" class="comment-author-link"><span class="comment-author">${comment.user.name}</span></a>
                        <p class="comment-text">${comment.text}</p>
                    </div>
                </div>
            `;
            }).join('');

            let locationHtml = '';
            if (post.community) {
                locationHtml = `em <a href="/pages/community.html?id=${post.community._id}">c/${post.community.name}</a>`;
            } else {
                locationHtml = `<span>(Global)</span>`;
            }

            postElement.innerHTML = `
                <div class="post-card-content">
                    <div class="post-header">
                        <img src="${postAvatar}" alt="Avatar" class="post-avatar">
                        <div>
                            <span class="post-author"><a href="/pages/perfil.html?id=${post.user._id}">${post.user.name}</a></span>
                            <span class="post-meta">${locationHtml} • ${formatTimeAgo(post.createdAt)}</span>
                        </div>
                        ${postActionButtons}
                    </div>
                    <div class="post-content"><p>${formatPostContent(post.content)}</p></div>
                    ${postMediaHtml}
                </div>
                <div class="post-actions">
                    <div class="vote-buttons">
                        <button class="vote-btn upvote ${likeClass}" data-action="like">
                            <i class="${likeIcon}"></i>
                        </button>
                        <span class="vote-count">${(post.likes || []).length}</span>
                        <button class="vote-btn downvote ${dislikeClass}" data-action="dislike">
                            <i class="${dislikeIcon}"></i>
                        </button>
                    </div>
                    <button class="comment-button" data-action="toggle-comment">
                        <i class="fa-regular fa-comment"></i>
                        <span>${(post.comments || []).length} Comentários</span>
                    </button>
                </div>
                <div class="comments-section" style="display: none;">
                    <form class="comment-form" data-action="submit-comment">
                        <textarea class="comment-input" placeholder="Escreva seu comentário..."></textarea>
                        <button type="submit">Enviar</button>
                    </form>
                    <div class="comments-list">${commentsHtml}</div>
                </div>
            `;
            feedContainer.appendChild(postElement);
        });
    };

    feedContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button || !button.dataset.action) return;

        const action = button.dataset.action;
        const postCard = e.target.closest('.post-card');
        const postId = postCard.dataset.postId;
        const post = taggedPosts.find(p => p._id === postId);

        try {
            if (action === 'like' || action === 'dislike') {
                const updatedVotes = await fetchWithAuth(`/posts/${postId}/vote`, { 
                    method: 'PUT',
                    body: JSON.stringify({ voteType: action })
                });
                
                post.likes = updatedVotes.likes;
                post.dislikes = updatedVotes.dislikes;
                renderFeed(taggedPosts);
            }

            if (action === 'toggle-comment') {
                const commentsSection = postCard.querySelector('.comments-section');
                commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
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

        if (!text.trim()) {
            showNotification('O comentário não pode estar vazio.', true);
            return;
        }

        try {
            const updatedComments = await fetchWithAuth(`/posts/${postId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ text })
            });

            const postIndex = taggedPosts.findIndex(p => p._id === postId);
            taggedPosts[postIndex].comments = updatedComments;
            renderFeed(taggedPosts);
            textarea.value = '';
        } catch (error) {
            showNotification(error.message, true);
        }
    });

    logoutButton.addEventListener('click', logout);
    
});