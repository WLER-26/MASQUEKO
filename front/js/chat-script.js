// === Script para a Página de Chat (chat.html) ===
document.addEventListener('DOMContentLoaded', () => {
    
    const navUsername = document.getElementById('navUsername');
    const navUserPic = document.getElementById('navUserPic');
    const conversationList = document.querySelector('.user-list-container');
    const chatWindow = document.getElementById('chatWindow');
    const messageInputArea = document.getElementById('messageInputArea');
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const recordButton = document.getElementById('recordButton'); 
    const chatContainer = document.getElementById('chatContainer');
    const chatMessagesArea = document.getElementById('chatMessagesArea');
    const chatPlaceholder = document.querySelector('.chat-placeholder');
    const chatBackButton = document.getElementById('chatBackButton');
    const chatHeaderPic = document.getElementById('chatHeaderPic');
    const chatHeaderName = document.getElementById('chatHeaderName');
    
    let currentUser = null;
    let socket = null;
    let activeChatUserId = null; 
    let activeChatUser = null;
    let isConnecting = false; 
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            if (!user.emailVerified) { auth.signOut(); window.location.href = '/pages/index.html'; return; }
            try {
                if (!currentUser) {
                    currentUser = await fetchWithAuth('/auth/me'); 
                    const avatarUrl = getCleanImageUrl(currentUser.avatar) || '/assets/profile-pic.png';
                    navUsername.textContent = currentUser.name;
                    navUserPic.src = avatarUrl;
                }
            } catch (error) { return; }

            if (!socket && !isConnecting) { isConnecting = true; connectAndSetupListeners(); }
            loadConversations();
            const dot = document.getElementById('notificationDot'); if (dot) dot.style.display = 'none';
        } else { window.location.href = '/pages/index.html'; }
    });

    const connectAndSetupListeners = async () => {
        const token = await getToken(); 
        if (!token) return;
        socket = io(BASE_URL, { auth: { token } });
        socket.on('connect', () => { 
            isConnecting = false; 
            // Solicita status inicial de quem está online
            socket.emit('get_online_users');
        });
        
        socket.on('connect_error', (err) => { isConnecting = false; socket = null; });
        
        socket.on('newMessage', (message) => {
            if (message.senderId === activeChatUserId || (message.senderId === currentUser._id && message.recipientId === activeChatUserId)) {
                renderMessage(message);
            } else { loadConversations(); }
        });

        // --- EVENTOS DE STATUS ONLINE ---
        socket.on('user_status', (data) => {
            updateUserStatus(data.userId, data.status);
        });

        socket.on('online_users_list', (onlineIds) => {
            onlineIds.forEach(id => updateUserStatus(id, 'online'));
        });
    };

    const updateUserStatus = (userId, status) => {
        // Busca o elemento da bolinha correspondente ao usuário
        const indicator = document.querySelector(`.user-list-item[data-user-id="${userId}"] .status-indicator`);
        if (indicator) {
            if (status === 'online') {
                indicator.classList.add('online');
            } else {
                indicator.classList.remove('online');
            }
        }
    };

    const userCache = new Map();
    const loadConversations = async () => {
        if (!currentUser) return; 
        try {
            const usersFromHistory = await fetchWithAuth('/chat');
            usersFromHistory.forEach(user => userCache.set(user._id, user));
            const params = new URLSearchParams(window.location.search);
            const urlUserId = params.get('id');
            let userToSelect = null;
            if (urlUserId) {
                userToSelect = urlUserId;
                if (!userCache.has(urlUserId)) {
                    const friendProfile = await fetchWithAuth(`/users/${urlUserId}`);
                    if (friendProfile && friendProfile.user) userCache.set(friendProfile.user._id, friendProfile.user);
                }
            }
            conversationList.innerHTML = '';
            userCache.forEach(user => {
                const item = renderConversationItem(user);
                if (user._id === urlUserId) conversationList.prepend(item); else conversationList.appendChild(item);
            });
            
            // Se o socket já estiver conectado, pede atualização para colorir as bolinhas recém-renderizadas
            if (socket && socket.connected) socket.emit('get_online_users');

            if (userToSelect) selectChat(userToSelect);
        } catch (error) { showNotification(error.message, true); }
    };
    
    const renderConversationItem = (user) => {
        const avatarUrl = getCleanImageUrl(user.avatar) || '/assets/profile-pic.png';
        const userElement = document.createElement('div');
        userElement.className = 'user-list-item';
        userElement.dataset.userId = user._id;
        
        // ADICIONADO: Container para imagem + bolinha de status
        userElement.innerHTML = `
            <div class="user-avatar-container">
                <img src="${avatarUrl}" alt="Avatar" class="user-list-avatar">
                <span class="status-indicator"></span>
            </div>
            <span class="user-list-name">${user.name}</span>
        `;
        userElement.addEventListener('click', () => selectChat(user._id));
        return userElement;
    };

    const selectChat = async (userId) => {
        activeChatUserId = userId;
        activeChatUser = userCache.get(userId);
        chatMessagesArea.innerHTML = ''; 
        document.querySelectorAll('.user-list-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`.user-list-item[data-user-id="${userId}"]`)?.classList.add('active');
        messageInputArea.style.display = 'flex'; 
        if(chatPlaceholder) chatPlaceholder.style.display = 'none';
        if (activeChatUser) {
            chatHeaderName.textContent = activeChatUser.name;
            chatHeaderPic.src = getCleanImageUrl(activeChatUser.avatar) || '/assets/profile-pic.png';
        }
        chatContainer.classList.add('chat-active');
        try {
            const messages = await fetchWithAuth(`/chat/${userId}`);
            messages.forEach(renderMessage);
        } catch (error) { showNotification(error.message, true); }
    };
    
    const renderMessage = (message) => {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        if (message.senderId === currentUser._id) bubble.classList.add('sent'); else bubble.classList.add('received');
        
        let contentHtml = '';

        if (message.sharedPost) {
            const post = message.sharedPost;
            const imageUrl = post.imageUrl ? getCleanImageUrl(post.imageUrl) : null;
            contentHtml += `
                <div class="shared-post-card" onclick="window.location.href='/pages/home.html'"> 
                    ${imageUrl ? `<img src="${imageUrl}" class="shared-post-image">` : ''}
                    <div class="shared-post-content">
                        <span class="shared-post-meta">De: ${post.authorName} em c/${post.communityName}</span>
                        <p class="shared-post-text">${post.content}</p>
                    </div>
                </div>
            `;
        }

        if (message.audioUrl) {
            const audioSrc = getCleanImageUrl(message.audioUrl);
            const audioPlayer = document.createElement('audio');
            audioPlayer.controls = true;
            audioPlayer.src = audioSrc;
            audioPlayer.onerror = () => console.error("Erro áudio:", audioSrc);
            bubble.innerHTML = contentHtml;
            bubble.appendChild(audioPlayer);
            if (message.text) { const textSpan = document.createElement('span'); textSpan.textContent = message.text; bubble.appendChild(textSpan); }
        } else {
            if (message.text) contentHtml += `<span>${message.text}</span>`;
            bubble.innerHTML = contentHtml;
        }
        chatMessagesArea.prepend(bubble); 
    };

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text || !activeChatUserId || !socket) return;
        socket.emit('privateMessage', { recipientId: activeChatUserId, text: text });
        messageInput.value = '';
    });

    recordButton.addEventListener('click', async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showNotification("Seu navegador não suporta gravação de áudio ou está bloqueado por falta de HTTPS.", true);
            return;
        }

        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                
                mediaRecorder.ondataavailable = (event) => { audioChunks.push(event.data); };
                
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    if (audioBlob.size < 1000) return; 

                    const audioFile = new File([audioBlob], "voice.webm", { type: 'audio/webm' });
                    
                    recordButton.disabled = true;
                    recordButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                    try {
                        const audioUrl = await uploadFileToStorage(audioFile, 'audios'); 
                        if (activeChatUserId && socket) {
                            socket.emit('privateMessage', { recipientId: activeChatUserId, text: '', audioUrl: audioUrl });
                        }
                    } catch (error) { 
                        showNotification('Erro ao enviar áudio.', true); 
                    } finally {
                        recordButton.disabled = false;
                        recordButton.classList.remove('recording');
                        recordButton.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                        messageInput.placeholder = "Digite sua mensagem...";
                        messageInput.disabled = false;
                    }
                };

                mediaRecorder.start();
                isRecording = true;
                recordButton.classList.add('recording');
                recordButton.innerHTML = '<i class="fa-solid fa-stop"></i>'; 
                messageInput.placeholder = "Gravando...";
                messageInput.disabled = true;

            } catch (err) { 
                console.error("Erro de microfone:", err);
                
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    showNotification("Permissão negada. Libere o microfone no navegador.", true);
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    showNotification("Nenhum microfone encontrado.", true);
                } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                    showNotification("Microfone já está sendo usado por outro programa.", true);
                } else if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    showNotification("Áudio bloqueado: Acesse via 'localhost' ou configure HTTPS.", true);
                } else {
                    showNotification("Não foi possível acessar o microfone.", true);
                }
            }
        } else {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                isRecording = false;
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }
    });

    chatBackButton.addEventListener('click', () => {
        chatContainer.classList.remove('chat-active');
        activeChatUserId = null;
        activeChatUser = null;
    });

    document.getElementById('logoutButton').addEventListener('click', logout);
});