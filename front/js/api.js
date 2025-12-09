// Arquivo: front/js/api.js

const firebaseConfig = {
  apiKey: "AIzaSyD65Lod9FdwQfVZkXL_MHkJtPDfXADf8OI",
  authDomain: "maqueiko-db.firebaseapp.com",
  projectId: "maqueiko-db",
  storageBucket: "maqueiko-db.firebasestorage.app",
  messagingSenderId: "308588925001",
  appId: "1:308588925001:web:e62b9a8eaeb93cae3e6f98",
  measurementId: "G-13KZH8P1WP"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const firestore = firebase.firestore();

const getBaseUrl = () => {
    const { hostname, port } = window.location;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '9090' && port !== '5000') {
        return 'http://localhost:9090';
    }
    return window.location.origin;
};

const BASE_URL = getBaseUrl();
const API_URL = `${BASE_URL}/api`;

const getCleanImageUrl = (path) => {
    if (!path) return null;
    if (Array.isArray(path)) path = path.length > 0 ? path[0] : null;
    if (typeof path !== 'string') return null;
    if (path.startsWith('http') || path.startsWith('https')) return path; 
    if (path.startsWith('www.') || path.includes('.com') || path.includes('.net')) return `https://${path}`;
    const cleanPath = path.replace(/^[\/\\]+/, '');
    return `${BASE_URL}/${cleanPath}?t=${Date.now()}`; 
};

// --- HELPER DE MÍDIA E PREVIEW ---
const getPostMediaHtml = (mediaData, linkPreview = null) => {
    let html = '';
    const mediaList = Array.isArray(mediaData) ? mediaData : (mediaData ? [mediaData] : []);
    
    if (mediaList.length > 0) {
        const gridStyle = mediaList.length > 1 ? `display: grid; grid-template-columns: repeat(${Math.min(mediaList.length, 2)}, 1fr); gap: 5px;` : '';
        html += `<div class="post-media-gallery" style="${gridStyle} margin-top: 10px; border-radius: 12px; overflow: hidden;">`;
        
        mediaList.forEach(url => {
            if (!url) return;
            const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
            const ytMatch = url.match(youtubeRegex);

            if (ytMatch && ytMatch[1]) {
                html += `
                    <div class="post-video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; width: 100%;">
                        <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            src="https://www.youtube.com/embed/${ytMatch[1]}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>`;
            } else {
                const cleanUrl = getCleanImageUrl(url);
                if (!cleanUrl) return; 
                
                if (cleanUrl.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
                    html += `<video controls style="width: 100%; height: 100%; object-fit: cover; max-height: 500px;"><source src="${cleanUrl}" type="video/mp4"></video>`;
                } else {
                    html += `<img src="${cleanUrl}" style="width: 100%; height: 100%; object-fit: cover; max-height: 500px; display: block;" onclick="window.open(this.src)" onerror="this.style.display='none'">`;
                }
            }
        });
        html += `</div>`;
    }

    if (linkPreview && linkPreview.url && mediaList.length === 0) {
        html += `
            <a href="${linkPreview.url}" target="_blank" style="text-decoration: none; color: inherit;">
                <div class="link-preview-card" style="margin-top: 10px; border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; background: var(--background-color);">
                    ${linkPreview.image ? `<img src="${linkPreview.image}" style="width: 100%; height: 200px; object-fit: cover;">` : ''}
                    <div style="padding: 10px;">
                        <h4 style="margin: 0 0 5px 0; font-size: 1rem; color: var(--text-primary);">${linkPreview.title || 'Link'}</h4>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${linkPreview.description || linkPreview.url}</p>
                    </div>
                </div>
            </a>`;
    }
    return html;
};

// --- HELPER PARA HTML DA ENQUETE ---
const getPollHtml = (poll, postId, currentUserId) => {
    if (!poll || !poll.options) return '';

    let optionsHtml = '';
    const totalVotes = poll.totalVotes || 0;

    poll.options.forEach((option, index) => {
        const votes = option.votes ? option.votes.length : 0;
        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        
        const hasVotedThis = currentUserId && option.votes && option.votes.includes(currentUserId);
        const votedClass = hasVotedThis ? 'voted' : '';

        optionsHtml += `
            <div class="poll-option ${votedClass}" onclick="handlePollVote('${postId}', ${index})">
                <div class="poll-bar" style="width: ${percentage}%"></div>
                <span class="poll-text">${option.text}</span>
                <span class="poll-stats">
                    ${percentage}% <i class="fa-solid fa-check poll-check"></i>
                </span>
            </div>
        `;
    });

    return `
        <div class="poll-container" id="poll-${postId}">
            <div class="poll-question">${poll.question}</div>
            <div class="poll-options">${optionsHtml}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">
                Total de votos: ${totalVotes}
            </div>
        </div>
    `;
};

