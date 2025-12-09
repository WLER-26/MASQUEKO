document.addEventListener('DOMContentLoaded', () => {
    const feedContainer = document.getElementById('feedContainer');
    const navUsername = document.getElementById('navUsername');
    const navUserPic = document.getElementById('navUserPic');
    const logoutButton = document.getElementById('logoutButton');
    
    let currentUser = null;
    let savedPosts = [];

    auth.onAuthStateChanged(user => {
        if (user) {
            loadPageData();
        } else {
            window.location.href = '/pages/index.html';
        }
    });

    const loadPageData = async () => {
        try {
            currentUser = await fetchWithAuth('/auth/me');
            localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));
            
            navUsername.textContent = currentUser.name;
            navUserPic.src = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png';

            savedPosts = await fetchWithAuth('/posts/saved');
            renderFeed(savedPosts);

        } catch (error) {
            feedContainer.innerHTML = '<p>Erro ao carregar favoritos.</p>';
        }
    };

    const renderFeed = (posts) => {
        feedContainer.innerHTML = '';
        if (posts.length === 0) {
            feedContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">Você ainda não salvou nenhuma postagem.</p>';
            return;
        }
        
        posts.forEach(post => {
            if (!post || !post.user) return; 

            const postElement = document.createElement('div');
            postElement.className = 'post-card card';
            postElement.dataset.postId = post._id; 

            const postAvatar = getCleanImageUrl(post.user.avatar) || '/assets/profile-pic.png';
            const postMediaHtml = getPostMediaHtml(post.mediaUrls || post.imageUrl, post.linkPreview);
            
            // Botão de Salvar sempre ativo nesta página
            const isSavedClass = 'active'; 
            const saveIcon = 'fa-solid fa-bookmark';

            let locationHtml = post.community ? `em <a href="/pages/community.html?id=${post.community._id}">c/${post.community.name}</a>` : `<span>(Global)</span>`;

            postElement.innerHTML = `
                <div class="post-card-content">
                    <div class="post-header">
                        <img src="${postAvatar}" alt="Avatar" class="post-avatar">
                        <div>
                            <span class="post-author"><a href="/pages/perfil.html?id=${post.user._id}">${post.user.name}</a></span>
                            <span class="post-meta">${locationHtml} • ${formatTimeAgo(post.createdAt)}</span>
                        </div>
                        <button class="save-btn ${isSavedClass}" data-action="toggle-save" title="Remover dos favoritos">
                            <i class="${saveIcon}"></i>
                        </button>
                    </div>
                    <div class="post-content"><p>${formatPostContent(post.content)}</p></div>
                    ${postMediaHtml}
                </div>
                <div class="post-actions">
                    <button class="comment-button" onclick="window.location.href='/pages/home.html'"><i class="fa-solid fa-arrow-right"></i> Ver postagem completa</button>
                </div>
            `;
            feedContainer.appendChild(postElement);
        });
    };

    feedContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn || btn.dataset.action !== 'toggle-save') return;

        const postCard = btn.closest('.post-card');
        const postId = postCard.dataset.postId;

        try {
            const response = await fetchWithAuth(`/users/save/${postId}`, { method: 'PUT' });
            
            // Atualiza usuário local
            currentUser.savedPosts = response.savedPosts;
            localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));

            // Remove o card visualmente
            postCard.remove();
            showNotification('Removido dos favoritos.');
            
            if (feedContainer.children.length === 0) {
                feedContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">Você ainda não salvou nenhuma postagem.</p>';
            }

        } catch (error) {
            showNotification('Erro ao remover.', true);
        }
    });

    logoutButton.addEventListener('click', logout);
    // ADICIONADO: Listener do botão Sair Mobile
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);
});