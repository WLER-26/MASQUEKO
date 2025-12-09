// === Script para a Página de Amigos (amigos.html) ===
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            loadInitialData();
            connectToNotificationSocket();
        } else {
            window.location.href = '/pages/index.html';
        }
    });

    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    const searchResultsContainer = document.getElementById('searchResults');
    const requestListContainer = document.getElementById('requestList');
    const friendListContainer = document.getElementById('friendList');
    const searchInput = document.getElementById('searchInput');
    const tagInput = document.getElementById('tagInput');
    const friendsCountEl = document.getElementById('friendsCount'); // Novo contador
    const logoutButton = document.getElementById('logoutButton');
    const navUsername = document.getElementById('navUsername');
    const navUserPic = document.getElementById('navUserPic');

    let currentUser = null;

    let notificationSocket = null;
    const connectToNotificationSocket = async () => {
        if (notificationSocket && notificationSocket.connected) return; 
        const token = await getToken();
        if (!token) return;
        notificationSocket = io(BASE_URL, { auth: { token } });
        notificationSocket.on('newMessage', (message) => {
            const dot = document.getElementById('notificationDot');
            if (dot) dot.style.display = 'block';
        });
    };

    // --- RENDERIZAÇÃO DO CARD ATUALIZADA ---
    const renderUserCard = (user, type) => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.dataset.userId = user._id;

        const avatarUrl = getCleanImageUrl(user.avatar) || '/assets/profile-pic.png';
        
        // Pega a primeira tag se existir
        const firstTag = (user.tags && user.tags.length > 0) ? user.tags[0] : null;
        const tagHtml = firstTag ? `<span class="user-tag">#${firstTag}</span>` : '';

        let actionsHtml = '';
        
        if (type === 'search') {
            if (currentUser.friends.some(friend => friend._id === user._id)) {
                actionsHtml = `<button class="btn-disabled" disabled><i class="fa-solid fa-user-check"></i> Amigos</button>`;
            } else if (currentUser.friendRequests.some(req => req._id === user._id)) {
                actionsHtml = `<button class="btn-disabled" disabled><i class="fa-solid fa-clock"></i> Recebido</button>`;
            } else if (user.friendRequests && user.friendRequests.includes(currentUser._id)) {
                actionsHtml = `<button class="btn-disabled" disabled><i class="fa-solid fa-paper-plane"></i> Enviado</button>`;
            } else {
                actionsHtml = `<button class="btn-primary" data-action="add" data-user-id="${user._id}"><i class="fa-solid fa-user-plus"></i> Adicionar</button>`;
            }
        } else if (type === 'request') {
            actionsHtml = `
                <button class="btn-primary" data-action="accept" data-user-id="${user._id}"><i class="fa-solid fa-check"></i> Aceitar</button>
                <button class="btn-outline" data-action="reject" data-user-id="${user._id}"><i class="fa-solid fa-xmark"></i></button>`;
        } else if (type === 'friend') {
            actionsHtml = `
                <a href="/pages/chat.html?id=${user._id}" style="text-decoration: none; flex: 1;">
                    <button class="btn-secondary" style="width: 100%"><i class="fa-solid fa-comments"></i> Chat</button>
                </a>
                <button class="btn-danger" style="flex: 0 0 auto;" data-action="remove" data-user-id="${user._id}" title="Remover"><i class="fa-solid fa-trash"></i></button>`;
        }

        // Estrutura HTML Nova (Flex Column)
        card.innerHTML = `
            <div class="user-header-info">
                <img src="${avatarUrl}" alt="${user.name}" class="user-avatar">
                <div class="user-info">
                    <a href="/pages/perfil.html?id=${user._id}" class="user-name-link"><h3 class="user-name">${user.name}</h3></a>
                    ${tagHtml}
                    <p class="user-bio">${user.bio || 'Sem bio definida.'}</p>
                </div>
            </div>
            <div class="user-actions">${actionsHtml}</div>
        `;
        return card;
    };
    
    const renderLists = (container, users, type, placeholder) => {
        container.innerHTML = '';
        if (users && users.length > 0) {
            users.forEach(user => container.appendChild(renderUserCard(user, type)));
        } else {
            container.innerHTML = `<p class="user-list-placeholder">${placeholder}</p>`;
        }
    };

    const loadInitialData = async () => {
        try {
            const me = await fetchWithAuth('/auth/me');
            
            const fetchUserDetailsList = async (idList) => {
                if (!idList || idList.length === 0) return [];
                const userPromises = idList.map(id => {
                    return fetchWithAuth(`/users/${id}`)
                        .then(profile => ({ status: 'fulfilled', value: profile.user })) 
                        .catch(error => ({ status: 'rejected', reason: error, id: id })); 
                });
                const results = await Promise.all(userPromises);
                const validUsers = [];
                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        validUsers.push(result.value);
                    }
                });
                return validUsers;
            };

            const [friendsData, requestsData] = await Promise.all([
                fetchUserDetailsList(me.friends),
                fetchUserDetailsList(me.friendRequests)
            ]);
            
            currentUser = { ...me, friends: friendsData, friendRequests: requestsData };
            localStorage.setItem('masqueko-user-profile', JSON.stringify(currentUser));

            const avatarUrl = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png';
            navUsername.textContent = currentUser.name;
            navUserPic.src = avatarUrl;

            // Atualiza contador
            if(friendsCountEl) friendsCountEl.textContent = currentUser.friends.length;

            renderLists(friendListContainer, currentUser.friends, 'friend', 'Você ainda não tem amigos.');
            renderLists(requestListContainer, currentUser.friendRequests, 'request', 'Nenhum pedido pendente.');
            
            // Verifica busca vinda de menção
            const params = new URLSearchParams(window.location.search);
            const searchParam = params.get('search');
            if (searchParam) {
                // Se veio da busca, muda a aba ativa para "search"
                document.querySelector('.tab-btn[data-tab="search"]').click();
                searchInput.value = searchParam;
                performSearch(); 
            } else {
                searchResultsContainer.innerHTML = `<p class="user-list-placeholder">Busque por nome ou interesse.</p>`;
            }

        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('404')) {
                logout(); return;
            }
            showNotification(error.message, true);
        }
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            contents.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab)?.classList.add('active');
        });
    });

    let searchTimeout;
    const performSearch = async () => {
        const searchTerm = searchInput.value.trim();
        const tagTerm = tagInput.value.trim();

        if (searchTerm.length < 2 && tagTerm.length < 2) {
            searchResultsContainer.innerHTML = `<p class="user-list-placeholder">Digite pelo menos 2 caracteres.</p>`;
            return;
        }

        try {
            let queryString = '/users?';
            if (searchTerm) queryString += `search=${encodeURIComponent(searchTerm)}&`;
            if (tagTerm) queryString += `tag=${encodeURIComponent(tagTerm)}`;

            const users = await fetchWithAuth(queryString);
            renderLists(searchResultsContainer, users, 'search', 'Nenhum usuário encontrado.');
        } catch (error) {
            showNotification(error.message, true);
        }
    };

    const handleInput = () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 400);
    };

    searchInput.addEventListener('input', handleInput);
    tagInput.addEventListener('input', handleInput);

    document.querySelector('.main-content-wrapper').addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const userId = button.dataset.userId;

        if (action === 'chat') return; // Link normal trata isso

        try {
            let result;
            switch (action) {
                case 'add':
                    result = await fetchWithAuth(`/users/${userId}/add`, { method: 'POST' });
                    showNotification(result.message);
                    button.innerHTML = '<i class="fa-solid fa-check"></i> Enviado';
                    button.className = 'btn-disabled';
                    button.disabled = true;
                    break;
                case 'accept':
                    result = await fetchWithAuth(`/users/${userId}/accept`, { method: 'PUT' });
                    showNotification(result.message);
                    loadInitialData(); 
                    break;
                case 'reject':
                case 'remove':
                    result = await fetchWithAuth(`/users/${userId}/remove`, { method: 'DELETE' });
                    showNotification(result.message);
                    loadInitialData(); 
                    break;
            }
        } catch (error) {
            showNotification(error.message, true);
        }
    });

    logoutButton.addEventListener('click', logout);
    // ADICIONADO: Listener do botão Sair Mobile
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);
});