// Função Global para clique na enquete
window.handlePollVote = async (postId, optionIndex) => {
    try {
        const response = await fetchWithAuth('/posts/poll/vote', {
            method: 'PUT',
            body: JSON.stringify({ postId, optionIndex })
        });
        
        const currentUserProfile = JSON.parse(localStorage.getItem('masqueko-user-profile'));
        const currentUserId = currentUserProfile ? currentUserProfile._id : null;

        const newPollHtml = getPollHtml(response, postId, currentUserId);
        const pollContainer = document.getElementById(`poll-${postId}`);
        if (pollContainer) {
            pollContainer.outerHTML = newPollHtml;
        }
    } catch (error) {
        showNotification(error.message, true);
    }
};

const getToken = async () => {
    const user = auth.currentUser;
    if (user) { return await user.getIdToken(true); }
    return null;
};

const fetchWithAuth = async (endpoint, options = {}) => {
    const token = await getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ocorreu um erro na requisição');
    }
    if (response.status === 204) { return; }
    return response.json();
};

const logout = () => {
    auth.signOut().then(() => {
        localStorage.removeItem('masqueko-user-profile');
        window.location.href = '/pages/index.html'; 
    });
};

const showNotification = (message, isError = false) => {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#e53e3e' : '#4caf50';
    notification.classList.add('show');
    setTimeout(() => { notification.classList.remove('show'); }, 3000);
};

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    if (seconds < 60) return `agora`;
    if (seconds < 3600) return `há ${Math.round(seconds/60)} min`;
    if (seconds < 86400) return `há ${Math.round(seconds/3600)}h`;
    return `há ${Math.round(seconds/86400)}d`;
}

