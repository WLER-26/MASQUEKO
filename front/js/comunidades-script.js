// === Script para a Página de Comunidades (comunidades.html) ===
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            if (!user.emailVerified) {
                auth.signOut();
                window.location.href = '/pages/index.html';
                return;
            }
            loadInitialData();
            connectToNotificationSocket();
        } else {
            window.location.href = '/pages/index.html';
        }
    });

    const communityList = document.getElementById('community-list');
    const modal = document.getElementById('createCommunityModal');
    const showModalBtn = document.getElementById('showCreateCommunityModalBtn');
    const cancelBtn = document.getElementById('cancelCreateCommunityBtn');
    const createCommunityForm = document.getElementById('createCommunityForm');
    const logoutButton = document.getElementById('logoutButton');
    const navUsername = document.getElementById('navUsername');
    const navUserPic = document.getElementById('navUserPic');

    const modalTitle = document.getElementById('modal-title-community');
    const submitBtn = document.getElementById('createCommunitySubmitBtn');
    const editCommunityIdInput = document.getElementById('editCommunityId');
    const communityNameInput = document.getElementById('communityName');
    const communityDescriptionInput = document.getElementById('communityDescriptionInput');
    const communityIsPrivateInput = document.getElementById('communityIsPrivate');
    const communityShowGlobalInput = document.getElementById('communityShowGlobal'); // Novo Checkbox
    const globalFeedOptionDiv = document.getElementById('globalFeedOption'); // Div Container
    const communityImageFileInput = document.getElementById('communityImageFile');
    const communityImageUrlInput = document.getElementById('communityImageUrl');

    let currentUser = null;
    let allCommunities = [];

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

    // Lógica visual para mostrar/esconder a opção extra
    communityIsPrivateInput.addEventListener('change', (e) => {
        if (e.target.checked) {
            globalFeedOptionDiv.style.display = 'block';
        } else {
            globalFeedOptionDiv.style.display = 'none';
            communityShowGlobalInput.checked = false; // Reseta
        }
    });

    const renderCommunities = (communities) => {
        communityList.innerHTML = '';
        if (communities.length === 0) {
            communityList.innerHTML = '<p>Nenhuma comunidade foi criada ainda. Crie a primeira!</p>';
            return;
        }

        communities.forEach(community => {
            const commId = community._id || community.id;
            
            if (!commId) {
                console.error("Comunidade sem ID encontrada:", community);
                return; 
            }

            const imageUrl = (community.imageUrl && community.imageUrl.startsWith('http'))
                ? community.imageUrl
                : `${BASE_URL}/${community.imageUrl || 'assets/logo-masqueko.png'}`;

            let adminActions = '';
            if (currentUser && community.creator && (currentUser._id === community.creator._id || (community.creator && currentUser._id === community.creator))) {
                adminActions = `
                    <div class="community-admin-actions">
                        <button class="admin-btn edit" data-action="edit" data-id="${commId}" title="Editar"><i class="fa-solid fa-pencil"></i></button>
                        <button class="admin-btn delete" data-action="delete" data-id="${commId}" title="Deletar"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                `;
            }

            const lockIcon = community.isPrivate ? '<i class="fa-solid fa-lock" title="Comunidade Privada" style="color: var(--text-secondary); margin-left: 5px; font-size: 0.8em;"></i>' : '';

            const card = document.createElement('div');
            card.className = 'community-card';
            card.innerHTML = `
                ${adminActions}
                <img src="${imageUrl}" alt="Avatar da Comunidade" class="community-avatar">
                <div class="community-info">
                    <h3 class="community-name">c/${community.name} ${lockIcon}</h3>
                    <p class="community-desc">${community.description}</p>
                </div>
                <div class="community-actions">
                    <a href="/pages/community.html?id=${commId}"><button><i class="fa-solid fa-arrow-right-to-bracket"></i> Explorar</button></a>
                </div>`;
            communityList.appendChild(card);
        });
    };

    const loadInitialData = async () => {
        try {
            const [user, communities] = await Promise.all([
                fetchWithAuth('/auth/me'),
                fetchWithAuth('/communities')
            ]);
            
            currentUser = user; 
            allCommunities = communities;

            const avatarUrl = user.avatar.startsWith('http') 
                ? user.avatar 
                : `${BASE_URL}/${user.avatar}`;
            navUsername.textContent = user.name;
            navUserPic.src = avatarUrl;

            renderCommunities(allCommunities);
        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('404')) {
                console.warn("Perfil corrompido. Logout.");
                logout();
                return;
            }
            showNotification(error.message, true);
        }
    };
    
    const openCreateModal = () => {
        modalTitle.textContent = 'Criar Nova Comunidade';
        submitBtn.textContent = 'Criar Comunidade';
        createCommunityForm.reset();
        editCommunityIdInput.value = '';
        globalFeedOptionDiv.style.display = 'none'; // Reseta visual
        modal.classList.add('show');
    };

    const openEditModal = (community) => {
        modalTitle.textContent = `Editar c/${community.name}`;
        submitBtn.textContent = 'Salvar Alterações';
        editCommunityIdInput.value = community._id;
        communityNameInput.value = community.name;
        communityDescriptionInput.value = community.description;
        
        communityIsPrivateInput.checked = community.isPrivate || false;
        if (community.isPrivate) {
            globalFeedOptionDiv.style.display = 'block';
            communityShowGlobalInput.checked = community.allowGlobalFeed || false;
        } else {
            globalFeedOptionDiv.style.display = 'none';
            communityShowGlobalInput.checked = false;
        }

        if (community.imageUrl && community.imageUrl.startsWith('http')) {
            communityImageUrlInput.value = community.imageUrl;
        } else {
             communityImageUrlInput.value = '';
        }
        communityImageFileInput.value = null;
        modal.classList.add('show');
    };

    const closeModal = () => modal.classList.remove('show');
    showModalBtn?.addEventListener('click', openCreateModal);
    cancelBtn?.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    createCommunityForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = communityNameInput.value.trim();
        const description = communityDescriptionInput.value.trim();
        let imageUrl = communityImageUrlInput.value.trim();
        const file = communityImageFileInput.files[0];
        const isPrivate = communityIsPrivateInput.checked;
        const allowGlobalFeed = isPrivate ? communityShowGlobalInput.checked : true;
        const editingId = editCommunityIdInput.value;

        if (!name || !description) {
            showNotification('Nome e descrição são obrigatórios.', true);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';

        try {
            if (file) {
                imageUrl = await uploadFileToStorage(file, 'avatars'); 
            }

            const method = editingId ? 'PUT' : 'POST';
            const endpoint = editingId ? `/communities/${editingId}` : '/communities';

            await fetchWithAuth(endpoint, {
                method: method,
                body: JSON.stringify({ name, description, imageUrl, isPrivate, allowGlobalFeed }),
            });
            
            showNotification(`Comunidade ${editingId ? 'atualizada' : 'criada'} com sucesso!`);
            closeModal();
            createCommunityForm.reset();
            loadInitialData();

        } catch (error) {
            showNotification(error.message, true);
        } finally {
            submitBtn.disabled = false; // Corrigido para submitBtn
        }
    });

    communityList.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const communityId = button.dataset.id;

        if (action === 'delete') {
            const community = allCommunities.find(c => c._id === communityId);
            if (!community) return;

            if (confirm(`Tem certeza que quer deletar "c/${community.name}"?\nTODOS OS POSTS desta comunidade serão perdidos.`)) {
                try {
                    await fetchWithAuth(`/communities/${communityId}`, { method: 'DELETE' });
                    showNotification('Comunidade deletada com sucesso.');
                    loadInitialData();
                } catch (error) {
                    showNotification(error.message, true);
                }
            }
        }

        if (action === 'edit') {
            const community = allCommunities.find(c => c._id === communityId);
            if (community) {
                openEditModal(community);
            }
        }
    });

    logoutButton.addEventListener('click', logout);
    // ADICIONADO: Listener do botão Sair Mobile
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);
});