const uploadFileToStorage = async (files, path = 'posts') => {
    const fileList = (files instanceof FileList || Array.isArray(files)) ? files : [files];
    if (fileList.length === 0 || !fileList[0]) throw new Error('Nenhum arquivo selecionado.');
    const token = await getToken();
    if (!token) throw new Error('Não autorizado.');
    const formData = new FormData();
    formData.append('uploadType', path); 
    for (let i = 0; i < fileList.length; i++) { formData.append('files', fileList[i]); }
    showNotification('Enviando arquivos...', false);
    const response = await fetch(`${API_URL}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Falha no upload');
    showNotification('Upload concluído!', false);
    return data.filePaths;
};

// === 1. BARRA DE FERRAMENTAS DO MARKDOWN (MELHORADA E INTELIGENTE) ===
const setupMarkdownToolbar = (textareaId) => {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    // Evita duplicar a barra se já existir
    if (textarea.parentNode.querySelector('.markdown-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'markdown-toolbar';
    
    // Configuração dos botões com prefixos, sufixos e textos de exemplo
    const buttons = [
        { icon: 'fa-bold', title: 'Negrito', prefix: '**', suffix: '**', placeholder: 'texto em negrito' },
        { icon: 'fa-italic', title: 'Itálico', prefix: '*', suffix: '*', placeholder: 'texto em itálico' },
        { icon: 'fa-heading', title: 'Título', prefix: '## ', suffix: '', placeholder: 'Título da Seção' },
        { icon: 'fa-quote-left', title: 'Citação', prefix: '> ', suffix: '', placeholder: 'Citação' },
        { icon: 'fa-list-ul', title: 'Lista', prefix: '- ', suffix: '', placeholder: 'Item da lista' },
        { icon: 'fa-code', title: 'Código', prefix: '`', suffix: '`', placeholder: 'código' }
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.type = 'button'; // Importante para não submeter formulários
        button.innerHTML = `<i class="fa-solid ${btn.icon}"></i>`;
        button.title = btn.title;
        
        button.style.marginRight = '5px';
        button.style.cursor = 'pointer';

        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const selectedText = text.substring(start, end);

            textarea.focus();

            if (selectedText.length > 0) {
                // CENÁRIO 1: Usuário selecionou um texto -> Envolve o texto
                // Ex: "Olá" vira "**Olá**"
                const replacement = btn.prefix + selectedText + btn.suffix;
                textarea.setRangeText(replacement, start, end, 'select');
            } else {
                // CENÁRIO 2: Nada selecionado -> Insere placeholder e SELECIONA O PLACEHOLDER
                // Ex: "**[texto em negrito]**"
                const replacement = btn.prefix + btn.placeholder + btn.suffix;
                
                // Insere o texto completo
                textarea.setRangeText(replacement, start, end, 'end');

                // Calcula onde começa e termina o placeholder para selecioná-lo
                const newSelectionStart = start + btn.prefix.length;
                const newSelectionEnd = newSelectionStart + btn.placeholder.length;

                // Aplica a seleção apenas no texto de exemplo
                textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
            }

            // Dispara evento de input para que o auto-resize ou validações funcionem
            textarea.dispatchEvent(new Event('input'));
        });

        toolbar.appendChild(button);
    });

    textarea.parentNode.insertBefore(toolbar, textarea);
};

// === 2. LÓGICA DE MENÇÃO (@) ===
const setupGlobalMentionLogic = () => {
    let dropdown = document.querySelector('.mention-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'mention-dropdown';
        document.body.appendChild(dropdown);
    }

    let myFriends = [];

    document.addEventListener('input', async (e) => {
        const target = e.target;
        if (!target.classList.contains('mention-enabled') && target.id !== 'postContentInput') return;

        const cursorPosition = target.selectionStart;
        const textBeforeCursor = target.value.substring(0, cursorPosition);
        const words = textBeforeCursor.split(/\s/);
        const currentWord = words[words.length - 1];

        if (currentWord.startsWith('@') && currentWord.length > 1) {
            const query = currentWord.substring(1).toLowerCase();
            
            if (myFriends.length === 0) {
                try {
                    const userProfile = await fetchWithAuth('/auth/me');
                    if (userProfile.friends && userProfile.friends.length > 0) {
                        const promises = userProfile.friends.map(fid => fetchWithAuth(`/users/${fid}`));
                        const friendsData = await Promise.all(promises);
                        myFriends = friendsData.map(res => res.user || res);
                    }
                } catch (err) { console.error("Erro menção:", err); }
            }

            const filtered = myFriends.filter(f => f.name && f.name.toLowerCase().includes(query));

            if (filtered.length > 0) {
                const rect = target.getBoundingClientRect();
                dropdown.style.top = `${window.scrollY + rect.bottom}px`;
                dropdown.style.left = `${rect.left}px`;
                dropdown.style.display = 'block';
                dropdown.innerHTML = '';

                filtered.forEach(friend => {
                    const item = document.createElement('div');
                    item.className = 'mention-item';
                    item.innerHTML = `<img src="${getCleanImageUrl(friend.avatar)}" class="mention-avatar"><span class="mention-name">${friend.name}</span>`;
                    
                    item.addEventListener('click', () => {
                        const textAfter = target.value.substring(cursorPosition);
                        const textBefore = textBeforeCursor.substring(0, textBeforeCursor.lastIndexOf(currentWord));
                        const mentionCode = `@[${friend.name}](${friend._id}) `;
                        target.value = textBefore + mentionCode + textAfter;
                        dropdown.style.display = 'none';
                        target.focus();
                    });
                    dropdown.appendChild(item);
                });
            } else { dropdown.style.display = 'none'; }
        } else { dropdown.style.display = 'none'; }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.mention-dropdown')) {
            dropdown.style.display = 'none';
        }
    });
};

// === 3. FORMATAÇÃO DO POST ===
const formatPostContent = (content) => {
    if (!content) return '';
    
    let html = content;

    if (window.marked) {
        try {
            html = marked.parse(content, { breaks: true, gfm: true });
        } catch (e) { console.error("Marked Error:", e); }
    } else {
        html = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    const brokenLinkRegex = /@<a href="([^"]+)">([^<]+)<\/a>/g;
    html = html.replace(brokenLinkRegex, (match, userId, name) => {
        return `<a href="/pages/perfil.html?id=${userId}" class="mention-link" style="color: var(--primary-color); font-weight: bold; text-decoration: none; background: var(--primary-extralight); padding: 0 4px; border-radius: 4px;">@${name}</a>`;
    });

    const explicitMentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    html = html.replace(explicitMentionRegex, (match, name, userId) => {
        return `<a href="/pages/perfil.html?id=${userId}" class="mention-link" style="color: var(--primary-color); font-weight: bold; text-decoration: none; background: var(--primary-extralight); padding: 0 4px; border-radius: 4px;">@${name}</a>`;
    });

    const hashtagRegex = /#(\w+)/g;
    html = html.replace(hashtagRegex, (match, tag) => `<a href="/pages/tag.html?tag=${tag.toLowerCase()}" class="hashtag-link">${match}</a>`);

    return html;
};

const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const userMenu = document.querySelector('.user-menu');
    if (userMenu && !document.getElementById('themeToggleBtn')) {
        const btn = document.createElement('button'); btn.id = 'themeToggleBtn'; btn.title = "Alternar Tema"; btn.innerHTML = savedTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        const logoutBtn = document.getElementById('logoutButton'); if (logoutBtn) userMenu.insertBefore(btn, logoutBtn); else userMenu.appendChild(btn);
        btn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme'); const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme); localStorage.setItem('theme', newTheme); btn.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        });
    }
};

const registerPWA = () => {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('ServiceWorker registrado com sucesso:', registration.scope))
                .catch(err => console.error('Falha ao registrar ServiceWorker:', err));
        });
    }
};

document.addEventListener('DOMContentLoaded', () => { 
    initTheme(); 
    registerPWA(); 
    auth.onAuthStateChanged(user => { if (user) {} });
});